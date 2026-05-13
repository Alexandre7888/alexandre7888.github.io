function ChatInterface({ user, onLogout, pendingJoinGroupId, onClearJoin }) {
    const [activeChat, setActiveChat] = React.useState(null);
    const [messageInput, setMessageInput] = React.useState("");
    const [chats, setChats] = React.useState([]);
    const [messages, setMessages] = React.useState([]);
    const [showAudioRecorder, setShowAudioRecorder] = React.useState(false);

    // ==================== ESTADOS SIMPLES ====================
    const [editingMessage, setEditingMessage] = React.useState(null);
    const [editInput, setEditInput] = React.useState("");
    const [toastMessage, setToastMessage] = React.useState(null);
    
    // Rate limiter
    const rateLimiter = React.useRef({});
    const lastMessageTime = React.useRef({});
    const MAX_MSG_PER_MINUTE = 30;
    const BAN_DURATION = 60;
    
    // ==================== CHAMADAS ====================
    const [incomingCall, setIncomingCall] = React.useState(null);
    const [callStatus, setCallStatus] = React.useState(null);
    const [isVideoCall, setIsVideoCall] = React.useState(false);
    const [peer, setPeer] = React.useState(null);
    const [activeCalls, setActiveCalls] = React.useState({});
    const [isCallMinimized, setIsCallMinimized] = React.useState(false);
    const [isMicMuted, setIsMicMuted] = React.useState(false);
    const [isCamMuted, setIsCamMuted] = React.useState(false);
    
    const localVideoRef = React.useRef(null);
    const remoteVideoRef = React.useRef(null);
    const localStreamRef = React.useRef(null);
    const audioContextRef = React.useRef(null);
    const mixedDestRef = React.useRef(null);
    const db = window.firebaseDB;
    
    // Detectar desktop
    const [isDesktop, setIsDesktop] = React.useState(false);
    React.useEffect(() => {
        const isDesktopDevice = !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        setIsDesktop(isDesktopDevice);
    }, []);
    
    // ==================== FUNÇÕES ====================
    const showToastMessage = (message, type = "info") => {
        setToastMessage({ message, type });
        setTimeout(() => setToastMessage(null), 3000);
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
        formatted = formatted.replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded text-sm">$1</code>');
        return formatted;
    };
    
    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            showToastMessage("Copiado!", "success");
        } catch (err) {
            showToastMessage("Erro ao copiar", "error");
        }
    };
    
    // ==================== CHAMADAS ====================
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
    
    const handleCallStream = (call, isVideo) => {
        call.on('stream', (remoteStream) => {
            addToMix(remoteStream);
            if (isVideo && remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
            }
        });
        call.on('close', () => {
            setActiveCalls(prev => {
                const newCalls = { ...prev };
                delete newCalls[call.peer];
                if (Object.keys(newCalls).length === 0) endCall(true);
                return newCalls;
            });
        });
    };
    
    const endCall = (remoteEnded = false) => {
        if (callStatus === 'connected' && activeChat && !remoteEnded) {
            handleSendMessage(`Chamada encerrada`, 'system');
        }
        Object.values(activeCalls).forEach(call => { if (call && call.close) call.close(); });
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
        }
        setActiveCalls({});
        setCallStatus(null);
        setIncomingCall(null);
        setIsVideoCall(false);
        setIsCallMinimized(false);
        setIsMicMuted(false);
        setIsCamMuted(false);
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
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
    
    const answerCall = () => {
        if (!incomingCall || !incomingCall.callObj) return;
        const isVideo = incomingCall.isVideo;
        setIsVideoCall(isVideo);
        setIncomingCall(null);
        setCallStatus('connected');
        
        navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo })
            .then((stream) => {
                localStreamRef.current = stream;
                if (isVideo && localVideoRef.current) localVideoRef.current.srcObject = stream;
                addToMix(stream);
                const call = incomingCall.callObj;
                call.answer(stream);
                handleCallStream(call, isVideo);
                setActiveCalls(prev => ({ ...prev, [call.peer]: call }));
            })
            .catch(err => { console.error(err); setCallStatus(null); });
    };
    
    const startCall = async (video = false) => {
        if (!activeChat) return;
        setCallStatus('calling');
        setIsVideoCall(video);
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: video });
            localStreamRef.current = stream;
            if (video && localVideoRef.current) localVideoRef.current.srcObject = stream;
            addToMix(stream);
            const targetPeerId = activeChat.id.replace(/[^a-zA-Z0-9]/g, '');
            const call = peer.call(targetPeerId, stream, { metadata: { isVideo: video } });
            if (!call) throw new Error("Falha na conexão");
            handleCallStream(call, video);
            setActiveCalls({ [targetPeerId]: call });
        } catch(err) { 
            console.error("Erro:", err); 
            setCallStatus(null);
            showToastMessage("Erro ao iniciar chamada", "error");
        }
    };
    
    // ==================== PEERJS SETUP ====================
    React.useEffect(() => {
        if (!user?.id) return;
        const cleanId = user.id.replace(/[^a-zA-Z0-9]/g, '');
        const newPeer = new window.Peer(cleanId, {
            config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
        });
        
        newPeer.on('open', (id) => console.log('Peer OK:', id));
        newPeer.on('call', (call) => {
            setIncomingCall({ callerId: call.peer, callObj: call, isVideo: call.metadata?.isVideo || false });
        });
        newPeer.on('error', (err) => console.error(err));
        setPeer(newPeer);
        
        return () => { if (newPeer) newPeer.destroy(); };
    }, [user?.id]);
    
    // ==================== ENVIAR MENSAGEM ====================
    const handleSendMessage = async (content, type = 'text') => {
        if (!activeChat) return;
        if (type === 'text' && (!content || !content.trim())) {
            showToastMessage("Mensagem vazia!", "error");
            return;
        }
        if (!checkRateLimit(user.id, activeChat.id)) return;
        
        const msgData = {
            senderId: user.id,
            senderName: user.name,
            text: content,
            type: type,
            timestamp: Date.now(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        
        const ref = activeChat.type === 'group' 
            ? db.ref(`groups/${activeChat.id}/messages`)
            : db.ref(`chats/${[user.id, activeChat.id].sort().join('_')}/messages`);
        await ref.push(msgData);
        setMessageInput("");
        setShowAudioRecorder(false);
    };
    
    const handleCreateGroup = () => {
        const groupName = prompt("Nome do Grupo:");
        if (groupName) {
            const groupId = Math.floor(1000 + Math.random() * 9000).toString();
            db.ref(`groups/${groupId}`).set({
                id: groupId, name: groupName, avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${groupName}`,
                members: { [user.id]: 'admin' }
            });
            db.ref(`users/${user.id}/contacts/${groupId}`).set({ type: 'group', joinedAt: Date.now() });
        }
    };
    
    const handleAddContact = async (inputId) => {
        if (!inputId) return;
        try {
            const userSnap = await db.ref(`users/${inputId}`).once('value');
            if (userSnap.exists()) {
                await db.ref(`users/${user.id}/contacts/${inputId}`).set({ type: 'private', addedAt: Date.now() });
                setActiveChat({ ...userSnap.val(), id: inputId, type: 'private' });
                setShowAddContact(false);
            } else {
                showToastMessage("Usuário não encontrado!", "error");
            }
        } catch (error) { console.error(error); }
    };
    
    // ==================== MODAL STATES ====================
    const [showAddContact, setShowAddContact] = React.useState(false);
    const [showGroupInfo, setShowGroupInfo] = React.useState(false);
    const [showSettings, setShowSettings] = React.useState(false);
    const [showBotCreator, setShowBotCreator] = React.useState(false);
    const [backgroundMode, setBackgroundMode] = React.useState(false);
    const fileInputRef = React.useRef(null);
    const messagesEndRef = React.useRef(null);
    const [groupPermissions, setGroupPermissions] = React.useState(null);
    const [professionalPanel, setProfessionalPanel] = React.useState(false);
    const [showProfessionalPanel, setShowProfessionalPanel] = React.useState(false);
    
    React.useEffect(() => {
        const panelActive = localStorage.getItem('professional_panel') === 'activated';
        setProfessionalPanel(panelActive);
    }, []);
    
    React.useEffect(() => {
        const contactsRef = db.ref(`users/${user.id}/contacts`);
        contactsRef.on('value', async (snapshot) => {
            const data = snapshot.val();
            if (!data) return;
            const contactIds = Object.keys(data);
            const loadedChats = await Promise.all(contactIds.map(async id => {
                const ref = data[id].type === 'group' ? `groups/${id}` : `users/${id}`;
                const s = await db.ref(ref).once('value');
                return { ...s.val(), id: id, type: data[id].type };
            }));
            setChats(loadedChats);
        });
        return () => contactsRef.off();
    }, [user.id]);
    
    React.useEffect(() => {
        if (!activeChat) return;
        let messagesRef;
        if (activeChat.type === 'group') messagesRef = db.ref(`groups/${activeChat.id}/messages`);
        else messagesRef = db.ref(`chats/${[user.id, activeChat.id].sort().join('_')}/messages`);
        
        messagesRef.limitToLast(50).on('child_added', (snapshot) => {
            const msg = snapshot.val();
            setMessages(prev => [...prev, { ...msg, key: snapshot.key }]);
        });
        return () => messagesRef.off();
    }, [activeChat]);
    
    React.useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
    
    const openSettings = () => setShowSettings(true);
    const openGroupInfo = () => setShowGroupInfo(true);
    const openAddContact = () => setShowAddContact(true);
    const openChat = (chat) => setActiveChat(chat);
    
    const ToastComponent = () => {
        if (!toastMessage) return null;
        return (<div className={`fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm ${toastMessage.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>{toastMessage.message}</div>);
    };
    
    const chatStyles = `
        .message-bubble { max-width: 85%; word-wrap: break-word; word-break: break-word; }
        @media (max-width: 768px) { .message-bubble { max-width: 90%; } }
        .call-button { transition: all 0.2s ease; }
        .call-button:hover { transform: scale(1.05); }
        .call-button:active { transform: scale(0.95); }
        .call-container { background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%); }
    `;
    
    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden relative">
            <style>{chatStyles}</style>
            <ToastComponent />
            
            {/* Modais */}
            {showSettings && (
                <div className="absolute inset-0 bg-white z-20 p-4">
                    <button onClick={() => setShowSettings(false)} className="text-gray-600">← Voltar</button>
                    <h2 className="text-xl font-bold mt-4">Configurações</h2>
                    <p>Usuário: {user.name}</p>
                    <p>ID: {user.id}</p>
                    <button onClick={onLogout} className="mt-4 bg-red-500 text-white px-4 py-2 rounded">Sair</button>
                </div>
            )}
            
            {showAddContact && (
                <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center">
                    <div className="bg-white p-6 rounded-lg w-80">
                        <h3 className="text-lg font-semibold mb-4">Adicionar Contato</h3>
                        <input type="text" id="contactId" placeholder="Digite o ID do usuário" className="w-full border rounded p-2 mb-4" />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowAddContact(false)} className="px-4 py-2 text-gray-600">Cancelar</button>
                            <button onClick={() => handleAddContact(document.getElementById('contactId').value)} className="px-4 py-2 bg-green-500 text-white rounded">Adicionar</button>
                        </div>
                    </div>
                </div>
            )}
            
            {showGroupInfo && activeChat?.type === 'group' && (
                <div className="absolute inset-0 bg-white z-20 p-4">
                    <button onClick={() => setShowGroupInfo(false)} className="text-gray-600">← Voltar</button>
                    <h2 className="text-xl font-bold mt-4">{activeChat.name}</h2>
                    <p>ID: {activeChat.id}</p>
                    <p>Membros: {Object.keys(activeChat.members || {}).length}</p>
                </div>
            )}
            
            {/* CALL MODAL */}
            {(incomingCall || callStatus) && (
                <div className={`call-container fixed z-50 transition-all duration-300 ${isCallMinimized ? 'bottom-4 right-4 w-64 h-80 rounded-2xl' : 'inset-0 flex flex-col items-center justify-center'}`}>
                    {!isCallMinimized && (
                        <>
                            <div className="flex flex-col items-center mb-8">
                                <img src={activeChat?.avatar || user?.avatar} className="w-28 h-28 rounded-full avatar-pulse object-cover" />
                                <h2 className="text-xl font-semibold text-white mt-3">{activeChat?.name}</h2>
                                <p className="text-gray-400 text-sm mt-1">{incomingCall ? 'Chamada recebida...' : (callStatus === 'connected' ? 'Em chamada' : 'Conectando...')}</p>
                            </div>
                            <div className="flex justify-center gap-8 mt-4">
                                {incomingCall ? (
                                    <>
                                        <button onClick={() => setIncomingCall(null)} className="call-button w-16 h-16 bg-red-600 rounded-full flex items-center justify-center"><div className="icon-phone-off text-2xl text-white"></div></button>
                                        <button onClick={answerCall} className="call-button w-16 h-16 bg-green-500 rounded-full flex items-center justify-center"><div className="icon-phone text-2xl text-white"></div></button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={toggleMic} className={`call-button w-12 h-12 rounded-full flex items-center justify-center ${isMicMuted ? 'bg-red-500' : 'bg-gray-700'}`}>
                                            <div className={isMicMuted ? "icon-mic-off text-xl text-white" : "icon-mic text-xl text-white"}></div>
                                        </button>
                                        {isVideoCall && (
                                            <button onClick={toggleCam} className={`call-button w-12 h-12 rounded-full flex items-center justify-center ${isCamMuted ? 'bg-red-500' : 'bg-gray-700'}`}>
                                                <div className={isCamMuted ? "icon-video-off text-xl text-white" : "icon-video text-xl text-white"}></div>
                                            </button>
                                        )}
                                        <button onClick={() => endCall(false)} className="call-button w-16 h-16 bg-red-600 rounded-full flex items-center justify-center"><div className="icon-phone-off text-2xl text-white"></div></button>
                                        <button onClick={() => setIsCallMinimized(true)} className="call-button w-10 h-10 bg-gray-700 rounded-full absolute top-4 right-4"><div className="icon-arrow-down text-white text-sm"></div></button>
                                    </>
                                )}
                            </div>
                            {isVideoCall && (<div className="absolute bottom-4 right-4 w-28 h-40 bg-black rounded-xl overflow-hidden"><video ref={localVideoRef} autoPlay muted className="w-full h-full object-cover" /></div>)}
                            {isVideoCall && remoteVideoRef.current?.srcObject && (<video ref={remoteVideoRef} autoPlay className="absolute inset-0 w-full h-full object-cover -z-10" />)}
                        </>
                    )}
                    {isCallMinimized && (
                        <div className="w-full h-full flex flex-col items-center justify-center">
                            <img src={activeChat?.avatar || user?.avatar} className="w-12 h-12 rounded-full mb-2 object-cover" />
                            <p className="text-white text-xs">{activeChat?.name}</p>
                            <button onClick={() => setIsCallMinimized(false)} className="mt-2 p-1 bg-gray-700 rounded-full"><div className="icon-maximize-2 text-white text-xs"></div></button>
                            <button onClick={() => endCall(false)} className="mt-2 p-1 bg-red-600 rounded-full"><div className="icon-phone-off text-white text-xs"></div></button>
                        </div>
                    )}
                </div>
            )}
            
            {/* Sidebar */}
            <div className={`bg-white w-full md:w-[400px] border-r flex flex-col ${activeChat ? 'hidden md:flex' : 'flex'}`}>
                <div className="bg-[#f0f2f5] p-3 px-4 flex justify-between items-center h-16 border-b">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={openSettings}>
                        <img src={user.avatar} className="w-10 h-10 rounded-full object-cover" />
                        <span className="font-semibold">{user.name}</span>
                    </div>
                    <div className="flex gap-4">
                        <div className="icon-users cursor-pointer" onClick={handleCreateGroup}></div>
                        <div className="icon-message-square-plus cursor-pointer" onClick={openAddContact}></div>
                        <div className="icon-settings cursor-pointer" onClick={openSettings}></div>
                        <div className="icon-log-out cursor-pointer text-red-500" onClick={onLogout}></div>
                    </div>
                </div>
                <div className="p-2 border-b"><div className="bg-[#f0f2f5] rounded-lg flex items-center px-3 py-1.5"><div className="icon-search text-gray-500"></div><input type="text" placeholder="Pesquisar..." className="bg-transparent outline-none ml-3 w-full text-sm" /></div></div>
                <div className="flex-1 overflow-y-auto">
                    {chats.map(chat => (<div key={chat.id} onClick={() => openChat(chat)} className={`flex items-center p-3 cursor-pointer hover:bg-gray-100 ${activeChat?.id === chat.id ? 'bg-gray-100' : ''}`}>
                        <img src={chat.avatar} className="w-12 h-12 rounded-full mr-3 object-cover" />
                        <div className="flex-1"><div className="font-medium">{chat.name}</div><div className="text-sm text-gray-500">{chat.type === 'group' ? 'Grupo' : 'Usuário'}</div></div>
                    </div>))}
                    {chats.length === 0 && (<div className="p-8 text-center text-gray-400">Nenhum contato. Adicione um!</div>)}
                </div>
            </div>
            
            {/* Chat Area */}
            {activeChat ? (
                <div className="flex-1 flex flex-col h-full bg-[#efeae2]">
                    <div className="bg-[#f0f2f5] p-3 px-4 flex justify-between items-center h-16 border-b">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setActiveChat(null)} className="md:hidden text-gray-600"><div className="icon-arrow-left"></div></button>
                            <img src={activeChat.avatar} className="w-10 h-10 rounded-full object-cover" />
                            <div><div className="font-medium">{activeChat.name}</div><div className="text-xs text-gray-500">{activeChat.type === 'group' ? 'Grupo' : 'Online'}</div></div>
                        </div>
                        <div className="flex gap-2">
                            <div className="icon-video text-xl cursor-pointer" onClick={() => startCall(true)}></div>
                            <div className="icon-phone text-xl cursor-pointer" onClick={() => startCall(false)}></div>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="flex flex-col gap-2">
                            {messages.map((msg, idx) => {
                                const isMe = msg.senderId === user.id;
                                return (
                                    <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`message-bubble rounded-lg p-2 px-3 max-w-[70%] ${isMe ? 'bg-green-100' : 'bg-white'}`}>
                                            {!isMe && activeChat.type === 'group' && <div className="text-xs text-orange-500 font-bold">{msg.senderName}</div>}
                                            <div dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.text) }}></div>
                                            <div className="text-right text-xs text-gray-400 mt-1">{msg.time}</div>
                                            <button onClick={() => copyToClipboard(msg.text)} className="text-xs text-blue-500 mt-1">📋 Copiar</button>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>
                    
                    <div className="bg-[#f0f2f5] p-3 px-4 flex items-center gap-2">
                        <div className="icon-image text-2xl cursor-pointer" onClick={() => fileInputRef.current.click()}></div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" />
                        <div className="flex-1 bg-white rounded-lg px-4 py-2">
                            <input type="text" value={messageInput} onChange={(e) => setMessageInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(messageInput)} placeholder="Mensagem" className="w-full bg-transparent outline-none" />
                        </div>
                        {messageInput.trim() ? (
                            <div onClick={() => handleSendMessage(messageInput)} className="icon-send text-2xl text-green-500 cursor-pointer"></div>
                        ) : (
                            <div onClick={() => setShowAudioRecorder(true)} className="icon-mic text-2xl cursor-pointer"></div>
                        )}
                    </div>
                    
                    {showAudioRecorder && (
                        <div className="bg-white p-4 absolute bottom-20 left-4 right-4 rounded-lg shadow-lg">
                            <p>Gravando áudio...</p>
                            <button onClick={() => setShowAudioRecorder(false)} className="bg-red-500 text-white px-4 py-2 rounded mt-2">Cancelar</button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="hidden md:flex flex-1 bg-[#f0f2f5] flex-col items-center justify-center">
                    <div className="icon-lock text-9xl text-gray-300"></div>
                    <h1 className="text-2xl font-light text-gray-600 mt-4">Meu Zap</h1>
                    <p className="text-gray-500 text-sm">Adicione contatos para começar</p>
                </div>
            )}
        </div>
    );
}