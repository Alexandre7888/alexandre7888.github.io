window.WORKER_URL = "https://proud-flower-677b.braatzjunioralexandre5.workers.dev";
window.VERCEL_URL = "https://api.codehub.giize.com";
let itemSelecionado = null;

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  void toast.offsetWidth;
  toast.classList.add('show');
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

window.toggleNotif = function(e) {
  e.stopPropagation();
  document.getElementById('notifDropdown').classList.toggle('active');
};

document.addEventListener('click', (e) => {
  if (!e.target.closest('#notifDropdown') && !e.target.closest('.btn-notif')) {
    document.getElementById('notifDropdown').classList.remove('active');
  }
  document.getElementById('contextMenu').classList.remove('active');
});

window.fecharModal = function(id) { document.getElementById(id).classList.remove('active'); };

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const cfg = { 
  apiKey: "AIzaSyDon4WbCbe4kCkUq-OdLBRhzhMaUObbAfo", 
  authDomain: "html-15e80.firebaseapp.com", 
  projectId: "html-15e80", 
  appId: "1:1068148640439:web:1ac651348e624f6be41b32" 
};
const app = initializeApp(cfg);
const auth = getAuth(app);

let currentToken = null;
let pastasGlobais = [];
const filesGrid = document.getElementById('filesGrid');

if (typeof AppShell !== "undefined") { try { new AppShell().mount(); } catch (e) {} }

