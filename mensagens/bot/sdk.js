// sdk.js - SDK COMPLETO COM FLUXO DE CHAMADAS (v7)
// versão 7.0.0
// Hospedar em: https://alexandre7888.github.io/mensagens/bot/sdk.js

const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

class MessageSDK {
    constructor() {
        this.FIREBASE_URL = 'https://html-785e3-default-rtdb.firebaseio.com';
        this.botId = null;
        this.botNome = null;
        this.conectado = false;
        this.comandos = new Map();
        this.eventos = new Map();
        this.versao = '7.0.0';
        
        // Monitoramento
        this.monitorInterval = null;
        this.ultimoTimestamp = {};
        this.processando = {};
        
        // ========== SISTEMA DE CHAMADAS (FLUXO CORRETO) ==========
        this.peer = null;
        this.peerId = null;
        this.localStream = null;
        this.currentCall = null;
        this.activeCallId = null;
        this.isInCall = false;
        this.remoteStream = null;
        this.callerId = null;
        this.callbacks = new Map();
        
        // Áudio
        this.audioDir = path.join(process.cwd(), 'chamadas_audio');
        if (!fs.existsSync(this.audioDir)) {
            fs.mkdirSync(this.audioDir, { recursive: true });
        }
        
        // Carregar PeerJS
        try {
            this.Peer = require('peerjs');
        } catch(e) {
            this.Peer = null;
        }
    }

    getVersao() {
        return this.versao;
    }

    // ==================== REQUISIÇÕES ====================

