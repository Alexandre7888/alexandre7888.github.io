#!/bin/bash

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════════════════════════════${NC}"
echo -e "${MAGENTA}                    🤖 DEV BOT SDK v1.0 🤖${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}         Sistema completo para desenvolvimento de bots${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════════${NC}"
echo ""

# Verifica Node.js
check_node() {
    if ! command -v node &> /dev/null; then
        echo -e "${YELLOW}📦 Node.js não encontrado. Instalando...${NC}"
        
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt-get install -y nodejs -y
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            brew install node
        else
            echo -e "${RED}❌ Baixe e instale o Node.js: https://nodejs.org${NC}"
            exit 1
        fi
    fi
    
    echo -e "${GREEN}✅ Node.js: $(node --version)${NC}"
}

# Cria diretórios
create_dirs() {
    echo -e "${CYAN}📁 Criando diretórios...${NC}"
    mkdir -p components
    mkdir -p data
    mkdir -p logs
    echo -e "${GREEN}✅ Diretórios criados${NC}"
}

# Cria bot.js completo
create_bot_js() {
    echo -e "${CYAN}📝 Criando bot.js...${NC}"
    
    cat > bot.js << 'EOF'
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const readline = require('readline');
const { spawn } = require('child_process');

const CONFIG = {
    firebaseUrl: 'https://html-785e3-default-rtdb.firebaseio.com',
    dataFile: path.join(__dirname, 'data', 'bot_data.json'),
    componentsDir: path.join(__dirname, 'components'),
    activeComponentsFile: path.join(__dirname, 'data', 'active_components.json'),
    logsFile: path.join(__dirname, 'logs', 'bot.log')
};

let botConfig = null;
let serverProcess = null;
let isServerRunning = false;

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${type}] ${message}\n`;
    fs.appendFileSync(CONFIG.logsFile, logLine);
}

function clearScreen() {
    console.clear();
}

function showHeader() {
    console.log(`${colors.blue}════════════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.magenta}${colors.bright}                    🤖 DEV BOT SDK - INTERACTIVE MODE 🤖${colors.reset}`);
    console.log(`${colors.blue}════════════════════════════════════════════════════════════════════${colors.reset}`);
    console.log();
}

function httpsRequest(url, method = 'GET', data = null) {
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
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve(body ? JSON.parse(body) : null);
                } catch (e) {
                    resolve(body);
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function authBot() {
    clearScreen();
    showHeader();
    
    console.log(`${colors.cyan}┌─────────────────────────────────────────────────────────────────┐${colors.reset}`);
    console.log(`${colors.cyan}│                         AUTENTICAÇÃO DO BOT                     │${colors.reset}`);
    console.log(`${colors.cyan}└─────────────────────────────────────────────────────────────────┘${colors.reset}`);
    console.log();
    
    return new Promise((resolve) => {
        rl.question(`${colors.yellow}📝 Digite o ID do Bot: ${colors.reset}`, async (botId) => {
            if (!botId) {
                console.log(`${colors.red}❌ ID não fornecido!${colors.reset}`);
                setTimeout(() => resolve(false), 2000);
                return;
            }
            
            console.log(`${colors.cyan}🔄 Autenticando...${colors.reset}`);
            
            try {
                const userData = await httpsRequest(`${CONFIG.firebaseUrl}/users/${botId}.json`);
                
                if (!userData) {
                    console.log(`${colors.red}❌ Bot não encontrado! Verifique o ID.${colors.reset}`);
                    setTimeout(() => resolve(false), 2000);
                    return;
                }
                
                botConfig = {
                    botId: botId,
                    userData: userData,
                    chats: userData.chats || {},
                    communities: userData.communities || {},
                    lastChecked: {}
                };
                
                fs.writeFileSync(CONFIG.dataFile, JSON.stringify(botConfig, null, 2));
                
                console.log(`${colors.green}✅ Bot autenticado com sucesso!${colors.reset}`);
                console.log(`${colors.green}📛 Nome: ${userData.name || botId}${colors.reset}`);
                console.log(`${colors.green}💬 Chats disponíveis: ${Object.keys(botConfig.chats).length}${colors.reset}`);
                console.log(`${colors.green}👥 Comunidades: ${Object.keys(botConfig.communities || {}).length}${colors.reset}`);
                
                log(`Bot autenticado: ${botId}`, 'AUTH');
                setTimeout(() => resolve(true), 2000);
            } catch (error) {
                console.log(`${colors.red}❌ Erro: ${error.message}${colors.reset}`);
                setTimeout(() => resolve(false), 2000);
            }
        });
    });
}

function listActiveComponents() {
    try {
        if (fs.existsSync(CONFIG.activeComponentsFile)) {
            const data = JSON.parse(fs.readFileSync(CONFIG.activeComponentsFile, 'utf8'));
            return data.components || [];
        }
    } catch (error) {}
    return [];
}

function saveActiveComponent(componentName) {
    let active = { components: [] };
    try {
        if (fs.existsSync(CONFIG.activeComponentsFile)) {
            active = JSON.parse(fs.readFileSync(CONFIG.activeComponentsFile, 'utf8'));
        }
    } catch (error) {}
    
    if (!active.components.includes(componentName)) {
        active.components.push(componentName);
        fs.writeFileSync(CONFIG.activeComponentsFile, JSON.stringify(active, null, 2));
        log(`Componente ativado: ${componentName}`, 'COMPONENT');
    }
}

function removeActiveComponent(componentName) {
    try {
        if (fs.existsSync(CONFIG.activeComponentsFile)) {
            let active = JSON.parse(fs.readFileSync(CONFIG.activeComponentsFile, 'utf8'));
            active.components = active.components.filter(c => c !== componentName);
            fs.writeFileSync(CONFIG.activeComponentsFile, JSON.stringify(active, null, 2));
            log(`Componente desativado: ${componentName}`, 'COMPONENT');
        }
    } catch (error) {}
}

async function listComponents() {
    clearScreen();
    showHeader();
    
    console.log(`${colors.cyan}┌─────────────────────────────────────────────────────────────────┐${colors.reset}`);
    console.log(`${colors.cyan}│                       COMPONENTES DISPONÍVEIS                    │${colors.reset}`);
    console.log(`${colors.cyan}└─────────────────────────────────────────────────────────────────┘${colors.reset}`);
    console.log();
    
    if (!fs.existsSync(CONFIG.componentsDir)) {
        fs.mkdirSync(CONFIG.componentsDir, { recursive: true });
    }
    
    const files = fs.readdirSync(CONFIG.componentsDir).filter(f => f.endsWith('.js'));
    const activeComponents = listActiveComponents();
    
    if (files.length === 0) {
        console.log(`${colors.yellow}⚠️  Nenhum componente encontrado${colors.reset}`);
        console.log(`${colors.cyan}💡 Use a opção "Criar/Editar Componente" para criar um${colors.reset}`);
    } else {
        files.forEach((file, index) => {
            const isActive = activeComponents.includes(file);
            const status = isActive ? `${colors.green}[● ATIVO]${colors.reset}` : `${colors.red}[○ INATIVO]${colors.reset}`;
            console.log(`${colors.cyan}${index + 1}.${colors.reset} ${colors.bright}${file}${colors.reset} ${status}`);
        });
    }
    
    console.log();
    console.log(`${colors.yellow}─────────────────────────────────────────────────────────────────${colors.reset}`);
    console.log(`${colors.cyan}1.${colors.reset} Ativar componente`);
    console.log(`${colors.cyan}2.${colors.reset} Desativar componente`);
    console.log(`${colors.cyan}3.${colors.reset} Voltar ao menu principal`);
    console.log();
    
    return new Promise((resolve) => {
        rl.question(`${colors.yellow}👉 Escolha uma opção: ${colors.reset}`, async (option) => {
            if (option === '1') {
                console.log();
                rl.question(`${colors.yellow}📝 Nome do componente (ex: meu_componente.js): ${colors.reset}`, (compName) => {
                    if (compName && files.includes(compName)) {
                        saveActiveComponent(compName);
                        console.log(`${colors.green}✅ Componente ativado com sucesso!${colors.reset}`);
                        log(`Componente ativado via menu: ${compName}`, 'ACTION');
                    } else {
                        console.log(`${colors.red}❌ Componente não encontrado!${colors.reset}`);
                    }
                    setTimeout(() => resolve(), 1500);
                });
            } else if (option === '2') {
                console.log();
                rl.question(`${colors.yellow}📝 Nome do componente: ${colors.reset}`, (compName) => {
                    if (compName) {
                        removeActiveComponent(compName);
                        console.log(`${colors.green}✅ Componente desativado com sucesso!${colors.reset}`);
                        log(`Componente desativado via menu: ${compName}`, 'ACTION');
                    } else {
                        console.log(`${colors.red}❌ Nome inválido!${colors.reset}`);
                    }
                    setTimeout(() => resolve(), 1500);
                });
            } else {
                resolve();
            }
        });
    });
}

function editComponent() {
    clearScreen();
    showHeader();
    
    console.log(`${colors.cyan}┌─────────────────────────────────────────────────────────────────┐${colors.reset}`);
    console.log(`${colors.cyan}│                     CRIAR/EDITAR COMPONENTE                      │${colors.reset}`);
    console.log(`${colors.cyan}└─────────────────────────────────────────────────────────────────┘${colors.reset}`);
    console.log();
    console.log(`${colors.yellow}📝 Template do componente:${colors.reset}`);
    console.log(`${colors.green}╔═══════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.green}║ module.exports = {                                             ║${colors.reset}`);
    console.log(`${colors.green}║   name: "Meu Componente",                                      ║${colors.reset}`);
    console.log(`${colors.green}║   version: "1.0.0",                                           ║${colors.reset}`);
    console.log(`${colors.green}║   description: "Descrição do que seu componente faz",         ║${colors.reset}`);
    console.log(`${colors.green}║                                                                ║${colors.reset}`);
    console.log(`${colors.green}║   onMessage: async (message, sendMessage, sendMedia) => {     ║${colors.reset}`);
    console.log(`${colors.green}║     // message = { text, senderId, senderName, timestamp }    ║${colors.reset}`);
    console.log(`${colors.green}║     // sendMessage(text) - envia mensagem de texto             ║${colors.reset}`);
    console.log(`${colors.green}║     // sendMedia(type, data) - envia audio/imagem/video       ║${colors.reset}`);
    console.log(`${colors.green}║                                                                ║${colors.reset}`);
    console.log(`${colors.green}║     if (message.text?.toLowerCase() === "oi") {                ║${colors.reset}`);
    console.log(`${colors.green}║       await sendMessage(\`Olá \${message.senderName}!\`);        ║${colors.reset}`);
    console.log(`${colors.green}║     }                                                          ║${colors.reset}`);
    console.log(`${colors.green}║   },                                                           ║${colors.reset});
    console.log(`${colors.green}║                                                                ║${colors.reset}`);
    console.log(`${colors.green}║   onStart: async (sendMessage, sendMedia) => {                 ║${colors.reset}`);
    console.log(`${colors.green}║     console.log("✅ Componente iniciado!");                    ║${colors.reset}`);
    console.log(`${colors.green}║   }                                                            ║${colors.reset}`);
    console.log(`${colors.green}║ };                                                             ║${colors.reset}`);
    console.log(`${colors.green}╚═══════════════════════════════════════════════════════════════╝${colors.reset}`);
    console.log();
    
    rl.question(`${colors.yellow}📝 Nome do arquivo (ex: saudacao.js): ${colors.reset}`, (filename) => {
        if (!filename.endsWith('.js')) filename += '.js';
        
        const filepath = path.join(CONFIG.componentsDir, filename);
        let existingContent = '';
        
        if (fs.existsSync(filepath)) {
            existingContent = fs.readFileSync(filepath, 'utf8');
            console.log(`${colors.yellow}⚠️  Componente existente encontrado! Editando...${colors.reset}`);
        }
        
        console.log();
        console.log(`${colors.cyan}📝 Digite o código do componente (digite 'SAIR' em uma linha vazia para finalizar):${colors.reset}`);
        console.log(`${colors.yellow}─────────────────────────────────────────────────────────────────${colors.reset}`);
        
        let codeLines = [];
        
        const inputRl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const promptCode = () => {
            inputRl.question('', (line) => {
                if (line.trim() === 'SAIR') {
                    const code = codeLines.join('\n');
                    
                    if (code.trim()) {
                        fs.writeFileSync(filepath, code);
                        console.log(`${colors.green}✅ Componente salvo com sucesso: ${filename}${colors.reset}`);
                        log(`Componente criado/editado: ${filename}`, 'COMPONENT');
                    } else {
                        console.log(`${colors.red}❌ Código vazio, componente não salvo!${colors.reset}`);
                    }
                    
                    inputRl.close();
                    setTimeout(() => {}, 1500);
                } else {
                    codeLines.push(line);
                    promptCode();
                }
            });
        };
        
        if (existingContent) {
            console.log(`${colors.yellow}Código atual:${colors.reset}`);
            console.log(existingContent);
            console.log(`${colors.yellow}─────────────────────────────────────────────────────────────────${colors.reset}`);
            console.log(`${colors.cyan}Digite o novo código (ou deixe vazio para manter o original):${colors.reset}`);
            codeLines = existingContent.split('\n');
        }
        
        promptCode();
    });
}

async function startServer() {
    clearScreen();
    showHeader();
    
    if (isServerRunning) {
        console.log(`${colors.yellow}⚠️  Servidor já está rodando!${colors.reset}`);
        setTimeout(() => {}, 1500);
        return;
    }
    
    if (!botConfig) {
        console.log(`${colors.red}❌ Bot não autenticado! Autentique primeiro.${colors.reset}`);
        setTimeout(() => {}, 2000);
        return;
    }
    
    console.log(`${colors.green}🚀 Iniciando servidor do bot...${colors.reset}`);
    log(`Iniciando servidor para bot: ${botConfig.botId}`, 'SERVER');
    
    const serverScript = `
    const https = require('https');
    const fs = require('fs');
    const path = require('path');
    
    const CONFIG = {
        firebaseUrl: '${CONFIG.firebaseUrl}',
        botData: ${JSON.stringify(botConfig)}
    };
    
    function log(message) {
        const timestamp = new Date().toISOString();
        console.log(\`[\${timestamp}] \${message}\`);
    }
    
    function httpsRequest(url, method = 'GET', data = null) {
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
                res.on('data', (chunk) => body += chunk);
                res.on('end', () => {
                    try {
                        resolve(body ? JSON.parse(body) : null);
                    } catch (e) {
                        resolve(body);
                    }
                });
            });
            
            req.on('error', reject);
            if (data) req.write(JSON.stringify(data));
            req.end();
        });
    }
    
    async function checkMessages() {
        for (const [chatId, chatData] of Object.entries(CONFIG.botData.chats || {})) {
            try {
                const messages = await httpsRequest(\`\${CONFIG.firebaseUrl}/groups/\${chatId}/messages.json\`);
                
                if (messages) {
                    const lastChecked = CONFIG.botData.lastChecked[chatId] || 0;
                    
                    for (const [msgId, msg] of Object.entries(messages)) {
                        if (msg.timestamp > lastChecked && msg.senderId !== CONFIG.botData.botId) {
                            log(\`💬 [\${chatId}] \${msg.senderName}: \${msg.text || msg.type}\`);
                            
                            const sendMessage = async (text, type = 'text', fileData = null) => {
                                const timestamp = Date.now();
                                const messageId = \`msg_\${timestamp}_\${Math.random().toString(36).substr(2, 9)}\`;
                                
                                const messageData = {
                                    ephemeral: false,
                                    senderId: CONFIG.botData.botId,
                                    senderName: CONFIG.botData.userData.name || 'Bot',
                                    text: text,
                                    timestamp: timestamp,
                                    type: type
                                };
                                
                                if (fileData) messageData.fileData = fileData;
                                if (type === 'image') messageData.fileName = 'image.jpg';
                                if (type === 'audio') messageData.fileName = 'audio.webm';
                                if (type === 'video') messageData.fileName = 'video.mp4';
                                
                                await httpsRequest(
                                    \`\${CONFIG.firebaseUrl}/groups/\${chatId}/messages/\${messageId}.json\`,
                                    'PUT',
                                    messageData
                                );
                                
                                log(\`✅ Mensagem enviada em \${chatId}: \${text}\`);
                            };
                            
                            const sendMedia = async (type, data, caption = '') => {
                                await sendMessage(caption, type, data);
                            };
                            
                            const componentsDir = '${CONFIG.componentsDir}';
                            const activeComponentsFile = '${CONFIG.activeComponentsFile}';
                            
                            if (fs.existsSync(activeComponentsFile)) {
                                const active = JSON.parse(fs.readFileSync(activeComponentsFile, 'utf8'));
                                
                                for (const componentFile of active.components || []) {
                                    const filepath = path.join(componentsDir, componentFile);
                                    if (fs.existsSync(filepath)) {
                                        try {
                                            delete require.cache[require.resolve(filepath)];
                                            const component = require(filepath);
                                            if (component && typeof component.onMessage === 'function') {
                                                await component.onMessage(msg, sendMessage, sendMedia);
                                                log(\`⚙️ Componente executado: \${component.name || componentFile}\`);
                                            }
                                        } catch (error) {
                                            log(\`❌ Erro no componente \${componentFile}: \${error.message}\`);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    CONFIG.botData.lastChecked[chatId] = Date.now();
                    fs.writeFileSync('${CONFIG.dataFile}', JSON.stringify(CONFIG.botData, null, 2));
                }
            } catch (error) {
                log(\`❌ Erro no chat \${chatId}: \${error.message}\`);
            }
        }
    }
    
    async function startComponents() {
        const activeComponentsFile = '${CONFIG.activeComponentsFile}';
        if (fs.existsSync(activeComponentsFile)) {
            const active = JSON.parse(fs.readFileSync(activeComponentsFile, 'utf8'));
            
            for (const componentFile of active.components || []) {
                const filepath = path.join('${CONFIG.componentsDir}', componentFile);
                if (fs.existsSync(filepath)) {
                    try {
                        delete require.cache[require.resolve(filepath)];
                        const component = require(filepath);
                        if (component && typeof component.onStart === 'function') {
                            const sendMessage = async (text) => { log(\`Componente tentou enviar: \${text}\`); };
                            const sendMedia = async (type, data) => { log(\`Componente tentou enviar mídia: \${type}\`); };
                            await component.onStart(sendMessage, sendMedia);
                            log(\`✅ Componente iniciado: \${component.name || componentFile}\`);
                        }
                    } catch (error) {
                        log(\`❌ Erro no onStart de \${componentFile}: \${error.message}\`);
                    }
                }
            }
        }
    }
    
    startComponents();
    setInterval(checkMessages, 5000);
    log('✅ Servidor do bot iniciado! Monitorando mensagens...');
    console.log('✅ Servidor rodando! Pressione Ctrl+C para parar.');
    
    process.on('SIGTERM', () => process.exit(0));
    `;
    
    const tempFile = path.join(__dirname, '.temp_server.js');
    fs.writeFileSync(tempFile, serverScript);
    
    serverProcess = spawn('node', [tempFile], {
        stdio: 'inherit',
        detached: false
    });
    
    isServerRunning = true;
    
    serverProcess.on('exit', () => {
        isServerRunning = false;
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        log('Servidor parado', 'SERVER');
    });
    
    console.log(`${colors.green}✅ Servidor iniciado com sucesso!${colors.reset}`);
    console.log(`${colors.yellow}🔍 Monitorando ${Object.keys(botConfig.chats).length} chats...${colors.reset}`);
    console.log();
    console.log(`${colors.cyan}Pressione ENTER para voltar ao menu (servidor continua rodando em background)${colors.reset}`);
    
    await new Promise(resolve => {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.once('data', () => {
            process.stdin.setRawMode(false);
            resolve();
        });
    });
}

function stopServer() {
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
        isServerRunning = false;
        console.log(`${colors.green}✅ Servidor parado!${colors.reset}`);
        log('Servidor parado pelo usuário', 'SERVER');
    } else {
        console.log(`${colors.yellow}⚠️  Nenhum servidor em execução${colors.reset}`);
    }
    setTimeout(() => {}, 1500);
}

async function sendManualMessage() {
    clearScreen();
    showHeader();
    
    console.log(`${colors.cyan}┌─────────────────────────────────────────────────────────────────┐${colors.reset}`);
    console.log(`${colors.cyan}│                         ENVIAR MENSAGEM                         │${colors.reset}`);
    console.log(`${colors.cyan}└─────────────────────────────────────────────────────────────────┘${colors.reset}`);
    console.log();
    
    if (!botConfig) {
        console.log(`${colors.red}❌ Bot não autenticado! Autentique primeiro.${colors.reset}`);
        setTimeout(() => {}, 2000);
        return;
    }
    
    console.log(`${colors.yellow}📋 Chats disponíveis:${colors.reset}`);
    const chats = Object.keys(botConfig.chats);
    if (chats.length === 0) {
        console.log(`${colors.red}❌ Nenhum chat encontrado!${colors.reset}`);
        setTimeout(() => {}, 2000);
        return;
    }
    
    chats.forEach((chat, index) => {
        const chatName = botConfig.chats[chat].name || 'Sem nome';
        const chatType = botConfig.chats[chat].type || 'chat';
        console.log(`${colors.cyan}${index + 1}.${colors.reset} ${colors.bright}${chat}${colors.reset} - ${chatName} (${chatType})`);
    });
    console.log();
    
    rl.question(`${colors.yellow}📝 ID do chat: ${colors.reset}`, async (chatId) => {
        if (!botConfig.chats[chatId]) {
            console.log(`${colors.red}❌ Chat não encontrado!${colors.reset}`);
            setTimeout(() => {}, 1500);
            return;
        }
        
        console.log();
        console.log(`${colors.yellow}📝 Tipos de mensagem:${colors.reset}`);
        console.log(`${colors.cyan}1.${colors.reset} Texto`);
        console.log(`${colors.cyan}2.${colors.reset} Áudio (Base64)`);
        console.log(`${colors.cyan}3.${colors.reset} Imagem (URL)`);
        console.log(`${colors.cyan}4.${colors.reset} Vídeo (URL)`);
        console.log();
        
        rl.question(`${colors.yellow}👉 Tipo (1-4): ${colors.reset}`, async (type) => {
            if (type === '1') {
                rl.question(`${colors.yellow}📝 Mensagem: ${colors.reset}`, async (message) => {
                    const timestamp = Date.now();
                    const messageId = `msg_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
                    
                    const messageData = {
                        ephemeral: false,
                        senderId: botConfig.botId,
                        senderName: botConfig.userData.name || 'Bot',
                        text: message,
                        timestamp: timestamp,
                        type: 'text'
                    };
                    
                    try {
                        await httpsRequest(
                            `${CONFIG.firebaseUrl}/groups/${chatId}/messages/${messageId}.json`,
                            'PUT',
                            messageData
                        );
                        console.log(`${colors.green}✅ Mensagem enviada com sucesso!${colors.reset}`);
                        log(`Mensagem manual enviada para ${chatId}: ${message}`, 'SEND');
                    } catch (error) {
                        console.log(`${colors.red}❌ Erro: ${error.message}${colors.reset}`);
                    }
                    setTimeout(() => {}, 2000);
                });
            } else if (type === '2') {
                rl.question(`${colors.yellow}📝 Áudio (Base64): ${colors.reset}`, async (audioData) => {
                    const timestamp = Date.now();
                    const messageId = `msg_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
                    
                    const messageData = {
                        ephemeral: false,
                        senderId: botConfig.botId,
                        senderName: botConfig.userData.name || 'Bot',
                        text: '🎵 Áudio',
                        fileData: audioData,
                        fileName: 'audio.webm',
                        timestamp: timestamp,
                        type: 'audio'
                    };
                    
                    try {
                        await httpsRequest(
                            `${CONFIG.firebaseUrl}/groups/${chatId}/messages/${messageId}.json`,
                            'PUT',
                            messageData
                        );
                        console.log(`${colors.green}✅ Áudio enviado com sucesso!${colors.reset}`);
                        log(`Áudio manual enviado para ${chatId}`, 'SEND');
                    } catch (error) {
                        console.log(`${colors.red}❌ Erro: ${error.message}${colors.reset}`);
                    }
                    setTimeout(() => {}, 2000);
                });
            } else if (type === '3') {
                rl.question(`${colors.yellow}📝 URL da imagem: ${colors.reset}`, async (imageUrl) => {
                    rl.question(`${colors.yellow}📝 Legenda (opcional): ${colors.reset}`, async (caption) => {
                        const timestamp = Date.now();
                        const messageId = `msg_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
                        
                        const messageData = {
                            ephemeral: false,
                            senderId: botConfig.botId,
                            senderName: botConfig.userData.name || 'Bot',
                            text: caption || '🖼️ Imagem',
                            fileData: imageUrl,
                            fileName: 'image.jpg',
                            timestamp: timestamp,
                            type: 'image'
                        };
                        
                        try {
                            await httpsRequest(
                                `${CONFIG.firebaseUrl}/groups/${chatId}/messages/${messageId}.json`,
                                'PUT',
                                messageData
                            );
                            console.log(`${colors.green}✅ Imagem enviada com sucesso!${colors.reset}`);
                            log(`Imagem manual enviada para ${chatId}`, 'SEND');
                        } catch (error) {
                            console.log(`${colors.red}❌ Erro: ${error.message}${colors.reset}`);
                        }
                        setTimeout(() => {}, 2000);
                    });
                });
            } else if (type === '4') {
                rl.question(`${colors.yellow}📝 URL do vídeo: ${colors.reset}`, async (videoUrl) => {
                    rl.question(`${colors.yellow}📝 Legenda (opcional): ${colors.reset}`, async (caption) => {
                        const timestamp = Date.now();
                        const messageId = `msg_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
                        
                        const messageData = {
                            ephemeral: false,
                            senderId: botConfig.botId,
                            senderName: botConfig.userData.name || 'Bot',
                            text: caption || '📹 Vídeo',
                            fileData: videoUrl,
                            fileName: 'video.mp4',
                            timestamp: timestamp,
                            type: 'video'
                        };
                        
                        try {
                            await httpsRequest(
                                `${CONFIG.firebaseUrl}/groups/${chatId}/messages/${messageId}.json`,
                                'PUT',
                                messageData
                            );
                            console.log(`${colors.green}✅ Vídeo enviado com sucesso!${colors.reset}`);
                            log(`Vídeo manual enviado para ${chatId}`, 'SEND');
                        } catch (error) {
                            console.log(`${colors.red}❌ Erro: ${error.message}${colors.reset}`);
                        }
                        setTimeout(() => {}, 2000);
                    });
                });
            }
        });
    });
}

async function showStatus() {
    clearScreen();
    showHeader();
    
    console.log(`${colors.cyan}┌─────────────────────────────────────────────────────────────────┐${colors.reset}`);
    console.log(`${colors.cyan}│                         STATUS DO BOT                           │${colors.reset}`);
    console.log(`${colors.cyan}└─────────────────────────────────────────────────────────────────┘${colors.reset}`);
    console.log();
    
    if (botConfig) {
        console.log(`${colors.green}✅ STATUS: BOT AUTENTICADO${colors.reset}`);
        console.log();
        console.log(`${colors.magenta}📊 INFORMAÇÕES:${colors.reset}`);
        console.log(`${colors.cyan}├─ ID:${colors.reset} ${botConfig.botId}`);
        console.log(`${colors.cyan}├─ Nome:${colors.reset} ${botConfig.userData.name || 'N/A'}`);
        console.log(`${colors.cyan}├─ Username:${colors.reset} ${botConfig.userData.username || 'N/A'}`);
        console.log(`${colors.cyan}├─ Descrição:${colors.reset} ${botConfig.userData.description || 'Sem descrição'}`);
        console.log(`${colors.cyan}├─ Criado em:${colors.reset} ${new Date(botConfig.userData.createdAt).toLocaleString()}`);
        console.log(`${colors.cyan}├─ Dono:${colors.reset} ${botConfig.userData.ownerId || 'N/A'}`);
        console.log();
        console.log(`${colors.magenta}💬 CHATS:${colors.reset}`);
        console.log(`${colors.cyan}└─ Total:${colors.reset} ${Object.keys(botConfig.chats).length}`);
        
        if (Object.keys(botConfig.chats).length > 0) {
            console.log();
            console.log(`${colors.yellow}Lista de chats:${colors.reset}`);
            Object.entries(botConfig.chats).forEach(([id, chat]) => {
                console.log(`${colors.green}  📌${colors.reset} ${id} - ${chat.name || 'Sem nome'} (${chat.type || 'chat'})`);
            });
        }
        
        console.log();
        console.log(`${colors.magenta}👥 COMUNIDADES:${colors.reset}`);
        console.log(`${colors.cyan}└─ Total:${colors.reset} ${Object.keys(botConfig.communities || {}).length}`);
        
        console.log();
        console.log(`${colors.magenta}🖥️ SERVIDOR:${colors.reset}`);
        if (isServerRunning) {
            console.log(`${colors.green}  🟢 Status: ONLINE${colors.reset}`);
        } else {
            console.log(`${colors.red}  🔴 Status: OFFLINE${colors.reset}`);
        }
        
        console.log();
        console.log(`${colors.magenta}📦 COMPONENTES ATIVOS:${colors.reset}`);
        const active = listActiveComponents();
        if (active.length === 0) {
            console.log(`${colors.yellow}  Nenhum componente ativo${colors.reset}`);
        } else {
            active.forEach(comp => console.log(`${colors.green}  ✓${colors.reset} ${comp}`));
        }
        
    } else {
        console.log(`${colors.red}❌ STATUS: BOT NÃO AUTENTICADO${colors.reset}`);
        console.log();
        console.log(`${colors.yellow}⚠️  Autentique o bot usando a opção 1 do menu principal.${colors.reset}`);
    }
    
    console.log();
    console.log(`${colors.yellow}─────────────────────────────────────────────────────────────────${colors.reset}`);
    await new Promise(resolve => {
        rl.question(`${colors.cyan}Pressione ENTER para continuar...${colors.reset}`, resolve);
    });
}

async function showHelp() {
    clearScreen();
    showHeader();
    
    console.log(`${colors.cyan}┌─────────────────────────────────────────────────────────────────┐${colors.reset}`);
    console.log(`${colors.cyan}│                         GUIA DO SISTEMA                          │${colors.reset}`);
    console.log(`${colors.cyan}└─────────────────────────────────────────────────────────────────┘${colors.reset}`);
    console.log();
    
    console.log(`${colors.magenta}📖 COMO USAR:${colors.reset}`);
    console.log();
    console.log(`${colors.green}1. AUTENTICAR O BOT${colors.reset}`);
    console.log(`   ${colors.cyan}→${colors.reset} Use a opção 1 e digite o ID do seu bot`);
    console.log(`   ${colors.cyan}→${colors.reset} O sistema carregará automaticamente todos os chats`);
    console.log();
    console.log(`${colors.green}2. INICIAR O SERVIDOR${colors.reset}`);
    console.log(`   ${colors.cyan}→${colors.reset} Após autenticar, use a opção 2 para iniciar`);
    console.log(`   ${colors.cyan}→${colors.reset} O bot começará a responder automaticamente`);
    console.log();
    console.log(`${colors.green}3. CRIAR COMPONENTES${colors.reset}`);
    console.log(`   ${colors.cyan}→${colors.reset} Use a opção 6 para criar seus próprios componentes`);
    console.log(`   ${colors.cyan}→${colors.reset} Os componentes são scripts que respondem a mensagens`);
    console.log();
    console.log(`${colors.green}4. ATIVAR COMPONENTES${colors.reset}`);
    console.log(`   ${colors.cyan}→${colors.reset} Use a opção 5 para gerenciar componentes ativos`);
    console.log(`   ${colors.cyan}→${colors.reset} Apenas componentes ativos serão executados`);
    console.log();
    
    console.log(`${colors.magenta}🎨 EXEMPLO DE COMPONENTE:${colors.reset}`);
    console.log();
    console.log(`${colors.green}module.exports = {`);
    console.log(`  name: "Calculadora",`);
    console.log(`  onMessage: async (msg, send) => {`);
    console.log(`    if (msg.text.startsWith("/calc ")) {`);
    console.log(`      const expressao = msg.text.replace("/calc ", "");`);
    console.log(`      const resultado = eval(expressao);`);
    console.log(`      await send(\`Resultado: \${resultado}\`);`);
    console.log(`    }`);
    console.log(`  }`);
    console.log(`};${colors.reset}`);
    console.log();
    
    console.log(`${colors.magenta}💡 DICAS:${colors.reset}`);
    console.log(`   ${colors.cyan}•${colors.reset} O servidor continua rodando mesmo após voltar ao menu`);
    console.log(`   ${colors.cyan}•${colors.reset} Componentes podem enviar texto, áudio, imagem e vídeo`);
    console.log(`   ${colors.cyan}•${colors.reset} Use ${colors.yellow}./bot.sh stop${colors.reset} para parar o processo em background`);
    console.log();
    
    console.log(`${colors.yellow}─────────────────────────────────────────────────────────────────${colors.reset}`);
    await new Promise(resolve => {
        rl.question(`${colors.cyan}Pressione ENTER para continuar...${colors.reset}`, resolve);
    });
}

async function mainMenu() {
    while (true) {
        clearScreen();
        showHeader();
        
        console.log(`${colors.cyan}┌─────────────────────────────────────────────────────────────────┐${colors.reset}`);
        console.log(`${colors.cyan}│                         MENU PRINCIPAL                          │${colors.reset}`);
        console.log(`${colors.cyan}└─────────────────────────────────────────────────────────────────┘${colors.reset}`);
        console.log();
        
        if (botConfig) {
            console.log(`${colors.green}✅ Bot: ${botConfig.userData.name || botConfig.botId}${colors.reset}`);
        } else {
            console.log(`${colors.red}❌ Bot: Não autenticado${colors.reset}`);
        }
        
        if (isServerRunning) {
            console.log(`${colors.green}🟢 Servidor: ONLINE - Monitorando ${Object.keys(botConfig?.chats || {}).length} chats${colors.reset}`);
        } else {
            console.log(`${colors.red}🔴 Servidor: OFFLINE${colors.reset}`);
        }
        
        console.log();
        console.log(`${colors.yellow}═══════════════════════════════════════════════════════════════${colors.reset}`);
        console.log(`${colors.cyan} 1.${colors.reset} 🔐 Autenticar Bot`);
        console.log(`${colors.cyan} 2.${colors.reset} 🚀 Iniciar Servidor`);
        console.log(`${colors.cyan} 3.${colors.reset} ⏹️  Parar Servidor`);
        console.log(`${colors.cyan} 4.${colors.reset} 📨 Enviar Mensagem`);
        console.log(`${colors.cyan} 5.${colors.reset} 📦 Gerenciar Componentes`);
        console.log(`${colors.cyan} 6.${colors.reset} ✏️  Criar/Editar Componente`);
        console.log(`${colors.cyan} 7.${colors.reset} 📋 Listar Componentes Ativos`);
        console.log(`${colors.cyan} 8.${colors.reset} ℹ️  Status do Bot`);
        console.log(`${colors.cyan} 9.${colors.reset} 📚 Ajuda`);
        console.log(`${colors.cyan}10.${colors.reset} 🚪 Sair`);
        console.log(`${colors.yellow}═══════════════════════════════════════════════════════════════${colors.reset}`);
        console.log();
        
        const answer = await new Promise(resolve => {
            rl.question(`${colors.yellow}👉 Escolha uma opção: ${colors.reset}`, resolve);
        });
        
        switch(answer) {
            case '1':
                await authBot();
                break;
            case '2':
                await startServer();
                break;
            case '3':
                stopServer();
                break;
            case '4':
                await sendManualMessage();
                break;
            case '5':
                await listComponents();
                break;
            case '6':
                editComponent();
                await new Promise(resolve => setTimeout(resolve, 500));
                break;
            case '7':
                clearScreen();
                showHeader();
                const active = listActiveComponents();
                console.log(`${colors.cyan}📋 COMPONENTES ATIVOS:${colors.reset}`);
                console.log();
                if (active.length === 0) {
                    console.log(`${colors.yellow}  Nenhum componente ativo no momento${colors.reset}`);
                } else {
                    active.forEach(comp => console.log(`${colors.green}  ✓${colors.reset} ${comp}`));
                }
                console.log();
                console.log(`${colors.yellow}─────────────────────────────────────────────────────────────────${colors.reset}`);
                await new Promise(resolve => {
                    rl.question(`${colors.cyan}Pressione ENTER para continuar...${colors.reset}`, resolve);
                });
                break;
            case '8':
                await showStatus();
                break;
            case '9':
                await showHelp();
                break;
            case '10':
                if (serverProcess) {
                    serverProcess.kill();
                }
                console.log();
                console.log(`${colors.green}👋 Até logo! Obrigado por usar o DEV BOT SDK!${colors.reset}`);
                console.log();
                rl.close();
                process.exit(0);
                break;
            default:
                console.log(`${colors.red}❌ Opção inválida! Tente novamente.${colors.reset}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

// Cria arquivo de log inicial
if (!fs.existsSync(CONFIG.logsFile)) {
    fs.writeFileSync(CONFIG.logsFile, `[${new Date().toISOString()}] Sistema iniciado\n`);
}

console.log(`${colors.green}🚀 Iniciando DEV BOT SDK...${colors.reset}`);
console.log(`${colors.cyan}📁 Logs salvos em: ${CONFIG.logsFile}${colors.reset}`);
console.log();
mainMenu();
EOF

    echo -e "${GREEN}✅ bot.js criado${NC}"
}

# Cria bot.sh
create_bot_sh() {
    echo -e "${CYAN}📝 Criando bot.sh...${NC}"
    
    cat > bot.sh << 'EOF'
#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$BOT_DIR/.bot.pid"
NODE_SCRIPT="$BOT_DIR/bot.js"

case "$1" in
    start)
        if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
            echo -e "${YELLOW}⚠️  Bot já está rodando (PID: $(cat $PID_FILE))${NC}"
        else
            echo -e "${GREEN}🚀 Iniciando DEV BOT SDK...${NC}"
            nohup node "$NODE_SCRIPT" > /dev/null 2>&1 &
            echo $! > "$PID_FILE"
            sleep 2
            echo -e "${GREEN}✅ SDK iniciado! (PID: $(cat $PID_FILE))${NC}"
            echo -e "${YELLOW}📱 Acesse a interface com: node bot.js${NC}"
        fi
        ;;
    stop)
        if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
            echo -e "${YELLOW}⏹️  Parando SDK...${NC}"
            kill $(cat "$PID_FILE")
            rm -f "$PID_FILE"
            echo -e "${GREEN}✅ SDK parado!${NC}"
        else
            echo -e "${RED}❌ SDK não está rodando${NC}"
        fi
        ;;
    status)
        if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
            echo -e "${GREEN}✅ SDK está rodando (PID: $(cat $PID_FILE))${NC}"
        else
            echo -e "${RED}❌ SDK não está rodando${NC}"
        fi
        ;;
    logs)
        if [ -f "logs/bot.log" ]; then
            tail -50 logs/bot.log
        else
            echo -e "${YELLOW}Nenhum log encontrado${NC}"
        fi
        ;;
    *)
        echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}   DEV BOT SDK - Comandos disponíveis${NC}"
        echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
        echo ""
        echo -e "${GREEN}  start   ${NC}- Iniciar o SDK em background"
        echo -e "${GREEN}  stop    ${NC}- Parar o SDK"
        echo -e "${GREEN}  status  ${NC}- Verificar status do SDK"
        echo -e "${GREEN}  logs    ${NC}- Ver últimos logs"
        echo ""
        echo -e "${YELLOW}💡 Após iniciar, use 'node bot.js' para acessar a interface${NC}"
        echo ""
        exit 1
        ;;
esac
EOF

    chmod +x bot.sh
    echo -e "${GREEN}✅ bot.sh criado${NC}"
}

# Cria componentes exemplo
create_example_components() {
    echo -e "${CYAN}📝 Criando componentes exemplo...${NC}"
    
    # Componente de saudação
    cat > components/saudacao.js << 'EOF'
module.exports = {
    name: "Saudação Básica",
    version: "1.0.0",
    description: "Responde a saudações simples como 'oi', 'olá', 'bom dia'",
    
    onMessage: async (message, sendMessage, sendMedia) => {
        const text = message.text?.toLowerCase() || '';
        
        if (text === 'oi' || text === 'olá' || text === 'hello') {
            await sendMessage(`Olá ${message.senderName}! Como posso ajudar você hoje?`);
        }
        
        if (text === 'bom dia') {
            await sendMessage(`Bom dia ${message.senderName}! Tenha um excelente dia! ☀️`);
        }
        
        if (text === 'boa noite') {
            await sendMessage(`Boa noite ${message.senderName}! Durma bem! 🌙`);
        }
        
        if (text === 'tudo bem?' || text === 'como vai?') {
            await sendMessage(`Estou muito bem, obrigado! E você, ${message.senderName}? 😊`);
        }
    },
    
    onStart: async (sendMessage, sendMedia) => {
        console.log("✅ Componente de saudação carregado!");
        console.log("📝 Respostas configuradas: oi, olá, bom dia, boa noite, tudo bem?");
    }
};
EOF

    # Componente de comandos úteis
    cat > components/comandos.js << 'EOF'
module.exports = {
    name: "Comandos Úteis",
    version: "1.0.0",
    description: "Comandos como /hora, /data, /ping",
    
    onMessage: async (message, sendMessage, sendMedia) => {
        const text = message.text?.toLowerCase() || '';
        
        if (text === '/hora') {
            const agora = new Date();
            const hora = agora.toLocaleTimeString('pt-BR');
            await sendMessage(`🕐 Hora atual: ${hora}`);
        }
        
        if (text === '/data') {
            const agora = new Date();
            const data = agora.toLocaleDateString('pt-BR');
            await sendMessage(`📅 Data atual: ${data}`);
        }
        
        if (text === '/ping') {
            await sendMessage(`🏓 Pong! ${message.senderName}, o bot está online e respondendo!`);
        }
        
        if (text === '/ajuda') {
            await sendMessage(`📚 Comandos disponíveis:
/ajuda - Mostrar esta mensagem
/hora - Ver hora atual
/data - Ver data atual
/ping - Verificar se o bot está online
/sobre - Informações do bot`);
        }
        
        if (text === '/sobre') {
            await sendMessage(`🤖 DEV BOT SDK v1.0
Um sistema profissional para criação de bots
Criado para desenvolvedores
Documentação: use /ajuda`);
        }
    },
    
    onStart: async (sendMessage, sendMedia) => {
        console.log("✅ Componente de comandos carregado!");
        console.log("📝 Comandos disponíveis: /hora, /data, /ping, /ajuda, /sobre");
    }
};
EOF

    # Componente de calculadora
    cat > components/calculadora.js << 'EOF'
module.exports = {
    name: "Calculadora",
    version: "1.0.0",
    description: "Calcula expressões matemáticas com /calc",
    
    onMessage: async (message, sendMessage, sendMedia) => {
        const text = message.text || '';
        
        if (text.startsWith('/calc ')) {
            try {
                const expressao = text.replace('/calc ', '');
                // Avalia a expressão matematicamente
                const resultado = Function('"use strict";return (' + expressao + ')')();
                await sendMessage(`🧮 ${expressao} = ${resultado}`);
            } catch (error) {
                await sendMessage(`❌ Erro ao calcular: Expressão inválida!`);
            }
        }
    },
    
    onStart: async (sendMessage, sendMedia) => {
        console.log("✅ Componente calculadora carregado!");
        console.log("📝 Use /calc <expressão> para calcular");
    }
};
EOF

    echo -e "${GREEN}✅ Componentes exemplo criados:${NC}"
    echo -e "${GREEN}   - components/saudacao.js${NC}"
    echo -e "${GREEN}   - components/comandos.js${NC}"
    echo -e "${GREEN}   - components/calculadora.js${NC}"
}

# Cria arquivo README
create_readme() {
    echo -e "${CYAN}📝 Criando README.md...${NC}"
    
    cat > README.md << 'EOF'
# 🤖 DEV BOT SDK v1.0

Sistema profissional para desenvolvimento e gerenciamento de bots.

## 📦 Instalação

```bash
chmod +x install.sh
./install.sh