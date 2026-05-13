function Settings({ user, onClose, chats }) {
    const [settings, setSettings] = React.useState({
        publicId: true,
        showOnline: true,
        readReceipts: true,
        readReceiptExceptions: {}, // { userId: true }
        groupPrivacy: 'everyone', // 'everyone', 'contacts', 'blacklist', 'nobody'
        groupBlacklist: {} // { userId: true }
    });
    const [showExceptionModal, setShowExceptionModal] = React.useState(false);
    const [showGroupBlacklistModal, setShowGroupBlacklistModal] = React.useState(false);

    React.useEffect(() => {
        window.firebaseDB.ref(`users/${user.id}/settings`).once('value').then(snapshot => {
            const data = snapshot.val();
            if (data) {
                setSettings({ ...settings, ...data });
            }
        });
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

    const handleAvatarChange = async (e) => {
        if (!e.target.files[0]) return;
        
        try {
            const file = e.target.files[0];
            const base64 = await window.compressImage(file, 300, 0.7);
            
            // Update Firebase
            window.firebaseDB.ref(`users/${user.id}/avatar`).set(base64);
            
            // Update Local Storage
            const updatedUser = { ...user, avatar: base64 };
            localStorage.setItem("chat_user", JSON.stringify(updatedUser));
            
            // Update state (Settings is controlled by props mostly, but we can try to force update or rely on parent re-render if it listened to firebase, 
            // but for immediate feedback in this modal which uses props.user, we might need to reload or just trust Firebase listener in parent will propagate)
            // Ideally, App.js listens to user changes or we update the parent. 
            // Since we are just editing DB, let's assume real-time listener in App/ChatInterface will pick it up? 
            // Actually ChatInterface passes `user` prop from App.js state which comes from localStorage initially.
            // We should notify user to reload or handle it better.
            // BUT, let's update the image src directly in DOM for instant feedback if we want, or just wait.
            // Let's reload page for simplicity to ensure all states sync, OR dispatch event.
            // Actually, best way in this architecture: Update DB, and update LocalStorage. App.js won't re-render automatically from LocalStorage change.
            // Let's use window.location.reload() for a hard sync as requested "funciona de verdade" often implies consistency.
            // Or better: trigger a callback if we had one.
            window.location.reload(); 
            
        } catch (error) {
            console.error("Erro ao trocar foto:", error);
            alert("Erro ao carregar a imagem.");
        }
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
            </div>
        </div>
    );
}
