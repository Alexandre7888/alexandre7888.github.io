// app-menu.js - Sistema de Menu com Avatar e Gerenciador de Contas
import React, { useState, useEffect, useRef } from 'react';

// ==================== CONFIGURAÇÃO FIREBASE ====================
const firebaseConfig = {
  apiKey: "AIzaSyDon4WbCbe4kCkUq-OdLBRhzhMaUObbAfo",
  authDomain: "html-15e80.firebaseapp.com",
  databaseURL: "https://html-15e80-default-rtdb.firebaseio.com",
  projectId: "html-15e80",
  storageBucket: "html-15e80.firebasestorage.app",
  messagingSenderId: "1068148640439",
  appId: "1:1068148640439:web:7cc5bde34f4c5a5ce41b32",
  measurementId: "G-V57KRZ02HJ"
};

// ==================== COMPONENTE PRINCIPAL ====================
function AppMenu() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userData, setUserData] = useState(null);
  const [userKey, setUserKey] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [showMenu, setShowMenu] = useState(false);
  const [showAccountPanel, setShowAccountPanel] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const menuRef = useRef(null);
  const accountPanelRef = useRef(null);
  
  const MAX_ACCOUNTS = 5;
  
  // Apps do menu
  const apps = [
    { id: 'editor', name: 'Editor', icon: '📝', url: 'editor.html' },
    { id: 'clock', name: 'Relógio', icon: '🕐', url: 'clock.html' },
    { id: 'compass', name: 'Bússola', icon: '🧭', url: 'compass.html' },
    { id: 'notes', name: 'Notas', icon: '📋', url: 'notes.html' },
    { id: 'calc', name: 'Calc', icon: '🔢', url: 'calc.html' },
    { id: 'weather', name: 'Clima', icon: '🌤️', url: 'weather.html' },
    { id: 'tasks', name: 'Tarefas', icon: '✅', url: 'tasks.html' },
    { id: 'chat', name: 'Chat', icon: '💬', url: 'chat.html' },
    { id: 'files', name: 'Arquivos', icon: '📁', url: 'files.html' },
    { id: 'settings', name: 'Config', icon: '⚙️', url: 'settings.html' },
    { id: 'profile', name: 'Perfil', icon: '👤', url: 'profile.html' },
    { id: 'help', name: 'Ajuda', icon: '❓', url: 'help.html' },
  ];
  
  // Inicializar
  useEffect(() => {
    init();
  }, []);
  
  // Fechar menus ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (accountPanelRef.current && !accountPanelRef.current.contains(event.target)) {
        setShowAccountPanel(false);
      }
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  async function init() {
    // Pegar userKey da URL ou localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const urlUserKey = urlParams.get('userKey');
    const localUserKey = localStorage.getItem('current_userKey');
    
    const activeUserKey = urlUserKey || localUserKey;
    
    if (activeUserKey) {
      setUserKey(activeUserKey);
      await loadUserData(activeUserKey);
    }
    
    loadAccounts();
    setLoading(false);
  }
  
  async function loadUserData(key) {
    try {
      const { getDatabase, ref, get } = await import('firebase/database');
      const database = getDatabase();
      
      const snapshot = await get(ref(database, `userKeysData/${key}`));
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const userInfo = data.authTokenDecoded || data;
        setUserData(userInfo);
        setIsAuthenticated(true);
        
        // Salvar no localStorage
        localStorage.setItem('current_userKey', key);
        localStorage.setItem('auth_token', data.authToken);
        localStorage.setItem('token_user_id', userInfo.uid);
      }
    } catch (error) {
      console.error('Erro ao carregar usuário:', error);
    }
  }
  
  function loadAccounts() {
    const savedAccounts = JSON.parse(localStorage.getItem('codehub_deviceAccounts') || '[]');
    setAccounts(savedAccounts);
  }
  
  // Abrir app com userKey
  function openApp(url) {
    const key = userKey || localStorage.getItem('current_userKey');
    if (key) {
      const separator = url.includes('?') ? '&' : '?';
      window.location.href = `${url}${separator}userKey=${key}`;
    } else {
      window.location.href = url;
    }
  }
  
  // Trocar de conta
  async function switchAccount(account) {
    if (account.userKey) {
      localStorage.setItem('current_userKey', account.userKey);
      localStorage.setItem('auth_token', account.authToken || '');
      localStorage.setItem('token_user_id', account.uid);
      
      setUserKey(account.userKey);
      await loadUserData(account.userKey);
      setShowAccountPanel(false);
      
      // Recarregar para aplicar
      window.location.reload();
    }
  }
  
  // Remover conta
  function removeAccount(uid) {
    if (confirm('Tem certeza que deseja remover esta conta deste dispositivo?')) {
      const updatedAccounts = accounts.filter(acc => acc.uid !== uid);
      localStorage.setItem('codehub_deviceAccounts', JSON.stringify(updatedAccounts));
      setAccounts(updatedAccounts);
      
      // Se removeu a conta atual, fazer logout
      if (userData && userData.uid === uid) {
        handleLogout();
      }
    }
  }
  
  // Logout
  function handleLogout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('token_user_id');
    localStorage.removeItem('current_userKey');
    setIsAuthenticated(false);
    setUserData(null);
    setUserKey(null);
    setShowAccountPanel(false);
  }
  
  // Ir para página de login
  function goToAuth() {
    window.location.href = 'auth.html';
  }
  
  // Pegar primeira letra do nome
  function getAvatarLetter() {
    if (userData && userData.username) {
      return userData.username.charAt(0).toUpperCase();
    }
    if (userData && userData.email) {
      return userData.email.charAt(0).toUpperCase();
    }
    return '?';
  }
  
  // Gerar cor do avatar baseado no nome
  function getAvatarColor() {
    const name = (userData?.username || userData?.email || 'user');
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = ['#4361ee', '#f72585', '#4cc9f0', '#7209b7', '#f8961e', '#43aa8b', '#e63946', '#277da1'];
    return colors[Math.abs(hash) % colors.length];
  }
  
  if (loading) {
    return null;
  }
  
  return (
    <>
      <style>{`
        /* ========== ESTILOS DO COMPONENTE ========== */
        .app-menu-container {
          position: fixed;
          top: 20px;
          left: 20px;
          z-index: 10000;
        }
        
        /* Botão do menu 4x4 */
        .menu-grid-button {
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
          border: 1px solid rgba(67, 97, 238, 0.3);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
          transition: all 0.3s ease;
        }
        
        .menu-grid-button:hover {
          transform: scale(1.1);
          box-shadow: 0 12px 30px rgba(67, 97, 238, 0.4);
        }
        
        .menu-dot {
          width: 100%;
          height: 100%;
          background: rgba(67, 97, 238, 0.8);
          border-radius: 50%;
          transition: all 0.3s ease;
        }
        
        /* Avatar do usuário */
        .user-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 20px;
          color: white;
          border: 2px solid rgba(255, 255, 255, 0.3);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
          transition: all 0.3s ease;
          position: relative;
        }
        
        .user-avatar:hover {
          transform: scale(1.1);
          box-shadow: 0 12px 30px rgba(67, 97, 238, 0.4);
        }
        
        .user-avatar .online-dot {
          position: absolute;
          bottom: 2px;
          right: 2px;
          width: 12px;
          height: 12px;
          background: #4cc9f0;
          border-radius: 50%;
          border: 2px solid rgba(20, 25, 45, 0.9);
        }
        
        /* Overlay do menu de apps */
        .apps-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
          z-index: 9999;
          display: flex;
          justify-content: center;
          align-items: center;
          backdrop-filter: blur(5px);
        }
        
        .apps-grid {
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
        }
        
        @keyframes slideIn {
          from { opacity: 0; transform: scale(0.9) translateY(-20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        
        .app-item {
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
        }
        
        .app-item:hover {
          background: rgba(67, 97, 238, 0.2);
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(67, 97, 238, 0.3);
        }
        
        .app-icon {
          font-size: 28px;
          margin-bottom: 8px;
        }
        
        .app-name {
          color: white;
          font-size: 12px;
          font-weight: 500;
        }
        
        /* Painel de contas (lateral direita) */
        .account-panel {
          position: fixed;
          top: 0;
          right: 0;
          width: 320px;
          height: 100%;
          background: rgba(20, 25, 45, 0.98);
          backdrop-filter: blur(20px);
          z-index: 10001;
          box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5);
          border-left: 1px solid rgba(67, 97, 238, 0.3);
          animation: slideRight 0.3s ease-out;
          overflow-y: auto;
          padding: 20px;
        }
        
        @keyframes slideRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        
        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .panel-title {
          color: white;
          font-size: 18px;
          font-weight: 600;
        }
        
        .panel-close {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s;
        }
        
        .panel-close:hover {
          background: rgba(247, 37, 133, 0.5);
        }
        
        .account-card {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 15px;
          margin-bottom: 10px;
          cursor: pointer;
          transition: all 0.3s;
          border: 1px solid transparent;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .account-card:hover {
          background: rgba(67, 97, 238, 0.2);
          border-color: rgba(67, 97, 238, 0.4);
        }
        
        .account-card.active {
          background: rgba(67, 97, 238, 0.3);
          border-color: rgba(67, 97, 238, 0.6);
        }
        
        .account-card-info {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .account-card-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 16px;
          color: white;
          flex-shrink: 0;
        }
        
        .account-card-details {
          flex: 1;
        }
        
        .account-card-name {
          color: white;
          font-weight: 600;
          font-size: 14px;
        }
        
        .account-card-email {
          color: #a0b3c9;
          font-size: 11px;
        }
        
        .account-card-badge {
          font-size: 18px;
          margin-left: 10px;
        }
        
        .btn-panel {
          width: 100%;
          padding: 12px;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          margin-top: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        
        .btn-add {
          background: rgba(76, 201, 240, 0.2);
          color: #4cc9f0;
          border: 1px solid rgba(76, 201, 240, 0.4);
        }
        
        .btn-add:hover {
          background: rgba(76, 201, 240, 0.4);
        }
        
        .btn-remove {
          background: rgba(247, 37, 133, 0.1);
          color: #f72585;
          border: 1px solid rgba(247, 37, 133, 0.3);
          font-size: 12px;
          padding: 6px 12px;
          border-radius: 8px;
        }
        
        .btn-remove:hover {
          background: rgba(247, 37, 133, 0.3);
        }
        
        .btn-logout {
          background: rgba(247, 37, 133, 0.2);
          color: #f72585;
          border: 1px solid rgba(247, 37, 133, 0.4);
        }
        
        .btn-logout:hover {
          background: rgba(247, 37, 133, 0.4);
        }
        
        .btn-login {
          background: linear-gradient(135deg, #4361ee, #7c3aed);
          color: white;
          padding: 10px 20px;
          border-radius: 20px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          border: none;
          transition: all 0.3s;
        }
        
        .btn-login:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(67, 97, 238, 0.4);
        }
        
        .account-count {
          color: #a0b3c9;
          font-size: 12px;
          text-align: center;
          margin-top: 10px;
        }
        
        @media (max-width: 480px) {
          .account-panel {
            width: 100%;
          }
          .apps-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            padding: 20px;
          }
        }
      `}</style>
      
      <div className="app-menu-container" ref={menuRef}>
        {/* Menu de grade 4x4 */}
        <div className="menu-grid-button" onClick={() => setShowMenu(!showMenu)} title="Aplicativos">
          {[...Array(16)].map((_, i) => (
            <div key={i} className="menu-dot" />
          ))}
        </div>
      </div>
      
      {/* Avatar ou botão de login */}
      <div style={{ position: 'fixed', top: '20px', right: '80px', zIndex: 10000 }}>
        {isAuthenticated ? (
          <div 
            className="user-avatar" 
            style={{ background: getAvatarColor() }}
            onClick={() => setShowAccountPanel(!showAccountPanel)}
            title={userData?.username || userData?.email || 'Usuário'}
          >
            {getAvatarLetter()}
            <div className="online-dot" />
          </div>
        ) : (
          <button className="btn-login" onClick={goToAuth}>
            🔐 Fazer Login
          </button>
        )}
      </div>
      
      {/* Overlay do menu de apps */}
      {showMenu && (
        <div className="apps-overlay" onClick={(e) => {
          if (e.target.className === 'apps-overlay') setShowMenu(false);
        }}>
          <div className="apps-grid">
            {apps.map(app => (
              <div 
                key={app.id} 
                className="app-item"
                onClick={() => {
                  setShowMenu(false);
                  openApp(app.url);
                }}
              >
                <div className="app-icon">{app.icon}</div>
                <div className="app-name">{app.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Painel de contas (lateral direita) */}
      {showAccountPanel && (
        <div className="account-panel" ref={accountPanelRef}>
          <div className="panel-header">
            <div className="panel-title">👤 Contas</div>
            <button className="panel-close" onClick={() => setShowAccountPanel(false)}>✕</button>
          </div>
          
          {/* Lista de contas */}
          {accounts.map((account, index) => (
            <div 
              key={index} 
              className={`account-card ${userData?.uid === account.uid ? 'active' : ''}`}
              onClick={() => switchAccount(account)}
            >
              <div className="account-card-info">
                <div 
                  className="account-card-avatar"
                  style={{ background: getAvatarColorForAccount(account) }}
                >
                  {(account.username || account.email || '?').charAt(0).toUpperCase()}
                </div>
                <div className="account-card-details">
                  <div className="account-card-name">{account.username || account.email}</div>
                  <div className="account-card-email">{account.email}</div>
                </div>
              </div>
              <div className="account-card-badge">
                {account.userType === 'entrepreneur' ? '🏢' : '👤'}
              </div>
              <button 
                className="btn-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  removeAccount(account.uid);
                }}
                title="Remover conta"
              >
                ✕
              </button>
            </div>
          ))}
          
          {/* Botões de ação */}
          {accounts.length < MAX_ACCOUNTS && (
            <button className="btn-panel btn-add" onClick={goToAuth}>
              ➕ Adicionar Conta
            </button>
          )}
          
          <button className="btn-panel btn-logout" onClick={handleLogout}>
            🚪 Sair
          </button>
          
          <div className="account-count">
            {accounts.length}/{MAX_ACCOUNTS} contas neste dispositivo
          </div>
        </div>
      )}
    </>
  );
}

// Função auxiliar para cor do avatar
function getAvatarColorForAccount(account) {
  const name = account.username || account.email || 'user';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ['#4361ee', '#f72585', '#4cc9f0', '#7209b7', '#f8961e', '#43aa8b', '#e63946', '#277da1'];
  return colors[Math.abs(hash) % colors.length];
}

export default AppMenu;
