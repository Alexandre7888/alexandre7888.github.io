// sdk.js - SDK COMPLETO FUNCIONAL
// versão 5.0.0
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
        this.versao = '5.0.0';
        
        // Monitoramento
        this.monitorInterval = null;
        this.ultimoTimestamp = {};
        this.processando = {};
        
        // Chamadas
        this.peer = null;
        this.peerId = null;
        this.localStream = null;
        this.calls = new Map();
        this.isInCall = false;
        this.currentCallId = null;
        this.audioDir = path.join(process.cwd(), 'chamadas_audio');
        
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

    async criarGrupo(nome, descricao = '') {
        const grupoId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        const grupo = {
            id: grupoId,
            nome: nome,
            descricao: descricao,
            owner: this.botId,
            criado: Date.now(),
            members: { [this.botId]: { name: this.botNome, joined: Date.now(), cargos: [] } },
            messages: {}
        };

        await this._request(`/groups/${grupoId}.json`, 'PUT', grupo);
        await this._request(`/users/${this.botId}/chats/${grupoId}.json`, 'PUT', {
            name: nome,
            type: 'group',
            joined: Date.now()
        });

        return { success: true, grupoId: grupoId };
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

    async sairGrupo(grupoId) {
        await this._request(`/groups/${grupoId}/members/${this.botId}.json`, 'DELETE');
        await this._request(`/users/${this.botId}/chats/${grupoId}.json`, 'DELETE');
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

        if (options.embed) {
            mensagem.embed = options.embed;
            mensagem.type = 'embed';
        }

        if (options.imagem) {
            mensagem.imagem = options.imagem;
            mensagem.type = 'image';
        }

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

    async deletarMensagem(grupoId, mensagemId) {
        await this._request(`/groups/${grupoId}/messages/${mensagemId}.json`, 'DELETE');
        return { success: true };
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

    async adicionarMembro(grupoId, userId, nome = null) {
        const memberData = {
            name: nome || userId,
            joined: Date.now(),
            cargos: []
        };

        await this._request(`/groups/${grupoId}/members/${userId}.json`, 'PUT', memberData);
        return { success: true };
    }

    async removerMembro(grupoId, userId) {
        await this._request(`/groups/${grupoId}/members/${userId}.json`, 'DELETE');
        return { success: true };
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

    async atribuirCargo(grupoId, userId, cargoNome) {
        let cargos = await this._request(`/groups/${grupoId}/cargos.json`);
        if (!cargos || !cargos.cargos_personalizados || !cargos.cargos_personalizados[cargoNome]) {
            throw new Error(`Cargo "${cargoNome}" não encontrado`);
        }

        if (!cargos.cargos_personalizados[cargoNome].membros) {
            cargos.cargos_personalizados[cargoNome].membros = [];
        }

        if (!cargos.cargos_personalizados[cargoNome].membros.includes(userId)) {
            cargos.cargos_personalizados[cargoNome].membros.push(userId);
        }

        await this._request(`/groups/${grupoId}/cargos.json`, 'PUT', cargos);
        return { success: true };
    }

    // ==================== COMANDOS ====================

    registrarComando(nome, callback, descricao = '') {
        this.comandos.set(nome, { callback, descricao });
        console.log(`✅ Comando registrado: ${nome}`);
        return this;
    }

    // ==================== MONITORAMENTO (FUNCIONAL) ====================

    async monitorarGrupo(grupoId, callback = null) {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
        }

        if (!this.ultimoTimestamp[grupoId]) {
            this.ultimoTimestamp[grupoId] = Date.now();
        }

        console.log(`🔍 Monitorando grupo: ${grupoId}`);

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
            console.log('🛑 Monitoramento parado');
        }
    }

    // ==================== SISTEMA DE CHAMADAS ====================

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

    async entrarChamada(grupoId) {
        if (this.isInCall) {
            throw new Error('Já está em uma chamada');
        }

        const status = await this.getStatusChamada(grupoId);
        if (!status.active) {
            throw new Error('Nenhuma chamada ativa neste grupo');
        }

        // Adicionar bot aos participantes
        const chamada = await this._request(`/groups/${grupoId}/active_call.json`);
        if (!chamada.participants) chamada.participants = {};
        
        chamada.participants[this.botId] = {
            name: this.botNome,
            joinedAt: Date.now(),
            isMuted: false
        };

        await this._request(`/groups/${grupoId}/active_call.json`, 'PUT', chamada);

        this.isInCall = true;
        this.currentCallId = grupoId;

        this.emit('call.joined', {
            callId: chamada.id,
            groupId: grupoId,
            participantId: this.botId
        });

        return { success: true, callId: chamada.id };
    }

    async sairChamada() {
        if (!this.isInCall || !this.currentCallId) {
            throw new Error('Não está em uma chamada');
        }

        const grupoId = this.currentCallId;
        const chamada = await this._request(`/groups/${grupoId}/active_call.json`);
        
        if (chamada && chamada.participants) {
            delete chamada.participants[this.botId];
            
            if (Object.keys(chamada.participants).length === 0) {
                await this._request(`/groups/${grupoId}/active_call.json`, 'DELETE');
            } else {
                await this._request(`/groups/${grupoId}/active_call.json`, 'PUT', chamada);
            }
        }

        this.isInCall = false;
        this.currentCallId = null;

        this.emit('call.left', {
            groupId: grupoId,
            participantId: this.botId
        });

        return { success: true };
    }

    async alternarMudo() {
        if (!this.isInCall || !this.currentCallId) {
            throw new Error('Não está em uma chamada');
        }

        const chamada = await this._request(`/groups/${this.currentCallId}/active_call.json`);
        if (chamada && chamada.participants && chamada.participants[this.botId]) {
            chamada.participants[this.botId].isMuted = !chamada.participants[this.botId].isMuted;
            const isMuted = chamada.participants[this.botId].isMuted;
            
            await this._request(`/groups/${this.currentCallId}/active_call.json`, 'PUT', chamada);
            
            this.emit(isMuted ? 'call.muted' : 'call.unmuted', {
                groupId: this.currentCallId,
                participantId: this.botId
            });

            return { success: true, isMuted: isMuted };
        }

        return { success: false, error: 'Participante não encontrado' };
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

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = MessageSDK;