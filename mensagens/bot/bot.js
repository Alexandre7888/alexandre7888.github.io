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
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bold: '\x1b[1m'
};

// Interface readline melhorada com suporte a setas
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Configurar input para capturar setas
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

let currentMenu = 'main';
let menuOptions = [];
let selectedIndex = 0;

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

// Mostrar título melhorado
function titulo() {
  const uptime = getUptime();
  console.log(`${cores.blue}╔══════════════════════════════════════════════════════════════════╗${cores.reset}`);
  console.log(`${cores.blue}║${cores.reset}${cores.bgBlue}${cores.white}                    🤖 BOT SYSTEM v2.0 - ${botConfig ? botConfig.nome : 'DESCONECTADO'}                    ${cores.reset}${cores.blue}║${cores.reset}`);
  console.log(`${cores.blue}╠══════════════════════════════════════════════════════════════════╣${cores.reset}`);
  console.log(`${cores.blue}║${cores.reset} ${cores.cyan}📊 Status:${cores.reset} ${botConfig ? cores.green + 'ONLINE' + cores.reset : cores.red + 'OFFLINE' + cores.reset}    ${cores.cyan}⏱️  Ativo há:${cores.reset} ${uptime}    ${cores.cyan}📡 Web Server:${cores.reset} ${webServer ? cores.green + 'ON' + cores.reset : cores.red + 'OFF' + cores.reset}${cores.blue}║${cores.reset}`);
  console.log(`${cores.blue}╚══════════════════════════════════════════════════════════════════╝${cores.reset}`);
  console.log();
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

// Autenticar bot
async function autenticarBot() {
  limparTela();
  titulo();
  
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
          roles: {}
        };
        
        fs.writeFileSync(DATA_FILE, JSON.stringify(botConfig, null, 2));
        
        console.log(`${cores.green}✅ Autenticado: ${botConfig.nome}${cores.reset}`);
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

// Executar script JavaScript
async function executarScript(scriptPath, grupoId) {
  try {
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    const scriptFunction = new Function('bot', 'grupoId', 'enviarMensagem', 'request', 'console', scriptContent);
    
    await scriptFunction(botConfig, grupoId, enviarMensagem, request, console);
    console.log(`${cores.green}✅ Script executado com sucesso!${cores.reset}`);
    return true;
  } catch (error) {
    console.log(`${cores.red}❌ Erro ao executar script: ${error.message}${cores.reset}`);
    return false;
  }
}

// Criar cargo
async function criarCargo(grupoId, cargoNome, permissoes = {}) {
  const cargoId = `role_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  
  const cargo = {
    nome: cargoNome,
    permissoes: permissoes,
    membros: [],
    criado: Date.now()
  };
  
  await request(`${FIREBASE_URL}/groups/${grupoId}/roles/${cargoId}.json`, 'PUT', cargo);
  
  if (!botConfig.roles[grupoId]) botConfig.roles[grupoId] = {};
  botConfig.roles[grupoId][cargoId] = cargo;
  
  fs.writeFileSync(DATA_FILE, JSON.stringify(botConfig, null, 2));
  
  console.log(`${cores.green}✅ Cargo "${cargoNome}" criado com sucesso!${cores.reset}`);
  return cargoId;
}

// Atribuir cargo a usuário
async function atribuirCargo(grupoId, userId, cargoId) {
  try {
    const grupo = await request(`${FIREBASE_URL}/groups/${grupoId}.json`);
    if (!grupo || !grupo.members || !grupo.members[userId]) {
      console.log(`${cores.red}❌ Usuário não encontrado no grupo!${cores.reset}`);
      return false;
    }
    
    await request(`${FIREBASE_URL}/groups/${grupoId}/members/${userId}/cargos/${cargoId}.json`, 'PUT', true);
    
    if (botConfig.roles[grupoId] && botConfig.roles[grupoId][cargoId]) {
      if (!botConfig.roles[grupoId][cargoId].membros.includes(userId)) {
        botConfig.roles[grupoId][cargoId].membros.push(userId);
        fs.writeFileSync(DATA_FILE, JSON.stringify(botConfig, null, 2));
      }
    }
    
    console.log(`${cores.green}✅ Cargo atribuído com sucesso!${cores.reset}`);
    return true;
  } catch (error) {
    console.log(`${cores.red}❌ Erro ao atribuir cargo: ${error.message}${cores.reset}`);
    return false;
  }
}

// Listar membros do grupo
async function listarMembros(grupoId) {
  try {
    const grupo = await request(`${FIREBASE_URL}/groups/${grupoId}.json`);
    if (!grupo || !grupo.members) return [];
    
    const membros = [];
    for (const [userId, userData] of Object.entries(grupo.members)) {
      membros.push({
        id: userId,
        nome: userData.name || userId,
        cargos: userData.cargos || {}
      });
    }
    return membros;
  } catch (error) {
    return [];
  }
}

// Criar script personalizado
function criarScript() {
  limparTela();
  titulo();
  
  console.log(`${cores.cyan}┌─────────────────────────────────────────────────────────────┐${cores.reset}`);
  console.log(`${cores.cyan}│                    CRIAR SCRIPT JS                         │${cores.reset}`);
  console.log(`${cores.cyan}└─────────────────────────────────────────────────────────────┘${cores.reset}`);
  console.log();
  
  if (!fs.existsSync(SCRIPTS_DIR)) {
    fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
  }
  
  rl.question(`${cores.yellow}📝 Nome do script (ex: meu_script.js): ${cores.reset}`, (nome) => {
    if (!nome) {
      console.log(`${cores.red}❌ Nome inválido!${cores.reset}`);
      setTimeout(() => {}, 1500);
      return;
    }
    
    const scriptPath = path.join(SCRIPTS_DIR, nome);
    const template = `// Script personalizado para BOT SYSTEM
// Use as variáveis disponíveis: bot, grupoId, enviarMensagem, request

async function main() {
    console.log("📢 Script iniciado!");
    
    // Exemplo: Enviar mensagem
    await enviarMensagem(grupoId, "Olá! Este é um script automático!");
    
    // Exemplo: Buscar dados
    const data = await request(\`https://api.exemplo.com/dados.json\`);
    
    // Seu código aqui...
    
    console.log("✅ Script finalizado!");
}

main().catch(console.error);`;
    
    fs.writeFileSync(scriptPath, template);
    console.log(`${cores.green}✅ Script criado em: ${scriptPath}${cores.reset}`);
    setTimeout(() => {}, 2000);
  });
}

// Listar scripts disponíveis
function listarScripts() {
  if (!fs.existsSync(SCRIPTS_DIR)) {
    return [];
  }
  return fs.readdirSync(SCRIPTS_DIR).filter(file => file.endsWith('.js'));
}

// Menu de seleção com setas
function renderMenu(title, options) {
  limparTela();
  titulo();
  
  console.log(`${cores.cyan}┌─────────────────────────────────────────────────────────────┐${cores.reset}`);
  console.log(`${cores.cyan}│${cores.reset} ${cores.bold}${title}${cores.reset}${' '.repeat(55 - title.length)}${cores.cyan}│${cores.reset}`);
  console.log(`${cores.cyan}└─────────────────────────────────────────────────────────────┘${cores.reset}`);
  console.log();
  
  for (let i = 0; i < options.length; i++) {
    const prefix = i === selectedIndex ? `${cores.green}▶${cores.reset}` : ' ';
    console.log(`${prefix} ${options[i]}`);
  }
  
  console.log();
  console.log(`${cores.gray}↑/↓ - Navegar | Enter - Selecionar | ESC - Voltar${cores.reset}`);
}

// Iniciar servidor web
function iniciarWebServer() {
  if (webServer) return;
  
  const html = `<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BOT SYSTEM Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
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
        }
        .header h1 {
            font-size: 3em;
            margin-bottom: 10px;
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
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 BOT SYSTEM Dashboard</h1>
            <p>Painel de controle do seu bot</p>
        </div>
        
        <div class="stats">
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
        
        <div class="info">
            <h2>📊 Informações do Bot</h2>
            <div class="info-item"><strong>ID:</strong> <span id="botId">-</span></div>
            <div class="info-item"><strong>Nome:</strong> <span id="botName">-</span></div>
            <div class="info-item"><strong>IP do Servidor:</strong> <span id="serverIp">-</span></div>
            <div class="info-item"><strong>Porta Web:</strong> <span id="webPort">${WEB_PORT}</span></div>
        </div>
        
        <div class="info">
            <h2>🔧 Comandos Rápidos</h2>
            <div class="info-item"><strong>Status:</strong> Ver informações do bot</div>
            <div class="info-item"><strong>Grupos:</strong> Listar todos os grupos</div>
            <div class="info-item"><strong>Scripts:</strong> Gerenciar scripts</div>
        </div>
    </div>
    
    <script>
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
            } catch(e) {
                console.error('Erro ao atualizar:', e);
            }
        }
        
        atualizarDados();
        setInterval(atualizarDados, 5000);
    </script>
</body>
</html>`;
  
  webServer = http.createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } else if (req.url === '/api/status') {
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
      
      const status = {
        botStatus: !!botConfig,
        uptime: getUptime(),
        groupsCount: botConfig ? Object.keys(botConfig.chats || {}).length : 0,
        scriptsCount: listarScripts().length,
        botId: botConfig ? botConfig.id : null,
        botName: botConfig ? botConfig.nome : null,
        serverIp: serverIp,
        webPort: WEB_PORT
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status));
    } else {
      res.writeHead(404);
      res.end();
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
    console.log(`${cores.green}✅ Web server iniciado em:${cores.reset}`);
    console.log(`${cores.cyan}   Local: http://localhost:${WEB_PORT}${cores.reset}`);
    console.log(`${cores.cyan}   Rede: http://${localIp}:${WEB_PORT}${cores.reset}`);
  });
}

