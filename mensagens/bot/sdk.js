// sdk.js - SDK COM P2P FUNCIONAL E ENTRADA AUTOMÁTICA
// versão 9.0.0
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
        this.versao = '9.0.0';
        
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
        this.entradaAutomatica = true;
        this.chamadasDetectadas = new Set();
        
        // ========== GRAVAÇÃO ==========
        this.audioDir = path.join(process.cwd(), 'chamadas_audio');
        this.gravacaoAtiva = null;
        this.streamsGravacao = new Map();
        
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
            console.log('✅ PeerJS carregado');
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
        
        this.audioServer.listen(this.audioPort, '0.0.0.0', () => {
            console.log(`🎵 Servidor de áudio: http://localhost:${this.audioPort}`);
        });
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

        const peerId = `bot_${this.botId}_${Date.now()}`;
        this.peer = new this.Peer(peerId, {
            config: {
                'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' }
                ]
            },
            debug: 2
        });

        this.peer.on('open', (id) => {
            this.peerId = id;
            console.log(`✅ PeerJS conectado! ID: ${id}`);
            this.emit('peer.ready', { peerId: id });
            
            // Verificar se tem chamada para entrar
            this._verificarChamadasPendentes();
        });

        this.peer.on('call', (call) => {
            console.log(`📞 Recebendo chamada P2P de: ${call.peer}`);
            this.currentCall = call;
            
            // Atender com stream local
            if (this.localStream) {
                call.answer(this.localStream);
            } else {
                // Se não tiver stream, criar um
                this._getUserMedia(false).then(stream => {
                    this.localStream = stream;
                    call.answer(stream);
                }).catch(() => {
                    call.answer();
                });
            }

            call.on('stream', (remoteStream) => {
                console.log(`🔊 Stream recebido de ${call.peer}`);
                this.remoteStreams.set(call.peer, remoteStream);
                this._iniciarGravacaoParticipante(call.peer, remoteStream);
                
                this.emit('call.audio.stream', {
                    peerId: call.peer,
                    stream: remoteStream,
                    timestamp: Date.now()
                });
                
                this.isInCall = true;
                this.emit('call.connected', {
                    peerId: call.peer,
                    callId: this.activeCallId
                });
            });

            call.on('close', () => {
                console.log(`📞 Chamada encerrada com ${call.peer}`);
                this._finalizarGravacaoParticipante(call.peer);
                this.remoteStreams.delete(call.peer);
                
                if (this.remoteStreams.size === 0) {
                    this.isInCall = false;
                    this.emit('call.disconnected', { callId: this.activeCallId });
                }
            });
        });

        this.peer.on('error', (err) => {
            console.error('❌ Erro PeerJS:', err.type, err.message);
            this.emit('peer.error', { error: err });
        });

        this.peer.on('disconnected', () => {
            console.log('⚠️ PeerJS desconectado, reconectando...');
            this.peer.reconnect();
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

    // ==================== SISTEMA DE CHAMADAS (AUTOMÁTICO) ====================

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
        
        if (grupoId) {
            lista = lista.filter(c => c.receiverId === grupoId);
        }
        
        return lista;
    }

    // 2. Verificar chamadas pendentes automaticamente
    async _verificarChamadasPendentes() {
        if (!this.entradaAutomatica) return;
        if (!this.peerId) return;
        if (this.isInCall) return;
        
        try {
            const chamadas = await this.listarChamadas();
            const chamadasAtivas = chamadas.filter(c => c.status === 'active' || c.status === 'initiated');
            
            for (const chamada of chamadasAtivas) {
                // Se já processamos esta chamada, pular
                if (this.chamadasDetectadas.has(chamada.id)) continue;
                this.chamadasDetectadas.add(chamada.id);
                
                // Não entrar na própria chamada
                if (chamada.callerPeerId === this.peerId) continue;
                
                console.log(`📞 Chamada detectada automaticamente: ${chamada.id}`);
                console.log(`👤 Caller: ${chamada.callerId}`);
                console.log(`📌 Grupo: ${chamada.receiverId}`);
                
                // Emitir evento
                this.emit('call.incoming', {
                    callId: chamada.id,
                    callerId: chamada.callerId,
                    receiverId: chamada.receiverId,
                    isVideo: chamada.isVideo,
                    status: chamada.status,
                    timestamp: Date.now()
                });
                
                // Entrar automaticamente
                if (this.entradaAutomatica && !this.isInCall) {
                    console.log(`🚪 Entrando automaticamente na chamada...`);
                    await this.entrarChamada(chamada.id);
                }
            }
        } catch(e) {
            console.error('Erro ao verificar chamadas:', e.message);
        }
    }

    // 3. Entrar em chamada (agora com P2P funcional)
    async entrarChamada(callId) {
        if (!this.peerId) {
            throw new Error('PeerJS não conectado. Aguarde...');
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
        console.log(`📌 Grupo: ${chamada.receiverId}`);

        this.receiverId = chamada.receiverId;
        this.callerId = chamada.callerId;
        this.activeCallId = callId;
        this.chamadaAtiva = chamada;

        // Obter stream de mídia
        try {
            this.localStream = await this._getUserMedia(chamada.isVideo || false);
            if (this.localStream) {
                console.log('🎤 Mídia capturada');
                this._iniciarGravacaoLocal(callId);
            }
        } catch(e) {
            console.log('⚠️ Sem mídia:', e.message);
        }

        // Atualizar Firebase
        await this._request(`/calls/${callId}.json`, 'PATCH', {
            status: 'active',
            receiverPeerId: this.peerId
        });

        // Conectar ao caller via PeerJS
        if (chamada.callerPeerId) {
            console.log(`🔗 Conectando ao caller: ${chamada.callerPeerId}`);
            
            try {
                const call = this.peer.call(chamada.callerPeerId, this.localStream || null);
                
                call.on('stream', (remoteStream) => {
                    console.log(`🔊 Stream recebido do caller`);
                    this.remoteStreams.set(chamada.callerPeerId, remoteStream);
                    this._iniciarGravacaoParticipante(chamada.callerPeerId, remoteStream);
                    
                    this.emit('call.audio.stream', {
                        peerId: chamada.callerPeerId,
                        stream: remoteStream,
                        timestamp: Date.now()
                    });
                });

                call.on('close', () => {
                    console.log(`📞 Chamada com caller encerrada`);
                    this._finalizarGravacaoParticipante(chamada.callerPeerId);
                    this.remoteStreams.delete(chamada.callerPeerId);
                });

                this.currentCall = call;
                this.isInCall = true;
                
            } catch(e) {
                console.error('❌ Erro ao conectar ao caller:', e.message);
                throw e;
            }
        } else {
            console.log('⚠️ Caller não tem PeerID, aguardando...');
        }

        // Emitir evento
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

    // 4. Sair da chamada
    async sairChamada() {
        if (!this.activeCallId) {
            throw new Error('Não está em uma chamada');
        }

        const callId = this.activeCallId;
        
        this._finalizarGravacaoLocal();
        for (const [peerId, _] of this.remoteStreams) {
            this._finalizarGravacaoParticipante(peerId);
        }

        if (this.currentCall) {
            this.currentCall.close();
            this.currentCall = null;
        }

        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            this.localStream = null;
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

    // 5. Gravação
    _iniciarGravacaoLocal(callId) {
        if (!this.localStream) return;
        
        const timestamp = Date.now();
        const fileName = `local_${this.botId}_${callId}_${timestamp}`;
        const filePath = path.join(this.audioDir, `${fileName}.webm`);
        
        try {
            const mediaRecorder = new MediaRecorder(this.localStream, {
                mimeType: 'video/webm;codecs=vp9,opus'
            });
            
            const chunks = [];
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) chunks.push(event.data);
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
            };
            
            mediaRecorder.start(1000);
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
        } catch(e) {
            console.log('⚠️ Erro ao iniciar gravação local:', e.message);
        }
    }

    _iniciarGravacaoParticipante(peerId, stream) {
        const timestamp = Date.now();
        const fileName = `remote_${peerId}_${this.activeCallId}_${timestamp}`;
        const filePath = path.join(this.audioDir, `${fileName}.webm`);
        
        try {
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp9,opus'
            });
            
            const chunks = [];
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) chunks.push(event.data);
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
            };
            
            mediaRecorder.start(1000);
            this.streamsGravacao.set(peerId, {
                mediaRecorder: mediaRecorder,
                fileName: fileName,
                filePath: filePath,
                startedAt: timestamp,
                chunks: chunks
            });
        } catch(e) {
            console.log('⚠️ Erro ao iniciar gravação remota:', e.message);
        }
    }

    _finalizarGravacaoLocal() {
        if (this.gravacaoAtiva && this.gravacaoAtiva.mediaRecorder) {
            try {
                this.gravacaoAtiva.mediaRecorder.stop();
            } catch(e) {}
            this.gravacaoAtiva = null;
        }
    }

    _finalizarGravacaoParticipante(peerId) {
        if (this.streamsGravacao.has(peerId)) {
            try {
                const gravacao = this.streamsGravacao.get(peerId);
                if (gravacao.mediaRecorder) {
                    gravacao.mediaRecorder.stop();
                }
            } catch(e) {}
            this.streamsGravacao.delete(peerId);
        }
    }

    // 6. Obter mídia
    async _getUserMedia(isVideo = false) {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
            return await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: isVideo
            });
        }
        
        // Fallback para Node.js - criar stream vazia
        console.log('⚠️ Usando fallback de áudio para Node.js');
        return null;
    }

    // 7. Monitorar chamadas (AGORA DETECTA AUTOMATICAMENTE)
    async monitorarChamadas(grupoId = null) {
        console.log(`🔍 Monitorando chamadas${grupoId ? ` no grupo ${grupoId}` : ''}...`);

        setInterval(async () => {
            try {
                const chamadas = await this.listarChamadas(grupoId);
                const chamadasAtivas = chamadas.filter(c => c.status === 'active' || c.status === 'initiated');
                
                for (const chamada of chamadasAtivas) {
                    // Pular se já processada
                    if (this.chamadasDetectadas.has(chamada.id)) continue;
                    
                    // Pular se for do próprio bot
                    if (chamada.callerPeerId === this.peerId) continue;
                    
                    this.chamadasDetectadas.add(chamada.id);
                    
                    console.log(`📞 Chamada detectada: ${chamada.id}`);
                    console.log(`👤 Caller: ${chamada.callerId}`);
                    console.log(`📌 Grupo: ${chamada.receiverId}`);
                    
                    this.emit('call.incoming', {
                        callId: chamada.id,
                        callerId: chamada.callerId,
                        receiverId: chamada.receiverId,
                        isVideo: chamada.isVideo,
                        status: chamada.status,
                        timestamp: Date.now()
                    });
                    
                    // Entrar automaticamente se configurado
                    if (this.entradaAutomatica && !this.isInCall) {
                        console.log(`🚪 Entrando automaticamente...`);
                        try {
                            await this.entrarChamada(chamada.id);
                        } catch(e) {
                            console.error(`❌ Erro ao entrar: ${e.message}`);
                        }
                    }
                }
            } catch(e) {
                // Silencia erros
            }
        }, 3000);
    }

    // ==================== CONFIGURAÇÕES ====================

    setEntradaAutomatica(ativar) {
        this.entradaAutomatica = ativar;
        console.log(`🔘 Entrada automática: ${ativar ? '✅ Ativada' : '❌ Desativada'}`);
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