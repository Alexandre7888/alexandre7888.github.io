// sdk.js - SDK COMPLETO para carregar via URL
// Hospedar em: https://alexandre7888.github.io/mensagens/bot/sdk.js

const https = require('https');
const { URL } = require('url');

class MessageSDK {
    constructor() {
        this.FIREBASE_URL = 'https://html-785e3-default-rtdb.firebaseio.com';
        this.botId = null;
        this.botNome = null;
        this.conectado = false;
        this.eventos = new Map();
        this.comandos = new Map();
        this.monitores = new Map();
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
        
        console.log(`🤖 Iniciando SDK - Bot: ${this.botNome}`);
        
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

    async getGrupo(grupoId) {
        return await this._request(`/groups/${grupoId}.json`);
    }

    async getInfoGrupo(grupoId) {
        const grupo = await this._request(`/groups/${grupoId}.json`);
        return {
            id: grupoId,
            nome: grupo?.nome || grupoId,
            descricao: grupo?.descricao || '',
            dono: grupo?.owner || null,
            membros: grupo?.members ? Object.keys(grupo.members) : [],
            totalMembros: grupo?.members ? Object.keys(grupo.members).length : 0,
            criado: grupo?.criado || null,
            canais: grupo?.channels || [],
            cargos: grupo?.roles ? Object.keys(grupo.roles).length : 0
        };
    }

    async criarGrupo(nome, descricao = '', membros = []) {
        const grupoId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        
        const grupo = {
            id: grupoId,
            nome: nome,
            descricao: descricao,
            owner: this.botId,
            criado: Date.now(),
            members: { [this.botId]: { name: this.botNome, joined: Date.now(), cargos: {} } },
            channels: [
                { id: `${grupoId}_general`, nome: 'geral', tipo: 'text' }
            ],
            roles: {
                [`${grupoId}_admin`]: {
                    nome: 'Admin',
                    cor: '#ff0000',
                    permissoes: ['*'],
                    membros: [this.botId]
                }
            }
        };
        
        // Adicionar membros extras
        for (const membro of membros) {
            grupo.members[membro] = { name: membro, joined: Date.now(), cargos: {} };
        }
        
        await this._request(`/groups/${grupoId}.json`, 'PUT', grupo);
        
        // Adicionar ao chat do bot
        await this._request(`/users/${this.botId}/chats/${grupoId}.json`, 'PUT', {
            name: nome,
            type: 'group',
            joined: Date.now()
        });
        
        return { success: true, grupoId: grupoId, grupo: grupo };
    }

    async entrarGrupo(grupoId) {
        // Verificar se grupo existe
        const grupo = await this._request(`/groups/${grupoId}.json`);
        if (!grupo) throw new Error('Grupo não encontrado');
        
        // Adicionar bot como membro
        await this._request(`/groups/${grupoId}/members/${this.botId}.json`, 'PUT', {
            name: this.botNome,
            joined: Date.now(),
            cargos: {}
        });
        
        // Adicionar ao chat do bot
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
            replyTo: options.replyTo || null,
            embed: options.embed || null
        };
        
        await this._request(`/groups/${grupoId}/messages/${msgId}.json`, 'PUT', mensagem);
        
        return { success: true, messageId: msgId, timestamp: timestamp };
    }

    async enviarEmbed(grupoId, embed) {
        return await this.enviarMensagem(grupoId, '', { type: 'embed', embed: embed });
    }

    async enviarImagem(grupoId, imagemUrl, legenda = '') {
        return await this.enviarMensagem(grupoId, legenda, { type: 'image', imageUrl: imagemUrl });
    }

    async lerMensagens(grupoId, limite = 50, antes = null) {
        let url = `/groups/${grupoId}/messages.json?orderBy="timestamp"&limitToLast=${limite}`;
        if (antes) url += `&endAt=${antes}`;
        
        const mensagens = await this._request(url);
        
        if (!mensagens) return [];
        
        return Object.entries(mensagens)
            .map(([id, msg]) => ({ id, ...msg }))
            .sort((a, b) => a.timestamp - b.timestamp);
    }