// Menu de scripts
async function menuScripts() {
  currentMenu = 'scripts';
  const scripts = listarScripts();
  const options = [...scripts.map(s => `📜 ${s}`), '➕ Criar novo script', '🔙 Voltar'];
  
  while (currentMenu === 'scripts') {
    renderMenu('GERENCIAR SCRIPTS', options);
    
    const key = await new Promise(resolve => {
      const handler = (chunk, key) => {
        if (key.name === 'up') resolve('up');
        else if (key.name === 'down') resolve('down');
        else if (key.name === 'return') resolve('select');
        else if (key.name === 'escape') resolve('escape');
        else resolve(null);
      };
      process.stdin.once('keypress', handler);
    });
    
    if (key === 'up') selectedIndex = (selectedIndex - 1 + options.length) % options.length;
    else if (key === 'down') selectedIndex = (selectedIndex + 1) % options.length;
    else if (key === 'select') {
      if (selectedIndex === options.length - 1) {
        currentMenu = 'main';
      } else if (selectedIndex === options.length - 2) {
        criarScript();
        setTimeout(() => renderMenu('GERENCIAR SCRIPTS', options), 2000);
      } else if (selectedIndex < scripts.length) {
        if (!botConfig || Object.keys(botConfig.chats).length === 0) {
          console.log(`${cores.red}❌ Autentique um bot primeiro!${cores.reset}`);
          setTimeout(() => {}, 1500);
        } else {
          const grupos = Object.values(botConfig.chats);
          console.log(`${cores.yellow}Selecione o grupo para executar o script:${cores.reset}`);
          for (let i = 0; i < grupos.length; i++) {
            console.log(`${i + 1}. ${grupos[i].nome}`);
          }
          rl.question(`${cores.yellow}Opção: ${cores.reset}`, async (opt) => {
            const idx = parseInt(opt) - 1;
            if (idx >= 0 && idx < grupos.length) {
              await executarScript(path.join(SCRIPTS_DIR, scripts[selectedIndex]), grupos[idx].id);
            }
            setTimeout(() => renderMenu('GERENCIAR SCRIPTS', options), 2000);
          });
        }
      }
    } else if (key === 'escape') {
      currentMenu = 'main';
    }
  }
  selectedIndex = 0;
}

