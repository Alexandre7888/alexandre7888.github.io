// ============================================================
// app-shell.js
// Componente de menu + abas + perfil (vanilla JS)
// ============================================================

(function () {
  "use strict";

  const STYLES = `
    .app-shell-menu-btn{
      position:fixed;top:14px;left:16px;z-index:900;
      width:52px;height:52px;border-radius:16px;
      background:rgba(10,15,28,0.9);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
      border:1px solid #1f2a44;
      display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;
      cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,0.55);
      transition:all .3s cubic-bezier(.34,1.56,.64,1);
      font-family:inherit;
    }
    .app-shell-menu-btn:hover{transform:scale(1.06);border-color:#4f8cff;box-shadow:0 8px 25px rgba(79,140,255,.35)}
    .app-shell-menu-btn:active{transform:scale(.95)}
    .app-shell-menu-btn span{display:block;width:22px;height:2.5px;border-radius:3px;background:#e8eef8;transition:all .35s cubic-bezier(.68,-.55,.27,1.55)}
    .app-shell-menu-btn.open span:nth-child(1){transform:translateY(7.5px) rotate(45deg);background:#4f8cff}
    .app-shell-menu-btn.open span:nth-child(2){opacity:0;transform:scaleX(0)}
    .app-shell-menu-btn.open span:nth-child(3){transform:translateY(-7.5px) rotate(-45deg);background:#4f8cff}

    .app-shell-overlay{
      position:fixed;inset:0;background:rgba(0,0,0,.55);
      backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);
      opacity:0;pointer-events:none;transition:opacity .35s ease;
      z-index:910;
    }
    .app-shell-overlay.active{opacity:1;pointer-events:auto}

    .app-shell-menu{
      position:fixed;top:0;left:0;height:100vh;
      width:300px;max-width:85vw;
      background:rgba(10,15,28,0.9);
      backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
      border-right:1px solid #1f2a44;
      z-index:920;
      transform:translateX(-105%);
      transition:transform .42s cubic-bezier(.34,1.2,.64,1);
      display:flex;flex-direction:column;
      box-shadow:8px 0 40px rgba(0,0,0,.55);
    }
    .app-shell-menu.active{transform:translateX(0)}

    .app-shell-menu-header{
      padding:28px 24px 20px;border-bottom:1px solid #1f2a44;
    }
    .app-shell-menu-header h2{
      color:#e8eef8;font-size:1.35rem;font-weight:700;letter-spacing:-.5px;
      display:flex;align-items:center;gap:10px;
    }
    .app-shell-menu-header h2::before{
      content:'';width:10px;height:10px;border-radius:50%;
      background:#4f8cff;box-shadow:0 0 12px #4f8cff;
    }
    .app-shell-menu-header p{
      color:#8fa0bd;font-size:.78rem;margin-top:6px;letter-spacing:.4px;
    }

    .app-shell-nav{padding:16px 12px;flex:1;overflow-y:auto}

    .app-shell-item{
      display:flex;align-items:center;gap:14px;
      width:100%;padding:14px 16px;border-radius:14px;
      background:transparent;border:none;color:#e8eef8;
      font-size:.95rem;font-weight:500;cursor:pointer;text-align:left;
      transition:all .2s ease;font-family:inherit;margin-bottom:4px;
    }
    .app-shell-item:hover{background:rgba(79,140,255,.1);transform:translateX(4px)}
    .app-shell-item:active{transform:translateX(2px) scale(.98)}
    .app-shell-item.active{background:rgba(79,140,255,.15);border-left:3px solid #4f8cff}
    .app-shell-item .icon{
      width:38px;height:38px;border-radius:11px;
      background:rgba(79,140,255,.1);
      display:flex;align-items:center;justify-content:center;
      flex-shrink:0;transition:all .25s;
    }
    .app-shell-item .icon svg{
      width:20px;height:20px;stroke:#4f8cff;fill:none;
      stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;
    }
    .app-shell-item:hover .icon{
      background:#4f8cff;transform:rotate(-6deg) scale(1.05);
      box-shadow:0 0 15px rgba(79,140,255,.35);
    }
    .app-shell-item:hover .icon svg{stroke:#fff}
    .app-shell-item .label{display:flex;flex-direction:column;gap:2px}
    .app-shell-item .label small{color:#8fa0bd;font-size:.72rem;font-weight:400}

    .app-shell-footer{
      padding:18px 22px;border-top:1px solid #1f2a44;
      color:#8fa0bd;font-size:.72rem;text-align:center;letter-spacing:.3px;
    }

    .app-shell-profile{
      position:fixed;top:14px;right:16px;z-index:900;
      width:52px;height:52px;border-radius:50%;
      background:linear-gradient(135deg,#4f8cff,#7aa8ff);
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-weight:700;font-size:20px;
      cursor:pointer;overflow:hidden;
      border:2px solid rgba(255,255,255,.1);
      box-shadow:0 8px 22px rgba(0,0,0,.55);
      transition:transform .2s;
      user-select:none;
    }
    .app-shell-profile:hover{transform:scale(1.08)}
    .app-shell-profile img{width:100%;height:100%;object-fit:cover}

    .app-shell-dropdown{
      position:fixed;top:76px;right:16px;z-index:930;
      min-width:220px;
      background:rgba(10,15,28,0.95);
      backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
      border:1px solid #1f2a44;border-radius:16px;
      padding:8px;
      box-shadow:0 20px 50px rgba(0,0,0,.6);
      display:none;
      animation:appShellFade .2s ease;
    }
    .app-shell-dropdown.active{display:block}

    @keyframes appShellFade{
      from{opacity:0;transform:translateY(-8px)}
      to{opacity:1;transform:translateY(0)}
    }

    .app-shell-dropdown-header{
      padding:12px 14px;border-bottom:1px solid #1f2a44;
      margin-bottom:6px;
    }
    .app-shell-dropdown-header .name{
      color:#e8eef8;font-weight:600;font-size:.9rem;
    }
    .app-shell-dropdown-header .email{
      color:#8fa0bd;font-size:.75rem;margin-top:2px;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    }
    .app-shell-dropdown-item{
      display:flex;align-items:center;gap:10px;
      width:100%;padding:10px 12px;border-radius:10px;
      background:transparent;border:none;color:#e8eef8;
      font-size:.85rem;cursor:pointer;font-family:inherit;
      text-align:left;transition:background .15s;
    }
    .app-shell-dropdown-item:hover{background:rgba(79,140,255,.15)}
    .app-shell-dropdown-item svg{
      width:16px;height:16px;stroke:#4f8cff;fill:none;
      stroke-width:2;stroke-linecap:round;stroke-linejoin:round;
    }
    .app-shell-dropdown-item.danger svg{stroke:#ef4444}
    .app-shell-dropdown-item.danger{color:#ef4444}

    .app-shell-view{display:none}
    .app-shell-view.active{display:block}
  `;

  const ICONS = {
    home: '<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    dev:  '<svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    user: '<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
    out:  '<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    bell: '<svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>'
  };

  function injectStyles() {
    if (document.getElementById("app-shell-styles")) return;
    const style = document.createElement("style");
    style.id = "app-shell-styles";
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  class AppShell {

    constructor(options = {}) {
      this.onNavigate = options.onNavigate || (() => {});
      this.user       = options.user || null;
      this.currentView = "home";
      this.isOpen = false;
      this._listeners = [];
      this._dropdownOpen = false;
    }

    mount() {
      injectStyles();
      this._renderMenuButton();
      this._renderOverlay();
      this._renderSideMenu();
      this._renderProfile();
      this._renderDropdown();
      this._attachEvents();
      this._applyView(this.currentView);
      return this;
    }

    _renderMenuButton() {
      const btn = document.createElement("button");
      btn.className = "app-shell-menu-btn";
      btn.id = "appShellMenuBtn";
      btn.setAttribute("aria-label", "Abrir menu");
      btn.innerHTML = "<span></span><span></span><span></span>";
      document.body.appendChild(btn);
      this._btn = btn;
    }

    _renderOverlay() {
      const ov = document.createElement("div");
      ov.className = "app-shell-overlay";
      ov.id = "appShellOverlay";
      document.body.appendChild(ov);
      this._overlay = ov;
    }

    _renderSideMenu() {
      const menu = document.createElement("aside");
      menu.className = "app-shell-menu";
      menu.id = "appShellMenu";
      menu.innerHTML = `
        <div class="app-shell-menu-header">
          <h2>CodeHUB</h2>
          <p>PLATAFORMA · v2.0</p>
        </div>
        <nav class="app-shell-nav">
          <button class="app-shell-item active" data-view="home">
            <span class="icon">${ICONS.home}</span>
            <span class="label">Home<small>Página inicial</small></span>
          </button>
          <button class="app-shell-item" data-view="developer">
            <span class="icon">${ICONS.dev}</span>
            <span class="label">Desenvolvedor<small>Criar tokens de API</small></span>
          </button>
        </nav>
        <div class="app-shell-footer">© 2026 CodeHUB · Todos os direitos reservados</div>
      `;
      document.body.appendChild(menu);
      this._menu = menu;
    }

    _renderProfile() {
      const p = document.createElement("div");
      p.className = "app-shell-profile";
      p.id = "appShellProfile";
      p.style.display = "none";

      if (this.user && this.user.photoUrl) {
        p.innerHTML = `<img src="${this.user.photoUrl}" alt="">`;
      } else {
        const initial = (this.user && (this.user.name || this.user.email) || "?").charAt(0).toUpperCase();
        p.textContent = initial;
      }

      document.body.appendChild(p);
      this._profile = p;
    }

    _renderDropdown() {
      const dd = document.createElement("div");
      dd.className = "app-shell-dropdown";
      dd.id = "appShellDropdown";

      const name  = (this.user && this.user.name)  || "Usuário";
      const email = (this.user && this.user.email) || "";

      dd.innerHTML = `
        <div class="app-shell-dropdown-header">
          <div class="name">${name}</div>
          <div class="email">${email}</div>
        </div>
        <button class="app-shell-dropdown-item" data-action="profile">
          ${ICONS.user}
          <span>Meu perfil</span>
        </button>
        <button class="app-shell-dropdown-item" data-action="settings">
          ${ICONS.gear}
          <span>Configurações</span>
        </button>
        <button class="app-shell-dropdown-item" data-action="notifications">
          ${ICONS.bell}
          <span>Notificações</span>
        </button>
        <button class="app-shell-dropdown-item danger" data-action="logout">
          ${ICONS.out}
          <span>Sair</span>
        </button>
      `;
      document.body.appendChild(dd);
      this._dropdown = dd;
    }

    _attachEvents() {
      this._btn.addEventListener("click", () => this.toggleMenu());
      this._overlay.addEventListener("click", () => this.closeMenu());

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          this.closeMenu();
          this._closeDropdown();
        }
      });

      this._menu.querySelectorAll(".app-shell-item").forEach(item => {
        item.addEventListener("click", () => {
          const view = item.dataset.view;
          this.navigate(view);
          this.closeMenu();
        });
      });

      this._profile.addEventListener("click", (e) => {
        e.stopPropagation();
        this._toggleDropdown();
      });

      document.addEventListener("click", (e) => {
        if (!this._dropdownOpen) return;
        if (e.target.closest("#appShellDropdown")) return;
        if (e.target.closest("#appShellProfile")) return;
        this._closeDropdown();
      });

      this._dropdown.querySelectorAll(".app-shell-dropdown-item").forEach(item => {
        item.addEventListener("click", () => {
          const action = item.dataset.action;
          this._onDropdownAction(action);
          this._closeDropdown();
        });
      });
    }

    toggleMenu() { this.isOpen ? this.closeMenu() : this.openMenu(); }

    openMenu() {
      this.isOpen = true;
      this._btn.classList.add("open");
      this._menu.classList.add("active");
      this._overlay.classList.add("active");
      document.body.style.overflow = "hidden";
    }

    closeMenu() {
      this.isOpen = false;
      this._btn.classList.remove("open");
      this._menu.classList.remove("active");
      this._overlay.classList.remove("active");
      document.body.style.overflow = "";
    }

    _toggleDropdown() { this._dropdownOpen ? this._closeDropdown() : this._openDropdown(); }

    _openDropdown() {
      this._dropdownOpen = true;
      this._dropdown.classList.add("active");
    }

    _closeDropdown() {
      this._dropdownOpen = false;
      this._dropdown.classList.remove("active");
    }

    _onDropdownAction(action) {
      switch (action) {
        case "logout":
          if (confirm("Sair da conta?")) {
            document.cookie = "firebaseToken=; Domain=.codehub.site.je; Path=/; Max-Age=0";
            location.reload();
          }
          break;
        case "profile":       console.log("[AppShell] profile (em breve)"); break;
        case "settings":      console.log("[AppShell] settings (em breve)"); break;
        case "notifications": console.log("[AppShell] notifications (em breve)"); break;
      }
    }

    setUser(user) {
      this.user = user;

      if (user && user.photoUrl) {
        this._profile.innerHTML = `<img src="${user.photoUrl}" alt="">`;
      } else if (user) {
        const initial = (user.name || user.email || "?").charAt(0).toUpperCase();
        this._profile.textContent = initial;
      } else {
        this._profile.textContent = "?";
      }

      const name  = (user && user.name)  || "Usuário";
      const email = (user && user.email) || "";
      const header = this._dropdown.querySelector(".app-shell-dropdown-header");
      if (header) {
        header.querySelector(".name").textContent  = name;
        header.querySelector(".email").textContent = email;
      }
    }

    showProfile() { this._profile.style.display = "flex"; }
    hideProfile() { this._profile.style.display = "none"; }

    navigate(view) {
      if (this.currentView === view) return;
      this.currentView = view;

      this._menu.querySelectorAll(".app-shell-item").forEach(item => {
        item.classList.toggle("active", item.dataset.view === view);
      });

      this._applyView(view);
      this.onNavigate(view);
    }

    _applyView(view) {
      // esconde todas as views
      document.querySelectorAll("[data-shell-view]").forEach(el => {
        el.classList.toggle("active", el.dataset.shellView === view);
      });

      // mostra/esconde perfil só na view developer
      if (view === "developer") {
        this.showProfile();
      } else {
        this.hideProfile();
      }
    }
  }

  window.AppShell = AppShell;

})();
