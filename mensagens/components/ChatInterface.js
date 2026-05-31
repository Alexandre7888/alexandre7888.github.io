// components/ChatInterface.js
function ChatInterface({ user, onLogout, pendingJoinGroupId, onClearJoin }) {
    const [activeChat, setActiveChat] = React.useState(null);
    const [messageInput, setMessageInput] = React.useState("");
    const [chats, setChats] = React.useState([]);
    const [messages, setMessages] = React.useState([]);
    const [showAudioRecorder, setShowAudioRecorder] = React.useState(false);

    // ==================== FUNCIONALIDADES BÁSICAS ====================
    const [editingMessage, setEditingMessage] = React.useState(null);
    const [editInput, setEditInput] = React.useState("");
    const [contextMenu, setContextMenu] = React.useState({ visible: false, x: 0, y: 0, message: null });
    const [toastMessage, setToastMessage] = React.useState(null);
    const [copiedMessageId, setCopiedMessageId] = React.useState(null);
    const [uploadProgress, setUploadProgress] = React.useState({});

    // ==================== MODAL STATES ====================
    const [showUserInfo, setShowUserInfo] = React.useState(false);
    const [selectedUser, setSelectedUser] = React.useState(null);
    const [showAddContact, setShowAddContact] = React.useState(false);
    const [showGroupInfo, setShowGroupInfo] = React.useState(false);
    const [showSettings, setShowSettings] = React.useState(false);
    const [showBotCreator, setShowBotCreator] = React.useState(false);
    const [showReportModal, setShowReportModal] = React.useState(false);
    const [reportReason, setReportReason] = React.useState("");
    const [reporting, setReporting] = React.useState(false);
    const [showAddFriendModal, setShowAddFriendModal] = React.useState(false);
    const [friendUsername, setFriendUsername] = React.useState("");

    // ==================== CALL MANAGER STATE ====================
    const [showCallManager, setShowCallManager] = React.useState(false);
    const [callManagerProps, setCallManagerProps] = React.useState({
        isIncoming: false,
        isVideo: false,
        targetPeerId: null,
        isActive: false,
        chatName: null,
        chatAvatar: null
    });

    // Rate limiter
    const rateLimiter = React.useRef({});
    const lastMessageTime = React.useRef({});
    const MAX_MSG_PER_MINUTE = 30;
    const BAN_DURATION = 60;

    // ==================== SISTEMA DE ARQUIVOS EM BASE64 ====================
    const MAX_FILE_SIZE = 5 * 1024 * 1024;

    // Estados de amizade e bloqueio
    const [friends, setFriends] = React.useState({});
    const [friendRequests, setFriendRequests] = React.useState({});
    const [blockedUsers, setBlockedUsers] = React.useState({});

    // ==================== REFERÊNCIA DO MOTOR DE REGRAS ====================
    const ruleMotorRef = React.useRef(null);

    // ==================== FUNÇÕES DE ARQUIVO ====================
    const fileToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const db = window.firebaseDB;

    // ==================== FUNÇÕES DE AMIZADE ====================

    const loadFriendsData = async () => {
        if (!db || !user) return;

        try {
            const friendsSnap = await db.ref(`users/${user.id}/friends`).once('value');
            setFriends(friendsSnap.val() || {});

            const requestsSnap = await db.ref(`users/${user.id}/friendRequests/received`).once('value');
            setFriendRequests(requestsSnap.val() || {});

            const blockedSnap = await db.ref(`users/${user.id}/blocked`).once('value');
            setBlockedUsers(blockedSnap.val() || {});
        } catch(e) {
            console.error("Erro ao carregar dados de amizade:", e);
        }
    };

    const sendFriendRequestByUsername = async () => {
        if (!friendUsername.trim()) {
            showToastMessage("Digite um nome de usuário!", "error");
            return;
        }

        try {
            const usersSnap = await db.ref(`users`).orderByChild('name').equalTo(friendUsername).once('value');
            const users = usersSnap.val();

            if (!users) {
                showToastMessage("Usuário não encontrado!", "error");
                return;
            }

            const targetUserId = Object.keys(users)[0];
            const targetUserData = users[targetUserId];

            if (targetUserId === user.id) {
                showToastMessage("Você não pode adicionar a si mesmo!", "error");
                return;
            }

            const existingFriend = await db.ref(`users/${user.id}/friends/${targetUserId}`).once('value');
            if (existingFriend.exists()) {
                showToastMessage("Você já é amigo deste usuário!", "info");
                return;
            }

            await db.ref(`users/${targetUserId}/friendRequests/received/${user.id}`).set({
                fromId: user.id,
                fromName: user.name,
                fromAvatar: user.avatar,
                timestamp: Date.now(),
                status: 'pending',
                username: user.name
            });

            await db.ref(`users/${user.id}/friendRequests/sent/${targetUserId}`).set({
                toId: targetUserId,
                toName: targetUserData.name,
                timestamp: Date.now(),
                status: 'pending'
            });

            showToastMessage(`Solicitação enviada para @${friendUsername}!`, "success");
            setShowAddFriendModal(false);
            setFriendUsername("");

        } catch(e) {
            console.error("Erro ao enviar solicitação:", e);
            showToastMessage("Erro ao enviar solicitação!", "error");
        }
    };

    const acceptFriendRequest = async (fromUserId, fromName) => {
        try {
            await db.ref(`users/${user.id}/friends/${fromUserId}`).set({
                addedAt: Date.now(),
                name: fromName,
                avatar: null
            });

            await db.ref(`users/${fromUserId}/friends/${user.id}`).set({
                addedAt: Date.now(),
                name: user.name,
                avatar: user.avatar
            });

            await db.ref(`users/${user.id}/friendRequests/received/${fromUserId}`).remove();
            await db.ref(`users/${fromUserId}/friendRequests/sent/${user.id}`).remove();

            showToastMessage(`Você agora é amigo de ${fromName}!`, "success");
            loadFriendsData();
        } catch(e) {
            console.error("Erro ao aceitar solicitação:", e);
            showToastMessage("Erro ao aceitar solicitação!", "error");
        }
    };

    const rejectFriendRequest = async (fromUserId) => {
        try {
            await db.ref(`users/${user.id}/friendRequests/received/${fromUserId}`).remove();
            await db.ref(`users/${fromUserId}/friendRequests/sent/${user.id}`).remove();
            showToastMessage("Solicitação recusada!", "success");
            loadFriendsData();
        } catch(e) {
            console.error("Erro ao recusar solicitação:", e);
            showToastMessage("Erro ao recusar solicitação!", "error");
        }
    };

    const removeFriend = async (friendId, friendName) => {
        if (!confirm(`Deseja remover ${friendName} dos seus amigos?`)) return;

        try {
            await db.ref(`users/${user.id}/friends/${friendId}`).remove();
            await db.ref(`users/${friendId}/friends/${user.id}`).remove();
            showToastMessage(`${friendName} removido dos amigos!`, "success");
            loadFriendsData();
        } catch(e) {
            console.error("Erro ao remover amigo:", e);
            showToastMessage("Erro ao remover amigo!", "error");
        }
    };

    // ==================== FUNÇÕES DE DENÚNCIA ====================

    const reportUser = async () => {
        if (!reportReason.trim()) {
            showToastMessage("Digite um motivo para a denúncia!", "error");
            return;
        }

        setReporting(true);

        try {
            await db.ref(`reports/${Date.now()}_${user.id}_${selectedUser?.id}`).set({
                reportedBy: user.id,
                reportedByName: user.name,
                reportedUser: selectedUser?.id,
                reportedUserName: selectedUser?.name,
                reason: reportReason,
                timestamp: Date.now(),
                status: "pending",
                chatId: activeChat?.id,
                chatName: activeChat?.name
            });

            showToastMessage("Denúncia enviada! Nossa equipe irá analisar.", "success");
            setShowReportModal(false);
            setReportReason("");
        } catch(e) {
            console.error("Erro ao denunciar:", e);
            showToastMessage("Erro ao enviar denúncia!", "error");
        } finally {
            setReporting(false);
        }
    };

    // ==================== VERIFICAÇÕES ====================

    const checkInactivity = async (userId) => {
        try {
            const snapshot = await db.ref(`users/${userId}`).once('value');
            const userData = snapshot.val();
            const lastActive = userData?.lastActive || userData?.createdAt || Date.now();
            const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            if (lastActive < oneWeekAgo) {
                showToastMessage("Conta inativa por mais de 7 dias!", "error");
                return false;
            }
            return true;
        } catch(e) {
            return true;
        }
    };

    const checkIfBlocked = async (userId) => {
        try {
            const blockSnap = await db.ref(`users/${user.id}/blocked/${userId}`).once('value');
            const blockedByThemSnap = await db.ref(`users/${userId}/blocked/${user.id}`).once('value');
            return { blockedByMe: blockSnap.exists(), blockedByThem: blockedByThemSnap.exists() };
        } catch(e) {
            return { blockedByMe: false, blockedByThem: false };
        }
    };

    const checkRateLimit = (userId, chatId) => {
        const now = Date.now();
        const key = `${userId}_${chatId}`;
        const userRate = rateLimiter.current[key] || { count: 0, firstTime: now, bannedUntil: 0 };
        if (userRate.bannedUntil > now) {
            showToastMessage(`Banido até ${new Date(userRate.bannedUntil).toLocaleTimeString()}`, "error");
            return false;
        }
        if (userRate.count >= MAX_MSG_PER_MINUTE && (now - userRate.firstTime) < 60000) {
            userRate.bannedUntil = now + (BAN_DURATION * 1000);
            rateLimiter.current[key] = userRate;
            showToastMessage(`Limite excedido! Banido por ${BAN_DURATION}s`, "error");
            return false;
        }
        if ((now - userRate.firstTime) > 60000) {
            userRate.count = 1;
            userRate.firstTime = now;
        } else {
            userRate.count++;
        }
        rateLimiter.current[key] = userRate;
        return true;
    };

    const formatMarkdown = (text) => {
        if (!text || typeof text !== 'string') return text;
        let formatted = text;
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        formatted = formatted.replace(/__(.*?)__/g, '<u>$1</u>');
        formatted = formatted.replace(/~~(.*?)~~/g, '<del>$1</del>');
        formatted = formatted.replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded text-sm">$1</code>');
        return formatted;
    };

    const copyToClipboard = async (text, messageId) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedMessageId(messageId);
            showToastMessage("Copiado!", "success");
            setTimeout(() => setCopiedMessageId(null), 2000);
        } catch (err) {
            showToastMessage("Erro ao copiar", "error");
        }
    };

    const canEditMessage = (message) => {
        if (message.senderId !== user.id) return false;
        const messageAge = (Date.now() - message.timestamp) / (1000 * 60 * 60);
        if (messageAge > 4) return false;
        if (message.readBy && Object.keys(message.readBy).length > 0) return false;
        return true;
    };

    const editMessage = async (messageKey, newText) => {
        if (!activeChat || !newText || !newText.trim()) return;
        const msgRef = activeChat.type === 'group' 
            ? db.ref(`groups/${activeChat.id}/messages/${messageKey}`)
            : db.ref(`chats/${[user.id, activeChat.id].sort().join('_')}/messages/${messageKey}`);
        await msgRef.update({ text: newText, edited: true });
        setEditingMessage(null);
        setEditInput("");
        showToastMessage("Mensagem editada!", "success");
    };

    const canDeleteMessage = (message) => {
        if (message.senderId === user.id) return true;
        if (activeChat?.type === 'group' && isCurrentUserAdmin) return true;
        return false;
    };

    const deleteMessage = (msgKey) => {
        if (!activeChat) return;
        const msg = messages.find(m => m.key === msgKey);
        if (!msg) return;
        if (msg.senderId !== user.id && !isCurrentUserAdmin) {
            showToastMessage("Apenas administradores podem apagar!", "error");
            return;
        }
        if (activeChat.type === 'group') {
            if (!confirm("Excluir para todos?")) return;
            db.ref(`groups/${activeChat.id}/messages/${msgKey}`).remove();
        } else {
            if (!confirm("Excluir mensagem?")) return;
            db.ref(`chats/${[user.id, activeChat.id].sort().join('_')}/messages/${msgKey}`).remove();
        }
        showToastMessage("Apagada!", "success");
    };

    const handleContextMenu = (e, message) => {
        e.preventDefault();
        if (!canDeleteMessage(message)) return;
        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, message: message });
    };

    const showToastMessage = (message, type = "info") => {
        setToastMessage({ message, type });
        setTimeout(() => setToastMessage(null), 3000);
    };

    // Bot & Media States
    const fileInputRef = React.useRef(null);
    const videoInputRef = React.useRef(null);

    // Permissions
    const [groupPermissions, setGroupPermissions] = React.useState(null);
    const [professionalPanel, setProfessionalPanel] = React.useState(false);
    const [showProfessionalPanel, setShowProfessionalPanel] = React.useState(false);
    const [backgroundMode, setBackgroundMode] = React.useState(false);

    const messagesEndRef = React.useRef(null);
    const currentAudioRef = React.useRef(null);
    const backgroundAudioRef = React.useRef(null);

    const isCurrentUserAdmin = React.useMemo(() => {
        if (!activeChat || activeChat.type !== 'group') return false;
        return activeChat.members?.[user.id] === 'admin';
    }, [activeChat, user.id]);

    // ==================== INICIALIZAR MOTOR DE REGRAS ====================
    React.useEffect(() => {
        if (!db || !user) return;

        if (!window.ruleMotorInstance) {
            if (typeof window.RuleMotor === 'function') {
                window.ruleMotorInstance = new window.RuleMotor();
                console.log('[ChatInterface] Instância do RuleMotor criada');
            } else {
                console.warn('[ChatInterface] RuleMotor não está disponível');
                return;
            }
        }

        if (window.ruleMotorInstance && !ruleMotorRef.current) {
            window.ruleMotorInstance.init(db, user);
            ruleMotorRef.current = window.ruleMotorInstance;
            console.log('[ChatInterface] Motor de regras inicializado');
        }

        return () => {
            if (ruleMotorRef.current) {
                ruleMotorRef.current.stop();
                ruleMotorRef.current = null;
            }
        };
    }, [db, user]);

    // Atualiza último ativo
    React.useEffect(() => {
        const updateLastActive = () => {
            if (db && user) db.ref(`users/${user.id}/lastActive`).set(Date.now());
        };
        updateLastActive();
        const interval = setInterval(updateLastActive, 60 * 60 * 1000);
        return () => clearInterval(interval);
    }, [user?.id, db]);

    React.useEffect(() => {
        const handleClick = () => setContextMenu({ visible: false, x: 0, y: 0, message: null });
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // ==================== FUNÇÃO PARA INICIAR CHAMADA ====================
    const startCall = (video = false, targetUser = null) => {
        let targetPeerId = null;
        let chatName = null;
        let chatAvatar = null;
        
        if (targetUser) {
            // Chamada vindo do UserInfoModal
            targetPeerId = targetUser.id?.replace(/[^a-zA-Z0-9]/g, '');
            chatName = targetUser.name;
            chatAvatar = targetUser.avatar;
        } else if (activeChat) {
            // Chamada vindo do chat ativo
            if (activeChat.type === 'group') {
                targetPeerId = activeChat.id?.replace(/[^a-zA-Z0-9]/g, '');
                chatName = activeChat.name;
                chatAvatar = activeChat.avatar;
            } else {
                // Chat privado - extrair ID do outro usuário
                if (activeChat.id && activeChat.id.includes('_')) {
                    const ids = activeChat.id.split('_');
                    targetPeerId = ids.find(id => id !== user?.id)?.replace(/[^a-zA-Z0-9]/g, '');
                } else {
                    targetPeerId = activeChat.id?.replace(/[^a-zA-Z0-9]/g, '');
                }
                chatName = activeChat.name;
                chatAvatar = activeChat.avatar;
            }
        }
        
        if (!targetPeerId) {
            showToastMessage("Não foi possível identificar o destinatário da chamada", "error");
            return;
        }
        
        const myCleanId = user?.id?.replace(/[^a-zA-Z0-9]/g, '');
        if (targetPeerId === myCleanId) {
            showToastMessage("Você não pode ligar para si mesmo!", "error");
            return;
        }
        
        console.log("📞 Iniciando chamada para:", targetPeerId);
        console.log("🎥 Com vídeo?", video);
        
        setCallManagerProps({
            isIncoming: false,
            isVideo: video,
            targetPeerId: targetPeerId,
            isActive: true,
            chatName: chatName || "Usuário",
            chatAvatar: chatAvatar
        });
        setShowCallManager(true);
    };

    // ==================== FUNÇÃO PARA ENVIAR ARQUIVO EM BASE64 ====================
    const sendMediaFile = async (file, type) => {
        if (!activeChat) return;

        if (activeChat.type !== 'group') {
            const { blockedByMe, blockedByThem } = await checkIfBlocked(activeChat.id);
            if (blockedByMe) {
                showToastMessage("Desbloqueie o contato para enviar arquivos!", "error");
                return;
            }
            if (blockedByThem) {
                showToastMessage("Você foi bloqueado por este contato!", "error");
                return;
            }
        }

        if (file.size > MAX_FILE_SIZE) { 
            showToastMessage("Arquivo muito grande! Máximo 5MB", "error"); 
            return; 
        }

        if (!(await checkInactivity(user.id))) return;
        if (!checkRateLimit(user.id, activeChat.id)) return;

        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));

        try {
            const base64 = await fileToBase64(file);
            setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));

            const msgData = {
                senderId: user.id,
                senderName: user.name,
                text: base64,
                type: type,
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                timestamp: Date.now(),
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };

            const ref = activeChat.type === 'group' 
                ? db.ref(`groups/${activeChat.id}/messages`)
                : db.ref(`chats/${[user.id, activeChat.id].sort().join('_')}/messages`);

            await ref.push(msgData);
            showToastMessage(`${type === 'image' ? 'Imagem' : type === 'video' ? 'Vídeo' : 'Arquivo'} enviado!`, "success");

        } catch (error) { 
            console.error("Erro:", error); 
            showToastMessage("Erro ao enviar arquivo!", "error"); 
        } finally { 
            setTimeout(() => setUploadProgress(prev => { const newProgress = { ...prev }; delete newProgress[file.name]; return newProgress; }), 2000); 
        }
    };

    // ==================== FUNÇÃO PARA RENDERIZAR MÍDIA ====================
    const renderMediaContent = (msg) => {
        if (msg.fileName && msg.text && msg.text.startsWith('data:')) {
            const isImage = msg.type === 'image' || msg.fileType?.startsWith('image/');
            const isVideo = msg.type === 'video' || msg.fileType?.startsWith('video/');
            const fileSizeMB = (msg.fileSize / (1024 * 1024)).toFixed(2);

            const handleDownload = () => {
                const link = document.createElement('a');
                link.href = msg.text;
                link.download = msg.fileName;
                link.click();
                showToastMessage(`Baixando ${msg.fileName}...`, "success");
            };

            if (isImage) {
                return (
                    <div className="mb-1">
                        <img src={msg.text} className="rounded-lg max-w-full max-h-80 cursor-pointer object-contain" onClick={() => window.open(msg.text, '_blank')} alt={msg.fileName} />
                        <button onClick={handleDownload} className="mt-2 text-xs bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600">📥 Baixar Imagem</button>
                    </div>
                );
            }

            if (isVideo) {
                return (
                    <div className="mb-1">
                        <video src={msg.text} controls className="rounded-lg max-w-full max-h-80" poster="https://via.placeholder.com/400x300?text=Video" />
                        <button onClick={handleDownload} className="mt-2 text-xs bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600">📥 Baixar Vídeo</button>
                    </div>
                );
            }

            return (
                <div className="file-card">
                    <div className="icon-file text-2xl text-blue-500"></div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{msg.fileName}</p>
                        <p className="text-xs text-gray-500">{fileSizeMB} MB</p>
                    </div>
                    <button onClick={handleDownload} className="download-btn">Baixar</button>
                </div>
            );
        }

        if (msg.text && typeof msg.text === 'string' && msg.text.startsWith('{')) {
            try {
                const parsed = JSON.parse(msg.text);
                if (parsed.fileId) {
                    return (
                        <div className="file-card">
                            <div className="icon-file text-2xl text-gray-500"></div>
                            <div className="flex-1">
                                <p className="text-sm font-medium">{parsed.fileName}</p>
                                <p className="text-xs text-red-500">Formato antigo</p>
                            </div>
                        </div>
                    );
                }
            } catch(e) {}
            return <p className="text-gray-800 break-words">{msg.text}</p>;
        }

        return <p className="text-gray-800 break-words" dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.text || '') }}></p>;
    };

    // ==================== USER INFO DENTRO DO CHATINTERFACE ====================
    const UserInfoModal = () => {
        if (!showUserInfo || !selectedUser) return null;

        const isFriend = friends[selectedUser.id];
        const hasPendingRequest = friendRequests[selectedUser.id];
        const isBlocked = blockedUsers[selectedUser.id];

        return (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                    <div className="bg-[#f0f2f5] p-4 flex justify-between items-center border-b sticky top-0">
                        <h2 className="font-semibold text-gray-800">Informações do Contato</h2>
                        <button onClick={() => setShowUserInfo(false)} className="text-gray-500 hover:text-gray-700">
                            <div className="icon-x text-xl"></div>
                        </button>
                    </div>

                    <div className="p-6">
                        <div className="flex justify-center mb-4">
                            {selectedUser.avatar ? (
                                <img src={selectedUser.avatar} className="w-32 h-32 rounded-full object-cover border-4 border-gray-200" />
                            ) : (
                                <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center border-4 border-gray-200">
                                    <div className="icon-user text-5xl text-gray-400"></div>
                                </div>
                            )}
                        </div>

                        <h3 className="text-xl font-bold text-center text-gray-800">{selectedUser.name}</h3>
                        <p className="text-center text-gray-500 text-sm mt-1">@{selectedUser.name}</p>
                        <p className="text-center text-gray-400 text-xs">ID: {selectedUser.id}</p>

                        <div className="flex flex-wrap justify-center gap-3 mt-6">
                            <button onClick={() => { setShowUserInfo(false); startCall(false, selectedUser); }} className="flex flex-col items-center gap-1 p-2 bg-green-50 rounded-lg hover:bg-green-100 transition">
                                <div className="icon-phone text-xl text-green-600"></div>
                                <span className="text-xs">Ligar</span>
                            </button>
                            <button onClick={() => { setShowUserInfo(false); startCall(true, selectedUser); }} className="flex flex-col items-center gap-1 p-2 bg-green-50 rounded-lg hover:bg-green-100 transition">
                                <div className="icon-video text-xl text-green-600"></div>
                                <span className="text-xs">Video</span>
                            </button>
                            <button onClick={() => { setShowUserInfo(false); openChat(selectedUser); }} className="flex flex-col items-center gap-1 p-2 bg-blue-50 rounded-lg hover:bg-blue-100 transition">
                                <div className="icon-message-circle text-xl text-blue-600"></div>
                                <span className="text-xs">Mensagem</span>
                            </button>
                        </div>

                        <div className="mt-6 pt-4 border-t border-gray-100">
                            {isBlocked ? (
                                <button onClick={() => {
                                    db.ref(`users/${user.id}/blocked/${selectedUser.id}`).remove();
                                    loadFriendsData();
                                    showToastMessage("Usuário desbloqueado!", "success");
                                    setShowUserInfo(false);
                                }} className="w-full py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition">
                                    Desbloquear Usuário
                                </button>
                            ) : isFriend ? (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-center gap-2 text-green-600">
                                        <div className="icon-user-check"></div>
                                        <span className="text-sm">Amigos</span>
                                    </div>
                                    <button onClick={() => removeFriend(selectedUser.id, selectedUser.name)} className="w-full py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition">
                                        Remover Amigo
                                    </button>
                                </div>
                            ) : hasPendingRequest ? (
                                <div className="flex gap-2">
                                    <button onClick={() => acceptFriendRequest(selectedUser.id, selectedUser.name)} className="flex-1 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition">Aceitar</button>
                                    <button onClick={() => rejectFriendRequest(selectedUser.id)} className="flex-1 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition">Recusar</button>
                                </div>
                            ) : (
                                <button onClick={() => {
                                    setFriendUsername(selectedUser.name);
                                    sendFriendRequestByUsername();
                                }} className="w-full py-2 bg-[#00a884] text-white rounded-lg hover:bg-[#008f6f] transition flex items-center justify-center gap-2">
                                    <div className="icon-user-plus"></div> Adicionar Amigo
                                </button>
                            )}
                        </div>

                        {!isBlocked && (
                            <div className="mt-4 flex gap-2">
                                <button onClick={() => {
                                    db.ref(`users/${user.id}/blocked/${selectedUser.id}`).set({ blockedAt: Date.now() });
                                    loadFriendsData();
                                    showToastMessage("Usuário bloqueado!", "success");
                                    setShowUserInfo(false);
                                }} className="flex-1 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition flex items-center justify-center gap-2">
                                    <div className="icon-ban"></div> Bloquear
                                </button>
                                <button onClick={() => setShowReportModal(true)} className="flex-1 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition flex items-center justify-center gap-2">
                                    <div className="icon-flag"></div> Denunciar
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {showReportModal && (
                    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                                <h3 className="text-lg font-semibold">Denunciar {selectedUser?.name}</h3>
                                <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-gray-600">
                                    <div className="icon-x"></div>
                                </button>
                            </div>
                            <div className="p-4">
                                <textarea 
                                    value={reportReason} 
                                    onChange={(e) => setReportReason(e.target.value)} 
                                    placeholder="Motivo da denúncia (ex: spam, ofensas, etc)..."
                                    className="w-full border rounded-lg p-3 text-sm focus:outline-none focus:border-red-500" 
                                    rows="4"
                                />
                            </div>
                            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
                                <button onClick={() => setShowReportModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                                <button onClick={reportUser} disabled={reporting} className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">
                                    {reporting ? 'Enviando...' : 'Enviar Denúncia'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Carregar chats
    React.useEffect(() => {
        if (!db || !user) return;
        const contactsRef = db.ref(`users/${user.id}/contacts`);
        const loadContacts = (snapshot) => {
            const data = snapshot.val();
            if (!data) {
                setChats([]);
                return;
            }
            Promise.all(Object.keys(data).map(async id => {
                try {
                    const ref = data[id].type === 'group' ? `groups/${id}` : `users/${id}`;
                    const val = (await db.ref(ref).once('value')).val();
                    let status = 'offline', privacy = {};
                    if (data[id].type !== 'group' && val) {
                        const statusSnap = await db.ref(`users/${id}/status`).once('value');
                        const settingsSnap = await db.ref(`users/${id}/settings`).once('value');
                        if (statusSnap.val()) status = statusSnap.val().state;
                        if (settingsSnap.val()) privacy = settingsSnap.val();
                    }
                    return { ...val, type: data[id].type, status, privacy, id: id };
                } catch(e) {
                    return null;
                }
            })).then(loadedChats => {
                const validChats = loadedChats.filter(c => c !== null);
                setChats(prev => { 
                    const map = new Map(prev.map(c => [c.id, c])); 
                    validChats.forEach(c => map.set(c.id, c)); 
                    return Array.from(map.values()); 
                });
            });
        };
        contactsRef.on('value', loadContacts);
        return () => contactsRef.off();
    }, [user, db]);

    // ==================== FUNÇÃO PARA CARREGAR MENSAGENS E EXECUTAR REGRAS ====================
    React.useEffect(() => {
        if (!activeChat || !db) return;

        const loadMessages = async () => {
            try {
                let messagesRef;
                let isBlocked = false;

                if (activeChat.type !== 'group') {
                    const { blockedByMe, blockedByThem } = await checkIfBlocked(activeChat.id);
                    isBlocked = blockedByMe || blockedByThem;
                }

                if (isBlocked) {
                    setMessages([{
                        key: 'blocked',
                        senderId: 'system',
                        senderName: 'Sistema',
                        text: '❌ Conversa bloqueada. Desbloqueie o contato para ver as mensagens.',
                        type: 'system',
                        timestamp: Date.now()
                    }]);
                    return;
                }

                messagesRef = activeChat.type === 'group' ? db.ref(`groups/${activeChat.id}/messages`) : db.ref(`chats/${[user.id, activeChat.id].sort().join('_')}/messages`);

                const markAsRead = (msgId, senderId) => {
                    db.ref(`users/${user.id}/settings`).once('value').then(s => {
                        const settings = s.val() || {};
                        let allowReadReceipt = settings.readReceipts !== false;
                        if (settings.readReceiptExceptions && settings.readReceiptExceptions[senderId]) allowReadReceipt = !allowReadReceipt;
                        if (allowReadReceipt) {
                            if (activeChat.type === 'group') db.ref(`groups/${activeChat.id}/messages/${msgId}/readBy/${user.id}`).set(Date.now());
                            else db.ref(`chats/${[user.id, activeChat.id].sort().join('_')}/messages/${msgId}/status`).set('read');
                        }
                    });
                };

                messagesRef.limitToLast(50).on('child_added', (snapshot) => {
                    const msg = snapshot.val();
                    setMessages(prev => [...prev, { ...msg, key: snapshot.key }]);

                    if (msg.senderId !== user.id) markAsRead(snapshot.key, msg.senderId);

                    // Executar regras para mensagens recebidas
                    if (activeChat.type === 'group' && msg.senderId !== user.id && window.ruleMotorInstance) {
                        const memberData = {
                            id: msg.senderId,
                            name: msg.senderName,
                            role: activeChat.members?.[msg.senderId] || 'member'
                        };

                        setTimeout(() => {
                            window.ruleMotorInstance.executeRules(activeChat.id, msg, memberData);
                            console.log(`[ChatInterface] Regras executadas para mensagem de ${msg.senderName}`);
                        }, 100);
                    }
                });

                messagesRef.limitToLast(50).on('child_changed', (snapshot) => setMessages(prev => prev.map(m => m.key === snapshot.key ? { ...snapshot.val(), key: snapshot.key } : m)));

                return () => {
                    if (messagesRef) messagesRef.off();
                    setMessages([]);
                };
            } catch(e) {
                console.error("Erro ao carregar mensagens:", e);
            }
        };

        loadMessages();
    }, [activeChat, user, db]);

    React.useEffect(() => { 
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); 
    }, [messages]);

    // ==================== FUNÇÃO PRINCIPAL PARA ENVIAR MENSAGEM ====================
    const handleSendMessage = async (content, type = 'text', duration = null, msgType = 'text') => {
        if (!activeChat) {
            showToastMessage("Nenhum chat selecionado!", "error");
            return;
        }

        if (activeChat.type !== 'group') {
            const { blockedByMe, blockedByThem } = await checkIfBlocked(activeChat.id);
            if (blockedByMe) {
                showToastMessage("Desbloqueie o contato para enviar mensagens!", "error");
                return;
            }
            if (blockedByThem) {
                showToastMessage("Você foi bloqueado por este contato!", "error");
                return;
            }
        }

        const isActive = await checkInactivity(user.id);
        if (!isActive) return;

        if (type === 'text' && (!content || !content.trim() || /^[\s\u200B-\u200D\uFEFF]*$/.test(content))) { 
            showToastMessage("Mensagem vazia não é permitida!", "error"); 
            return; 
        }

        const now = Date.now();
        if (lastMessageTime.current[activeChat.id] && (now - lastMessageTime.current[activeChat.id]) < 800) { 
            showToastMessage("Aguarde antes de enviar outra mensagem!", "warning"); 
            return; 
        }
        lastMessageTime.current[activeChat.id] = now;

        if (!checkRateLimit(user.id, activeChat.id)) return;

        if (activeChat.type === 'group' && groupPermissions && type !== 'system') {
            if (type === 'text' && !groupPermissions.sendText) {
                showToastMessage("Você não tem permissão para enviar texto neste grupo!", "error");
                return;
            }
            if (type === 'audio' && !groupPermissions.sendAudio) {
                showToastMessage("Você não tem permissão para enviar áudio neste grupo!", "error");
                return;
            }
        }

        try {
            if (type === 'audio') {
                const msgData = {
                    senderId: user.id,
                    senderName: user.name,
                    text: '🎵 Mensagem de áudio',
                    type: 'audio',
                    audio: content,
                    duration: duration,
                    timestamp: Date.now(),
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };
                const ref = activeChat.type === 'group' ? db.ref(`groups/${activeChat.id}/messages`) : db.ref(`chats/${[user.id, activeChat.id].sort().join('_')}/messages`);
                await ref.push(msgData);
            } else if (type === 'system') {
                const ref = activeChat.type === 'group' ? db.ref(`groups/${activeChat.id}/messages`) : db.ref(`chats/${[user.id, activeChat.id].sort().join('_')}/messages`);
                await ref.push({
                    senderId: 'system', senderName: 'Sistema', text: content, type: 'system',
                    timestamp: Date.now(),
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            } else {
                const ref = activeChat.type === 'group' ? db.ref(`groups/${activeChat.id}/messages`) : db.ref(`chats/${[user.id, activeChat.id].sort().join('_')}/messages`);
                await ref.push({
                    senderId: user.id,
                    senderName: user.name,
                    text: content,
                    type: type === 'text' ? 'text' : msgType,
                    timestamp: Date.now(),
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            }
            setMessageInput("");
            setShowAudioRecorder(false);
        } catch(e) {
            console.error("Erro ao enviar mensagem:", e);
            showToastMessage("Erro ao enviar mensagem!", "error");
        }
    };

    const handleCreateGroup = () => {
        const groupName = prompt("Nome do Grupo:");
        if (groupName && db) {
            const groupId = Math.floor(1000 + Math.random() * 9000).toString();
            db.ref(`groups/${groupId}`).set({ 
                id: groupId, 
                name: groupName, 
                avatar: null,
                members: { [user.id]: 'admin' }, 
                permissions: { sendText: true, sendAudio: true, sendVideo: true, sendMedia: true, changeInfo: false } 
            });
            db.ref(`users/${user.id}/contacts/${groupId}`).set({ type: 'group', joinedAt: Date.now() });
            showToastMessage(`Grupo "${groupName}" criado!`, "success");
        }
    };

    const handleAddContact = async (inputId) => {
        if (!inputId || !db) return;
        if (inputId.trim().toLowerCase() === 'bot') { 
            setShowAddContact(false); 
            setShowBotCreator(true); 
            return; 
        }
        try {
            const groupSnap = await db.ref(`groups/${inputId}`).once('value');
            if (groupSnap.exists()) {
                const groupData = groupSnap.val();
                await db.ref(`users/${user.id}/contacts/${inputId}`).set({ type: 'group', joinedAt: Date.now() });
                await db.ref(`groups/${inputId}/members/${user.id}`).set('member');
                setActiveChat({ ...groupData, type: 'group', id: inputId });
                setShowAddContact(false);
                showToastMessage(`Você entrou no grupo "${groupData.name}"!`, "success");
                return;
            }
            const userSnap = await db.ref(`users/${inputId}`).once('value');
            if (userSnap.exists()) {
                const userData = userSnap.val();
                await db.ref(`users/${user.id}/contacts/${inputId}`).set({ type: 'private', addedAt: Date.now() });
                setActiveChat({ ...userData, type: 'private', id: inputId });
                setShowAddContact(false);
                showToastMessage(`${userData.name || inputId} adicionado aos contatos!`, "success");
            } else {
                showToastMessage("Usuário ou grupo não encontrado!", "error");
            }
        } catch (error) { 
            console.error("Erro:", error); 
            showToastMessage("Erro ao adicionar contato!", "error"); 
        }
    };
    
    const openChat = (chat) => {
        window.history.pushState({ view: 'chat' }, '', window.location.pathname);
        setActiveChat(chat);
    };
    
    const openSettings = () => {
        window.history.pushState({ view: 'settings' }, '', window.location.pathname);
        setShowSettings(true);
    };
    
    const openGroupInfo = () => {
        window.history.pushState({ view: 'groupInfo' }, '', window.location.pathname);
        setShowGroupInfo(true);
    };
    
    const openUserInfoModal = (targetUser) => {
        window.history.pushState({ view: 'userInfo' }, '', window.location.pathname);
        setSelectedUser(targetUser);
        setShowUserInfo(true);
    };

    const ToastComponent = () => {
        if (!toastMessage) return null;
        return <div className={`fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm ${toastMessage.type === 'error' ? 'bg-red-500' : toastMessage.type === 'success' ? 'bg-green-500' : 'bg-gray-800'}`}>{toastMessage.message}</div>;
    };

    const handleAudioPlay = (audioElement) => {
        if (currentAudioRef.current && currentAudioRef.current !== audioElement) {
            currentAudioRef.current.pause();
            currentAudioRef.current.currentTime = 0;
        }
        currentAudioRef.current = audioElement;
    };

    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden">
            <ToastComponent />
            <UserInfoModal />

            {/* ==================== CALL MANAGER COMPONENT ==================== */}
            {showCallManager && (
                <CallManager
                    user={user}
                    activeChat={activeChat}
                    onCallEnd={() => setShowCallManager(false)}
                    onSendMessage={handleSendMessage}
                    initialProps={callManagerProps}
                />
            )}

            {/* Modal de entrada em grupo */}
            {pendingJoinGroupId && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
                    <div className="bg-white p-6 rounded-lg w-80">
                        <h3 className="text-lg font-semibold mb-4">Solicitar Entrada</h3>
                        <p className="text-sm text-gray-600 mb-6">Deseja participar deste grupo?</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={onClearJoin} className="px-4 py-2 text-gray-600 rounded">Cancelar</button>
                            <button onClick={async () => { 
                                if (!db) return;
                                const groupData = (await db.ref(`groups/${pendingJoinGroupId}`).once('value')).val(); 
                                if (groupData) { 
                                    if (groupData.settings?.requireApproval) { 
                                        await db.ref(`groups/${pendingJoinGroupId}/requests/${user.id}`).set({ name: user.name, avatar: user.avatar, timestamp: Date.now() }); 
                                        alert("Solicitação enviada!"); 
                                        onClearJoin(); 
                                    } else { 
                                        await db.ref(`groups/${pendingJoinGroupId}/members/${user.id}`).set('member'); 
                                        await db.ref(`users/${user.id}/contacts/${pendingJoinGroupId}`).set({ type: 'group', joinedAt: Date.now() }); 
                                        setActiveChat({ ...groupData, id: pendingJoinGroupId, type: 'group' }); 
                                        onClearJoin(); 
                                    } 
                                } 
                            }} className="px-4 py-2 bg-[#00a884] text-white rounded">Solicitar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Criador de Bot */}
            {showBotCreator && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
                    <div className="bg-white p-6 rounded-lg w-80">
                        <h3 className="text-lg font-semibold mb-4">Criar Bot</h3>
                        <input type="text" id="botName" placeholder="Nome do Bot" className="w-full border rounded p-2 mb-4" />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowBotCreator(false)} className="px-4 py-2 text-gray-600 rounded">Cancelar</button>
                            <button onClick={async () => { 
                                const name = document.getElementById('botName').value; 
                                if (name && db) { 
                                    const botId = "bot_" + Math.random().toString(36).substring(2, 10); 
                                    await db.ref(`users/${botId}`).set({ id: botId, name: name, avatar: null, isBot: true, createdAt: Date.now() }); 
                                    alert(`Bot criado! ID: ${botId}`); 
                                    setShowBotCreator(false); 
                                    setShowAddContact(true); 
                                } 
                            }} className="px-4 py-2 bg-[#00a884] text-white rounded">Criar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Configurações */}
            {showSettings && <Settings user={user} onClose={() => setShowSettings(false)} chats={chats} />}

            {/* Modal para adicionar amigo */}
            {showAddFriendModal && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
                    <div className="bg-white p-6 rounded-lg w-80">
                        <h3 className="text-lg font-semibold mb-4">Adicionar Amigo</h3>
                        <p className="text-sm text-gray-500 mb-2">Digite o nome de usuário (@username)</p>
                        <input 
                            type="text" 
                            value={friendUsername}
                            onChange={(e) => setFriendUsername(e.target.value)}
                            placeholder="@usuario" 
                            className="w-full border rounded-lg p-2 mb-4 focus:outline-none focus:border-[#00a884]"
                            onKeyPress={(e) => e.key === 'Enter' && sendFriendRequestByUsername()}
                            autoFocus
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowAddFriendModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                            <button onClick={sendFriendRequestByUsername} className="px-4 py-2 bg-[#00a884] text-white rounded-lg hover:bg-[#008f6f]">Enviar Solicitação</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal adicionar contato */}
            {showAddContact && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
                    <div className="bg-white p-6 rounded-lg w-80">
                        <h3 className="text-lg font-semibold mb-4">Adicionar Contato</h3>
                        <input 
                            type="text" 
                            id="newContactId" 
                            placeholder="Digite o ID do usuário ou grupo" 
                            className="w-full border rounded p-2 mb-4" 
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddContact(e.target.value); }} 
                            autoFocus
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowAddContact(false)} className="px-4 py-2 text-gray-600 rounded">Cancelar</button>
                            <button onClick={() => { const val = document.getElementById('newContactId')?.value; if (val) handleAddContact(val); setShowAddContact(false); }} className="px-4 py-2 bg-[#00a884] text-white rounded">Ir</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Solicitações de Amizade Pendentes */}
            {Object.keys(friendRequests).length > 0 && !activeChat && (
                <div className="absolute top-16 left-4 right-4 z-50 max-h-60 overflow-y-auto bg-white rounded-lg shadow-lg border border-gray-200">
                    <div className="p-3 bg-gray-50 border-b font-semibold text-gray-700">Solicitações de Amizade</div>
                    {Object.entries(friendRequests).map(([fromId, req]) => (
                        <div key={fromId} className="p-3 flex items-center justify-between border-b hover:bg-gray-50">
                            <div className="flex items-center gap-3">
                                {req.fromAvatar ? (
                                    <img src={req.fromAvatar} className="w-10 h-10 rounded-full object-cover" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                        <div className="icon-user text-gray-400"></div>
                                    </div>
                                )}
                                <div>
                                    <p className="font-medium">{req.fromName}</p>
                                    <p className="text-xs text-gray-500">@{req.fromName}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => acceptFriendRequest(fromId, req.fromName)} className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600">
                                    <div className="icon-check text-sm"></div>
                                </button>
                                <button onClick={() => rejectFriendRequest(fromId)} className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600">
                                    <div className="icon-x text-sm"></div>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Informações do Grupo */}
            {showGroupInfo && activeChat?.type === 'group' && (
                <GroupInfo 
                    activeChat={activeChat} 
                    user={user} 
                    db={db}
                    onClose={() => {
                        setShowGroupInfo(false);
                        window.history.pushState({}, '', window.location.pathname);
                    }} 
                />
            )}

            {/* Sidebar */}
            <div className={`bg-white w-[350px] flex-shrink-0 border-r border-gray-200 flex flex-col ${activeChat ? 'hidden md:flex' : 'flex'}`}>
                <div className="bg-[#f0f2f5] p-3 px-4 flex justify-between items-center h-16 border-b border-gray-300">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={openSettings}>
                        {user.avatar ? (
                            <img src={user.avatar} className="w-10 h-10 rounded-full border border-gray-300 object-cover" />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                                <div className="icon-user text-gray-500"></div>
                            </div>
                        )}
                        <span className="font-semibold text-gray-700 text-sm">{user.name}</span>
                    </div>
                    <div className="flex gap-4 text-gray-600 items-center">
                        <div className="icon-log-out cursor-pointer text-red-500 hover:bg-red-50 p-1.5 rounded-full transition" onClick={onLogout} title="Sair"></div>
                        <div className="icon-users cursor-pointer hover:bg-gray-200 p-1.5 rounded-full transition" onClick={handleCreateGroup} title="Criar grupo"></div>
                        <div className="icon-message-square-plus cursor-pointer hover:bg-gray-200 p-1.5 rounded-full transition" onClick={() => setShowAddContact(true)} title="Adicionar"></div>
                        <div className="icon-settings cursor-pointer hover:bg-gray-200 p-1.5 rounded-full transition" onClick={openSettings} title="Configurações"></div>
                    </div>
                </div>
                <div className="p-2 border-b border-gray-200">
                    <div className="bg-[#f0f2f5] rounded-lg flex items-center px-3 py-1.5">
                        <div className="icon-search text-gray-500 text-sm"></div>
                        <input type="text" placeholder="Pesquisar..." className="bg-transparent outline-none ml-3 w-full text-sm py-1" />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {chats.length > 0 ? chats.map(chat => (
                        <div key={chat.id} onClick={() => openChat(chat)} className={`flex items-center p-3 cursor-pointer hover:bg-[#f5f6f6] ${activeChat?.id === chat.id ? 'bg-[#f0f2f5]' : ''}`}>
                            {chat.avatar ? (
                                <img src={chat.avatar} className="w-12 h-12 rounded-full mr-3 object-cover" />
                            ) : (
                                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                                    <div className="icon-user text-gray-400"></div>
                                </div>
                            )}
                            <div className="flex-1 border-b border-gray-100 pb-3 h-full flex flex-col justify-center">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-gray-900 font-medium">{chat.name}</span>
                                    {chat.type === 'group' && chat.members?.[user.id] === 'admin' && (
                                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full ml-2">Admin</span>
                                    )}
                                </div>
                                <div className="text-sm text-gray-500 truncate w-48">{chat.type === 'group' ? 'Grupo' : (chat.status === 'online' ? 'Online' : 'Offline')}</div>
                            </div>
                        </div>
                    )) : (
                        <div className="p-8 text-center text-gray-400 text-sm mt-4 flex flex-col items-center">
                            <div className="icon-book-user text-4xl mb-2 opacity-30"></div>
                            Nenhum contato encontrado.<br/>Adicione um ID ou crie um grupo!
                        </div>
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            {activeChat ? (
                <div className={`flex-1 flex flex-col bg-[#efeae2] overflow-hidden ${activeChat ? 'flex' : 'hidden md:flex'}`}>
                    <div className="bg-[#f0f2f5] p-3 px-4 flex justify-between items-center h-16 border-b border-gray-300">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setActiveChat(null)} className="md:hidden text-gray-600">
                                <div className="icon-arrow-left"></div>
                            </button>
                            <div 
                                className="flex items-center gap-3 cursor-pointer" 
                                onClick={() => {
                                    if (activeChat.type === 'group') {
                                        openGroupInfo();
                                    } else {
                                        openUserInfoModal(activeChat);
                                    }
                                }}
                            >
                                {activeChat.avatar ? (
                                    <img src={activeChat.avatar} className="w-10 h-10 rounded-full object-cover" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                        <div className="icon-user text-gray-500"></div>
                                    </div>
                                )}
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-800 font-medium">{activeChat.name}</span>
                                        {activeChat.type === 'group' && activeChat.members?.[user.id] === 'admin' && (
                                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">Admin</span>
                                        )}
                                    </div>
                                    {activeChat.type === 'group' ? 
                                        <span className="text-xs text-gray-500 cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); openGroupInfo(); }}>Toque para info do grupo</span> : 
                                        (activeChat.status === 'online' ? 
                                            <span className="text-xs text-green-500 font-bold">Online</span> : 
                                            <span className="text-xs text-gray-500">Offline</span>)
                                    }
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600" onClick={(e) => e.stopPropagation()}>
                            <div className={`p-2 rounded-full cursor-pointer transition-colors ${activeChat.type === 'group' ? 'text-[#00a884] bg-green-50 hover:bg-green-100' : 'hover:bg-gray-200'}`} onClick={() => startCall(true)}>
                                <div className="icon-video text-xl"></div>
                            </div>
                            <div className={`p-2 rounded-full cursor-pointer transition-colors ${activeChat.type === 'group' ? 'text-[#00a884] bg-green-50 hover:bg-green-100' : 'hover:bg-gray-200'}`} onClick={() => startCall(false)}>
                                <div className="icon-phone text-xl"></div>
                            </div>
                            <div className="w-px h-6 bg-gray-300 mx-1"></div>
                            <div className="icon-search cursor-pointer hover:bg-gray-200 p-2 rounded-full"></div>
                            <div className="icon-more-vertical cursor-pointer hover:bg-gray-200 p-2 rounded-full"></div>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 bg-chat-pattern relative">
                        <div className="flex flex-col gap-2">
                            {messages.map((msg, idx) => {
                                const isMe = msg.senderId === user.id;
                                const isSystem = msg.type === 'system';
                                const messageId = msg.key || idx;
                                const isMediaMessage = msg.fileName && msg.text && msg.text.startsWith('data:');

                                if (isSystem) {
                                    return (
                                        <div key={idx} className="flex flex-col items-center my-2 group relative w-full">
                                            <div className="bg-[#e1f3fb] text-gray-600 text-xs px-3 py-1 rounded-full shadow-sm flex items-center gap-2 max-w-[90%] break-words text-center">
                                                <div className="icon-info shrink-0"></div>{msg.text}
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group mb-1`} onContextMenu={(e) => handleContextMenu(e, msg)}>
                                        <div className={`message-bubble rounded-lg p-2 px-3 shadow-sm relative text-sm ${isMe ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'}`}>
                                            {!isMe && activeChat.type === 'group' && (
                                                <div className="flex items-center gap-1 mb-1">
                                                    <p className="text-xs text-orange-500 font-bold">{msg.senderName}</p>
                                                    {activeChat.members?.[msg.senderId] === 'admin' && (
                                                        <span className="text-xs bg-yellow-100 text-yellow-800 px-1 rounded">👑</span>
                                                    )}
                                                </div>
                                            )}

                                            {isMediaMessage ? renderMediaContent(msg) : msg.type === 'text' ? (
                                                <div className="relative">
                                                    <p className="text-gray-800 mb-2 leading-relaxed break-words" dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.text) }}></p>
                                                    {msg.edited && <span className="text-[9px] text-gray-400 ml-1">(editado)</span>}
                                                    <button onClick={() => copyToClipboard(msg.text, messageId)} className={`mt-2 text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${copiedMessageId === messageId ? 'bg-green-500 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>
                                                        <div className="icon-copy text-xs"></div>
                                                        {copiedMessageId === messageId ? 'Copiado!' : 'Copiar'}
                                                    </button>
                                                </div>
                                            ) : msg.type === 'audio' && (
                                                <div className="flex items-center gap-3 min-w-[200px] py-2">
                                                    <div className="icon-circle-play text-gray-500 text-3xl cursor-pointer hover:text-[#00a884] transition" onClick={(e) => { const audioEl = e.target.parentElement.querySelector('audio'); if (audioEl) { handleAudioPlay(audioEl); audioEl.play(); } }}></div>
                                                    <div className="flex-1 flex flex-col justify-center">
                                                        <div className="h-1 bg-gray-300 rounded-full w-full mb-1 overflow-hidden"><div className="h-full bg-gray-500 w-0 transition-all duration-300"></div></div>
                                                        <span className="text-xs text-gray-500">{msg.duration}</span>
                                                    </div>
                                                    <audio src={msg.audio} className="hidden" onPlay={(e) => handleAudioPlay(e.target)} />
                                                </div>
                                            )}

                                            <div className="flex justify-end items-center gap-1 mt-1">
                                                <span className="text-[10px] text-gray-500">{msg.time}</span>
                                                {isMe && (msg.status === 'read' ? <div className="icon-check-check text-[14px] text-blue-500"></div> : <div className="icon-check text-[14px] text-gray-400"></div>)}
                                            </div>

                                            {canDeleteMessage(msg) && (
                                                <button onClick={() => deleteMessage(msg.key)} className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">
                                                    <div className="icon-trash text-xs"></div>
                                                </button>
                                            )}
                                            {canEditMessage(msg) && !msg.readBy && (
                                                <button onClick={() => { setEditingMessage(msg.key); setEditInput(msg.text); }} className="absolute -top-2 -right-8 p-1 bg-orange-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-orange-600">
                                                    <div className="icon-edit text-xs"></div>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                    {/* Context Menu */}
                    {contextMenu.visible && contextMenu.message && canDeleteMessage(contextMenu.message) && (
                        <div className="fixed z-50 bg-white rounded-lg shadow-xl py-1 border border-gray-200" style={{ top: contextMenu.y, left: contextMenu.x }}>
                            <button onClick={() => { copyToClipboard(contextMenu.message.text, contextMenu.message.key); setContextMenu({ visible: false, x: 0, y: 0, message: null }); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2">
                                <div className="icon-copy"></div> Copiar
                            </button>
                            {canEditMessage(contextMenu.message) && (
                                <button onClick={() => { setEditingMessage(contextMenu.message.key); setEditInput(contextMenu.message.text); setContextMenu({ visible: false, x: 0, y: 0, message: null }); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2">
                                    <div className="icon-edit"></div> Editar
                                </button>
                            )}
                            <button onClick={() => { deleteMessage(contextMenu.message.key); setContextMenu({ visible: false, x: 0, y: 0, message: null }); }} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-100 flex items-center gap-2">
                                <div className="icon-trash"></div> Apagar
                            </button>
                        </div>
                    )}

                    {/* Input Area */}
                    <div className="bg-[#f0f2f5] p-3 px-4 flex items-center gap-2">
                        {!showAudioRecorder ? (
                            <>
                                <div className="icon-smile text-2xl text-gray-500 cursor-pointer"></div>
                                <div className="icon-image text-2xl text-gray-500 cursor-pointer" onClick={() => fileInputRef.current.click()} title="Enviar Imagem (até 5MB)"></div>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={async (e) => { const file = e.target.files[0]; if (file) await sendMediaFile(file, 'image'); e.target.value = ''; }} />
                                <div className="icon-video text-2xl text-gray-500 cursor-pointer" onClick={() => videoInputRef.current?.click()} title="Enviar Vídeo (até 5MB)"></div>
                                <input type="file" ref={videoInputRef} className="hidden" accept="video/*" onChange={async (e) => { const file = e.target.files[0]; if (file) await sendMediaFile(file, 'video'); e.target.value = ''; }} />
                                <div className="icon-file text-2xl text-gray-500 cursor-pointer" onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.onchange = async (e) => { const file = e.target.files[0]; if (file) await sendMediaFile(file, 'file'); }; input.click(); }} title="Enviar Arquivo (até 5MB)"></div>
                                <div className="flex-1 bg-white rounded-lg px-4 py-2 flex items-center">
                                    {editingMessage ? (
                                        <input type="text" value={editInput} onChange={(e) => setEditInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && editMessage(editingMessage, editInput)} placeholder="Editar..." className="w-full bg-transparent outline-none text-gray-700 text-sm" autoFocus />
                                    ) : (
                                        <input type="text" value={messageInput} onChange={(e) => setMessageInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && messageInput.trim() && handleSendMessage(messageInput)} placeholder="Mensagem" className="w-full bg-transparent outline-none text-gray-700 placeholder-gray-400 text-sm"/>
                                    )}
                                </div>
                                {editingMessage ? (
                                    <div onClick={() => editMessage(editingMessage, editInput)} className="icon-check text-2xl text-green-500 cursor-pointer"></div>
                                ) : messageInput.trim() ? (
                                    <div onClick={() => handleSendMessage(messageInput)} className="icon-send text-2xl text-gray-500 cursor-pointer"></div>
                                ) : (
                                    <div onClick={() => setShowAudioRecorder(true)} className="icon-mic text-2xl text-gray-500 cursor-pointer"></div>
                                )}
                                {editingMessage && <div onClick={() => { setEditingMessage(null); setEditInput(""); }} className="icon-x text-2xl text-red-500 cursor-pointer"></div>}
                            </>
                        ) : (
                            <AudioRecorder onSendAudio={(base64, duration) => handleSendMessage(base64, 'audio', duration)} onCancel={() => setShowAudioRecorder(false)} />
                        )}
                    </div>

                    {Object.keys(uploadProgress).length > 0 && (
                        <div className="absolute bottom-20 left-4 right-4 bg-white rounded-lg shadow-lg p-2 border border-gray-200">
                            {Object.entries(uploadProgress).map(([name, progress]) => (
                                <div key={name} className="mb-1">
                                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                                        <span className="truncate max-w-[200px]">{name}</span>
                                        <span>{progress}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                                        <div className="bg-green-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex-1 bg-[#f0f2f5] flex-col items-center justify-center hidden md:flex border-b-8 border-[#25d366]">
                    <div className="w-64 h-64 mb-8 text-gray-300 flex items-center justify-center">
                        <div className="icon-lock text-9xl text-gray-200"></div>
                    </div>
                    <h1 className="text-3xl font-light text-gray-600 mb-4">Privacidade & Segurança</h1>
                    <p className="text-gray-500 text-sm text-center max-w-md">
                        Agora suas mensagens são privadas.<br/>Adicione contatos pelo ID para começar a conversar.
                    </p>
                </div>
            )}
        </div>
    );
}