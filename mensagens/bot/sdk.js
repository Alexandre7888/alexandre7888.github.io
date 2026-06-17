// sdk.js - SDK COMPLETO COM GRAVAÇÃO DE CHAMADAS
// versão 8.0.0
// Hospedar em: https://alexandre7888.github.io/mensagens/bot/sdk.js

const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class MessageSDK {
    constructor() {
        this.FIREBASE_URL = 'https://html-785e3-default-rtdb.firebaseio.com';
        this.botId = null;
        this.botNome = null;
        this.conectado = false;
        this.comandos = new Map();
        this.eventos = new Map();
        this.versao = '8.0.0';
        
        // Monitoramento
        this.monitorInterval = null;
        this.ultimoTimestamp = {};
        this.processando = {};
        
        // ========== SISTEMA DE CHAMADAS ==========
        this.peer = null;
        this.peerId = null;
        this.localStream = null;
        this.currentCall = null;
        this.activeCallId = null;
        this.isInCall = false;
        this.remoteStreams = new Map();
        this.callerId = null;
        this.receiverId = null;
        this.chamadaAtiva = null;
        
        // ========== GRAVAÇÃO ==========
        this.audioDir = path.join(process.cwd(), 'chamadas_audio');
        this.gravacoes = new Map();
        this.gravacaoAtiva = null;
        this.streamsGravacao = new Map();
        
        // Criar pasta de áudio
        if (!fs.existsSync(this.audioDir)) {
            fs.mkdirSync(this.audioDir, { recursive: true });
        }
        
        // ========== SERVIDOR DE ÁUDIO ==========
        this.audioServer = null;
        this.audioPort = 3001;
        this._iniciarServidorAudio();
        
        // Carregar PeerJS
        try {
            this.Peer = require('peerjs');
        } catch(e) {
            this.Peer = null;
            console.log('⚠️ PeerJS não encontrado. Instale: npm install peerjs');
        }
    }

    getVersao() {
        return this.versao;
    }

    // ==================== SERVIDOR DE ÁUDIO ====================
    
    _iniciarServidorAudio() {
        const http = require('http');
        
        this.audioServer = http.createServer((req, res) => {
            const url = new URL(req.url, `http://localhost:${this.audioPort}`);
            const filePath = path.join(this.audioDir, url.pathname);
            
            // Segurança: evitar path traversal
            if (!filePath.startsWith(this.audioDir)) {
                res.writeHead(403);
                res.end('Acesso negado');
                return;
            }
            
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                const stat = fs.statSync(filePath);
                res.writeHead(200, {
                    'Content-Type': this._getContentType(filePath),
                    'Content-Length': stat.size,
                    'Access-Control-Allow-Origin': '*'
                });
                fs.createReadStream(filePath).pipe(res);
            } else {
                res.writeHead(404);
                res.end('Áudio não encontrado');
            }
        });
        
        this.audioServer.listen(this.audioPort, '0.0.0.0', () => {
            console.log(`🎵 Servidor de áudio em: http://localhost:${this.audioPort}`);
        });
    }

    _getContentType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const types = {
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.webm': 'audio/webm',
            '.mp4': 'video/mp4',
            '.ogg': 'audio/ogg'
        };
        return types[ext] || 'application/octet-stream';
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
            console.log('⚠️ PeerJS não disponível');
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
            
            if (this.localStream) {
                call.answer(this.localStream);
            } else {
                call.answer();
            }

            call.on('stream', (remoteStream) => {
                console.log('🔊 Stream recebido!');
                this.remoteStreams.set(call.peer, remoteStream);
                
                // Iniciar gravação do participante
                this._iniciarGravacaoParticipante(call.peer, remoteStream);
                
                this.emit('call.audio.stream', {
                    peerId: call.peer,
                    stream: remoteStream,
                    timestamp: Date.now()
                });
            });

            call.on('close', () => {
                console.log('📞 Chamada encerrada');
                this._finalizarGravacaoParticipante(call.peer);
                this.remoteStreams.delete(call.peer);
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

    // ==================== SISTEMA DE CHAMADAS (CORRIGIDO) ====================

    // 1. Buscar chamadas por receiverId (grupo)
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
        
        // Filtrar por grupo se especificado
        if (grupoId) {
            lista = lista.filter(c => c.receiverId === grupoId);
        }
        
        return lista;
    }

    async getStatusChamada(callId) {
        const chamada = await this._request(`/calls/${callId}.json`);
        if (!chamada) return null;
        
        return {
            id: callId,
            callerId: chamada.callerId,
            callerPeerId: chamada.callerPeerId || null,
            receiverId: chamada.receiverId || null,
            isVideo: chamada.isVideo || false,
            status: chamada.status || 'initiated',
            timestamp: chamada.timestamp || 0
        };
    }

    // 2. Entrar em chamada
    async entrarChamada(callId) {
        if (!this.peerId) {
            throw new Error('PeerJS não conectado. Aguarde...');
        }

        const chamada = await this.getStatusChamada(callId);
        if (!chamada) {
            throw new Error('Chamada não encontrada');
        }

        if (chamada.status === 'ended') {
            throw new Error('Chamada já encerrada');
        }

        console.log(`📞 Entrando na chamada: ${callId}`);
        console.log(`📞 Caller: ${chamada.callerId}`);
        console.log(`📞 Grupo: ${chamada.receiverId}`);

        this.receiverId = chamada.receiverId;
        this.callerId = chamada.callerId;
        this.activeCallId = callId;
        this.chamadaAtiva = chamada;

        // Solicitar áudio/vídeo
        try {
            this.localStream = await this._getUserMedia(chamada.isVideo);
            console.log('🎤 Mídia capturada');
            
            // Iniciar gravação local
            this._iniciarGravacaoLocal(callId);
            
        } catch(e) {
            console.log('⚠️ Sem mídia:', e.message);
        }

        // Atualizar Firebase com PeerID
        await this._request(`/calls/${callId}.json`, 'PATCH', {
            status: 'active',
            receiverPeerId: this.peerId,
            receiverId: chamada.receiverId
        });

        // Emitir evento com URL da chamada
        const urlChamada = this._gerarUrlChamada(callId);
        this.emit('call.joined', {
            callId: callId,
            peerId: this.peerId,
            callerId: chamada.callerId,
            receiverId: chamada.receiverId,
            url: urlChamada,
            timestamp: Date.now()
        });

        console.log(`✅ Chamada ativa! URL: ${urlChamada}`);
        this.isInCall = true;

        return { success: true, callId: callId, url: urlChamada };
    }

    // 3. Sair da chamada
    async sairChamada() {
        if (!this.activeCallId) {
            throw new Error('Não está em uma chamada');
        }

        const callId = this.activeCallId;
        
        // Finalizar gravações
        this._finalizarGravacaoLocal();
        for (const [peerId, _] of this.remoteStreams) {
            this._finalizarGravacaoParticipante(peerId);
        }

        // Fechar conexões
        if (this.currentCall) {
            this.currentCall.close();
            this.currentCall = null;
        }

        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            this.localStream = null;
        }

        this.remoteStreams.clear();

        // Atualizar Firebase
        await this._request(`/calls/${callId}.json`, 'PATCH', {
            status: 'ended'
        });

        const callData = this.chamadaAtiva;
        this.isInCall = false;
        this.activeCallId = null;
        this.chamadaAtiva = null;

        console.log('👋 Chamada encerrada');
        this.emit('call.ended', {
            callId: callId,
            receiverId: this.receiverId,
            timestamp: Date.now()
        });

        return { success: true };
    }

    // 4. Gravação de áudio/vídeo
    _iniciarGravacaoLocal(callId) {
        if (!this.localStream) return;
        
        const timestamp = Date.now();
        const fileName = `local_${this.botId}_${callId}_${timestamp}`;
        const filePath = path.join(this.audioDir, `${fileName}.webm`);
        
        const mediaRecorder = new MediaRecorder(this.localStream, {
            mimeType: 'video/webm;codecs=vp9,opus'
        });
        
        const chunks = [];
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                chunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            const buffer = Buffer.concat(chunks);
            fs.writeFileSync(filePath, buffer);
            
            const url = `http://localhost:${this.audioPort}/${fileName}.webm`;
            this.emit('call.recording.local', {
                callId: callId,
                participantId: this.botId,
                participantName: this.botNome,
                filePath: filePath,
                url: url,
                size: buffer.length,
                duration: Date.now() - timestamp
            });
            
            console.log(`✅ Áudio local salvo: ${url}`);
        };
        
        mediaRecorder.start(1000); // Gravar em chunks de 1s
        this.gravacaoAtiva = {
            callId: callId,
            mediaRecorder: mediaRecorder,
            fileName: fileName,
            filePath: filePath,
            startedAt: timestamp,
            chunks: chunks
        };
        
        this.emit('call.recording.started', {
            callId: callId,
            participantId: this.botId,
            participantName: this.botNome,
            startedAt: timestamp
        });
    }

    _iniciarGravacaoParticipante(peerId, stream) {
        const timestamp = Date.now();
        const fileName = `remote_${peerId}_${this.activeCallId}_${timestamp}`;
        const filePath = path.join(this.audioDir, `${fileName}.webm`);
        
        const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9,opus'
        });
        
        const chunks = [];
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                chunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            const buffer = Buffer.concat(chunks);
            fs.writeFileSync(filePath, buffer);
            
            const url = `http://localhost:${this.audioPort}/${fileName}.webm`;
            this.emit('call.recording.remote', {
                callId: this.activeCallId,
                peerId: peerId,
                filePath: filePath,
                url: url,
                size: buffer.length,
                duration: Date.now() - timestamp
            });
            
            console.log(`✅ Áudio remoto salvo: ${url}`);
        };
        
        mediaRecorder.start(1000);
        this.streamsGravacao.set(peerId, {
            mediaRecorder: mediaRecorder,
            fileName: fileName,
            filePath: filePath,
            startedAt: timestamp,
            chunks: chunks
        });
    }

    _finalizarGravacaoLocal() {
        if (this.gravacaoAtiva && this.gravacaoAtiva.mediaRecorder) {
            this.gravacaoAtiva.mediaRecorder.stop();
            this.gravacaoAtiva = null;
        }
    }

    _finalizarGravacaoParticipante(peerId) {
        if (this.streamsGravacao.has(peerId)) {
            const gravacao = this.streamsGravacao.get(peerId);
            if (gravacao.mediaRecorder) {
                gravacao.mediaRecorder.stop();
            }
            this.streamsGravacao.delete(peerId);
        }
    }

    // 5. Gerar URL da chamada
    _gerarUrlChamada(callId) {
        return `http://localhost:${this.audioPort}/chamada_${callId}.webm`;
    }

    // 6. Obter mídia
    async _getUserMedia(isVideo = false) {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
            return await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: isVideo
            });
        }
        
        console.log('⚠️ Fallback: simulando stream de áudio para Node.js');
        return null;
    }

    // 7. Monitorar chamadas
    async monitorarChamadas(grupoId = null, callback = null) {
        console.log(`🔍 Monitorando chamadas${grupoId ? ` no grupo ${grupoId}` : ''}...`);

        setInterval(async () => {
            try {
                const chamadas = await this.listarChamadas(grupoId);
                
                for (const chamada of chamadas) {
                    // Se chamada está ativa e não estamos nela
                    if (chamada.status === 'active' && chamada.callerPeerId !== this.peerId) {
                        console.log(`📞 Chamada ativa detectada: ${chamada.id}`);
                        
                        const url = this._gerarUrlChamada(chamada.id);
                        this.emit('call.incoming', {
                            callId: chamada.id,
                            callerId: chamada.callerId,
                            receiverId: chamada.receiverId,
                            isVideo: chamada.isVideo,
                            url: url,
                            timestamp: Date.now()
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