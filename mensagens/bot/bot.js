#!/usr/bin/env node

const https = require('https');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');

// Configuração
const FIREBASE_URL = 'https://html-785e3-default-rtdb.firebaseio.com';
const DATA_FILE = 'bot_data.json';
const SCRIPTS_DIR = './scripts';
const WEB_DIR = './web_dashboard';
const WEB_PORT = 3000;

let botConfig = null;
let monitorando = false;
let startTime = Date.now();
let webServer = null;
let activeMonitors = {};

// Cores para terminal
const cores = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bold: '\x1b[1m'
};

// Interface readline normal (sem setas para evitar conflitos)
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Função para fazer requisições HTTPS
function request(url, method = 'GET', data = null) {
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

// Limpar tela
function limparTela() {
  console.clear();
}

// Calcular tempo ativo
function getUptime() {
  const diff = Date.now() - startTime;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

// Mostrar título
function mostrarTitulo() {
  console.log(`${cores.blue}╔══════════════════════════════════════════════════════════════════╗${cores.reset}`);
  console.log(`${cores.blue}║${cores.reset}${cores.bold}${cores.cyan}                    🤖 BOT SYSTEM v2.0 - ${botConfig ? botConfig.nome.toUpperCase() : 'DESCONECTADO'}                    ${cores.reset}${cores.blue}║${cores.reset}`);
  console.log(`${cores.blue}╠══════════════════════════════════════════════════════════════════╣${cores.reset}`);
  console.log(`${cores.blue}║${cores.reset} ${cores.cyan}📊 Status:${cores.reset} ${botConfig ? cores.green + '✅ ONLINE' + cores.reset : cores.red + '❌ OFFLINE' + cores.reset}    ${cores.cyan}⏱️  Ativo há:${cores.reset} ${getUptime()}    ${cores.cyan}🌐 Web:${cores.reset} ${webServer ? cores.green + 'ON' + cores.reset : cores.red + 'OFF' + cores.reset}${cores.blue}║${cores.reset}`);
  console.log(`${cores.blue}╚══════════════════════════════════════════════════════════════════╝${cores.reset}`);
  console.log();
}

// Autenticar bot
async function autenticarBot() {
  limparTela();
  mostrarTitulo();
  
  console.log(`${cores.cyan}┌─────────────────────────────────────────────────────────────┐${cores.reset}`);
  console.log(`${cores.cyan}│                    AUTENTICAR BOT                          │${cores.reset}`);
  console.log(`${cores.cyan}└─────────────────────────────────────────────────────────────┘${cores.reset}`);
  console.log();
  
  return new Promise((resolve) => {
    rl.question(`${cores.yellow}📝 Digite o ID do bot: ${cores.reset}`, async (botId) => {
      if (!botId) {
        console.log(`${cores.red}❌ ID não fornecido!${cores.reset}`);
        setTimeout(() => resolve(false), 1500);
        return;
      }
      
      console.log(`${cores.cyan}🔄 Autenticando...${cores.reset}`);
      
      try {
        const userData = await request(`${FIREBASE_URL}/users/${botId}.json`);
        
        if (!userData) {
          console.log(`${cores.red}❌ Bot não encontrado!${cores.reset}`);
          setTimeout(() => resolve(false), 1500);
          return;
        }
        
        const chats = {};
        if (userData.chats) {
          for (const [chatId, chatData] of Object.entries(userData.chats)) {
            try {
              const grupo = await request(`${FIREBASE_URL}/groups/${chatId}.json`);
              chats[chatId] = {
                id: chatId,
                nome: grupo?.nome || chatData.name || chatId,
                tipo: chatData.type || 'group',
                members: grupo?.members || {}
              };
            } catch(e) {
              chats[chatId] = { id: chatId, nome: chatId, tipo: 'group', members: {} };
            }
          }
        }
        
        botConfig = {
          id: botId,
          nome: userData.name || botId,
          chats: chats,
          userData: userData,
          roles: {},
          scripts: []
        };
        
        fs.writeFileSync(DATA_FILE, JSON.stringify(botConfig, null, 2));
        
        console.log(`${cores.green}✅ Autenticado com sucesso!${cores.reset}`);
        console.log(`${cores.green}📛 Nome: ${botConfig.nome}${cores.reset}`);
        console.log(`${cores.green}📊 Grupos: ${Object.keys(chats).length}${cores.reset}`);
        
        setTimeout(() => resolve(true), 2000);
        
      } catch(error) {
        console.log(`${cores.red}❌ Erro: ${error.message}${cores.reset}`);
        setTimeout(() => resolve(false), 1500);
      }
    });
  });
}

// Enviar mensagem
async function enviarMensagem(grupoId, texto) {
  const timestamp = Date.now();
  const msgId = `msg_${timestamp}_${Math.random().toString(36).substr(2, 6)}`;
  
  const mensagem = {
    senderId: botConfig.id,
    senderName: botConfig.nome,
    text: texto,
    timestamp: timestamp,
    type: 'text'
  };
  
  await request(`${FIREBASE_URL}/groups/${grupoId}/messages/${msgId}.json`, 'PUT', mensagem);
  return true;
}

// Listar grupos
async function listarGrupos() {
  limparTela();
  mostrarTitulo();
  
  console.log(`${cores.cyan}┌─────────────────────────────────────────────────────────────┐${cores.reset}`);
  console.log(`${cores.cyan}│                    SEUS GRUPOS                            │${cores.reset}`);
  console.log(`${cores.cyan}└─────────────────────────────────────────────────────────────┘${cores.reset}`);
  console.log();
  
  if (!botConfig) {
    console.log(`${cores.red}❌ Nenhum bot autenticado!${cores.reset}`);
    console.log(`${cores.yellow}💡 Use a opção 1 para autenticar primeiro.${cores.reset}`);
    await pausar();
    return;
  }
  
  if (!botConfig.chats || Object.keys(botConfig.chats).length === 0) {
    console.log(`${cores.yellow}⚠️ Nenhum grupo encontrado!${cores.reset}`);
    console.log();
    console.log(`${cores.cyan}💡 Para adicionar o bot a um grupo:${cores.reset}`);
    console.log(`   Use o ID do bot: ${cores.green}${botConfig.id}${cores.reset}`);
    await pausar();
    return;
  }
  
  const grupos = Object.values(botConfig.chats);
  for (let i = 0; i < grupos.length; i++) {
    const g = grupos[i];
    console.log(`${cores.green}${i + 1}.${cores.reset} ${cores.cyan}${g.nome}${cores.reset}`);
    console.log(`   📌 ID: ${g.id}`);
    console.log(`   📊 Tipo: ${g.tipo}`);
    console.log(`   👥 Membros: ${Object.keys(g.members || {}).length}`);
    console.log();
  }
  
  await pausar();
}

// Enviar mensagem para grupo
async function enviarParaGrupo() {
  limparTela();
  mostrarTitulo();
  
  if (!botConfig) {
    console.log(`${cores.red}❌ Nenhum bot autenticado!${cores.reset}`);
    console.log(`${cores.yellow}💡 Use a opção 1 para autenticar primeiro.${cores.reset}`);
    await pausar();
    return;
  }
  
  if (!botConfig.chats || Object.keys(botConfig.chats).length === 0) {
    console.log(`${cores.yellow}⚠️ Nenhum grupo disponível!${cores.reset}`);
    await pausar();
    return;
  }
  
  const grupos = Object.values(botConfig.chats);
  
  console.log(`${cores.cyan}┌─────────────────────────────────────────────────────────────┐${cores.reset}`);
  console.log(`${cores.cyan}│                    ESCOLHA O GRUPO                        │${cores.reset}`);
  console.log(`${cores.cyan}└─────────────────────────────────────────────────────────────┘${cores.reset}`);
  console.log();
  
  for (let i = 0; i < grupos.length; i++) {
    console.log(`${cores.green}${i + 1}.${cores.reset} ${grupos[i].nome}`);
  }
  console.log();
  
  rl.question(`${cores.yellow}👉 Escolha (1-${grupos.length}): ${cores.reset}`, async (opcao) => {
    const idx = parseInt(opcao) - 1;
    if (idx >= 0 && idx < grupos.length) {
      const grupo = grupos[idx];
      
      rl.question(`${cores.yellow}📝 Digite a mensagem: ${cores.reset}`, async (msg) => {
        if (msg) {
          console.log(`${cores.cyan}🔄 Enviando...${cores.reset}`);
          await enviarMensagem(grupo.id, msg);
          console.log(`${cores.green}✅ Mensagem enviada para ${grupo.nome}!${cores.reset}`);
        } else {
          console.log(`${cores.yellow}⚠️ Mensagem vazia!${cores.reset}`);
        }
        setTimeout(() => {
          menuPrincipal();
        }, 1500);
      });
    } else {
      console.log(`${cores.red}❌ Opção inválida!${cores.reset}`);
      setTimeout(() => {
        menuPrincipal();
      }, 1000);
    }
  });
}

// Monitorar mensagens
async function monitorarMensagens() {
  limparTela();
  mostrarTitulo();
  
  if (!botConfig) {
    console.log(`${cores.red}❌ Nenhum bot autenticado!${cores.reset}`);
    console.log(`${cores.yellow}💡 Use a opção 1 para autenticar primeiro.${cores.reset}`);
    await pausar();
    return;
  }
  
  if (!botConfig.chats || Object.keys(botConfig.chats).length === 0) {
    console.log(`${cores.yellow}⚠️ Nenhum grupo disponível!${cores.reset}`);
    await pausar();
    return;
  }
  
  const grupos = Object.values(botConfig.chats);
  
  console.log(`${cores.cyan}┌─────────────────────────────────────────────────────────────┐${cores.reset}`);
  console.log(`${cores.cyan}│                    MONITORAR GRUPO                         │${cores.reset}`);
  console.log(`${cores.cyan}└─────────────────────────────────────────────────────────────┘${cores.reset}`);
  console.log();
  
  for (let i = 0; i < grupos.length; i++) {
    console.log(`${cores.green}${i + 1}.${cores.reset} ${grupos[i].nome}`);
  }
  console.log();
  
  rl.question(`${cores.yellow}👉 Escolha o grupo (0 para cancelar): ${cores.reset}`, async (opcao) => {
    const idx = parseInt(opcao) - 1;
    if (opcao === '0') {
      menuPrincipal();
      return;
    }
    
    if (idx >= 0 && idx < grupos.length) {
      const grupo = grupos[idx];
      
      limparTela();
      mostrarTitulo();
      console.log(`${cores.green}📡 Monitorando: ${grupo.nome}${cores.reset}`);
      console.log(`${cores.yellow}⚠️ Pressione CTRL+C para parar o monitoramento${cores.reset}`);
      console.log(`${cores.blue}════════════════════════════════════════════════════════════${cores.reset}`);
      console.log();
      
      let ultimoTimestamp = Date.now();
      
      const interval = setInterval(async () => {
        try {
          const mensagens = await request(`${FIREBASE_URL}/groups/${grupo.id}/messages.json?orderBy="timestamp"&startAfter=${ultimoTimestamp}`);
          
          if (mensagens) {
            const msgs = Object.values(mensagens);
            for (const msg of msgs) {
              if (msg.senderId !== botConfig.id && msg.timestamp > ultimoTimestamp) {
                const hora = new Date(msg.timestamp).toLocaleTimeString();
                console.log(`${cores.gray}[${hora}]${cores.reset} ${cores.cyan}${msg.senderName}:${cores.reset} ${msg.text}`);
                if (msg.timestamp > ultimoTimestamp) {
                  ultimoTimestamp = msg.timestamp;
                }
              }
            }
          }
        } catch(e) {}
      }, 2000);
      
      activeMonitors[grupo.id] = interval;
      
      const cleanup = () => {
        if (activeMonitors[grupo.id]) {
          clearInterval(activeMonitors[grupo.id]);
          delete activeMonitors[grupo.id];
        }
        console.log(`\n${cores.yellow}👋 Monitoramento de ${grupo.nome} encerrado!${cores.reset}`);
        process.stdin.removeListener('SIGINT', cleanup);
        setTimeout(() => menuPrincipal(), 2000);
      };
      
      process.on('SIGINT', cleanup);
    } else {
      console.log(`${cores.red}❌ Opção inválida!${cores.reset}`);
      setTimeout(() => menuPrincipal(), 1000);
    }
  });
}

// Criar diretório de scripts se não existir
function initScriptsDir() {
  if (!fs.existsSync(SCRIPTS_DIR)) {
    fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
    
    // Criar script exemplo
    const exampleScript = `// Script exemplo para o BOT SYSTEM
// Este script será executado automaticamente

async function main(bot, grupoId, enviarMensagem, request) {
    console.log("🚀 Executando script automático...");
    
    // Enviar mensagem de boas vindas
    await enviarMensagem(grupoId, "🤖 Bot ativado! Este é um script automático.");
    
    // Buscar dados de exemplo
    const data = await request("https://api.github.com/repos/nodejs/node");
    if (data) {
        await enviarMensagem(grupoId, \`📊 Informações do Node.js: \${data.stargazers_count} estrelas!\`);
    }
    
    console.log("✅ Script finalizado com sucesso!");
}

main(bot, grupoId, enviarMensagem, request).catch(console.error);
`;
    
    fs.writeFileSync(path.join(SCRIPTS_DIR, 'exemplo.js'), exampleScript);
  }
}

// Listar scripts
function listarScripts() {
  if (!fs.existsSync(SCRIPTS_DIR)) {
    return [];
  }
  return fs.readdirSync(SCRIPTS_DIR).filter(file => file.endsWith('.js'));
}

// Criar novo script
async function criarScript() {
  limparTela();
  mostrarTitulo();
  
  console.log(`${cores.cyan}┌─────────────────────────────────────────────────────────────┐${cores.reset}`);
  console.log(`${cores.cyan}│                    CRIAR NOVO SCRIPT                       │${cores.reset}`);
  console.log(`${cores.cyan}└─────────────────────────────────────────────────────────────┘${cores.reset}`);
  console.log();
  
  rl.question(`${cores.yellow}📝 Nome do script (sem espaços, ex: meu_script): ${cores.reset}`, (nome) => {
    if (!nome) {
      console.log(`${cores.red}❌ Nome inválido!${cores.reset}`);
      setTimeout(() => menuPrincipal(), 1500);
      return;
    }
    
    const scriptPath = path.join(SCRIPTS_DIR, `${nome}.js`);
    
    const template = `// Script: ${nome}
// Criado em: ${new Date().toLocaleString()}

async function main(bot, grupoId, enviarMensagem, request) {
    console.log("📢 Iniciando script...");
    
    // TODO: Adicione seu código aqui
    
    // Exemplo: Enviar mensagem
    // await enviarMensagem(grupoId, "Olá! Este é meu script personalizado!");
    
    console.log("✅ Script finalizado!");
}

main(bot, grupoId, enviarMensagem, request).catch(console.error);
`;
    
    fs.writeFileSync(scriptPath, template);
    console.log(`${cores.green}✅ Script criado com sucesso!${cores.reset}`);
    console.log(`${cores.cyan}📁 Local: ${scriptPath}${cores.reset}`);
    setTimeout(() => menuPrincipal(), 2000);
  });
}

// Executar script
async function executarScript(scriptPath, grupoId) {
  try {
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    const scriptFunction = new Function('bot', 'grupoId', 'enviarMensagem', 'request', 'console', scriptContent);
    
    console.log(`${cores.cyan}🔄 Executando script...${cores.reset}`);
    await scriptFunction(botConfig, grupoId, enviarMensagem, request, console);
    console.log(`${cores.green}✅ Script executado com sucesso!${cores.reset}`);
    return true;
  } catch (error) {
    console.log(`${cores.red}❌ Erro ao executar script: ${error.message}${cores.reset}`);
    return false;
  }
}

// Menu de scripts
async function menuScripts() {
  limparTela();
  mostrarTitulo();
  
  if (!botConfig) {
    console.log(`${cores.red}❌ Nenhum bot autenticado!${cores.reset}`);
    console.log(`${cores.yellow}💡 Use a opção 1 para autenticar primeiro.${cores.reset}`);
    await pausar();
    return;
  }
  
  initScriptsDir();
  const scripts = listarScripts();
  
  console.log(`${cores.cyan}┌─────────────────────────────────────────────────────────────┐${cores.reset}`);
  console.log(`${cores.cyan}│                    GERENCIAR SCRIPTS                       │${cores.reset}`);
  console.log(`${cores.cyan}└─────────────────────────────────────────────────────────────┘${cores.reset}`);
  console.log();
  
  if (scripts.length === 0) {
    console.log(`${cores.yellow}⚠️ Nenhum script encontrado!${cores.reset}`);
  } else {
    console.log(`${cores.green}📜 Scripts disponíveis:${cores.reset}`);
    for (let i = 0; i < scripts.length; i++) {
      console.log(`${i + 1}. ${scripts[i]}`);
    }
  }
  
  console.log();
  console.log(`${cores.green}${scripts.length + 1}.${cores.reset} Criar novo script`);
  console.log(`${cores.green}${scripts.length + 2}.${cores.reset} Voltar ao menu principal`);
  console.log();
  
  rl.question(`${cores.yellow}👉 Escolha uma opção: ${cores.reset}`, async (opcao) => {
    const num = parseInt(opcao);
    
    if (num === scripts.length + 2) {
      menuPrincipal();
      return;
    }
    
    if (num === scripts.length + 1) {
      criarScript();
      return;
    }
    
    if (num >= 1 && num <= scripts.length) {
      const script = scripts[num - 1];
      const grupos = Object.values(botConfig.chats);
      
      if (grupos.length === 0) {
        console.log(`${cores.yellow}⚠️ Nenhum grupo disponível para executar o script!${cores.reset}`);
        await pausar();
        menuPrincipal();
        return;
      }
      
      limparTela();
      mostrarTitulo();
      console.log(`${cores.cyan}┌─────────────────────────────────────────────────────────────┐${cores.reset}`);
      console.log(`${cores.cyan}│                    ESCOLHA O GRUPO                        │${cores.reset}`);
      console.log(`${cores.cyan}└─────────────────────────────────────────────────────────────┘${cores.reset}`);
      console.log();
      
      for (let i = 0; i < grupos.length; i++) {
        console.log(`${i + 1}. ${grupos[i].nome}`);
      }
      console.log();
      
      rl.question(`${cores.yellow}👉 Escolha o grupo (0 para cancelar): ${cores.reset}`, async (grupoOpt) => {
        const grupoNum = parseInt(grupoOpt);
        
        if (grupoNum === 0) {
          menuPrincipal();
          return;
        }
        
        if (grupoNum >= 1 && grupoNum <= grupos.length) {
          await executarScript(path.join(SCRIPTS_DIR, script), grupos[grupoNum - 1].id);
          await pausar();
          menuPrincipal();
        } else {
          console.log(`${cores.red}❌ Opção inválida!${cores.reset}`);
          setTimeout(() => menuScripts(), 1500);
        }
      });
    } else {
      console.log(`${cores.red}❌ Opção inválida!${cores.reset}`);
      setTimeout(() => menuScripts(), 1500);
    }
  });
}

// Criar dashboard web editável
function criarWebDashboard() {
  if (!fs.existsSync(WEB_DIR)) {
    fs.mkdirSync(WEB_DIR, { recursive: true });
  }
  
  const htmlPath = path.join(WEB_DIR, 'index.html');
  const cssPath = path.join(WEB_DIR, 'style.css');
  const jsPath = path.join(WEB_DIR, 'script.js');
  
  // HTML Template
  const htmlContent = `<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BOT SYSTEM Dashboard - Editável</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 BOT SYSTEM Dashboard</h1>
            <p>Painel de controle editável do seu bot</p>
            <button id="editBtn" class="edit-btn">✏️ Editar Dashboard</button>
        </div>
        
        <div class="stats" id="stats">
            <div class="card">
                <h3>Status do Bot</h3>
                <div class="value" id="botStatus">Carregando...</div>
            </div>
            <div class="card">
                <h3>Tempo Ativo</h3>
                <div class="value" id="uptime">Carregando...</div>
            </div>
            <div class="card">
                <h3>Grupos Ativos</h3>
                <div class="value" id="groupsCount">0</div>
            </div>
            <div class="card">
                <h3>Scripts</h3>
                <div class="value" id="scriptsCount">0</div>
            </div>
        </div>
        
        <div class="info" id="info">
            <h2>📊 Informações do Bot</h2>
            <div class="info-item"><strong>ID:</strong> <span id="botId">-</span></div>
            <div class="info-item"><strong>Nome:</strong> <span id="botName">-</span></div>
            <div class="info-item"><strong>IP do Servidor:</strong> <span id="serverIp">-</span></div>
            <div class="info-item"><strong>Porta Web:</strong> <span id="webPort">${WEB_PORT}</span></div>
        </div>
        
        <div class="info" id="messages">
            <h2>💬 Últimas Mensagens</h2>
            <div id="messagesList" class="messages-list"></div>
        </div>
        
        <div class="info editable" contenteditable="false" id="customContent">
            <h2>📝 Conteúdo Personalizável</h2>
            <p>Clique em "Editar Dashboard" para personalizar esta área!</p>
        </div>
    </div>
    
    <script src="script.js"></script>
</body>
</html>`;
  
  // CSS Template
  const cssContent = `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    color: #fff;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

.header {
    text-align: center;
    padding: 40px 0;
    background: rgba(0,0,0,0.2);
    border-radius: 20px;
    margin-bottom: 30px;
    position: relative;
}

.header h1 {
    font-size: 3em;
    margin-bottom: 10px;
}

.edit-btn {
    position: absolute;
    top: 20px;
    right: 20px;
    padding: 10px 20px;
    background: rgba(255,255,255,0.2);
    border: 2px solid rgba(255,255,255,0.3);
    color: white;
    border-radius: 10px;
    cursor: pointer;
    font-size: 16px;
    transition: all 0.3s;
}

.edit-btn:hover {
    background: rgba(255,255,255,0.3);
    transform: scale(1.05);
}

.stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
}

.card {
    background: rgba(255,255,255,0.1);
    backdrop-filter: blur(10px);
    padding: 20px;
    border-radius: 15px;
    text-align: center;
    transition: transform 0.3s;
}

.card:hover {
    transform: translateY(-5px);
}

.card h3 {
    font-size: 1.2em;
    margin-bottom: 10px;
    opacity: 0.9;
}

.card .value {
    font-size: 2.5em;
    font-weight: bold;
}

.info {
    background: rgba(255,255,255,0.1);
    backdrop-filter: blur(10px);
    padding: 20px;
    border-radius: 15px;
    margin-bottom: 20px;
}

.info h2 {
    margin-bottom: 15px;
}

.info-item {
    padding: 10px;
    border-bottom: 1px solid rgba(255,255,255,0.2);
}

.messages-list {
    max-height: 300px;
    overflow-y: auto;
}

.message-item {
    padding: 10px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    font-size: 14px;
}

.message-time {
    color: rgba(255,255,255,0.6);
    font-size: 12px;
}

.message-sender {
    color: #4ade80;
    font-weight: bold;
}

.editable {
    cursor: pointer;
    transition: all 0.3s;
}

.editable:hover {
    background: rgba(255,255,255,0.15);
}

.editing-mode {
    border: 2px solid #4ade80;
    box-shadow: 0 0 20px rgba(74,222,128,0.3);
}

.status-online {
    color: #4ade80;
}

.status-offline {
    color: #f87171;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

.live {
    animation: pulse 2s infinite;
}

::-webkit-scrollbar {
    width: 8px;
}

::-webkit-scrollbar-track {
    background: rgba(255,255,255,0.1);
    border-radius: 10px;
}

::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.3);
    border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
    background: rgba(255,255,255,0.5);
}`;
  
  // JavaScript Template
  const jsContent = `let editingMode = false;
let ultimasMensagens = [];

async function atualizarDados() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        document.getElementById('botStatus').innerHTML = data.botStatus ? 
            '<span class="status-online">🟢 ONLINE</span>' : 
            '<span class="status-offline">🔴 OFFLINE</span>';
        document.getElementById('uptime').textContent = data.uptime || '0s';
        document.getElementById('groupsCount').textContent = data.groupsCount || 0;
        document.getElementById('scriptsCount').textContent = data.scriptsCount || 0;
        document.getElementById('botId').textContent = data.botId || '-';
        document.getElementById('botName').textContent = data.botName || '-';
        document.getElementById('serverIp').textContent = data.serverIp || '-';
        
        if (data.messages && data.messages.length > 0) {
            ultimasMensagens = data.messages;
            const messagesList = document.getElementById('messagesList');
            messagesList.innerHTML = ultimasMensagens.map(msg => \`
                <div class="message-item">
                    <div class="message-time">\${new Date(msg.timestamp).toLocaleString()}</div>
                    <div class="message-sender">\${msg.senderName}:</div>
                    <div>\${msg.text}</div>
                </div>
            \`).join('');
        }
    } catch(e) {
        console.error('Erro ao atualizar:', e);
    }
}

function toggleEditMode() {
    editingMode = !editingMode;
    const customContent = document.getElementById('customContent');
    const editBtn = document.getElementById('editBtn');
    
    if (editingMode) {
        customContent.setAttribute('contenteditable', 'true');
        customContent.classList.add('editing-mode');
        editBtn.textContent = '💾 Salvar Dashboard';
        editBtn.style.background = '#4ade80';
        
        // Salvar ao clicar fora
        customContent.addEventListener('blur', saveContent);
    } else {
        customContent.setAttribute('contenteditable', 'false');
        customContent.classList.remove('editing-mode');
        editBtn.textContent = '✏️ Editar Dashboard';
        editBtn.style.background = 'rgba(255,255,255,0.2)';
        saveContent();
    }
}

function saveContent() {
    const customContent = document.getElementById('customContent');
    const content = customContent.innerHTML;
    
    fetch('/api/save-content', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: content })
    }).then(response => response.json())
      .then(data => {
          if (data.success) {
              console.log('Conteúdo salvo!');
          }
      });
}

function loadSavedContent() {
    fetch('/api/load-content')
        .then(response => response.json())
        .then(data => {
            if (data.content) {
                document.getElementById('customContent').innerHTML = data.content;
            }
        });
}

document.getElementById('editBtn').addEventListener('click', toggleEditMode);

// Carregar conteúdo salvo
loadSavedContent();

// Atualizar a cada 3 segundos
atualizarDados();
setInterval(atualizarDados, 3000);`;
  
  fs.writeFileSync(htmlPath, htmlContent);
  fs.writeFileSync(cssPath, cssContent);
  fs.writeFileSync(jsPath, jsContent);
}

// Salvar conteúdo editável
function salvarConteudoEditavel(content) {
  const contentPath = path.join(WEB_DIR, 'custom_content.json');
  fs.writeFileSync(contentPath, JSON.stringify({ content: content, updated: Date.now() }));
  return true;
}

// Carregar conteúdo editável
function carregarConteudoEditavel() {
  const contentPath = path.join(WEB_DIR, 'custom_content.json');
  if (fs.existsSync(contentPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
      return data.content;
    } catch(e) {}
  }
  return null;
}

// Iniciar servidor web
function iniciarWebServer() {
  if (webServer) {
    console.log(`${cores.yellow}⚠️ Web server já está rodando!${cores.reset}`);
    return;
  }
  
  criarWebDashboard();
  
  webServer = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    // API endpoints
    if (req.url === '/api/status') {
      const networkInterfaces = os.networkInterfaces();
      let serverIp = 'localhost';
      for (const interfaceName in networkInterfaces) {
        for (const iface of networkInterfaces[interfaceName]) {
          if (iface.family === 'IPv4' && !iface.internal) {
            serverIp = iface.address;
            break;
          }
        }
      }
      
      // Buscar últimas mensagens
      let mensagens = [];
      if (botConfig && botConfig.chats) {
        const grupos = Object.values(botConfig.chats);
        for (const grupo of grupos.slice(0, 3)) {
          try {
            const msgs = await request(`${FIREBASE_URL}/groups/${grupo.id}/messages.json?orderBy="timestamp"&limitToLast=5`);
            if (msgs) {
              const msgList = Object.values(msgs);
              mensagens.push(...msgList);
            }
          } catch(e) {}
        }
        mensagens = mensagens.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
      }
      
      const status = {
        botStatus: !!botConfig,
        uptime: getUptime(),
        groupsCount: botConfig ? Object.keys(botConfig.chats || {}).length : 0,
        scriptsCount: listarScripts().length,
        botId: botConfig ? botConfig.id : null,
        botName: botConfig ? botConfig.nome : null,
        serverIp: serverIp,
        webPort: WEB_PORT,
        messages: mensagens
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status));
    } 
    else if (req.url === '/api/save-content' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          salvarConteudoEditavel(data.content);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch(e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
    }
    else if (req.url === '/api/load-content') {
      const content = carregarConteudoEditavel();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ content: content }));
    }
    else {
      // Servir arquivos estáticos
      let filePath = req.url === '/' ? '/index.html' : req.url;
      filePath = path.join(WEB_DIR, filePath);
      
      const ext = path.extname(filePath);
      const contentType = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json'
      }[ext] || 'text/plain';
      
      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(404);
          res.end('Arquivo não encontrado');
        } else {
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content);
        }
      });
    }
  });
  
  webServer.listen(WEB_PORT, () => {
    const networkInterfaces = os.networkInterfaces();
    let localIp = 'localhost';
    for (const interfaceName in networkInterfaces) {
      for (const iface of networkInterfaces[interfaceName]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          localIp = iface.address;
          break;
        }
      }
    }
    console.log(`${cores.green}✅ Web server iniciado com sucesso!${cores.reset}`);
    console.log(`${cores.cyan}   📍 Local: http://localhost:${WEB_PORT}${cores.reset}`);
    console.log(`${cores.cyan}   📍 Rede: http://${localIp}:${WEB_PORT}${cores.reset}`);
    console.log(`${cores.yellow}   💡 O dashboard é totalmente editável!${cores.reset}`);
  });
}

