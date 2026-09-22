// ============================================================
// CodeHub SDK
// ============================================================

const DEFAULT_WORKER    = "https://proud-flower-677b.braatzjunioralexandre5.workers.dev";
const DEFAULT_BASE      = "https://app.codehub.site.je/API/v3/continuar-conta";
const STORAGE_KEY       = "ch_authid";

export class CodeHub {

  constructor(options = {}) {
    this.worker     = options.worker    || DEFAULT_WORKER;
    this.baseLogin  = options.baseLogin || DEFAULT_BASE;
    this.appToken   = options.appToken  || "";
    this.onPending  = options.onPending   || (() => {});
    this.onConfirmed= options.onConfirmed || (() => {});
    this.onError    = options.onError     || (() => {});
    this.eventSource= null;
    this.popupRef   = null;
    this.authIdAtual= null;
    this._listeners = {};
    this._installPostMessage();
  }

  // ---------- event bus ----------
  _emit(evt, payload) {
    (this._listeners[evt] || []).forEach(fn => {
      try { fn(payload); } catch (e) { console.warn("[CodeHub]", e); }
    });
  }

  on(evt, fn) {
    if (!this._listeners[evt]) this._listeners[evt] = [];
    this._listeners[evt].push(fn);
    return () => this.off(evt, fn);
  }

  off(evt, fn) {
    if (!this._listeners[evt]) return;
    this._listeners[evt] = this._listeners[evt].filter(f => f !== fn);
  }

  _installPostMessage() {
    window.addEventListener("message", (e) => {
      if (!e.data || e.data.type !== "AUTH_DONE") return;
      try {
        const u = new URL(e.data.url);
        if (u.protocol !== "https:") return;
        if (e.data.url === window.location.href) return;
        window.location.href = e.data.url;
      } catch {}
    });
  }

  // ---------- storage ----------
  saveSession(authId)    { localStorage.setItem(STORAGE_KEY, authId); }
  readSession()          { return localStorage.getItem(STORAGE_KEY); }
  clearSession()         { localStorage.removeItem(STORAGE_KEY); }
  hasSession()           { return !!this.readSession(); }

  // ---------- worker fetch ----------
  async _get(path, params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = `${this.worker}${path}${qs ? "?" + qs : ""}`;
    const r = await fetch(url);
    return await r.json();
  }

  // ---------- auth id ----------
  async createAuthId() {
    const d = await this._get("/CreateAuthId");
    if (!d.ok) throw new Error(d.erro || "createAuthId failed");
    return d.authId;
  }

  // ---------- popup ----------
  openPopup(authId, redirectUrl) {
    const dest = redirectUrl || window.location.href;
    if (!dest.toLowerCase().startsWith("https://")) {
      throw new Error("Page must be served over HTTPS.");
    }
    const params = new URLSearchParams();
    params.set("token", this.appToken);
    params.set("authid", authId);
    params.set("redirecturl", dest);
    const url = `${this.baseLogin}?${params}`;
    this.popupRef = window.open(url, "loginPopup", "width=500,height=680,scrollbars=yes");
    return this.popupRef;
  }

  // ---------- SSE ----------
  listenSSE(authId) {
    if (this.eventSource) this.eventSource.close();
    this.eventSource = new EventSource(`${this.worker}/LoginAuthId?id=${authId}`);

    this.eventSource.addEventListener("status", async (e) => {
      let data;
      try { data = JSON.parse(e.data); } catch { return; }

      if (data.status === "pending") {
        this.onPending(data);
        this._emit("pending", data);
        return;
      }
      if (data.status === "confirmed") {
        this.eventSource.close();
        this.eventSource = null;
        try { if (this.popupRef && !this.popupRef.closed) this.popupRef.close(); } catch {}
        this.saveSession(authId);
        this.onConfirmed(data);
        this._emit("confirmed", data);
        return;
      }
      if (data.status === "not_found") {
        this.eventSource.close();
        this.eventSource = null;
        const err = new Error("authId not found");
        this.onError(err);
        this._emit("error", err);
      }
    });

    this.eventSource.addEventListener("error", (e) => {
      this.onError(e);
      this._emit("error", e);
    });
  }