    async _request(path, method = 'GET', data = null) {
        const url = `${this.FIREBASE_URL}${path}`;

        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const options = {
                hostname: urlObj.hostname,
                path: urlObj.pathname + urlObj.search,
                method: method,
                headers: { 'Content-Type': 'application/json' }
            };

            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        resolve(body ? JSON.parse(body) : null);
                    } catch(e) {
                        resolve(body);
                    }
                });
            });

            req.on('error', reject);
            if (data) req.write(JSON.stringify(data));
            req.end();
        });
    }

    // ==================== INICIALIZAÇÃO ====================

    async iniciar(config) {
        this.botId = config.botId;
        this.botNome = config.botNome || config.botId;

        console.log(`🤖 SDK v${this.versao} - Bot: ${this.botNome}`);

        const userData = await this._request(`/users/${this.botId}.json`);

        if (!userData) {
            throw new Error(`Bot ${this.botId} não encontrado!`);
        }

        this.conectado = true;
        this.emit('ready', { botId: this.botId, nome: this.botNome });

        // Inicializar PeerJS
        this._initPeer();

        return this;
    }

    // ==================== PEERJS ====================

    _initPeer() {
        if (!this.Peer) {
            console.log('⚠️ PeerJS não disponível. Instale: npm install peerjs');
            return;
        }

        this.peer = new this.Peer(`bot_${this.botId}_${Date.now()}`, {
            config: {
                'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            },
            debug: 2
        });

        this.peer.on('open', (id) => {
            this.peerId = id;
            console.log(`✅ PeerJS conectado! ID: ${id}`);
            this.emit('peer.ready', { peerId: id });
        });

        this.peer.on('call', (call) => {
            console.log(`📞 Recebendo chamada P2P de: ${call.peer}`);
            this.currentCall = call;
            
            // Atender com stream local se disponível
            if (this.localStream) {
                call.answer(this.localStream);
            } else {
                call.answer();
            }

            call.on('stream', (remoteStream) => {
                console.log('🔊 Stream remoto recebido!');
                this.remoteStream = remoteStream;
                this.emit('call.audio.stream', {
                    peerId: call.peer,
                    stream: remoteStream,
                    timestamp: Date.now()
                });
            });

            call.on('close', () => {
                console.log('📞 Chamada encerrada');
                this._encerrarChamadaLocal();
            });

            this.isInCall = true;
            this.emit('call.connected', {
                peerId: call.peer,
                callId: this.activeCallId
            });
        });

        this.peer.on('error', (err) => {
            console.error('❌ Erro PeerJS:', err);
            this.emit('peer.error', { error: err });
        });
    }

    // ==================== GRUPOS ====================

    async listarGrupos() {
        if (!this.conectado) throw new Error('SDK não inicializado');

        const userData = await this._request(`/users/${this.botId}.json`);
        const grupos = [];

        if (userData && userData.chats) {
            for (const [chatId, chatData] of Object.entries(userData.chats)) {
                const grupo = await this._request(`/groups/${chatId}.json`);
                grupos.push({
                    id: chatId,
                    nome: grupo?.nome || chatData.name || chatId,
                    tipo: chatData.type || 'group',
                    membros: grupo?.members ? Object.keys(grupo.members).length : 0,
                    dono: grupo?.owner || null,
                    criado: grupo?.criado || null
                });
            }
        }

        return grupos;
    }

    async getInfoGrupo(grupoId) {
        const grupo = await this._request(`/groups/${grupoId}.json`);
        return {
            id: grupoId,
            nome: grupo?.nome || grupoId,
            descricao: grupo?.descricao || '',
            dono: grupo?.owner || null,
            totalMembros: grupo?.members ? Object.keys(grupo.members).length : 0,
            criado: grupo?.criado || null
        };
    }

    // ==================== MENSAGENS ====================

    async enviarMensagem(grupoId, texto, options = {}) {
        if (!this.conectado) throw new Error('SDK não inicializado');

        const timestamp = Date.now();
        const msgId = `msg_${timestamp}_${Math.random().toString(36).substr(2, 6)}`;

        const mensagem = {
            id: msgId,
            senderId: this.botId,
            senderName: this.botNome,
            text: texto,
            timestamp: timestamp,
            type: options.type || 'text',
            mencionados: options.mencionados || [],
            replyTo: options.replyTo || null
        };

        await this._request(`/groups/${grupoId}/messages/${msgId}.json`, 'PUT', mensagem);
        return { success: true, messageId: msgId };
    }

    async lerMensagens(grupoId, limite = 50) {
        const mensagens = await this._request(`/groups/${grupoId}/messages.json?orderBy="timestamp"&limitToLast=${limite}`);
        if (!mensagens) return [];
        
        return Object.entries(mensagens)
            .map(([id, msg]) => ({ id, ...msg }))
            .sort((a, b) => a.timestamp - b.timestamp);
    }

    // ==================== MEMBROS ====================

    async listarMembros(grupoId) {
        const grupo = await this._request(`/groups/${grupoId}.json`);
        if (!grupo || !grupo.members) return [];

        const membros = [];
        for (const [userId, userData] of Object.entries(grupo.members)) {
            membros.push({
                id: userId,
                nome: userData.name || userId,
                entrou: userData.joined,
                cargos: userData.cargos || []
            });
        }
        return membros;
    }

    // ==================== CARGOS ====================

    async criarCargo(grupoId, nome, cor = '#ffffff', permissoes = []) {
        let cargos = await this._request(`/groups/${grupoId}/cargos.json`);
        if (!cargos) cargos = { cargos_personalizados: {} };
        if (!cargos.cargos_personalizados) cargos.cargos_personalizados = {};

        cargos.cargos_personalizados[nome] = {
            cor: cor,
            membros: [],
            permissoes: permissoes
        };

        await this._request(`/groups/${grupoId}/cargos.json`, 'PUT', cargos);
        return { success: true, nome: nome };
    }

    async listarCargos(grupoId) {
        const cargos = await this._request(`/groups/${grupoId}/cargos.json`);
        if (!cargos || !cargos.cargos_personalizados) return [];

        return Object.entries(cargos.cargos_personalizados).map(([nome, dados]) => ({
            nome: nome,
            cor: dados.cor,
            permissoes: dados.permissoes || [],
            membros: dados.membros || []
        }));
    }

    // ==================== COMANDOS ====================

    registrarComando(nome, callback, descricao = '') {
        this.comandos.set(nome, { callback, descricao });
        console.log(`✅ Comando registrado: ${nome}`);
        return this;
    }

    // ==================== SISTEMA DE CHAMADAS (FLUXO CORRETO) ====================

    // 1. Verificar chamadas no Firebase
    async listarChamadas() {
        const chamadas = await this._request('/calls.json');
        if (!chamadas) return [];
        
        return Object.entries(chamadas)
            .filter(([id, data]) => data.status !== 'ended')
            .map(([id, data]) => ({
                id: id,
                callerId: data.callerId,
                receiverId: data.receiverId,
                isVideo: data.isVideo || false,
                status: data.status || 'initiated',
                timestamp: data.timestamp,
                receiverPeerId: data.receiverPeerId || null
            }));
    }

    async getStatusChamada(callId) {
        const chamada = await this._request(`/calls/${callId}.json`);
        if (!chamada) return null;
        
        return {
            id: callId,
            callerId: chamada.callerId,
            receiverId: chamada.receiverId,
            isVideo: chamada.isVideo || false,
            status: chamada.status || 'initiated',
            timestamp: chamada.timestamp,
            receiverPeerId: chamada.receiverPeerId || null
        };
    }

    // 2. Entrar em chamada (igual ao HTML)
    async entrarChamada(callId) {
        if (!this.peerId) {
            throw new Error('PeerJS não conectado. Aguarde...');
        }

        // Verificar se chamada existe
        const chamada = await this.getStatusChamada(callId);
        if (!chamada) {
            throw new Error('Chamada não encontrada');
        }

        if (chamada.status === 'ended') {
            throw new Error('Chamada já encerrada');
        }

        console.log(`📞 Entrando na chamada: ${callId}`);
        console.log(`📞 Caller: ${chamada.callerId}`);

        // Solicitar áudio
        try {
            this.localStream = await this._getUserMedia();
            console.log('🎤 Microfone capturado');
        } catch(e) {
            console.log('⚠️ Sem áudio:', e.message);
        }

        this.activeCallId = callId;

        // Atualizar Firebase com PeerID (igual ao HTML)
        await this._request(`/calls/${callId}.json`, 'PATCH', {
            status: 'active',
            receiverPeerId: this.peerId
        });

        console.log(`✅ Chamada ativa! Aguardando conexão P2P...`);
        this.emit('call.joined', {
            callId: callId,
            peerId: this.peerId,
            callerId: chamada.callerId
        });

        return { success: true, callId: callId };
    }

    // 3. Sair da chamada
    async sairChamada() {
        if (!this.activeCallId) {
            throw new Error('Não está em uma chamada');
        }

        this._encerrarChamadaLocal();

        // Atualizar Firebase
        await this._request(`/calls/${this.activeCallId}.json`, 'PATCH', {
            status: 'ended'
        });

        console.log('👋 Chamada encerrada');
        this.emit('call.ended', { callId: this.activeCallId });

        return { success: true };
    }

    _encerrarChamadaLocal() {
        if (this.currentCall) {
            this.currentCall.close();
            this.currentCall = null;
        }

        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(t => t.stop());
            this.remoteStream = null;
        }

        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            this.localStream = null;
        }

        this.isInCall = false;
        this.activeCallId = null;
    }

    // 4. Obter stream de áudio
    async _getUserMedia() {
        // Usar navigator.mediaDevices se disponível (cliente web)
        if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
            return await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
            });
        }
        
        // Fallback para Node.js (usando arecord ou similar)
        console.log('⚠️ Usando fallback de áudio para Node.js');
        return null;
    }

    // 5. Monitorar chamadas (igual ao HTML)
    async monitorarChamadas(callback = null) {
        console.log('🔍 Monitorando chamadas...');

        setInterval(async () => {
            try {
                const chamadas = await this.listarChamadas();
                
                for (const chamada of chamadas) {
                    // Se chamada está ativa e não estamos nela
                    if (chamada.status === 'active' && chamada.receiverPeerId !== this.peerId) {
                        console.log(`📞 Chamada ativa detectada: ${chamada.id}`);
                        this.emit('call.incoming', {
                            callId: chamada.id,
                            callerId: chamada.callerId,
                            isVideo: chamada.isVideo
                        });

                        if (callback) {
                            await callback('incoming', chamada);
                        }
                    }
                }
            } catch(e) {}
        }, 3000);
    }

    // ==================== MONITORAMENTO DE MENSAGENS ====================

    async monitorarGrupo(grupoId, callback = null) {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
        }

        if (!this.ultimoTimestamp[grupoId]) {
            this.ultimoTimestamp[grupoId] = Date.now();
        }

        console.log(`📡 Monitorando mensagens no grupo ${grupoId}...`);

        this.monitorInterval = setInterval(async () => {
            if (this.processando[grupoId]) return;
            this.processando[grupoId] = true;

            try {
                const mensagens = await this._request(`/groups/${grupoId}/messages.json`);
                
                if (mensagens) {
                    const msgs = Object.entries(mensagens)
                        .map(([id, msg]) => ({ id, ...msg }))
                        .filter(msg => msg.timestamp > this.ultimoTimestamp[grupoId] && msg.senderId !== this.botId)
                        .sort((a, b) => a.timestamp - b.timestamp);

                    for (const msg of msgs) {
                        if (callback) {
                            await callback(msg);
                        }

                        this.emit('mensagem', msg);

                        if (msg.text && msg.text.startsWith('!')) {
                            const [comando, ...args] = msg.text.slice(1).split(' ');
                            if (this.comandos.has(comando)) {
                                const cmd = this.comandos.get(comando);
                                const ctx = {
                                    grupoId: grupoId,
                                    autorId: msg.senderId,
                                    autorNome: msg.senderName,
                                    mensagemId: msg.id,
                                    enviarMsg: (texto) => this.enviarMensagem(grupoId, texto),
                                    responder: (texto) => this.enviarMensagem(grupoId, texto, { replyTo: msg.id })
                                };
                                try {
                                    await cmd.callback(args, ctx);
                                    console.log(`🎯 Comando executado: ${comando} por ${msg.senderName}`);
                                } catch(e) {
                                    console.error(`❌ Erro no comando ${comando}:`, e.message);
                                    await this.enviarMensagem(grupoId, `❌ Erro: ${e.message}`);
                                }
                            }
                        }

                        if (msg.timestamp > this.ultimoTimestamp[grupoId]) {
                            this.ultimoTimestamp[grupoId] = msg.timestamp;
                        }
                    }
                }
            } catch(e) {}

            this.processando[grupoId] = false;
        }, 2000);

        return this.monitorInterval;
    }

    // ==================== EVENTOS ====================

    on(evento, callback) {
        if (!this.eventos.has(evento)) {
            this.eventos.set(evento, []);
        }
        this.eventos.get(evento).push(callback);
        return this;
    }

    emit(evento, dados) {
        if (this.eventos.has(evento)) {
            this.eventos.get(evento).forEach(cb => {
                try {
                    cb(dados);
                } catch(e) {
                    console.error(`Erro no evento ${evento}:`, e);
                }
            });
        }
    }

    // ==================== UTILIDADES ====================

    getBotId() {
        return this.botId;
    }

    getBotNome() {
        return this.botNome;
    }

    isConectado() {
        return this.conectado;
    }

    isEmChamada() {
        return this.isInCall;
    }

    getPeerId() {
        return this.peerId;
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = MessageSDK;