// Status do bot
async function mostrarStatus() {
  limparTela();
  mostrarTitulo();
  
  console.log(`${cores.cyan}┌─────────────────────────────────────────────────────────────┐${cores.reset}`);
  console.log(`${cores.cyan}│                    STATUS DO BOT                          │${cores.reset}`);
  console.log(`${cores.cyan}└─────────────────────────────────────────────────────────────┘${cores.reset}`);
  console.log();
  
  if (botConfig) {
    console.log(`${cores.green}✅ Bot autenticado${cores.reset}`);
    console.log(`${cores.cyan}📌 ID:${cores.reset} ${botConfig.id}`);
    console.log(`${cores.cyan}📛 Nome:${cores.reset} ${botConfig.nome}`);
    console.log(`${cores.cyan}📊 Grupos:${cores.reset} ${Object.keys(botConfig.chats || {}).length}`);
    console.log(`${cores.cyan}⏱️  Tempo ativo:${cores.reset} ${getUptime()}`);
    console.log(`${cores.cyan}🌐 Web Server:${cores.reset} ${webServer ? cores.green + 'Ativo na porta ' + WEB_PORT + cores.reset : cores.red + 'Inativo' + cores.reset}`);
    console.log();
    
    if (Object.keys(botConfig.chats || {}).length > 0) {
      console.log(`${cores.green}📋 Grupos disponíveis:${cores.reset}`);
      for (const g of Object.values(botConfig.chats)) {
        console.log(`  📌 ${g.nome} (${g.id})`);
      }
    }
    
    const scripts = listarScripts();
    console.log();
    console.log(`${cores.green}📜 Scripts disponíveis (${scripts.length}):${cores.reset}`);
    if (scripts.length > 0) {
      for (const script of scripts) {
        console.log(`  📄 ${script}`);
      }
    } else {
      console.log(`  ${cores.yellow}Nenhum script criado ainda${cores.reset}`);
    }
  } else {
    console.log(`${cores.red}❌ Nenhum bot autenticado!${cores.reset}`);
    console.log(`${cores.yellow}💡 Use a opção 1 para autenticar.${cores.reset}`);
  }
  
  await pausar();
}