// Menu principal interativo
async function menuPrincipal() {
  currentMenu = 'main';
  const options = [
    `${botConfig ? '🔄' : '🔐'} ${botConfig ? 'Reautenticar Bot' : 'Autenticar Bot'}`,
    '📋 Listar Grupos',
    '💬 Enviar Mensagem',
    '👀 Monitorar Mensagens',
    '📜 Gerenciar Scripts',
    '👥 Gerenciar Cargos',
    '🌐 Iniciar Web Server',
    'ℹ️ Status do Bot',
    '🚪 Sair'
  ];
  
  while (currentMenu === 'main') {
    renderMenu('MENU PRINCIPAL', options);
    
    const key = await new Promise(resolve => {
      const handler = (chunk, key) => {
        if (key.name === 'up') resolve('up');
        else if (key.name === 'down') resolve('down');
        else if (key.name === 'return') resolve('select');
        else if (key.name === 'escape') resolve('exit');
        else resolve(null);
      };
      process.stdin.once('keypress', handler);
    });
    
    if (key === 'up') selectedIndex = (selectedIndex - 1 + options.length) % options.length;
    else if (key === 'down') selectedIndex = (selectedIndex + 1) % options.length;
    else if (key === 'select') {
      switch(selectedIndex) {
        case 0:
          await autenticarBot();
          options[0] = `${botConfig ? '🔄' : '🔐'} ${botConfig ? 'Reautenticar Bot' : 'Autenticar Bot'}`;
          break;
        case 1:
          await listarGrupos();
          break;
        case 2:
          await enviarParaGrupo();
          break;
        case 3:
          await monitorarMensagens();
          break;
        case 4:
          await menuScripts();
          break;
        case 5:
          await menuCargos();
          break;
        case 6:
          iniciarWebServer();
          await pausar();
          break;
        case 7:
          await mostrarStatus();
          break;
        case 8:
          console.log(`${cores.green}👋 Até logo!${cores.reset}`);
          if (webServer) webServer.close();
          process.exit(0);
      }
    } else if (key === 'exit') {
      if (webServer) webServer.close();
      process.exit(0);
    }
  }
}

