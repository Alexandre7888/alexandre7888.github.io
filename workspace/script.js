import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDon4WbCbe4kCkUq-OdLBRhzhMaUObbAfo",
  authDomain: "html-15e80.firebaseapp.com",
  databaseURL: "https://html-15e80-default-rtdb.firebaseio.com",
  projectId: "html-15e80",
  storageBucket: "html-15e80.firebasestorage.app",
  messagingSenderId: "1068148640439",
  appId: "1:1068148640439:web:1ac651348e624f6be41b32",
  measurementId: "G-7E1VWN07GM"
};
const API = "https://proud-flower-677b.braatzjunioralexandre5.workers.dev";
const LOGIN_URL = "https://kloewa.ooguy.com/";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const isTouch = window.matchMedia("(pointer: coarse)").matches || 'ontouchstart' in window;
const S = { user: null, folder: "root", files: [], folders: [], q: "", notifs: [], loaded: false };
const $ = id => document.getElementById(id);

const CACHE_PREFIX = "kloewa_ws_";
const CACHE_TTL = 1000 * 60 * 60;
function cacheKey(uid, folder) { return `${CACHE_PREFIX}${uid}_${folder}`; }
function saveCache(uid, folder, files, folders) {
  try { localStorage.setItem(cacheKey(uid, folder), JSON.stringify({ files, folders, ts: Date.now() })); } catch (e) {}
}
function loadCache(uid, folder) {
  try {
    const raw = localStorage.getItem(cacheKey(uid, folder));
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || !d.files || !d.folders) return null;
    if (Date.now() - d.ts > CACHE_TTL) { localStorage.removeItem(cacheKey(uid, folder)); return null; }
    return d;
  } catch (e) { return null; }
}
function invalidateCache(uid, folder) { try { localStorage.removeItem(cacheKey(uid, folder)); } catch (e) {} }

const P = {
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  image: "M4 5h16v14H4zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM20 15l-5-5-9 9",
  pdf: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  users: "M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 20v-1a4 4 0 0 0-3-3.9M16 4.1a3.5 3.5 0 0 1 0 6.8",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  plus: "M12 5v14M5 12h14",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5",
  back: "M15 18l-6-6 6-6",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  down: "M12 4v12M7 11l5 5 5-5M4 20h16",
  move: "M5 12h14M13 6l6 6-6 6",
  edit: "M4 20h4L19 9l-4-4L4 16zM13 7l4 4",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  mail: "M3 6h18v12H3zM3 7l9 7 9-7",
  share: "M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13",
  dots: "M12 6h.01M12 12h.01M12 18h.01"
};
function icon(name) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", P[name]); s.appendChild(p); return s;
}
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  kids.flat().forEach(k => e.append(k));
  return e;
}
const withIcon = (name, text) => [icon(name), text];

function showToast(msg, type = "info") {
  const t = el("div", { class: "toast " + type, role: "status" }, msg);
  $("toasts").append(t); setTimeout(() => t.remove(), 3800);
}

async function token() { return await auth.currentUser.getIdToken(true); }
const JSON_H = { "Content-Type": "application/json" };
const NET_ERR = "Erro de conexão. Verifique sua internet.";
async function parse(r) {
  let d; try { d = await r.json(); } catch { throw new Error(NET_ERR); }
  if (!r.ok || d.ok === false) throw new Error(d.error || d.message || "Erro " + r.status);
  return d;
}
async function post(path, body) {
  const r = await fetch(API + path, { method: "POST", headers: JSON_H, body: JSON.stringify({ tokenid: await token(), ...body }) });
  return parse(r);
}
async function get(path, params = {}) {
  const q = new URLSearchParams({ tokenid: await token(), ...params });
  return parse(await fetch(API + path + "?" + q, { headers: JSON_H }));
}
async function blobUrl(path, params = {}) {
  const q = new URLSearchParams({ tokenid: await token(), ...params });
  const r = await fetch(API + path + "?" + q, { headers: JSON_H });
  if (r.status === 401) {
    showToast("Sessão expirada. Faça login novamente.", "error");
    setTimeout(() => location.replace(LOGIN_URL), 1500);
    throw new Error("Sessão expirada");
  }
  if (!r.ok) throw new Error("Falha ao carregar arquivo");
  return URL.createObjectURL(await r.blob());
}
async function run(fn, okMsg) {
  try { const d = await fn(); if (okMsg) showToast(okMsg, "success"); return d; }
  catch (e) { showToast(e instanceof TypeError ? NET_ERR : (e.message || NET_ERR), "error"); return null; }
}

