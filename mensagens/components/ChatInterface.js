function ChatInterface({ user, onLogout, pendingJoinGroupId, onClearJoin }) {
    const [activeChat, setActiveChat] = React.useState(null);
    const [messageInput, setMessageInput] = React.useState("");
    const [chats, setChats] = React.useState([]);
    const [messages, setMessages] = React.useState([]);
    const [showAudioRecorder, setShowAudioRecorder] = React.useState(false);

    // ==================== NOVAS FUNCIONALIDADES ====================
    const [editingMessage, setEditingMessage] = React.useState(null);
    const [editInput, setEditInput] = React.useState("");
    const [contextMenu, setContextMenu] = React.useState({ visible: false, x: 0, y: 0, message: null });
    const [toastMessage, setToastMessage] = React.useState(null);
    const [copiedMessageId, setCopiedMessageId] = React.useState(null);
    const [uploadProgress, setUploadProgress] = React.useState({});
    
    // Rate limiter
    const rateLimiter = React.useRef({});
    const lastMessageTime = React.useRef({});
    const MAX_MSG_PER_MINUTE = 30;
    const BAN_DURATION = 60;
    
    // Sistema de expiração de mídia (1 semana)
    const MEDIA_EXPIRATION_DAYS = 7;
    
    // ==================== ÁUDIOS PERSONALIZADOS ====================
    const [callAudio] = React.useState(new Audio());
    const [ringtoneAudio] = React.useState(new Audio());
    
    // URLs dos áudios personalizados (configure aqui suas URLs)
    const CALLING_SOUND_URL = "https://seuservidor.com/sounds/calling.mp3"; // Som ao ligar
    const RINGTONE_SOUND_URL = "https://seuservidor.com/sounds/ringtone.mp3"; // Som ao receber chamada
    
    // Carregar áudios
    React.useEffect(() => {
        callAudio.src = CALLING_SOUND_URL;
        ringtoneAudio.src = RINGTONE_SOUND_URL;
        callAudio.loop = true;
        ringtoneAudio.loop = true;
    }, []);
    
    // ==================== SISTEMA DE CALL ID (PARA MULTI-DISPOSITIVO) ====================
    const [activeCallId, setActiveCallId] = React.useState(null);
    
    // Gerar ou recuperar Call ID da URL
    React.useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const callIdFromUrl = urlParams.get('callid');
        
        if (callIdFromUrl) {
            setActiveCallId(callIdFromUrl);
            // Verificar se já existe uma chamada ativa com este ID
            const callRef = db.ref(`calls/${callIdFromUrl}`);
            callRef.on('value', (snapshot) => {
                const callData = snapshot.val();
                if (callData && callData.active && callData.deviceId !== user.id) {
                    // Outro dispositivo com mesma conta está na chamada
                    showToastMessage("Você já está em uma chamada em outro dispositivo! Encerrando esta...", "warning");
                    if (callStatus === 'connected') {
                        endCall(true);
                    }
                }
            });
            return () => callRef.off();
        }
    }, []);
    
    // Criar Call ID ao iniciar chamada
    const createCallId = async () => {
        const newCallId = Date.now().toString() + Math.random().toString(36).substr(2, 6);
        const callRef = db.ref(`calls/${newCallId}`);
        await callRef.set({
            id: newCallId,
            startedAt: Date.now(),
            participants: { [user.id]: true },
            active: true,
            deviceId: user.id
        });
        // Atualizar URL
        const newUrl = `${window.location.pathname}?callid=${newCallId}`;
        window.history.pushState({}, '', newUrl);
        return newCallId;
    };
    
    // Encerrar Call ID
    const endCallId = async (callId) => {
        if (callId) {
            const callRef = db.ref(`calls/${callId}`);
            await callRef.update({
                active: false,
                endedAt: Date.now()
            });
            // Remover da URL
            window.history.pushState({}, '', window.location.pathname);
        }
    };
    
    // ==================== CSS ESTILO WHATSAPP PARA CHAMADAS ====================
    const callStyles = `
        .call-container {
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
        }
        .call-avatar {
            box-shadow: 0 0 0 4px rgba(255,255,255,0.1);
        }
        .call-button {
            transition: all 0.2s ease;
        }
        .call-button:hover {
            transform: scale(1.05);
        }
        .call-button:active {
            transform: scale(0.95);
        }
        .incoming-call {
            animation: pulse-ring 1.5s infinite;
        }
        @keyframes pulse-ring {
            0% { box-shadow: 0 0 0 0 rgba(0,168,132,0.4); }
            70% { box-shadow: 0 0 0 20px rgba(0,168,132,0); }
            100% { box-shadow: 0 0 0 0 rgba(0,168,132,0); }
        }
        .wave-animation {
            animation: wave 1s ease-in-out infinite;
        }
        @keyframes wave {
            0%, 100% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(1.2); opacity: 1; }
        }
    `;
    
    // ==================== FUNÇÃO DE UPLOAD DE ARQUIVO ====================
    const uploadFileToServer = async (file, chatId, senderId) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64 = e.target.result;
                const fileId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                const fileData = {
                    id: fileId,
                    data: base64,
                    type: file.type,
                    name: file.name,
                    size: file.size,
                    chatId: chatId,
                    senderId: senderId,
                    uploadedAt: Date.now(),
                    expiresAt: Date.now() + (MEDIA_EXPIRATION_DAYS * 24 * 60 * 60 * 1000),
                    viewers: {},
                    totalViewers: 0
                };
                
                const fileRef = db.ref(`temp_files/${fileId}`);
                await fileRef.set(fileData);
                
                setTimeout(async () => {
                    const views = await fileRef.child('viewers').once('value');
                    const viewers = views.val() || {};
                    const totalMembers = activeChat?.type === 'group' 
                        ? Object.keys(activeChat.members || {}).length 
                        : 2;
                    
                    if (Object.keys(viewers).length >= totalMembers) {
                        await fileRef.remove();
                    } else {
                        await fileRef.remove();
                    }
                }, MEDIA_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);
                
                resolve({ fileId, base64: base64.substring(0, 100) + "...", name: file.name, size: file.size, type: file.type });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };
    
    const markMediaAsViewed = async (fileId, userId) => {
        const fileRef = db.ref(`temp_files/${fileId}/viewers/${userId}`);
        await fileRef.set(Date.now());
    };
    
    // ==================== VERIFICAR INATIVIDADE (1 SEMANA) ====================
    const checkInactivity = async (userId) => {
        const userRef = db.ref(`users/${userId}`);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();
        const lastActive = userData?.lastActive || userData?.createdAt || Date.now();
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        
        if (lastActive < oneWeekAgo) {
            showToastMessage("Conta inativa por mais de 7 dias! Envie uma mensagem para reativar.", "error");
            return false;
        }
        return true;
    };
    
    // ==================== RATE LIMITING ====================
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
    
    // ==================== FORMATAR MARKDOWN ====================
    const formatMarkdown = (text) => {
        if (!text || typeof text !== 'string') return text;
        let formatted = text;
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        formatted = formatted.replace(/__(.*?)__/g, '<u>$1</u>');
        formatted = formatted.replace(/~~(.*?)~~/g, '<del>$1</del>');
        formatted = formatted.replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded text-sm">$1</code>');
        formatted = formatted.replace(/```(.*?)```/gs, '<pre class="bg-gray-800 text-white p-2 rounded-lg overflow-x-auto text-xs"><code>$1</code></pre>');
        return formatted;
    };
    
    // ==================== COPIAR TEXTO ====================
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
    
    // ==================== EDIÇÃO DE MENSAGEM ====================
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
        
        await msgRef.update({
            text: newText,
            edited: true,
            editedAt: Date.now()
        });
        
        setEditingMessage(null);
        setEditInput("");
        showToastMessage("Mensagem editada!", "success");
    };
    
    // ==================== APAGAR MENSAGEM ====================
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
            showToastMessage("Apenas administradores podem apagar mensagens de outros!", "error");
            return;
        }
        if (activeChat.type === 'group') {
            if (!confirm("Excluir esta mensagem para todos?")) return;
            db.ref(`groups/${activeChat.id}/messages/${msgKey}`).remove();
        } else {
            if (!confirm("Excluir mensagem?")) return;
            const chatId = [user.id, activeChat.id].sort().join('_');
            db.ref(`chats/${chatId}/messages/${msgKey}`).remove();
        }
        showToastMessage("Mensagem apagada!", "success");
    };
    
    // ==================== CONTEXT MENU ====================
    const handleContextMenu = (e, message) => {
        e.preventDefault();
        if (!canDeleteMessage(message)) return;
        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, message: message });
    };
    
    // ==================== TOAST ====================
    const showToastMessage = (message, type = "info") => {
        setToastMessage({ message, type });
        setTimeout(() => setToastMessage(null), 3000);
    };
    
    // ==================== ATUALIZAR LAST ACTIVE ====================
    React.useEffect(() => {
        const updateLastActive = () => {
            db.ref(`users/${user.id}/lastActive`).set(Date.now());
        };
        updateLastActive();
        const interval = setInterval(updateLastActive, 60 * 60 * 1000);
        return () => clearInterval(interval);
    }, [user.id]);
    
    // ==================== FECHAR CONTEXT MENU ====================
    React.useEffect(() => {
        const handleClick = () => setContextMenu({ visible: false, x: 0, y: 0, message: null });
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // Bot & Media States
    const [showBotCreator, setShowBotCreator] = React.useState(false);
    const fileInputRef = React.useRef(null);
    const videoInputRef = React.useRef(null);
    const fileInputRef2 = React.useRef(null);

    // Modal States
    const [showAddContact, setShowAddContact] = React.useState(false);
    const [showGroupInfo, setShowGroupInfo] = React.useState(false);
    const [showSettings, setShowSettings] = React.useState(false);

    // Permissions
    const [groupPermissions, setGroupPermissions] = React.useState(null);

    // Professional Panel Activation
    const [professionalPanel, setProfessionalPanel] = React.useState(false);
    const [showProfessionalPanel, setShowProfessionalPanel] = React.useState(false);

    React.useEffect(() => {
        const panelActive = localStorage.getItem('professional_panel') === 'activated';
        setProfessionalPanel(panelActive);
    }, []);

    // Navigation History
    React.useEffect(() => {
        const handlePopState = (event) => {
            if (showSettings || showGroupInfo || showAddContact || activeChat) {
                if (showSettings) setShowSettings(false);
                else if (showGroupInfo) setShowGroupInfo(false);
                else if (showAddContact) setShowAddContact(false);
                else if (activeChat) setActiveChat(null);
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [showSettings, showGroupInfo, showAddContact, activeChat]);

    const pushHistoryState = (view) => {
        window.history.pushState({ view }, '', window.location.pathname);
    };

    const openSettings = () => { pushHistoryState('settings'); setShowSettings(true); };
    const openGroupInfo = () => { pushHistoryState('groupInfo'); setShowGroupInfo(true); };
    const openAddContact = () => { pushHistoryState('addContact'); setShowAddContact(true); };
    const openChat = (chat) => { pushHistoryState('chat'); setActiveChat(chat); };

    // Call States
    const [incomingCall, setIncomingCall] = React.useState(null);
    const [callStatus, setCallStatus] = React.useState(null);
    const [isVideoCall, setIsVideoCall] = React.useState(false);
    const [activeGroupCall, setActiveGroupCall] = React.useState(false);
    const [peer, setPeer] = React.useState(null);
    const [activeCalls, setActiveCalls] = React.useState({});
    const [remoteStreams, setRemoteStreams] = React.useState({});
    const [isCallMinimized, setIsCallMinimized] = React.useState(false);

    // Call Controls
    const [isMicMuted, setIsMicMuted] = React.useState(false);
    const [isCamMuted, setIsCamMuted] = React.useState(false);
    const [showSoundBoard, setShowSoundBoard] = React.useState(false);
    
    // Professional Panel Controls
    const [participantVolumes, setParticipantVolumes] = React.useState({});
    const [mutedAll, setMutedAll] = React.useState(false);
    const [adminOnlyMode, setAdminOnlyMode] = React.useState(false);
    const [globalAudioMessage, setGlobalAudioMessage] = React.useState(null);
    const [showGlobalAudio, setShowGlobalAudio] = React.useState(false);
    const [htmlInput, setHtmlInput] = React.useState("");
    const [showHtmlInput, setShowHtmlInput] = React.useState(false);
    const [screenSharing, setScreenSharing] = React.useState(false);
    const screenStreamRef = React.useRef(null);

    // Recording
    const [isRecordingCall, setIsRecordingCall] = React.useState(false);
    const [callDuration, setCallDuration] = React.useState(0);
    const recorderRef = React.useRef(null);
    const audioContextRef = React.useRef(null);
    const mixedDestRef = React.useRef(null);
    const callTimerRef = React.useRef(null);
    const localStreamRef = React.useRef(null);

    // Status
    const [onlineUsers, setOnlineUsers] = React.useState({});
    const [backgroundMode, setBackgroundMode] = React.useState(false);

    const messagesEndRef = React.useRef(null);
    const localVideoRef = React.useRef(null);
    const remoteVideoRef = React.useRef(null);
    const screenVideoRef = React.useRef(null);
    const currentAudioRef = React.useRef(null);
    const backgroundAudioRef = React.useRef(null);
    const db = window.firebaseDB;

    // Override NotificationSystem para usar áudios personalizados
    React.useEffect(() => {
        if (window.NotificationSystem) {
            const originalPlayRingtone = window.NotificationSystem.playRingtone;
            window.NotificationSystem.playRingtone = () => {
                if (callStatus === 'calling') {
                    callAudio.play().catch(e => console.log("Áudio não pode ser reproduzido"));
                } else if (incomingCall) {
                    ringtoneAudio.play().catch(e => console.log("Áudio não pode ser reproduzido"));
                } else if (originalPlayRingtone) {
                    originalPlayRingtone();
                }
            };
            
            const originalStopRingtone = window.NotificationSystem.stopRingtone;
            window.NotificationSystem.stopRingtone = () => {
                callAudio.pause();
                callAudio.currentTime = 0;
                ringtoneAudio.pause();
                ringtoneAudio.currentTime = 0;
                if (originalStopRingtone) {
                    originalStopRingtone();
                }
            };
        }
    }, [callStatus, incomingCall]);

    const isCurrentUserAdmin = React.useMemo(() => {
        if (!activeChat || activeChat.type !== 'group') return false;
        return activeChat.members?.[user.id] === 'admin';
    }, [activeChat, user.id]);

    // ==================== FUNÇÃO PARA ENVIAR MÍDIA ====================
    const sendMediaFile = async (file, type) => {
        if (!activeChat) return;
        
        if (file.size > 5 * 1024 * 1024) {
            showToastMessage("Arquivo muito grande! Máximo 5MB", "error");
            return;
        }
        
        const isActive = await checkInactivity(user.id);
        if (!isActive) return;
        
        if (!checkRateLimit(user.id, activeChat.id)) return;
        
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
        
        try {
            const uploadResult = await uploadFileToServer(file, activeChat.id, user.id);
            
            setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
            
            const mediaMessage = {
                fileId: uploadResult.fileId,
                fileName: uploadResult.name,
                fileSize: uploadResult.size,
                fileType: uploadResult.type,
                type: type,
                timestamp: Date.now(),
                senderId: user.id,
                senderName: user.name
            };
            
            const msgData = {
                senderId: user.id,
                senderName: user.name,
                text: JSON.stringify(mediaMessage),
                type: type,
                timestamp: window.firebase.database.ServerValue.TIMESTAMP,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            
            const ref = activeChat.type === 'group' 
                ? db.ref(`groups/${activeChat.id}/messages`)
                : db.ref(`chats/${[user.id, activeChat.id].sort().join('_')}/messages`);
            
            await ref.push(msgData);
            showToastMessage(`${type === 'image' ? 'Imagem' : type === 'video' ? 'Vídeo' : 'Arquivo'} enviado!`, "success");
            
        } catch (error) {
            console.error("Erro ao enviar arquivo:", error);
            showToastMessage("Erro ao enviar arquivo!", "error");
        } finally {
            setTimeout(() => {
                setUploadProgress(prev => {
                    const newProgress = { ...prev };
                    delete newProgress[file.name];
                    return newProgress;
                });
            }, 2000);
        }
    };
    
    // ==================== FUNÇÃO PARA RENDERIZAR MÍDIA ====================
    const renderMediaContent = (msg) => {
        try {
            const mediaData = typeof msg.text === 'string' ? JSON.parse(msg.text) : msg.text;
            
            if (mediaData.fileType && mediaData.fileType.startsWith('image/')) {
                const [imageData, setImageData] = React.useState(null);
                
                React.useEffect(() => {
                    const fetchImage = async () => {
                        const fileRef = db.ref(`temp_files/${mediaData.fileId}`);
                        const snapshot = await fileRef.once('value');
                        const data = snapshot.val();
                        if (data && data.data) {
                            setImageData(data.data);
                            await markMediaAsViewed(mediaData.fileId, user.id);
                        }
                    };
                    fetchImage();
                }, [mediaData.fileId]);
                
                return (
                    <div className="mb-1">
                        {imageData ? (
                            <img 
                                src={imageData} 
                                className="rounded-lg max-w-full max-h-80 cursor-pointer object-contain" 
                                onClick={() => window.open(imageData, '_blank')}
                                alt={mediaData.fileName}
                            />
                        ) : (
                            <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg">
                                <div className="icon-image text-2xl text-gray-500"></div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium">{mediaData.fileName}</p>
                                    <p className="text-xs text-gray-500">Carregando...</p>
                                </div>
                            </div>
                        )}
                        <button 
                            onClick={() => window.open(imageData, '_blank')}
                            className="mt-1 text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-100"
                        >
                            <div className="icon-download text-xs"></div> Baixar
                        </button>
                    </div>
                );
            }
            
            if (mediaData.fileType && mediaData.fileType.startsWith('video/')) {
                const [videoUrl, setVideoUrl] = React.useState(null);
                
                React.useEffect(() => {
                    const fetchVideo = async () => {
                        const fileRef = db.ref(`temp_files/${mediaData.fileId}`);
                        const snapshot = await fileRef.once('value');
                        const data = snapshot.val();
                        if (data && data.data) {
                            setVideoUrl(data.data);
                            await markMediaAsViewed(mediaData.fileId, user.id);
                        }
                    };
                    fetchVideo();
                }, [mediaData.fileId]);
                
                return (
                    <div className="mb-1">
                        {videoUrl ? (
                            <video 
                                src={videoUrl} 
                                controls 
                                className="rounded-lg max-w-full max-h-80"
                                poster="https://via.placeholder.com/400x300?text=Video"
                            />
                        ) : (
                            <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg">
                                <div className="icon-video text-2xl text-gray-500"></div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium">{mediaData.fileName}</p>
                                    <p className="text-xs text-gray-500">Carregando vídeo...</p>
                                </div>
                            </div>
                        )}
                        <button 
                            onClick={() => window.open(videoUrl, '_blank')}
                            className="mt-1 text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-100"
                        >
                            <div className="icon-download text-xs"></div> Baixar
                        </button>
                    </div>
                );
            }
            
            const [fileUrl, setFileUrl] = React.useState(null);
            
            React.useEffect(() => {
                const fetchFile = async () => {
                    const fileRef = db.ref(`temp_files/${mediaData.fileId}`);
                    const snapshot = await fileRef.once('value');
                    const data = snapshot.val();
                    if (data && data.data) {
                        setFileUrl(data.data);
                        await markMediaAsViewed(mediaData.fileId, user.id);
                    }
                };
                fetchFile();
            }, [mediaData.fileId]);
            
            return (
                <div className="mb-1">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="icon-file text-3xl text-blue-500"></div>
                        <div className="flex-1">
                            <p className="text-sm font-medium truncate max-w-[200px]">{mediaData.fileName}</p>
                            <p className="text-xs text-gray-500">{(mediaData.fileSize / 1024).toFixed(1)} KB</p>
                        </div>
                        <button 
                            onClick={() => {
                                const link = document.createElement('a');
                                link.href = fileUrl;
                                link.download = mediaData.fileName;
                                link.click();
                            }}
                            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                        >
                            <div className="icon-download text-sm"></div>
                        </button>
                    </div>
                </div>
            );
        } catch (e) {
            return <p className="text-gray-800 mb-1 leading-relaxed break-words">{msg.text}</p>;
        }
    };

    const startScreenShare = async () => {
        if (!professionalPanel || !isCurrentUserAdmin) {
            alert("Apenas administradores com painel profissional podem compartilhar tela.");
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            screenStreamRef.current = stream;
            setScreenSharing(true);
            Object.values(activeCalls).forEach(call => {
                call.peerConnection?.addTrack(stream.getVideoTracks()[0], stream);
            });
            stream.getVideoTracks()[0].onended = () => stopScreenShare();
        } catch (error) {
            console.error("Erro ao compartilhar tela:", error);
        }
    };

    const stopScreenShare = () => {
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => track.stop());
            screenStreamRef.current = null;
        }
        setScreenSharing(false);
    };

    const sendGlobalAudio = (audioBase64, duration) => {
        if (!professionalPanel || !isCurrentUserAdmin) {
            alert("Apenas administradores com painel profissional podem enviar áudio global.");
            return;
        }
        setGlobalAudioMessage({ audio: audioBase64, duration });
        Object.keys(activeCalls).forEach(participantId => {
            db.ref(`users/${participantId}/global_audio`).set({
                audio: audioBase64, duration, timestamp: Date.now(), sender: user.id
            });
        });
        const audio = new Audio(audioBase64);
        audio.play();
    };

    React.useEffect(() => {
        const globalAudioRef = db.ref(`users/${user.id}/global_audio`);
        globalAudioRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data && data.sender !== user.id && professionalPanel) {
                const audio = new Audio(data.audio);
                audio.play();
            }
        });
        return () => globalAudioRef.off();
    }, [user.id, professionalPanel]);

    const setParticipantVolume = (participantId, volume) => {
        if (!professionalPanel || !isCurrentUserAdmin) return;
        setParticipantVolumes(prev => ({ ...prev, [participantId]: volume }));
        const remoteStream = remoteStreams[participantId];
        if (remoteStream) {
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(remoteStream);
            const gainNode = audioContext.createGain();
            gainNode.gain.value = volume / 100;
            source.connect(gainNode).connect(audioContext.destination);
        }
    };

    const muteAllParticipants = () => {
        if (!professionalPanel || !isCurrentUserAdmin) return;
        const newMutedState = !mutedAll;
        setMutedAll(newMutedState);
        Object.keys(activeCalls).forEach(participantId => {
            if (!mutedAll) {
                setParticipantVolume(participantId, 0);
                db.ref(`users/${participantId}/call_control`).set({ action: 'mute', adminId: user.id });
            }
        });
    };

    const setAdminOnlyVoice = () => {
        if (!professionalPanel || !isCurrentUserAdmin) return;
        const newMode = !adminOnlyMode;
        setAdminOnlyMode(newMode);
        Object.keys(activeCalls).forEach(participantId => {
            const isAdmin = activeChat?.members?.[participantId] === 'admin';
            if (!isAdmin) {
                setParticipantVolume(participantId, newMode ? 0 : 100);
                db.ref(`users/${participantId}/call_control`).set({ action: newMode ? 'admin_only' : 'normal', adminId: user.id });
            }
        });
    };

    const injectHTML = (htmlContent) => {
        if (!professionalPanel || !isCurrentUserAdmin) {
            alert("Apenas administradores com painel profissional podem injetar HTML.");
            return;
        }
        const iframe = document.createElement('iframe');
        iframe.srcdoc = htmlContent;
        iframe.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:80%;height:80%;z-index:9999;background:white;border:2px solid #00a884;border-radius:10px';
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = 'position:fixed;top:calc(50% - 40vh);right:calc(50% - 38vw);z-index:10000;padding:10px 15px;background:red;color:white;border:none;border-radius:5px;cursor:pointer';
        closeBtn.onclick = () => { iframe.remove(); closeBtn.remove(); };
        document.body.appendChild(iframe);
        document.body.appendChild(closeBtn);
        Object.keys(activeCalls).forEach(participantId => {
            db.ref(`users/${participantId}/html_inject`).set({ html: htmlContent, adminId: user.id, timestamp: Date.now() });
        });
    };

    React.useEffect(() => {
        const htmlRef = db.ref(`users/${user.id}/html_inject`);
        htmlRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data && data.adminId !== user.id && professionalPanel) {
                const iframe = document.createElement('iframe');
                iframe.srcdoc = data.html;
                iframe.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:80%;height:80%;z-index:9999;background:white;border:2px solid #00a884;border-radius:10px';
                const closeBtn = document.createElement('button');
                closeBtn.innerHTML = '✕';
                closeBtn.style.cssText = 'position:fixed;top:calc(50% - 40vh);right:calc(50% - 38vw);z-index:10000;padding:10px 15px;background:red;color:white;border:none;border-radius:5px;cursor:pointer';
                closeBtn.onclick = () => { iframe.remove(); closeBtn.remove(); };
                document.body.appendChild(iframe);
                document.body.appendChild(closeBtn);
            }
        });
        return () => htmlRef.off();
    }, [user.id, professionalPanel]);

    React.useEffect(() => {
        const controlRef = db.ref(`users/${user.id}/call_control`);
        controlRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data && data.adminId !== user.id && professionalPanel && data.action === 'mute') {
                toggleMic();
            }
        });
        return () => controlRef.off();
    }, [user.id, professionalPanel]);

    const handleAudioPlay = (audioElement) => {
        if (currentAudioRef.current && currentAudioRef.current !== audioElement) {
            currentAudioRef.current.pause();
            currentAudioRef.current.currentTime = 0;
        }
        currentAudioRef.current = audioElement;
    };

    const toggleBackgroundMode = () => {
        if (!backgroundAudioRef.current) {
            const audio = new Audio("data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq");
            audio.loop = true;
            audio.volume = 0.01;
            backgroundAudioRef.current = audio;
        }
        if (backgroundMode) {
            backgroundAudioRef.current.pause();
            setBackgroundMode(false);
        } else {
            backgroundAudioRef.current.play().then(() => setBackgroundMode(true)).catch(e => console.error(e));
        }
    };

    const toggleMic = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMicMuted(!audioTrack.enabled);
            }
        }
    };

    const toggleCam = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsCamMuted(!videoTrack.enabled);
            }
        }
    };

    React.useEffect(() => {
        const cleanId = user.id.replace(/[^a-zA-Z0-9]/g, ''); 
        const newPeer = new window.Peer(cleanId);
        newPeer.on('open', (id) => console.log('PeerJS ID:', id));
        newPeer.on('call', (call) => {
            setIncomingCall({ callerId: call.peer, callObj: call, isVideo: call.metadata?.isVideo });
            window.NotificationSystem.playRingtone();
            window.NotificationSystem.show("Chamada Recebida", `Chamada de ${call.peer}`);
        });
        newPeer.on('error', (err) => console.error('PeerJS Error:', err));
        setPeer(newPeer);
        const connectedRef = db.ref(".info/connected");
        const userStatusRef = db.ref(`users/${user.id}/status`);
        connectedRef.on("value", (snap) => {
            if (snap.val() === true) {
                userStatusRef.onDisconnect().set({ state: 'offline', lastChanged: window.firebase.database.ServerValue.TIMESTAMP });
                userStatusRef.set({ state: 'online', lastChanged: window.firebase.database.ServerValue.TIMESTAMP });
            }
        });
        return () => {
            newPeer.destroy();
            connectedRef.off();
            userStatusRef.set({ state: 'offline', lastChanged: window.firebase.database.ServerValue.TIMESTAMP });
        };
    }, [user.id]);

    const [ongoingGroupCall, setOngoingGroupCall] = React.useState(null);

    React.useEffect(() => {
        if (!activeChat || activeChat.type !== 'group') {
            setOngoingGroupCall(null);
            return;
        }
        const callStatusRef = db.ref(`groups/${activeChat.id}/callStatus`);
        const handleStatus = (snap) => {
            const status = snap.val();
            if (status) {
                if (status.state === 'active') {
                    if (!activeGroupCall) setOngoingGroupCall(status);
                    else setOngoingGroupCall(null);
                } else if (status.state === 'ended') {
                    setOngoingGroupCall(null);
                    if ((Date.now() - status.timestamp < 5000) && (callStatus === 'connected' || callStatus === 'calling')) {
                        endCall(true); 
                    }
                }
            } else {
                setOngoingGroupCall(null);
            }
        };
        callStatusRef.on('value', handleStatus);
        return () => callStatusRef.off();
    }, [activeChat, callStatus, activeGroupCall]);

    React.useEffect(() => {
        if (!chats.length) return;
        const listeners = [];
        chats.forEach(chat => {
            let messagesRef;
            if (chat.type === 'group') messagesRef = db.ref(`groups/${chat.id}/messages`);
            else {
                const chatId = [user.id, chat.id].sort().join('_');
                messagesRef = db.ref(`chats/${chatId}/messages`);
            }
            const listener = messagesRef.limitToLast(1).on('child_added', (snapshot) => {
                const msg = snapshot.val();
                if (!msg) return;
                const isRecent = (Date.now() - msg.timestamp) < 10000; 
                const isFromMe = msg.senderId === user.id;
                if (!isFromMe && isRecent) {
                    const isChatActive = activeChat && activeChat.id === chat.id;
                    if (!isChatActive || document.hidden) {
                        window.NotificationSystem.show(`Nova mensagem de ${msg.senderName}`, msg.type === 'audio' ? '🎵 Mensagem de áudio' : msg.text, chat.avatar);
                    }
                }
            });
            listeners.push({ ref: messagesRef, fn: listener });
        });
        return () => listeners.forEach(l => l.ref.off('child_added', l.fn));
    }, [chats, activeChat]);

    const initAudioContext = () => {
        if (!audioContextRef.current) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioContextRef.current = new AudioContext();
            mixedDestRef.current = audioContextRef.current.createMediaStreamDestination();
        }
    };

    const addToMix = (stream) => {
        if (!audioContextRef.current) initAudioContext();
        if (stream.getAudioTracks().length > 0) {
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(mixedDestRef.current);
        }
    };

    const startRecordingCall = () => {
        if (!mixedDestRef.current) return;
        try {
            const stream = mixedDestRef.current.stream;
            const recorder = new MediaRecorder(stream);
            const chunks = [];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => {
                    const base64Audio = reader.result;
                    const durationStr = formatDuration(callDuration);
                    if (confirm(`Gravação finalizada (${durationStr}). Deseja enviar no chat?`)) {
                        handleSendMessage(base64Audio, 'audio', durationStr);
                    }
                };
            };
            recorder.start();
            recorderRef.current = recorder;
            setIsRecordingCall(true);
            setCallDuration(0);
            callTimerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000);
        } catch (e) { console.error("Erro ao gravar:", e); }
    };

    const stopRecordingCall = () => {
        if (recorderRef.current && recorderRef.current.state === 'recording') recorderRef.current.stop();
        setIsRecordingCall(false);
        if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleJoinSuccess = (groupData) => {
        setActiveChat({ ...groupData, id: pendingJoinGroupId, type: 'group' });
        onClearJoin();
    };

    React.useEffect(() => {
        const handleStartGroupCall = (e) => {
            const { groupId, video } = e.detail;
            if (activeChat && activeChat.id === groupId) startGroupCall(video);
        };
        window.addEventListener('start-group-call', handleStartGroupCall);
        return () => window.removeEventListener('start-group-call', handleStartGroupCall);
    }, [activeChat]);

    React.useEffect(() => {
        const signalRef = db.ref(`users/${user.id}/call_signal`);
        signalRef.on('child_added', snapshot => {
            const signal = snapshot.val();
            if (signal && signal.type === 'connect_peer' && signal.targetPeer && callStatus === 'connected') {
                const targetSanitized = signal.targetPeer.replace(/[^a-zA-Z0-9]/g, '');
                if (!activeCalls[targetSanitized]) {
                    connectToNewPeer(signal.targetPeer, isVideoCall);
                    snapshot.ref.remove();
                }
            }
        });
        return () => signalRef.off();
    }, [callStatus, activeCalls, isVideoCall]);

    const connectToNewPeer = async (peerId, video) => {
        try {
            const stream = localStreamRef.current || localVideoRef.current?.srcObject || await navigator.mediaDevices.getUserMedia({ audio: true, video: video });
            if (!localStreamRef.current) localStreamRef.current = stream;
            const targetPeerId = peerId.replace(/[^a-zA-Z0-9]/g, '');
            const call = peer.call(targetPeerId, stream, { metadata: { isVideo: video, isGroup: true, inviterId: user.id } });
            if (call) {
                handleCallStream(call, video);
                setActiveCalls(prev => ({ ...prev, [targetPeerId]: call }));
            }
        } catch(e) { console.error("Erro ao conectar novo peer:", e); }
    };

    const handleAddParticipantToCall = async (newId) => {
        if (!newId) return;
        await connectToNewPeer(newId, isVideoCall);
        Object.keys(activeCalls).forEach(connectedPeerId => {
            db.ref(`users/${connectedPeerId}/call_signal`).push({ type: 'connect_peer', targetPeer: newId, timestamp: Date.now() });
        });
        setShowAddContact(false); 
    };

    const togglePiP = async () => {
        try {
            if (document.pictureInPictureElement) await document.exitPictureInPicture();
            else if (remoteVideoRef.current && remoteVideoRef.current.readyState >= 1) await remoteVideoRef.current.requestPictureInPicture();
        } catch (error) { console.error("Erro ao ativar PiP:", error); }
    };

    const answerCall = async () => {
        window.NotificationSystem.stopRingtone();
        if (!incomingCall || !incomingCall.callObj) return;
        const isVideo = incomingCall.isVideo;
        setIsVideoCall(isVideo);
        setIncomingCall(null);
        setCallStatus('connected');
        setIsMicMuted(false);
        setIsCamMuted(false);
        
        // Criar Call ID para a chamada
        const newCallId = await createCallId();
        setActiveCallId(newCallId);
        
        navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo }).then((stream) => {
            localStreamRef.current = stream;
            if (isVideo && localVideoRef.current) localVideoRef.current.srcObject = stream;
            addToMix(stream);
            const call = incomingCall.callObj;
            call.answer(stream);
            handleCallStream(call, isVideo);
            setActiveCalls(prev => ({ ...prev, [call.peer]: call }));
        }).catch(err => console.error("Erro ao acessar midia:", err));
    };

    const startCall = async (video = false) => {
        if (!activeChat) return;
        if (activeChat.type === 'group') { startGroupCall(video); return; }
        
        setCallStatus('calling');
        setIsVideoCall(video);
        setIsMicMuted(false);
        setIsCamMuted(false);
        
        // Criar Call ID para a chamada
        const newCallId = await createCallId();
        setActiveCallId(newCallId);
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: video });
            localStreamRef.current = stream;
            if (video && localVideoRef.current) localVideoRef.current.srcObject = stream;
            addToMix(stream);
            const targetPeerId = activeChat.id.replace(/[^a-zA-Z0-9]/g, '');
            const call = peer.call(targetPeerId, stream, { metadata: { isVideo: video } });
            if (!call) throw new Error("Falha ao iniciar conexão com Peer.");
            handleCallStream(call, video);
            setActiveCalls({ [targetPeerId]: call });
        } catch(err) { console.error("Erro ao ligar:", err); setCallStatus(null); }
    };

    const startGroupCall = async (video) => {
        if (groupPermissions) {
            if (video && !groupPermissions.sendVideo) return;
            if (!video && !groupPermissions.sendAudio) return;
        }
        
        const groupRef = db.ref(`groups/${activeChat.id}/members`);
        const snapshot = await groupRef.once('value');
        const members = snapshot.val();
        if (!members) return;
        const memberIds = Object.keys(members).filter(id => id !== user.id);
        if (memberIds.length === 0) return;
        
        setCallStatus('connected');
        setIsVideoCall(video);
        setIsMicMuted(false);
        setIsCamMuted(false);
        setActiveGroupCall(true);
        setOngoingGroupCall(null);
        
        // Criar Call ID para a chamada em grupo
        const newCallId = await createCallId();
        setActiveCallId(newCallId);
        
        db.ref(`groups/${activeChat.id}/callStatus`).set({ state: 'active', startedBy: user.id, timestamp: Date.now(), callId: newCallId });
        handleSendMessage(`📞 Iniciou uma chamada de ${video ? 'vídeo' : 'voz'} em grupo.`, 'system');
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: video });
            localStreamRef.current = stream;
            if (video && localVideoRef.current) localVideoRef.current.srcObject = stream;
            addToMix(stream);
            memberIds.forEach(id => {
                const targetPeerId = id.replace(/[^a-zA-Z0-9]/g, '');
                const call = peer.call(targetPeerId, stream, { metadata: { isVideo: video, isGroup: true, groupId: activeChat.id } });
                if (call) { handleCallStream(call, video); setActiveCalls(prev => ({ ...prev, [targetPeerId]: call })); }
            });
        } catch (err) { console.error("Erro grupo:", err); endCall(); }
    };

    const joinGroupCall = async () => {
        if (!ongoingGroupCall) return;
        const video = false;
        setIsVideoCall(video);
        setCallStatus('connected');
        setIsMicMuted(false);
        setIsCamMuted(false);
        setActiveGroupCall(true);
        setOngoingGroupCall(null);
        
        // Usar o Call ID existente ou criar novo
        if (ongoingGroupCall.callId) {
            setActiveCallId(ongoingGroupCall.callId);
            // Verificar se outro dispositivo já está na chamada
            const callRef = db.ref(`calls/${ongoingGroupCall.callId}`);
            callRef.once('value', (snapshot) => {
                const callData = snapshot.val();
                if (callData && callData.deviceId !== user.id && callData.active) {
                    showToastMessage("Você já está em uma chamada em outro dispositivo!", "warning");
                }
            });
        }
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: video });
            localStreamRef.current = stream;
            if (video && localVideoRef.current) localVideoRef.current.srcObject = stream;
            addToMix(stream);
            const groupRef = db.ref(`groups/${activeChat.id}/members`);
            const snapshot = await groupRef.once('value');
            const members = snapshot.val();
            if (members) {
                const memberIds = Object.keys(members).filter(id => id !== user.id);
                memberIds.forEach(id => {
                    const targetPeerId = id.replace(/[^a-zA-Z0-9]/g, '');
                    const call = peer.call(targetPeerId, stream, { metadata: { isVideo: video, isGroup: true, groupId: activeChat.id } });
                    if (call) { handleCallStream(call, video); setActiveCalls(prev => ({ ...prev, [targetPeerId]: call })); }
                });
            }
        } catch (e) { console.error("Erro ao entrar:", e); }
    };

    const endGroupCallForEveryone = () => {
        if (!activeChat || activeChat.type !== 'group') return;
        if (!confirm("Isso encerrará a chamada para TODOS os participantes. Tem certeza?")) return;
        db.ref(`groups/${activeChat.id}/callStatus`).set({ state: 'ended', endedBy: user.id, timestamp: Date.now() });
        endCall();
    };

    const handleCallStream = (call, isVideo) => {
        call.on('stream', (remoteStream) => {
            setRemoteStreams(prev => ({ ...prev, [call.peer]: remoteStream }));
            addToMix(remoteStream);
            if (!isVideo) { const audio = new Audio(); audio.srcObject = remoteStream; audio.play(); }
            else { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream; }
        });
        call.on('close', () => {
            setActiveCalls(prev => { const newCalls = { ...prev }; delete newCalls[call.peer]; if (Object.keys(newCalls).length === 0) endCall(true); return newCalls; });
            setRemoteStreams(prev => { const newSt = { ...prev }; delete newSt[call.peer]; return newSt; });
        });
        call.on('error', (err) => console.error(`Erro com ${call.peer}:`, err));
    };

    const endCall = (remoteEnded = false) => {
        window.NotificationSystem.stopRingtone();
        stopRecordingCall();
        stopScreenShare();
        setShowProfessionalPanel(false);
        
        // Encerrar Call ID
        if (activeCallId) {
            endCallId(activeCallId);
            setActiveCallId(null);
        }
        
        if (callStatus === 'connected' && activeChat) {
            const durationStr = formatDuration(callDuration);
            const type = isVideoCall ? 'video' : 'audio';
            if (!remoteEnded) handleSendMessage(`Chamada de ${type} encerrada • ${durationStr}`, 'system');
        }
        Object.values(activeCalls).forEach(call => call.close());
        if (localVideoRef.current?.srcObject) localVideoRef.current.srcObject.getTracks().forEach(t => t.stop());
        if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
        setActiveCalls({});
        setRemoteStreams({});
        setCallStatus(null);
        setIncomingCall(null);
        setIsVideoCall(false);
        setActiveGroupCall(false);
        setIsCallMinimized(false);
        setIsMicMuted(false);
        setIsCamMuted(false);
        if (document.pictureInPictureElement) document.exitPictureInPicture();
        if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    };

    React.useEffect(() => {
        if (activeChat && activeChat.type === 'group') db.ref(`groups/${activeChat.id}/permissions`).on('value', s => setGroupPermissions(s.val()));
        else setGroupPermissions(null);
    }, [activeChat]);

    React.useEffect(() => {
        const contactsRef = db.ref(`users/${user.id}/contacts`);
        const loadContacts = (snapshot) => {
            const data = snapshot.val();
            if (!data) return;
            const contactIds = Object.keys(data);
            Promise.all(contactIds.map(async id => {
                const ref = data[id].type === 'group' ? `groups/${id}` : `users/${id}`;
                const s = await db.ref(ref).once('value');
                const val = s.val();
                let status = 'offline';
                let privacy = {};
                if (data[id].type !== 'group' && val) {
                    const statusSnap = await db.ref(`users/${id}/status`).once('value');
                    const settingsSnap = await db.ref(`users/${id}/settings`).once('value');
                    if (statusSnap.val()) status = statusSnap.val().state;
                    if (settingsSnap.val()) privacy = settingsSnap.val();
                }
                return { ...val, type: data[id].type, status: status, privacy: privacy };
            })).then(loadedChats => {
                setChats(prev => { const map = new Map(prev.map(c => [c.id, c])); loadedChats.forEach(c => map.set(c.id, c)); return Array.from(map.values()); });
            });
        };
        contactsRef.on('value', loadContacts);
        return () => contactsRef.off();
    }, [user.id]);

    React.useEffect(() => {
        if (!activeChat) return;
        let messagesRef;
        if (activeChat.type === 'group') messagesRef = db.ref(`groups/${activeChat.id}/messages`);
        else {
            const chatId = [user.id, activeChat.id].sort().join('_');
            messagesRef = db.ref(`chats/${chatId}/messages`);
        }
        const markAsRead = (msgId, senderId) => {
            db.ref(`users/${user.id}/settings`).once('value').then(s => {
                const settings = s.val() || {};
                let allowReadReceipt = settings.readReceipts !== false;
                if (settings.readReceiptExceptions && settings.readReceiptExceptions[senderId]) allowReadReceipt = !allowReadReceipt;
                if (allowReadReceipt) {
                    if (activeChat.type === 'group') db.ref(`groups/${activeChat.id}/messages/${msgId}/readBy/${user.id}`).set(Date.now());
                    else {
                        const chatId = [user.id, activeChat.id].sort().join('_');
                        db.ref(`chats/${chatId}/messages/${msgId}/status`).set('read');
                    }
                }
            });
        };
        messagesRef.limitToLast(50).on('child_added', (snapshot) => {
            const msg = snapshot.val();
            setMessages(prev => [...prev, { ...msg, key: snapshot.key }]);
            if (msg.senderId !== user.id) markAsRead(snapshot.key, msg.senderId);
        });
        messagesRef.limitToLast(50).on('child_changed', (snapshot) => {
            const val = snapshot.val();
            setMessages(prev => prev.map(m => m.key === snapshot.key ? { ...val, key: snapshot.key } : m));
        });
        if (activeChat.type === 'group') {
            const scriptsRef = db.ref(`groups/${activeChat.id}/scripts`);
            scriptsRef.once('value').then(scriptsSnap => {
                const scripts = scriptsSnap.val();
                if (scripts) {
                    messagesRef.limitToLast(1).on('child_added', (snapshot) => {
                        const msg = snapshot.val();
                        if (Date.now() - msg.timestamp < 2000) {
                            const engine = new window.ScriptEngine(activeChat.id, {
                                deleteMessage: (msgId) => db.ref(`groups/${activeChat.id}/messages/${msgId}`).remove(),
                                sendMessage: (text) => handleSendMessage(text, 'text'),
                                kickMember: (uid) => db.ref(`groups/${activeChat.id}/members/${uid}`).remove(),
                                alert: (txt) => alert(`[BOT]: ${txt}`)
                            });
                            const senderId = msg.senderId;
                            const memberContext = { id: senderId, name: msg.senderName };
                            Object.values(scripts).forEach(script => { if (script.active) engine.execute(script.code, { message: { ...msg, id: snapshot.key }, member: memberContext }); });
                        }
                    });
                }
            });
        }
        return () => { messagesRef.off(); setMessages([]); };
    }, [activeChat]);

    React.useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    // HANDLE SEND MESSAGE
    const handleSendMessage = async (content, type = 'text', duration = null, msgType = 'text') => {
        if (!activeChat) return;
        
        const isActive = await checkInactivity(user.id);
        if (!isActive) return;
        
        if (type === 'text' && (!content || !content.trim() || /^[\s\u200B-\u200D\uFEFF]*$/.test(content))) {
            showToastMessage("Mensagem vazia ou invisível não é permitida!", "error");
            return;
        }
        
        const now = Date.now();
        if (lastMessageTime.current[activeChat.id] && (now - lastMessageTime.current[activeChat.id]) < 800) {
            showToastMessage("Aguarde um pouco antes de enviar outra mensagem!", "warning");
            return;
        }
        lastMessageTime.current[activeChat.id] = now;
        
        if (!checkRateLimit(user.id, activeChat.id)) return;

        if (activeChat.type === 'group' && groupPermissions && type !== 'system') {
            if (type === 'text' && !groupPermissions.sendText) return;
            if (type === 'audio' && !groupPermissions.sendAudio) return;
        }

        if (type === 'audio') {
            window.ChatAppAPI.sendAudio(activeChat.id, content, duration, activeChat.type);
        } else if (type === 'system') {
            const msgData = {
                senderId: 'system', senderName: 'Sistema', text: content, type: 'system',
                timestamp: window.firebase.database.ServerValue.TIMESTAMP,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            const ref = activeChat.type === 'group' ? db.ref(`groups/${activeChat.id}/messages`) : db.ref(`chats/${[user.id, activeChat.id].sort().join('_')}/messages`);
            ref.push(msgData);
        } else {
            window.ChatAppAPI.sendMessage(activeChat.id, content, activeChat.type, msgType);
        }
        setMessageInput("");
        setShowAudioRecorder(false);
    };

    const handleCreateGroup = () => {
        const groupName = prompt("Nome do Grupo:");
        if (groupName) {
            const groupId = Math.floor(1000 + Math.random() * 9000).toString();
            db.ref(`groups/${groupId}`).set({
                id: groupId, name: groupName, avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${groupName}`,
                members: { [user.id]: 'admin' },
                permissions: { sendText: true, sendAudio: true, sendVideo: true, sendMedia: true, changeInfo: false }
            });
            db.ref(`users/${user.id}/contacts/${groupId}`).set({ type: 'group', joinedAt: Date.now() });
        }
    };

    const handleAddContact = async (inputId) => {
        if (!inputId) return;
        const cleanInput = inputId.trim();
        if (cleanInput.toLowerCase() === 'bot') {
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
                setActiveChat({ ...groupData, type: 'group' });
                setShowAddContact(false);
                return;
            }
            const userSnap = await db.ref(`users/${inputId}`).once('value');
            if (userSnap.exists()) {
                const userData = userSnap.val();
                await db.ref(`users/${user.id}/contacts/${inputId}`).set({ type: 'private', addedAt: Date.now() });
                setActiveChat({ ...userData, type: 'private' });
                setShowAddContact(false);
                return;
            }
        } catch (error) { console.error("Erro ao buscar ID:", error); }
    };

    const ToastComponent = () => {
        if (!toastMessage) return null;
        return (
            <div className={`fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm animate-fade-in-up ${
                toastMessage.type === 'error' ? 'bg-red-500' : toastMessage.type === 'success' ? 'bg-green-500' : 'bg-gray-800'
            }`}>
                {toastMessage.message}
            </div>
        );
    };

    const chatStyles = `
        .message-bubble {
            max-width: 85%;
            word-wrap: break-word;
            word-break: break-word;
            white-space: normal;
            overflow-wrap: break-word;
        }
        .message-text {
            max-width: 100%;
            overflow-x: auto;
        }
        @media (max-width: 768px) {
            .message-bubble {
                max-width: 90%;
            }
        }
        pre, code {
            white-space: pre-wrap;
            word-break: break-all;
        }
        ${callStyles}
    `;

    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden relative">
            <style>{chatStyles}</style>
            <ToastComponent />
            
            {user && <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[60] w-full max-w-lg pointer-events-auto"><SystemStatus /></div>}

            {pendingJoinGroupId && (<JoinRequestModal groupId={pendingJoinGroupId} user={user} onClose={onClearJoin} onJoinSuccess={handleJoinSuccess} />)}

            {showBotCreator && (<BotCreator onClose={() => setShowBotCreator(false)} onCreated={() => { setShowBotCreator(false); openAddContact(); }} />)}

            {showSettings && <Settings user={user} onClose={() => setShowSettings(false)} chats={chats} />}

            {showAddContact && (
                <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center">
                    <div className="bg-white p-6 rounded-lg w-80 shadow-xl animate-fade-in flex flex-col max-h-[80vh]">
                        <h3 className="text-lg font-semibold mb-4 text-gray-800">{callStatus ? 'Adicionar à Chamada' : 'Adicionar / Entrar'}</h3>
                        {callStatus ? (
                            <div className="flex-1 overflow-y-auto mb-4">
                                <p className="text-sm text-gray-500 mb-2">Escolha dos seus contatos:</p>
                                {chats.filter(c => c.type !== 'group').map(c => (
                                    <div key={c.id} onClick={() => handleAddParticipantToCall(c.id)} className="flex items-center p-2 hover:bg-gray-100 cursor-pointer rounded">
                                        <img src={c.avatar} className="w-8 h-8 rounded-full mr-2" /><span>{c.name}</span><div className="ml-auto icon-plus-circle text-green-500"></div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        <p className="text-sm text-gray-500 mb-2">Digite ID do Usuário, Grupo ou "bot"</p>
                        <input type="text" id="newContactId" placeholder="Ex: 12345 ou bot" className="w-full border border-gray-300 rounded p-2 mb-4 outline-none focus:border-[#00a884]"
                            onKeyDown={(e) => { if (e.key === 'Enter') { const val = e.target.value; if (callStatus) handleAddParticipantToCall(val); else handleAddContact(val); } }} />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowAddContact(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                            <button onClick={() => { const val = document.getElementById('newContactId').value; if (callStatus) handleAddParticipantToCall(val); else handleAddContact(val); }} className="px-4 py-2 bg-[#00a884] text-white rounded hover:bg-[#008f6f]">{callStatus ? 'Convidar' : 'Ir'}</button>
                        </div>
                    </div>
                </div>
            )}

            {showGroupInfo && activeChat?.type === 'group' && (<GroupInfo activeChat={activeChat} user={user} onClose={() => setShowGroupInfo(false)} />)}

            {/* Call Modal - Estilo WhatsApp */}
            {(incomingCall || callStatus) && (
                <div className={`fixed z-50 transition-all duration-300 ease-in-out shadow-2xl overflow-hidden call-container
                    ${isCallMinimized 
                        ? 'bottom-4 right-4 w-64 h-80 rounded-2xl border-2 border-white/20' 
                        : 'inset-0 flex flex-col items-center justify-center'
                    }`}>
                    <style>{`
                        @keyframes wave {
                            0%, 100% { transform: scale(1); opacity: 0.6; }
                            50% { transform: scale(1.3); opacity: 1; }
                        }
                        .wave-animation {
                            animation: wave 1.5s ease-in-out infinite;
                        }
                        .avatar-pulse {
                            box-shadow: 0 0 0 0 rgba(0, 168, 132, 0.5);
                            animation: pulse 1.5s infinite;
                        }
                        @keyframes pulse {
                            0% { box-shadow: 0 0 0 0 rgba(0, 168, 132, 0.5); }
                            70% { box-shadow: 0 0 0 20px rgba(0, 168, 132, 0); }
                            100% { box-shadow: 0 0 0 0 rgba(0, 168, 132, 0); }
                        }
                    `}</style>
                    
                    {!isCallMinimized && (
                        <>
                            {/* Avatar e Nome */}
                            <div className="flex flex-col items-center mb-8">
                                <img 
                                    src={activeChat?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${incomingCall?.callerId || activeChat?.id}`}
                                    className="w-32 h-32 rounded-full mb-4 avatar-pulse"
                                    alt="Contact"
                                />
                                <h2 className="text-2xl font-semibold text-white mb-1">
                                    {incomingCall ? incomingCall.callerId?.split('_')[0] : activeChat?.name}
                                </h2>
                                <p className="text-gray-400 text-sm">
                                    {incomingCall ? 'Chamando...' : 'Em chamada'}
                                </p>
                                {callStatus === 'connected' && (
                                    <p className="text-green-400 text-sm mt-1">{formatDuration(callDuration)}</p>
                                )}
                            </div>
                            
                            {/* Botões de Controle */}
                            <div className="flex justify-center gap-8 mt-4">
                                {incomingCall ? (
                                    <>
                                        <button onClick={() => setIncomingCall(null)} className="call-button w-16 h-16 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 shadow-lg">
                                            <div className="icon-phone-off text-3xl text-white"></div>
                                        </button>
                                        <button onClick={answerCall} className="call-button w-16 h-16 bg-green-500 rounded-full flex items-center justify-center hover:bg-green-600 shadow-lg">
                                            <div className="icon-phone text-3xl text-white"></div>
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={toggleMic} className={`call-button w-14 h-14 rounded-full flex items-center justify-center shadow-lg ${isMicMuted ? 'bg-red-500' : 'bg-gray-700 hover:bg-gray-600'}`}>
                                            <div className={isMicMuted ? "icon-mic-off text-2xl text-white" : "icon-mic text-2xl text-white"}></div>
                                        </button>
                                        
                                        {isVideoCall && (
                                            <button onClick={toggleCam} className={`call-button w-14 h-14 rounded-full flex items-center justify-center shadow-lg ${isCamMuted ? 'bg-red-500' : 'bg-gray-700 hover:bg-gray-600'}`}>
                                                <div className={isCamMuted ? "icon-video-off text-2xl text-white" : "icon-video text-2xl text-white"}></div>
                                            </button>
                                        )}
                                        
                                        <button onClick={() => setShowSoundBoard(!showSoundBoard)} className="call-button w-14 h-14 bg-gray-700 rounded-full flex items-center justify-center hover:bg-gray-600 shadow-lg">
                                            <div className="icon-music text-2xl text-white"></div>
                                        </button>
                                        
                                        <button onClick={() => endCall(false)} className="call-button w-16 h-16 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 shadow-lg">
                                            <div className="icon-phone-off text-3xl text-white"></div>
                                        </button>
                                        
                                        {isVideoCall && (
                                            <button onClick={togglePiP} className="call-button w-14 h-14 bg-gray-700 rounded-full flex items-center justify-center hover:bg-gray-600 shadow-lg">
                                                <div className="icon-minimize-2 text-2xl text-white"></div>
                                            </button>
                                        )}
                                        
                                        <button onClick={() => setIsCallMinimized(true)} className="call-button w-14 h-14 bg-gray-700 rounded-full flex items-center justify-center hover:bg-gray-600 shadow-lg">
                                            <div className="icon-arrow-down text-2xl text-white"></div>
                                        </button>
                                    </>
                                )}
                            </div>
                            
                            {/* Vídeo Local (se for video call) */}
                            {isVideoCall && (
                                <div className="absolute bottom-4 right-4 w-32 h-48 bg-black rounded-xl overflow-hidden shadow-lg border-2 border-gray-600">
                                    <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                                </div>
                            )}
                            
                            {/* Vídeo Remoto */}
                            {isVideoCall && remoteVideoRef.current?.srcObject && (
                                <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover -z-10" />
                            )}
                        </>
                    )}
                    
                    {/* Modo Minimizado */}
                    {isCallMinimized && (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-black rounded-2xl">
                            <img 
                                src={activeChat?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeChat?.id}`}
                                className="w-12 h-12 rounded-full mb-2"
                                alt="Contact"
                            />
                            <p className="text-white text-xs font-medium truncate max-w-[90%]">{activeChat?.name}</p>
                            <p className="text-green-400 text-xs">{formatDuration(callDuration)}</p>
                            <div className="flex gap-3 mt-3">
                                <button onClick={() => setIsCallMinimized(false)} className="p-2 bg-gray-700 rounded-full">
                                    <div className="icon-maximize-2 text-white text-sm"></div>
                                </button>
                                <button onClick={() => endCall(false)} className="p-2 bg-red-600 rounded-full">
                                    <div className="icon-phone-off text-white text-sm"></div>
                                </button>
                            </div>
                            {isVideoCall && remoteVideoRef.current?.srcObject && (
                                <video ref={remoteVideoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover -z-10 rounded-2xl" />
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Sidebar */}
            <div className={`bg-white w-full md:w-[400px] border-r border-gray-200 flex flex-col ${activeChat ? 'hidden md:flex' : 'flex'}`}>
                <div className="bg-[#f0f2f5] p-3 px-4 flex justify-between items-center h-16 border-b border-gray-300">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={openSettings}><img src={user.avatar} className="w-10 h-10 rounded-full border border-gray-300" /><span className="font-semibold text-gray-700 text-sm">{user.name}</span></div>
                    <div className="flex gap-4 text-gray-600 items-center">
                        <div className={`icon-zap cursor-pointer p-1.5 rounded-full transition ${backgroundMode ? 'text-green-500 bg-green-50' : 'text-gray-400 hover:bg-gray-200'}`} onClick={toggleBackgroundMode}></div>
                        <div className="icon-users cursor-pointer hover:bg-gray-200 p-1.5 rounded-full transition" onClick={handleCreateGroup}></div>
                        <div className="icon-message-square-plus cursor-pointer hover:bg-gray-200 p-1.5 rounded-full transition" onClick={openAddContact}></div>
                        <div className="icon-settings cursor-pointer hover:bg-gray-200 p-1.5 rounded-full transition" onClick={openSettings}></div>
                        <div className="icon-log-out cursor-pointer text-red-500 hover:bg-red-50 p-1.5 rounded-full transition" onClick={onLogout}></div>
                    </div>
                </div>
                <div className="p-2 border-b border-gray-200"><div className="bg-[#f0f2f5] rounded-lg flex items-center px-3 py-1.5"><div className="icon-search text-gray-500 text-sm"></div><input type="text" placeholder="Pesquisar contatos..." className="bg-transparent border-none outline-none ml-3 w-full text-sm py-1" /></div></div>
                <div className="flex-1 overflow-y-auto">
                    {chats.map(chat => (<div key={chat.id} onClick={() => openChat(chat)} className={`flex items-center p-3 cursor-pointer hover:bg-[#f5f6f6] ${activeChat?.id === chat.id ? 'bg-[#f0f2f5]' : ''}`}><img src={chat.avatar} className="w-12 h-12 rounded-full mr-3" /><div className="flex-1 border-b border-gray-100 pb-3 h-full flex flex-col justify-center"><div className="flex justify-between items-baseline"><span className="text-gray-900 font-medium">{chat.name}</span>{chat.type === 'group' && chat.members?.[user.id] === 'admin' && (<span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full ml-2">Admin</span>)}</div><div className="text-sm text-gray-500 truncate w-48">{chat.type === 'group' ? 'Grupo' : 'Privado'}</div></div></div>))}
                    {chats.length === 0 && (<div className="p-8 text-center text-gray-400 text-sm mt-4 flex flex-col items-center"><div className="icon-book-user text-4xl mb-2 opacity-30"></div>Sua lista de contatos está vazia.<br/>Adicione um ID ou crie um grupo!</div>)}
                </div>
            </div>

            {/* Main Chat Area */}
            {activeChat ? (
                <div className={`flex-1 flex flex-col h-full bg-[#efeae2] ${activeChat ? 'flex' : 'hidden md:flex'}`}>
                    <div className="bg-[#f0f2f5] p-3 px-4 flex justify-between items-center h-16 border-b border-gray-300 cursor-pointer" onClick={() => activeChat.type === 'group' && openGroupInfo()}>
                        <div className="flex items-center gap-4"><button onClick={() => setActiveChat(null)} className="md:hidden text-gray-600"><div className="icon-arrow-left"></div></button><img src={activeChat.avatar} className="w-10 h-10 rounded-full" /><div className="flex flex-col"><div className="flex items-center gap-2"><span className="text-gray-800 font-medium">{activeChat.name}</span>{activeChat.type === 'group' && activeChat.members?.[user.id] === 'admin' && (<span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">Admin</span>)}</div>{activeChat.type === 'group' ? <span className="text-xs text-gray-500">Toque para info do grupo</span> : (activeChat.privacy?.showOnline !== false && activeChat.status === 'online') ? <span className="text-xs text-green-500 font-bold">Online</span> : <span className="text-xs text-gray-500">Offline</span>}</div></div>
                        <div className="flex items-center gap-2 text-gray-600" onClick={(e) => e.stopPropagation()}>
                            <div className={`p-2 rounded-full cursor-pointer transition-colors ${activeChat.type === 'group' ? 'text-[#00a884] bg-green-50 hover:bg-green-100' : 'hover:bg-gray-200'}`} onClick={() => startCall(true)}><div className="icon-video text-xl"></div></div>
                            <div className={`p-2 rounded-full cursor-pointer transition-colors ${activeChat.type === 'group' ? 'text-[#00a884] bg-green-50 hover:bg-green-100' : 'hover:bg-gray-200'}`} onClick={() => startCall(false)}><div className="icon-phone text-xl"></div></div>
                            <div className="w-px h-6 bg-gray-300 mx-1"></div>
                            <div className="icon-search cursor-pointer hover:bg-gray-200 p-2 rounded-full"></div>
                            <div className="icon-more-vertical cursor-pointer hover:bg-gray-200 p-2 rounded-full"></div>
                        </div>
                    </div>

                    {ongoingGroupCall && !activeGroupCall && (<div className="bg-green-100 p-3 flex justify-between items-center px-6 animate-slide-in-right cursor-pointer shadow-inner" onClick={joinGroupCall}><div className="flex items-center gap-3"><div className="p-2 bg-green-500 rounded-full text-white animate-pulse"><div className="icon-phone-incoming text-xl"></div></div><div><p className="font-bold text-green-800">Chamada em andamento</p><p className="text-xs text-green-600">Toque para participar</p></div></div><button className="bg-green-600 text-white px-4 py-1.5 rounded-full font-semibold text-sm hover:bg-green-700 shadow">Entrar</button></div>)}

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 bg-chat-pattern relative">
                        <div className="flex flex-col gap-2">
                            {messages.map((msg, idx) => {
                                const isMe = msg.senderId === user.id;
                                const isSystem = msg.type === 'system';
                                const messageId = msg.key || idx;
                                
                                const isMediaMessage = msg.text && (msg.text.includes('"fileId"') || msg.type === 'image' || msg.type === 'video' || msg.type === 'file');
                                
                                if (isSystem) {
                                    return (<div key={idx} className="flex flex-col items-center my-2 group relative w-full"><div className="bg-[#e1f3fb] text-gray-600 text-xs px-3 py-1 rounded-full shadow-sm flex items-center gap-2 max-w-[90%] break-words text-center"><div className="icon-info shrink-0"></div>{msg.text}</div></div>);
                                }

                                return (
                                    <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group mb-1`} onContextMenu={(e) => handleContextMenu(e, msg)}>
                                        <div className={`message-bubble rounded-lg p-2 px-3 shadow-sm relative text-sm ${isMe ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'}`}>
                                            {!isMe && activeChat.type === 'group' && (<div className="flex items-center gap-1 mb-1"><p className="text-xs text-orange-500 font-bold">{msg.senderName}</p>{activeChat.members?.[msg.senderId] === 'admin' && (<span className="text-xs bg-yellow-100 text-yellow-800 px-1 rounded">👑</span>)}</div>)}
                                            
                                            {isMediaMessage ? (
                                                renderMediaContent(msg)
                                            ) : msg.type === 'text' ? (
                                                <div className="relative">
                                                    <p className="text-gray-800 mb-2 leading-relaxed break-words message-text" dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.text) }}></p>
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
                                                <button onClick={() => deleteMessage(msg.key)} className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"><div className="icon-trash text-xs"></div></button>
                                            )}
                                            {canEditMessage(msg) && !msg.readBy && (
                                                <button onClick={() => { setEditingMessage(msg.key); setEditInput(msg.text); }} className="absolute -top-2 -right-8 p-1 bg-orange-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-orange-600"><div className="icon-edit text-xs"></div></button>
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
                            <button onClick={() => { copyToClipboard(contextMenu.message.text, contextMenu.message.key); setContextMenu({ visible: false, x: 0, y: 0, message: null }); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"><div className="icon-copy"></div> Copiar</button>
                            {canEditMessage(contextMenu.message) && (<button onClick={() => { setEditingMessage(contextMenu.message.key); setEditInput(contextMenu.message.text); setContextMenu({ visible: false, x: 0, y: 0, message: null }); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"><div className="icon-edit"></div> Editar</button>)}
                            <button onClick={() => { deleteMessage(contextMenu.message.key); setContextMenu({ visible: false, x: 0, y: 0, message: null }); }} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-100 flex items-center gap-2"><div className="icon-trash"></div> Apagar</button>
                        </div>
                    )}

                    {/* Input Area */}
                    <div className="bg-[#f0f2f5] p-3 px-4 flex items-center gap-2">
                        {!showAudioRecorder ? (
                            <>
                                <div className="icon-smile text-2xl text-gray-500 cursor-pointer"></div>
                                
                                <div className="icon-image text-2xl text-gray-500 cursor-pointer" onClick={() => fileInputRef.current.click()} title="Enviar Imagem (máx 5MB)"></div>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={async (e) => { const file = e.target.files[0]; if (file) await sendMediaFile(file, 'image'); e.target.value = ''; }} />
                                
                                <div className="icon-video text-2xl text-gray-500 cursor-pointer" onClick={() => videoInputRef.current ? videoInputRef.current.click() : fileInputRef2.current?.click()} title="Enviar Vídeo (máx 5MB)"></div>
                                <input type="file" ref={videoInputRef || fileInputRef2} className="hidden" accept="video/*" onChange={async (e) => { const file = e.target.files[0]; if (file) await sendMediaFile(file, 'video'); e.target.value = ''; }} />
                                
                                <div className="icon-file text-2xl text-gray-500 cursor-pointer" onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.onchange = async (e) => { const file = e.target.files[0]; if (file) await sendMediaFile(file, 'file'); }; input.click(); }} title="Enviar Arquivo (máx 5MB)"></div>
                                
                                <div className="flex-1 bg-white rounded-lg px-4 py-2 flex items-center">
                                    {editingMessage ? (
                                        <input type="text" value={editInput} onChange={(e) => setEditInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && editMessage(editingMessage, editInput)} placeholder="Editar mensagem..." className="w-full bg-transparent border-none outline-none text-gray-700 text-sm" autoFocus />
                                    ) : (
                                        <input type="text" value={messageInput} onChange={(e) => setMessageInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && messageInput.trim() && handleSendMessage(messageInput)} placeholder="Mensagem" className="w-full bg-transparent border-none outline-none text-gray-700 placeholder-gray-400 text-sm"/>
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
                <div className="hidden md:flex flex-1 bg-[#f0f2f5] flex-col items-center justify-center border-b-8 border-[#25d366]">
                    <div className="w-64 h-64 mb-8 text-gray-300 flex items-center justify-center"><div className="icon-lock text-9xl text-gray-200"></div></div>
                    <h1 className="text-3xl font-light text-gray-600 mb-4">Privacidade & Segurança</h1>
                    <p className="text-gray-500 text-sm text-center max-w-md">Agora suas mensagens são privadas.<br/>Adicione contatos pelo ID para começar a conversar.</p>
                </div>
            )}
        </div>
    );
}
