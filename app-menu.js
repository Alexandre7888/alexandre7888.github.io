// app-menu.js - Sistema de Menu em Grade de Pontos 4x4 para CodeHub
// Versão 1.0 - Menu de Aplicativos com Autenticação

class AppMenuGrid {
  constructor(options = {}) {
    this.containerId = options.containerId || 'app-menu-container';
    this.position = options.position || 'top-right';
    this.apps = options.apps || this.getDefaultApps();
    this.userKey = null;
    this.userData = null;
    this.isAuthenticated = false;
    this.menuVisible = false;
    this.init();
  }

  getDefaultApps() {
    return [
      { id: 'editor', name: 'Editor', icon: '📝', url: '/editor.html', color: '#4361ee' },
      { id: 'clock', name: 'Relógio', icon: '🕐', url: '/clock.html', color: '#f72585' },
      { id: 'compass', name: 'Bússola', icon: '🧭', url: '/compass.html', color: '#4cc9f0' },
      { id: 'notes', name: 'Notas', icon: '📋', url: '/notes.html', color: '#7209b7' },
      { id: 'calc', name: 'Calc', icon: '🔢', url: '/calc.html', color: '#f8961e' },
      { id: 'weather', name: 'Clima', icon: '🌤️', url: '/weather.html', color: '#43aa8b' },
      { id: 'tasks', name: 'Tarefas', icon: '✅', url: '/tasks.html', color: '#577590' },
      { id: 'chat', name: 'Chat', icon: '💬', url: '/chat.html', color: '#f94144' },
      { id: 'files', name: 'Arquivos', icon: '📁', url: '/files.html', color: '#90be6d' },
      { id: 'settings', name: 'Config', icon: '⚙️', url: '/settings.html', color: '#6c757d' },
      { id: 'profile', name: 'Perfil', icon: '👤', url: '/profile.html', color: '#277da1' },
      { id: 'help', name: 'Ajuda', icon: '❓', url: '/help.html', color: '#f9c74f' },
      { id: 'about', name: 'Sobre', icon: 'ℹ️', url: '/about.html', color: '#577590' },
      { id: 'logout', name: 'Sair', icon: '🚪', url: '#logout', color: '#e63946' },
    ];
  }

  async init() {
    await this.checkAuth();
    this.createMenuButton();
    this.createMenuGrid();
    this.loadStyles();
  }

