// components/QRCodeConnection.js
(function() {
    function QRCodeConnection({ user, onAddContact }) {
        const [showQRModal, setShowQRModal] = React.useState(false);
        const [showScanner, setShowScanner] = React.useState(false);
        const [qrCodeData, setQrCodeData] = React.useState(null);
        const [scanResult, setScanResult] = React.useState(null);
        const [connectionStatus, setConnectionStatus] = React.useState('idle');
        const [connectionRequests, setConnectionRequests] = React.useState([]);
        const [cameraError, setCameraError] = React.useState(null);
        
        const db = window.firebaseDB;
        let html5QrCode = null;
        
        // ==================== GERAR QR CODE ====================
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
                    userName: user.name,
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
        
        // ==================== INICIAR CÂMERA PARA ESCANEAR ====================
        const startCameraScanner = () => {
            setShowScanner(true);
            setScanResult(null);
            setCameraError(null);
            
            // Aguarda o elemento ser renderizado
            setTimeout(() => {
                const scannerElement = document.getElementById('qr-reader');
                if (!scannerElement) {
                    setCameraError('Elemento não encontrado');
                    return;
                }
                
                // Limpa qualquer instância anterior
                if (html5QrCode) {
                    html5QrCode.stop().catch(() => {});
                }
                
                html5QrCode = new Html5Qrcode("qr-reader");
                
                const config = {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                    showTorchButtonIfSupported: true
                };
                
                html5QrCode.start(
                    { facingMode: "environment" }, // Câmera traseira
                    config,
                    (decodedText) => {
                        // Sucesso ao ler QR Code
                        console.log("QR Code lido:", decodedText);
                        stopCameraScanner();
                        processScannedData(decodedText);
                    },
                    (errorMessage) => {
                        // Erro de leitura (ignora, continua tentando)
                        console.log("Erro de leitura:", errorMessage);
                    }
                ).catch((err) => {
                    console.error("Erro ao iniciar câmera:", err);
                    setCameraError("Não foi possível acessar a câmera. Verifique as permissões.");
                    setScanResult('camera_error');
                });
            }, 500);
        };
        
        // ==================== PARAR CÂMERA ====================
        const stopCameraScanner = () => {
            if (html5QrCode && html5QrCode.isScanning) {
                html5QrCode.stop().catch(() => {});
            }
            setShowScanner(false);
        };
        
        // ==================== PROCESSAR DADOS ESCANEADOS ====================
        const processScannedData = async (scannedData) => {
            setScanResult('processando');
            
            try {
                let token = scannedData;
                
                if (scannedData.startsWith('{')) {
                    try {
                        const parsed = JSON.parse(scannedData);
                        token = parsed.token;
                    } catch(e) {}
                }
                
                const tokenSnap = await db.ref(`connectionTokens/${token}`).once('value');
                const connectionData = tokenSnap.val();
                
                if (!connectionData) {
                    setScanResult('inválido');
                    setTimeout(() => setScanResult(null), 3000);
                    return;
                }
                
                if (connectionData.expiresAt < Date.now()) {
                    setScanResult('expirado');
                    setTimeout(() => setScanResult(null), 3000);
                    return;
                }
                
                if (connectionData.userId === user.id) {
                    setScanResult('mesmo_usuario');
                    setTimeout(() => setScanResult(null), 3000);
                    return;
                }
                
                setScanResult('conectando');
                
                // Adiciona o contato
                await db.ref(`users/${user.id}/contacts/${connectionData.userId}`).set({
                    type: 'private',
                    addedAt: Date.now(),
                    name: connectionData.userName,
                    avatar: connectionData.userAvatar
                });
                
                // Adiciona o usuário atual como contato do outro
                await db.ref(`users/${connectionData.userId}/contacts/${user.id}`).set({
                    type: 'private',
                    addedAt: Date.now(),
                    name: user.name,
                    avatar: user.avatar
                });
                
                await db.ref(`connectionTokens/${token}`).remove();
                
                setScanResult('sucesso');
                
                if (onAddContact) {
                    onAddContact(connectionData.userId);
                }
                
                setTimeout(() => {
                    setScanResult(null);
                    setShowScanner(false);
                    setShowQRModal(false);
                }, 2000);
                
            } catch (error) {
                console.error('Erro:', error);
                setScanResult('erro');
                setTimeout(() => setScanResult(null), 3000);
            }
        };
        
        // ==================== ESCUTAR SOLICITAÇÕES ====================
        React.useEffect(() => {
            if (!user?.id) return;
            
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
            return () => {
                requestsRef.off('value', handleRequests);
                stopCameraScanner();
            };
        }, [user?.id]);
        
        // ==================== ACEITAR CONEXÃO ====================
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
        
        // ==================== RENDER QR CODE ====================
        const renderQRCode = () => {
            if (!qrCodeData) return null;
            
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrCodeData)}`;
            
            return React.createElement('div', { className: 'flex flex-col items-center gap-3' },
                React.createElement('img', {
                    src: qrUrl,
                    className: 'w-52 h-52 border-2 border-gray-200 rounded-lg p-2 bg-white',
                    alt: 'QR Code'
                }),
                React.createElement('p', { className: 'text-xs text-gray-500 text-center' },
                    'Escaneie com a câmera do outro dispositivo'
                ),
                React.createElement('p', { className: 'text-xs text-red-400' },
                    '⏱️ Expira em 5 minutos'
                )
            );
        };
        
        // ==================== RENDER CÂMERA ====================
        const renderCamera = () => {
            return React.createElement('div', { className: 'flex flex-col gap-4' },
                React.createElement('div', {
                    id: 'qr-reader',
                    className: 'w-full rounded-lg overflow-hidden border-2 border-gray-200',
                    style: { width: '100%', minHeight: '300px' }
                }),
                cameraError && React.createElement('p', { className: 'text-red-500 text-xs text-center' }, cameraError),
                React.createElement('button', {
                    onClick: stopCameraScanner,
                    className: 'text-gray-500 text-sm underline'
                }, 'Cancelar')
            );
        };
        
        // ==================== COMPONENTE PRINCIPAL ====================
        const ConnectionButton = () => {
            return React.createElement('button', {
                onClick: () => {
                    setShowQRModal(true);
                    generateQRCode();
                },
                className: 'p-2 rounded-full hover:bg-gray-200 transition flex items-center gap-2',
                title: 'Conectar via QR Code'
            },
                React.createElement('div', { className: 'icon-qrcode text-gray-600 text-xl' })
            );
        };
        
        // Modal principal
        const QRModal = () => {
            if (!showQRModal) return null;
            
            return React.createElement('div', {
                className: 'fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4',
                onClick: () => {
                    setShowQRModal(false);
                    setShowScanner(false);
                    stopCameraScanner();
                }
            },
                React.createElement('div', {
                    className: 'bg-white rounded-xl max-w-md w-full overflow-hidden max-h-[90vh]',
                    onClick: (e) => e.stopPropagation()
                },
                    React.createElement('div', { className: 'bg-[#00a884] p-4 text-white flex justify-between items-center' },
                        React.createElement('h3', { className: 'font-bold text-lg' }, 'Conectar Dispositivos'),
                        React.createElement('button', { onClick: () => {
                            setShowQRModal(false);
                            stopCameraScanner();
                        } },
                            React.createElement('div', { className: 'icon-x text-xl' })
                        )
                    ),
                    
                    React.createElement('div', { className: 'p-4 overflow-y-auto max-h-[70vh]' },
                        !showScanner ? (
                            React.createElement('div', { className: 'flex flex-col gap-4' },
                                connectionStatus === 'generating' && React.createElement('div', { className: 'text-center py-8' },
                                    React.createElement('div', { className: 'icon-loader animate-spin text-3xl text-[#00a884] mx-auto mb-3' }),
                                    React.createElement('p', { className: 'text-gray-500' }, 'Gerando QR Code...')
                                ),
                                
                                connectionStatus === 'ready' && renderQRCode(),
                                
                                connectionStatus === 'expired' && React.createElement('div', { className: 'text-center py-8' },
                                    React.createElement('div', { className: 'icon-alert-circle text-5xl text-red-500 mx-auto mb-3' }),
                                    React.createElement('p', { className: 'text-gray-600 font-medium' }, 'QR Code Expirado'),
                                    React.createElement('button', {
                                        onClick: generateQRCode,
                                        className: 'mt-4 bg-[#00a884] text-white px-4 py-2 rounded-lg'
                                    }, 'Gerar novo')
                                ),
                                
                                connectionStatus === 'error' && React.createElement('div', { className: 'text-center py-8' },
                                    React.createElement('p', { className: 'text-red-500' }, 'Erro ao gerar QR Code')
                                ),
                                
                                React.createElement('div', { className: 'border-t border-gray-200 pt-4 mt-2' },
                                    React.createElement('button', {
                                        onClick: startCameraScanner,
                                        className: 'w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2'
                                    },
                                        React.createElement('div', { className: 'icon-camera text-xl' }),
                                        'Escanear QR Code com a Câmera'
                                    )
                                ),
                                
                                connectionRequests.length > 0 && React.createElement('div', { className: 'border-t border-gray-200 pt-4 mt-2' },
                                    React.createElement('h4', { className: 'font-medium text-gray-700 mb-2' }, 'Solicitações Pendentes'),
                                    React.createElement('div', { className: 'space-y-2 max-h-40 overflow-y-auto' },
                                        connectionRequests.map(req => 
                                            React.createElement('div', { key: req.id, className: 'flex items-center justify-between p-2 bg-gray-50 rounded-lg' },
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
                                )
                            )
                        ) : (
                            React.createElement('div', { className: 'text-center' },
                                scanResult === 'processando' && React.createElement(React.Fragment, null,
                                    React.createElement('div', { className: 'icon-loader animate-spin text-3xl text-[#00a884] mx-auto mb-3' }),
                                    React.createElement('p', { className: 'text-gray-500' }, 'Processando conexão...')
                                ),
                                scanResult === 'sucesso' && React.createElement(React.Fragment, null,
                                    React.createElement('div', { className: 'icon-check-circle text-5xl text-green-500 mx-auto mb-3' }),
                                    React.createElement('p', { className: 'text-green-600 font-bold' }, 'Conectado com sucesso!')
                                ),
                                scanResult === 'inválido' && React.createElement(React.Fragment, null,
                                    React.createElement('div', { className: 'icon-alert-circle text-5xl text-red-500 mx-auto mb-3' }),
                                    React.createElement('p', { className: 'text-red-600' }, 'QR Code inválido!')
                                ),
                                scanResult === 'expirado' && React.createElement(React.Fragment, null,
                                    React.createElement('div', { className: 'icon-alert-circle text-5xl text-yellow-500 mx-auto mb-3' }),
                                    React.createElement('p', { className: 'text-yellow-600' }, 'QR Code expirado!')
                                ),
                                scanResult === 'mesmo_usuario' && React.createElement(React.Fragment, null,
                                    React.createElement('div', { className: 'icon-alert-circle text-5xl text-yellow-500 mx-auto mb-3' }),
                                    React.createElement('p', { className: 'text-yellow-600' }, 'Você não pode se conectar com você mesmo!')
                                ),
                                scanResult === 'camera_error' && React.createElement(React.Fragment, null,
                                    React.createElement('div', { className: 'icon-alert-circle text-5xl text-red-500 mx-auto mb-3' }),
                                    React.createElement('p', { className: 'text-red-600' }, 'Erro na câmera. Verifique as permissões.'),
                                    React.createElement('button', {
                                        onClick: startCameraScanner,
                                        className: 'mt-4 bg-[#00a884] text-white px-4 py-2 rounded-lg'
                                    }, 'Tentar novamente')
                                ),
                                (!scanResult || scanResult === 'conectando') && renderCamera()
                            )
                        )
                    )
                )
            );
        };
        
        return React.createElement(React.Fragment, null,
            React.createElement(ConnectionButton, null),
            React.createElement(QRModal, null)
        );
    }
    
    window.registerComponent('QRCodeConnection', QRCodeConnection, 'headerRight');
    
    console.log('✅ QRCodeConnection registrado com suporte a câmera!');
})();