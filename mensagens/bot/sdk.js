// sdk.js - SDK COMPLETO para seu sistema
// Salve este arquivo e distribua para seus clientes

const https = require('https');

class MessageSDK {
    constructor() {
        this.FIREBASE_URL = 'https://html-785e3-default-rtdb.firebaseio.com';
        this.botId = null;
        this.botNome = null;
        this.conectado = false;
        this.eventos = new Map();
        this.gruposCache = new Map();
    }

    // ==================== INICIALIZAÇÃO ====================
    
    async iniciar(config) {
        this.botId = config.botId;
        this.botNome = config.botNome || config.botId;
        
        console.log(`🤖 Iniciando SDK - Bot: ${this.botNome}`);
        
        // Verificar se bot existe
        const userData = await this._request(`/users/${this.botId}.json`);
        
        if (!userData) {
            throw new Error(`Bot ${this.botId} não encontrado!`);
        }
        
        this.conectado = true;
        this.emit('ready', { botId: this.botId, nome: this.botNome });
        
        return this;
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
                    membros: grupo?.members ? Object.keys(grupo.members).length : 0
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
            membros: grupo?.members ? Object.keys(grupo.members) : [],
            totalMembros: grupo?.members ? Object.keys(grupo.members).length : 0,
            criado: grupo?.criado || null
        };
    }
    
    // ==================== MENSAGENS ====================
    
    async enviarMensagem(grupoId, texto) {
        if (!this.conectado) throw new Error('SDK não inicializado');
        
        const timestamp = Date.now();
        const msgId = `msg_${timestamp}_${Math.random().toString(36).substr(2, 6)}`;
        
        const mensagem = {
            senderId: this.botId,
            senderName: this.botNome,
            text: texto,
            timestamp: timestamp,
            type: 'text'
        };
        
        await this._request(`/groups/${grupoId}/messages/${msgId}.json`, 'PUT', mensagem);
        
        return { success: true, messageId: msgId, timestamp: timestamp };
    }
    
    async enviarMensagemPersonalizada(grupoId, dados) {
        const timestamp = Date.now();
        const msgId = `msg_${timestamp}_${Math.random().toString(36).substr(2, 6)}`;
        
        const mensagem = {
            senderId: this.botId,
            senderName: this.botNome,
            timestamp: timestamp,
            ...dados
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
        const userChats = await this._request(`/users/${userId}/chats/${grupoId}.json`);
        if (!userChats) {
            await this._request(`/users/${userId}/chats/${grupoId}.json`, 'PUT', {
                name: (await this.getInfoGrupo(grupoId)).nome,
                type: 'group',
                joined: Date.now()
            });
        }
        
        return { success: true };
    }
    
    async removerMembro(grupoId, userId) {
        await this._request(`/groups/${grupoId}/members/${userId}.json`, 'DELETE');
        return { success: true };
    }
    
    // ==================== CARGOS ====================
    
    async criarCargo(grupoId, nome, cor = '#ffffff', permissoes = []) {
        const cargoId = `cargo_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        
        const cargo = {
            id: cargoId,
            nome: nome,
            cor: cor,
            permissoes: permissoes,
            criado: Date.now()
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
        await this._request(`/groups/${grupoId}/members/${userId}/cargos/${cargoId}.json`, 'PUT', true);
        return { success: true };
    }
    
    async removerCargo(grupoId, userId, cargoId) {
        await this._request(`/groups/${grupoId}/members/${userId}/cargos/${cargoId}.json`, 'DELETE');
        return { success: true };
    }
    
    async getCargosUsuario(grupoId, userId) {
        const userData = await this._request(`/groups/${grupoId}/members/${userId}.json`);
        return userData?.cargos || {};
    }
    
    // ==================== PERMISSÕES ====================
    
    async verificarPermissao(grupoId, userId, permissao) {
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
        
        return {
            parar: () => clearInterval(interval)
        };
    }
    
    // ==================== COMANDOS ====================
    
    registrarComando(nome, callback, descricao = '') {
        if (!this.comandos) this.comandos = new Map();
        this.comandos.set(nome, { callback, descricao });
        console.log(`✅ Comando registrado: ${nome}`);
    }
    
    async processarMensagem(grupoId, mensagem) {
        if (mensagem.startsWith('!')) {
            const [comando, ...args] = mensagem.slice(1).split(' ');
            
            if (this.comandos && this.comandos.has(comando)) {
                const cmd = this.comandos.get(comando);
                return await cmd.callback(args, {
                    grupoId: grupoId,
                    enviarMsg: (texto) => this.enviarMensagem(grupoId, texto),
                    bot: this
                });
            }
        }
        return null;
    }
    
    // ==================== EVENTOS ====================
    
    on(evento, callback) {
        if (!this.eventos.has(evento)) {
            this.eventos.set(evento, []);
        }
        this.eventos.get(evento).push(callback);
    }
    
    emit(evento, dados) {
        if (this.eventos.has(evento)) {
            this.eventos.get(evento).forEach(cb => cb(dados));
        }
    }
    
    // ==================== UTILIDADES ====================
    
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    getBotId() {
        return this.botId;
    }
    
    isConectado() {
        return this.conectado;
    }
}

// Exportar SDK
module.exports = MessageSDK;