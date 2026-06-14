// sdk.js - SDK COMPLETO com todas as funções
// Hospedar em: https://alexandre7888.github.io/mensagens/bot/sdk.js

const https = require('https');
const { URL } = require('url');

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
        this.cache = new Map();
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
        
        console.log(`🤖 SDK Iniciado - Bot: ${this.botNome}`);
        
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
                    criado: grupo?.criado || null,
                    descricao: grupo?.descricao || ''
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
            totalMembros: grupo?.members ? Object.keys(grupo.members).length : 0,
            criado: grupo?.criado || null,
            cargos: grupo?.roles ? Object.keys(grupo.roles).length : 0,
            canais: grupo?.channels || []
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
            messages: {},
            roles: {
                [`${grupoId}_admin`]: {
                    nome: 'Admin',
                    cor: '#ff0000',
                    permissoes: ['*'],
                    membros: [this.botId]
                }
            },
            channels: [
                { id: `${grupoId}_general`, nome: 'geral', tipo: 'text' }
            ]
        };
        
        for (const membro of membros) {
            grupo.members[membro] = { name: membro, joined: Date.now(), cargos: {} };
        }
        
        await this._request(`/groups/${grupoId}.json`, 'PUT', grupo);
        
        await this._request(`/users/${this.botId}/chats/${grupoId}.json`, 'PUT', {
            name: nome,
            type: 'group',
            joined: Date.now()
        });
        
        return { success: true, grupoId: grupoId, grupo: grupo };
    }

    async entrarGrupo(grupoId) {
        const grupo = await this._request(`/groups/${grupoId}.json`);
        if (!grupo) throw new Error('Grupo não encontrado');
        
        await this._request(`/groups/${grupoId}/members/${this.botId}.json`, 'PUT', {
            name: this.botNome,
            joined: Date.now(),
            cargos: {}
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

    async deletarGrupo(grupoId) {
        const grupo = await this._request(`/groups/${grupoId}.json`);
        if (grupo?.owner !== this.botId) {
            throw new Error('Apenas o dono pode deletar o grupo');
        }
        
        await this._request(`/groups/${grupoId}.json`, 'DELETE');
        await this._request(`/users/${this.botId}/chats/${grupoId}.json`, 'DELETE');
        
        return { success: true };
    }

    async atualizarGrupo(grupoId, dados) {
        const grupo = await this._request(`/groups/${grupoId}.json`);
        const atualizado = { ...grupo, ...dados };
        await this._request(`/groups/${grupoId}.json`, 'PUT', atualizado);
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
            editado: null
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
        
        return { success: true, messageId: msgId, timestamp: timestamp };
    }

    async enviarEmbed(grupoId, embed) {
        return await this.enviarMensagem(grupoId, '', { type: 'embed', embed: embed });
    }

    async enviarImagem(grupoId, imagemUrl, legenda = '') {
        return await this.enviarMensagem(grupoId, legenda, { type: 'image', imagem: imagemUrl });
    }

    async responderMensagem(grupoId, mensagemId, resposta) {
        return await this.enviarMensagem(grupoId, resposta, { replyTo: mensagemId });
    }

    async lerMensagens(grupoId, limite = 50, antes = null, depois = null) {
        let url = `/groups/${grupoId}/messages.json?orderBy="timestamp"&limitToLast=${limite}`;
        if (antes) url += `&endAt=${antes}`;
        if (depois) url += `&startAt=${depois}`;
        
        const mensagens = await this._request(url);
        
        if (!mensagens) return [];
        
        return Object.entries(mensagens)
            .map(([id, msg]) => ({ id, ...msg }))
            .sort((a, b) => a.timestamp - b.timestamp);
    }

    async lerUltimasMensagens(grupoId, limite = 10) {
        return await this.lerMensagens(grupoId, limite);
    }

    async getMensagem(grupoId, mensagemId) {
        return await this._request(`/groups/${grupoId}/messages/${mensagemId}.json`);
    }

    async deletarMensagem(grupoId, mensagemId) {
        await this._request(`/groups/${grupoId}/messages/${mensagemId}.json`, 'DELETE');
        return { success: true };
    }

    async editarMensagem(grupoId, mensagemId, novoTexto) {
        const mensagem = await this._request(`/groups/${grupoId}/messages/${mensagemId}.json`);
        if (!mensagem) throw new Error('Mensagem não encontrada');
        
        if (mensagem.senderId !== this.botId) {
            throw new Error('Você só pode editar suas próprias mensagens');
        }
        
        mensagem.text = novoTexto;
        mensagem.editado = Date.now();
        
        await this._request(`/groups/${grupoId}/messages/${mensagemId}.json`, 'PUT', mensagem);
        return { success: true };
    }

    async apagarTodasMensagens(grupoId) {
        const mensagens = await this.lerMensagens(grupoId, 1000);
        
        for (const msg of mensagens) {
            if (msg.senderId === this.botId) {
                await this.deletarMensagem(grupoId, msg.id);
            }
        }
        
        return { success: true, apagadas: mensagens.filter(m => m.senderId === this.botId).length };
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

    async getMembro(grupoId, userId) {
        return await this._request(`/groups/${grupoId}/members/${userId}.json`);
    }

    async adicionarMembro(grupoId, userId, nome = null) {
        const memberData = {
            name: nome || userId,
            joined: Date.now(),
            cargos: {}
        };
        
        await this._request(`/groups/${grupoId}/members/${userId}.json`, 'PUT', memberData);
        
        const grupo = await this._request(`/groups/${grupoId}.json`);
        await this._request(`/users/${userId}/chats/${grupoId}.json`, 'PUT', {
            name: grupo?.nome || grupoId,
            type: 'group',
            joined: Date.now()
        });
        
        return { success: true };
    }

    async removerMembro(grupoId, userId) {
        const grupo = await this._request(`/groups/${grupoId}.json`);
        
        if (grupo?.owner === userId) {
            throw new Error('Não é possível remover o dono do grupo');
        }
        
        await this._request(`/groups/${grupoId}/members/${userId}.json`, 'DELETE');
        await this._request(`/users/${userId}/chats/${grupoId}.json`, 'DELETE');
        
        return { success: true };
    }

    async banirMembro(grupoId, userId) {
        await this.removerMembro(grupoId, userId);
        await this._request(`/groups/${grupoId}/bans/${userId}.json`, 'PUT', {
            bannedAt: Date.now(),
            bannedBy: this.botId
        });
        
        return { success: true };
    }

    async desbanirMembro(grupoId, userId) {
        await this._request(`/groups/${grupoId}/bans/${userId}.json`, 'DELETE');
        return { success: true };
    }

    async listarBanidos(grupoId) {
        const bans = await this._request(`/groups/${grupoId}/bans.json`);
        if (!bans) return [];
        
        return Object.entries(bans).map(([id, data]) => ({ id, ...data }));
    }

    async transferirDono(grupoId, novoDonoId) {
        const grupo = await this._request(`/groups/${grupoId}.json`);
        
        if (grupo?.owner !== this.botId) {
            throw new Error('Apenas o dono pode transferir o grupo');
        }
        
        grupo.owner = novoDonoId;
        await this._request(`/groups/${grupoId}.json`, 'PUT', grupo);
        
        return { success: true };
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

    async getCargo(grupoId, cargoId) {
        return await this._request(`/groups/${grupoId}/roles/${cargoId}.json`);
    }

    async atribuirCargo(grupoId, userId, cargoId) {
        const cargo = await this._request(`/groups/${grupoId}/roles/${cargoId}.json`);
        if (!cargo) throw new Error('Cargo não encontrado');
        
        await this._request(`/groups/${grupoId}/members/${userId}/cargos/${cargoId}.json`, 'PUT', true);
        
        if (!cargo.membros) cargo.membros = [];
        if (!cargo.membros.includes(userId)) {
            cargo.membros.push(userId);
            await this._request(`/groups/${grupoId}/roles/${cargoId}.json`, 'PUT', cargo);
        }
        
        return { success: true };
    }

    async removerCargo(grupoId, userId, cargoId) {
        await this._request(`/groups/${grupoId}/members/${userId}/cargos/${cargoId}.json`, 'DELETE');
        
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

    async deletarCargo(grupoId, cargoId) {
        await this._request(`/groups/${grupoId}/roles/${cargoId}.json`, 'DELETE');
        return { success: true };
    }

    // ==================== PERMISSÕES ====================
    
    async verificarPermissao(grupoId, userId, permissao) {
        const grupo = await this._request(`/groups/${grupoId}.json`);
        
        // Dono tem todas as permissões
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

    // ==================== CANAIS ====================
    
    async criarCanal(grupoId, nome, tipo = 'text') {
        const canalId = `channel_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        
        const canal = {
            id: canalId,
            nome: nome,
            tipo: tipo,
            criado: Date.now()
        };
        
        const grupo = await this._request(`/groups/${grupoId}.json`);
        if (!grupo.channels) grupo.channels = [];
        grupo.channels.push(canal);
        
        await this._request(`/groups/${grupoId}.json`, 'PUT', grupo);
        
        return { success: true, canalId: canalId, canal: canal };
    }

    async listarCanais(grupoId) {
        const grupo = await this._request(`/groups/${grupoId}.json`);
        return grupo?.channels || [];
    }

    async deletarCanal(grupoId, canalId) {
        const grupo = await this._request(`/groups/${grupoId}.json`);
        grupo.channels = grupo.channels.filter(c => c.id !== canalId);
        await this._request(`/groups/${grupoId}.json`, 'PUT', grupo);
        return { success: true };
    }

    // ==================== USUÁRIOS ====================
    
    async getUsuario(userId) {
        return await this._request(`/users/${userId}.json`);
    }

    async atualizarPerfil(dados) {
        const userData = await this._request(`/users/${this.botId}.json`);
        const novoPerfil = { ...userData, ...dados, atualizado: Date.now() };
        await this._request(`/users/${this.botId}.json`, 'PUT', novoPerfil);
        return { success: true };
    }

    async getStatus(userId) {
        const user = await this._request(`/users/${userId}.json`);
        return user?.status || 'offline';
    }

    async setStatus(status) {
        await this.atualizarPerfil({ status: status });
        return { success: true };
    }

    // ==================== COMANDOS ====================
    
    registrarComando(nome, callback, descricao = '') {
        this.comandos.set(nome, { callback, descricao });
        console.log(`✅ Comando registrado: ${nome} - ${descricao}`);
        return this;
    }

    async removerComando(nome) {
        this.comandos.delete(nome);
        return { success: true };
    }

    listarComandos() {
        return Array.from(this.comandos.keys());
    }

    async executarComando(nome, args, contexto) {
        if (this.comandos.has(nome)) {
            const cmd = this.comandos.get(nome);
            return await cmd.callback(args, contexto);
        }
        return null;
    }

    // ==================== MONITORAMENTO ====================
    
    async iniciarMonitoramento(grupoId, callback = null) {
        if (this.monitores.has(grupoId)) {
            console.log(`⚠️ Monitoramento já ativo para ${grupoId}`);
            return;
        }
        
        let ultimoTimestamp = Date.now();
        let processando = false;
        
        console.log(`🔍 Monitorando grupo: ${grupoId}`);
        
        const interval = setInterval(async () => {
            if (processando) return;
            processando = true;
            
            try {
                const mensagens = await this._request(`/groups/${grupoId}/messages.json`);
                
                if (mensagens) {
                    const msgs = Object.entries(mensagens)
                        .map(([id, msg]) => ({ id, ...msg }))
                        .filter(msg => msg.timestamp > ultimoTimestamp && msg.senderId !== this.botId)
                        .sort((a, b) => a.timestamp - b.timestamp);
                    
                    for (const msg of msgs) {
                        const msgKey = `${grupoId}_${msg.id}`;
                        if (this.ultimosProcessados.has(msgKey)) continue;
                        this.ultimosProcessados.add(msgKey);
                        
                        if (callback) {
                            await callback(msg);
                        }
                        
                        if (msg.text && msg.text.startsWith('!')) {
                            await this._processarComando(grupoId, msg);
                        }
                        
                        this.emit('mensagem', msg);
                        
                        if (msg.timestamp > ultimoTimestamp) {
                            ultimoTimestamp = msg.timestamp;
                        }
                        
                        if (this.ultimosProcessados.size > 500) {
                            const first = this.ultimosProcessados.values().next().value;
                            this.ultimosProcessados.delete(first);
                        }
                    }
                }
            } catch(e) {}
            
            processando = false;
        }, 2000);
        
        this.monitores.set(grupoId, interval);
        return { parar: () => this.pararMonitoramento(grupoId) };
    }

    async _processarComando(grupoId, msg) {
        const text = msg.text;
        if (!text || !text.startsWith('!')) return;
        
        const [nome, ...args] = text.slice(1).split(' ');
        
        if (this.comandos.has(nome)) {
            const cmd = this.comandos.get(nome);
            const contexto = {
                grupoId: grupoId,
                autorId: msg.senderId,
                autorNome: msg.senderName,
                mensagemId: msg.id,
                enviarMsg: (texto) => this.enviarMensagem(grupoId, texto),
                responder: (texto) => this.responderMensagem(grupoId, msg.id, texto)
            };
            
            try {
                await cmd.callback(args, contexto);
                console.log(`🎯 Comando executado: ${nome} por ${msg.senderName}`);
            } catch(error) {
                console.error(`❌ Erro no comando ${nome}:`, error.message);
                await this.enviarMensagem(grupoId, `❌ Erro ao executar ${nome}: ${error.message}`);
            }
        }
    }

    pararMonitoramento(grupoId) {
        if (this.monitores.has(grupoId)) {
            clearInterval(this.monitores.get(grupoId));
            this.monitores.delete(grupoId);
            console.log(`🛑 Monitoramento parado: ${grupoId}`);
        }
    }

    pararTodosMonitoramentos() {
        for (const [grupoId, interval] of this.monitores) {
            clearInterval(interval);
            console.log(`🛑 Monitoramento parado: ${grupoId}`);
        }
        this.monitores.clear();
    }

    // ==================== EVENTOS ====================
    
    on(evento, callback) {
        if (!this.eventos.has(evento)) {
            this.eventos.set(evento, []);
        }
        this.eventos.get(evento).push(callback);
        return this;
    }

    once(evento, callback) {
        const wrapper = (dados) => {
            callback(dados);
            this.off(evento, wrapper);
        };
        this.on(evento, wrapper);
        return this;
    }

    off(evento, callback) {
        if (this.eventos.has(evento)) {
            const callbacks = this.eventos.get(evento);
            const index = callbacks.indexOf(callback);
            if (index !== -1) callbacks.splice(index, 1);
        }
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

    async limparCache() {
        this.cache.clear();
        this.ultimosProcessados.clear();
        return { success: true };
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

    // ==================== BACKUP ====================
    
    async fazerBackup(grupoId) {
        const grupo = await this._request(`/groups/${grupoId}.json`);
        const backup = {
            data: Date.now(),
            grupo: grupo,
            mensagens: await this.lerMensagens(grupoId, 10000)
        };
        
        const backupId = `backup_${Date.now()}`;
        await this._request(`/backups/${backupId}.json`, 'PUT', backup);
        
        return { success: true, backupId: backupId };
    }
}

module.exports = MessageSDK;