// components/GroupInfo.js
function GroupInfo({ activeChat, user, onClose }) {
    const [members, setMembers] = React.useState([]);
    const [isAdmin, setIsAdmin] = React.useState(false);
    const [customRoles, setCustomRoles] = React.useState({});
    const [permissions, setPermissions] = React.useState({
        sendText: true,
        sendAudio: true,
        sendVideo: true,
        sendMedia: true,
        manageCalls: false,
        pinMessages: false,
        kickMembers: false,
        canAddMembers: false
    });
    const [settings, setSettings] = React.useState({
        inviteLinkEnabled: false,
        requireApproval: true
    });
    const [requests, setRequests] = React.useState({});
    const [bannedUsers, setBannedUsers] = React.useState([]);
    const [showRuleEditor, setShowRuleEditor] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    const db = window.firebaseDB;

    React.useEffect(() => {
        if (!activeChat || activeChat.type !== 'group') {
            setError("Grupo inválido");
            setLoading(false);
            return;
        }

        if (!db) {
            setError("Firebase não inicializado");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        const groupRef = db.ref(`groups/${activeChat.id}`);
        
        const handleGroupData = async (snapshot) => {
            try {
                const data = snapshot.val();
                if (!data) {
                    setError("Grupo não encontrado");
                    setLoading(false);
                    return;
                }
                
                if (data.permissions) setPermissions(data.permissions);
                if (data.roles) setCustomRoles(data.roles || {});
                if (data.settings) setSettings(data.settings || {});
                if (data.requests) setRequests(data.requests || {});
                
                const memberIds = Object.keys(data.members || {});
                const myRole = data.members[user.id];
                setIsAdmin(myRole === 'admin');

                // Carregar membros
                const loadedMembers = await Promise.all(memberIds.map(async id => {
                    try {
                        const userSnap = await db.ref(`users/${id}`).once('value');
                        const userData = userSnap.val();
                        const roleKey = data.members[id];
                        let roleName = roleKey === 'admin' ? 'Admin' : (roleKey === 'member' ? 'Membro' : (data.roles?.[roleKey]?.name || 'Membro'));
                        
                        return {
                            id: id,
                            name: userData?.name || id,
                            avatar: userData?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`,
                            roleKey: roleKey,
                            roleName: roleName,
                            privacy: userData?.privacy || {}
                        };
                    } catch(e) {
                        return null;
                    }
                }));
                
                setMembers(loadedMembers.filter(m => m !== null));

                // Carregar usuários banidos
                const bannedSnapshot = await db.ref(`groups/${activeChat.id}/banned`).once('value');
                const bannedData = bannedSnapshot.val() || {};
                const bannedList = await Promise.all(Object.keys(bannedData).map(async (userId) => {
                    const userSnap = await db.ref(`users/${userId}`).once('value');
                    const userData = userSnap.val() || {};
                    return {
                        id: userId,
                        name: userData.name || userId,
                        avatar: userData.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
                        bannedAt: bannedData[userId].bannedAt,
                        bannedBy: bannedData[userId].bannedBy
                    };
                }));
                setBannedUsers(bannedList);
                
                setLoading(false);
            } catch (err) {
                console.error("Erro ao processar dados do grupo:", err);
                setError("Erro ao carregar dados");
                setLoading(false);
            }
        };

        groupRef.on('value', handleGroupData);
        
        return () => groupRef.off();
    }, [activeChat, user, db]);

    const showToastMessage = (message, type = "info") => {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm ${type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-gray-800'} animate-fade-in-up`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    };

    // Função para BANIR usuário e apagar TODAS as mensagens
    const banUser = async (memberId, memberName) => {
        if (!isAdmin) {
            showToastMessage("Apenas administradores podem banir membros!", "error");
            return;
        }
        
        if (!confirm(`⚠️ ATENÇÃO: Banir ${memberName} irá:\n\n• Expulsá-lo do grupo\n• Apagar TODAS as mensagens enviadas por ele\n• Impedir que ele entre novamente\n\nTem certeza?`)) return;
        
        try {
            // 1. Adicionar à lista de banidos
            await db.ref(`groups/${activeChat.id}/banned/${memberId}`).set({
                bannedAt: Date.now(),
                bannedBy: user.id,
                name: memberName
            });
            
            // 2. Remover dos membros
            await db.ref(`groups/${activeChat.id}/members/${memberId}`).remove();
            
            // 3. Buscar e apagar TODAS as mensagens do usuário no grupo
            const messagesRef = db.ref(`groups/${activeChat.id}/messages`);
            const snapshot = await messagesRef.orderByChild('senderId').equalTo(memberId).once('value');
            
            const deletions = [];
            snapshot.forEach((childSnapshot) => {
                deletions.push(childSnapshot.ref.remove());
            });
            
            await Promise.all(deletions);
            
            // 4. Remover dos contatos do usuário
            await db.ref(`users/${memberId}/contacts/${activeChat.id}`).remove();
            
            // 5. Registrar no log do grupo
            await db.ref(`groups/${activeChat.id}/logs`).push({
                action: 'ban',
                userId: memberId,
                userName: memberName,
                bannedBy: user.id,
                timestamp: Date.now(),
                messageCount: deletions.length
            });
            
            // 6. Atualizar a lista de membros local
            setMembers(prev => prev.filter(m => m.id !== memberId));
            
            showToastMessage(`${memberName} foi banido e ${deletions.length} mensagens foram apagadas!`, "success");
            
        } catch (error) {
            console.error("Erro ao banir:", error);
            showToastMessage("Erro ao banir usuário!", "error");
        }
    };

    // Função para DESBANIR usuário
    const unbanUser = async (userId, userName) => {
        if (!isAdmin) {
            showToastMessage("Apenas administradores podem desbanir!", "error");
            return;
        }
        
        if (!confirm(`Deseja remover o banimento de ${userName}?`)) return;
        
        try {
            await db.ref(`groups/${activeChat.id}/banned/${userId}`).remove();
            setBannedUsers(prev => prev.filter(u => u.id !== userId));
            showToastMessage(`${userName} foi desbanido!`, "success");
        } catch (error) {
            console.error("Erro ao desbanir:", error);
            showToastMessage("Erro ao desbanir usuário!", "error");
        }
    };

    // Função para EXPULSAR usuário (sem apagar mensagens)
    const kickUser = async (memberId, memberName) => {
        if (!isAdmin) {
            showToastMessage("Apenas administradores podem expulsar membros!", "error");
            return;
        }
        
        if (!confirm(`Expulsar ${memberName} do grupo?`)) return;
        
        try {
            await db.ref(`groups/${activeChat.id}/members/${memberId}`).remove();
            await db.ref(`users/${memberId}/contacts/${activeChat.id}`).remove();
            
            setMembers(prev => prev.filter(m => m.id !== memberId));
            showToastMessage(`${memberName} foi expulso!`, "success");
        } catch (error) {
            console.error("Erro ao expulsar:", error);
            showToastMessage("Erro ao expulsar usuário!", "error");
        }
    };

    const togglePermission = (key) => {
        if (!isAdmin) return;
        const newPerms = { ...permissions, [key]: !permissions[key] };
        db.ref(`groups/${activeChat.id}/permissions`).set(newPerms);
    };

    const assignRole = (memberId, roleKey) => {
        if (!isAdmin) return;
        db.ref(`groups/${activeChat.id}/members/${memberId}`).set(roleKey);
    };

    const createRole = () => {
        if (!isAdmin) return;
        const name = prompt("Nome do novo cargo:");
        if (name) {
            const roleId = 'role_' + Date.now();
            const colors = ['#00a884', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#8b5cf6'];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            db.ref(`groups/${activeChat.id}/roles/${roleId}`).set({ name: name, color: randomColor });
        }
    };
    
    const editRole = (roleId, currentName) => {
        if (!isAdmin) return;
        const newName = prompt("Novo nome para o cargo:", currentName);
        if (newName && newName !== currentName) {
            db.ref(`groups/${activeChat.id}/roles/${roleId}/name`).set(newName);
        }
    };

    const addCustomPermission = () => {
        if (!isAdmin) return;
        const name = prompt("Nome da nova permissão (ex: deleteMessages):");
        if (name) {
            const cleanName = name.replace(/[^a-zA-Z0-9]/g, '');
            if (!permissions.hasOwnProperty(cleanName)) {
                db.ref(`groups/${activeChat.id}/permissions/${cleanName}`).set(false);
            } else {
                alert("Permissão já existe.");
            }
        }
    };

    const addMember = async () => {
        if (!isAdmin) return;
        
        const memberId = prompt("Digite o ID do usuário para adicionar:");
        if (!memberId) return;
        
        if (members.find(m => m.id === memberId)) {
            alert("Usuário já está no grupo.");
            return;
        }

        try {
            const userSnap = await db.ref(`users/${memberId}`).once('value');
            if (!userSnap.exists()) {
                alert("Usuário não encontrado.");
                return;
            }

            const settingsSnap = await db.ref(`users/${memberId}/settings`).once('value');
            const targetSettings = settingsSnap.val() || {};
            const privacy = targetSettings.groupPrivacy || 'everyone';
            
            let allowed = true;
            
            if (privacy === 'nobody') {
                allowed = false;
                alert("Este usuário não permite ser adicionado em grupos.");
            } else if (privacy === 'contacts' || privacy === 'blacklist') {
                const contactSnap = await db.ref(`users/${memberId}/contacts/${user.id}`).once('value');
                const isContact = contactSnap.exists();
                
                if (privacy === 'contacts' && !isContact) {
                    allowed = false;
                    alert("Este usuário só permite adição por contatos.");
                } else if (privacy === 'blacklist') {
                    const blacklist = targetSettings.groupBlacklist || {};
                    if (blacklist[user.id]) {
                        allowed = false;
                        alert("Você está na lista de bloqueio deste usuário.");
                    }
                }
            }

            if (!allowed) return;

            await db.ref(`groups/${activeChat.id}/members/${memberId}`).set('member');
            await db.ref(`users/${memberId}/contacts/${activeChat.id}`).set({ type: 'group', joinedAt: Date.now() });
            
            alert("Usuário adicionado com sucesso!");

        } catch (error) {
            console.error("Erro ao adicionar membro:", error);
            alert("Erro ao processar solicitação.");
        }
    };
    
    const deleteRole = (roleId) => {
        if (!isAdmin) return;
        if (!confirm("Excluir este cargo? Membros voltarão a ser 'Membros'.")) return;
        db.ref(`groups/${activeChat.id}/roles/${roleId}`).remove();
        members.forEach(m => {
            if (m.roleKey === roleId) {
                assignRole(m.id, 'member');
            }
        });
    };

    const handleEditGroup = () => {
        if (!isAdmin) return;
        const newName = prompt("Novo nome do grupo:", activeChat.name);
        if (newName && newName !== activeChat.name) {
            db.ref(`groups/${activeChat.id}/name`).set(newName);
        }
    };

    const handleAvatarChange = async (e) => {
        if (!isAdmin || !e.target.files[0]) return;
        
        try {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = async () => {
                await db.ref(`groups/${activeChat.id}/avatar`).set(reader.result);
                alert("Avatar atualizado!");
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error("Erro ao processar imagem:", error);
            alert("Erro ao carregar a imagem.");
        }
    };

    const toggleSetting = (key) => {
        if (!isAdmin) return;
        db.ref(`groups/${activeChat.id}/settings/${key}`).set(!settings[key]);
    };

    const handleRequest = (reqUserId, approve) => {
        if (!isAdmin) return;
        if (approve) {
            db.ref(`groups/${activeChat.id}/members/${reqUserId}`).set('member');
            db.ref(`users/${reqUserId}/contacts/${activeChat.id}`).set({ type: 'group', joinedAt: Date.now() });
        }
        db.ref(`groups/${activeChat.id}/requests/${reqUserId}`).remove();
    };

    const getInviteLink = () => {
        return `${window.location.origin}${window.location.pathname}?join=${activeChat.id}`;
    };

    // Se estiver carregando
    if (loading) {
        return (
            <div className="absolute inset-0 bg-white z-20 flex flex-col animate-slide-in-right">
                <div className="bg-[#f0f2f5] p-4 flex items-center gap-4 shadow-sm shrink-0">
                    <button onClick={onClose} className="text-gray-600 hover:bg-gray-200 p-2 rounded-full">
                        <div className="icon-arrow-left"></div>
                    </button>
                    <h2 className="font-semibold text-gray-800">Dados do Grupo</h2>
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <div className="icon-loader animate-spin text-3xl text-[#00a884]"></div>
                </div>
            </div>
        );
    }

    // Se houve erro
    if (error) {
        return (
            <div className="absolute inset-0 bg-white z-20 flex flex-col animate-slide-in-right">
                <div className="bg-[#f0f2f5] p-4 flex items-center gap-4 shadow-sm shrink-0">
                    <button onClick={onClose} className="text-gray-600 hover:bg-gray-200 p-2 rounded-full">
                        <div className="icon-arrow-left"></div>
                    </button>
                    <h2 className="font-semibold text-gray-800">Dados do Grupo</h2>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center p-6">
                    <div className="icon-alert-circle text-5xl text-red-500 mb-4"></div>
                    <p className="text-gray-600 text-center">{error}</p>
                    <button onClick={onClose} className="mt-4 px-4 py-2 bg-[#00a884] text-white rounded-lg">Voltar</button>
                </div>
            </div>
        );
    }

    // Agrupar membros por cargo
    const groupedMembers = {
        'admin': members.filter(m => m.roleKey === 'admin'),
        'member': members.filter(m => m.roleKey === 'member')
    };
    Object.keys(customRoles).forEach(rId => {
        groupedMembers[rId] = members.filter(m => m.roleKey === rId);
    });

    return (
        <div className="absolute inset-0 bg-white z-20 flex flex-col animate-slide-in-right">
            {showRuleEditor && <RuleEditor activeChat={activeChat} onClose={() => setShowRuleEditor(false)} />}
            
            <div className="bg-[#f0f2f5] p-4 flex items-center gap-4 shadow-sm shrink-0">
                <button onClick={onClose} className="text-gray-600 hover:bg-gray-200 p-2 rounded-full">
                    <div className="icon-arrow-left"></div>
                </button>
                <h2 className="font-semibold text-gray-800">Dados do Grupo</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {/* Cabeçalho do Grupo */}
                <div className="flex flex-col items-center mb-8 relative">
                    <div className="relative group">
                        <img src={activeChat.avatar} className="w-32 h-32 rounded-full mb-4 shadow-md object-cover bg-gray-100" />
                        {isAdmin && (
                            <>
                                <label htmlFor="group-avatar-upload" className="absolute bottom-4 right-0 bg-[#00a884] p-2 rounded-full cursor-pointer hover:bg-[#008f6f] shadow-lg transition-transform hover:scale-110">
                                    <div className="icon-camera text-white text-lg"></div>
                                </label>
                                <input id="group-avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                            </>
                        )}
                    </div>
                    
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        {activeChat.name}
                        {isAdmin && <div className="icon-pencil w-4 h-4 cursor-pointer text-gray-400 hover:text-black" onClick={handleEditGroup} title="Editar Nome"></div>}
                        <div className="text-sm bg-gray-200 px-2 py-0.5 rounded text-gray-600 font-normal">ID: {activeChat.id}</div>
                    </h1>
                    <p className="text-gray-500">Grupo • {members.length} participantes</p>
                    
                    {/* Botões de chamada */}
                    <div className="flex gap-4 mt-6 w-full max-w-xs justify-center">
                        <button onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('start-group-call', { detail: { groupId: activeChat.id, video: false } })); }} className="flex-1 flex flex-col items-center gap-2 p-3 rounded-xl bg-green-50 text-[#00a884] hover:bg-green-100 transition shadow-sm">
                            <div className="p-2 bg-white rounded-full shadow-sm"><div className="icon-phone text-xl"></div></div>
                            <span className="text-sm font-semibold">Voz</span>
                        </button>
                        <button onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('start-group-call', { detail: { groupId: activeChat.id, video: true } })); }} className="flex-1 flex flex-col items-center gap-2 p-3 rounded-xl bg-green-50 text-[#00a884] hover:bg-green-100 transition shadow-sm">
                            <div className="p-2 bg-white rounded-full shadow-sm"><div className="icon-video text-xl"></div></div>
                            <span className="text-sm font-semibold">Vídeo</span>
                        </button>
                    </div>
                </div>

                {/* Seção de Notificações */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 mb-6 overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b border-gray-100 font-semibold text-gray-700">
                        <div className="flex items-center gap-2">
                            <div className="icon-bell text-gray-500"></div>
                            <span>Notificações do Grupo</span>
                        </div>
                    </div>
                    <div className="p-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <span className="text-sm text-gray-700 block">Silenciar Notificações</span>
                                <span className="text-xs text-gray-400">Não receber alertas deste grupo</span>
                            </div>
                            <button onClick={() => {
                                if (window.NotificationSystem) {
                                    if (window.NotificationSystem.isBlocked(activeChat.id)) {
                                        window.NotificationSystem.removeFromBlacklist(activeChat.id);
                                        alert("Notificações reativadas!");
                                    } else {
                                        window.NotificationSystem.addToBlacklist(activeChat.id);
                                        alert("Notificações silenciadas!");
                                    }
                                }
                            }} className={`w-10 h-5 rounded-full p-0.5 transition-colors ${window.NotificationSystem?.isBlocked(activeChat.id) ? 'bg-red-500' : 'bg-gray-300'}`}>
                                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${window.NotificationSystem?.isBlocked(activeChat.id) ? 'translate-x-5' : ''}`}></div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Seção de Convite e Acesso */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 mb-6 overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b border-gray-100 font-semibold text-gray-700">
                        <div className="flex items-center gap-2">
                            <div className="icon-link text-gray-500"></div>
                            <span>Convite e Acesso</span>
                        </div>
                    </div>
                    <div className="p-4 space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-700">Link de Convite Ativo</span>
                            <button onClick={() => toggleSetting('inviteLinkEnabled')} disabled={!isAdmin} className={`w-10 h-5 rounded-full p-0.5 transition-colors ${settings.inviteLinkEnabled ? 'bg-[#00a884]' : 'bg-gray-300'}`}>
                                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${settings.inviteLinkEnabled ? 'translate-x-5' : ''}`}></div>
                            </button>
                        </div>
                        
                        {settings.inviteLinkEnabled && (
                            <div className="bg-gray-100 p-2 rounded flex items-center justify-between gap-2 border border-gray-200">
                                <span className="text-xs text-gray-500 truncate font-mono select-all">{getInviteLink()}</span>
                                <button onClick={() => { navigator.clipboard.writeText(getInviteLink()); alert("Link copiado!"); }} className="text-[#00a884] hover:text-[#008f6f]" title="Copiar">
                                    <div className="icon-copy text-sm"></div>
                                </button>
                            </div>
                        )}

                        <div className="flex justify-between items-center">
                            <div>
                                <span className="text-sm text-gray-700 block">Exigir Aprovação</span>
                                <span className="text-xs text-gray-400">Admins precisam aprovar quem entra</span>
                            </div>
                            <button onClick={() => toggleSetting('requireApproval')} disabled={!isAdmin} className={`w-10 h-5 rounded-full p-0.5 transition-colors ${settings.requireApproval ? 'bg-[#00a884]' : 'bg-gray-300'}`}>
                                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${settings.requireApproval ? 'translate-x-5' : ''}`}></div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Solicitações Pendentes */}
                {isAdmin && Object.keys(requests).length > 0 && (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-100 mb-6 overflow-hidden border-l-4 border-l-orange-400">
                        <div className="p-3 bg-orange-50 font-semibold text-orange-800 text-sm flex items-center gap-2">
                            <div className="icon-user-check"></div>
                            Solicitações Pendentes ({Object.keys(requests).length})
                        </div>
                        <div className="divide-y divide-gray-100">
                            {Object.entries(requests).map(([reqId, reqData]) => (
                                <div key={reqId} className="p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <img src={reqData.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${reqId}`} className="w-8 h-8 rounded-full" />
                                        <div>
                                            <div className="text-sm font-bold text-gray-800">{reqData.name || 'Desconhecido'}</div>
                                            <div className="text-xs text-gray-400">{new Date(reqData.timestamp).toLocaleString()}</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleRequest(reqId, false)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Recusar"><div className="icon-x"></div></button>
                                        <button onClick={() => handleRequest(reqId, true)} className="p-1.5 text-green-500 hover:bg-green-50 rounded" title="Aprovar"><div className="icon-check"></div></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Permissões */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 mb-6">
                    <div className="p-4 bg-gray-50 border-b border-gray-100 font-semibold text-gray-700 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="icon-shield text-gray-500"></div>
                            <span>Permissões do Grupo</span>
                        </div>
                        {isAdmin && (
                            <button onClick={addCustomPermission} className="text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded">+ Permissão</button>
                        )}
                    </div>
                    <div className="divide-y divide-gray-100">
                        {Object.entries(permissions).map(([key, value]) => (
                            <div key={key} className="p-4 flex justify-between items-center hover:bg-gray-50">
                                <span className="text-gray-700 capitalize text-sm">{key.replace(/([A-Z])/g, ' $1')}</span>
                                <button onClick={() => togglePermission(key)} disabled={!isAdmin} className={`w-10 h-5 rounded-full p-0.5 transition-colors ${value ? 'bg-[#00a884]' : 'bg-gray-300'}`}>
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${value ? 'translate-x-5' : ''}`}></div>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Usuários Banidos */}
                {isAdmin && bannedUsers.length > 0 && (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-100 mb-6 overflow-hidden">
                        <div className="p-4 bg-red-50 border-b border-red-100 font-semibold text-red-700">
                            <div className="flex items-center gap-2">
                                <div className="icon-ban text-red-500"></div>
                                <span>Usuários Banidos ({bannedUsers.length})</span>
                            </div>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {bannedUsers.map(user => (
                                <div key={user.id} className="p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <img src={user.avatar} className="w-8 h-8 rounded-full" />
                                        <div>
                                            <p className="font-medium text-gray-800">{user.name}</p>
                                            <p className="text-xs text-gray-500">Banido em: {new Date(user.bannedAt).toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => unbanUser(user.id, user.name)} className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600">Desbanir</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Cargos e Membros */}
                <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center px-2">
                        <h3 className="font-bold text-gray-700">Cargos & Membros</h3>
                        {isAdmin && (
                            <div className="flex gap-3">
                                <button onClick={createRole} className="text-xs bg-gray-100 px-3 py-1 rounded-full text-gray-600 hover:bg-gray-200 border border-gray-300">+ Criar Cargo</button>
                                <button onClick={addMember} className="text-xs bg-[#00a884] px-3 py-1 rounded-full text-white hover:bg-[#008f6f] shadow-sm">+ Add Membro</button>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-4">
                        {['admin', ...Object.keys(customRoles), 'member'].map(roleKey => {
                            const roleMembers = groupedMembers[roleKey] || [];
                            if (roleMembers.length === 0 && roleKey === 'member') return null;
                            if (roleMembers.length === 0 && roleKey !== 'admin' && !isAdmin) return null;

                            const roleObj = customRoles[roleKey];
                            const roleName = roleKey === 'admin' ? 'Administradores' : (roleKey === 'member' ? 'Membros' : roleObj?.name);
                            const roleColor = roleObj?.color || '#gray';

                            return (
                                <div key={roleKey} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                                    <div className="p-3 bg-gray-50 border-b border-gray-100 font-semibold text-gray-700 flex justify-between items-center">
                                        <span className="flex items-center gap-2">
                                            {roleKey !== 'admin' && roleKey !== 'member' && <div className="w-3 h-3 rounded-full" style={{backgroundColor: roleColor}}></div>}
                                            {roleName} 
                                            <span className="text-xs font-normal text-gray-400 bg-white border px-1.5 rounded-full">{roleMembers.length}</span>
                                        </span>
                                        <div className="flex gap-3 items-center">
                                            {isAdmin && (
                                                <div className="icon-user-plus text-gray-400 cursor-pointer hover:text-green-500 text-sm mr-2" title="Adicionar Pessoa neste Cargo" onClick={async () => {
                                                    const id = prompt(`Digite o ID para adicionar diretamente como ${roleName}:`);
                                                    if(id && db) {
                                                        await db.ref(`groups/${activeChat.id}/members/${id}`).set(roleKey);
                                                        await db.ref(`users/${id}/contacts/${activeChat.id}`).set({ type: 'group', joinedAt: Date.now() });
                                                        alert("Adicionado!");
                                                    }
                                                }}></div>
                                            )}
                                            {isAdmin && roleKey !== 'admin' && roleKey !== 'member' && (
                                                <>
                                                    <div className="icon-pencil text-gray-400 cursor-pointer hover:text-blue-500 text-sm" onClick={() => editRole(roleKey, roleName)} title="Editar Cargo"></div>
                                                    <div className="icon-trash text-red-400 cursor-pointer hover:text-red-600 text-sm" onClick={() => deleteRole(roleKey)} title="Excluir Cargo"></div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {roleMembers.map(m => (
                                            <div key={m.id} className="p-3 flex items-center justify-between hover:bg-gray-50 group/member">
                                                <div className="flex items-center gap-3">
                                                    <img src={m.avatar} className="w-10 h-10 rounded-full object-cover" />
                                                    <div>
                                                        <p className="font-medium text-gray-800 flex items-center gap-2">
                                                            {m.name || m.id}
                                                            {m.id === user.id && <span className="text-xs bg-[#00a884] text-white px-1 rounded">Você</span>}
                                                        </p>
                                                        <p className="text-xs text-gray-500">{m.privacy?.publicId !== false ? `ID: ${m.id}` : ''}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {isAdmin && m.id !== user.id && (
                                                        <div className="relative group/menu">
                                                            <button className="text-gray-400 hover:text-gray-600 p-1"><div className="icon-more-vertical"></div></button>
                                                            <div className="absolute right-0 top-8 hidden group-hover/menu:block bg-white shadow-xl border rounded z-10 w-52 py-1">
                                                                <div className="px-3 py-1 text-xs text-gray-400 uppercase font-bold tracking-wider">Mudar Cargo</div>
                                                                {roleKey !== 'admin' && <button onClick={() => assignRole(m.id, 'admin')} className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm font-bold text-green-600">Promover a Admin</button>}
                                                                {roleKey === 'admin' && m.id !== user.id && <button onClick={() => { if(confirm("Remover cargo de Admin deste usuário?")) assignRole(m.id, 'member'); }} className="block w-full text-left px-4 py-2 hover:bg-red-50 text-sm text-red-600 font-bold">Remover de Admin</button>}
                                                                {roleKey !== 'member' && roleKey !== 'admin' && <button onClick={() => assignRole(m.id, 'member')} className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm">Rebaixar a Membro</button>}
                                                                <div className="border-t my-1"></div>
                                                                <button onClick={() => kickUser(m.id, m.name)} className="block w-full text-left px-4 py-2 hover:bg-orange-50 text-sm text-orange-600">Expulsar do Grupo</button>
                                                                <button onClick={() => banUser(m.id, m.name)} className="block w-full text-left px-4 py-2 hover:bg-red-50 text-sm text-red-600 font-bold">🚫 Banir (apaga mensagens)</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {roleMembers.length === 0 && <div className="p-4 text-center text-sm text-gray-400 italic">Nenhum usuário neste cargo.</div>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}