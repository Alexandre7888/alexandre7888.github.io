import { json, gsGet, gsSet, GSCRIPT_URL, FIREBASE_CONFIG } from "./config.js";

// ============================================
// VALIDA A SENHA DIRETAMENTE NO FIREBASE AUTH
// ============================================
async function validarSenhaConta(email, senha) {
  try {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_CONFIG.apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: senha, returnSecureToken: true })
    });
    const data = await res.json();
    
    if (res.ok && data.idToken) return { ok: true };

    const erroFirebase = data.error?.message || "ERRO_DESCONHECIDO";
    if (erroFirebase === "INVALID_LOGIN_CREDENTIALS" || erroFirebase === "INVALID_PASSWORD") {
      return { ok: false, erro: "Senha incorreta. Tente novamente." };
    }
    if (erroFirebase === "INVALID_IDP_RESPONSE" || erroFirebase === "MISSING_PASSWORD") {
      return { ok: false, erro: "Esta conta usa login do Google e não tem senha. Crie uma senha primeiro." };
    }
    return { ok: false, erro: "Não foi possível validar a senha." };
  } catch (e) {
    return { ok: false, erro: "Erro de conexão." };
  }
}

// ============================================
// ROTA 1: CADASTRAR BIOMETRIA (CHAVE DE ACESSO)
// ============================================
export async function handleRegisterBio(request) {
  if (request.method !== "POST") return json({ ok: false, erro: "Método não permitido" }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, erro: "JSON inválido" }, 400); }

  const { tokenid, webauthnId, deviceName, email, password } = body;

  if (!tokenid || !webauthnId || !password) return json({ ok: false, erro: "Dados incompletos." }, 400);

  const validacao = await fetch(`${GSCRIPT_URL}?tokenstatus=${encodeURIComponent(tokenid)}`).then(r => r.json());
  if (!validacao.success || !validacao.uid) return json({ ok: false, erro: "Token inválido." }, 401);
  const uid = validacao.uid;
  const userEmail = email || validacao.email;

  const checkSenha = await validarSenhaConta(userEmail, password);
  if (!checkSenha.ok) return json({ ok: false, erro: checkSenha.erro }, 403);

  try {
    await gsSet(`users/${uid}/security/webauthn/${webauthnId}`, {
      webauthnId: webauthnId,
      deviceName: deviceName || "Dispositivo Desconhecido",
      criadoEm: Date.now(),
      status: "ativa"
    });
    return json({ ok: true, mensagem: "Chave criada com sucesso!" }, 200);
  } catch (e) {
    return json({ ok: false, erro: e.message }, 500);
  }
}

// ============================================
// ROTA 2: VALIDAR BIOMETRIA (Para bloqueio/desbloqueio)
// ============================================
export async function handleVerifyBio(request) {
  if (request.method !== "POST") return json({ ok: false, erro: "Método não permitido" }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, erro: "JSON inválido" }, 400); }

  const { tokenid, webauthnId } = body;
  if (!tokenid || !webauthnId) return json({ ok: false, erro: "Dados incompletos." }, 400);

  const validacao = await fetch(`${GSCRIPT_URL}?tokenstatus=${encodeURIComponent(tokenid)}`).then(r => r.json());
  if (!validacao.success || !validacao.uid) return json({ ok: false, erro: "Token inválido." }, 401);
  const uid = validacao.uid;

  try {
    const res = await gsGet(`users/${uid}/security/webauthn/${webauthnId}`);
    if (!res.ok || !res.data) return json({ ok: false, erro: "Chave não encontrada." }, 404);
    
    if (res.data.status !== "ativa") return json({ ok: false, erro: "Chave revogada." }, 403);
    
    return json({ ok: true, mensagem: "Desbloqueado com sucesso!", deviceName: res.data.deviceName }, 200);
  } catch (e) {
    return json({ ok: false, erro: e.message }, 500);
  }
}

// ============================================
// ROTA 3: LISTAR CHAVES
// ============================================
export async function handleListBio(request) {
  if (request.method !== "POST") return json({ ok: false, erro: "Método não permitido" }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, erro: "JSON inválido" }, 400); }

  const { tokenid } = body;
  if (!tokenid) return json({ ok: false, erro: "Token não enviado." }, 400);

  const validacao = await fetch(`${GSCRIPT_URL}?tokenstatus=${encodeURIComponent(tokenid)}`).then(r => r.json());
  if (!validacao.success || !validacao.uid) return json({ ok: false, erro: "Token inválido." }, 401);
  const uid = validacao.uid;

  try {
    const res = await gsGet(`users/${uid}/security/webauthn`);
    const keys = res.ok && res.data ? Object.values(res.data) : [];
    keys.sort((a, b) => b.criadoEm - a.criadoEm);
    return json({ ok: true, keys }, 200);
  } catch (e) {
    return json({ ok: false, erro: e.message }, 500);
  }
}

// ============================================
// ROTA 4: DELETAR CHAVE (Exige Senha)
// ============================================
export async function handleDeleteBio(request) {
  if (request.method !== "POST") return json({ ok: false, erro: "Método não permitido" }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, erro: "JSON inválido" }, 400); }

  const { tokenid, webauthnId, email, password } = body;
  if (!tokenid || !webauthnId || !password) return json({ ok: false, erro: "Dados incompletos." }, 400);

  const validacao = await fetch(`${GSCRIPT_URL}?tokenstatus=${encodeURIComponent(tokenid)}`).then(r => r.json());
  if (!validacao.success || !validacao.uid) return json({ ok: false, erro: "Token inválido." }, 401);
  const uid = validacao.uid;
  const userEmail = email || validacao.email;

  const checkSenha = await validarSenhaConta(userEmail, password);
  if (!checkSenha.ok) return json({ ok: false, erro: checkSenha.erro }, 403);

  try {
    await gsSet(`users/${uid}/security/webauthn/${webauthnId}`, null);
    return json({ ok: true, mensagem: "Chave deletada com sucesso!" }, 200);
  } catch (e) {
    return json({ ok: false, erro: e.message }, 500);
  }
}
