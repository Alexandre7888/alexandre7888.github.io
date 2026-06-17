// sdk.js - SDK SEM wrtc e com porta dinâmica
// versão 13.0.0
// Hospedar em: https://alexandre7888.github.io/mensagens/bot/sdk.js

const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class MessageSDK extends EventEmitter {
    constructor() {
        super();
        this.FIREBASE_URL = 'https://html-785e3-default-rtdb.firebaseio.com';
        this.botId = null;
        this.botNome = null;
        this.conectado = false;
        this.comandos = new Map();
        this.versao = '13.0.0';
        
        // Monitoramento
        this.monitorInterval = null;
        this.ultimoTimestamp = {};
        this.processando = {};
        
        // ========== SISTEMA DE CHAMADAS P2P ==========
        this.peer = null;
        this.peerId = null;
        this.currentCall = null;
        this.activeCallId = null;
        this.isInCall = false;
        this.remoteStreams = new Map();
        this.callerId = null;
        this.receiverId = null;
        this.chamadaAtiva = null;
        this.entradaAutomatica = true;
        this.chamadasDetectadas = new Set();
        
        // ========== GRAVAÇÃO ==========
        this.audioDir = path.join(process.cwd(), 'chamadas_audio');
        this.gravacaoAtiva = null;
        this.streamsGravacao = new Map();
        
        if (!fs.existsSync(this.audioDir)) {
            fs.mkdirSync(this.audioDir, { recursive: true });
        }
        
        // ========== SERVIDOR DE ÁUDIO (PORTA DINÂMICA) ==========
        this.audioServer = null;
        this.audioPort = 3001;
        this._iniciarServidorAudio();
        
        // ========== CARREGAR PEERJS ==========
        try {
            const Peer = require('peerjs');
            this.Peer = Peer;
            console.log('✅ PeerJS carregado');
        } catch(e) {
            this.Peer = null;
            console.log('⚠️ PeerJS não encontrado. Instale: npm install peerjs');
        }
        
        // ========== SEM WRTC (usamos fallback) ==========
        this.wrtc = null;
        console.log('ℹ️ Usando modo sem WebRTC (apenas gerenciamento de chamadas)');
    }

    getVersao() {
        return this.versao;
    }

    // ==================== SERVIDOR DE ÁUDIO (PORTA DINÂMICA) ====================
    
    _iniciarServidorAudio() {
        const http = require('http');
        
        // Tentar portas de 3001 a 3010
        const tentarPorta = (porta) => {
            this.audioServer = http.createServer((req, res) => {
                const url = new URL(req.url, `http://localhost:${porta}`);
                const filePath = path.join(this.audioDir, url.pathname);
                
                if (!filePath.startsWith(this.audioDir)) {
                    res.writeHead(403);
                    res.end('Acesso negado');
                    return;
                }
                
                if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                    const stat = fs.statSync(filePath);
                    res.writeHead(200, {
                        'Content-Type': 'audio/webm',
                        'Content-Length': stat.size,
                        'Access-Control-Allow-Origin': '*'
                    });
                    fs.createReadStream(filePath).pipe(res);
                } else {
                    res.writeHead(404);
                    res.end('Áudio não encontrado');
                }
            });
            
            this.audioServer.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    console.log(`⚠️ Porta ${porta} em uso, tentando ${porta + 1}...`);
                    tentarPorta(porta + 1);
                } else {
                    console.error('❌ Erro no servidor:', err.message);
                }
            });
            
            this.audioServer.listen(porta, '0.0.0.0', () => {
                this.audioPort = porta;
                console.log(`🎵 Servidor de áudio: http://localhost:${porta}`);
            });
        };
        
        tentarPorta(this.audioPort);
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
        await this._initPeer();

        return this;
    }

    // ==================== PEERJS ====================

    async _initPeer() {
        if (!this.Peer) {
            console.log('⚠️ PeerJS não disponível');
            return;
        }

        const peerId = `bot_${this.botId}_${Date.now()}`;
        
        try {
            this.peer = new this.Peer(peerId, {
                host: '0.peerjs.com',
                port: 443,
                path: '/',
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
                this._verificarChamadasPendentes();
            });

            this.peer.on('call', (call) => {
                console.log(`📞 Recebendo chamada P2P de: ${call.peer}`);
                this._handleIncomingCall(call);
            });

            this.peer.on('error', (err) => {
                if (err.type === 'peer-unavailable') {
                    console.log(`⚠️ Peer ${err.message} não disponível`);
                } else {
                    console.error('❌ Erro PeerJS:', err.type, err.message);
                }
                this.emit('peer.error', { error: err });
            });

            this.peer.on('disconnected', () => {
                console.log('⚠️ PeerJS desconectado, reconectando...');
                setTimeout(() => {
                    if (this.peer) {
                        this.peer.reconnect();
                    }
                }, 5000);
            });

        } catch(e) {
            console.error('❌ Erro ao iniciar PeerJS:', e.message);
        }
    }

    // ==================== MANIPULAR CHAMADA ====================

    _handleIncomingCall(call) {
        console.log(`📞 Chamada recebida de: ${call.peer}`);
        this.currentCall = call;
        
        // Responder sem stream (modo apenas gerenciamento)
        call.answer();

        call.on('close', () => {
            console.log(`📞 Chamada encerrada com ${call.peer}`);
            this.remoteStreams.delete(call.peer);
            
            if (this.remoteStreams.size === 0) {
                this.isInCall = false;
                this.emit('call.disconnected', { callId: this.activeCallId });
            }
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

    // ==================== SISTEMA DE CHAMADAS ====================

    async listarChamadas(grupoId = null) {
        const chamadas = await this._request('/calls.json');
        if (!chamadas) return [];
        
        let lista = Object.entries(chamadas)
            .filter(([id, data]) => data.status !== 'ended')
            .map(([id, data]) => ({
                id: id,
                callerId: data.callerId,
                callerPeerId: data.callerPeerId || null,
                receiverId: data.receiverId || null,
                isVideo: data.isVideo || false,
                status: data.status || 'initiated',
                timestamp: data.timestamp || 0
            }));
        
        if (grupoId) {
            lista = lista.filter(c => c.receiverId === grupoId);
        }
        
        return lista;
    }

    async _verificarChamadasPendentes() {
        if (!this.entradaAutomatica) return;
        if (!this.peerId) return;
        if (this.isInCall) return;
        
        try {
            const chamadas = await this.listarChamadas();
            const chamadasAtivas = chamadas.filter(c => c.status === 'active' || c.status === 'initiated');
            
            for (const chamada of chamadasAtivas) {
                if (this.chamadasDetectadas.has(chamada.id)) continue;
                this.chamadasDetectadas.add(chamada.id);
                
                if (chamada.callerPeerId === this.peerId) continue;
                
                console.log(`📞 Chamada detectada: ${chamada.id}`);
                
                this.emit('call.incoming', {
                    callId: chamada.id,
                    callerId: chamada.callerId,
                    receiverId: chamada.receiverId,
                    isVideo: chamada.isVideo,
                    status: chamada.status,
                    timestamp: Date.now()
                });
                
                if (this.entradaAutomatica && !this.isInCall) {
                    console.log(`🚪 Entrando automaticamente...`);
                    await this.entrarChamada(chamada.id);
                }
            }
        } catch(e) {
            console.error('Erro ao verificar chamadas:', e.message);
        }
    }

    async entrarChamada(callId) {
        if (!this.peerId) {
            throw new Error('PeerJS não conectado');
        }

        if (this.isInCall) {
            throw new Error('Já está em uma chamada');
        }

        const chamada = await this._request(`/calls/${callId}.json`);
        if (!chamada) {
            throw new Error('Chamada não encontrada');
        }

        if (chamada.status === 'ended') {
            throw new Error('Chamada já encerrada');
        }

        console.log(`📞 Entrando na chamada: ${callId}`);
        console.log(`📞 Caller: ${chamada.callerId}`);

        this.receiverId = chamada.receiverId;
        this.callerId = chamada.callerId;
        this.activeCallId = callId;
        this.chamadaAtiva = chamada;

        // Atualizar Firebase
        await this._request(`/calls/${callId}.json`, 'PATCH', {
            status: 'active',
            receiverPeerId: this.peerId
        });

        // Conectar ao caller (apenas gerenciamento, sem áudio real)
        if (chamada.callerPeerId) {
            console.log(`🔗 Conectando ao caller: ${chamada.callerPeerId}`);
            
            try {
                const call = this.peer.call(chamada.callerPeerId, null);
                
                call.on('close', () => {
                    console.log(`📞 Chamada com caller encerrada`);
                    this.isInCall = false;
                });

                this.currentCall = call;
                this.isInCall = true;
                
            } catch(e) {
                console.error('❌ Erro ao conectar:', e.message);
                throw e;
            }
        } else {
            console.log('⚠️ Caller não tem PeerID, aguardando chamada...');
        }

        this.emit('call.joined', {
            callId: callId,
            peerId: this.peerId,
            callerId: chamada.callerId,
            receiverId: chamada.receiverId,
            timestamp: Date.now()
        });

        console.log(`✅ Entrou na chamada!`);
        return { success: true, callId: callId };
    }

    async sairChamada() {
        if (!this.activeCallId) {
            throw new Error('Não está em uma chamada');
        }

        const callId = this.activeCallId;

        if (this.currentCall) {
            this.currentCall.close();
            this.currentCall = null;
        }

        this.remoteStreams.clear();

        await this._request(`/calls/${callId}.json`, 'PATCH', {
            status: 'ended'
        });

        this.isInCall = false;
        this.activeCallId = null;

        console.log('👋 Chamada encerrada');
        this.emit('call.ended', {
            callId: callId,
            receiverId: this.receiverId,
            timestamp: Date.now()
        });

        return { success: true };
    }

    // ==================== MONITORAMENTO ====================

    async monitorarChamadas(grupoId = null) {
        console.log(`🔍 Monitorando chamadas...`);

        setInterval(async () => {
            try {
                const chamadas = await this.listarChamadas(grupoId);
                const chamadasAtivas = chamadas.filter(c => c.status === 'active' || c.status === 'initiated');
                
                for (const chamada of chamadasAtivas) {
                    if (this.chamadasDetectadas.has(chamada.id)) continue;
                    if (chamada.callerPeerId === this.peerId) continue;
                    
                    this.chamadasDetectadas.add(chamada.id);
                    
                    console.log(`📞 Chamada detectada: ${chamada.id}`);
                    
                    this.emit('call.incoming', {
                        callId: chamada.id,
                        callerId: chamada.callerId,
                        receiverId: chamada.receiverId,
                        isVideo: chamada.isVideo,
                        status: chamada.status,
                        timestamp: Date.now()
                    });
                    
                    if (this.entradaAutomatica && !this.isInCall) {
                        console.log(`🚪 Entrando automaticamente...`);
                        try {
                            await this.entrarChamada(chamada.id);
                        } catch(e) {
                            console.error(`❌ Erro ao entrar: ${e.message}`);
                        }
                    }
                }
            } catch(e) {}
        }, 3000);
    }

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
                        if (callback) await callback(msg);
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
                                    console.error(`❌ Erro: ${e.message}`);
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

    // ==================== CONFIGURAÇÕES ====================

    setEntradaAutomatica(ativar) {
        this.entradaAutomatica = ativar;
        console.log(`🔘 Entrada automática: ${ativar ? '✅ Ativada' : '❌ Desativada'}`);
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