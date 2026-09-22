// ============================================================
// app-shell.js
// Menu + navegação. A foto de perfil é controlada pelo HTML.
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

    .app-shell-menu-header{padding:28px 24px 20px;border-bottom:1px solid #1f2a44}
    .app-shell-menu-header h2{color:#e8eef8;font-size:1.35rem;font-weight:700;letter-spacing:-.5px;display:flex;align-items:center;gap:10px}
    .app-shell-menu-header h2::before{content:'';width:10px;height:10px;border-radius:50%;background:#4f8cff;box-shadow:0 0 12px #4f8cff}
    .app-shell-menu-header p{color:#8fa0bd;font-size:.78rem;margin-top:6px;letter-spacing:.4px}

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
    .app-shell-item .icon svg{width:20px;height:20px;stroke:#4f8cff;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
    .app-shell-item:hover .icon{background:#4f8cff;transform:rotate(-6deg) scale(1.05);box-shadow:0 0 15px rgba(79,140,255,.35)}
    .app-shell-item:hover .icon svg{stroke:#fff}
    .app-shell-item .label{display:flex;flex-direction:column;gap:2px}
    .app-shell-item .label small{color:#8fa0bd;font-size:.72rem;font-weight:400}

    .app-shell-footer{padding:18px 22px;border-top:1px solid #1f2a44;color:#8fa0bd;font-size:.72rem;text-align:center;letter-spacing:.3px}
  `;

  const ICONS = {
    home: '<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    dev:  '<svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>'
  };

  const ROUTES = {
    home:      "/",
    developer: "/developer.html"
  };

  const DETECT = {
    home:      ["/", "/index.html", "/home"],
    developer: ["/developer", "/developer.html", "/dev"]
  };

  function injectStyles() {
    if (document.getElementById("app-shell-styles")) return;
    const style = document.createElement("style");
    style.id = "app-shell-styles";
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  class AppShell {

    constructor() {
      this.currentView = this._detectView();
      this.isOpen = false;
    }

    _detectView() {
      const path = window.location.pathname.replace(/\/+$/, "") || "/";
      for (const [view, paths] of Object.entries(DETECT)) {
        for (const p of paths) {
          const norm = p.replace(/\/+$/, "") || "/";
          if (path === norm) return view;
        }
      }
      if (path.toLowerCase().includes("developer")) return "developer";
      return "home";
    }

    _navigateToView(view) {
      if (view === this.currentView) return;
      const target = ROUTES[view];
      if (!target) return;
      if (target === "/" && window.location.pathname === "/") return;
      window.location.href = target;
    }

    mount() {
      injectStyles();
      this._renderMenuButton();
      this._renderOverlay();
      this._renderSideMenu();
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
          <button class="app-shell-item" data-view="home">
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

    _attachEvents() {
      this._btn.addEventListener("click", () => this.toggleMenu());
      this._overlay.addEventListener("click", () => this.closeMenu());

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") this.closeMenu();
      });

      this._menu.querySelectorAll(".app-shell-item").forEach(item => {
        item.addEventListener("click", () => {
          const view = item.dataset.view;
          this.closeMenu();
          this._navigateToView(view);
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

    _applyView(view) {
      this._menu.querySelectorAll(".app-shell-item").forEach(item => {
        item.classList.toggle("active", item.dataset.view === view);
      });
    }
  }

  window.AppShell = AppShell;

})();

// ============================================================
// APP-MENU — carrega app-menu.js (opcional) se existir
// ============================================================
(function () {
  "use strict";

  // Se o HTML definiu window.AppMenu (via app-menu.js), renderiza
  // no elemento #app-menu-root.
  function renderAppMenu() {
    const root = document.getElementById("app-menu-root");
    if (!root) return;

    if (typeof window.AppMenu === "undefined") {
      console.warn("[app-shell] window.AppMenu não encontrado. app-menu.js carregado?");
      return;
    }

    // Se React estiver carregado, usa ReactDOM
    if (typeof React !== "undefined" && typeof ReactDOM !== "undefined") {
      try {
        const reactRoot = ReactDOM.createRoot(root);
        reactRoot.render(React.createElement(window.AppMenu));
        return;
      } catch (e) {
        console.warn("[app-shell] Erro ao renderizar com React:", e);
      }
    }

    // Fallback: se AppMenu for função que retorna HTML
    if (typeof window.AppMenu === "function") {
      try {
        root.innerHTML = window.AppMenu();
      } catch (e) {
        console.warn("[app-shell] Erro no fallback:", e);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderAppMenu);
  } else {
    renderAppMenu();
  }

})();
