import React, { useState, useEffect } from 'react';

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

// ==================== FUNÇÕES DO SISTEMA ====================

// Gerar ID único do dispositivo
function generateDeviceId() {
  let deviceId = localStorage.getItem('codehub_deviceId');
  if (!deviceId) {
    deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('codehub_deviceId', deviceId);
  }
  return deviceId;
}

// Gerar UserKey
function generateUserKey(uid) {
  return `${uid}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

// Gerar Token de Autenticação
function generateAuthToken(userId, userEmail, username, userType, companyData = null) {
  const tokenData = {
    uid: userId,
    email: userEmail,
    username: username,
    userType: userType,
    companyData: companyData,
    createdAt: Date.now(),
    expiresAt: null,
    version: "1.0",
    isPermanent: true
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(tokenData))));
}

// Validar CNPJ
function validateCNPJ(cnpj) {
  cnpj = cnpj.replace(/\D/g, '');
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;
  
  let sum = 0;
  let weight = 5;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cnpj.charAt(i)) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  let digit = 11 - (sum % 11);
  digit = digit >= 10 ? 0 : digit;
  if (digit !== parseInt(cnpj.charAt(12))) return false;
  
  sum = 0;
  weight = 6;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cnpj.charAt(i)) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  digit = 11 - (sum % 11);
  digit = digit >= 10 ? 0 : digit;
  if (digit !== parseInt(cnpj.charAt(13))) return false;
  
  return true;
}

// Formatar CNPJ
function formatCNPJ(value) {
  value = value.replace(/\D/g, '');
  if (value.length > 14) value = value.slice(0, 14);
  
  if (value.length > 12) {
    value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  } else if (value.length > 8) {
    value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})$/, '$1.$2.$3/$4');
  } else if (value.length > 5) {
    value = value.replace(/^(\d{2})(\d{3})(\d{3})$/, '$1.$2.$3');
  } else if (value.length > 2) {
    value = value.replace(/^(\d{2})(\d{3})$/, '$1.$2');
  }
  
  return value;
}

// ==================== COMPONENTE PRINCIPAL ====================
function App() {
  const [tab, setTab] = useState('login');
  const [userType, setUserType] = useState('normal');
  const [accounts, setAccounts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [deviceId, setDeviceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAccounts, setShowAccounts] = useState(false);
  
  // Estados do formulário de login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginCnpj, setLoginCnpj] = useState('');
  
  // Estados do formulário de registro
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [registerCompanyName, setRegisterCompanyName] = useState('');
  const [registerCnpj, setRegisterCnpj] = useState('');
  
  const MAX_ACCOUNTS = 5;
  
  // Inicializar
  useEffect(() => {
    const devId = generateDeviceId();
    setDeviceId(devId);
    loadDeviceAccounts();
    checkExistingAuth();
  }, []);
  
  // Carregar contas do dispositivo
  const loadDeviceAccounts = () => {
    const savedAccounts = JSON.parse(localStorage.getItem('codehub_deviceAccounts') || '[]');
    setAccounts(savedAccounts);
    if (savedAccounts.length > 0) {
      setShowAccounts(true);
    }
  };
  
  // Verificar autenticação existente
  const checkExistingAuth = () => {
    const token = localStorage.getItem('auth_token');
    const userId = localStorage.getItem('token_user_id');
    
    if (token && userId) {
      const savedAccounts = JSON.parse(localStorage.getItem('codehub_deviceAccounts') || '[]');
      const currentAccount = savedAccounts.find(acc => acc.uid === userId);
      if (currentAccount) {
        setCurrentUser(currentAccount);
      }
    }
  };
  
  // Salvar conta no dispositivo
  const saveAccountToDevice = async (userData) => {
    const deviceAccounts = JSON.parse(localStorage.getItem('codehub_deviceAccounts') || '[]');
    const existingIndex = deviceAccounts.findIndex(acc => acc.uid === userData.uid);
    
    if (existingIndex >= 0) {
      deviceAccounts[existingIndex] = { ...deviceAccounts[existingIndex], ...userData, lastLogin: Date.now() };
    } else {
      if (deviceAccounts.length >= MAX_ACCOUNTS) {
        throw new Error('Limite de 5 contas por dispositivo atingido!');
      }
      deviceAccounts.push({ ...userData, addedAt: Date.now(), lastLogin: Date.now() });
    }
    
    localStorage.setItem('codehub_deviceAccounts', JSON.stringify(deviceAccounts));
    
    // Salvar no Firebase
    try {
      const { getDatabase, ref, set } = await import('firebase/database');
      const database = getDatabase();
      
      await set(ref(database, `devices/${deviceId}/accounts/${userData.uid}`), {
        ...userData,
        lastAccess: Date.now(),
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language
        }
      });
    } catch (error) {
      console.error('Erro ao salvar no Firebase:', error);
    }
    
    setAccounts(deviceAccounts);
    setShowAccounts(true);
    return deviceAccounts;
  };
  
  // Login
  const handleLogin = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    
    if (!loginEmail || !loginPassword) {
      setError('Preencha todos os campos');
      setLoading(false);
      return;
    }
    
    try {
      const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
      const { getDatabase, ref, get, set, update } = await import('firebase/database');
      
      const auth = getAuth();
      const database = getDatabase();
      
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const user = userCredential.user;
      
      // Buscar dados do usuário
      const userRef = ref(database, 'users/' + user.uid);
      const userSnapshot = await get(userRef);
      
      if (!userSnapshot.exists()) {
        setError('Dados do usuário não encontrados');
        setLoading(false);
        return;
      }
      
      const userData = userSnapshot.val();
      
      // Verificar CNPJ se for empreendedor
      if (userData.userType === 'entrepreneur') {
        if (!loginCnpj) {
          setError('CNPJ é obrigatório para contas de empreendedor');
          setLoading(false);
          return;
        }
        
        const cleanCNPJ = loginCnpj.replace(/\D/g, '');
        if (cleanCNPJ !== userData.cnpj) {
          setError('CNPJ inválido');
          setLoading(false);
          return;
        }
      }
      
      // Gerar userKey
      let userKey = userData.userKey;
      if (!userKey) {
        userKey = generateUserKey(user.uid);
        await update(ref(database, 'users/' + user.uid), { userKey: userKey });
      }
      
      // Gerar token
      const authToken = generateAuthToken(
        user.uid, 
        loginEmail, 
        userData.username, 
        userData.userType || 'normal',
        userData.userType === 'entrepreneur' ? { companyName: userData.companyName, cnpj: userData.cnpj } : null
      );
      
      // Salvar userKeyData no Firebase
      await set(ref(database, `userKeysData/${userKey}`), {
        authToken: authToken,
        authTokenDecoded: {
          createdAt: Date.now(),
          email: loginEmail,
          isPermanent: true,
          uid: user.uid,
          userType: userData.userType || 'normal',
          username: userData.username,
          version: "1.0"
        },
        criadoEm: Date.now(),
        email: loginEmail,
        hasAuthToken: true,
        isAnonymous: false,
        nome: userData.username,
        uid: user.uid,
        deviceId: deviceId
      });
      
      // Atualizar último login
      await update(ref(database, 'users/' + user.uid), { lastLogin: Date.now() });
      
      // Salvar no dispositivo
      const accountData = {
        uid: user.uid,
        email: loginEmail,
        username: userData.username,
        userType: userData.userType || 'normal',
        userKey: userKey,
        lastLogin: Date.now()
      };
      
      await saveAccountToDevice(accountData);
      
      // Salvar token local
      localStorage.setItem('auth_token', authToken);
      localStorage.setItem('token_user_id', user.uid);
      localStorage.setItem('current_userKey', userKey);
      
      setCurrentUser(accountData);
      setSuccess('✅ Login realizado com sucesso!');
      
      // Redirecionar
      setTimeout(() => {
        window.location.href = `index.html?userKey=${userKey}`;
      }, 1500);
      
    } catch (error) {
      console.error('Erro no login:', error);
      switch(error.code) {
        case 'auth/user-not-found':
          setError('Usuário não encontrado');
          break;
        case 'auth/wrong-password':
          setError('Senha incorreta');
          break;
        case 'auth/invalid-email':
          setError('Email inválido');
          break;
        default:
          setError(error.message || 'Erro ao fazer login');
      }
    }
    
    setLoading(false);
  };
  
  // Registro
  const handleRegister = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    
    if (!registerUsername || !registerEmail || !registerPassword) {
      setError('Preencha todos os campos obrigatórios');
      setLoading(false);
      return;
    }
    
    if (registerPassword.length < 6) {
      setError('Senha deve ter pelo menos 6 caracteres');
      setLoading(false);
      return;
    }
    
    if (registerPassword !== registerConfirmPassword) {
      setError('Senhas não coincidem');
      setLoading(false);
      return;
    }
    
    if (userType === 'entrepreneur') {
      if (!registerCompanyName) {
        setError('Nome da empresa é obrigatório');
        setLoading(false);
        return;
      }
      if (!registerCnpj) {
        setError('CNPJ é obrigatório');
        setLoading(false);
        return;
      }
      if (!validateCNPJ(registerCnpj)) {
        setError('CNPJ inválido');
        setLoading(false);
        return;
      }
    }
    
    // Verificar limite de contas
    const deviceAccounts = JSON.parse(localStorage.getItem('codehub_deviceAccounts') || '[]');
    if (deviceAccounts.length >= MAX_ACCOUNTS) {
      setError('Limite de 5 contas por dispositivo atingido!');
      setLoading(false);
      return;
    }
    
    try {
      const { getAuth, createUserWithEmailAndPassword } = await import('firebase/auth');
      const { getDatabase, ref, set } = await import('firebase/database');
      
      const auth = getAuth();
      const database = getDatabase();
      
      const userCredential = await createUserWithEmailAndPassword(auth, registerEmail, registerPassword);
      const user = userCredential.user;
      
      // Gerar userKey
      const userKey = generateUserKey(user.uid);
      
      // Gerar token
      const authToken = generateAuthToken(
        user.uid, 
        registerEmail, 
        registerUsername, 
        userType,
        userType === 'entrepreneur' ? { companyName: registerCompanyName, cnpj: registerCnpj } : null
      );
      
      // Dados do usuário
      const userData = {
        username: registerUsername,
        email: registerEmail,
        userType: userType,
        userKey: userKey,
        uid: user.uid,
        createdAt: Date.now(),
        lastLogin: Date.now(),
        hasToken: true,
        deviceId: deviceId
      };
      
      if (userType === 'entrepreneur') {
        userData.companyName = registerCompanyName;
        userData.cnpj = registerCnpj.replace(/\D/g, '');
      }
      
      // Salvar no Firebase
      await set(ref(database, 'users/' + user.uid), userData);
      
      // Salvar userKeyData
      await set(ref(database, `userKeysData/${userKey}`), {
        authToken: authToken,
        authTokenDecoded: {
          createdAt: Date.now(),
          email: registerEmail,
          isPermanent: true,
          uid: user.uid,
          userType: userType,
          username: registerUsername,
          version: "1.0"
        },
        criadoEm: Date.now(),
        email: registerEmail,
        hasAuthToken: true,
        isAnonymous: false,
        nome: registerUsername,
        uid: user.uid,
        deviceId: deviceId
      });
      
      // Salvar no dispositivo
      const accountData = {
        uid: user.uid,
        email: registerEmail,
        username: registerUsername,
        userType: userType,
        userKey: userKey,
        lastLogin: Date.now()
      };
      
      await saveAccountToDevice(accountData);
      
      // Salvar token local
      localStorage.setItem('auth_token', authToken);
      localStorage.setItem('token_user_id', user.uid);
      localStorage.setItem('current_userKey', userKey);
      
      setCurrentUser(accountData);
      setSuccess('✅ Conta criada com sucesso!');
      
      // Redirecionar
      setTimeout(() => {
        window.location.href = `index.html?userKey=${userKey}`;
      }, 1500);
      
    } catch (error) {
      console.error('Erro no registro:', error);
      switch(error.code) {
        case 'auth/email-already-in-use':
          setError('Este email já está em uso');
          break;
        case 'auth/invalid-email':
          setError('Email inválido');
          break;
        case 'auth/weak-password':
          setError('Senha muito fraca');
          break;
        default:
          setError(error.message || 'Erro ao criar conta');
      }
    }
    
    setLoading(false);
  };
  
  // Login com Google
  const handleGoogleLogin = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    
    const deviceAccounts = JSON.parse(localStorage.getItem('codehub_deviceAccounts') || '[]');
    if (deviceAccounts.length >= MAX_ACCOUNTS) {
      setError('Limite de 5 contas por dispositivo atingido!');
      setLoading(false);
      return;
    }
    
    try {
      const { getAuth, GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
      const { getDatabase, ref, get, set } = await import('firebase/database');
      
      const auth = getAuth();
      const database = getDatabase();
      const provider = new GoogleAuthProvider();
      
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const username = user.displayName || user.email.split('@')[0];
      
      let userType = 'normal';
      let userKey;
      
      const userRef = ref(database, 'users/' + user.uid);
      const userSnapshot = await get(userRef);
      
      if (!userSnapshot.exists()) {
        userKey = generateUserKey(user.uid);
        
        const userData = {
          username: username,
          email: user.email,
          userType: 'normal',
          userKey: userKey,
          uid: user.uid,
          createdAt: Date.now(),
          lastLogin: Date.now(),
          provider: 'google',
          hasToken: true,
          deviceId: deviceId
        };
        
        await set(ref(database, 'users/' + user.uid), userData);
        
        const accountData = {
          uid: user.uid,
          email: user.email,
          username: username,
          userType: 'normal',
          userKey: userKey,
          lastLogin: Date.now()
        };
        
        await saveAccountToDevice(accountData);
      } else {
        userType = userSnapshot.val().userType || 'normal';
        userKey = userSnapshot.val().userKey || generateUserKey(user.uid);
        
        const accountData = {
          uid: user.uid,
          email: user.email,
          username: userSnapshot.val().username || username,
          userType: userType,
          userKey: userKey,
          lastLogin: Date.now()
        };
        
        await saveAccountToDevice(accountData);
      }
      
      const authToken = generateAuthToken(user.uid, user.email, username, userType, null);
      
      await set(ref(database, `userKeysData/${userKey}`), {
        authToken: authToken,
        authTokenDecoded: {
          createdAt: Date.now(),
          email: user.email,
          isPermanent: true,
          uid: user.uid,
          userType: userType,
          username: username,
          version: "1.0"
        },
        criadoEm: Date.now(),
        email: user.email,
        hasAuthToken: true,
        isAnonymous: false,
        nome: username,
        uid: user.uid,
        deviceId: deviceId
      });
      
      localStorage.setItem('auth_token', authToken);
      localStorage.setItem('token_user_id', user.uid);
      localStorage.setItem('current_userKey', userKey);
      
      setSuccess('✅ Login com Google realizado!');
      
      setTimeout(() => {
        window.location.href = `index.html?userKey=${userKey}`;
      }, 1500);
      
    } catch (error) {
      console.error('Erro no login com Google:', error);
      setError('Erro ao fazer login com Google');
    }
    
    setLoading(false);
  };
  
  // Trocar para uma conta
  const switchToAccount = (account) => {
    localStorage.setItem('auth_token', account.authToken || '');
    localStorage.setItem('token_user_id', account.uid);
    localStorage.setItem('current_userKey', account.userKey);
    setCurrentUser(account);
    setSuccess(`✅ Alternado para: ${account.username || account.email}`);
    
    setTimeout(() => {
      window.location.href = `index.html?userKey=${account.userKey}`;
    }, 1000);
  };
  
  // Abrir app com userKey
  const openApp = (appUrl) => {
    const userKey = localStorage.getItem('current_userKey');
    if (userKey) {
      window.open(`${appUrl}?userKey=${userKey}`, '_blank');
    } else {
      window.open(appUrl, '_blank');
    }
  };
  
  // Logout
  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('token_user_id');
    localStorage.removeItem('current_userKey');
    setCurrentUser(null);
    setSuccess('✅ Logout realizado!');
  };
  
  return (
    <div>
      <div className="header-actions">
        <button className="home-btn" onClick={() => window.location.href = 'index.html'}>
          🏠 Voltar ao Início
        </button>
      </div>

      <div className="auth-container">
        <div className="auth-header">
          <h1>Bem-vindo ao CodeHub</h1>
          <p>Autenticação Multi-Conta</p>
          <div className="account-indicator">
            👤 Contas neste dispositivo: {accounts.length}/{MAX_ACCOUNTS}
          </div>
        </div>

        {/* Lista de contas salvas */}
        {showAccounts && accounts.length > 0 && (
          <div className="accounts-list">
            <div className="accounts-title">📱 Contas Salvas neste Dispositivo:</div>
            {accounts.map((account, index) => (
              <div 
                key={index} 
                className={`account-item ${currentUser && currentUser.uid === account.uid ? 'active' : ''}`}
                onClick={() => switchToAccount(account)}
              >
                <div className="account-info">
                  <div className="account-name">{account.username || account.email}</div>
                  <div className="account-email">{account.email}</div>
                </div>
                <div className="account-badge">
                  {account.userType === 'entrepreneur' ? '🏢' : '👤'}
                </div>
              </div>
            ))}
            {accounts.length < MAX_ACCOUNTS && (
              <button className="btn-add-account" onClick={() => setShowAccounts(false)}>
                ➕ Adicionar Nova Conta
              </button>
            )}
          </div>
        )}

        {/* Mensagens */}
        {error && <div className="error-message show">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {/* Tabs */}
        <div className="tabs">
          <div className={`tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>
            Entrar
          </div>
          <div className={`tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>
            Criar Conta
          </div>
        </div>

        {/* Tab Login */}
        {tab === 'login' && (
          <div className="tab-content active">
            <div className="form-group">
              <label>Email</label>
              <input 
                type="email" 
                className="form-control" 
                placeholder="digite seu email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Senha</label>
              <input 
                type="password" 
                className="form-control" 
                placeholder="digite sua senha"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>CNPJ (apenas para empreendedor)</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="00.000.000/0000-00"
                value={loginCnpj}
                onChange={(e) => setLoginCnpj(formatCNPJ(e.target.value))}
              />
            </div>

            <button className="btn btn-primary" onClick={handleLogin} disabled={loading}>
              {loading ? '⏳ Carregando...' : '🔐 Entrar'}
            </button>

            <div className="divider">ou</div>

            <button className="btn btn-google" onClick={handleGoogleLogin} disabled={loading}>
              🟢 Continuar com Google
            </button>

            <div className="footer-text">
              Não tem uma conta? <a href="#" onClick={() => setTab('register')}>Cadastre-se</a>
            </div>
          </div>
        )}

        {/* Tab Registro */}
        {tab === 'register' && (
          <div className="tab-content active">
            <div className="form-group">
              <label>Tipo de Conta</label>
              <div className="user-type-selector">
                <div 
                  className={`user-type-option ${userType === 'normal' ? 'selected' : ''}`}
                  onClick={() => setUserType('normal')}
                >
                  👤 Usuário Normal
                </div>
                <div 
                  className={`user-type-option ${userType === 'entrepreneur' ? 'selected' : ''}`}
                  onClick={() => setUserType('entrepreneur')}
                >
                  🏢 Empreendedor
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Nome de Usuário</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="ex: dev123"
                value={registerUsername}
                onChange={(e) => setRegisterUsername(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input 
                type="email" 
                className="form-control" 
                placeholder="digite seu email"
                value={registerEmail}
                onChange={(e) => setRegisterEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Senha</label>
              <input 
                type="password" 
                className="form-control" 
                placeholder="crie uma senha (mín. 6 caracteres)"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Confirmar Senha</label>
              <input 
                type="password" 
                className="form-control" 
                placeholder="confirme sua senha"
                value={registerConfirmPassword}
                onChange={(e) => setRegisterConfirmPassword(e.target.value)}
              />
            </div>

            {userType === 'entrepreneur' && (
              <>
                <div className="form-group">
                  <label>Nome da Empresa</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Nome da sua empresa"
                    value={registerCompanyName}
                    onChange={(e) => setRegisterCompanyName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>CNPJ</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="00.000.000/0000-00"
                    value={registerCnpj}
                    onChange={(e) => setRegisterCnpj(formatCNPJ(e.target.value))}
                  />
                </div>
              </>
            )}

            <button className="btn btn-primary" onClick={handleRegister} disabled={loading}>
              {loading ? '⏳ Carregando...' : '✨ Criar Conta'}
            </button>

            <div className="footer-text">
              Já tem uma conta? <a href="#" onClick={() => setTab('login')}>Faça login</a>
            </div>
          </div>
        )}

        {/* Info do dispositivo */}
        <div className="device-info">
          📱 Device ID: {deviceId.substring(0, 30)}...
        </div>
      </div>
    </div>
  );
}

export default App;