const SVG_FOLDER = `<svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
const SVG_PDF = `<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>`;
const SVG_TRASH = `<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`;
const SVG_LOCK = `<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
const SVG_GLOBE = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
const SVG_USERS = `<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;

function getPastaAtual() { return window.location.hash.replace('#', '').replace('/', '') || "root"; }

const urlParams = new URLSearchParams(window.location.search);
const targetFileId = urlParams.get('id');
const targetOwner = urlParams.get('owner');
const targetType = urlParams.get('type') || 'file';

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentToken = await user.getIdToken();
    await carregarArquivosAPI();
    carregarNotificacoes();
    window.addEventListener('hashchange', carregarArquivosAPI);
    
    if (targetFileId) {
      showToast("Salvando no Workspace...", "info");
      try {
        const res = await fetch(`${window.WORKER_URL}/api/workspace/add-reference`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            tokenid: currentToken, 
            fileId: targetFileId, 
            ownerUid: targetOwner || 'root',
            itemType: targetType 
          })
        });
        const data = await res.json();
        if (data.ok) {
          showToast(data.mensagem, "success");
          await carregarArquivosAPI();
          setTimeout(() => {
            const el = document.getElementById(`${targetType === 'folder' ? 'folder' : 'file'}-${targetFileId}`) || document.querySelector(`[data-original-id="${targetFileId}"]`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.style.border = '2px solid var(--accent)';
              el.style.boxShadow = '0 0 15px rgba(79, 140, 255, 0.5)';
            }
          }, 500);
        } else {
          showToast("Erro: " + data.erro, "error");
        }
      } catch (err) { showToast("Erro de conexão.", "error"); }
    }
  }
});

async function carregarArquivosAPI() {
  const pasta = getPastaAtual();
  document.getElementById('folderTitle').textContent = pasta === "root" ? "Meus Arquivos" : pasta;
  
  filesGrid.innerHTML = '<div style="grid-column: 1/-1; display: flex; justify-content: center; padding: 40px;"><div class="spinner" style="width: 40px; height: 40px;"></div></div>';
  
  try {
    const res = await fetch(`${window.WORKER_URL}/api/workspace/list?tokenid=${currentToken}&folder=${pasta}`);
    const data = await res.json();
    filesGrid.innerHTML = '';
    pastasGlobais = data.folders || [];
    
    if (data.files.length === 0 && data.folders.length === 0) {
      filesGrid.innerHTML = '<p style="color: var(--text-2); text-align: center; grid-column: 1/-1;">Pasta vazia.</p>';
      return;
    }
    data.folders.forEach(f => renderizarPasta(f));
    data.files.forEach(f => renderizarArquivo(f));
  } catch (e) { filesGrid.innerHTML = '<p style="color: red; text-align: center; grid-column: 1/-1;">Erro ao carregar.</p>'; }
}

async function carregarNotificacoes() {
  try {
    const res = await fetch(`${window.WORKER_URL}/api/workspace/notifications?tokenid=${currentToken}`);
    const data = await res.json();
    const badge = document.getElementById('notifBadge');
    const list = document.getElementById('notifList');
    
    if (data.ok && data.notifications.length > 0) {
      const naoLidas = data.notifications.filter(n => !n.read).length;
      if (naoLidas > 0) { badge.style.display = 'flex'; badge.textContent = naoLidas; } else { badge.style.display = 'none'; }
      
      list.innerHTML = data.notifications.map(n => `
        <div class="notif-item">
          <strong>${n.title}</strong><br>${n.message}
          <div class="notif-time">${new Date(n.timestamp).toLocaleString('pt-BR')}</div>
        </div>
      `).join('');
    } else {
      list.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-2);">Nenhuma notificação.</div>';
    }
  } catch (e) {}
}

window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());

const dropZone = document.getElementById('dropZone');
window.addEventListener('dragenter', (e) => { e.preventDefault(); dropZone.classList.add('active'); });
dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); if (e.relatedTarget === null) dropZone.classList.remove('active'); });
dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropZone.classList.remove('active');
  if (e.dataTransfer.files.length > 0) await uploadMultiplosArquivos(e.dataTransfer.files);
});

async function uploadMultiplosArquivos(files) {
  const spinner = document.getElementById('uploadSpinner');
  const spinnerText = document.getElementById('uploadFileName');
  spinner.classList.add('active');

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    spinnerText.textContent = `Enviando ${i + 1} de ${files.length}: ${file.name}`;
    
    const formData = new FormData();
    formData.append('tokenid', currentToken);
    formData.append('file', file);
    formData.append('filename', file.name);
    formData.append('filetype', file.type);
    formData.append('folder', getPastaAtual());

    try {
      const res = await fetch(window.WORKER_URL + '/api/workspace/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!data.ok) throw new Error(data.erro);
      showToast(`"${file.name}" enviado com sucesso!`, "success");
    } catch (e) {
      showToast(`Erro ao enviar "${file.name}": ${e.message}`, "error");
    }
  }
  spinner.classList.remove('active');
  carregarArquivosAPI();
}

function configurarCliqueDireito(el, item) {
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    itemSelecionado = item;
    const menu = document.getElementById('contextMenu');
    menu.style.top = `${e.pageY}px`; menu.style.left = `${e.pageX}px`;
    menu.classList.add('active');
  });
}

function renderizarPasta(folder) {
  const el = document.createElement('div');
  el.className = 'folder-card';
  el.id = `folder-${folder.id}`;
  el.dataset.originalId = folder.originalId || '';
  el.ondblclick = () => { window.location.hash = `${folder.name}/`; };
  configurarCliqueDireito(el, { ...folder, isFolder: true });
  
  let pClass = folder.privacy || 'private';
  let pIcon = pClass === 'public' ? SVG_GLOBE : (pClass === 'restricted' ? SVG_USERS : SVG_LOCK);

  el.innerHTML = `
    <div class="privacy-badge ${pClass}" title="${pClass}">${pIcon}</div>
    <div class="icon-placeholder">${SVG_FOLDER}</div>
    <div class="file-name">${folder.name}</div>
  `;
  filesGrid.prepend(el);
}

function renderizarArquivo(file) {
  const el = document.createElement('div');
  el.className = 'file-card';
  el.id = `file-${file.id}`;
  el.dataset.originalId = file.originalId || '';
  configurarCliqueDireito(el, { ...file, isFolder: false });
  
  const isImg = file.type && file.type.startsWith('image/');
  let visual = isImg ? `<img src="${file.url}" loading="lazy" style="${file.needsAccept ? 'filter: blur(4px);' : ''}">` : `<div class="icon-placeholder">${SVG_PDF}</div>`;
  
  let pClass = file.privacy || 'private';
  let pIcon = pClass === 'public' ? SVG_GLOBE : (pClass === 'restricted' ? SVG_USERS : SVG_LOCK);

  const overlayAccept = file.needsAccept ? `
    <div style="position:absolute; inset:0; background:rgba(0,0,0,0.6); display:flex; flex-direction:column; align-items:center; justify-content:center; border-radius:12px; z-index:2;">
      <p style="font-size:0.75rem; color:white; margin-bottom:5px;">Recebido</p>
      <button onclick="event.stopPropagation(); aceitarCompartilhamento('${file.id}')" style="background:var(--accent); color:white; border:none; padding:6px 12px; border-radius:6px; font-weight:bold; cursor:pointer;">Aceitar</button>
    </div>` : '';

  el.innerHTML = `
    <div class="privacy-badge ${pClass}" title="${pClass}">${pIcon}</div>
    <div style="position:relative;">${visual}${overlayAccept}</div>
    <div class="file-name">${file.name}</div>
    <button class="btn-delete-file" onclick="event.stopPropagation(); deletarItemDireto('${file.id}', '${file.ikFileId}')">${SVG_TRASH}</button>
  `;
  filesGrid.prepend(el);
}

window.filtrarItens = function() {
  const termo = document.getElementById('searchInput').value.toLowerCase();
  document.querySelectorAll('.file-card, .folder-card').forEach(card => {
    card.style.display = card.querySelector('.file-name').textContent.toLowerCase().includes(termo) ? 'block' : 'none';
  });
};

window.aceitarCompartilhamento = async function(fileId) {
  try {
    showToast("Aceitando arquivo...", "info");
    const res = await fetch(window.WORKER_URL + '/api/workspace/share/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenid: currentToken, fileId: fileId })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.erro);
    showToast("Arquivo aceito!", "success");
    carregarArquivosAPI();
  } catch (e) { showToast("Erro ao aceitar: " + e.message, "error"); }
};

window.abrirVisualizador = function() {
  if (itemSelecionado) {
    window.open(`https://api.codehub.giize.com/api?action=view&id=${itemSelecionado.id}&token=${currentToken}&owner=${itemSelecionado.ownerUid || ''}&type=${itemSelecionado.isFolder ? 'folder' : 'file'}`, '_blank');
  }
};