  async checkAuth() {
    const token = localStorage.getItem('auth_token');
    const userId = localStorage.getItem('token_user_id');
    
    if (token && userId) {
      this.isAuthenticated = true;
      this.userKey = userId;
      
      try {
        // Buscar dados do usuário
        const { getDatabase, ref, get } = await import("https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js");
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js");
        
        const firebaseConfig = {
          apiKey: "AIzaSyDon4WbCbe4kCkUq-OdLBRhzhMaUObbAfo",
          authDomain: "html-15e80.firebaseapp.com",
          databaseURL: "https://html-15e80-default-rtdb.firebaseio.com",
          projectId: "html-15e80",
          storageBucket: "html-15e80.firebasestorage.app",
          messagingSenderId: "1068148640439",
          appId: "1:1068148640439:web:7cc5bde34f4c5a5ce41b32"
        };
        
        const app = initializeApp(firebaseConfig, 'appMenuApp');
        const database = getDatabase(app);
        
        const userRef = ref(database, 'users/' + userId);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
          this.userData = snapshot.val();
        }
      } catch (error) {
        console.error('Erro ao buscar dados do usuário:', error);
      }
    }
  }

  createMenuButton() {
    // Criar botão do menu (quadrado de pontos 4x4)
    const button = document.createElement('div');
    button.id = 'app-menu-button';
    button.style.cssText = `
      position: fixed;
      ${this.getPositionStyles()}
      width: 48px;
      height: 48px;
      background: rgba(20, 25, 45, 0.9);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      cursor: pointer;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      grid-template-rows: repeat(4, 1fr);
      gap: 3px;
      padding: 8px;
      z-index: 10000;
      border: 1px solid rgba(67, 97, 238, 0.3);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
      transition: all 0.3s ease;
    `;
    
    button.onmouseover = () => {
      button.style.transform = 'scale(1.1)';
      button.style.boxShadow = '0 12px 30px rgba(67, 97, 238, 0.4)';
    };
    
    button.onmouseout = () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.4)';
    };
    
    // Criar 16 pontos (4x4)
    for (let i = 0; i < 16; i++) {
      const dot = document.createElement('div');
      dot.style.cssText = `
        width: 100%;
        height: 100%;
        background: rgba(67, 97, 238, 0.8);
        border-radius: 50%;
        transition: all 0.3s ease;
      `;
      button.appendChild(dot);
    }
    
    button.onclick = () => this.toggleMenu();
    document.body.appendChild(button);
  }

  getPositionStyles() {
    const positions = {
      'top-right': 'top: 20px; right: 20px;',
      'top-left': 'top: 20px; left: 20px;',
      'bottom-right': 'bottom: 20px; right: 20px;',
      'bottom-left': 'bottom: 20px; left: 20px;',
      'top-center': 'top: 20px; left: 50%; transform: translateX(-50%);',
      'bottom-center': 'bottom: 20px; left: 50%; transform: translateX(-50%);',
    };
    return positions[this.position] || positions['top-right'];
  }

  createMenuGrid() {
    // Criar overlay
    const overlay = document.createElement('div');
    overlay.id = 'app-menu-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      z-index: 9999;
      display: none;
      justify-content: center;
      align-items: center;
      backdrop-filter: blur(5px);
    `;
    
    // Criar grid de apps
    const grid = document.createElement('div');
    grid.id = 'app-menu-grid';
    grid.style.cssText = `
      background: rgba(20, 25, 45, 0.95);
      border-radius: 20px;
      padding: 30px;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      max-width: 500px;
      width: 90%;
      border: 1px solid rgba(67, 97, 238, 0.3);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
      animation: slideIn 0.3s ease-out;
    `;
    
    // Adicionar apps
    this.apps.forEach(app => {
      const appItem = this.createAppItem(app);
      grid.appendChild(appItem);
    });
    
    // Adicionar info do usuário se autenticado
    if (this.isAuthenticated && this.userData) {
      const userInfo = document.createElement('div');
      userInfo.style.cssText = `
        grid-column: 1 / -1;
        text-align: center;
        color: white;
        padding: 10px;
        background: rgba(67, 97, 238, 0.2);
        border-radius: 10px;
        margin-bottom: 10px;
      `;
      userInfo.innerHTML = `
        <div style="font-weight: 600;">👋 ${this.userData.username || 'Usuário'}</div>
        <div style="font-size: 12px; opacity: 0.7;">${this.userData.email}</div>
      `;
      grid.insertBefore(userInfo, grid.firstChild);
    }
    
    overlay.appendChild(grid);
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        this.hideMenu();
      }
    };
    
    document.body.appendChild(overlay);
    
    // Adicionar animação
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: scale(0.9) translateY(-20px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }
    `;
    document.head.appendChild(style);
  }

  createAppItem(app) {
    const item = document.createElement('div');
    item.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 15px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
      text-align: center;
      min-height: 80px;
    `;
    
    item.onmouseover = () => {
      item.style.background = `${app.color}33`;
      item.style.transform = 'translateY(-3px)';
      item.style.boxShadow = `0 8px 20px ${app.color}33`;
    };
    
    item.onmouseout = () => {
      item.style.background = 'rgba(255, 255, 255, 0.05)';
      item.style.transform = 'translateY(0)';
      item.style.boxShadow = 'none';
    };
    
    item.innerHTML = `
      <div style="font-size: 28px; margin-bottom: 8px;">${app.icon}</div>
      <div style="color: white; font-size: 12px; font-weight: 500;">${app.name}</div>
    `;
    
    item.onclick = () => {
      if (app.id === 'logout') {
        this.logout();
      } else if (app.url.startsWith('#')) {
        // Ação interna
        this.handleAction(app.id);
      } else {
        window.location.href = app.url;
      }
    };
    
    return item;
  }

  toggleMenu() {
    const overlay = document.getElementById('app-menu-overlay');
    if (overlay) {
      if (this.menuVisible) {
        this.hideMenu();
      } else {
        this.showMenu();
      }
    }
  }

  showMenu() {
    const overlay = document.getElementById('app-menu-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
      this.menuVisible = true;
      
      // Animação dos pontos do botão
      const dots = document.querySelectorAll('#app-menu-button div');
      dots.forEach((dot, index) => {
        setTimeout(() => {
          dot.style.background = '#4cc9f0';
          setTimeout(() => {
            dot.style.background = 'rgba(67, 97, 238, 0.8)';
          }, 200);
        }, index * 30);
      });
    }
  }

  hideMenu() {
    const overlay = document.getElementById('app-menu-overlay');
    if (overlay) {
      overlay.style.display = 'none';
      this.menuVisible = false;
    }
  }

  logout() {
    if (confirm('Tem certeza que deseja sair?')) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('token_user_id');
      window.location.href = '/auth2.html';
    }
  }

  handleAction(actionId) {
    console.log('Ação:', actionId);
    this.hideMenu();
  }

  loadStyles() {
    // Estilos já incluídos inline, mas podemos adicionar mais se necessário
    console.log('✅ AppMenuGrid inicializado com sucesso!');
    console.log('📱 UserKey:', this.userKey);
    console.log('🔐 Autenticado:', this.isAuthenticated);
  }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.AppMenuGrid = AppMenuGrid;
  
  // Auto-inicializar se configurado
  window.addEventListener('DOMContentLoaded', () => {
    // Verificar se deve inicializar automaticamente
    const autoInit = document.querySelector('[data-app-menu="auto"]');
    if (autoInit) {
      const position = autoInit.getAttribute('data-position') || 'top-right';
      new AppMenuGrid({ position: position });
    }
  });
}

// Suporte a módulos ES6
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AppMenuGrid;
}