  // ---------- login ----------
  async login(redirectUrl) {
    this.clearSession();
    const authId = await this.createAuthId();
    this.authIdAtual = authId;
    this.saveSession(authId);
    this.openPopup(authId, redirectUrl);
    this.listenSSE(authId);
    this._emit("started", { authId });
    return authId;
  }

  // ============================================================
  // ACCOUNT INFO — retorna um JSON pronto da conta
  // ============================================================
  async getAccount(firebaseIdToken) {
    const raw = await this._get("/AuthProfile", { token: firebaseIdToken });
    const u = raw.data || {};

    return {
      uid:        u.uid         || null,
      name:       u.displayName || null,
      email:      u.email       || null,
      emailVerified: u.emailVerified === true,
      photoUrl:   u.photoUrl    || null,
      disabled:   u.disabled === true,
      success:    u.success === true,
      version:    u.version     || null,
      raw:        u
    };
  }

  // ============================================================
  // WATCH — fica ouvindo o SSE e a cada confirm dispara onAccount(json)
  // ============================================================
  async watchAccount(onAccount) {
    const authId = this.readSession();
    if (!authId) throw new Error("No authId in session.");

    if (this.eventSource) this.eventSource.close();
    this.eventSource = new EventSource(`${this.worker}/LoginAuthId?id=${authId}`);

    this.eventSource.addEventListener("status", async (e) => {
      let data;
      try { data = JSON.parse(e.data); } catch { return; }

      if (data.status === "confirmed" && data.firebaseIdToken) {
        const account = await this.getAccount(data.firebaseIdToken);
        onAccount(account);
      }
    });

    return this.eventSource;
  }

  // ============================================================
  // TOKEN AUTO-REFRESH
  //   a cada X segundos cria um novo auth token pelo authId salvo
  // ============================================================
  startTokenRefresh(onToken, intervalMs = 30 * 60 * 1000) {
    if (this._refreshTimer) clearInterval(this._refreshTimer);

    const tick = async () => {
      const authId = this.readSession();
      if (!authId) return;
      try {
        const d = await this._get("/CreateAuthToken", { id: authId });
        if (d.ok && onToken) onToken(d);
      } catch (e) {
        console.warn("[CodeHub] token refresh:", e);
      }
    };

    this._refreshTimer = setInterval(tick, intervalMs);
    tick();
    return this._refreshTimer;
  }

  stopTokenRefresh() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
  }

  // ---------- status / data ----------
  async getAuthStatus(authId) {
    const id = authId || this.readSession();
    if (!id) throw new Error("authId is required");
    return await this._get("/StatusAuthId", { id });
  }

  async getAppData(token) {
    const t = token || this.appToken;
    if (!t) throw new Error("appToken is required");
    const d = await this._get("/TokenData", { token: t });
    if (!d.ok) throw new Error(d.erro || "getAppData failed");
    return d.data;
  }

  async createAuthToken(authId) {
    const id = authId || this.readSession();
    if (!id) throw new Error("authId is required");
    return await this._get("/CreateAuthToken", { id });
  }

  // ---------- logout ----------
  async logout(confirmar = true) {
    const authId = this.readSession();
    if (!authId) {
      this.clearSession();
      return { ok: true, msg: "nothing to delete" };
    }
    if (confirmar && !confirm("Delete authid from server and browser?")) {
      return { ok: false, msg: "cancelled" };
    }
    let serverOk = false;
    try {
      const d = await this._get("/DeleteAuthId", { id: authId });
      if (d.ok) serverOk = true;
    } catch (e) { console.warn("[CodeHub] logout:", e); }
    this.clearSession();
    return { ok: serverOk, msg: serverOk ? "deleted" : "server failed" };
  }

  close() {
    if (this.eventSource) { this.eventSource.close(); this.eventSource = null; }
    if (this.popupRef && !this.popupRef.closed) {
      try { this.popupRef.close(); } catch {}
    }
    this.stopTokenRefresh();
  }
}

export function createCodeHub(options) {
  return new CodeHub(options);
}

export default CodeHub;