const fb = { files: {}, folders: {}, parent: null, key: "", unsubs: [], waiters: [] };
const findFb = (map, i) => map[i.id] || Object.values(map).find(v => v && v.name === i.name);
function listen() {
  const key = S.user.uid + "|" + S.folder;
  if (key === fb.key) return;
  fb.key = key; fb.unsubs.forEach(u => u()); fb.unsubs = [];
  fb.files = {}; fb.folders = {}; fb.parent = null;
  const base = S.folder === "root" ? `workspace/${S.user.uid}` : `workspace/${S.user.uid}/folders/${S.folder}`;
  const watch = (path, fn) => fb.unsubs.push(onValue(ref(db, path), s => { fn(s.val()); applyPriv(); }, e => console.error("RTDB:", e)));
  watch(base + "/files", v => fb.files = v || {});
  watch(base + "/folders", v => fb.folders = v || {});
  if (S.folder !== "root") watch(base + "/privacy", v => fb.parent = v);
}
function applyPriv() {
  const lock = fb.parent === "private";
  const merge = (list, map) => list.forEach(i => { const m = findFb(map, i); if (m && m.privacy) i.privacy = m.privacy; i._priv = lock ? "private" : (i.privacy || "private"); });
  merge(S.files, fb.files); merge(S.folders, fb.folders);
  fb.waiters = fb.waiters.filter(w => { const m = findFb(w.item._t === "folder" ? fb.folders : fb.files, w.item); if (m && m.privacy === w.val) { w.res(); return false; } return true; });
  if (S.loaded) render();
}
function waitPriv(item, val) {
  let w; const p = new Promise(res => { w = { item, val, res }; fb.waiters.push(w); setTimeout(res, 8000); });
  const m = findFb(item._t === "folder" ? fb.folders : fb.files, item);
  if (m && m.privacy === val) w.res();
  return { p, cancel: () => { fb.waiters = fb.waiters.filter(x => x !== w); } };
}

function currentFolder() {
  const h = decodeURIComponent(location.hash.slice(1)).replace(/\/+$/, "");
  return h || "root";
}
async function load() {
  S.folder = currentFolder(); S.loaded = false;
  $("title").replaceChildren(icon("folder"), S.folder === "root" ? "Meu Workspace" : S.folder);
  if (S.folder !== "root") {
    const b = el("button", { class: "btn", onclick: () => { location.hash = ""; } }, ...withIcon("back", "Voltar"));
    $("title").prepend(b);
  }

  const cached = loadCache(S.user.uid, S.folder);
  if (cached) {
    S.files = cached.files; S.folders = cached.folders; S.loaded = true;
    listen(); applyPriv();
  } else {
    $("grid").replaceChildren(el("div", { class: "empty" }, "Carregando..."));
  }

  try {
    const d = await get("/api/workspace/list", { folder: S.folder });
    if (!d) return;
    S.files = d.files || []; S.folders = d.folders || [];
    S.loaded = true;
    saveCache(S.user.uid, S.folder, S.files, S.folders);
    listen(); applyPriv();
  } catch (e) {
    if (!cached) showToast("Erro ao carregar.", "error");
  }
}

const isImg = f => /^image\//.test(f.type || f.mimeType || "") || /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name || "");
const isPdf = f => /pdf/.test(f.type || f.mimeType || "") || /\.pdf$/i.test(f.name || "");
const isRecv = f => f.received && !f.accepted;
const privIcon = p => p === "public" ? "globe" : p === "restricted" ? "users" : "lock";

function render() {
  const q = S.q.toLowerCase();
  const items = [
    ...S.folders.map(x => ({ ...x, _t: "folder" })),
    ...S.files.map(x => ({ ...x, _t: "file" }))
  ].filter(i => (i.name || "").toLowerCase().includes(q));
  const g = $("grid"); g.replaceChildren();
  if (!items.length) { g.append(el("div", { class: "empty" }, S.q ? "Nenhum item encontrado." : "Pasta vazia.")); return; }
  items.forEach(i => g.append(card(i)));
}

