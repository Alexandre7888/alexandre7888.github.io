// components/CallManager.js
function CallManager({ user, activeChat, onCallEnd, onSendMessage, initialProps }) {
    // ========== ESTADOS ==========
    const [callStatus, setCallStatus] = React.useState(initialProps?.isActive ? (initialProps?.isIncoming ? 'incoming' : 'calling') : null);
    const [isVideoCall, setIsVideoCall] = React.useState(initialProps?.isVideo || false);
    const [isMicMuted, setIsMicMuted] = React.useState(false);
    const [isCamMuted, setIsCamMuted] = React.useState(false);
    const [isSpeakerOn, setIsSpeakerOn] = React.useState(false);
    const [callDuration, setCallDuration] = React.useState(0);
    const [isCallMinimized, setIsCallMinimized] = React.useState(false);
    const [remoteStream, setRemoteStream] = React.useState(null);
    const [activeSpeakers, setActiveSpeakers] = React.useState({});
    const [isConnecting, setIsConnecting] = React.useState(false);
    const [localStreamReady, setLocalStreamReady] = React.useState(false);
    const [peerReady, setPeerReady] = React.useState(false);
    const [myPeerId, setMyPeerId] = React.useState(null);
    const [incomingCallInfo, setIncomingCallInfo] = React.useState(null);
    
    // ========== REFERÊNCIAS ==========
    const callTimerRef = React.useRef(null);
    const localStreamRef = React.useRef(null);
    const localVideoRef = React.useRef(null);
    const remoteVideoRef = React.useRef(null);
    const remoteAudioRef = React.useRef(null);
    const audioContextRef = React.useRef(null);
    const analyserRef = React.useRef(null);
    const callingAudioRef = React.useRef(null);
    const currentCallRef = React.useRef(null);
    const peerRef = React.useRef(null);
    const ringtoneIntervalRef = React.useRef(null);
    
    // ========== ÁUDIOS DOS EFEITOS ==========
    const audioOff = React.useRef(null);
    const audioOn = React.useRef(null);
    const audioTelOn = React.useRef(null);
    const audioTelOff = React.useRef(null);
    const audioVideoOn = React.useRef(null);
    const audioVideoOff = React.useRef(null);
    
    const CALLING_SOUND_URL = "https://code.codehub.ct.ws/call1.mp3";
    
    const AUDIO_URLS = {
        off: 'https://alexandre7888.github.io/CodeHUB/mensagens/assets/off.mp3',
        on: 'https://alexandre7888.github.io/CodeHUB/mensagens/assets/on.mp3',
        telon: 'https://alexandre7888.github.io/CodeHUB/mensagens/assets/telon.mp3',
        teloff: 'https://alexandre7888.github.io/CodeHUB/mensagens/assets/teloff.mp3'
    };
    
    const db = window.firebaseDB;
    
    // ========== FUNÇÕES DE ÁUDIO ==========
    function playAudio(audioElement) {
        if (audioElement && audioElement.current) {
            audioElement.current.currentTime = 0;
            audioElement.current.play().catch(e => console.log("Áudio não reproduzido:", e));
        }
    }
    
    function showToast(message, icon = 'info-circle') {
        let existingToast = document.querySelector('.call-toast');
        if (existingToast) existingToast.remove();
        const toast = document.createElement('div');
        toast.className = 'call-toast';
        toast.style.cssText = `
            position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.85); backdrop-filter: blur(12px); color: white;
            padding: 10px 20px; border-radius: 40px; font-size: 13px; z-index: 1001;
            display: flex; align-items: center; gap: 8px; pointer-events: none; white-space: nowrap;
        `;
        toast.innerHTML = `<i class="fas fa-${icon}"></i> ${message}`;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
    
    function playRingtone() {
        if (ringtoneIntervalRef.current) clearInterval(ringtoneIntervalRef.current);
        ringtoneIntervalRef.current = setInterval(() => {
            const beep = new Audio(CALLING_SOUND_URL);
            beep.volume = 0.5;
            beep.play().catch(e => console.log("Ringtone error:", e));
        }, 3000);
    }
    
    function stopRingtone() {
        if (ringtoneIntervalRef.current) {
            clearInterval(ringtoneIntervalRef.current);
            ringtoneIntervalRef.current = null;
        }
    }
    
    // ========== TIMER ==========
    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    
    const startCallTimer = () => {
        setCallDuration(0);
        if (callTimerRef.current) clearInterval(callTimerRef.current);
        callTimerRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);
    };
    
    const stopCallTimer = () => {
        if (callTimerRef.current) {
            clearInterval(callTimerRef.current);
            callTimerRef.current = null;
        }
    };
    
    // ========== ANALISADOR DE ÁUDIO ==========
    const setupAudioAnalyser = (stream) => {
        if (!stream || stream.getAudioTracks().length === 0) return;
        
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            const source = audioContextRef.current.createMediaStreamSource(stream);
            const analyser = audioContextRef.current.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyserRef.current = analyser;

            const checkVolume = () => {
                if (!analyserRef.current) return;
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
                const avg = sum / dataArray.length;
                const isSpeaking = avg > 15;
                
                setActiveSpeakers(prev => {
                    if (prev.remote !== isSpeaking) {
                        return { ...prev, remote: isSpeaking };
                    }
                    return prev;
                });
                
                requestAnimationFrame(checkVolume);
            };
            
            checkVolume();
        } catch (e) {
            console.error("Erro no Analisador de Áudio:", e);
        }
    };
    
    // ========== OBTER STREAM LOCAL ==========
    const getLocalStream = async (withVideo) => {
        try {
            console.log("Solicitando permissões para:", withVideo ? "Áudio e Vídeo" : "Apenas Áudio");
            
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            };
            
            if (withVideo) {
                constraints.video = {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: "user"
                };
            }
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log("Stream obtida com sucesso!");
            return stream;
        } catch (err) {
            console.error("Erro ao obter stream local:", err);
            showToast("Não foi possível acessar câmera/microfone. Verifique as permissões.", "exclamation-triangle");
            throw err;
        }
    };
    
    // ========== CONTROLES DA CHAMADA ==========
    const toggleMic = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMicMuted(!audioTrack.enabled);
                playAudio(audioTrack.enabled ? audioOn : audioOff);
                showToast(audioTrack.enabled ? "Microfone ativado" : "Microfone desativado", audioTrack.enabled ? "microphone" : "microphone-slash");
            }
        }
    };
    
    const toggleCam = () => {
        if (localStreamRef.current && isVideoCall) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsCamMuted(!videoTrack.enabled);
                playAudio(videoTrack.enabled ? audioOn : audioOff);
                showToast(videoTrack.enabled ? "Câmera ativada" : "Câmera desativada", videoTrack.enabled ? "video" : "video-slash");
            }
        }
    };
    
    const toggleSpeaker = () => {
        setIsSpeakerOn(!isSpeakerOn);
        showToast(isSpeakerOn ? "Áudio no auricular" : "Áudio no alto-falante", isSpeakerOn ? "phone" : "volume-up");
    };
    
    const switchToVideo = async () => {
        if (!isVideoCall && callStatus === 'connected') {
            showToast("Ativando câmera...", "circle-notch fa-spin");
            try {
                const newStream = await getLocalStream(true);
                const oldStream = localStreamRef.current;
                localStreamRef.current = newStream;
                
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = newStream;
                }
                
                setIsVideoCall(true);
                playAudio(audioVideoOn);
                
                if (currentCallRef.current && currentCallRef.current.peerConnection) {
                    const senders = currentCallRef.current.peerConnection.getSenders();
                    const videoSender = senders.find(s => s.track?.kind === 'video');
                    const newVideoTrack = newStream.getVideoTracks()[0];
                    
                    if (videoSender && newVideoTrack) {
                        videoSender.replaceTrack(newVideoTrack);
                    } else if (newVideoTrack) {
                        currentCallRef.current.peerConnection.addTrack(newVideoTrack, newStream);
                    }
                }
                
                if (oldStream) {
                    oldStream.getTracks().forEach(t => t.stop());
                }
                showToast("Câmera ativada!", "video");
            } catch (err) {
                console.error("Erro ao ativar câmera:", err);
                showToast("Não foi possível ativar a câmera.", "exclamation-triangle");
            }
        }
    };
    
    // ========== ENCERRAR CHAMADA ==========
    const endCall = () => {
        stopRingtone();
        playAudio(audioTelOff);
        stopCallTimer();
        
        if (callStatus === 'connected' && onSendMessage && activeChat) {
            const durationStr = formatDuration(callDuration);
            const type = isVideoCall ? 'vídeo' : 'voz';
            onSendMessage(`Chamada de ${type} encerrada • ${durationStr}`, 'system');
        }
        
        if (currentCallRef.current) {
            if (currentCallRef.current.close) currentCallRef.current.close();
            currentCallRef.current = null;
        }
        
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
        }
        
        if (remoteAudioRef.current) {
            remoteAudioRef.current.pause();
            remoteAudioRef.current.srcObject = null;
        }
        
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
        
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => {});
            audioContextRef.current = null;
        }
        
        analyserRef.current = null;
        setRemoteStream(null);
        setLocalStreamReady(false);
        setCallStatus(null);
        setActiveSpeakers({});
        setIncomingCallInfo(null);
        
        if (onCallEnd) onCallEnd();
    };
    
    // ========== PROCESSAR CHAMADA ==========
    const handleCall = (call, isVideo) => {
        currentCallRef.current = call;
        
        call.on('stream', (incomingStream) => {
            console.log("Stream recebida!");
            setRemoteStream(incomingStream);
            setupAudioAnalyser(incomingStream);
            
            if (!isVideo && incomingStream.getAudioTracks().length > 0) {
                if (!remoteAudioRef.current) {
                    remoteAudioRef.current = new Audio();
                }
                remoteAudioRef.current.srcObject = incomingStream;
                remoteAudioRef.current.play().catch(e => console.log(e));
            } else if (isVideo && remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = incomingStream;
                remoteVideoRef.current.play().catch(e => console.log(e));
            }
            
            if (callStatus === 'calling' || callStatus === 'incoming') {
                setCallStatus('connected');
                startCallTimer();
                stopRingtone();
                if (callingAudioRef.current) {
                    callingAudioRef.current.pause();
                    callingAudioRef.current.currentTime = 0;
                }
                showToast("Chamada conectada!", "phone");
            }
        });
        
        call.on('close', () => {
            console.log("Chamada encerrada");
            endCall();
        });
        
        call.on('error', (err) => {
            console.error("Erro na chamada:", err);
            endCall();
        });
    };
    
    // ========== INICIAR CHAMADA ==========
    const initiateCall = async () => {
        if (!peerRef.current || !peerReady || !initialProps?.targetPeerId) {
            console.error("Peer não está pronto");
            showToast("Aguardando conexão...", "circle-notch fa-spin");
            return;
        }
        
        setIsConnecting(true);
        setCallStatus('calling');
        playAudio(audioTelOn);
        showToast("Buscando contato...", "circle-notch fa-spin");
        
        try {
            const stream = await getLocalStream(initialProps.isVideo);
            localStreamRef.current = stream;
            setLocalStreamReady(true);
            
            setTimeout(() => {
                if (initialProps.isVideo && localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }
            }, 100);
            
            setTimeout(() => {
                setIsConnecting(false);
                console.log("Chamando:", initialProps.targetPeerId);
                
                const call = peerRef.current.call(initialProps.targetPeerId, stream, {
                    metadata: {
                        isVideo: initialProps.isVideo,
                        callerName: user?.name || "Usuário"
                    }
                });
                
                if (!call) throw new Error("Falha ao iniciar chamada");
                
                handleCall(call, initialProps.isVideo);
                
                const timeoutId = setTimeout(() => {
                    if (callStatus === 'calling') {
                        endCall();
                        showToast("Chamada não atendida", "phone-slash");
                    }
                }, 30000);
                
                call.on('stream', () => clearTimeout(timeoutId));
            }, 1500);
            
        } catch(err) {
            console.error("Erro ao ligar:", err);
            setIsConnecting(false);
            endCall();
        }
    };
    
    // ========== ATENDER CHAMADA ==========
    const answerCall = async () => {
        if (!currentCallRef.current) return;
        
        stopRingtone();
        
        const isVideo = incomingCallInfo?.isVideo || false;
        setIsVideoCall(isVideo);
        setCallStatus('connected');
        startCallTimer();
        
        try {
            const stream = await getLocalStream(isVideo);
            localStreamRef.current = stream;
            setLocalStreamReady(true);
            
            setTimeout(() => {
                if (isVideo && localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }
            }, 100);
            
            currentCallRef.current.answer(stream);
            handleCall(currentCallRef.current, isVideo);
            showToast("Chamada conectada!", "phone");
        } catch (err) {
            console.error("Erro ao atender:", err);
            endCall();
        }
    };
    
    // ========== INICIALIZAR PEERJS ==========
    React.useEffect(() => {
        if (!user?.id) return;
        
        const cleanId = user.id.replace(/[^a-zA-Z0-9]/g, '');
        console.log("🎯 Inicializando PeerJS no CallManager com ID:", cleanId);
        setMyPeerId(cleanId);
        
        const newPeer = new window.Peer(cleanId, {
            debug: 2,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });
        
        newPeer.on('open', (id) => {
            console.log("✅ PeerJS conectado:", id);
            peerRef.current = newPeer;
            setPeerReady(true);
        });
        
        // ⭐ RECEBER CHAMADAS - TUDO AQUI DENTRO
        newPeer.on('call', (incomingCall) => {
            console.log("📞 CHAMADA RECEBIDA de:", incomingCall.peer);
            
            const isVideo = incomingCall.metadata?.isVideo || false;
            const callerId = incomingCall.peer;
            const callerName = incomingCall.metadata?.callerName || callerId.split('_')[0];
            
            // Buscar informações do caller no Firebase
            const fetchCallerInfo = async () => {
                try {
                    const userSnap = await db.ref(`users/${callerId}`).once('value');
                    const callerData = userSnap.val();
                    const finalName = callerData?.name || callerName;
                    const finalAvatar = callerData?.avatar || null;
                    
                    setIncomingCallInfo({
                        name: finalName,
                        avatar: finalAvatar,
                        id: callerId,
                        isVideo: isVideo
                    });
                    
                    setCallStatus('incoming');
                    setIsVideoCall(isVideo);
                    currentCallRef.current = incomingCall;
                    
                    // Tocar ringtone
                    playRingtone();
                    showToast(`${finalName} está te chamando...`, "phone");
                } catch (err) {
                    console.error("Erro ao buscar caller:", err);
                    setIncomingCallInfo({
                        name: callerName,
                        avatar: null,
                        id: callerId,
                        isVideo: isVideo
                    });
                    setCallStatus('incoming');
                    setIsVideoCall(isVideo);
                    currentCallRef.current = incomingCall;
                    playRingtone();
                }
            };
            
            fetchCallerInfo();
        });
        
        newPeer.on('error', (err) => {
            console.error("❌ PeerJS Error:", err);
            if (err.type === 'peer-unavailable') {
                showToast("Usuário não está disponível", "exclamation-triangle");
            }
        });
        
        newPeer.on('disconnected', () => {
            console.log("⚠️ PeerJS desconectado, reconectando...");
            newPeer.reconnect();
        });
        
        return () => {
            if (newPeer) newPeer.destroy();
            stopRingtone();
        };
    }, [user?.id]);
    
    // ========== INICIALIZAR ÁUDIOS ==========
    React.useEffect(() => {
        audioOff.current = new Audio(AUDIO_URLS.off);
        audioOn.current = new Audio(AUDIO_URLS.on);
        audioTelOn.current = new Audio(AUDIO_URLS.telon);
        audioTelOff.current = new Audio(AUDIO_URLS.teloff);
        audioVideoOn.current = new Audio(AUDIO_URLS.on);
        audioVideoOff.current = new Audio(AUDIO_URLS.off);
        
        callingAudioRef.current = new Audio(CALLING_SOUND_URL);
        callingAudioRef.current.loop = true;
        
        return () => {
            if (callingAudioRef.current) {
                callingAudioRef.current.pause();
                callingAudioRef.current = null;
            }
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(t => t.stop());
            }
            stopRingtone();
        };
    }, []);
    
    // ========== INICIAR CHAMADA SE NÃO FOR INCOMING ==========
    React.useEffect(() => {
        if (initialProps?.isActive && !initialProps?.isIncoming && peerReady && initialProps?.targetPeerId) {
            initiateCall();
        }
    }, [peerReady, initialProps?.targetPeerId]);
    
    // Nome e avatar do contato
    const contactName = incomingCallInfo?.name || initialProps?.chatName || activeChat?.name || initialProps?.targetPeerId?.split('_')[0] || "Usuário";
    const contactAvatar = incomingCallInfo?.avatar || initialProps?.chatAvatar || activeChat?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${initialProps?.targetPeerId || activeChat?.id}`;
    const isIncoming = callStatus === 'incoming';
    const isSearching = isConnecting;
    
    // CSS da interface
    const callStyles = `
        @keyframes avatarPulse {
            0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.4); }
            50% { transform: scale(1.02); box-shadow: 0 0 0 10px rgba(37, 211, 102, 0); }
        }
        @keyframes selfViewPulse { 0%, 100% { border-color: rgba(37,211,102,0.6); } 50% { border-color: rgba(37,211,102,1); box-shadow: 0 0 15px rgba(37,211,102,0.3); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        .avatar-pulse { animation: avatarPulse 1.5s infinite; }
        .ctrl-btn { transition: transform 0.15s; cursor: pointer; background: none; border: none; }
        .ctrl-btn:active { transform: scale(0.92); }
        .call-timer-text { font-feature-settings: 'tnum'; font-variant-numeric: tabular-nums; }
        .video-self { animation: selfViewPulse 2s infinite; }
        .searching-effect { animation: pulse 1s infinite; }
    `;
    
    if (!callStatus && !isConnecting) return null;
    
    return (
        <>
            <style>{callStyles}</style>
            <div className={`fixed inset-0 z-50 transition-all duration-300 ease-in-out ${isCallMinimized ? 'bottom-4 right-4 w-80 h-96 rounded-2xl overflow-hidden shadow-2xl' : 'inset-0'} bg-black flex flex-col items-center justify-center`}>
                
                {/* Áudio para chamadas de voz */}
                {!isVideoCall && remoteStream && (
                    <audio ref={remoteAudioRef} autoPlay className="hidden" />
                )}

                {/* Fundo desfocado */}
                {!isCallMinimized && (
                    <div className="absolute inset-0">
                        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black opacity-95"></div>
                        <div className="absolute inset-0 backdrop-blur-sm"></div>
                    </div>
                )}
                
                {!isCallMinimized && (
                    <>
                        <button onClick={() => setIsCallMinimized(true)} className="absolute top-5 right-5 z-30 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all">
                            <i className="fas fa-window-minimize text-white text-xl"></i>
                        </button>
                        
                        {/* Avatar e informações */}
                        <div className="relative z-10 flex flex-col items-center mb-8">
                            <div className="relative">
                                <div className="w-32 h-32 rounded-full overflow-hidden shadow-2xl avatar-pulse bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                                    <img src={contactAvatar} className="w-full h-full object-cover" alt="avatar" />
                                </div>
                                {callStatus === 'connected' && activeSpeakers.remote && (
                                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
                                        <div className="flex gap-1">
                                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"></div>
                                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping animation-delay-200"></div>
                                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping animation-delay-500"></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <h2 className="text-2xl font-semibold text-white mt-4 text-center">{contactName}</h2>
                            <p className="text-gray-400 text-sm mt-1">
                                {isSearching ? (
                                    <span className="flex items-center gap-1 searching-effect">
                                        <i className="fas fa-circle-notch fa-spin"></i> Buscando...
                                    </span>
                                ) : isIncoming ? (
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Chamando...
                                    </span>
                                ) : callStatus === 'connected' ? (
                                    <span className="call-timer-text text-xl font-mono text-green-400">{formatDuration(callDuration)}</span>
                                ) : callStatus === 'calling' ? (
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span> Conectando...
                                    </span>
                                ) : null}
                            </p>
                        </div>
                        
                        {/* Indicador de áudio */}
                        <div className="absolute top-5 left-5 z-30 bg-black/50 backdrop-blur-md rounded-full px-3 py-1.5 text-xs text-white flex items-center gap-2">
                            <i className={`fas ${isSpeakerOn ? 'fa-volume-up' : 'fa-phone'}`}></i>
                            <span>{isSpeakerOn ? 'Alto-falante' : 'Auricular'}</span>
                        </div>
                        
                        {/* Botões */}
                        <div className="relative z-10 flex justify-center gap-6 mt-4 flex-wrap px-4">
                            {isIncoming ? (
                                <>
                                    <button onClick={endCall} className="ctrl-btn flex flex-col items-center gap-2">
                                        <div className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-lg">
                                            <i className="fas fa-phone-slash text-3xl text-white"></i>
                                        </div>
                                        <span className="text-xs text-gray-400">Recusar</span>
                                    </button>
                                    <button onClick={answerCall} className="ctrl-btn flex flex-col items-center gap-2">
                                        <div className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-lg animate-pulse">
                                            <i className="fas fa-phone-alt text-3xl text-white"></i>
                                        </div>
                                        <span className="text-xs text-gray-400">Atender</span>
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button onClick={toggleMic} className="ctrl-btn flex flex-col items-center gap-2">
                                        <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isMicMuted ? 'bg-red-500' : 'bg-gray-700 hover:bg-gray-600'}`}>
                                            {isMicMuted ? <i className="fas fa-microphone-slash text-white text-xl"></i> : <i className="fas fa-microphone text-white text-xl"></i>}
                                        </div>
                                        <span className="text-xs text-gray-400">{isMicMuted ? 'Mutado' : 'Microfone'}</span>
                                    </button>
                                    
                                    <button onClick={toggleSpeaker} className="ctrl-btn flex flex-col items-center gap-2">
                                        <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isSpeakerOn ? 'bg-green-500' : 'bg-gray-700 hover:bg-gray-600'}`}>
                                            {isSpeakerOn ? <i className="fas fa-volume-up text-white text-xl"></i> : <i className="fas fa-phone text-white text-xl"></i>}
                                        </div>
                                        <span className="text-xs text-gray-400">Alto-falante</span>
                                    </button>
                                    
                                    {!isVideoCall && callStatus === 'connected' && (
                                        <button onClick={switchToVideo} className="ctrl-btn flex flex-col items-center gap-2">
                                            <div className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center">
                                                <i className="fas fa-video text-white text-xl"></i>
                                            </div>
                                            <span className="text-xs text-gray-400">Vídeo</span>
                                        </button>
                                    )}
                                    
                                    {isVideoCall && (
                                        <button onClick={toggleCam} className="ctrl-btn flex flex-col items-center gap-2">
                                            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isCamMuted ? 'bg-red-500' : 'bg-gray-700 hover:bg-gray-600'}`}>
                                                {isCamMuted ? <i className="fas fa-video-slash text-white text-xl"></i> : <i className="fas fa-video text-white text-xl"></i>}
                                            </div>
                                            <span className="text-xs text-gray-400">Câmera</span>
                                        </button>
                                    )}
                                    
                                    <button onClick={endCall} className="ctrl-btn flex flex-col items-center gap-2">
                                        <div className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center">
                                            <i className="fas fa-phone-slash text-white text-xl"></i>
                                        </div>
                                        <span className="text-xs text-gray-400">Desligar</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </>
                )}
                
                {/* Modo minimizado */}
                {isCallMinimized && (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-black rounded-2xl cursor-pointer" onClick={() => setIsCallMinimized(false)}>
                        <img src={contactAvatar} className="w-14 h-14 rounded-full mb-3 object-cover shadow-lg" />
                        <p className="text-white text-sm font-medium truncate max-w-[90%]">{contactName}</p>
                        <p className="text-green-400 text-xs font-mono mt-1">{formatDuration(callDuration)}</p>
                        <div className="flex gap-3 mt-3">
                            <button onClick={(e) => { e.stopPropagation(); toggleMic(); }} className={`p-2 rounded-full ${isMicMuted ? 'bg-red-500' : 'bg-gray-700'}`}>
                                {isMicMuted ? <i className="fas fa-microphone-slash text-white text-sm"></i> : <i className="fas fa-microphone text-white text-sm"></i>}
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); endCall(); }} className="p-2 bg-red-600 rounded-full">
                                <i className="fas fa-phone-slash text-white text-sm"></i>
                            </button>
                        </div>
                    </div>
                )}
                
                {/* Vídeo remoto */}
                {isVideoCall && (
                    <video 
                        ref={remoteVideoRef} 
                        autoPlay 
                        playsInline 
                        className="absolute inset-0 w-full h-full object-cover -z-10"
                        style={{ transform: 'scaleX(-1)' }}
                    />
                )}
                
                {/* Self-view */}
                {isVideoCall && localStreamReady && localStreamRef.current && (
                    <div className="absolute top-5 left-5 w-32 h-48 bg-black rounded-xl overflow-hidden border-2 border-white/30 shadow-xl z-20 video-self">
                        <video 
                            ref={localVideoRef} 
                            autoPlay 
                            muted 
                            playsInline 
                            className="w-full h-full object-cover"
                            style={{ transform: 'scaleX(-1)' }}
                        />
                        {isMicMuted && (
                            <div className="absolute bottom-2 left-2 bg-red-500 rounded-full p-1.5">
                                <i className="fas fa-microphone-slash text-white text-xs"></i>
                            </div>
                        )}
                        <div className="absolute bottom-2 right-2 bg-black/50 rounded-full px-2 py-0.5 text-[10px] text-white">Você</div>
                    </div>
                )}
            </div>
        </>
    );
}