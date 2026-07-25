const { useState, useEffect, useRef } = React;

const MAX_ACCOUNTS = 5;

const apps = [
  { id:'settings', name:'Config', icon:'⚙️', url:'settings.html' },
  { id:'MENSAGENS', name:'mensagens', icon:'✉️', url:'https://app.mensagens.site.je/' }
];

function getAvatarColor(name) {
  const colors = ['#4361ee','#f72585','#4cc9f0','#7209b7','#f8961e','#43aa8b','#e63946','#277da1'];
  let hash = 0;
  for (let i = 0; i < (name||'?').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function AppMenu() {
  const [masterKey, setMasterKey] = useState(null);
  const [isAuth, setIsAuth] = useState(false);
  const [userData, setUserData] = useState(null);
  const [userKey, setUserKey] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [showMenu, setShowMenu] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [loading, setLoading] = useState(true);

  // ESTADOS DO HOVER E PIN (PUTER STYLE)
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  const panelRef = useRef(null);
  const dbRef = useRef(null);

  useEffect(() => {
    async function initFirebase() {
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js');
      const { getDatabase } = await import('https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js');
      
      const app = initializeApp({
        apiKey: "AIzaSyDon4WbCbe4kCkUq-OdLBRhzhMaUObbAfo",
        authDomain: "html-15e80.firebaseapp.com",
        databaseURL: "https://html-15e80-default-rtdb.firebaseio.com",
        projectId: "html-15e80",
        storageBucket: "html-15e80.firebasestorage.app",
        messagingSenderId: "1068148640439",
        appId: "1:1068148640439:web:7cc5bde34f4c5a5ce41b32"
      });
      
      dbRef.current = getDatabase(app);
      await init();
    }
    
    initFirebase();
    
    document.addEventListener('mousedown', (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setShowPanel(false);
    });
    
    const interval = setInterval(async () => {
      if (masterKey) await loadAccounts();
      if (userKey) await loadCurrentUser();
    }, 3000);
    
    return () => clearInterval(interval);
  }, [masterKey, userKey]);

  async function init() {
    const mk = localStorage.getItem('codehub_masterKey');
    if (mk) {
      setMasterKey(mk);
      await loadAccounts(mk);
    }
    
    const urlKey = new URLSearchParams(window.location.search).get('userKey');
    const localKey = localStorage.getItem('current_userKey');
    const key = urlKey || localKey;
    
    if (key) {
      setUserKey(key);
      localStorage.setItem('current_userKey', key);
      await loadUserData(key);
    }
    
    setLoading(false);
  }

  async function loadAccounts(mk) {
    const key = mk || masterKey;
    if (!key || !dbRef.current) return;
    
    try {
      const { ref, get } = await import('https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js');
      const snap = await get(ref(dbRef.current, `contas/${key}`));
      
      if (snap.exists()) {
        setAccounts(Object.values(snap.val()));
      } else {
        setAccounts([]);
      }
    } catch(e) {
      console.error('Erro:', e);
    }
  }

  async function loadCurrentUser() {
    const key = userKey || localStorage.getItem('current_userKey');
    if (!key) return;
    await loadUserData(key);
  }

  async function loadUserData(key) {
    if (!key || !dbRef.current) return;
    
    try {
      const { ref, get } = await import('https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js');
      const snap = await get(ref(dbRef.current, `userKeysData/${key}`));
      
      if (snap.exists()) {
        const data = snap.val();
        const user = data.authTokenDecoded || data;
        setUserData(user);
        setIsAuth(true);
        setUserKey(key);
        
        const mk = user.masterKey || data.masterKey;
        if (mk && mk !== masterKey) {
          setMasterKey(mk);
          localStorage.setItem('codehub_masterKey', mk);
          await loadAccounts(mk);
        }
      }
    } catch(e) {
      console.error('Erro:', e);
    }
  }

  async function removeAccount(uid) {
    if (!masterKey || !dbRef.current) return;
    if (!confirm('Remover esta conta? (Afeta todos os dispositivos)')) return;
    
    try {
      const { ref, get, set } = await import('https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js');
      const snap = await get(ref(dbRef.current, `contas/${masterKey}`));
      
      if (snap.exists()) {
        const contas = snap.val();
        delete contas[uid];
        await set(ref(dbRef.current, `contas/${masterKey}`), contas);
        setAccounts(Object.values(contas));
      }
      
      if (userData?.uid === uid) {
        localStorage.removeItem('current_userKey');
        setIsAuth(false);
        setUserData(null);
        setUserKey(null);
      }
    } catch(e) {
      console.error('Erro:', e);
    }
  }

  function openApp(url) {
    const key = userKey || localStorage.getItem('current_userKey');
    const sep = url.includes('?') ? '&' : '?';
    window.location.href = key ? `${url}${sep}userKey=${key}` : url;
  }

  async function switchAccount(acc) {
    if (acc.userKey) {
      localStorage.setItem('current_userKey', acc.userKey);
      window.location.href = window.location.pathname + '?userKey=' + acc.userKey;
    }
  }

  function handleLogout() {
    if (!confirm('Sair?')) return;
    localStorage.removeItem('current_userKey');
    window.location.href = window.location.pathname;
  }

  async function handleOpenPanel() {
    if (masterKey) await loadAccounts(masterKey);
    setShowPanel(true);
  }

  if (loading) {
    return React.createElement('div', {
      style: { position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',color:'#fff',fontSize:18,zIndex:99999 }
    }, '⏳ Carregando...');
  }

  const name = userData?.username || userData?.email || 'Code';
  const letter = name.charAt(0).toUpperCase();

  // Define se a barra está expandida (se o mouse está em cima OU se clicou para fixar)
  const isOpen = isHovered || isPinned;

  return React.createElement('div', null,

    // ==================== BARRA NOTCH DINÂMICA (PUTER STYLE) ====================
    React.createElement('div', {
      onMouseEnter: () => setIsHovered(true),
      onMouseLeave: () => setIsHovered(false),
      onClick: () => setIsPinned(!isPinned), // Clicar alterna entre fixo e auto-hide
      style: {
        position: 'fixed',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: isOpen ? '10px' : '6px',
        background: 'rgba(18, 18, 20, 0.92)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderTop: 'none',
        borderBottomLeftRadius: '12px',
        borderBottomRightRadius: '12px',
        padding: isOpen ? '6px 14px' : '2px 12px',
        boxShadow: isOpen ? '0 10px 30px rgba(0, 0, 0, 0.6)' : '0 2px 10px rgba(0, 0, 0, 0.3)',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        userSelect: 'none',
        minWidth: isOpen ? '220px' : '90px',
        height: isOpen ? '36px' : '12px',
        overflow: 'hidden'
      }
    },
      // SE ESTIVER RECOLHIDO: Exibe apenas o tracinho indicador (Mini-Notch)
      !isOpen ? React.createElement('div', {
        style: {
          width: '32px',
          height: '3px',
          background: 'rgba(255, 255, 255, 0.5)',
          borderRadius: '2px'
        }
      }) : 
      
      // SE ESTIVER EXPANDIDO: Exibe a barra completa com controles
      React.createElement(React.Fragment, null,
        // Ícone App / Menu 4x4
        React.createElement('div', {
          onClick: (e) => { e.stopPropagation(); setShowMenu(true); },
          title: "Abrir Apps",
          style: {
            width: 20,
            height: 20,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '2px',
            padding: '2px',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '4px'
          }
        }, [...Array(4)].map((_, i) =>
          React.createElement('div', { key: i, style: { background: '#e1e1e1', borderRadius: '1px' } })
        )),

        // Título / Conta
        React.createElement('div', {
          onClick: (e) => { e.stopPropagation(); handleOpenPanel(); },
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: '#fff',
            fontSize: '12px',
            fontWeight: 500,
            flex: 1,
            justifyContent: 'center'
          }
        },
          React.createElement('span', {
            style: {
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: isAuth ? '#2ecc71' : '#e74c3c'
            }
          }),
          React.createElement('span', null, name)
        ),

        // Botões Minimizar / Fechar Janela
        React.createElement('div', { style: { display: 'flex', gap: '8px', opacity: 0.7 } },
          React.createElement('span', {
            onClick: (e) => { e.stopPropagation(); setIsPinned(false); setIsHovered(false); },
            title: "Recolher",
            style: { fontSize: '11px', color: '#fff' }
          }, '─'),
          React.createElement('span', {
            onClick: (e) => { e.stopPropagation(); setIsPinned(false); setIsHovered(false); },
            title: "Fechar",
            style: { fontSize: '11px', color: '#fff' }
          }, '✕')
        )
      )
    ),

    // ==================== OVERLAY DE APPS ====================
    showMenu ? React.createElement('div', {
      onClick: (e) => { if(e.target===e.currentTarget) setShowMenu(false) },
      style: { position:'fixed',top:0,left:0,width:'100%',height:'100%',background:'rgba(0,0,0,0.6)',zIndex:9999,display:'flex',justifyContent:'center',alignItems:'center',backdropFilter:'blur(8px)' }
    },
      React.createElement('div', {
        style: { background:'rgba(25,26,30,0.95)',borderRadius:16,padding:24,display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,maxWidth:320,width:'90%',border:'1px solid rgba(255,255,255,0.1)',boxShadow:'0 20px 50px rgba(0,0,0,0.6)' }
      }, apps.map(app =>
        React.createElement('div', {
          key: app.id,
          onClick: () => { setShowMenu(false); openApp(app.url) },
          style: { display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:16,background:'rgba(255,255,255,0.04)',borderRadius:10,cursor:'pointer',transition:'0.2s',border:'1px solid rgba(255,255,255,0.05)' }
        },
          React.createElement('div', { style:{ fontSize:24,marginBottom:6 } }, app.icon),
          React.createElement('div', { style:{ color:'#fff',fontSize:12,fontWeight:500 } }, app.name)
        )
      ))
    ) : null,

    // ==================== PAINEL LATERAL DE CONTAS ====================
    showPanel ? React.createElement('div', {
      ref: panelRef,
      style: { position:'fixed',top:0,right:0,width:320,height:'100%',background:'rgba(20,21,25,0.96)',backdropFilter:'blur(20px)',zIndex:10001,boxShadow:'-10px 0 30px rgba(0,0,0,0.5)',borderLeft:'1px solid rgba(255,255,255,0.1)',overflowY:'auto',padding:20 }
    },
      React.createElement('div', {
        style: { display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,paddingBottom:12,borderBottom:'1px solid rgba(255,255,255,0.1)' }
      },
        React.createElement('div', { style:{ color:'#fff',fontSize:16,fontWeight:600 } }, '👤 Gerenciar Contas'),
        React.createElement('button', {
          onClick: () => setShowPanel(false),
          style: { background:'transparent',border:'none',color:'rgba(255,255,255,0.6)',cursor:'pointer',fontSize:16 }
        }, '✕')
      ),

      isAuth && userData ? React.createElement('div', {
        style: { background:'rgba(255,255,255,0.05)',borderRadius:10,padding:12,marginBottom:15,color:'#fff',textAlign:'center',border:'1px solid rgba(255,255,255,0.08)' }
      },
        React.createElement('div', { style:{ fontWeight:600,fontSize:14 } }, '✅ ' + (userData.username || userData.email)),
        React.createElement('div', { style:{ fontSize:10,opacity:0.6,marginTop:4 } }, 'Key: ' + (userKey||'').substring(0,22) + '...')
      ) : null,

      React.createElement('div', { style:{ color:'rgba(255,255,255,0.7)',fontSize:12,fontWeight:600,marginBottom:10 } },
        '📋 Contas Registradas (' + accounts.length + '/' + MAX_ACCOUNTS + ')'
      ),

      accounts.length === 0 ?
        React.createElement('div', { style:{ color:'#888',textAlign:'center',padding:20 } },
          React.createElement('div', { style:{ fontSize:32,marginBottom:8 } }, '☁️'),
          React.createElement('div', { style:{ fontSize:13 } }, 'Nenhuma conta salva'),
          React.createElement('div', { style:{ fontSize:11,opacity:0.6,marginTop:4 } }, 'Faça login para adicionar')
        )
      : accounts.map(acc =>
          React.createElement('div', {
            key: acc.uid,
            onClick: () => switchAccount(acc),
            style: { background:userData?.uid===acc.uid?'rgba(67,97,238,0.2)':'rgba(255,255,255,0.03)',borderRadius:10,padding:12,marginBottom:8,cursor:'pointer',border:userData?.uid===acc.uid?'1px solid rgba(67,97,238,0.5)':'1px solid rgba(255,255,255,0.05)',display:'flex',alignItems:'center',gap:10 }
          },
            React.createElement('div', {
              style: { width:36,height:36,borderRadius:'50%',background:getAvatarColor(acc.username||acc.email||'?'),display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,color:'#fff',flexShrink:0 }
            }, (acc.username||acc.email||'?').charAt(0).toUpperCase()),
            React.createElement('div', { style:{ flex:1,minWidth:0 } },
              React.createElement('div', { style:{ color:'#fff',fontWeight:600,fontSize:13,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' } },
                (acc.username||acc.email) + (userData?.uid===acc.uid?' ✓':'')
              ),
              React.createElement('div', { style:{ color:'rgba(255,255,255,0.5)',fontSize:11,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' } }, acc.email)
            ),
            React.createElement('button', {
              onClick: (e) => { e.stopPropagation(); removeAccount(acc.uid) },
              style: { background:'rgba(247,37,133,0.15)',color:'#f72585',border:'none',padding:'4px 8px',borderRadius:6,cursor:'pointer',fontSize:11 }
            }, '✕')
          )
        ),

      accounts.length < MAX_ACCOUNTS ?
        React.createElement('button', {
          onClick: () => window.location.href = 'auth.html',
          style: { width:'100%',padding:10,borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',marginTop:12,color:'#4cc9f0',background:'rgba(76,201,240,0.12)',border:'1px solid rgba(76,201,240,0.3)' }
        }, '➕ Adicionar Conta')
      : null,

      isAuth ?
        React.createElement('button', {
          onClick: handleLogout,
          style: { width:'100%',padding:10,borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',marginTop:8,color:'#f72585',background:'rgba(247,37,133,0.12)',border:'1px solid rgba(247,37,133,0.3)' }
        }, '🚪 Sair')
      : null
    ) : null
  );
}

window.AppMenu = AppMenu;