// Menu de cargos
async function menuCargos() {
  if (!botConfig) {
    console.log(`${cores.red}❌ Autentique um bot primeiro!${cores.reset}`);
    await pausar();
    return;
  }
  
  limparTela();
  titulo();
  
  console.log(`${cores.cyan}┌─────────────────────────────────────────────────────────────┐${cores.reset}`);
  console.log(`${cores.cyan}│                    GERENCIAR CARGOS                         │${cores.reset}`);
  console.log(`${cores.cyan}└─────────────────────────────────────────────────────────────┘${cores.reset}`);
  console.log();
  
  const grupos = Object.values(botConfig.chats);
  if (grupos.length === 0) {
    console.log(`${cores.yellow}⚠️ Nenhum grupo disponível!${cores.reset}`);
    await pausar();
    return;
  }
  
  console.log(`${cores.yellow}Selecione o grupo:${cores.reset}`);
  for (let i = 0; i < grupos.length; i++) {
    console.log(`${i + 1}. ${grupos[i].nome}`);
  }
  console.log();
  
  rl.question(`${cores.yellow}Opção: ${cores.reset}`, async (opt) => {
    const idx = parseInt(opt) - 1;
    if (idx >= 0 && idx < grupos.length) {
      const grupo = grupos[idx];
      
      console.log(`\n${cores.cyan}1. Criar novo cargo${cores.reset}`);
      console.log(`${cores.cyan}2. Listar cargos${cores.reset}`);
      console.log(`${cores.cyan}3. Atribuir cargo a usuário${cores.reset}`);
      console.log();
      
      rl.question(`${cores.yellow}Escolha: ${cores.reset}`, async (op) => {
        if (op === '1') {
          rl.question(`${cores.yellow}Nome do cargo: ${cores.reset}`, async (cargoNome) => {
            if (cargoNome) {
              await criarCargo(grupo.id, cargoNome);
            }
            setTimeout(() => {}, 2000);
          });
        } else if (op === '2') {
          const grupoData = await request(`${FIREBASE_URL}/groups/${grupo.id}/roles.json`);
          if (grupoData) {
            console.log(`\n${cores.green}Cargos disponíveis:${cores.reset}`);
            for (const [cargoId, cargo] of Object.entries(grupoData)) {
              console.log(`📌 ${cargo.nome} - Membros: ${cargo.membros?.length || 0}`);
            }
          } else {
            console.log(`${cores.yellow}Nenhum cargo criado ainda!${cores.reset}`);
          }
          await pausar();
        } else if (op === '3') {
          const membros = await listarMembros(grupo.id);
          if (membros.length === 0) {
            console.log(`${cores.yellow}Nenhum membro encontrado!${cores.reset}`);
            await pausar();
            return;
          }
          
          console.log(`\n${cores.yellow}Membros do grupo:${cores.reset}`);
          for (let i = 0; i < membros.length; i++) {
            console.log(`${i + 1}. ${membros[i].nome}`);
          }
          
          rl.question(`\n${cores.yellow}Selecione o membro: ${cores.reset}`, async (membroOpt) => {
            const membroIdx = parseInt(membroOpt) - 1;
            if (membroIdx >= 0 && membroIdx < membros.length) {
              const grupoData = await request(`${FIREBASE_URL}/groups/${grupo.id}/roles.json`);
              if (grupoData) {
                const cargos = Object.entries(grupoData);
                console.log(`\n${cores.yellow}Cargos disponíveis:${cores.reset}`);
                for (let i = 0; i < cargos.length; i++) {
                  console.log(`${i + 1}. ${cargos[i][1].nome}`);
                }
                
                rl.question(`\n${cores.yellow}Selecione o cargo: ${cores.reset}`, async (cargoOpt) => {
                  const cargoIdx = parseInt(cargoOpt) - 1;
                  if (cargoIdx >= 0 && cargoIdx < cargos.length) {
                    await atribuirCargo(grupo.id, membros[membroIdx].id, cargos[cargoIdx][0]);
                  }
                  setTimeout(() => {}, 2000);
                });
              } else {
                console.log(`${cores.yellow}Nenhum cargo criado!${cores.reset}`);
                setTimeout(() => {}, 1500);
              }
            }
          });
        }
      });
    }
  });
}

