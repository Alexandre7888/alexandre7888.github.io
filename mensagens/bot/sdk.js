// sdk.js - SDK COMPLETO (APENAS ENTRAR EM CHAMADAS)
// versão 4.0.0
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
        this.monitores = new Map();
        this.ultimosProcessados = new Set();
        this.versao = '4.0.0';
        
        // ========== SISTEMA DE CHAMADAS P2P ==========
        this.peer = null;
        this.peerId = null;
        this.localStream = null;
        this.calls = new Map();
        this.isInCall = false;
        this.currentCallId = null;
        this.audioStreams = [];
        
        // ========== GRAVAÇÃO ==========
        this.audioDir = path.join(process.cwd(), 'chamadas_audio');
        this.recording = null;
        this.audioChunks = [];
        this.participantAudio = new Map();
        
        // Criar pasta de áudio
        if (!fs.existsSync(this.audioDir)) {
            fs.mkdirSync(this.audioDir, { recursive: true });
        }
        
        // ========== PEERJS (carregar dinamicamente) ==========
        this.Peer = null;
        this._loadPeerJS();
    }

    getVersao() {
        return this.versao;
    }

    // ==================== CARREGAR PEERJS ====================
    
    async _loadPeerJS() {
        try {
            this.Peer = require('peerjs');
            console.log('✅ PeerJS carregado com sucesso');
        } catch(e) {
            console.log('⚠️ PeerJS não encontrado. Instale: npm install peerjs');
            console.log('💡 O SDK funcionará apenas para gerenciamento de chamadas sem áudio');
        }
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
        const chamada = await this.getStatusChamada(grupoId);

        return {
            id: grupoId,
            nome: grupo?.nome || grupoId,
            descricao: grupo?.descricao || '',
            dono: grupo?.owner || null,
            totalMembros: grupo?.members ? Object.keys(grupo.members).length : 0,
            criado: grupo?.criado || null,
            chamadaAtiva: chamada.active,
            participantesChamada: chamada.active ? chamada.totalParticipants : 0
        };
    }

    // ==================== SISTEMA DE CHAMADAS P2P ====================

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

        console.log(`📞 Entrando na chamada do grupo ${grupoId}...`);

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

            // 2. Obter stream de áudio local
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
            });
            this.localStream = stream;

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

            // 4. Escutar chamadas recebidas
            this.peer.on('call', (call) => {
                console.log(`📞 Recebendo chamada de ${call.peer}`);
                call.answer(this.localStream);
                
                call.on('stream', (remoteStream) => {
                    console.log(`🔊 Áudio recebido de ${call.peer}`);
                    this._addAudioStream(call.peer, remoteStream);
                });

                this.calls.set(call.peer, call);
            });

            // 5. Conectar com participantes existentes
            const participantes = Object.entries(chamada.participants || {});
            for (const [userId, data] of participantes) {
                if (userId === this.botId) continue; // Pular a si mesmo
                
                console.log(`🔗 Conectando com ${data.name} (${data.peerId})...`);
                
                const call = this.peer.call(data.peerId, this.localStream);
                
                call.on('stream', (remoteStream) => {
                    console.log(`🔊 Áudio recebido de ${data.name}`);
                    this._addAudioStream(data.peerId, remoteStream);
                });

                this.calls.set(data.peerId, call);
            }

            // 6. Emitir evento de entrada
            this.emit('call.joined', {
                callId: chamada.id,
                groupId: grupoId,
                participantId: this.botId,
                participantName: this.botNome,
                peerId: this.peerId,
                participants: Object.keys(chamada.participants)
            });

            // 7. Iniciar gravação
            this._iniciarGravacao(grupoId, chamada.id);

            console.log(`✅ Entrou na chamada! Peer ID: ${this.peerId}`);
            console.log(`👥 Participantes: ${Object.keys(chamada.participants).length}`);

            return {
                success: true,
                callId: chamada.id,
                peerId: this.peerId,
                participants: Object.keys(chamada.participants)
            };

        } catch (error) {
            console.error('❌ Erro ao entrar na chamada:', error);
            throw error;
        }
    }

    // ========== ADICIONAR STREAM DE ÁUDIO ==========
    
    _addAudioStream(peerId, stream) {
        this.participantAudio.set(peerId, {
            stream: stream,
            startedAt: Date.now(),
            chunks: []
        });

        // Salvar áudio do participante
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const destination = audioContext.createMediaStreamDestination();
        source.connect(destination);

        const mediaRecorder = new MediaRecorder(destination.stream);
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                const participantData = this.participantAudio.get(peerId);
                if (participantData) {
                    participantData.chunks.push(event.data);
                }
            }
        };
        mediaRecorder.start();

        this.participantAudio.get(peerId).recorder = mediaRecorder;

        // Emitir evento
        this.emit('call.audio.stream', {
            peerId: peerId,
            stream: stream,
            timestamp: Date.now()
        });
    }

    // ========== GRAVAÇÃO DA CHAMADA ==========
    
    async _iniciarGravacao(grupoId, callId) {
        const timestamp = Date.now();
        const fileName = `chamada_${grupoId}_${callId}_${timestamp}`;
        const filePath = path.join(this.audioDir, `${fileName}.wav`);

        this.recording = {
            callId: callId,
            grupoId: grupoId,
            fileName: fileName,
            filePath: filePath,
            startedAt: timestamp,
            chunks: []
        };

        console.log(`🎙️ Gravação iniciada: ${fileName}`);

        // Emitir evento
        this.emit('call.recording.started', {
            callId: callId,
            groupId: grupoId,
            fileName: fileName,
            startedAt: timestamp
        });

        return this.recording;
    }

    async _finalizarGravacao() {
        if (!this.recording) return;

        // Parar gravações dos participantes
        for (const [peerId, data] of this.participantAudio) {
            if (data.recorder && data.recorder.state !== 'inactive') {
                data.recorder.stop();
            }
        }

        // Salvar áudio do participante
        for (const [peerId, data] of this.participantAudio) {
            if (data.chunks.length > 0) {
                const blob = new Blob(data.chunks, { type: 'audio/webm' });
                const buffer = await blob.arrayBuffer();
                const participantFile = path.join(
                    this.audioDir,
                    `participante_${peerId}_${this.recording.fileName}.webm`
                );
                fs.writeFileSync(participantFile, Buffer.from(buffer));
                
                this.emit('call.recording.participant', {
                    callId: this.recording.callId,
                    peerId: peerId,
                    filePath: participantFile,
                    url: `http://localhost:3001/${path.basename(participantFile)}`,
                    size: buffer.byteLength
                });
            }
        }

        // Salvar áudio completo (mixado)
        // Nota: Para mixar áudio corretamente, seria necessário usar ffmpeg
        // Esta é uma versão simplificada que salva o áudio local

        const recording = this.recording;
        this.recording = null;
        this.participantAudio.clear();

        // Emitir evento
        this.emit('call.recording.finished', {
            callId: recording.callId,
            groupId: recording.grupoId,
            fileName: recording.fileName,
            filePath: recording.filePath,
            url: `http://localhost:3001/${path.basename(recording.filePath)}`,
            duration: Date.now() - recording.startedAt
        });

        console.log(`✅ Gravação finalizada: ${recording.fileName}`);
    }

    // ========== SAIR DA CHAMADA ==========
    
    async sairChamada() {
        if (!this.isInCall || !this.currentCallId) {
            throw new Error('Não está em uma chamada');
        }

        const grupoId = this.currentCallId;

        // Remover bot dos participantes
        const chamada = await this._request(`/groups/${grupoId}/active_call.json`);
        if (chamada && chamada.participants) {
            delete chamada.participants[this.botId];
            
            // Se não houver mais participantes, encerrar chamada
            if (Object.keys(chamada.participants).length === 0) {
                await this._request(`/groups/${grupoId}/active_call.json`, 'DELETE');
            } else {
                await this._request(`/groups/${grupoId}/active_call.json`, 'PUT', chamada);
            }
        }

        // Finalizar gravação
        await this._finalizarGravacao();

        // Fechar conexões P2P
        for (const [peerId, call] of this.calls) {
            call.close();
        }
        this.calls.clear();

        // Fechar PeerJS
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }

        // Parar streams locais
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        this.isInCall = false;
        this.currentCallId = null;
        this.peerId = null;

        this.emit('call.left', {
            groupId: grupoId,
            participantId: this.botId
        });

        console.log('👋 Saiu da chamada');

        return { success: true };
    }

    // ========== MUTAR/DESMUTAR ==========
    
    async alternarMudo() {
        if (!this.isInCall || !this.localStream) {
            throw new Error('Não está em uma chamada');
        }

        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
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
                participantId: this.botId
            });

            return { success: true, isMuted: isMuted };
        }

        return { success: false, error: 'Nenhum track de áudio encontrado' };
    }

    // ========== MONITORAMENTO DE CHAMADAS ==========

    async iniciarMonitoramentoChamadas(grupoId, callback = null) {
        let ultimoStatus = null;

        const interval = setInterval(async () => {
            try {
                const status = await this.getStatusChamada(grupoId);
                
                if (status.active && !ultimoStatus) {
                    // Chamada iniciou
                    this.emit('call.incoming', {
                        callId: status.callId,
                        groupId: grupoId,
                        owner: status.owner,
                        participants: status.participants,
                        startedAt: status.startedAt
                    });
                    if (callback) callback('incoming', status);
                }
                
                if (!status.active && ultimoStatus) {
                    // Chamada terminou
                    this.emit('call.ended', {
                        groupId: grupoId,
                        callId: ultimoStatus.callId
                    });
                    if (callback) callback('ended', status);
                }
                
                ultimoStatus = status.active ? status : null;
                
            } catch(e) {}
        }, 3000);

        return { parar: () => clearInterval(interval) };
    }

    // ========== COMANDOS ==========

    registrarComando(nome, callback, descricao = '') {
        this.comandos.set(nome, { callback, descricao });
        console.log(`✅ Comando registrado: ${nome}`);
        return this;
    }

    // ========== EVENTOS ==========

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

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = MessageSDK;