function card(i) {
  const thumb = el("div", { class: "thumb" });
  if (i._t === "folder") thumb.append(icon("folder"));
  else if (isImg(i)) {
    thumb.append(icon("image"));
    const path = isRecv(i) ? "/api/workspace/preview/" + i.id : "/api/workspace/view/" + i.id;
    blobUrl(path, { owner: i.ownerUid || "", type: "file" }).then(u => {
      const im = el("img", { src: u, alt: "", class: isRecv(i) ? "blur" : "" }); thumb.replaceChildren(im);
    }).catch(() => {});
  } else thumb.append(icon(isPdf(i) ? "pdf" : "pdf"));

  const c = el("div", { class: "card", tabindex: "0", "data-id": i.id }, thumb,
    el("div", { class: "meta" }, el("span", { class: "n", title: i.name }, i.name || ""), icon(privIcon(i._priv || i.privacy))));

  const dots = el("button", { class: "dots", "aria-label": "Opções", onclick: e => {
    e.stopPropagation(); showCtx(e.clientX, e.clientY, i);
  } }, icon("dots"));
  c.append(dots);

  if (i._t === "file") {
    c.append(el("button", { class: "trash", "aria-label": "Excluir", onclick: e => { e.stopPropagation(); askDelete(i); } }, icon("trash")));
    if (isRecv(i)) c.append(el("div", { class: "accept" }, el("button", { class: "btn pri", onclick: e => { e.stopPropagation(); acceptFile(i); } }, "Aceitar")));
  }

  let pressTimer = null;
  let longPressFired = false;

  c.addEventListener("contextmenu", e => {
    if (!isTouch) { e.preventDefault(); showCtx(e.clientX, e.clientY, i); }
  });

  c.addEventListener("touchstart", e => {
    if (!isTouch) return;
    longPressFired = false;
    pressTimer = setTimeout(() => {
      longPressFired = true;
      const t = e.touches[0];
      showCtx(t.clientX, t.clientY, i);
    }, 500);
  }, { passive: true });

  c.addEventListener("touchend", e => {
    if (!isTouch) return;
    clearTimeout(pressTimer);
    if (longPressFired) { e.preventDefault(); return; }
    open(i);
  });

  c.addEventListener("touchmove", () => { clearTimeout(pressTimer); }, { passive: true });
  c.addEventListener("click", e => { if (!isTouch && e.button === 0) open(i); });

  return c;
}

function open(i) {
  if (i._t === "folder") { location.hash = encodeURIComponent(i.name) + "/"; return; }
  if (isRecv(i)) { showToast("Aceite o arquivo para visualizar.", "info"); return; }
  viewFile(i);
}

function showCtx(x, y, i) {
  const f = i._t === "file";
  const recv = isRecv(i);
  const items = [
    f && !recv && ["eye", "Visualizar", () => viewFile(i)],
    f && !recv && ["down", "Baixar", () => downloadFile(i)],
    f && !recv && ["share", "Compartilhar", () => shareNative(i)],
    !recv && ["move", "Mover", () => moveItem(i)],
    !recv && ["edit", "Renomear", () => rename(i)],
    !recv && ["lock", "Privacidade", () => privacyModal(i)],
    f && ["link", "Link público", () => publicLink(i)],
    f && ["mail", "Compartilhar por e-mail", () => shareMail(i)],
    ["trash", i._t === "folder" ? "Excluir pasta" : "Excluir", () => askDelete(i), "dng"]
  ].filter(Boolean);
  const m = $("ctx"); m.replaceChildren();
  items.forEach(([ic, label, fn, cls]) => m.append(el("button", { class: cls || "", onclick: () => { hideCtx(); fn(); } }, icon(ic), label)));
  m.classList.remove("hidden");
  m.style.left = Math.min(x, innerWidth - m.offsetWidth - 8) + "px";
  m.style.top = Math.min(y, innerHeight - m.offsetHeight - 8) + "px";
}
const hideCtx = () => $("ctx").classList.add("hidden");
document.addEventListener("click", hideCtx);
document.addEventListener("keydown", e => { if (e.key === "Escape") hideCtx(); });

function modal(title, body, actions = []) {
  const ov = el("div", { class: "ov", onmousedown: e => { if (e.target === ov && !ov.dataset.lock) ov.remove(); } });
  const m = el("div", { class: "modal", role: "dialog", "aria-label": title }, el("h3", {}, title), body, el("div", { class: "row" }, actions));
  ov.append(m); document.body.append(ov);
  const f = m.querySelector("input,button"); if (f) f.focus();
  return ov;
}
const closeBtn = ov => el("button", { class: "btn", onclick: () => ov.remove() }, "Cancelar");