// Listar grupos
async function listarGrupos() {
  limparTela();
  titulo();
  
  console.log(`${cores.cyan}┌─────────────────────────────────────────────────────────────┐${cores.reset}`);
  console.log(`${cores.cyan}│                    SEUS GRUPOS                            │${cores.reset}`);
  console.log(`${cores.cyan}└─────────────────────────────────────────────────────────────┘${cores.reset}`);
  console.log();
  
  if (!botConfig || !botConfig.chats || Object.keys(botConfig.chats).length === 0) {
    console.log(`${cores.yellow}⚠️ Nenhum grupo encontrado!${cores.reset}`);
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

// Enviar para grupo
async function enviarParaGrupo() {
  if (!botConfig || !botConfig.chats || Object.keys(botConfig.chats).length === 0) {
    console.log(`${cores.yellow}⚠️ Nenhum grupo disponível!${cores.reset}`);
    await pausar();
    return;
  }
  
  const grupos = Object.values(botConfig.chats);
  
  limparTela();
  titulo();
  
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
        }
        setTimeout(() => {}, 1500);
      });
    } else {
      console.log(`${cores.red}❌ Opção inválida!${cores.reset}`);
      setTimeout(() => {}, 1000);
    }
  });
}

// Monitorar mensagens melhorado
async function monitorarMensagens() {
  if (!botConfig || !botConfig.chats || Object.keys(botConfig.chats).length === 0) {
    console.log(`${cores.yellow}⚠️ Nenhum grupo disponível!${cores.reset}`);
    await pausar();
    return;
  }
  
  const grupos = Object.values(botConfig.chats);
  
  limparTela();
  titulo();
  
  console.log(`${cores.cyan}┌─────────────────────────────────────────────────────────────┐${cores.reset}`);
  console.log(`${cores.cyan}│                    MONITORAR GRUPO                         │${cores.reset}`);
  console.log(`${cores.cyan}└─────────────────────────────────────────────────────────────┘${cores.reset}`);
  console.log();
  
  for (let i = 0; i < grupos.length; i++) {
    console.log(`${cores.green}${i + 1}.${cores.reset} ${grupos[i].nome}`);
  }
  console.log();
  
  rl.question(`${cores.yellow}👉 Escolha o grupo: ${cores.reset}`, async (opcao) => {
    const idx = parseInt(opcao) - 1;
    if (idx >= 0 && idx < grupos.length) {
      const grupo = grupos[idx];
      
      limparTela();
      titulo();
      console.log(`${cores.green}📡 Monitorando: ${grupo.nome}${cores.reset}`);
      console.log(`${cores.yellow}⚠️ Pressione CTRL+C para parar${cores.reset}`);
      console.log(`${cores.blue}════════════════════════════════════════════════════════════${cores.reset}`);
      console.log();
      
      let ultimoTimestamp = 0;
      const mensagensExibidas = new Set();
      
      const interval = setInterval(async () => {
        try {
          const mensagens = await request(`${FIREBASE_URL}/groups/${grupo.id}/messages.json`);
          
          if (mensagens) {
            const msgs = Object.entries(mensagens)
              .map(([id, msg]) => ({ id, ...msg }))
              .sort((a, b) => a.timestamp - b.timestamp);
            
            for (const msg of msgs) {
              if (msg.timestamp > ultimoTimestamp && msg.senderId !== botConfig.id && !mensagensExibidas.has(msg.id)) {
                const hora = new Date(msg.timestamp).toLocaleTimeString();
                const data = new Date(msg.timestamp).toLocaleDateString();
                console.log(`${cores.gray}[${data} ${hora}]${cores.reset} ${cores.cyan}${msg.senderName}:${cores.reset} ${msg.text}`);
                mensagensExibidas.add(msg.id);
                ultimoTimestamp = msg.timestamp;
              }
            }
          }
        } catch(e) {}
      }, 2000);
      
      activeMonitors[grupo.id] = interval;
      
      process.on('SIGINT', () => {
        if (activeMonitors[grupo.id]) {
          clearInterval(activeMonitors[grupo.id]);
          delete activeMonitors[grupo.id];
        }
        console.log(`\n${cores.yellow}👋 Monitoramento de ${grupo.nome} encerrado!${cores.reset}`);
        setTimeout(() => menuPrincipal(), 1000);
      });
    }
  });
}

