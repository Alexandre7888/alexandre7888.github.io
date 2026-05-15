// components/Settings.js
function Settings({ user, onClose, chats }) {
    const [settings, setSettings] = React.useState({
        publicId: true,
        showOnline: true,
        readReceipts: true,
        readReceiptExceptions: {},
        groupPrivacy: 'everyone',
        groupBlacklist: {}
    });
    const [showExceptionModal, setShowExceptionModal] = React.useState(false);
    const [showGroupBlacklistModal, setShowGroupBlacklistModal] = React.useState(false);
    const [showQRModal, setShowQRModal] = React.useState(false);
    const [qrCodeData, setQrCodeData] = React.useState(null);
    const [connectionStatus, setConnectionStatus] = React.useState('idle');
    const [connectionRequests, setConnectionRequests] = React.useState([]);

    const db = window.firebaseDB;

    React.useEffect(() => {
        window.firebaseDB.ref(`users/${user.id}/settings`).once('value').then(snapshot => {
            const data = snapshot.val();
            if (data) {
                setSettings({ ...settings, ...data });
            }
        });
        
        // Carrega solicitações de conexão
        const requestsRef = db.ref(`connectionRequests/${user.id}`);
        const handleRequests = (snap) => {
            const data = snap.val();
            if (data) {
                const requests = Object.entries(data).map(([id, req]) => ({
                    id,
                    ...req
                }));
                setConnectionRequests(requests);
            }
        };
        requestsRef.on('value', handleRequests);
        return () => requestsRef.off('value', handleRequests);
    }, [user.id]);

    const updateSetting = (key, value) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        window.firebaseDB.ref(`users/${user.id}/settings/${key}`).set(value);
    };

    const toggleException = (contactId) => {
        const newExceptions = { ...settings.readReceiptExceptions };
        if (newExceptions[contactId]) {
            delete newExceptions[contactId];
        } else {
            newExceptions[contactId] = true;
        }
        updateSetting('readReceiptExceptions', newExceptions);
    };

    const toggleGroupBlacklist = (contactId) => {
        const newBlacklist = { ...settings.groupBlacklist };
        if (newBlacklist[contactId]) {
            delete newBlacklist[contactId];
        } else {
            newBlacklist[contactId] = true;
        }
        updateSetting('groupBlacklist', newBlacklist);
    };

    const contacts = chats ? chats.filter(c => c.type !== 'group') : [];

    // ==================== FUNÇÕES DO QR CODE ====================
    const generateQRCode = async () => {
        setConnectionStatus('generating');
        
        try {
            const connectionToken = `${user.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const connectionData = {
                userId: user.id,
                userName: user.name,
                userAvatar: user.avatar,
                token: connectionToken,
                createdAt: Date.now(),
                expiresAt: Date.now() + (5 * 60 * 1000),
                status: 'pending'
            };
            
            await db.ref(`connectionTokens/${connectionToken}`).set(connectionData);
            
            const qrData = JSON.stringify({
                type: 'chat_connection',
                token: connectionToken,
                userId: user.id,
                timestamp: Date.now()
            });
            
            setQrCodeData(qrData);
            setConnectionStatus('ready');
            
            setTimeout(() => {
                db.ref(`connectionTokens/${connectionToken}`).remove();
                if (qrCodeData === qrData) {
                    setConnectionStatus('expired');
                    setTimeout(() => setShowQRModal(false), 2000);
                }
            }, 5 * 60 * 1000);
            
        } catch (error) {
            console.error('Erro ao gerar QR Code:', error);
            setConnectionStatus('error');
        }
    };

    const acceptConnection = async (request) => {
        await db.ref(`users/${user.id}/contacts/${request.fromUserId}`).set({
            type: 'private',
            addedAt: Date.now(),
            name: request.fromUserName,
            avatar: request.fromUserAvatar
        });
        
        await db.ref(`connectionRequests/${user.id}/${request.id}`).remove();
        alert(`✅ ${request.fromUserName} adicionado aos seus contatos!`);
    };

    const rejectConnection = async (request) => {
        await db.ref(`connectionRequests/${user.id}/${request.id}`).remove();
    };

    const handleAvatarChange = async (e) => {
        if (!e.target.files[0]) return;
        
        try {
            const file = e.target.files[0];
            const base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
            
            await window.firebaseDB.ref(`users/${user.id}/avatar`).set(base64);
            const updatedUser = { ...user, avatar: base64 };
            localStorage.setItem("chat_user", JSON.stringify(updatedUser));
            window.location.reload();
            
        } catch (error) {
            console.error("Erro ao trocar foto:", error);
            alert("Erro ao carregar a imagem.");
        }
    };

    // ==================== COMPONENTE DO QR CODE ====================
    const QRCodeModal = () => {
        if (!showQRModal) return null;
        
        return React.createElement('div', {
            className: 'fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4',
            onClick: () => setShowQRModal(false)
        },
            React.createElement('div', {
                className: 'bg-white rounded-xl max-w-md w-full overflow-hidden',
                onClick: (e) => e.stopPropagation()
            },
                React.createElement('div', { className: 'bg-[#00a884] p-4 text-white flex justify-between items-center' },
                    React.createElement('h3', { className: 'font-bold text-lg' }, 'Conectar Dispositivos'),
                    React.createElement('button', { onClick: () => setShowQRModal(false) },
                        React.createElement('div', { className: 'icon-x text-xl' })
                    )
                ),
                
                React.createElement('div', { className: 'p-6' },
                    (() => {
                        if (connectionStatus === 'generating') {
                            return React.createElement('div', { className: 'text-center py-8' },
                                React.createElement('div', { className: 'icon-loader animate-spin text-3xl text-[#00a884] mx-auto mb-3' }),
                                React.createElement('p', { className: 'text-gray-500' }, 'Gerando QR Code...')
                            );
                        }
                        
                        if (connectionStatus === 'ready' && qrCodeData) {
                            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeData)}`;
                            return React.createElement('div', { className: 'flex flex-col items-center gap-3' },
                                React.createElement('img', {
                                    src: qrUrl,
                                    className: 'w-48 h-48 border-2 border-gray-200 rounded-lg p-2 bg-white',
                                    alt: 'QR Code'
                                }),
                                React.createElement('p', { className: 'text-xs text-gray-500 text-center' },
                                    'Escaneie com o app MensagensHUB para conectar'
                                ),
                                React.createElement('p', { className: 'text-xs text-red-400' },
                                    '⏱️ Expira em 5 minutos'
                                )
                            );
                        }
                        
                        if (connectionStatus === 'expired') {
                            return React.createElement('div', { className: 'text-center py-8' },
                                React.createElement('div', { className: 'icon-alert-circle text-5xl text-red-500 mx-auto mb-3' }),
                                React.createElement('p', { className: 'text-gray-600 font-medium' }, 'QR Code Expirado'),
                                React.createElement('button', {
                                    onClick: generateQRCode,
                                    className: 'mt-4 bg-[#00a884] text-white px-4 py-2 rounded-lg'
                                }, 'Gerar novo')
                            );
                        }
                        
                        if (connectionStatus === 'error') {
                            return React.createElement('div', { className: 'text-center py-8' },
                                React.createElement('p', { className: 'text-red-500' }, 'Erro ao gerar QR Code')
                            );
                        }
                        
                        return React.createElement('div', { className: 'text-center py-4' },
                            React.createElement('div', { className: 'icon-qrcode text-5xl text-gray-400 mx-auto mb-3' }),
                            React.createElement('p', { className: 'text-gray-500' }, 'Clique em "Gerar QR Code" para começar'),
                            React.createElement('button', {
                                onClick: generateQRCode,
                                className: 'mt-4 bg-[#00a884] text-white px-6 py-2 rounded-lg'
                            }, 'Gerar QR Code')
                        );
                    })()
                )
            )
        );
    };

    // ==================== MODAL DE SOLICITAÇÕES ====================
    const RequestsModal = () => {
        if (connectionRequests.length === 0) return null;
        
        return React.createElement('div', {
            className: 'fixed bottom-20 right-4 z-50 bg-white rounded-lg shadow-xl border border-gray-200 w-72 overflow-hidden animate-slide-in-right'
        },
            React.createElement('div', { className: 'bg-[#00a884] text-white px-4 py-2 text-sm font-bold flex justify-between items-center' },
                React.createElement('span', {}, `Solicitações (${connectionRequests.length})`),
                React.createElement('button', { onClick: () => setConnectionRequests([]) },
                    React.createElement('div', { className: 'icon-x text-white text-sm' })
                )
            ),
            React.createElement('div', { className: 'max-h-64 overflow-y-auto p-2' },
                connectionRequests.map(req => 
                    React.createElement('div', { key: req.id, className: 'flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg mb-1' },
                        React.createElement('div', { className: 'flex items-center gap-2' },
                            React.createElement('img', { src: req.fromUserAvatar, className: 'w-8 h-8 rounded-full' }),
                            React.createElement('span', { className: 'text-sm font-medium' }, req.fromUserName)
                        ),
                        React.createElement('div', { className: 'flex gap-2' },
                            React.createElement('button', {
                                onClick: () => acceptConnection(req),
                                className: 'p-1 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-green-600'
                            }, '✓'),
                            React.createElement('button', {
                                onClick: () => rejectConnection(req),
                                className: 'p-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600'
                            }, '✕')
                        )
                    )
                )
            )
        );
    };

    return (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg w-full max-w-md shadow-xl animate-fade-in overflow-hidden h-[80vh] flex flex-col">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-[#00a884] text-white shrink-0">
                    <h2 className="text-lg font-semibold">Configurações & Privacidade</h2>
                    <button onClick={onClose}><div className="icon-x text-xl"></div></button>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1">
                    <div className="flex flex-col items-center gap-4 mb-8">
                        <div className="relative group cursor-pointer">
                            <img src={user.avatar} className="w-24 h-24 rounded-full border-4 border-gray-100 object-cover" />
                            <label htmlFor="user-avatar-upload" className="absolute bottom-0 right-0 bg-[#00a884] p-2 rounded-full cursor-pointer hover:bg-[#008f6f] shadow-md transition-transform hover:scale-110">
                                <div className="icon-camera text-white text-lg"></div>
                            </label>
                            <input 
                                id="user-avatar-upload" 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={handleAvatarChange}
                            />
                        </div>
                        <div className="text-center">
                            <h3 className="font-bold text-gray-800 text-lg">{user.name}</h3>
                            <p className="text-gray-500 text-sm">ID: {user.id}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-gray-500 uppercase">Privacidade</h4>
                        
                        {/* Show Online */}
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                                <h4 className="font-medium text-gray-800">Status Online</h4>
                                <p className="text-xs text-gray-500">Mostrar quando você está online</p>
                            </div>
                            <button 
                                onClick={() => updateSetting('showOnline', !settings.showOnline)}
                                className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.showOnline ? 'bg-[#00a884]' : 'bg-gray-300'}`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${settings.showOnline ? 'translate-x-6' : ''}`}></div>
                            </button>
                        </div>

                        {/* Read Receipts */}
                        <div className="flex flex-col p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h4 className="font-medium text-gray-800">Confirmação de Leitura</h4>
                                    <p className="text-xs text-gray-500">Mostrar ticks azuis</p>
                                </div>
                                <button 
                                    onClick={() => updateSetting('readReceipts', !settings.readReceipts)}
                                    className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.readReceipts ? 'bg-[#00a884]' : 'bg-gray-300'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${settings.readReceipts ? 'translate-x-6' : ''}`}></div>
                                </button>
                            </div>
                            <button 
                                onClick={() => setShowExceptionModal(true)}
                                className="text-xs text-[#00a884] font-semibold self-start hover:underline"
                            >
                                Configurar Exceções ({Object.keys(settings.readReceiptExceptions || {}).length})
                            </button>
                        </div>

                         {/* Public ID */}
                         <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                                <h4 className="font-medium text-gray-800">ID Público</h4>
                                <p className="text-xs text-gray-500">Permitir ser encontrado pelo ID</p>
                            </div>
                            <button 
                                onClick={() => updateSetting('publicId', !settings.publicId)}
                                className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.publicId ? 'bg-[#00a884]' : 'bg-gray-300'}`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${settings.publicId ? 'translate-x-6' : ''}`}></div>
                            </button>
                        </div>

                        {/* QR Code Connection - SEÇÃO NOVA */}
                        <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white shadow-md relative overflow-hidden cursor-pointer hover:opacity-90 transition" onClick={() => setShowQRModal(true)}>
                            <div className="relative z-10 flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold flex items-center gap-2">
                                        <div className="icon-qrcode"></div> Conectar Dispositivos
                                    </h4>
                                    <p className="text-xs text-white/80 mt-1">Compartilhe seus contatos via QR Code</p>
                                </div>
                                <div className="bg-white/20 p-2 rounded-full">
                                    <div className="icon-qrcode text-white text-xl"></div>
                                </div>
                            </div>
                        </div>

                        {/* Wallet / Credits Section */}
                        <div className="p-3 bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg text-white shadow-md relative overflow-hidden group cursor-pointer" onClick={() => window.location.href = 'store.html'}>
                            <div className="relative z-10 flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold text-yellow-400 flex items-center gap-2">
                                        <div className="icon-coins"></div> Carteira
                                    </h4>
                                    <p className="text-xs text-gray-300 mt-1">Saldo: <span className="font-mono text-white text-lg font-bold ml-1">{localStorage.getItem("saldo_creditos") || 0}</span></p>
                                </div>
                                <div className="bg-white/20 p-2 rounded-full">
                                    <div className="icon-shopping-bag text-white"></div>
                                </div>
                            </div>
                            <div className="mt-3 text-xs text-center bg-white/10 py-1.5 rounded hover:bg-white/20 transition">
                                Acessar Loja & Stickers
                            </div>
                        </div>

                        {/* Group Privacy */}
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <h4 className="font-medium text-gray-800 mb-2">Quem pode me adicionar a grupos?</h4>
                            <div className="flex flex-col gap-2">
                                {[
                                    { value: 'everyone', label: 'Todos' },
                                    { value: 'contacts', label: 'Meus Contatos' },
                                    { value: 'blacklist', label: 'Meus Contatos, exceto...' },
                                    { value: 'nobody', label: 'Ninguém' }
                                ].map(option => (
                                    <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name="groupPrivacy"
                                            checked={settings.groupPrivacy === option.value}
                                            onChange={() => updateSetting('groupPrivacy', option.value)}
                                            className="accent-[#00a884]"
                                        />
                                        <span className="text-sm text-gray-700">{option.label}</span>
                                    </label>
                                ))}
                            </div>
                            {settings.groupPrivacy === 'blacklist' && (
                                <button 
                                    onClick={() => setShowGroupBlacklistModal(true)}
                                    className="text-xs text-[#00a884] font-semibold mt-2 hover:underline block"
                                >
                                    Selecionar Contatos Bloqueados ({Object.keys(settings.groupBlacklist || {}).length})
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="p-4 bg-gray-50 text-center text-xs text-gray-400 shrink-0">
                    MensagensHUB v2.1 • Privacidade Protegida
                </div>

                {/* Exception Modal (Read Receipts) */}
                {showExceptionModal && (
                    <div className="absolute inset-0 bg-white z-20 flex flex-col animate-slide-in-right">
                         <div className="p-4 border-b border-gray-200 flex items-center gap-4 bg-gray-50">
                            <button onClick={() => setShowExceptionModal(false)} className="icon-arrow-left text-gray-600"></button>
                            <div>
                                <h3 className="font-bold text-gray-800">Exceções de Leitura</h3>
                                <p className="text-xs text-gray-500">
                                    {settings.readReceipts 
                                        ? "Ocultar visto para estes contatos:" 
                                        : "Mostrar visto para estes contatos:"}
                                </p>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {contacts.map(contact => (
                                <div key={contact.id} className="flex items-center justify-between p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => toggleException(contact.id)}>
                                    <div className="flex items-center gap-3">
                                        <img src={contact.avatar} className="w-10 h-10 rounded-full" />
                                        <span className="font-medium">{contact.name}</span>
                                    </div>
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${settings.readReceiptExceptions && settings.readReceiptExceptions[contact.id] ? 'bg-red-500 border-red-500' : 'border-gray-300'}`}>
                                        {settings.readReceiptExceptions && settings.readReceiptExceptions[contact.id] && <div className="icon-check text-white text-xs"></div>}
                                    </div>
                                </div>
                            ))}
                            {contacts.length === 0 && <p className="text-center text-gray-400 mt-10">Nenhum contato privado encontrado.</p>}
                        </div>
                    </div>
                )}

                {/* Group Blacklist Modal */}
                {showGroupBlacklistModal && (
                    <div className="absolute inset-0 bg-white z-20 flex flex-col animate-slide-in-right">
                         <div className="p-4 border-b border-gray-200 flex items-center gap-4 bg-gray-50">
                            <button onClick={() => setShowGroupBlacklistModal(false)} className="icon-arrow-left text-gray-600"></button>
                            <div>
                                <h3 className="font-bold text-gray-800">Bloquear de Grupos</h3>
                                <p className="text-xs text-gray-500">Selecione quem NÃO pode te adicionar:</p>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {contacts.map(contact => (
                                <div key={contact.id} className="flex items-center justify-between p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => toggleGroupBlacklist(contact.id)}>
                                    <div className="flex items-center gap-3">
                                        <img src={contact.avatar} className="w-10 h-10 rounded-full" />
                                        <span className="font-medium">{contact.name}</span>
                                    </div>
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${settings.groupBlacklist && settings.groupBlacklist[contact.id] ? 'bg-red-500 border-red-500' : 'border-gray-300'}`}>
                                        {settings.groupBlacklist && settings.groupBlacklist[contact.id] && <div className="icon-check text-white text-xs"></div>}
                                    </div>
                                </div>
                            ))}
                            {contacts.length === 0 && <p className="text-center text-gray-400 mt-10">Nenhum contato privado encontrado.</p>}
                        </div>
                    </div>
                )}

                {/* QR Code Modal */}
                <QRCodeModal />
                
                {/* Requests Modal */}
                <RequestsModal />
            </div>
        </div>
    );
}