    async deletarMensagem(grupoId, mensagemId) {
        await this._request(`/groups/${grupoId}/messages/${mensagemId}.json`, 'DELETE');
        return { success: true };
    }

    async editarMensagem(grupoId, mensagemId, novoTexto) {
        const mensagem = await this._request(`/groups/${grupoId}/messages/${mensagemId}.json`);
        if (!mensagem) throw new Error('Mensagem não encontrada');
        
        mensagem.text = novoTexto;
        mensagem.editado = Date.now();
        
        await this._request(`/groups/${grupoId}/messages/${mensagemId}.json`, 'PUT', mensagem);
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
                cargos: userData.cargos || {}
            });
        }
        
        return membros;
    }

    async adicionarMembro(grupoId, userId, nome = null) {
        const memberData = {
            name: nome || userId,
            joined: Date.now(),
            cargos: {}
        };
        
        await this._request(`/groups/${grupoId}/members/${userId}.json`, 'PUT', memberData);
        
        // Adicionar ao chat do usuário
        const grupo = await this._request(`/groups/${grupoId}.json`);
        await this._request(`/users/${userId}/chats/${grupoId}.json`, 'PUT', {
            name: grupo?.nome || grupoId,
            type: 'group',
            joined: Date.now()
        });
        
        return { success: true };
    }

    async removerMembro(grupoId, userId) {
        await this._request(`/groups/${grupoId}/members/${userId}.json`, 'DELETE');
        await this._request(`/users/${userId}/chats/${grupoId}.json`, 'DELETE');
        return { success: true };
    }

    async getMembro(grupoId, userId) {
        return await this._request(`/groups/${grupoId}/members/${userId}.json`);
    }

    // ==================== CARGOS ====================
    
    async criarCargo(grupoId, nome, cor = '#ffffff', permissoes = []) {
        const cargoId = `role_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        
        const cargo = {
            id: cargoId,
            nome: nome,
            cor: cor,
            permissoes: permissoes,
            criado: Date.now(),
            membros: []
        };
        
        await this._request(`/groups/${grupoId}/roles/${cargoId}.json`, 'PUT', cargo);
        
        return { success: true, cargoId: cargoId, cargo: cargo };
    }

    async listarCargos(grupoId) {
        const cargos = await this._request(`/groups/${grupoId}/roles.json`);
        
        if (!cargos) return [];
        
        return Object.entries(cargos).map(([id, cargo]) => ({
            id: id,
            ...cargo
        }));
    }

    async atribuirCargo(grupoId, userId, cargoId) {
        // Verificar se cargo existe
        const cargo = await this._request(`/groups/${grupoId}/roles/${cargoId}.json`);
        if (!cargo) throw new Error('Cargo não encontrado');
        
        await this._request(`/groups/${grupoId}/members/${userId}/cargos/${cargoId}.json`, 'PUT', true);
        
        // Adicionar ao array de membros do cargo
        if (!cargo.membros) cargo.membros = [];
        if (!cargo.membros.includes(userId)) {
            cargo.membros.push(userId);
            await this._request(`/groups/${grupoId}/roles/${cargoId}.json`, 'PUT', cargo);
        }
        
        return { success: true };
    }

    async removerCargo(grupoId, userId, cargoId) {
        await this._request(`/groups/${grupoId}/members/${userId}/cargos/${cargoId}.json`, 'DELETE');
        
        // Remover do array de membros do cargo
        const cargo = await this._request(`/groups/${grupoId}/roles/${cargoId}.json`);
        if (cargo && cargo.membros) {
            cargo.membros = cargo.membros.filter(id => id !== userId);
            await this._request(`/groups/${grupoId}/roles/${cargoId}.json`, 'PUT', cargo);
        }
        
        return { success: true };
    }

    async getCargosUsuario(grupoId, userId) {
        const userData = await this._request(`/groups/${grupoId}/members/${userId}.json`);
        return userData?.cargos || {};
    }

    // ==================== PERMISSÕES ====================
    
    async verificarPermissao(grupoId, userId, permissao) {
        // Verificar se é dono do grupo
        const grupo = await this._request(`/groups/${grupoId}.json`);
        if (grupo?.owner === userId) return true;
        
        const cargos = await this.getCargosUsuario(grupoId, userId);
        const listaCargos = await this.listarCargos(grupoId);
        
        for (const [cargoId, temCargo] of Object.entries(cargos)) {
            if (temCargo) {
                const cargo = listaCargos.find(c => c.id === cargoId);
                if (cargo && (cargo.permissoes.includes('*') || cargo.permissoes.includes(permissao))) {
                    return true;
                }
            }
        }
        
        return false;
    }

    // ==================== MONITORAMENTO ====================
    
    monitorarGrupo(grupoId, callback, intervalo = 3000) {
        let ultimoTimestamp = Date.now();
        
        const interval = setInterval(async () => {
            try {
                const mensagens = await this._request(`/groups/${grupoId}/messages.json?orderBy="timestamp"&startAfter=${ultimoTimestamp}`);
                
                if (mensagens) {
                    const msgs = Object.values(mensagens);
                    for (const msg of msgs) {
                        if (msg.senderId !== this.botId && msg.timestamp > ultimoTimestamp) {
                            callback(msg);
                            if (msg.timestamp > ultimoTimestamp) {
                                ultimoTimestamp = msg.timestamp;
                            }
                        }
                    }
                }
            } catch(e) {}
        }, intervalo);
        
        const monitorId = `monitor_${grupoId}`;
        this.monitores.set(monitorId, interval);
        
        return {
            parar: () => {
                clearInterval(interval);
                this.monitores.delete(monitorId);
            }
        };
    }

    pararMonitoramento(grupoId) {
        const monitorId = `monitor_${grupoId}`;
        if (this.monitores.has(monitorId)) {
            clearInterval(this.monitores.get(monitorId));
            this.monitores.delete(monitorId);
        }
    }

    // ==================== COMANDOS ====================
    
    registrarComando(nome, callback, descricao = '') {
        this.comandos.set(nome, { callback, descricao });
        console.log(`✅ Comando registrado: ${nome} - ${descricao}`);
        return this;
    }

    async executarComando(nome, args, contexto) {
        if (this.comandos.has(nome)) {
            const cmd = this.comandos.get(nome);
            return await cmd.callback(args, contexto);
        }
        return null;
    }

    async processarMensagem(grupoId, mensagem) {
        if (mensagem.startsWith('!')) {
            const [comando, ...args] = mensagem.slice(1).split(' ');
            
            return await this.executarComando(comando, args, {
                grupoId: grupoId,
                enviarMsg: (texto) => this.enviarMensagem(grupoId, texto),
                bot: this,
                autor: mensagem.senderId
            });
        }
        return null;
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
            this.eventos.get(evento).forEach(cb => cb(dados));
        }
    }

    // ==================== USUÁRIOS ====================
    
    async getUsuario(userId) {
        return await this._request(`/users/${userId}.json`);
    }

    async atualizarPerfil(dados) {
        const userData = await this._request(`/users/${this.botId}.json`);
        const novoPerfil = { ...userData, ...dados };
        await this._request(`/users/${this.botId}.json`, 'PUT', novoPerfil);
        return { success: true };
    }

    // ==================== UTILIDADES ====================
    
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getBotId() {
        return this.botId;
    }

    getBotNome() {
        return this.botNome;
    }

    isConectado() {
        return this.conectado;
    }

    log(mensagem, tipo = 'info') {
        const cores = {
            info: '\x1b[36m',
            success: '\x1b[32m',
            error: '\x1b[31m',
            warn: '\x1b[33m'
        };
        console.log(`${cores[tipo]}[SDK] ${mensagem}\x1b[0m`);
    }
}

// Exportar SDK
module.exports = MessageSDK;