// Mostrar status detalhado
async function mostrarStatus() {
  limparTela();
  titulo();
  
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
    console.log(`${cores.cyan}🌐 Web Server:${cores.reset} ${webServer ? cores.green + 'Ativo' + cores.reset : cores.red + 'Inativo' + cores.reset}`);
    console.log();
    
    console.log(`${cores.green}📋 Grupos disponíveis:${cores.reset}`);
    for (const g of Object.values(botConfig.chats || {})) {
      console.log(`  📌 ${g.nome} (${g.id})`);
    }
    
    const scripts = listarScripts();
    console.log();
    console.log(`${cores.green}📜 Scripts disponíveis (${scripts.length}):${cores.reset}`);
    for (const script of scripts) {
      console.log(`  📄 ${script}`);
    }
  } else {
    console.log(`${cores.red}❌ Nenhum bot autenticado!${cores.reset}`);
  }
  
  await pausar();
}

// Pausar
async function pausar() {
  await new Promise(resolve => {
    rl.question(`${cores.yellow}\nPressione ENTER para continuar...${cores.reset}`, resolve);
  });
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

// Iniciar
console.clear();
console.log(`${cores.green}🚀 Iniciando BOT SYSTEM v2.0...${cores.reset}`);
console.log(`${cores.cyan}💡 Use as setas ↑/↓ para navegar nos menus${cores.reset}`);
console.log();
carregarDados();
setTimeout(() => menuPrincipal(), 2000);