const { useState, useEffect, useRef } = React;

const MAX_ACCOUNTS = 5;

const apps = [
  { id:'editor', name:'Editor', icon:'📝', url:'editor.html' },
  { id:'clock', name:'Relógio', icon:'🕐', url:'clock.html' },
  { id:'compass', name:'Bússola', icon:'🧭', url:'compass.html' },
  { id:'notes', name:'Notas', icon:'📋', url:'notes.html' },
  { id:'calc', name:'Calc', icon:'🔢', url:'calc.html' },
  { id:'weather', name:'Clima', icon:'🌤️', url:'weather.html' },
  { id:'tasks', name:'Tarefas', icon:'✅', url:'tasks.html' },
  { id:'chat', name:'Chat', icon:'💬', url:'chat.html' },
  { id:'files', name:'Arquivos', icon:'📁', url:'files.html' },
  { id:'profile', name:'Perfil', icon:'👤', url:'profile.html' },
  { id:'help', name:'Ajuda', icon:'❓', url:'help.html' },
  { id:'settings', name:'Config', icon:'⚙️', url:'settings.html' },
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
        const data = snap.val();
        setAccounts(Object.values(data));
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

  // ==================== TROCAR DE CONTA - MUDA URL ====================
  async function switchAccount(acc) {
    if (acc.userKey) {
      // Salvar no localStorage
      localStorage.setItem('current_userKey', acc.userKey);
      
      // Mudar a URL e recarregar
      const newUrl = window.location.pathname + '?userKey=' + acc.userKey;
      window.location.href = newUrl;
    }
  }

  function handleLogout() {
    if (!confirm('Sair?')) return;
    localStorage.removeItem('current_userKey');
    // Remover userKey da URL
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

  const name = userData?.username || userData?.email || '?';
  const letter = name.charAt(0).toUpperCase();
  const avatarColor = getAvatarColor(name);

  return React.createElement('div', null,
    // Menu 4x4
    React.createElement('div', { style: { position:'fixed',top:20,left:20,zIndex:10000 } },
      React.createElement('div', {
        onClick: () => setShowMenu(true),
        style: { width:48,height:48,background:'rgba(20,25,45,0.9)',backdropFilter:'blur(10px)',borderRadius:12,cursor:'pointer',display:'grid',gridTemplateColumns:'repeat(4,1fr)',gridTemplateRows:'repeat(4,1fr)',gap:3,padding:8,border:'1px solid rgba(67,97,238,0.3)',boxShadow:'0 8px 20px rgba(0,0,0,0.4)',transition:'0.3s' }
      }, [...Array(16)].map((_,i) =>
        React.createElement('div', { key:i, style:{ width:'100%',height:'100%',background:'rgba(67,97,238,0.8)',borderRadius:'50%' } })
      ))
    ),

    // Avatar
    React.createElement('div', { style: { position:'fixed',top:20,right:90,zIndex:10000 } },
      React.createElement('div', {
        onClick: handleOpenPanel,
        style: { width:48,height:48,borderRadius:'50%',background:isAuth?avatarColor:'#6c757d',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:20,color:'#fff',border:'2px solid rgba(255,255,255,0.3)',boxShadow:'0 8px 20px rgba(0,0,0,0.4)',transition:'0.3s',position:'relative' }
      },
        isAuth ? letter : '👤',
        isAuth ? React.createElement('div', { style:{ position:'absolute',bottom:2,right:2,width:12,height:12,background:'#4cc9f0',borderRadius:'50%',border:'2px solid rgba(20,25,45,0.9)' } }) : null
      )
    ),

    // Overlay Apps
    showMenu ? React.createElement('div', {
      onClick: (e) => { if(e.target===e.currentTarget) setShowMenu(false) },
      style: { position:'fixed',top:0,left:0,width:'100%',height:'100%',background:'rgba(0,0,0,0.7)',zIndex:9999,display:'flex',justifyContent:'center',alignItems:'center',backdropFilter:'blur(5px)' }
    },
      React.createElement('div', {
        style: { background:'rgba(20,25,45,0.95)',borderRadius:20,padding:30,display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:15,maxWidth:500,width:'90%',border:'1px solid rgba(67,97,238,0.3)',boxShadow:'0 20px 40px rgba(0,0,0,0.5)' }
      }, apps.map(app =>
        React.createElement('div', {
          key: app.id,
          onClick: () => { setShowMenu(false); openApp(app.url) },
          style: { display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:15,background:'rgba(255,255,255,0.05)',borderRadius:12,cursor:'pointer',minHeight:80,transition:'0.3s' }
        },
          React.createElement('div', { style:{ fontSize:28,marginBottom:8 } }, app.icon),
          React.createElement('div', { style:{ color:'#fff',fontSize:12,fontWeight:500 } }, app.name)
        )
      ))
    ) : null,

    // Painel de Contas
    showPanel ? React.createElement('div', {
      ref: panelRef,
      style: { position:'fixed',top:0,right:0,width:340,height:'100%',background:'rgba(20,25,45,0.98)',backdropFilter:'blur(20px)',zIndex:10001,boxShadow:'-10px 0 30px rgba(0,0,0,0.5)',borderLeft:'1px solid rgba(67,97,238,0.3)',overflowY:'auto',padding:20,animation:'slideRight 0.3s' }
    },
      React.createElement('div', {
        style: { display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,paddingBottom:15,borderBottom:'1px solid rgba(255,255,255,0.1)' }
      },
        React.createElement('div', { style:{ color:'#fff',fontSize:18,fontWeight:600 } }, '👤 Contas ☁️'),
        React.createElement('button', {
          onClick: () => setShowPanel(false),
          style: { background:'rgba(255,255,255,0.1)',border:'none',color:'#fff',width:32,height:32,borderRadius:'50%',cursor:'pointer',fontSize:16 }
        }, '✕')
      ),

      isAuth && userData ? React.createElement('div', {
        style: { background:'rgba(67,97,238,0.2)',borderRadius:10,padding:12,marginBottom:15,color:'#fff',textAlign:'center' }
      },
        React.createElement('div', { style:{ fontWeight:600 } }, '✅ ' + (userData.username || userData.email)),
        React.createElement('div', { style:{ fontSize:10,opacity:0.7,marginTop:4 } }, 'userKey: ' + (userKey||'').substring(0,25) + '...')
      ) : null,

      React.createElement('div', { style:{ color:'#fff',fontSize:13,fontWeight:600,marginBottom:10 } },
        '📋 Contas (' + accounts.length + '/' + MAX_ACCOUNTS + ')'
      ),

      accounts.length === 0 ?
        React.createElement('div', { style:{ color:'#a0b3c9',textAlign:'center',padding:30 } },
          React.createElement('div', { style:{ fontSize:40,marginBottom:10 } }, '☁️'),
          React.createElement('div', null, 'Nenhuma conta na nuvem'),
          React.createElement('div', { style:{ fontSize:11,marginTop:5 } }, 'Faça login para adicionar')
        )
      : accounts.map(acc =>
          React.createElement('div', {
            key: acc.uid,
            onClick: () => switchAccount(acc),
            style: { background:userData?.uid===acc.uid?'rgba(67,97,238,0.3)':'rgba(255,255,255,0.05)',borderRadius:12,padding:15,marginBottom:10,cursor:'pointer',border:userData?.uid===acc.uid?'1px solid rgba(67,97,238,0.6)':'1px solid transparent',display:'flex',alignItems:'center',gap:12,transition:'0.3s' }
          },
            React.createElement('div', {
              style: { width:42,height:42,borderRadius:'50%',background:getAvatarColor(acc.username||acc.email||'?'),display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:17,color:'#fff',flexShrink:0 }
            }, (acc.username||acc.email||'?').charAt(0).toUpperCase()),
            React.createElement('div', { style:{ flex:1,minWidth:0 } },
              React.createElement('div', { style:{ color:'#fff',fontWeight:600,fontSize:14,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' } },
                (acc.username||acc.email) + (userData?.uid===acc.uid?' ✓':'')
              ),
              React.createElement('div', { style:{ color:'#a0b3c9',fontSize:11,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' } }, acc.email)
            ),
            React.createElement('div', { style:{ fontSize:18,flexShrink:0 } }, acc.userType==='entrepreneur'?'🏢':'👤'),
            React.createElement('button', {
              onClick: (e) => { e.stopPropagation(); removeAccount(acc.uid) },
              style: { background:'rgba(247,37,133,0.2)',color:'#f72585',border:'1px solid rgba(247,37,133,0.3)',padding:'6px 12px',borderRadius:8,cursor:'pointer',fontSize:12,flexShrink:0 }
            }, '✕')
          )
        ),

      accounts.length < MAX_ACCOUNTS ?
        React.createElement('button', {
          onClick: () => window.location.href = 'auth.html',
          style: { width:'100%',padding:12,borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer',marginTop:10,display:'flex',alignItems:'center',justifyContent:'center',gap:8,color:'#4cc9f0',background:'rgba(76,201,240,0.2)',border:'1px solid rgba(76,201,240,0.4)' }
        }, '➕ Adicionar Conta')
      : null,

      isAuth ?
        React.createElement('button', {
          onClick: handleLogout,
          style: { width:'100%',padding:12,borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer',marginTop:10,display:'flex',alignItems:'center',justifyContent:'center',gap:8,color:'#f72585',background:'rgba(247,37,133,0.2)',border:'1px solid rgba(247,37,133,0.4)' }
        }, '🚪 Sair')
      : null,

      React.createElement('div', {
        style: { color:'#a0b3c9',fontSize:10,textAlign:'center',marginTop:15,background:'rgba(0,0,0,0.2)',padding:10,borderRadius:8 }
      },
        '☁️ Nuvem: ' + accounts.length + '/' + MAX_ACCOUNTS + ' contas',
        masterKey ? React.createElement('br') : null,
        masterKey ? '🔑 Chave: ' + masterKey.substring(0,20) + '...' : null
      )
    ) : null
  );
}

window.AppMenu = AppMenu;