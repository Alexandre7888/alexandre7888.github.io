#!/usr/bin/env node

const https = require('https');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Configuração
const FIREBASE_URL = 'https://html-785e3-default-rtdb.firebaseio.com';
const DATA_FILE = 'bot_data.json';

let botConfig = null;
let monitorando = false;

// Cores para terminal
const cores = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Interface readline
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

// Mostrar título
function titulo() {
  console.log(`${cores.blue}════════════════════════════════════════════════════════════${cores.reset}`);
  console.log(`${cores.magenta}                    🤖 BOT SYSTEM v1.0${cores.reset}`);
  console.log(`${cores.blue}════════════════════════════════════════════════════════════${cores.reset}`);
  console.log();
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
        // Buscar dados do bot
        const userData = await request(`${FIREBASE_URL}/users/${botId}.json`);
        
        if (!userData) {
          console.log(`${cores.red}❌ Bot não encontrado!${cores.reset}`);
          setTimeout(() => resolve(false), 1500);
          return;
        }
        
        // Buscar grupos do bot
        const chats = {};
        if (userData.chats) {
          for (const [chatId, chatData] of Object.entries(userData.chats)) {
            try {
              const grupo = await request(`${FIREBASE_URL}/groups/${chatId}.json`);
              chats[chatId] = {
                id: chatId,
                nome: grupo?.nome || chatData.name || chatId,
                tipo: chatData.type || 'group'
              };
            } catch(e) {
              chats[chatId] = { id: chatId, nome: chatId, tipo: 'group' };
            }
          }
        }
        
        botConfig = {
          id: botId,
          nome: userData.name || botId,
          chats: chats,
          userData: userData
        };
        
        // Salvar dados
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
    console.log();
    console.log(`${cores.cyan}💡 Para adicionar o bot a um grupo:${cores.reset}`);
    console.log(`   Use o ID do bot: ${cores.green}${botConfig?.id || 'autentique primeiro'}${cores.reset}`);
    await pausar();
    return;
  }
  
  const grupos = Object.values(botConfig.chats);
  for (let i = 0; i < grupos.length; i++) {
    const g = grupos[i];
    console.log(`${cores.green}${i + 1}.${cores.reset} ${cores.cyan}${g.nome}${cores.reset}`);
    console.log(`   ID: ${g.id}`);
    console.log(`   Tipo: ${g.tipo}`);
    console.log();
  }
  
  await pausar();
}

// Selecionar grupo e enviar mensagem
async function enviarParaGrupo() {
  limparTela();
  titulo();
  
  if (!botConfig || !botConfig.chats || Object.keys(botConfig.chats).length === 0) {
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
        }
        setTimeout(() => {}, 1500);
      });
    } else {
      console.log(`${cores.red}❌ Opção inválida!${cores.reset}`);
      setTimeout(() => {}, 1000);
    }
  });
}

// Monitorar mensagens
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
      monitorando = true;
      
      limparTela();
      titulo();
      console.log(`${cores.green}📡 Monitorando: ${grupo.nome}${cores.reset}`);
      console.log(`${cores.yellow}⚠️ Pressione CTRL+C para parar${cores.reset}`);
      console.log(`${cores.blue}════════════════════════════════════════════════════════════${cores.reset}`);
      console.log();
      
      let ultimoTimestamp = 0;
      
      const interval = setInterval(async () => {
        try {
          const mensagens = await request(`${FIREBASE_URL}/groups/${grupo.id}/messages.json`);
          
          if (mensagens) {
            const msgs = Object.values(mensagens);
            const novas = msgs.filter(m => m.timestamp > ultimoTimestamp && m.senderId !== botConfig.id);
            
            for (const msg of novas) {
              const hora = new Date(msg.timestamp).toLocaleTimeString();
              console.log(`${cores.gray}[${hora}]${cores.reset} ${cores.cyan}${msg.senderName}:${cores.reset} ${msg.text}`);
              ultimoTimestamp = msg.timestamp;
            }
          }
        } catch(e) {}
      }, 3000);
      
      process.on('SIGINT', () => {
        clearInterval(interval);
        monitorando = false;
        console.log(`\n${cores.yellow}👋 Monitoramento encerrado!${cores.reset}`);
        setTimeout(() => {}, 1000);
      });
    }
  });
}

// Status
async function mostrarStatus() {
  limparTela();
  titulo();
  
  console.log(`${cores.cyan}┌─────────────────────────────────────────────────────────────┐${cores.reset}`);
  console.log(`${cores.cyan}│                    STATUS DO BOT                          │${cores.reset}`);
  console.log(`${cores.cyan}└─────────────────────────────────────────────────────────────┘${cores.reset}`);
  console.log();
  
  if (botConfig) {
    console.log(`${cores.green}✅ Bot autenticado${cores.reset}`);
    console.log(`${cores.cyan}ID:${cores.reset} ${botConfig.id}`);
    console.log(`${cores.cyan}Nome:${cores.reset} ${botConfig.nome}`);
    console.log(`${cores.cyan}Grupos:${cores.reset} ${Object.keys(botConfig.chats || {}).length}`);
    console.log();
    console.log(`${cores.green}📊 Grupos disponíveis:${cores.reset}`);
    for (const g of Object.values(botConfig.chats || {})) {
      console.log(`  📌 ${g.nome}`);
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

// Menu principal
async function menuPrincipal() {
  while (true) {
    limparTela();
    titulo();
    
    if (botConfig) {
      console.log(`${cores.green}✅ Bot: ${botConfig.nome}${cores.reset}`);
    } else {
      console.log(`${cores.red}❌ Nenhum bot autenticado${cores.reset}`);
    }
    
    console.log();
    console.log(`${cores.cyan}════════════════════════════════════════════════════════════${cores.reset}`);
    console.log(`${cores.green}1.${cores.reset} 🔐 Autenticar Bot`);
    console.log(`${cores.green}2.${cores.reset} 📋 Listar Grupos`);
    console.log(`${cores.green}3.${cores.reset} 💬 Enviar Mensagem`);
    console.log(`${cores.green}4.${cores.reset} 👀 Monitorar Mensagens`);
    console.log(`${cores.green}5.${cores.reset} ℹ️  Status`);
    console.log(`${cores.green}6.${cores.reset} 🚪 Sair`);
    console.log(`${cores.cyan}════════════════════════════════════════════════════════════${cores.reset}`);
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
      await mostrarStatus();
    } else if (opcao === '6') {
      console.log(`${cores.green}👋 Até logo!${cores.reset}`);
      process.exit(0);
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

// Iniciar
console.log(`${cores.green}🚀 Iniciando BOT SYSTEM...${cores.reset}`);
carregarDados();
menuPrincipal();