window.baixarArquivo = function() {
  if (itemSelecionado && !itemSelecionado.isFolder) {
    window.open(`https://api.codehub.giize.com/api?action=stream&id=${itemSelecionado.id}&token=${currentToken}&download=true`, '_blank');
  }
};

window.abrirModalNovaPasta = function() {
  document.getElementById('newFolderName').value = '';
  document.getElementById('newFolderModal').classList.add('active');
  document.getElementById('newFolderName').focus();
};

window.salvarNovaPasta = async function() {
  const nome = document.getElementById('newFolderName').value.trim();
  if (!nome) return showToast("Digite um nome.", "error");
  
  try {
    await fetch(window.WORKER_URL + '/api/workspace/folder/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenid: currentToken, folderName: nome, parent: getPastaAtual() })
    });
    showToast("Pasta criada!", "success");
    fecharModal('newFolderModal'); carregarArquivosAPI();
  } catch (e) { showToast("Erro ao criar pasta.", "error"); }
};

window.abrirModalRename = function() {
  document.getElementById('renameInput').value = itemSelecionado.name;
  document.getElementById('renameModal').classList.add('active');
  document.getElementById('renameInput').focus();
};

window.salvarRename = async function() {
  const novo = document.getElementById('renameInput').value.trim();
  if (!novo || novo === itemSelecionado.name) return fecharModal('renameModal');
  
  try {
    await fetch(window.WORKER_URL + '/api/workspace/rename', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenid: currentToken, id: itemSelecionado.id, type: itemSelecionado.isFolder ? 'folder' : 'file', newName: novo })
    });
    showToast("Renomeado!", "success");
    fecharModal('renameModal'); carregarArquivosAPI();
  } catch (e) { showToast("Erro ao renomear.", "error"); }
};

window.abrirModalPrivacidade = function() {
  const p = itemSelecionado.privacy || 'private';
  document.querySelectorAll('.privacy-option').forEach(opt => opt.classList.remove('active'));
  document.getElementById(`opt${p.charAt(0).toUpperCase() + p.slice(1)}`).classList.add('active');
  document.getElementById('privacyModal').classList.add('active');
};