function promptModal(title, label, value, confirmText, onOk) {
  const inp = el("input", { class: "input", value: value || "", placeholder: label });
  let ov; const ok = el("button", { class: "btn pri", onclick: async () => { const v = inp.value.trim(); if (!v) return; ok.disabled = true; await onOk(v); ov.remove(); } }, confirmText);
  inp.addEventListener("keydown", e => { if (e.key === "Enter") ok.click(); });
  ov = modal(title, inp, [closeBtn({ remove: () => ov.remove() }), ok]);
  inp.select();
}
function newFolder() {
  promptModal("Nova pasta", "Nome da pasta", "", "Criar", async name => {
    if (await run(() => post("/api/workspace/folder/create", { folderName: name, parent: S.folder }), "Pasta criada")) {
      invalidateCache(S.user.uid, S.folder); load();
    }
  });
}
function rename(i) {
  promptModal("Renomear", "Novo nome", i.name, "Salvar", async name => {
    if (await run(() => post("/api/workspace/rename", { id: i.id, type: i._t, newName: name, parent: S.folder }), "Renomeado")) {
      invalidateCache(S.user.uid, S.folder); load();
    }
  });
}
function moveItem(i) {
  const sel = el("select", { class: "input" });
  sel.append(el("option", { value: "root" }, "Raiz"));
  S.folders.filter(f => f.id !== i.id).forEach(f => sel.append(el("option", { value: f.id }, f.name)));
  const ok = el("button", { class: "btn pri", onclick: async () => {
    ok.disabled = true;
    if (await run(() => post("/api/workspace/move", { itemId: i.id, itemType: i._t, targetFolderId: sel.value }), "Item movido")) {
      invalidateCache(S.user.uid, S.folder); ov.remove(); load();
    } else ok.disabled = false;
  } }, "Mover");
  const ov = modal("Mover para", sel, [closeBtn({ remove: () => ov.remove() }), ok]);
}

function askDelete(i) {
  const isFolder = i._t === "folder";
  const body = el("p", {}, isFolder
    ? `Excluir a pasta "${i.name}" e todo o seu conteúdo? Esta ação não pode ser desfeita.`
    : `Excluir o arquivo "${i.name}"? Esta ação não pode ser desfeita.`);
  const ok = el("button", { class: "btn pri", style: "background:var(--err);border-color:var(--err)", onclick: async () => {
    ok.disabled = true;
    const payload = isFolder
      ? { fileId: i.id, type: "folder", folderKey: S.folder }
      : { fileId: i.id, ikFileId: i.ikFileId };
    if (await run(() => post("/api/workspace/delete", payload), isFolder ? "Pasta excluída" : "Arquivo excluído")) {
      invalidateCache(S.user.uid, S.folder); ov.remove(); load();
    } else ok.disabled = false;
  } }, "Excluir");
  const ov = modal(isFolder ? "Excluir pasta" : "Excluir arquivo", body, [closeBtn({ remove: () => ov.remove() }), ok]);
}

function privacyModal(i) {
  const defs = [["private", "lock", "Privado", "Só você acessa"], ["restricted", "users", "Restrito", "Só pessoas com acesso"], ["public", "globe", "Público", "Qualquer pessoa com o link"]];
  const wrap = el("div", { style: "display:grid;gap:8px" });
  const btns = defs.map(([val, ic, name, desc]) => {
    const b = el("button", { class: "opt" + ((i.privacy || "private") === val ? " on" : ""), onclick: async () => {
      btns.forEach(x => x.disabled = true); ov.dataset.lock = "1";
      const sp = el("span", { class: "spin" }); b.append(sp);
      const w = waitPriv(i, val);
      const d = await run(() => post("/api/workspace/privacy", { itemId: i.id, type: i._t, privacy: val }));
      if (d) { await w.p; showToast("Privacidade atualizada", "success"); invalidateCache(S.user.uid, S.folder); } else w.cancel();
      delete ov.dataset.lock;
      if (d) ov.remove(); else { sp.remove(); btns.forEach(x => x.disabled = false); }
    } }, icon(ic), el("span", {}, name, el("small", {}, desc)));
    return b;
  });
  wrap.append(...btns);
  const ov = modal("Privacidade", wrap, [closeBtn({ remove: () => { if (!ov.dataset.lock) ov.remove(); } })]);
}

