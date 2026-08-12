const { useState, useEffect, useRef } = React;

const apps = [
  { id:'settings', name:'Config', icon:'⚙️', url:'https://alexandre7888.github.io/settings.html' },
  { id:'MENSAGENS', name:'mensagens', icon:'✉️', url:'https://app.mensagens.site.je/' },
  { id:'home', name:'Home', icon:'🏠', url:'https://alexandre7888.github.io' }
];

function AppMenu() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showPanel, setShowPanel] = useState(false);

  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  const panelRef = useRef(null);
  const authRef = useRef(null);

  useEffect(() => {
    async function initFirebase() {
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js');
      const { getAuth, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js');

      const app = initializeApp({
        apiKey: "AIzaSyDon4WbCbe4kCkUq-OdLBRhzhMaUObbAfo",
        authDomain: "html-15e80.firebaseapp.com",
        databaseURL: "https://html-15e80-default-rtdb.firebaseio.com",
        projectId: "html-15e80",
        storageBucket: "html-15e80.firebasestorage.app",
        messagingSenderId: "1068148640439",
        appId: "1:1068148640439:web:7cc5bde34f4c5a5ce41b32"
      });

      const auth = getAuth(app);
      authRef.current = auth;

      onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      });
    }

    initFirebase();

    document.addEventListener('mousedown', (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setShowPanel(false);
    });
  }, []);

  // ===== ABRIR APP =====
  function openApp(url) {
    window.location.href = url;
  }

  // ===== LOGOUT =====
  function handleLogout() {
    if (!confirm('Sair da conta?')) return;
    if (authRef.current) {
      authRef.current.signOut().then(() => {
        window.location.href = window.location.href;
      });
    }
  }

  if (loading) {
    return React.createElement('div', {
      style: { position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',color:'#fff',fontSize:18,zIndex:99999 }
    }, '⏳ Carregando...');
  }

  const name = user?.displayName || user?.email?.split('@')[0] || 'Login';
  const siteTitle = document.title || 'CodeHUB';
  const isOpen = isHovered || isPinned;

  return React.createElement('div', null,

    // ==================== BARRA NOTCH ====================
    React.createElement('div', {
      onMouseEnter: () => setIsHovered(true),
      onMouseLeave: () => setIsHovered(false),
      onClick: () => setIsPinned(!isPinned),
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
        minWidth: isOpen ? '230px' : '90px',
        height: isOpen ? '42px' : '12px',
        overflow: 'hidden'
      }
    },
      !isOpen ? React.createElement('div', {
        style: { width: '32px', height: '3px', background: 'rgba(255, 255, 255, 0.5)', borderRadius: '2px' }
      }) : 

      React.createElement(React.Fragment, null,
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

        React.createElement('div', {
          onClick: (e) => { e.stopPropagation(); setShowPanel(true); },
          style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            lineHeight: 1.1
          }
        },
          React.createElement('div', {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 600
            }
          },
            React.createElement('span', {
              style: { width: '6px', height: '6px', borderRadius: '50%', background: user ? '#2ecc71' : '#e74c3c' }
            }),
            React.createElement('span', null, user ? name : 'Desconectado')
          ),
          React.createElement('div', {
            style: {
              fontSize: '9px',
              color: 'rgba(255, 255, 255, 0.55)',
              marginTop: '2px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '130px'
            }
          }, siteTitle)
        ),

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

    // ==================== PAINEL LATERAL ====================
    showPanel ? React.createElement('div', {
      ref: panelRef,
      style: { position:'fixed',top:0,right:0,width:320,height:'100%',background:'rgba(20,21,25,0.96)',backdropFilter:'blur(20px)',zIndex:10001,boxShadow:'-10px 0 30px rgba(0,0,0,0.5)',borderLeft:'1px solid rgba(255,255,255,0.1)',overflowY:'auto',padding:20 }
    },
      React.createElement('div', {
        style: { display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,paddingBottom:12,borderBottom:'1px solid rgba(255,255,255,0.1)' }
      },
        React.createElement('div', { style:{ color:'#fff',fontSize:16,fontWeight:600 } }, '👤 Minha Conta'),
        React.createElement('button', {
          onClick: () => setShowPanel(false),
          style: { background:'transparent',border:'none',color:'rgba(255,255,255,0.6)',cursor:'pointer',fontSize:16 }
        }, '✕')
      ),

      !user ? React.createElement('div', {
        style: { textAlign:'center', padding:20 }
      },
        React.createElement('div', { style:{ fontSize:32,marginBottom:8 } }, '🔐'),
        React.createElement('div', { style:{ color:'#888',fontSize:13,marginBottom:12 } }, 'Você não está logado.'),
        React.createElement('button', {
          onClick: () => window.location.href = 'auth.html',
          style: { width:'100%',padding:10,borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',color:'#fff',background:'#4361ee',border:'none' }
        }, 'Fazer Login')
      ) : React.createElement('div', null,
        React.createElement('div', {
          style: { background:'rgba(255,255,255,0.05)',borderRadius:10,padding:12,marginBottom:15,color:'#fff',textAlign:'center',border:'1px solid rgba(255,255,255,0.08)' }
        },
          React.createElement('div', { style:{ fontWeight:600,fontSize:14 } }, '✅ ' + name),
          React.createElement('div', { style:{ fontSize:10,opacity:0.6,marginTop:4 } }, user?.email || '')
        ),

        React.createElement('button', {
          onClick: handleLogout,
          style: { width:'100%',padding:10,borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',marginTop:8,color:'#f72585',background:'rgba(247,37,133,0.12)',border:'1px solid rgba(247,37,133,0.3)' }
        }, '🚪 Sair')
      )
    ) : null
  );
}

window.AppMenu = AppMenu;