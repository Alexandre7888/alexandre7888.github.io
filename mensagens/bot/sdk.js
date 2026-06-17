// sdk.js - SDK COMPLETO (APENAS ENTRAR EM CHAMADAS)
// versão 6.0.0
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
        this.versao = '6.0.0';
        
        // Monitoramento
        this.monitorInterval = null;
        this.ultimoTimestamp = {};
        this.processando = {};
        this.monitorandoChamadas = false;
        
        // Chamadas
        this.peer = null;
        this.peerId = null;
        this.localStream = null;
        this.remoteStreams = new Map();
        this.isInCall = false;
        this.currentCallId = null;
        this.currentCallData = null;
        this.participantes = [];
        this.audioDir = path.join(process.cwd(), 'chamadas_audio');
        this.callMonitorInterval = null;
        
        // Criar pasta de áudio
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

        return this;
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

    async entrarGrupo(grupoId) {
        const grupo = await this._request(`/groups/${grupoId}.json`);
        if (!grupo) throw new Error('Grupo não encontrado');

        await this._request(`/groups/${grupoId}/members/${this.botId}.json`, 'PUT', {
            name: this.botNome,
            joined: Date.now(),
            cargos: []
        });

        await this._request(`/users/${this.botId}/chats/${grupoId}.json`, 'PUT', {
            name: grupo.nome || grupoId,
            type: 'group',
            joined: Date.now()
        });

        return { success: true };
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

    // ==================== SISTEMA DE CHAMADAS (APENAS ENTRAR) ====================

    // Verificar se existe chamada ativa
    async getStatusChamada(grupoId) {
        const chamada = await this._request(`/groups/${grupoId}/active_call.json`);
        
        if (!chamada) {
            return { active: false };
        }

        return {
            active: true,
            callId: chamada.id,
            groupId: grupoId,
            startedAt: chamada.startedAt,
            tipo: chamada.tipo || 'audio',
            participants: Object.keys(chamada.participants || {}),
            totalParticipants: Object.keys(chamada.participants || {}).length,
            owner: chamada.owner,
            participantsData: chamada.participants || {},
            isBotInCall: !!(chamada.participants && chamada.participants[this.botId]),
            isBotMuted: !!(chamada.participants && chamada.participants[this.botId] && chamada.participants[this.botId].isMuted)
        };
    }

    // ========== ENTRAR EM CHAMADA EXISTENTE ==========
    
    async entrarChamada(grupoId) {
        // Verificar se PeerJS está disponível
        if (!this.Peer) {
            throw new Error('PeerJS não disponível. Instale: npm install peerjs');
        }

        // Verificar se já está em uma chamada
        if (this.isInCall) {
            throw new Error('Já está em uma chamada');
        }

        // Verificar se existe chamada ativa
        const status = await this.getStatusChamada(grupoId);
        if (!status.active) {
            throw new Error('Nenhuma chamada ativa neste grupo');
        }

        // Verificar se o bot já está na chamada
        if (status.isBotInCall) {
            throw new Error('Bot já está na chamada');
        }

        console.log(`📞 Entrando na chamada do grupo ${grupoId}...`);
        console.log(`👥 Participantes: ${status.totalParticipants}`);

        try {
            // 1. Inicializar PeerJS
            this.peerId = `peer_${this.botId}_${Date.now()}`;
            this.peer = new this.Peer(this.peerId, {
                config: {
                    'iceServers': [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });

            // Aguardar conexão do Peer
            await new Promise((resolve, reject) => {
                this.peer.on('open', resolve);
                this.peer.on('error', reject);
                setTimeout(() => reject(new Error('Timeout ao conectar PeerJS')), 10000);
            });

            console.log(`✅ PeerJS conectado: ${this.peerId}`);

            // 2. Obter stream de áudio local (se disponível)
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: false
                });
                this.localStream = stream;
                console.log('🎤 Microfone capturado');
            } catch(e) {
                console.log('⚠️ Não foi possível capturar áudio:', e.message);
                // Continua sem áudio
            }

            // 3. Adicionar bot aos participantes no Firebase
            const chamada = await this._request(`/groups/${grupoId}/active_call.json`);
            if (!chamada.participants) chamada.participants = {};
            
            chamada.participants[this.botId] = {
                peerId: this.peerId,
                name: this.botNome,
                joinedAt: Date.now(),
                isMuted: false
            };

            await this._request(`/groups/${grupoId}/active_call.json`, 'PUT', chamada);

            this.isInCall = true;
            this.currentCallId = grupoId;
            this.currentCallData = chamada;

            // 4. Escutar chamadas recebidas
            this.peer.on('call', (call) => {
                console.log(`📞 Recebendo chamada de ${call.peer}`);
                
                // Responder com áudio local se disponível
                if (this.localStream) {
                    call.answer(this.localStream);
                } else {
                    call.answer();
                }
                
                call.on('stream', (remoteStream) => {
                    console.log(`🔊 Áudio recebido de ${call.peer}`);
                    this.remoteStreams.set(call.peer, remoteStream);
                    this.emit('call.audio.stream', {
                        peerId: call.peer,
                        stream: remoteStream,
                        timestamp: Date.now()
                    });
                });

                call.on('close', () => {
                    console.log(`📞 Chamada encerrada com ${call.peer}`);
                    this.remoteStreams.delete(call.peer);
                });

                this.calls.set(call.peer, call);
            });

            // 5. Conectar com participantes existentes
            const participantes = Object.entries(chamada.participants || {});
            let conectados = 0;
            
            for (const [userId, data] of participantes) {
                if (userId === this.botId) continue; // Pular a si mesmo
                
                if (data.peerId) {
                    console.log(`🔗 Conectando com ${data.name} (${data.peerId})...`);
                    
                    try {
                        const call = this.peer.call(data.peerId, this.localStream || null);
                        
                        call.on('stream', (remoteStream) => {
                            console.log(`🔊 Áudio recebido de ${data.name}`);
                            this.remoteStreams.set(data.peerId, remoteStream);
                            this.emit('call.audio.stream', {
                                peerId: data.peerId,
                                peerName: data.name,
                                stream: remoteStream,
                                timestamp: Date.now()
                            });
                        });

                        call.on('close', () => {
                            console.log(`📞 Chamada encerrada com ${data.name}`);
                            this.remoteStreams.delete(data.peerId);
                        });

                        this.calls.set(data.peerId, call);
                        conectados++;
                    } catch(e) {
                        console.log(`❌ Falha ao conectar com ${data.name}:`, e.message);
                    }
                }
            }

            // 6. Emitir evento de entrada
            this.emit('call.joined', {
                callId: chamada.id,
                groupId: grupoId,
                participantId: this.botId,
                participantName: this.botNome,
                peerId: this.peerId,
                participants: Object.keys(chamada.participants),
                totalParticipants: Object.keys(chamada.participants).length,
                connectedTo: conectados
            });

            console.log(`✅ Entrou na chamada! Conectado a ${conectados} participantes`);

            return {
                success: true,
                callId: chamada.id,
                peerId: this.peerId,
                participants: Object.keys(chamada.participants),
                totalParticipants: Object.keys(chamada.participants).length,
                connectedTo: conectados
            };

        } catch (error) {
            console.error('❌ Erro ao entrar na chamada:', error);
            
            // Limpar em caso de erro
            if (this.peer) {
                this.peer.destroy();
                this.peer = null;
            }
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
                this.localStream = null;
            }
            this.isInCall = false;
            this.currentCallId = null;
            
            throw error;
        }
    }

    // ========== SAIR DA CHAMADA ==========
    
    async sairChamada() {
        if (!this.isInCall || !this.currentCallId) {
            throw new Error('Não está em uma chamada');
        }

        const grupoId = this.currentCallId;
        console.log(`👋 Saindo da chamada ${grupoId}...`);

        // Remover bot dos participantes
        const chamada = await this._request(`/groups/${grupoId}/active_call.json`);
        if (chamada && chamada.participants) {
            delete chamada.participants[this.botId];
            
            // Se não houver mais participantes, encerrar chamada
            if (Object.keys(chamada.participants).length === 0) {
                await this._request(`/groups/${grupoId}/active_call.json`, 'DELETE');
                console.log('⏹️ Chamada encerrada (último participante)');
            } else {
                await this._request(`/groups/${grupoId}/active_call.json`, 'PUT', chamada);
            }
        }

        // Fechar conexões P2P
        for (const [peerId, call] of this.calls) {
            try {
                call.close();
            } catch(e) {}
        }
        this.calls.clear();
        this.remoteStreams.clear();

        // Fechar PeerJS
        if (this.peer) {
            try {
                this.peer.destroy();
            } catch(e) {}
            this.peer = null;
        }

        // Parar streams locais
        if (this.localStream) {
            try {
                this.localStream.getTracks().forEach(track => track.stop());
            } catch(e) {}
            this.localStream = null;
        }

        this.isInCall = false;
        this.currentCallId = null;
        this.currentCallData = null;
        this.participantes = [];

        this.emit('call.left', {
            groupId: grupoId,
            participantId: this.botId,
            timestamp: Date.now()
        });

        console.log('👋 Saiu da chamada');

        return { success: true };
    }

    // ========== MUTAR/DESMUTAR ==========
    
    async alternarMudo() {
        if (!this.isInCall || !this.currentCallId) {
            throw new Error('Não está em uma chamada');
        }

        if (!this.localStream) {
            throw new Error('Stream de áudio não disponível');
        }

        const audioTrack = this.localStream.getAudioTracks()[0];
        if (!audioTrack) {
            throw new Error('Nenhum track de áudio encontrado');
        }

        audioTrack.enabled = !audioTrack.enabled;
        const isMuted = !audioTrack.enabled;
        
        // Atualizar no Firebase
        const chamada = await this._request(`/groups/${this.currentCallId}/active_call.json`);
        if (chamada && chamada.participants && chamada.participants[this.botId]) {
            chamada.participants[this.botId].isMuted = isMuted;
            await this._request(`/groups/${this.currentCallId}/active_call.json`, 'PUT', chamada);
        }

        this.emit(isMuted ? 'call.muted' : 'call.unmuted', {
            groupId: this.currentCallId,
            participantId: this.botId,
            timestamp: Date.now()
        });

        return { success: true, isMuted: isMuted };
    }

    // ========== MONITORAR CHAMADAS ==========

    async monitorarChamadas(grupoId, callback = null) {
        if (this.callMonitorInterval) {
            clearInterval(this.callMonitorInterval);
        }

        console.log(`🔍 Monitorando chamadas no grupo ${grupoId}...`);

        let ultimoStatus = null;

        this.callMonitorInterval = setInterval(async () => {
            try {
                const status = await this.getStatusChamada(grupoId);
                
                // Chamada foi iniciada
                if (status.active && !ultimoStatus) {
                    console.log(`📞 CHAMADA DETECTADA!`);
                    console.log(`👥 Participantes: ${status.totalParticipants}`);
                    console.log(`👑 Dono: ${status.owner}`);
                    
                    this.emit('call.incoming', {
                        callId: status.callId,
                        groupId: grupoId,
                        owner: status.owner,
                        participants: status.participants,
                        totalParticipants: status.totalParticipants,
                        startedAt: status.startedAt,
                        participantsData: status.participantsData
                    });

                    if (callback) {
                        await callback('incoming', status);
                    }

                    // Entrar automaticamente na chamada (se configurado)
                    if (this.entrarAutomaticamente && !status.isBotInCall) {
                        console.log('🚪 Entrando automaticamente na chamada...');
                        try {
                            await this.entrarChamada(grupoId);
                        } catch(e) {
                            console.log('❌ Erro ao entrar:', e.message);
                        }
                    }
                }
                
                // Chamada terminou
                if (!status.active && ultimoStatus) {
                    console.log(`⏹️ Chamada encerrada`);
                    
                    this.emit('call.ended', {
                        groupId: grupoId,
                        callId: ultimoStatus.callId,
                        duration: Date.now() - ultimoStatus.startedAt
                    });

                    if (callback) {
                        await callback('ended', status);
                    }

                    // Sair da chamada se estiver nela
                    if (this.isInCall) {
                        try {
                            await this.sairChamada();
                        } catch(e) {}
                    }
                }
                
                ultimoStatus = status.active ? status : null;
                
            } catch(e) {
                // Silencia erros
            }
        }, 3000);

        return { parar: () => clearInterval(this.callMonitorInterval) };
    }

    pararMonitoramentoChamadas() {
        if (this.callMonitorInterval) {
            clearInterval(this.callMonitorInterval);
            this.callMonitorInterval = null;
            console.log('🛑 Monitoramento de chamadas parado');
        }
    }

    // ========== CONFIGURAÇÕES ==========

    setEntrarAutomaticamente(ativar) {
        this.entrarAutomaticamente = ativar;
        console.log(`🤖 Entrar automaticamente: ${ativar ? '✅' : '❌'}`);
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
                        // Chamar callback
                        if (callback) {
                            await callback(msg);
                        }

                        // Emitir evento
                        this.emit('mensagem', msg);

                        // Processar comandos
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

                        // Atualizar timestamp
                        if (msg.timestamp > this.ultimoTimestamp[grupoId]) {
                            this.ultimoTimestamp[grupoId] = msg.timestamp;
                        }
                    }
                }
            } catch(e) {
                // Silencia erros
            }

            this.processando[grupoId] = false;
        }, 2000);

        return this.monitorInterval;
    }

    pararMonitoramento() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
            console.log('🛑 Monitoramento de mensagens parado');
        }
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

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = MessageSDK;