async function publicLink(i) {
  if ((i._priv || i.privacy) !== "public") { showToast("Mude a privacidade para Público antes de gerar o link.", "error"); return; }
  const d = await run(() => post("/api/workspace/public-share", { itemId: i.id, type: i._t }));
  if (!d) return;
  if (!d.shareUrl) { showToast("O servidor não devolveu o link público.", "error"); return; }
  const inp = el("input", { class: "input", id: "publicUrl", readonly: "", value: d.shareUrl });
  const cp = el("button", { class: "btn pri", onclick: async () => {
    try { await navigator.clipboard.writeText(inp.value); } catch { inp.select(); document.execCommand("copy"); }
    showToast("Link copiado!", "success");
  } }, ...withIcon("link", "Copiar Link"));
  const ov = modal("Link público", inp, [closeBtn({ remove: () => ov.remove() }), cp]);
}

async function shareNative(i) {
  if ((i._priv || i.privacy) !== "public") { showToast("Mude a privacidade para Público antes de compartilhar.", "error"); return; }
  const d = await run(() => post("/api/workspace/public-share", { itemId: i.id, type: i._t }));
  if (!d || !d.shareUrl) { showToast("Não foi possível gerar o link público.", "error"); return; }
  if (navigator.share) {
    try { await navigator.share({ title: i.name || "Arquivo", text: "Compartilhado do Workspace", url: d.shareUrl }); } catch (e) { if (e.name !== "AbortError") showToast("Erro: " + e.message, "error"); }
  } else {
    try { await navigator.clipboard.writeText(d.shareUrl); showToast("Link copiado!", "success"); } catch { showToast("Link: " + d.shareUrl, "info"); }
  }
}

function shareMail(i) {
  promptModal("Compartilhar por e-mail", "E-mail do destinatário", "", "Compartilhar", async email => {
    await run(() => post("/api/workspace/share", { fileId: i.id, email }), "Compartilhado");
  });
}

// ============ DOWNLOAD com extensão correta ============
async function downloadFile(i) {
  try {
    showToast("Preparando download...", "info");
    const q = new URLSearchParams({ tokenid: await token(), owner: i.ownerUid || "", type: "file", download: "true" });
    const r = await fetch(API + "/api/workspace/view/" + i.id + "?" + q, { headers: JSON_H });
    if (!r.ok) {
      if (r.status === 401) {
        showToast("Sessão expirada. Faça login novamente.", "error");
        setTimeout(() => location.replace(LOGIN_URL), 1500);
        return;
      }
      throw new Error("Falha ao baixar (" + r.status + ")");
    }

    // ⭐ Extrai o nome do Content-Disposition (com extensão real)
    let fileName = i.name || "arquivo";
    const cd = r.headers.get("Content-Disposition") || r.headers.get("content-disposition");
    if (cd) {
      const m1 = cd.match(/filename\*=UTF-8''([^;]+)/i);
      const m2 = cd.match(/filename="?([^";]+)"?/i);
      const raw = (m1 && m1[1]) || (m2 && m2[1]);
      if (raw) { try { fileName = decodeURIComponent(raw.replace(/^"|"$/g, "")); } catch { fileName = raw; } }
    }

    // Fallback: se o nome vier sem extensão, deduz pelo Content-Type
    if (!/\.[a-z0-9]{2,5}$/i.test(fileName)) {
      const ct = r.headers.get("Content-Type") || "";
      const extMap = { "image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp", "application/pdf": ".pdf", "video/mp4": ".mp4", "audio/mpeg": ".mp3", "application/zip": ".zip", "text/plain": ".txt" };
      fileName += extMap[ct] || "";
    }

    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: fileName });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast("Download iniciado: " + fileName, "success");
  } catch (e) {
    showToast("Erro ao baixar: " + e.message, "error");
  }
}

async function acceptFile(i) {
  if (await run(() => post("/api/workspace/share/accept", { fileId: i.id }), "Arquivo aceito")) {
    invalidateCache(S.user.uid, S.folder); load();
  }
}
async function viewFile(i, download = false) {
  if (download) return downloadFile(i);
  const u = await run(() => blobUrl("/api/workspace/view/" + i.id, { owner: i.ownerUid || "", type: "file" }));
  if (!u) return;
  window.open(u, "_blank");
}

