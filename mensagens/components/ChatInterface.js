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

    // Rate limiter
    const rateLimiter = React.useRef({});
    const lastMessageTime = React.useRef({});
    const MAX_MSG_PER_MINUTE = 30;
    const BAN_DURATION = 60;

    // ==================== SISTEMA DE ARQUIVOS EM BASE64 ====================
    const MAX_FILE_SIZE = 5 * 1024 * 1024;

    const fileToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

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

    // Função para verificar bloqueio - CORRIGIDA
    const checkIfBlocked = async (contactId) => {
        if (!db || !user) return { blockedByMe: false, blockedByThem: false };
        try {
            const [blockedByMeSnap, blockedByThemSnap] = await Promise.all([
                db.ref(`users/${user.id}/blocked/${contactId}`).once('value'),
                db.ref(`users/${contactId}/blocked/${user.id}`).once('value')
            ]);
            return { 
                blockedByMe: blockedByMeSnap.exists(), 
                blockedByThem: blockedByThemSnap.exists() 
            };
        } catch(e) {
            console.error("Erro ao verificar bloqueio:", e);
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

    React.useEffect(() => {
        setProfessionalPanel(localStorage.getItem('professional_panel') === 'activated');
    }, []);

    // Navigation
    React.useEffect(() => {
        const handlePopState = () => {
            if (showSettings) setShowSettings(false);
            else if (showGroupInfo) setShowGroupInfo(false);
            else if (showAddContact) setShowAddContact(false);
            else if (showUserInfo) setShowUserInfo(false);
            else if (activeChat) setActiveChat(null);
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [showSettings, showGroupInfo, showAddContact, showUserInfo, activeChat]);

    const pushHistoryState = (view) => window.history.pushState({ view }, '', window.location.pathname);
    const openSettings = () => { pushHistoryState('settings'); setShowSettings(true); };
    const openGroupInfo = () => { pushHistoryState('groupInfo'); setShowGroupInfo(true); };
    const openAddContact = () => { pushHistoryState('addContact'); setShowAddContact(true); };
    const openUserInfoModal = (targetUser) => { 
        pushHistoryState('userInfo'); 
        setSelectedUser(targetUser);
        setShowUserInfo(true); 
    };
    const openChat = (chat) => { pushHistoryState('chat'); setActiveChat(chat); };

    // Call States
    const [incomingCall, setIncomingCall] = React.useState(null);
    const [callStatus, setCallStatus] = React.useState(null);
    const [isVideoCall, setIsVideoCall] = React.useState(false);
    const [activeGroupCall, setActiveGroupCall] = React.useState(false);
    const [peer, setPeer] = React.useState(null);
    const [activeCalls, setActiveCalls] = React.useState({});
    const [remoteStreams, setRemoteStreams] = React.useState({});
    const [ongoingGroupCall, setOngoingGroupCall] = React.useState(null);
    const [isCallMinimized, setIsCallMinimized] = React.useState(false);
    const [isMicMuted, setIsMicMuted] = React.useState(false);
    const [isCamMuted, setIsCamMuted] = React.useState(false);
    const [callDuration, setCallDuration] = React.useState(0);
    const [activeSpeakers, setActiveSpeakers] = React.useState({});
    const callTimerRef = React.useRef(null);
    const localStreamRef = React.useRef(null);
    const localVideoRef = React.useRef(null);
    const remoteVideoRef = React.useRef(null);
    const audioContextRef = React.useRef(null);
    const analyserRef = React.useRef({});

    // Recording
    const [isRecordingCall, setIsRecordingCall] = React.useState(false);
    const recorderRef = React.useRef(null);
    const mixedDestRef = React.useRef(null);
    const callTimerRefAux = React.useRef(null);

    // Participants
    const [participantsInfo, setParticipantsInfo] = React.useState({});

    const messagesEndRef = React.useRef(null);
    const currentAudioRef = React.useRef(null);
    const backgroundAudioRef = React.useRef(null);
    const db = window.firebaseDB;

    const isCurrentUserAdmin = React.useMemo(() => {
        if (!activeChat || activeChat.type !== 'group') return false;
        return activeChat.members?.[user.id] === 'admin';
    }, [activeChat, user.id]);

    // Atualiza último ativo
    React.useEffect(() => {
        const updateLastActive = () => {
            if (db && user) db.ref(`users/${user.id}/lastActive`).set(Date.now());
        };
        updateLastActive();
        const interval = setInterval(updateLastActive, 60 * 60 * 1000);
        return () => clearInterval(interval);
    }, [user.id, db]);

    React.useEffect(() => {
        const handleClick = () => setContextMenu({ visible: false, x: 0, y: 0, message: null });
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // ==================== FUNÇÕES DE CHAMADA ====================
    
    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const startCallTimer = () => {
        setCallDuration(0);
        callTimerRef.current = setInterval(() => setCallDuration(prev => prev + 1), 1000);
    };

    const stopCallTimer = () => {
        if (callTimerRef.current) {
            clearInterval(callTimerRef.current);
            callTimerRef.current = null;
        }
    };

    const setupAudioAnalyser = (stream, participantId) => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        const source = audioContextRef.current.createMediaStreamSource(stream);
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const checkVolume = () => {
            if (!analyserRef.current[participantId]) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const avg = sum / dataArray.length;
            const isSpeaking = avg > 15;
            
            if (isSpeaking !== activeSpeakers[participantId]) {
                setActiveSpeakers(prev => ({ ...prev, [participantId]: isSpeaking }));
            }
            requestAnimationFrame(() => checkVolume());
        };
        
        analyserRef.current[participantId] = analyser;
        checkVolume();
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
        if (localStreamRef.current && isVideoCall) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsCamMuted(!videoTrack.enabled);
            }
        }
    };

    const switchToVideo = async () => {
        if (!isVideoCall && callStatus === 'connected') {
            try {
                const newStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                const oldVideoTrack = localStreamRef.current?.getVideoTracks()[0];
                if (oldVideoTrack) oldVideoTrack.stop();
                const newVideoTrack = newStream.getVideoTracks()[0];
                localStreamRef.current.addTrack(newVideoTrack);
                if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
                setIsVideoCall(true);
                Object.values(activeCalls).forEach(call => {
                    const sender = call.peerConnection?.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) sender.replaceTrack(newVideoTrack);
                });
                showToastMessage("Câmera ativada!", "success");
            } catch (err) {
                showToastMessage("Não foi possível ativar câmera", "error");
            }
        }
    };

    const endCall = (remoteEnded = false) => {
        window.NotificationSystem?.stopRingtone();
        stopRecordingCall();
        stopCallTimer();
        if (callStatus === 'connected' && activeChat && !remoteEnded) {
            const durationStr = formatDuration(callDuration);
            const type = isVideoCall ? 'vídeo' : 'voz';
            handleSendMessage(`Chamada de ${type} encerrada • ${durationStr}`, 'system');
        }
        Object.values(activeCalls).forEach(call => call.close());
        if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
        setActiveCalls({});
        setRemoteStreams({});
        setCallStatus(null);
        setIncomingCall(null);
        setIsVideoCall(false);
        setActiveGroupCall(false);
        setIsMicMuted(false);
        setIsCamMuted(false);
        setActiveSpeakers({});
        setParticipantsInfo({});
        if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
        analyserRef.current = {};
        localStreamRef.current = null;
    };

    const answerCall = async () => {
        window.NotificationSystem?.stopRingtone();
        if (!incomingCall || !incomingCall.callObj) return;
        const isVideo = incomingCall.isVideo;
        setIsVideoCall(isVideo);
        setIncomingCall(null);
        setCallStatus('connected');
        setIsMicMuted(false);
        setIsCamMuted(false);
        startCallTimer();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo });
        localStreamRef.current = stream;
        if (isVideo && localVideoRef.current) localVideoRef.current.srcObject = stream;
        const call = incomingCall.callObj;
        call.answer(stream);
        handleCallStream(call, isVideo, call.peer);
        setActiveCalls(prev => ({ ...prev, [call.peer]: call }));
        setParticipantsInfo(prev => ({ ...prev, [call.peer]: { id: call.peer, name: call.peer.split('_')[0] } }));
    };

    const startCall = async (video = false) => {
        if (!activeChat) return;
        if (activeChat.type === 'group') { startGroupCall(video); return; }
        
        // Verifica bloqueio antes de chamar
        const { blockedByMe, blockedByThem } = await checkIfBlocked(activeChat.id);
        if (blockedByMe) {
            showToastMessage("Você bloqueou este contato! Desbloqueie para ligar.", "error");
            return;
        }
        if (blockedByThem) {
            showToastMessage("Você foi bloqueado por este contato!", "error");
            return;
        }
        
        setCallStatus('calling');
        setIsVideoCall(video);
        setIsMicMuted(false);
        setIsCamMuted(false);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: video });
            localStreamRef.current = stream;
            if (video && localVideoRef.current) localVideoRef.current.srcObject = stream;
            const targetPeerId = activeChat.id.replace(/[^a-zA-Z0-9]/g, '');
            const call = peer.call(targetPeerId, stream, { metadata: { isVideo: video } });
            if (!call) throw new Error("Falha ao iniciar chamada");
            handleCallStream(call, video, targetPeerId);
            setActiveCalls({ [targetPeerId]: call });
            setParticipantsInfo(prev => ({ ...prev, [targetPeerId]: { id: targetPeerId, name: activeChat.name } }));
            setTimeout(() => {
                if (callStatus === 'calling') {
                    endCall();
                    showToastMessage("Chamada não atendida", "error");
                }
            }, 30000);
        } catch(err) { console.error("Erro ao ligar:", err); setCallStatus(null); }
    };

    const startGroupCall = async (video) => {
        if (groupPermissions && ((video && !groupPermissions.sendVideo) || (!video && !groupPermissions.sendAudio))) return;
        const members = (await db.ref(`groups/${activeChat.id}/members`).once('value')).val();
        if (!members) return;
        const memberIds = Object.keys(members).filter(id => id !== user.id);
        if (memberIds.length === 0) return;
        setCallStatus('connected');
        setIsVideoCall(video);
        setIsMicMuted(false);
        setIsCamMuted(false);
        setActiveGroupCall(true);
        setOngoingGroupCall(null);
        startCallTimer();
        db.ref(`groups/${activeChat.id}/callStatus`).set({ state: 'active', startedBy: user.id, timestamp: Date.now() });
        handleSendMessage(`📞 Iniciou chamada de ${video ? 'vídeo' : 'voz'} em grupo.`, 'system');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: video });
            localStreamRef.current = stream;
            if (video && localVideoRef.current) localVideoRef.current.srcObject = stream;
            for (const id of memberIds) {
                const userSnap = await db.ref(`users/${id}`).once('value');
                const userData = userSnap.val();
                setParticipantsInfo(prev => ({ ...prev, [id]: { id: id, name: userData?.name || id, avatar: userData?.avatar } }));
            }
            memberIds.forEach(id => {
                const targetPeerId = id.replace(/[^a-zA-Z0-9]/g, '');
                const call = peer.call(targetPeerId, stream, { metadata: { isVideo: video, isGroup: true, groupId: activeChat.id } });
                if (call) { handleCallStream(call, video, targetPeerId); setActiveCalls(prev => ({ ...prev, [targetPeerId]: call })); }
            });
        } catch (err) { console.error("Erro:", err); endCall(); }
    };

    const joinGroupCall = async () => {
        if (!ongoingGroupCall) return;
        setIsVideoCall(false);
        setCallStatus('connected');
        setIsMicMuted(false);
        setIsCamMuted(false);
        setActiveGroupCall(true);
        setOngoingGroupCall(null);
        startCallTimer();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = stream;
            const members = (await db.ref(`groups/${activeChat.id}/members`).once('value')).val();
            if (members) {
                const memberIds = Object.keys(members).filter(id => id !== user.id);
                for (const id of memberIds) {
                    const userSnap = await db.ref(`users/${id}`).once('value');
                    const userData = userSnap.val();
                    setParticipantsInfo(prev => ({ ...prev, [id]: { id: id, name: userData?.name || id, avatar: userData?.avatar } }));
                }
                memberIds.forEach(id => {
                    const targetPeerId = id.replace(/[^a-zA-Z0-9]/g, '');
                    const call = peer.call(targetPeerId, stream, { metadata: { isVideo: false, isGroup: true, groupId: activeChat.id } });
                    if (call) { handleCallStream(call, false, targetPeerId); setActiveCalls(prev => ({ ...prev, [targetPeerId]: call })); }
                });
            }
        } catch (e) { console.error("Erro ao entrar:", e); }
    };

    const handleCallStream = (call, isVideo, participantId) => {
        call.on('stream', (remoteStream) => {
            setRemoteStreams(prev => ({ ...prev, [call.peer]: remoteStream }));
            setupAudioAnalyser(remoteStream, call.peer);
            if (!isVideo) {
                const audio = new Audio();
                audio.srcObject = remoteStream;
                audio.play();
            } else {
                if (remoteVideoRef.current && call.peer === Object.keys(activeCalls)[0]) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }
            }
            if (callStatus === 'calling') {
                setCallStatus('connected');
                startCallTimer();
            }
        });
        call.on('close', () => {
            setActiveCalls(prev => { const newCalls = { ...prev }; delete newCalls[call.peer]; if (Object.keys(newCalls).length === 0) endCall(true); return newCalls; });
            setRemoteStreams(prev => { const newSt = { ...prev }; delete newSt[call.peer]; return newSt; });
            setActiveSpeakers(prev => { const newSp = { ...prev }; delete newSp[call.peer]; return newSp; });
        });
        call.on('error', (err) => console.error(`Erro:`, err));
    };

    const initAudioContext = () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            mixedDestRef.current = audioContextRef.current.createMediaStreamDestination();
            analyserRef.current = {};
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
                if (confirm(`Gravação finalizada (${durationStr}). Deseja enviar?`)) {
                    handleSendMessage(base64Audio, 'audio', durationStr);
                }
            };
        };
        recorder.start();
        recorderRef.current = recorder;
        setIsRecordingCall(true);
        setCallDuration(0);
        callTimerRefAux.current = setInterval(() => setCallDuration(p => p + 1), 1000);
    };

    const stopRecordingCall = () => {
        if (recorderRef.current && recorderRef.current.state === 'recording') recorderRef.current.stop();
        setIsRecordingCall(false);
        if (callTimerRefAux.current) clearInterval(callTimerRefAux.current);
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

    const handleAudioPlay = (audioElement) => {
        if (currentAudioRef.current && currentAudioRef.current !== audioElement) {
            currentAudioRef.current.pause();
            currentAudioRef.current.currentTime = 0;
        }
        currentAudioRef.current = audioElement;
    };

    // ==================== FUNÇÃO PARA ENVIAR ARQUIVO EM BASE64 ====================
    const sendMediaFile = async (file, type) => {
        if (!activeChat) return;
        
        // Verifica bloqueio
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
                timestamp: window.firebase.database.ServerValue.TIMESTAMP,
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

    // PeerJS Setup
    React.useEffect(() => {
        const cleanId = user.id.replace(/[^a-zA-Z0-9]/g, ''); 
        const newPeer = new window.Peer(cleanId);
        
        newPeer.on('open', (id) => console.log('PeerJS ID:', id));
        
        newPeer.on('call', (call) => {
            setIncomingCall({ callerId: call.peer, callObj: call, isVideo: call.metadata?.isVideo });
            window.NotificationSystem?.playRingtone();
            window.NotificationSystem?.show("Chamada Recebida", `Chamada de ${call.peer}`);
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

    React.useEffect(() => {
        if (!activeChat || activeChat.type !== 'group') { setOngoingGroupCall(null); return; }
        const callStatusRef = db.ref(`groups/${activeChat.id}/callStatus`);
        const handleStatus = (snap) => {
            const status = snap.val();
            if (status?.state === 'active') { if (!activeGroupCall) setOngoingGroupCall(status); else setOngoingGroupCall(null); }
            else if (status?.state === 'ended') { setOngoingGroupCall(null); if ((Date.now() - status.timestamp < 5000) && (callStatus === 'connected' || callStatus === 'calling')) endCall(true); }
            else setOngoingGroupCall(null);
        };
        callStatusRef.on('value', handleStatus);
        return () => callStatusRef.off();
    }, [activeChat, callStatus, activeGroupCall]);

    React.useEffect(() => {
        if (!chats.length) return;
        const listeners = [];
        chats.forEach(chat => {
            const messagesRef = chat.type === 'group' ? db.ref(`groups/${chat.id}/messages`) : db.ref(`chats/${[user.id, chat.id].sort().join('_')}/messages`);
            const listener = messagesRef.limitToLast(1).on('child_added', (snapshot) => {
                const msg = snapshot.val();
                if (!msg) return;
                const isRecent = (Date.now() - msg.timestamp) < 10000; 
                const isFromMe = msg.senderId === user.id;
                if (!isFromMe && isRecent) {
                    const isChatActive = activeChat && activeChat.id === chat.id;
                    if (!isChatActive || document.hidden) {
                        window.NotificationSystem?.show(
                            `Nova mensagem de ${msg.senderName}`,
                            msg.type === 'audio' ? '🎵 Mensagem de áudio' : (msg.type === 'image' ? '📷 Imagem' : (msg.type === 'video' ? '🎬 Vídeo' : (msg.text?.substring(0, 50) || 'Mensagem'))),
                            chat.avatar,
                            `msg-${chat.id}`,
                            chat.id
                        );
                    }
                }
            });
            listeners.push({ ref: messagesRef, fn: listener });
        });
        return () => listeners.forEach(l => l.ref.off('child_added', l.fn));
    }, [chats, activeChat]);

    const handleJoinSuccess = (groupData) => {
        setActiveChat({ ...groupData, id: pendingJoinGroupId, type: 'group' });
        onClearJoin();
    };

    const connectToNewPeer = async (peerId, video) => {
        try {
            const stream = localStreamRef.current || await navigator.mediaDevices.getUserMedia({ audio: true, video: video });
            if (!localStreamRef.current) localStreamRef.current = stream;
            const targetPeerId = peerId.replace(/[^a-zA-Z0-9]/g, '');
            const call = peer.call(targetPeerId, stream, { metadata: { isVideo: video, isGroup: true, inviterId: user.id } });
            if (call) { handleCallStream(call, video, targetPeerId); setActiveCalls(prev => ({ ...prev, [targetPeerId]: call })); }
        } catch(e) { console.error("Erro:", e); }
    };

    const handleAddParticipantToCall = async (newId) => {
        if (!newId) return;
        await connectToNewPeer(newId, isVideoCall);
        Object.keys(activeCalls).forEach(connectedPeerId => {
            db.ref(`users/${connectedPeerId}/call_signal`).push({ type: 'connect_peer', targetPeer: newId, timestamp: Date.now() });
        });
        setShowAddContact(false); 
    };

    const endGroupCallForEveryone = () => {
        if (!activeChat || activeChat.type !== 'group') return;
        if (!confirm("Encerrar chamada para TODOS?")) return;
        db.ref(`groups/${activeChat.id}/callStatus`).set({ state: 'ended', endedBy: user.id, timestamp: Date.now() });
        endCall();
    };

    React.useEffect(() => {
        if (activeChat && activeChat.type === 'group') db.ref(`groups/${activeChat.id}/permissions`).on('value', s => setGroupPermissions(s.val()));
        else setGroupPermissions(null);
    }, [activeChat]);

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

    // ==================== FUNÇÃO PARA CARREGAR MENSAGENS ====================
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
        
        // Verifica bloqueio
        if (activeChat.type !== 'group') {
            try {
                const { blockedByMe, blockedByThem } = await checkIfBlocked(activeChat.id);
                if (blockedByMe) {
                    showToastMessage("Desbloqueie o contato para enviar mensagens!", "error");
                    return;
                }
                if (blockedByThem) {
                    showToastMessage("Você foi bloqueado por este contato!", "error");
                    return;
                }
            } catch(e) {
                console.error("Erro ao verificar bloqueio:", e);
            }
        }
        
        // Verifica inatividade
        const isActive = await checkInactivity(user.id);
        if (!isActive) return;
        
        // Valida mensagem vazia
        if (type === 'text' && (!content || !content.trim() || /^[\s\u200B-\u200D\uFEFF]*$/.test(content))) { 
            showToastMessage("Mensagem vazia não é permitida!", "error"); 
            return; 
        }
        
        // Rate limit
        const now = Date.now();
        if (lastMessageTime.current[activeChat.id] && (now - lastMessageTime.current[activeChat.id]) < 800) { 
            showToastMessage("Aguarde antes de enviar outra mensagem!", "warning"); 
            return; 
        }
        lastMessageTime.current[activeChat.id] = now;
        
        if (!checkRateLimit(user.id, activeChat.id)) return;
        
        // Permissões do grupo
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
                window.ChatAppAPI?.sendAudio(activeChat.id, content, duration, activeChat.type);
            } else if (type === 'system') {
                const ref = activeChat.type === 'group' ? db.ref(`groups/${activeChat.id}/messages`) : db.ref(`chats/${[user.id, activeChat.id].sort().join('_')}/messages`);
                await ref.push({
                    senderId: 'system', senderName: 'Sistema', text: content, type: 'system',
                    timestamp: window.firebase.database.ServerValue.TIMESTAMP,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            } else {
                window.ChatAppAPI?.sendMessage(activeChat.id, content, activeChat.type, msgType);
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
                avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${groupName}`, 
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

    const ToastComponent = () => {
        if (!toastMessage) return null;
        return <div className={`fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm ${toastMessage.type === 'error' ? 'bg-red-500' : toastMessage.type === 'success' ? 'bg-green-500' : 'bg-gray-800'}`}>{toastMessage.message}</div>;
    };

    // CSS
    const chatStyles = `
        .message-bubble { max-width: 75%; word-wrap: break-word; word-break: break-word; }
        @media (max-width: 768px) { .message-bubble { max-width: 85%; } }
        .file-card { background: #f0f2f5; border-radius: 12px; padding: 10px 12px; display: flex; align-items: center; gap: 12px; min-width: 200px; }
        .download-btn { background: #00a884; color: white; border: none; border-radius: 20px; padding: 5px 12px; font-size: 11px; cursor: pointer; }
        .download-btn:hover { background: #008f6f; }
        .speaking-indicator { box-shadow: 0 0 0 2px #00a884; }
    `;

    const callParticipantsList = Object.keys(activeCalls).map(peerId => {
        const info = participantsInfo[peerId] || { id: peerId, name: peerId.split('_')[0] };
        const isSpeaking = activeSpeakers[peerId];
        return (
            <div key={peerId} className={`flex items-center gap-2 p-2 rounded-lg ${isSpeaking ? 'bg-green-100' : 'bg-gray-100'}`}>
                <div className="relative">
                    <img src={info.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${info.id}`} className={`w-8 h-8 rounded-full ${isSpeaking ? 'speaking-indicator' : ''}`} />
                    {isSpeaking && <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>}
                </div>
                <div className="flex-1">
                    <p className="text-sm font-medium">{info.name}</p>
                    {isSpeaking && <p className="text-xs text-green-600">Falando...</p>}
                </div>
                {isSpeaking && (
                    <div className="flex gap-0.5">
                        <div className="w-1 h-3 bg-green-500 animate-pulse"></div>
                        <div className="w-1 h-5 bg-green-500 animate-pulse" style={{animationDelay: '0.2s'}}></div>
                        <div className="w-1 h-4 bg-green-500 animate-pulse" style={{animationDelay: '0.4s'}}></div>
                    </div>
                )}
            </div>
        );
    });

    // Componentes de cabeçalho e rodapé
    const renderAutoComponents = (position, props) => {
        if (window.AppComponents && window.AppComponents[position]) {
            return window.AppComponents[position].map((Comp, i) => React.createElement(Comp, { key: i, ...props }));
        }
        return null;
    };

    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden">
            <style>{chatStyles}</style>
            <ToastComponent />

            {/* Modais */}
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
                                    await db.ref(`users/${botId}`).set({ id: botId, name: name, avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`, isBot: true, createdAt: Date.now() }); 
                                    alert(`Bot criado! ID: ${botId}`); 
                                    setShowBotCreator(false); 
                                    openAddContact(); 
                                } 
                            }} className="px-4 py-2 bg-[#00a884] text-white rounded">Criar</button>
                        </div>
                    </div>
                </div>
            )}

            {showSettings && <Settings user={user} onClose={() => setShowSettings(false)} chats={chats} />}

            {showUserInfo && window.UserInfo && React.createElement(window.UserInfo, {
                currentUser: user,
                targetUser: selectedUser,
                onClose: () => setShowUserInfo(false),
                onSendMessage: (userId) => {
                    const chat = chats.find(c => c.id === userId);
                    if (chat) setActiveChat(chat);
                },
                onBlockStatusChange: () => {
                    const contactsRef = db.ref(`users/${user.id}/contacts`);
                    contactsRef.once('value').then(snapshot => {
                        const data = snapshot.val();
                        if (data) {
                            Promise.all(Object.keys(data).map(async id => {
                                const val = (await db.ref(data[id].type === 'group' ? `groups/${id}` : `users/${id}`).once('value')).val();
                                return { ...val, type: data[id].type };
                            })).then(loadedChats => setChats(loadedChats));
                        }
                    });
                }
            })}

            {showAddContact && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
                    <div className="bg-white p-6 rounded-lg w-80">
                        <h3 className="text-lg font-semibold mb-4">{callStatus ? 'Adicionar à Chamada' : 'Adicionar Contato'}</h3>
                        {callStatus ? (
                            <div className="mb-4 max-h-60 overflow-y-auto">
                                {chats.filter(c => c.type !== 'group').map(c => (
                                    <div key={c.id} onClick={() => handleAddParticipantToCall(c.id)} className="flex items-center p-2 hover:bg-gray-100 cursor-pointer rounded">
                                        <img src={c.avatar} className="w-8 h-8 rounded-full mr-2" />
                                        <span>{c.name}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <input 
                                type="text" 
                                id="newContactId" 
                                placeholder="Digite o ID do usuário ou grupo" 
                                className="w-full border rounded p-2 mb-4" 
                                onKeyDown={(e) => { if (e.key === 'Enter') handleAddContact(e.target.value); }} 
                                autoFocus
                            />
                        )}
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowAddContact(false)} className="px-4 py-2 text-gray-600 rounded">Cancelar</button>
                            <button onClick={() => { const val = document.getElementById('newContactId')?.value; if (val) callStatus ? handleAddParticipantToCall(val) : handleAddContact(val); }} className="px-4 py-2 bg-[#00a884] text-white rounded">Ir</button>
                        </div>
                    </div>
                </div>
            )}

            {showGroupInfo && activeChat?.type === 'group' && (<GroupInfo activeChat={activeChat} user={user} onClose={() => setShowGroupInfo(false)} />)}

            {/* Call Modal */}
            {(incomingCall || callStatus) && (
                <div className="fixed inset-0 z-50 bg-gradient-to-b from-gray-900 to-black flex flex-col items-center justify-center">
                    {callStatus === 'connected' && Object.keys(activeCalls).length > 0 && (
                        <div className="absolute top-10 left-4 right-4 max-h-40 overflow-y-auto bg-black/50 rounded-lg p-2 backdrop-blur-sm">
                            <p className="text-white text-xs mb-2">Participantes ({Object.keys(activeCalls).length + 1})</p>
                            <div className="flex flex-col gap-1">
                                <div className={`flex items-center gap-2 p-2 rounded-lg ${activeSpeakers['me'] ? 'bg-green-100' : 'bg-gray-100'}`}>
                                    <div className="relative">
                                        <img src={user.avatar} className={`w-8 h-8 rounded-full ${activeSpeakers['me'] ? 'speaking-indicator' : ''}`} />
                                        {activeSpeakers['me'] && <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">{user.name} (Você)</p>
                                        {activeSpeakers['me'] && <p className="text-xs text-green-600">Falando...</p>}
                                    </div>
                                    {activeSpeakers['me'] && (
                                        <div className="flex gap-0.5">
                                            <div className="w-1 h-3 bg-green-500 animate-pulse"></div>
                                            <div className="w-1 h-5 bg-green-500 animate-pulse" style={{animationDelay: '0.2s'}}></div>
                                            <div className="w-1 h-4 bg-green-500 animate-pulse" style={{animationDelay: '0.4s'}}></div>
                                        </div>
                                    )}
                                </div>
                                {callParticipantsList}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col items-center mb-8">
                        {Object.keys(activeCalls).length === 0 && (
                            <img src={activeChat?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${incomingCall?.callerId || activeChat?.id}`} className="w-32 h-32 rounded-full mb-4 avatar-pulse" />
                        )}
                        <h2 className="text-2xl font-semibold text-white mb-1 text-center">
                            {incomingCall ? incomingCall.callerId?.split('_')[0] : 
                             (Object.keys(activeCalls).length > 1 ? `Chamada em grupo (${Object.keys(activeCalls).length + 1})` : activeChat?.name)}
                        </h2>
                        <p className="text-gray-400 text-sm">
                            {incomingCall ? 'Chamando...' : (callStatus === 'connected' ? formatDuration(callDuration) : 'Conectando...')}
                        </p>
                    </div>

                    <div className="flex justify-center gap-6 flex-wrap">
                        {incomingCall ? (
                            <>
                                <button onClick={() => setIncomingCall(null)} className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700"><div className="icon-phone-off text-3xl text-white"></div></button>
                                <button onClick={answerCall} className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center hover:bg-green-600"><div className="icon-phone text-3xl text-white"></div></button>
                            </>
                        ) : (
                            <>
                                <button onClick={toggleMic} className={`w-14 h-14 rounded-full flex items-center justify-center ${isMicMuted ? 'bg-red-500' : 'bg-gray-700 hover:bg-gray-600'}`}>
                                    <div className={isMicMuted ? "icon-mic-off text-2xl text-white" : "icon-mic text-2xl text-white"}></div>
                                </button>
                                {isVideoCall && (
                                    <button onClick={toggleCam} className={`w-14 h-14 rounded-full flex items-center justify-center ${isCamMuted ? 'bg-red-500' : 'bg-gray-700 hover:bg-gray-600'}`}>
                                        <div className={isCamMuted ? "icon-video-off text-2xl text-white" : "icon-video text-2xl text-white"}></div>
                                    </button>
                                )}
                                {!isVideoCall && callStatus === 'connected' && (
                                    <button onClick={switchToVideo} className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700">
                                        <div className="icon-video text-2xl text-white"></div>
                                    </button>
                                )}
                                <button onClick={() => endCall(false)} className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700">
                                    <div className="icon-phone-off text-3xl text-white"></div>
                                </button>
                                <button onClick={() => setIsCallMinimized(!isCallMinimized)} className="w-14 h-14 bg-gray-700 rounded-full flex items-center justify-center hover:bg-gray-600">
                                    <div className="icon-arrow-down text-2xl text-white"></div>
                                </button>
                            </>
                        )}
                    </div>

                    {isVideoCall && localStreamRef.current && (
                        <div className="absolute bottom-4 right-4 w-32 h-48 bg-black rounded-xl overflow-hidden border-2 border-gray-600">
                            <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                        </div>
                    )}
                    {isVideoCall && remoteVideoRef.current?.srcObject && (
                        <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover -z-10" />
                    )}
                </div>
            )}

            {/* Sidebar */}
            <div className={`bg-white w-[350px] flex-shrink-0 border-r border-gray-200 flex flex-col ${activeChat ? 'hidden md:flex' : 'flex'}`}>
                <div className="bg-[#f0f2f5] p-3 px-4 flex justify-between items-center h-16 border-b border-gray-300">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={openSettings}>
                        <img src={user.avatar} className="w-10 h-10 rounded-full border border-gray-300" />
                        <div className="flex flex-col">
                            <span className="font-semibold text-gray-700 text-sm">{user.name}</span>
                            {renderAutoComponents('headerLeft', { user })}
                        </div>
                    </div>
                    <div className="flex gap-4 text-gray-600 items-center">
                        {renderAutoComponents('headerRight', { user })}
                        <div className="icon-log-out cursor-pointer text-red-500 hover:bg-red-50 p-1.5 rounded-full transition" onClick={onLogout} title="Sair"></div>
                        <div className="icon-users cursor-pointer hover:bg-gray-200 p-1.5 rounded-full transition" onClick={handleCreateGroup} title="Criar grupo"></div>
                        <div className="icon-message-square-plus cursor-pointer hover:bg-gray-200 p-1.5 rounded-full transition" onClick={openAddContact} title="Adicionar"></div>
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
                    {chats.length > 0 ? chats.map(chat => {
                        const ContactStatusBadge = window.AppComponents?.ContactStatusBadge;
                        return (
                            <div key={chat.id} onClick={() => openChat(chat)} className={`flex items-center p-3 cursor-pointer hover:bg-[#f5f6f6] ${activeChat?.id === chat.id ? 'bg-[#f0f2f5]' : ''}`}>
                                <img src={chat.avatar} className="w-12 h-12 rounded-full mr-3" />
                                <div className="flex-1 border-b border-gray-100 pb-3 h-full flex flex-col justify-center">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-gray-900 font-medium">{chat.name}</span>
                                        {chat.type === 'group' && chat.members?.[user.id] === 'admin' && (
                                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full ml-2">Admin</span>
                                        )}
                                    </div>
                                    {ContactStatusBadge ? 
                                        React.createElement(ContactStatusBadge, { contact: chat, currentUser: user }) :
                                        <div className="text-sm text-gray-500 truncate w-48">{chat.type === 'group' ? 'Grupo' : 'Privado'}</div>
                                    }
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="p-8 text-center text-gray-400 text-sm mt-4 flex flex-col items-center">
                            <div className="icon-book-user text-4xl mb-2 opacity-30"></div>
                            Nenhum contato encontrado.<br/>Adicione um ID ou crie um grupo!
                        </div>
                    )}
                    {renderAutoComponents('sidebarBottom', { user, chats })}
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
                                onClick={() => activeChat.type !== 'group' && openUserInfoModal(activeChat)}
                            >
                                <img src={activeChat.avatar} className="w-10 h-10 rounded-full" />
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-800 font-medium">{activeChat.name}</span>
                                        {activeChat.type === 'group' && activeChat.members?.[user.id] === 'admin' && (
                                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">Admin</span>
                                        )}
                                    </div>
                                    {activeChat.type === 'group' ? 
                                        <span className="text-xs text-gray-500">Toque para informações</span> : 
                                        (activeChat.status === 'online' ? 
                                            <span className="text-xs text-green-500 font-bold">Online</span> : 
                                            <span className="text-xs text-gray-500">Offline</span>)
                                    }
                                </div>
                            </div>
                            {renderAutoComponents('chatHeader', { activeChat, user })}
                        </div>
                        <div className="flex items-center gap-2 text-gray-600" onClick={(e) => e.stopPropagation()}>
                            <div className={`p-2 rounded-full cursor-pointer transition-colors ${activeChat.type === 'group' ? 'text-[#00a884] bg-green-50 hover:bg-green-100' : 'hover:bg-gray-200'}`} onClick={() => startCall(true)}><div className="icon-video text-xl"></div></div>
                            <div className={`p-2 rounded-full cursor-pointer transition-colors ${activeChat.type === 'group' ? 'text-[#00a884] bg-green-50 hover:bg-green-100' : 'hover:bg-gray-200'}`} onClick={() => startCall(false)}><div className="icon-phone text-xl"></div></div>
                            <div className="w-px h-6 bg-gray-300 mx-1"></div>
                            <div className="icon-search cursor-pointer hover:bg-gray-200 p-2 rounded-full"></div>
                            <div className="icon-more-vertical cursor-pointer hover:bg-gray-200 p-2 rounded-full"></div>
                        </div>
                    </div>

                    {ongoingGroupCall && !activeGroupCall && (
                        <div className="bg-green-100 p-3 flex justify-between items-center px-6 animate-slide-in-right cursor-pointer shadow-inner" onClick={joinGroupCall}>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-500 rounded-full text-white animate-pulse"><div className="icon-phone-incoming text-xl"></div></div>
                                <div><p className="font-bold text-green-800">Chamada em andamento</p><p className="text-xs text-green-600">Toque para participar</p></div>
                            </div>
                            <button className="bg-green-600 text-white px-4 py-1.5 rounded-full font-semibold text-sm hover:bg-green-700 shadow">Entrar</button>
                        </div>
                    )}

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

                    {renderAutoComponents('chatFooter', { activeChat, user })}

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
                    <div className="w-64 h-64 mb-8 text-gray-300 flex items-center justify-center"><div className="icon-lock text-9xl text-gray-200"></div></div>
                    <h1 className="text-3xl font-light text-gray-600 mb-4">Privacidade & Segurança</h1>
                    <p className="text-gray-500 text-sm text-center max-w-md">Agora suas mensagens são privadas.<br/>Adicione contatos pelo ID para começar a conversar.</p>
                </div>
            )}
        </div>
    );
}
