function JoinRequestModal({ groupId, user, onClose, onJoinSuccess }) {
    const [groupData, setGroupData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [status, setStatus] = React.useState(null); // 'idle', 'requesting', 'success', 'joined'

    React.useEffect(() => {
        const fetchGroup = async () => {
            try {
                const snap = await window.firebaseDB.ref(`groups/${groupId}`).once('value');
                if (snap.exists()) {
                    const data = snap.val();
                    setGroupData(data);
                    
                    // Check if already member
                    if (data.members && data.members[user.id]) {
                        setStatus('joined');
                    }
                } else {
                    setError("Grupo não encontrado.");
                }
            } catch (e) {
                setError("Erro ao buscar grupo.");
            } finally {
                setLoading(false);
            }
        };
        fetchGroup();
    }, [groupId, user.id]);

    const handleJoin = async () => {
        if (!groupData) return;
        setStatus('requesting');

        // Check settings
        const settings = groupData.settings || {};
        const requireApproval = settings.requireApproval === true;
        const inviteEnabled = settings.inviteLinkEnabled !== false; // Default true if undefined? Let's say default false for safety unless explicitly true. 
        // actually let's assume default true for "openness" if not set, or check implementation.
        
        if (settings.inviteLinkEnabled === false) {
             alert("Este link de convite foi desativado.");
             setStatus('idle');
             return;
        }

        try {
            if (requireApproval) {
                // Add to requests
                await window.firebaseDB.ref(`groups/${groupId}/requests/${user.id}`).set({
                    name: user.name,
                    avatar: user.avatar,
                    timestamp: Date.now()
                });
                setStatus('success'); // Requested
            } else {
                // Join directly
                await window.firebaseDB.ref(`groups/${groupId}/members/${user.id}`).set('member');
                await window.firebaseDB.ref(`users/${user.id}/contacts/${groupId}`).set({ type: 'group', joinedAt: Date.now() });
                onJoinSuccess(groupData);
            }
        } catch (e) {
            console.error(e);
            alert("Erro ao entrar.");
            setStatus('idle');
        }
    };

    if (!groupId) return null;

    return (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-fade-in text-center">
                {loading ? (
                    <div className="icon-loader animate-spin text-2xl text-gray-500"></div>
                ) : error ? (
                    <div>
                        <div className="icon-circle-alert text-red-500 text-4xl mb-2 mx-auto"></div>
                        <p className="text-gray-800">{error}</p>
                        <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Fechar</button>
                    </div>
                ) : (
                    <>
                        <img src={groupData.avatar} className="w-20 h-20 rounded-full mx-auto mb-4 object-cover shadow" />
                        <h2 className="text-xl font-bold text-gray-800">{groupData.name}</h2>
                        <p className="text-sm text-gray-500 mb-6">
                            {Object.keys(groupData.members || {}).length} participantes
                        </p>

                        {status === 'joined' ? (
                            <div className="text-green-600 font-medium mb-4">Você já é membro deste grupo.</div>
                        ) : status === 'success' ? (
                            <div className="bg-green-50 text-green-700 p-3 rounded mb-4">
                                <div className="icon-circle-check inline-block mr-2"></div>
                                Solicitação enviada! Aguarde a aprovação de um administrador.
                            </div>
                        ) : (
                            <div className="mb-4 text-gray-600 text-sm">
                                {groupData.settings?.requireApproval 
                                    ? "Este grupo requer aprovação para entrar." 
                                    : "Você está entrando via link de convite."}
                            </div>
                        )}

                        <div className="flex gap-2 justify-center">
                            <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">
                                {status === 'joined' || status === 'success' ? 'Fechar' : 'Cancelar'}
                            </button>
                            
                            {status !== 'joined' && status !== 'success' && (
                                <button 
                                    onClick={handleJoin} 
                                    disabled={status === 'requesting'}
                                    className="px-6 py-2 bg-[#00a884] text-white rounded hover:bg-[#008f6f] flex items-center gap-2"
                                >
                                    {status === 'requesting' && <div className="icon-loader animate-spin"></div>}
                                    {groupData.settings?.requireApproval ? 'Pedir para Entrar' : 'Entrar no Grupo'}
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}