// app-shell.js v2.8.0 - Gavetas (Hover no Desktop, Clique no Mobile)
(function () {
  "use strict";

  const WORKER_URL = window.WORKER_URL || "https://proud-flower-677b.braatzjunioralexandre5.workers.dev";

  const STYLES = `
    /* =========================================
       GAVETAS LATERAIS
       ========================================= */
    
    /* Gaveta Esquerda */
    .app-shell-tab-left {
      position: fixed;
      top: 50%;
      left: 0;
      transform: translateY(-50%) translateX(-100%);
      width: 260px;
      background: rgba(10, 15, 28, 0.95);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid #1f2a44;
      border-left: none;
      border-radius: 0 16px 16px 0;
      padding: 20px 12px;
      z-index: 2000;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 4px 0 30px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      gap: 8px;
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
    }

    /* Gaveta Direita */
    .app-shell-tab-right {
      position: fixed;
      top: 50%;
      right: 0;
      transform: translateY(-50%) translateX(100%);
      width: 260px;
      background: rgba(10, 15, 28, 0.95);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid #1f2a44;
      border-right: none;
      border-radius: 16px 0 0 16px;
      padding: 20px 12px;
      z-index: 2000;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: -4px 0 30px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
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
    }

    /* Desktop: Abre no Hover */
    @media (hover: hover) {
      .app-shell-tab-left:hover { transform: translateY(-50%) translateX(0); }
      .app-shell-tab-right:hover { transform: translateY(-50%) translateX(0); }
    }

    /* Mobile: Abre com Clique (Classe .mobile-open) */
    @media (hover: none) {
      .app-shell-tab-left.mobile-open { transform: translateY(-50%) translateX(0); }
      .app-shell-tab-right.mobile-open { transform: translateY(-50%) translateX(0); }
      
      /* Muda o ícone quando está aberto no mobile */
      .app-shell-tab-left.mobile-open::after { content: '<'; }
      .app-shell-tab-right.mobile-open::before { content: '>'; }
    }

    /* =========================================
       CONTEÚDO INTERNO
       ========================================= */
    .app-shell-menu-header { border-bottom: 1px solid #1f2a44; padding-bottom: 12px; margin-bottom: 12px; text-align: center; }
    .app-shell-menu-header h2 { color: #e8eef8; font-size: 1.2rem; font-weight: 700; }
    .app-shell-menu-header p { color: #8fa0bd; font-size: 0.7rem; }
    
    .app-shell-item {
      display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 16px;
      border-radius: 12px; background: transparent; border: none; color: #e8eef8;
      font-size: 0.95rem; font-weight: 500; cursor: pointer; text-align: left; font-family: inherit;
    }
    .app-shell-item:hover { background: rgba(79, 140, 255, 0.1); }
    .app-shell-item.active { background: rgba(79, 140, 255, 0.15); border-left: 3px solid #4f8cff; }
    .app-shell-item .icon svg { width: 20px; height: 20px; stroke: #4f8cff; fill: none; stroke-width: 2; }

    .app-shell-profile-avatar {
      width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #4f8cff, #7aa8ff);
      display: flex; align-items: center; justify-content: center; color: #fff; font-weight: bold;
      font-size: 32px; margin-bottom: 12px; overflow: hidden; border: 3px solid #1f2a44;
    }
    .app-shell-profile-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .app-shell-profile-name { color: #e8eef8; font-size: 1.1rem; font-weight: 600; text-align: center; margin-bottom: 4px; }
    .app-shell-profile-email { color: #8fa0bd; font-size: 0.8rem; text-align: center; margin-bottom: 20px; word-break: break-all; }
    
    .app-shell-btn-logout {
      width: 100%; padding: 12px; background: rgba(239, 68, 68, 0.1); color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 12px; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .app-shell-btn-logout:hover { background: rgba(239, 68, 68, 0.2); }

    .app-shell-spinner {
      width: 24px; height: 24px; border: 3px solid rgba(255, 255, 255, 0.25);
      border-top-color: #fff; border-radius: 50%; animation: appShellSpin 0.8s linear infinite;
    }
    @keyframes appShellSpin { to { transform: rotate(360deg); } }
  `;

  const ICONS = {
    home: '<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    dev:  '<svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    out:  '<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>'
  };

  const ROUTES = { home: "/", developer: "/developer/" };
  const DETECT = { home: ["/", "/index.html", "/home"], developer: ["/developer", "/developer/", "/developer/index.html", "/dev"] };
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
      if (this.autoFirebase) this._initFirebaseAuth();
      return this;
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

    // =========================================
    // GAVETAS E CLIQUES
    // =========================================
    _renderLeftTab() {
      const menu = document.createElement("aside");
      menu.className = "app-shell-tab-left";
      menu.id = "appShellMenu";
      menu.innerHTML = `
        <div class="app-shell-menu-header"><h2>CodeHUB</h2><p>MENU</p></div>
        <nav style="display:flex; flex-direction:column; gap:4px;">
          <button class="app-shell-item" data-view="home"><span class="icon">${ICONS.home}</span><span class="label">Home</span></button>
          <button class="app-shell-item" data-view="developer"><span class="icon">${ICONS.dev}</span><span class="label">Desenvolvedor</span></button>
        </nav>
      `;
      document.body.appendChild(menu);
      this._menu = menu;

      // Lógica para Mobile (Clique na aba lateral)
      menu.addEventListener("click", (e) => {
        if (e.target === menu || e.target.closest('.app-shell-item')) return; // Ignora cliques nos itens
        if (window.matchMedia("(hover: none)").matches) menu.classList.toggle("mobile-open");
      });

      menu.querySelectorAll(".app-shell-item").forEach(item => {
        item.addEventListener("click", () => {
          menu.classList.remove("mobile-open"); // Fecha no mobile ao clicar
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

      // Lógica para Mobile (Clique na aba lateral)
      profile.addEventListener("click", (e) => {
        if (e.target === profile) {
          if (window.matchMedia("(hover: none)").matches) profile.classList.toggle("mobile-open");
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