// Gerenciar cargos
async function gerenciarCargos() {
  limparTela();
  mostrarTitulo();
  
  if (!botConfig) {
    console.log(`${cores.red}❌ Nenhum bot autenticado!${cores.reset}`);
    console.log(`${cores.yellow}💡 Use a opção 1 para autenticar primeiro.${cores.reset}`);
    await pausar();
    return;
  }
  
  console.log(`${cores.cyan}┌─────────────────────────────────────────────────────────────┐${cores.reset}`);
  console.log(`${cores.cyan}│                    GERENCIAR CARGOS                        │${cores.reset}`);
  console.log(`${cores.cyan}└─────────────────────────────────────────────────────────────┘${cores.reset}`);
  console.log();
  console.log(`${cores.yellow}⚠️ Funcionalidade em desenvolvimento...${cores.reset}`);
  console.log(`${cores.cyan}💡 Em breve: Criação e atribuição de cargos automática!${cores.reset}`);
  
  await pausar();
}

// Pausar
async function pausar() {
  await new Promise(resolve => {
    rl.question(`${cores.yellow}\nPressione ENTER para continuar...${cores.reset}`, resolve);
  });
}

// Menu principal
async function menuPrincipal() {
  while (true) {
    limparTela();
    mostrarTitulo();
    
    console.log(`${cores.cyan}┌─────────────────────────────────────────────────────────────┐${cores.reset}`);
    console.log(`${cores.cyan}│                         MENU                               │${cores.reset}`);
    console.log(`${cores.cyan}└─────────────────────────────────────────────────────────────┘${cores.reset}`);
    console.log();
    console.log(`${cores.green}1.${cores.reset} 🔐 ${botConfig ? 'Reautenticar Bot' : 'Autenticar Bot'}`);
    console.log(`${cores.green}2.${cores.reset} 📋 Listar Grupos`);
    console.log(`${cores.green}3.${cores.reset} 💬 Enviar Mensagem`);
    console.log(`${cores.green}4.${cores.reset} 👀 Monitorar Mensagens`);
    console.log(`${cores.green}5.${cores.reset} 📜 Gerenciar Scripts`);
    console.log(`${cores.green}6.${cores.reset} 👥 Gerenciar Cargos`);
    console.log(`${cores.green}7.${cores.reset} 🌐 Iniciar/Ver Web Dashboard`);
    console.log(`${cores.green}8.${cores.reset} ℹ️  Status do Bot`);
    console.log(`${cores.green}9.${cores.reset} 🚪 Sair`);
    console.log();
    
    const opcao = await new Promise(resolve => {
      rl.question(`${cores.yellow}👉 Escolha uma opção: ${cores.reset}`, resolve);
    });
    
    if (opcao === '1') {
      await autenticarBot();
    } else if (opcao === '2') {
      await listarGrupos();
    } else if (opcao === '3') {
      await enviarParaGrupo();
    } else if (opcao === '4') {
      await monitorarMensagens();
    } else if (opcao === '5') {
      await menuScripts();
    } else if (opcao === '6') {
      await gerenciarCargos();
    } else if (opcao === '7') {
      iniciarWebServer();
      await pausar();
    } else if (opcao === '8') {
      await mostrarStatus();
    } else if (opcao === '9') {
      console.log(`${cores.green}👋 Até logo!${cores.reset}`);
      if (webServer) webServer.close();
      process.exit(0);
    } else {
      console.log(`${cores.red}❌ Opção inválida!${cores.reset}`);
      await pausar();
    }
  }
}

// Carregar dados salvos
function carregarDados() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      botConfig = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      console.log(`${cores.green}✅ Dados carregados! Bot: ${botConfig.nome}${cores.reset}`);
    } catch(e) {}
  }
}

// Inicialização
console.clear();
console.log(`${cores.green}🚀 Iniciando BOT SYSTEM v2.0...${cores.reset}`);
console.log(`${cores.cyan}💡 Sistema totalmente funcional e estável${cores.reset}`);
console.log();
carregarDados();
initScriptsDir();

// Iniciar menu
setTimeout(() => {
  menuPrincipal();
}, 1000);