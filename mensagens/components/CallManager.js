// components/CallManager.js
function CallManager({ user, activeChat, peer, localStream, remoteStreams, onCallEnd }) {
    const [callStatus, setCallStatus] = React.useState(null); // 'calling', 'connected', null
    const [incomingCall, setIncomingCall] = React.useState(null);
    const [isVideoCall, setIsVideoCall] = React.useState(false);
    const [activeGroupCall, setActiveGroupCall] = React.useState(false);
    const [activeCalls, setActiveCalls] = React.useState({});
    const [remoteStreamsState, setRemoteStreamsState] = React.useState({});
    const [isMicMuted, setIsMicMuted] = React.useState(false);
    const [isCamMuted, setIsCamMuted] = React.useState(false);
    const [callDuration, setCallDuration] = React.useState(0);
    const [isCallMinimized, setIsCallMinimized] = React.useState(false);
    const [ongoingGroupCall, setOngoingGroupCall] = React.useState(null);
    
    const callTimerRef = React.useRef(null);
    const localVideoRef = React.useRef(null);
    const remoteVideoRef = React.useRef(null);
    const db = window.firebaseDB;
    
    // Áudio de chamada
    const callingAudioRef = React.useRef(null);
    const CALLING_SOUND_URL = "https://code.codehub.ct.ws/call1.mp3";
    
    React.useEffect(() => {
        callingAudioRef.current = new Audio(CALLING_SOUND_URL);
        callingAudioRef.current.loop = true;
        return () => {
            if (callingAudioRef.current) {
                callingAudioRef.current.pause();
                callingAudioRef.current = null;
            }
        };
    }, []);
    
    // Formatar duração
    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    // Iniciar contador
    const startCallTimer = () => {
        setCallDuration(0);
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
    
    // Silenciar microfone
    const toggleMic = () => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMicMuted(!audioTrack.enabled);
            }
        }
    };
    
    // Desligar câmera
    const toggleCam = () => {
        if (localStream && isVideoCall) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsCamMuted(!videoTrack.enabled);
            }
        }
    };
    
    // Alternar para vídeo (se estiver em chamada de áudio)
    const switchToVideo = async () => {
        if (!isVideoCall && callStatus === 'connected') {
            try {
                const newStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                const oldVideoTrack = localStream?.getVideoTracks()[0];
                if (oldVideoTrack) oldVideoTrack.stop();
                const newVideoTrack = newStream.getVideoTracks()[0];
                localStream.addTrack(newVideoTrack);
                if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
                setIsVideoCall(true);
                // Notificar peers
                Object.values(activeCalls).forEach(call => {
                    const sender = call.peerConnection?.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) sender.replaceTrack(newVideoTrack);
                });
            } catch (err) {
                console.error("Erro ao ativar câmera:", err);
            }
        }
    };
    
    // Encerrar chamada
    const endCall = () => {
        if (callingAudioRef.current) {
            callingAudioRef.current.pause();
            callingAudioRef.current.currentTime = 0;
        }
        stopCallTimer();
        Object.values(activeCalls).forEach(call => call.close());
        setActiveCalls({});
        setRemoteStreamsState({});
        setCallStatus(null);
        setIncomingCall(null);
        setIsVideoCall(false);
        setActiveGroupCall(false);
        setIsMicMuted(false);
        setIsCamMuted(false);
        if (onCallEnd) onCallEnd();
    };
    
    // Responder chamada
    const answerCall = async () => {
        if (!incomingCall || !incomingCall.callObj) return;
        if (callingAudioRef.current) {
            callingAudioRef.current.pause();
            callingAudioRef.current.currentTime = 0;
        }
        const isVideo = incomingCall.isVideo;
        setIsVideoCall(isVideo);
        setIncomingCall(null);
        setCallStatus('connected');
        startCallTimer();
        const call = incomingCall.callObj;
        call.answer(localStream);
        handleCallStream(call, isVideo);
        setActiveCalls(prev => ({ ...prev, [call.peer]: call }));
    };
    
    // Iniciar chamada
    const startCall = async (video = false, targetPeerId) => {
        if (!peer || !targetPeerId) return;
        setCallStatus('calling');
        setIsVideoCall(video);
        setIsMicMuted(false);
        setIsCamMuted(false);
        // Tocar áudio de chamada
        callingAudioRef.current?.play().catch(e => console.log("Áudio não pode ser reproduzido"));
        try {
            const call = peer.call(targetPeerId, localStream, { metadata: { isVideo: video } });
            if (!call) throw new Error("Falha ao iniciar chamada");
            handleCallStream(call, video);
            setActiveCalls({ [targetPeerId]: call });
            // Timer para timeout
            setTimeout(() => {
                if (callStatus === 'calling') {
                    endCall();
                }
            }, 30000);
        } catch(err) { 
            console.error("Erro ao ligar:", err); 
            endCall();
        }
    };
    
    // Processar stream da chamada
    const handleCallStream = (call, isVideo) => {
        call.on('stream', (remoteStream) => {
            setRemoteStreamsState(prev => ({ ...prev, [call.peer]: remoteStream }));
            if (!isVideo) {
                const audio = new Audio();
                audio.srcObject = remoteStream;
                audio.play();
            } else {
                if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
            }
            if (callStatus === 'calling') {
                setCallStatus('connected');
                startCallTimer();
            }
        });
        call.on('close', () => {
            setActiveCalls(prev => { 
                const newCalls = { ...prev }; 
                delete newCalls[call.peer]; 
                if (Object.keys(newCalls).length === 0) endCall(); 
                return newCalls; 
            });
        });
        call.on('error', (err) => console.error(`Erro na chamada:`, err));
    };
    
    // CSS do modal de chamada
    const callStyles = `
        .call-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
            z-index: 1000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        .call-container.minimized {
            width: 280px;
            height: 350px;
            top: auto;
            bottom: 20px;
            right: 20px;
            border-radius: 20px;
            cursor: pointer;
        }
        .call-button {
            transition: all 0.2s ease;
            cursor: pointer;
        }
        .call-button:hover { transform: scale(1.05); }
        .call-button:active { transform: scale(0.95); }
        .avatar-pulse {
            box-shadow: 0 0 0 0 rgba(0, 168, 132, 0.5);
            animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(0, 168, 132, 0.5); }
            70% { box-shadow: 0 0 0 20px rgba(0, 168, 132, 0); }
            100% { box-shadow: 0 0 0 0 rgba(0, 168, 132, 0); }
        }
        .call-video-local {
            position: absolute;
            bottom: 20px;
            right: 20px;
            width: 120px;
            height: 160px;
            border-radius: 12px;
            overflow: hidden;
            border: 2px solid rgba(255,255,255,0.3);
            z-index: 10;
            background: #000;
        }
        .call-video-remote {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
    `;
    
    // Se não há chamada ativa, não renderiza nada
    if (!incomingCall && !callStatus) return null;
    
    const isMinimized = isCallMinimized;
    const contactName = activeChat?.name || incomingCall?.callerId || "Usuário";
    const contactAvatar = activeChat?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${incomingCall?.callerId || activeChat?.id}`;
    
    return (
        <>
            <style>{callStyles}</style>
            <div className={`call-container ${isMinimized ? 'minimized' : ''}`} onClick={() => isMinimized && setIsCallMinimized(false)}>
                {!isMinimized ? (
                    <>
                        {/* Avatar e Nome */}
                        <div className="flex flex-col items-center mb-8">
                            <img src={contactAvatar} className="w-32 h-32 rounded-full mb-4 avatar-pulse" />
                            <h2 className="text-2xl font-semibold text-white mb-1">{contactName}</h2>
                            <p className="text-gray-400 text-sm">
                                {incomingCall ? 'Chamando...' : (callStatus === 'connected' ? formatDuration(callDuration) : 'Conectando...')}
                            </p>
                        </div>
                        
                        {/* Botões de Controle */}
                        <div className="flex justify-center gap-6 flex-wrap">
                            {incomingCall ? (
                                <>
                                    <button onClick={endCall} className="call-button w-16 h-16 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700">
                                        <div className="icon-phone-off text-3xl text-white"></div>
                                    </button>
                                    <button onClick={answerCall} className="call-button w-16 h-16 bg-green-500 rounded-full flex items-center justify-center hover:bg-green-600">
                                        <div className="icon-phone text-3xl text-white"></div>
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button onClick={toggleMic} className={`call-button w-14 h-14 rounded-full flex items-center justify-center ${isMicMuted ? 'bg-red-500' : 'bg-gray-700 hover:bg-gray-600'}`}>
                                        <div className={isMicMuted ? "icon-mic-off text-2xl text-white" : "icon-mic text-2xl text-white"}></div>
                                    </button>
                                    
                                    {isVideoCall && (
                                        <button onClick={toggleCam} className={`call-button w-14 h-14 rounded-full flex items-center justify-center ${isCamMuted ? 'bg-red-500' : 'bg-gray-700 hover:bg-gray-600'}`}>
                                            <div className={isCamMuted ? "icon-video-off text-2xl text-white" : "icon-video text-2xl text-white"}></div>
                                        </button>
                                    )}
                                    
                                    {!isVideoCall && callStatus === 'connected' && (
                                        <button onClick={switchToVideo} className="call-button w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700">
                                            <div className="icon-video text-2xl text-white"></div>
                                        </button>
                                    )}
                                    
                                    <button onClick={endCall} className="call-button w-16 h-16 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700">
                                        <div className="icon-phone-off text-3xl text-white"></div>
                                    </button>
                                    
                                    <button onClick={() => setIsCallMinimized(true)} className="call-button w-14 h-14 bg-gray-700 rounded-full flex items-center justify-center hover:bg-gray-600">
                                        <div className="icon-arrow-down text-2xl text-white"></div>
                                    </button>
                                </>
                            )}
                        </div>
                        
                        {/* Vídeos */}
                        {isVideoCall && localStream && (
                            <div className="call-video-local">
                                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                            </div>
                        )}
                        {isVideoCall && remoteVideoRef.current?.srcObject && (
                            <video ref={remoteVideoRef} autoPlay playsInline className="call-video-remote" />
                        )}
                    </>
                ) : (
                    // Modo minimizado
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-black rounded-2xl">
                        <img src={contactAvatar} className="w-12 h-12 rounded-full mb-2" />
                        <p className="text-white text-xs font-medium truncate max-w-[90%]">{contactName}</p>
                        <p className="text-green-400 text-xs">{formatDuration(callDuration)}</p>
                        <div className="flex gap-3 mt-3">
                            <button onClick={(e) => { e.stopPropagation(); setIsCallMinimized(false); }} className="p-2 bg-gray-700 rounded-full">
                                <div className="icon-maximize-2 text-white text-sm"></div>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); endCall(); }} className="p-2 bg-red-600 rounded-full">
                                <div className="icon-phone-off text-white text-sm"></div>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
