import React, { useState, useEffect, useRef } from 'react';

const firebaseConfig = {
  apiKey: "AIzaSyDon4WbCbe4kCkUq-OdLBRhzhMaUObbAfo",
  authDomain: "html-15e80.firebaseapp.com",
  databaseURL: "https://html-15e80-default-rtdb.firebaseio.com",
  projectId: "html-15e80",
  storageBucket: "html-15e80.firebasestorage.app",
  messagingSenderId: "1068148640439",
  appId: "1:1068148640439:web:7cc5bde34f4c5a5ce41b32"
};

const MAX_ACCOUNTS = 5;

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

function getAvatarColor(name) {
  const colors = ['#4361ee','#f72585','#4cc9f0','#7209b7','#f8961e','#43aa8b','#e63946','#277da1'];
  let hash = 0;
  for (let i = 0; i < (name||'?').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function AppMenu() {
  const [isAuth, setIsAuth] = useState(false);
  const [userData, setUserData] = useState(null);
  const [userKey, setUserKey] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [showMenu, setShowMenu] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    init();
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleClickOutside(e) {
    if (panelRef.current && !panelRef.current.contains(e.target)) setShowPanel(false);
  }

  async function init() {
    const urlKey = new URLSearchParams(window.location.search).get('userKey');
    const localKey = localStorage.getItem('current_userKey');
    const key = urlKey || localKey;
    if (key) { setUserKey(key); await loadUser(key); }
    loadAccounts();
  }

  async function loadUser(key) {
    try {
      const { getDatabase, ref, get } = await import('firebase/database');
      const db = getDatabase();
      const snap = await get(ref(db, `userKeysData/${key}`));
      if (snap.exists()) {
        const d = snap.val();
        const u = d.authTokenDecoded || d;
        setUserData(u); setIsAuth(true);
        localStorage.setItem('current_userKey', key);
        if (d.authToken) localStorage.setItem('auth_token', d.authToken);
        if (u.uid) localStorage.setItem('token_user_id', u.uid);
      }
    } catch(e) { console.error(e); }
  }

  function loadAccounts() {
    const acc = JSON.parse(localStorage.getItem('codehub_deviceAccounts') || '[]');
    setAccounts(acc);
  }

  function openApp(url) {
    const key = userKey || localStorage.getItem('current_userKey');
    const sep = url.includes('?') ? '&' : '?';
    window.location.href = key ? `${url}${sep}userKey=${key}` : url;
  }

  async function switchAccount(acc) {
    if (acc.userKey) {
      localStorage.setItem('current_userKey', acc.userKey);
      if (acc.authToken) localStorage.setItem('auth_token', acc.authToken);
      localStorage.setItem('token_user_id', acc.uid);
      setUserKey(acc.userKey);
      await loadUser(acc.userKey);
      setShowPanel(false);
      loadAccounts();
      window.location.reload();
    }
  }

  function removeAccount(uid) {
    if (confirm('Remover esta conta?')) {
      const updated = accounts.filter(a => a.uid !== uid);
      localStorage.setItem('codehub_deviceAccounts', JSON.stringify(updated));
      setAccounts(updated);
      if (userData?.uid === uid) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('token_user_id');
        localStorage.removeItem('current_userKey');
        setIsAuth(false); setUserData(null); setUserKey(null);
      }
    }
  }

  function logout() {
    if (confirm('Sair?')) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('token_user_id');
      localStorage.removeItem('current_userKey');
      setIsAuth(false); setUserData(null); setUserKey(null);
      setShowPanel(false);
    }
  }

  const name = userData?.username || userData?.email || '?';
  const letter = name.charAt(0).toUpperCase();
  const avatarColor = getAvatarColor(name);

  return (
    <>
      {/* Menu 4x4 */}
      <div style={{position:'fixed',top:20,left:20,zIndex:10000}}>
        <div onClick={()=>setShowMenu(true)} style={{
          width:48,height:48,background:'rgba(20,25,45,0.9)',backdropFilter:'blur(10px)',
          borderRadius:12,cursor:'pointer',display:'grid',
          gridTemplateColumns:'repeat(4,1fr)',gridTemplateRows:'repeat(4,1fr)',
          gap:3,padding:8,border:'1px solid rgba(67,97,238,0.3)',
          boxShadow:'0 8px 20px rgba(0,0,0,0.4)',transition:'0.3s'
        }}>
          {[...Array(16)].map((_,i)=><div key={i} style={{
            width:'100%',height:'100%',background:'rgba(67,97,238,0.8)',borderRadius:'50%'
          }}/>)}
        </div>
      </div>

      {/* Avatar ou Login */}
      <div style={{position:'fixed',top:20,right:90,zIndex:10000}}>
        {isAuth ? (
          <div onClick={()=>{loadAccounts();setShowPanel(true)}} style={{
            width:48,height:48,borderRadius:'50%',background:avatarColor,
            cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
            fontWeight:700,fontSize:20,color:'#fff',
            border:'2px solid rgba(255,255,255,0.3)',
            boxShadow:'0 8px 20px rgba(0,0,0,0.4)',transition:'0.3s'
          }}>
            {letter}
            <div style={{position:'absolute',bottom:2,right:2,width:12,height:12,
              background:'#4cc9f0',borderRadius:'50%',border:'2px solid rgba(20,25,45,0.9)'}}/>
          </div>
        ) : (
          <button onClick={()=>window.location.href='auth.html'} style={{
            background:'linear-gradient(135deg,#4361ee,#7c3aed)',color:'#fff',
            padding:'12px 24px',borderRadius:20,cursor:'pointer',
            fontSize:14,fontWeight:600,border:'none',
            boxShadow:'0 8px 20px rgba(67,97,238,0.3)',transition:'0.3s'
          }}>🔐 Fazer Login</button>
        )}
      </div>

      {/* Overlay Apps */}
      {showMenu && (
        <div onClick={(e)=>{if(e.target===e.currentTarget)setShowMenu(false)}} style={{
          position:'fixed',top:0,left:0,width:'100%',height:'100%',
          background:'rgba(0,0,0,0.7)',zIndex:9999,
          display:'flex',justifyContent:'center',alignItems:'center',backdropFilter:'blur(5px)'
        }}>
          <div style={{
            background:'rgba(20,25,45,0.95)',borderRadius:20,padding:30,
            display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:15,
            maxWidth:500,width:'90%',border:'1px solid rgba(67,97,238,0.3)',
            boxShadow:'0 20px 40px rgba(0,0,0,0.5)',animation:'slideIn 0.3s'
          }}>
            {apps.map(app=>(
              <div key={app.id} onClick={()=>{setShowMenu(false);openApp(app.url)}} style={{
                display:'flex',flexDirection:'column',alignItems:'center',
                justifyContent:'center',padding:15,background:'rgba(255,255,255,0.05)',
                borderRadius:12,cursor:'pointer',transition:'0.3s',minHeight:80
              }}>
                <div style={{fontSize:28,marginBottom:8}}>{app.icon}</div>
                <div style={{color:'#fff',fontSize:12,fontWeight:500}}>{app.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Painel de Contas */}
      {showPanel && (
        <div ref={panelRef} style={{
          position:'fixed',top:0,right:0,width:320,height:'100%',
          background:'rgba(20,25,45,0.98)',backdropFilter:'blur(20px)',
          zIndex:10001,boxShadow:'-10px 0 30px rgba(0,0,0,0.5)',
          borderLeft:'1px solid rgba(67,97,238,0.3)',
          animation:'slideRight 0.3s',overflowY:'auto',padding:20
        }}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
            marginBottom:20,paddingBottom:15,borderBottom:'1px solid rgba(255,255,255,0.1)'}}>
            <div style={{color:'#fff',fontSize:18,fontWeight:600}}>👤 Contas</div>
            <button onClick={()=>setShowPanel(false)} style={{
              background:'rgba(255,255,255,0.1)',border:'none',color:'#fff',
              width:32,height:32,borderRadius:'50%',cursor:'pointer',fontSize:16
            }}>✕</button>
          </div>

          {accounts.length === 0 ? (
            <div style={{color:'#a0b3c9',textAlign:'center',padding:30}}>Nenhuma conta salva</div>
          ) : (
            accounts.map((acc,i)=>(
              <div key={i} onClick={()=>switchAccount(acc)} style={{
                background:userData?.uid===acc.uid?'rgba(67,97,238,0.3)':'rgba(255,255,255,0.05)',
                borderRadius:12,padding:15,marginBottom:10,cursor:'pointer',
                border:userData?.uid===acc.uid?'1px solid rgba(67,97,238,0.6)':'1px solid transparent',
                display:'flex',alignItems:'center',gap:12,transition:'0.3s'
              }}>
                <div style={{
                  width:40,height:40,borderRadius:'50%',
                  background:getAvatarColor(acc.username||acc.email||'?'),
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontWeight:700,fontSize:16,color:'#fff',flexShrink:0
                }}>{(acc.username||acc.email||'?').charAt(0).toUpperCase()}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:'#fff',fontWeight:600,fontSize:14,
                    whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                    {acc.username||acc.email}
                  </div>
                  <div style={{color:'#a0b3c9',fontSize:11,
                    whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                    {acc.email}
                  </div>
                </div>
                <button onClick={(e)=>{e.stopPropagation();removeAccount(acc.uid)}} style={{
                  background:'rgba(247,37,133,0.2)',color:'#f72585',
                  border:'1px solid rgba(247,37,133,0.3)',
                  padding:'6px 12px',borderRadius:8,cursor:'pointer',fontSize:12,flexShrink:0
                }}>✕</button>
              </div>
            ))
          )}

          {accounts.length < MAX_ACCOUNTS && (
            <button onClick={()=>window.location.href='auth.html'} style={{
              width:'100%',padding:12,borderRadius:10,fontSize:14,fontWeight:600,
              cursor:'pointer',marginTop:10,display:'flex',alignItems:'center',
              justifyContent:'center',gap:8,color:'#4cc9f0',
              background:'rgba(76,201,240,0.2)',border:'1px solid rgba(76,201,240,0.4)'
            }}>➕ Adicionar Conta</button>
          )}

          <button onClick={logout} style={{
            width:'100%',padding:12,borderRadius:10,fontSize:14,fontWeight:600,
            cursor:'pointer',marginTop:10,display:'flex',alignItems:'center',
            justifyContent:'center',gap:8,color:'#f72585',
            background:'rgba(247,37,133,0.2)',border:'1px solid rgba(247,37,133,0.4)'
          }}>🚪 Sair</button>

          <div style={{color:'#a0b3c9',fontSize:12,textAlign:'center',marginTop:15}}>
            {accounts.length}/{MAX_ACCOUNTS} contas
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn{from{opacity:0;transform:scale(0.9) translateY(-20px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes slideRight{from{transform:translateX(100%)}to{transform:translateX(0)}}
      `}</style>
    </>
  );
}
