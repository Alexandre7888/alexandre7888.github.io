// components/UserInfo.js
function UserInfo({ currentUser, targetUser, onClose, onSendMessage, onAddContact, onBlockStatusChange }) {
    const [userData, setUserData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [isContact, setIsContact] = React.useState(false);
    const [isBlocked, setIsBlocked] = React.useState(false);
    const [isBlockedByMe, setIsBlockedByMe] = React.useState(false);
    const [showBlockConfirm, setShowBlockConfirm] = React.useState(false);
    const [showUnblockConfirm, setShowUnblockConfirm] = React.useState(false);
    
    const db = window.firebaseDB;

    React.useEffect(() => {
        loadUserData();
        checkBlockStatus();
    }, [targetUser?.id]);

    const loadUserData = async () => {
        setLoading(true);
        try {
            const userSnap = await db.ref(`users/${targetUser.id}`).once('value');
            const data = userSnap.val();
            
            if (data) {
                setUserData({
                    ...data,
                    id: targetUser.id
                });
            } else {
                setUserData(targetUser);
            }
            
            const contactSnap = await db.ref(`users/${currentUser.id}/contacts/${targetUser.id}`).once('value');
            setIsContact(contactSnap.exists());
            
        } catch (error) {
            console.error("Erro:", error);
        } finally {
            setLoading(false);
        }
    };

    const checkBlockStatus = async () => {
        try {
            // Verifica se EU bloqueei o usuário
            const blockByMeSnap = await db.ref(`users/${currentUser.id}/blocked/${targetUser.id}`).once('value');
            setIsBlockedByMe(blockByMeSnap.exists());
            
            // Verifica se o usuário me bloqueou
            const blockByThemSnap = await db.ref(`users/${targetUser.id}/blocked/${currentUser.id}`).once('value');
            setIsBlocked(blockByThemSnap.exists());
            
        } catch (error) {
            console.error("Erro ao verificar bloqueio:", error);
        }
    };

    const handleBlock = async () => {
        // Bloqueia o usuário
        await db.ref(`users/${currentUser.id}/blocked/${targetUser.id}`).set({
            blockedAt: Date.now(),
            name: userData?.name || targetUser.name
        });
        
        // Remove dos contatos se estiver
        await db.ref(`users/${currentUser.id}/contacts/${targetUser.id}`).remove();
        
        setIsBlockedByMe(true);
        setIsContact(false);
        setShowBlockConfirm(false);
        
        // Notifica mudança
        if (onBlockStatusChange) {
            onBlockStatusChange(targetUser.id, true);
        }
        
        alert(`🚫 ${userData?.name || targetUser.name} foi bloqueado!`);
        onClose();
    };

    const handleUnblock = async () => {
        // Desbloqueia o usuário
        await db.ref(`users/${currentUser.id}/blocked/${targetUser.id}`).remove();
        
        setIsBlockedByMe(false);
        setShowUnblockConfirm(false);
        
        if (onBlockStatusChange) {
            onBlockStatusChange(targetUser.id, false);
        }
        
        alert(`✅ ${userData?.name || targetUser.name} foi desbloqueado!`);
        onClose();
    };

    const handleSendMessage = () => {
        if (isBlocked) {
            alert("❌ Você não pode enviar mensagem para este usuário pois foi bloqueado.");
            return;
        }
        if (isBlockedByMe) {
            alert("❌ Você bloqueou este usuário. Desbloqueie para enviar mensagens.");
            return;
        }
        if (onSendMessage) {
            onSendMessage(targetUser.id);
            onClose();
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'Não disponível';
        const date = new Date(timestamp);
        return date.toLocaleDateString('pt-BR');
    };

    // Avatar com ou sem blur (se bloqueado)
    const getAvatarStyle = () => {
        if (isBlocked || isBlockedByMe) {
            return {
                filter: 'blur(8px)',
                cursor: 'not-allowed'
            };
        }
        return {};
    };

    if (loading) {
        return React.createElement('div', {
            className: 'fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4'
        },
            React.createElement('div', { className: 'bg-white rounded-xl p-6 text-center' },
                React.createElement('div', { className: 'icon-loader animate-spin text-3xl text-[#00a884] mx-auto mb-3' }),
                React.createElement('p', { className: 'text-gray-500' }, 'Carregando...')
            )
        );
    }

    const displayName = userData?.name || targetUser.name;
    const displayAvatar = userData?.avatar || targetUser.avatar;
    const isBlockedDisplay = isBlocked || isBlockedByMe;

    return React.createElement('div', {
        className: 'fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4',
        onClick: onClose
    },
        React.createElement('div', {
            className: 'bg-white rounded-xl max-w-md w-full overflow-hidden shadow-xl animate-fade-in',
            onClick: (e) => e.stopPropagation()
        },
            // Header
            React.createElement('div', { className: 'bg-[#00a884] p-4 text-white flex justify-between items-center' },
                React.createElement('h3, { className: 'font-bold text-lg' }, 'Informações do Contato'),
                React.createElement('button', { onClick: onClose },
                    React.createElement('div', { className: 'icon-x text-xl' })
                )
            ),
            
            // Conteúdo
            React.createElement('div', { className: 'p-6 text-center' },
                // Avatar
                React.createElement('div', { className: 'relative inline-block' },
                    React.createElement('img', {
                        src: displayAvatar,
                        className: `w-28 h-28 rounded-full mx-auto mb-3 border-4 border-gray-200 object-cover transition-all duration-300 ${isBlockedDisplay ? 'opacity-50' : ''}`,
                        style: getAvatarStyle(),
                        alt: displayName
                    }),
                    isBlockedDisplay && React.createElement('div', {
                        className: 'absolute inset-0 flex items-center justify-center rounded-full bg-black/50'
                    },
                        React.createElement('div', { className: 'icon-lock text-white text-2xl' })
                    )
                ),
                
                // Nome
                React.createElement('h2, { className: 'text-xl font-bold text-gray-800' }, displayName),
                
                // ID
                React.createElement('p, { className: 'text-xs text-gray-400 mt-1' }, `ID: ${targetUser.id}`),
                
                // Status Bloqueado
                isBlocked && React.createElement('div', { className: 'mt-2 inline-block bg-red-100 text-red-600 text-xs px-3 py-1 rounded-full' },
                    '🔒 Bloqueou você'
                ),
                
                isBlockedByMe && React.createElement('div', { className: 'mt-2 inline-block bg-red-100 text-red-600 text-xs px-3 py-1 rounded-full' },
                    '🚫 Você bloqueou este contato'
                ),
                
                // Botões de ação
                React.createElement('div', { className: 'mt-6 space-y-2' },
                    // Botão Mensagem
                    !isBlockedDisplay && React.createElement('button', {
                        onClick: handleSendMessage,
                        className: 'w-full bg-[#00a884] text-white py-2 rounded-lg font-semibold hover:bg-[#008f6f] transition flex items-center justify-center gap-2'
                    },
                        React.createElement('div', { className: 'icon-message-circle' }),
                        'Enviar Mensagem'
                    ),
                    
                    // Botão Adicionar/Remover Contato
                    !isBlockedByMe && !isBlocked && React.createElement('button', {
                        onClick: isContact ? null : handleAddContact,
                        className: `w-full py-2 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${isContact ? 'bg-gray-100 text-gray-500 cursor-default' : 'border-2 border-[#00a884] text-[#00a884] hover:bg-[#00a884] hover:text-white'}`,
                        disabled: isContact
                    },
                        React.createElement('div', { className: isContact ? 'icon-check' : 'icon-user-plus' }),
                        isContact ? 'Adicionado' : 'Adicionar Contato'
                    ),
                    
                    // Botão Bloquear/Desbloquear
                    !isBlocked && (isBlockedByMe ? 
                        React.createElement('button', {
                            onClick: () => setShowUnblockConfirm(true),
                            className: 'w-full bg-orange-500 text-white py-2 rounded-lg font-semibold hover:bg-orange-600 transition flex items-center justify-center gap-2'
                        },
                            React.createElement('div', { className: 'icon-unlock' }),
                            'Desbloquear'
                        ) :
                        React.createElement('button', {
                            onClick: () => setShowBlockConfirm(true),
                            className: 'w-full bg-red-500 text-white py-2 rounded-lg font-semibold hover:bg-red-600 transition flex items-center justify-center gap-2'
                        },
                            React.createElement('div', { className: 'icon-block' }),
                            'Bloquear'
                        )
                    )
                ),
                
                // Informações adicionais
                React.createElement('div', { className: 'mt-6 pt-4 border-t border-gray-100 text-left' },
                    React.createElement('p, { className: 'text-xs text-gray-400 flex items-center gap-2 mb-1' },
                        React.createElement('div', { className: 'icon-calendar text-sm' }),
                        `Entrou em: ${formatDate(userData?.createdAt || userData?.lastSeen)}`
                    ),
                    React.createElement('p, { className: 'text-xs text-gray-400 flex items-center gap-2' },
                        React.createElement('div', { className: 'icon-shield text-sm' }),
                        `Conta ${isBlocked ? 'Bloqueada' : 'Ativa'}`
                    )
                )
            ),
            
            // Modal de confirmação de bloqueio
            showBlockConfirm && React.createElement('div', {
                className: 'absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl',
                onClick: () => setShowBlockConfirm(false)
            },
                React.createElement('div', { className: 'bg-white rounded-xl p-6 m-4 text-center' },
                    React.createElement('div, { className: 'icon-alert-circle text-5xl text-red-500 mx-auto mb-3' }),
                    React.createElement('h3, { className: 'text-lg font-bold mb-2' }, 'Bloquear Contato?'),
                    React.createElement('p, { className: 'text-gray-600 text-sm mb-4' }, 
                        `Você não receberá mais mensagens de ${displayName}.`
                    ),
                    React.createElement('div, { className: 'flex gap-3' },
                        React.createElement('button', {
                            onClick: () => setShowBlockConfirm(false),
                            className: 'flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg'
                        }, 'Cancelar'),
                        React.createElement('button', {
                            onClick: handleBlock,
                            className: 'flex-1 bg-red-500 text-white py-2 rounded-lg'
                        }, 'Bloquear')
                    )
                )
            ),
            
            // Modal de confirmação de desbloqueio
            showUnblockConfirm && React.createElement('div', {
                className: 'absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl',
                onClick: () => setShowUnblockConfirm(false)
            },
                React.createElement('div', { className: 'bg-white rounded-xl p-6 m-4 text-center' },
                    React.createElement('div, { className: 'icon-alert-circle text-5xl text-orange-500 mx-auto mb-3' }),
                    React.createElement('h3, { className: 'text-lg font-bold mb-2' }, 'Desbloquear Contato?'),
                    React.createElement('p, { className: 'text-gray-600 text-sm mb-4' }, 
                        `${displayName} poderá enviar mensagens para você novamente.`
                    ),
                    React.createElement('div, { className: 'flex gap-3' },
                        React.createElement('button', {
                            onClick: () => setShowUnblockConfirm(false),
                            className: 'flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg'
                        }, 'Cancelar'),
                        React.createElement('button', {
                            onClick: handleUnblock,
                            className: 'flex-1 bg-orange-500 text-white py-2 rounded-lg'
                        }, 'Desbloquear')
                    )
                )
            )
        )
    );
}

// Registra globalmente
window.UserInfo = UserInfo;