// app-shell.js v3.1.0 - Menu com botão de fechar no mobile + Notificações
(function () {
  "use strict";

  const WORKER_URL = window.WORKER_URL || "https://proud-flower-677b.braatzjunioralexandre5.workers.dev";

  const STYLES = `
    /* =========================================
       GAVETAS LATERAIS
       ========================================= */
    .app-shell-tab-left, .app-shell-tab-right {
      position: fixed;
      top: 50%;
      transform: translateY(-50%);
      width: 260px;
      background: rgba(10, 15, 28, 0.95);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid #1f2a44;
      padding: 20px 12px;
      z-index: 2000;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      flex-direction: column;
      box-shadow: 0 0 30px rgba(0, 0, 0, 0.5);
    }

    /* --- Gaveta Esquerda --- */
    .app-shell-tab-left {
      left: 0;
      transform: translateY(-50%) translateX(-100%);
      border-left: none;
      border-radius: 0 16px 16px 0;
    }
    .app-shell-tab-left::after {
      content: '>';
      position: absolute;
      right: -28px;
      top: 50%;
      transform: translateY(-50%);
      width: 28px;
      height: 60px;
      background: rgba(10, 15, 28, 0.95);
      border: 1px solid #1f2a44;
      border-left: none;
      border-radius: 0 12px 12px 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #4f8cff;
      font-weight: 900;
      font-size: 14px;
      cursor: pointer;
      transition: 0.2s;
    }

    /* --- Gaveta Direita --- */
    .app-shell-tab-right {
      right: 0;
      transform: translateY(-50%) translateX(100%);
      border-right: none;
      border-radius: 16px 0 0 16px;
      align-items: center;
    }
    .app-shell-tab-right::before {
      content: '<';
      position: absolute;
      left: -28px;
      top: 50%;
      transform: translateY(-50%);
      width: 28px;
      height: 60px;
      background: rgba(10, 15, 28, 0.95);
      border: 1px solid #1f2a44;
      border-right: none;
      border-radius: 12px 0 0 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #4f8cff;
      font-weight: 900;
      font-size: 14px;
      cursor: pointer;
      transition: 0.2s;
    }

    /* --- Desktop (Hover) --- */
    @media (hover: hover) {
      .app-shell-tab-left:hover { transform: translateY(-50%) translateX(0); }
      .app-shell-tab-right:hover { transform: translateY(-50%) translateX(0); }
      .app-shell-tab-left:hover::after, .app-shell-tab-right:hover::before { background: #4f8cff; color: #fff; border-color: #4f8cff; }
      .app-shell-close-btn { display: none !important; } /* Esconde o X no PC */
    }

    /* --- Mobile (Clique) --- */
    @media (hover: none) {
      .app-shell-tab-left.mobile-open { transform: translateY(-50%) translateX(0); }
      .app-shell-tab-right.mobile-open { transform: translateY(-50%) translateX(0); }
      .app-shell-tab-left.mobile-open::after { content: '<'; }
      .app-shell-tab-right.mobile-open::before { content: '>'; }
    }

    /* =========================================
       CONTEÚDO INTERNO
       ========================================= */
    .app-shell-menu-header { 
      border-bottom: 1px solid #1f2a44; padding-bottom: 12px; margin-bottom: 12px; 
      text-align: center; position: relative;
    }
    .app-shell-menu-header h2 { color: #e8eef8; font-size: 1.2rem; font-weight: 700; }
    .app-shell-menu-header p { color: #8fa0bd; font-size: 0.7rem; letter-spacing: 1px; }

    /* Botão X para fechar no celular */
    .app-shell-close-btn {
      display: flex; position: absolute; top: -5px; right: -5px;
      background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3);
      width: 30px; height: 30px; border-radius: 50%; align-items: center; justify-content: center;
      font-size: 18px; font-weight: bold; cursor: pointer;
    }
    
    .app-shell-item {
      display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 16px;
      border-radius: 12px; background: transparent; border: none; color: #e8eef8;
      font-size: 0.95rem; font-weight: 500; cursor: pointer; text-align: left; font-family: inherit;
      transition: background 0.2s;
    }
    .app-shell-item:hover { background: rgba(79, 140, 255, 0.1); }
    .app-shell-item.active { background: rgba(79, 140, 255, 0.15); border-left: 3px solid #4f8cff; }
    .app-shell-item .icon svg { width: 20px; height: 20px; stroke: #4f8cff; fill: none; stroke-width: 2; }

    /* TEMAS */
    .app-shell-themes { display: flex; gap: 6px; margin-top: auto; padding-top: 16px; border-top: 1px solid #1f2a44; }
    .app-theme-btn {
      flex: 1; padding: 8px 0; border-radius: 8px; background: rgba(255,255,255,0.05);
      border: 1px solid transparent; color: #8fa0bd; cursor: pointer; font-size: 0.75rem;
      display: flex; align-items: center; justify-content: center; gap: 4px; transition: 0.2s;
      font-family: inherit;
    }
    .app-theme-btn svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 2; }
    .app-theme-btn:hover { background: rgba(79, 140, 255, 0.15); color: #e8eef8; }
    .app-theme-btn.active { background: #4f8cff; color: #fff; border-color: #4f8cff; }

    /* PERFIL */
    .app-shell-profile-avatar {
      width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #4f8cff, #7aa8ff);
      display: flex; align-items: center; justify-content: center; color: #fff; font-weight: bold;
      font-size: 32px; margin-bottom: 12px; overflow: hidden; border: 3px solid #1f2a44;
    }
    .app-shell-profile-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .app-shell-profile-name { color: #e8eef8; font-size: 1.1rem; font-weight: 600; text-align: center; margin-bottom: 4px; }
    .app-shell-profile-email { color: #8fa0bd; font-size: 0.8rem; text-align: center; margin-bottom: 20px; word-break: break-all; }
    
    .app-shell-btn-logout {
      width: 100%; max-width: 200px; padding: 10px; background: rgba(239, 68, 68, 0.1); color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 12px; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.9rem;
      transition: 0.2s; font-family: inherit;
    }
    .app-shell-btn-logout:hover { background: rgba(239, 68, 68, 0.2); }
    .app-shell-btn-logout svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 2; }

    .app-shell-spinner {
      width: 24px; height: 24px; border: 3px solid rgba(255, 255, 255, 0.25);
      border-top-color: #fff; border-radius: 50%; animation: appShellSpin 0.8s linear infinite;
    }
    @keyframes appShellSpin { to { transform: rotate(360deg); } }
  `;

  const ICONS = {
    home: '<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    dev:  '<svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    bell: '<svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>',
    out:  '<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    dark: '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>',
    light:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>',
    sys:  '<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>'
  };

  const ROUTES = { home: "/", developer: "/developer/", notifications: "/notificacoes" };
  const DETECT = { 
    home: ["/", "/index.html", "/home"], 
    developer: ["/developer", "/developer/", "/developer/index.html", "/dev"],
    notifications: ["/notificacoes", "/notificacoes/", "/notificacoes.html", "/notifications"]
  };
  
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDon4WbCbe4kCkUq-OdLBRhzhMaUObbAfo",
    authDomain: "html-15e80.firebaseapp.com",
    databaseURL: "https://html-15e80-default-rtdb.firebaseio.com",
    projectId: "html-15e80",
    storageBucket: "html-15e80.firebasestorage.app",
    messagingSenderId: "1068148640439",
    appId: "1:1068148640439:web:1ac651348e624f6be41b32"
  };

  function injectStyles() {
    if (document.getElementById("app-shell-styles")) return;
    const style = document.createElement("style");
    style.id = "app-shell-styles";
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  function getDeviceId() {
    let id = localStorage.getItem('codehub_deviceId');
    if (!id) { id = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9); localStorage.setItem('codehub_deviceId', id); }
    return id;
  }

  function detectDeviceName() {
    const ua = navigator.userAgent;
    return ua.includes("Windows") ? "Windows" : ua.includes("Mac") ? "Mac" : ua.includes("Android") ? "Android" : "Dispositivo";
  }

  class AppShell {
    constructor(options = {}) {
      this.user = options.user || null;
      this.autoFirebase = options.autoFirebase !== false;
      this.currentView = this._detectView();
      this._firebaseReady = false;
    }

    _detectView() {
      const path = window.location.pathname.replace(/\/+$/, "") || "/";
      for (const [view, paths] of Object.entries(DETECT)) {
        for (const p of paths) { if (path === (p.replace(/\/+$/, "") || "/")) return view; }
      }
      return "home";
    }

    _navigateToView(view) {
      if (view === this.currentView) return;
      window.location.href = ROUTES[view] || "/";
    }

    mount() {
      injectStyles();
      this._renderLeftTab();
      this._renderRightTab();
      this._applyView(this.currentView);
      this._initThemeController();
      if (this.autoFirebase) this._initFirebaseAuth();
      return this;
    }

    _initThemeController() {
      const html = document.documentElement;
      const mq = window.matchMedia('(prefers-color-scheme: dark)');

      const applyTheme = (mode) => {
        let effective = mode === 'system' ? (mq.matches ? 'dark' : 'light') : mode;
        html.setAttribute('data-theme', effective);
        this._menu.querySelectorAll('.app-theme-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.setTheme === mode);
        });
      };

      const setTheme = (mode) => {
        localStorage.setItem('codehub-theme', mode);
        applyTheme(mode);
      };

      this._menu.querySelectorAll('[data-set-theme]').forEach(btn => {
        btn.addEventListener('click', () => setTheme(btn.dataset.setTheme));
      });

      mq.addEventListener('change', () => {
        if (localStorage.getItem('codehub-theme') === 'system') applyTheme('system');
      });

      applyTheme(localStorage.getItem('codehub-theme') || 'dark');
    }

    async _initFirebaseAuth() {
      try {
        const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js");
        const { getAuth, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js");
        const app = getApps && getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
        const auth = getAuth(app);
        this._auth = auth;

        onAuthStateChanged(auth, async (user) => {
          if (!user) { this.setUser(null); return; }
          this._showProfileLoading();
          const userData = await this._fetchFromWorker(user);
          if (userData) {
            this.setUser({ name: userData.displayName || userData.username, email: userData.email, photoUrl: userData.photoURL });
          } else {
            this.setUser({ name: user.displayName || user.email, email: user.email, photoUrl: user.photoURL });
          }
        });
      } catch (e) { console.warn("[AppShell] init:", e.message); }
    }

    async _fetchFromWorker(user) {
      try {
        const token = await user.getIdToken(true);
        const r = await fetch(`${WORKER_URL}/GetUserData?tokenid=${encodeURIComponent(token)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Device-Id": getDeviceId() },
          body: JSON.stringify({ device_id: getDeviceId(), device_name: detectDeviceName(), user_agent: navigator.userAgent })
        });
        const data = await r.json();
        return data.ok ? data.user : null;
      } catch (e) { return null; }
    }

    _renderLeftTab() {
      const menu = document.createElement("aside");
      menu.className = "app-shell-tab-left";
      menu.id = "appShellMenu";
      menu.innerHTML = `
        <div class="app-shell-menu-header">
          <h2>CodeHUB</h2>
          <p>MENU</p>
          <!-- Botão X exclusivo para mobile -->
          <button class="app-shell-close-btn" id="appShellCloseBtn">✕</button>
        </div>
        <nav style="display:flex; flex-direction:column; gap:4px;">
          <button class="app-shell-item" data-view="home"><span class="icon">${ICONS.home}</span><span class="label">Home</span></button>
          <button class="app-shell-item" data-view="developer"><span class="icon">${ICONS.dev}</span><span class="label">Desenvolvedor</span></button>
          <button class="app-shell-item" data-view="notifications"><span class="icon">${ICONS.bell}</span><span class="label">Notificações</span></button>
        </nav>
        <div class="app-shell-themes">
          <button class="app-theme-btn" data-set-theme="dark">${ICONS.dark} Dark</button>
          <button class="app-theme-btn" data-set-theme="light">${ICONS.light} Light</button>
          <button class="app-theme-btn" data-set-theme="system">${ICONS.sys} Auto</button>
        </div>
      `;
      document.body.appendChild(menu);
      this._menu = menu;

      // Fecha no mobile ao clicar no X
      menu.querySelector('#appShellCloseBtn').addEventListener('click', () => {
        menu.classList.remove("mobile-open");
      });

      // Abre/Fecha no mobile ao clicar em qualquer lugar da gaveta
      menu.addEventListener("click", (e) => {
        if (e.target.closest('.app-shell-close-btn') || e.target.closest('.app-shell-item') || e.target.closest('.app-theme-btn')) return;
        if (window.matchMedia("(hover: none)").matches) menu.classList.toggle("mobile-open");
      });

      // Navegação
      menu.querySelectorAll(".app-shell-item").forEach(item => {
        item.addEventListener("click", () => {
          menu.classList.remove("mobile-open");
          this._navigateToView(item.dataset.view);
        });
      });
    }

    _renderRightTab() {
      const profile = document.createElement("aside");
      profile.className = "app-shell-tab-right";
      profile.id = "appShellProfile";
      profile.innerHTML = `
        <div class="app-shell-profile-avatar" id="appShellAvatar"><div class="app-shell-spinner"></div></div>
        <div class="app-shell-profile-name" id="appShellName">Carregando...</div>
        <div class="app-shell-profile-email" id="appShellEmail"></div>
        <button class="app-shell-btn-logout" id="appShellBtnLogout">${ICONS.out} Sair</button>
      `;
      document.body.appendChild(profile);

      this._avatarEl = document.getElementById('appShellAvatar');
      this._nameEl = document.getElementById('appShellName');
      this._emailEl = document.getElementById('appShellEmail');

      profile.addEventListener("click", (e) => {
        if (e.target === profile && window.matchMedia("(hover: none)").matches) {
          profile.classList.toggle("mobile-open");
        }
      });

      document.getElementById('appShellBtnLogout').addEventListener('click', () => {
        if (confirm("Sair da conta?")) {
          if (this._auth) this._auth.signOut().then(() => {
            document.cookie = "firebaseToken=; Domain=.codehub.site.je; Path=/; Max-Age=0";
            location.href = "https://alexandre7888.github.io/auth.html";
          });
        }
      });
    }

    _showProfileLoading() {
      this._avatarEl.innerHTML = `<div class="app-shell-spinner"></div>`;
      this._nameEl.textContent = "Carregando...";
      this._emailEl.textContent = "";
    }

    setUser(user) {
      this.user = user;
      if (!user) {
        this._avatarEl.innerHTML = `<span>?</span>`;
        this._nameEl.textContent = "Visitante";
        this._emailEl.textContent = "Faça login";
        return;
      }
      this._avatarEl.innerHTML = user.photoUrl ? `<img src="${user.photoUrl}" alt="Avatar">` : `<span>${(user.name || "U").charAt(0).toUpperCase()}</span>`;
      this._nameEl.textContent = user.name || "Usuário";
      this._emailEl.textContent = user.email || "";
    }

    _applyView(view) {
      this._menu.querySelectorAll(".app-shell-item").forEach(item => {
        item.classList.toggle("active", item.dataset.view === view);
      });
    }
  }

  window.AppShell = AppShell;

})();