async function loadNotifs() {
  const d = await get("/api/workspace/notifications").catch(() => null);
  S.notifs = (d && (d.notifications || d.items)) || [];
  const b = $("badge"); b.textContent = S.notifs.length; b.classList.toggle("hidden", !S.notifs.length);
}
function notifModal() {
  const box = el("div", { style: "display:grid;gap:8px" });
  if (!S.notifs.length) box.append(el("p", { style: "color:var(--mut)" }, "Nenhuma notificação."));
  S.notifs.forEach(n => box.append(el("div", { class: "note" }, el("span", {}, n.message || n.title || "Notificação"))));
  const ov = modal("Notificações", box, [closeBtn({ remove: () => ov.remove() })]);
}

async function uploadFiles(list) {
  const files = [...list]; if (!files.length) return;
  const name = el("div", {}), bar = el("i"), cnt = el("small", { style: "color:var(--mut)" });
  const ov = modal("Enviando arquivos", el("div", { style: "display:grid;gap:10px" }, name, el("div", { class: "pbar" }, bar), cnt), []);
  ov.dataset.lock = "1";
  for (let n = 0; n < files.length; n++) {
    const f = files[n];
    name.textContent = f.name; cnt.textContent = `Arquivo ${n + 1} de ${files.length}`; bar.style.width = "0";
    try {
      const fd = new FormData();
      fd.append("tokenid", await token()); fd.append("file", f); fd.append("filename", f.name);
      fd.append("filetype", f.type || "application/octet-stream"); fd.append("folder", S.folder);
      await new Promise((res, rej) => {
        const x = new XMLHttpRequest();
        x.open("POST", API + "/api/workspace/upload");
        x.upload.onprogress = e => { if (e.lengthComputable) bar.style.width = (e.loaded / e.total * 100) + "%"; };
        x.onload = () => { let d = {}; try { d = JSON.parse(x.responseText); } catch {} x.status < 300 && d.ok !== false ? res() : rej(new Error(d.error || "Falha no envio")); };
        x.onerror = () => rej(new Error("Erro de rede"));
        x.send(fd);
      });
      showToast(f.name + " enviado", "success");
    } catch (e) { showToast(e.message, "error"); }
  }
  ov.remove();
  invalidateCache(S.user.uid, S.folder);
  load();
}

let dragDepth = 0;
addEventListener("dragenter", e => { if (!S.user) return; e.preventDefault(); dragDepth++; $("dropOv").classList.remove("hidden"); });
addEventListener("dragleave", () => { if (--dragDepth <= 0) { dragDepth = 0; $("dropOv").classList.add("hidden"); } });
addEventListener("dragover", e => e.preventDefault());
addEventListener("drop", e => { e.preventDefault(); dragDepth = 0; $("dropOv").classList.add("hidden"); if (S.user && e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files); });

async function receberArquivoPublico() {
  const params = new URLSearchParams(location.search);
  const fileId = params.get("id");
  const ownerUid = params.get("owner");
  const type = params.get("type") || "file";
  if (!fileId) return false;
  showToast("Salvando arquivo no seu Workspace...", "info");
  try {
    const res = await post("/api/workspace/add-reference", { fileId, ownerUid: ownerUid || "root", itemType: type });
    if (res && res.ok) {
      showToast(res.mensagem || "Arquivo salvo no Workspace!", "success");
      window.history.replaceState({}, "", location.pathname + location.hash);
      invalidateCache(S.user.uid, S.folder);
      await load();
      return true;
    } else showToast(res?.erro || "Não foi possível salvar.", "error");
  } catch (e) { showToast("Erro ao salvar: " + e.message, "error"); }
  return false;
}

onAuthStateChanged(auth, async u => {
  S.user = u;
  if (!u) { location.replace(LOGIN_URL); return; }
  $("app").classList.remove("hidden");
  await receberArquivoPublico();
  load(); loadNotifs();
});

$("bNewFolder").append(...withIcon("plus", "Nova pasta"));
$("bUpload").append(...withIcon("upload", "Upload"));
$("bNotif").prepend(icon("bell"));
$("searchWrap").prepend(icon("search"));
$("bNewFolder").onclick = newFolder;
$("bUpload").onclick = () => $("fileIn").click();
$("bNotif").onclick = notifModal;
$("fileIn").onchange = e => { uploadFiles(e.target.files); e.target.value = ""; };
$("q").oninput = e => { S.q = e.target.value; render(); };
addEventListener("hashchange", () => { if (S.user) load(); });