window.selecionarPrivacidade = async function(novaPrivacidade) {
  document.querySelectorAll('.privacy-option').forEach(opt => opt.classList.remove('active'));
  document.getElementById(`opt${novaPrivacidade.charAt(0).toUpperCase() + novaPrivacidade.slice(1)}`).classList.add('active');
  
  try {
    await fetch(window.WORKER_URL + '/api/workspace/privacy', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenid: currentToken, itemId: itemSelecionado.id, type: itemSelecionado.isFolder ? 'folder' : 'file', privacy: novaPrivacidade })
    });
    showToast("Privacidade atualizada!", "success");
    itemSelecionado.privacy = novaPrivacidade;
    setTimeout(() => { fecharModal('privacyModal'); carregarArquivosAPI(); }, 500);
  } catch (e) { showToast("Erro ao atualizar.", "error"); }
};

window.abrirModalMover = function() {
  const select = document.getElementById('targetFolderSelect');
  select.innerHTML = '<option value="root">/ (Raiz)</option>';
  pastasGlobais.forEach(p => { if (p.id !== itemSelecionado.id) select.innerHTML += `<option value="${p.id}">${p.name}</option>`; });
  document.getElementById('moveModal').classList.add('active');
};

window.confirmarMover = async function() {
  const target = document.getElementById('targetFolderSelect').value;
  try {
    await fetch(window.WORKER_URL + '/api/workspace/move', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenid: currentToken, itemId: itemSelecionado.id, itemType: itemSelecionado.isFolder ? 'folder' : 'file', targetFolderId: target })
    });
    showToast("Item movido!", "success");
    fecharModal('moveModal'); carregarArquivosAPI();
  } catch (e) { showToast("Erro ao mover.", "error"); }
};

window.abrirModalCompartilhar = async function() {
  if (!itemSelecionado) return;
  if (itemSelecionado.privacy !== 'public') {
    showToast("Mude a privacidade para 'Público' primeiro!", "error");
    return;
  }

  try {
    const res = await fetch(window.WORKER_URL + '/api/workspace/public-share', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenid: currentToken, itemId: itemSelecionado.id, type: itemSelecionado.isFolder ? 'folder' : 'file' })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.erro);
    document.getElementById('publicUrl').value = data.shareUrl;
    document.getElementById('shareModal').classList.add('active');
  } catch (e) { showToast(e.message, "error"); }
};

window.copiarLink = function() {
  const input = document.getElementById('publicUrl');
  input.select(); document.execCommand("copy");
  showToast("Link copiado!", "success");
};

window.abrirModalEmail = function() {
  if (!itemSelecionado) return;
  if (itemSelecionado.privacy !== 'private') {
    showToast("Mude a privacidade para 'Privado' primeiro!", "error");
    return;
  }

  document.getElementById('shareEmail').value = '';
  document.getElementById('shareEmailModal').classList.add('active');
};

window.compartilharEmail = async function() {
  const email = document.getElementById('shareEmail').value.trim();
  if (!email) return;
  
  try {
    const res = await fetch(window.WORKER_URL + '/api/workspace/share', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenid: currentToken, fileId: itemSelecionado.id, email })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.erro);
    showToast("Compartilhado com sucesso!", "success");
    fecharModal('shareEmailModal');
  } catch (e) { showToast("Erro: " + e.message, "error"); }
};

window.deletarItem = function() {
  if (!itemSelecionado.isFolder) deletarItemDireto(itemSelecionado.id, itemSelecionado.ikFileId);
};

window.deletarItemDireto = async function(fileId, ikFileId) {
  if (!confirm("Tem certeza que deseja apagar este item?")) return;
  try {
    await fetch(window.WORKER_URL + '/api/workspace/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenid: currentToken, fileId, ikFileId })
    });
    showToast("Item apagado.", "success");
    carregarArquivosAPI();
  } catch (e) { showToast("Erro ao apagar.", "error"); }
};

window.fazerUpload = function(input) { 
  if (input.files.length > 0) uploadMultiplosArquivos(input.files); 
  input.value = ''; 
};
