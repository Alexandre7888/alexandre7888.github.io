// components/BlockManager.js
function BlockManager({ currentUser, targetUser, onBlockChange, children }) {
    const [isBlocked, setIsBlocked] = React.useState(false);
    const [isBlockedByThem, setIsBlockedByThem] = React.useState(false);
    const [showReportModal, setShowReportModal] = React.useState(false);
    const [reportReason, setReportReason] = React.useState("");
    const [reporting, setReporting] = React.useState(false);
    const db = window.firebaseDB;

    // Verificar status de bloqueio
    React.useEffect(() => {
        if (!currentUser || !targetUser || !db) return;
        
        const checkBlockStatus = async () => {
            try {
                const [blockedByMeSnap, blockedByThemSnap] = await Promise.all([
                    db.ref(`users/${currentUser.id}/blocked/${targetUser.id}`).once('value'),
                    db.ref(`users/${targetUser.id}/blocked/${currentUser.id}`).once('value')
                ]);
                setIsBlocked(blockedByMeSnap.exists());
                setIsBlockedByThem(blockedByThemSnap.exists());
            } catch(e) {
                console.error("Erro ao verificar bloqueio:", e);
            }
        };
        
        checkBlockStatus();
        
        // Listeners em tempo real
        const blockedByMeRef = db.ref(`users/${currentUser.id}/blocked/${targetUser.id}`);
        const blockedByThemRef = db.ref(`users/${targetUser.id}/blocked/${currentUser.id}`);
        
        blockedByMeRef.on('value', (snap) => setIsBlocked(snap.exists()));
        blockedByThemRef.on('value', (snap) => setIsBlockedByThem(snap.exists()));
        
        return () => {
            blockedByMeRef.off();
            blockedByThemRef.off();
        };
    }, [currentUser, targetUser, db]);

    // Bloquear usuário
    const blockUser = async () => {
        if (!confirm(`Tem certeza que deseja bloquear ${targetUser.name || targetUser.id}?\n\nVocê não receberá mais mensagens dele e ele não poderá te ver online.`)) {
            return;
        }
        
        try {
            await db.ref(`users/${currentUser.id}/blocked/${targetUser.id}`).set({
                blockedAt: Date.now(),
                reason: "Bloqueado pelo usuário"
            });
            
            // Remover dos contatos se existir
            await db.ref(`users/${currentUser.id}/contacts/${targetUser.id}`).remove();
            
            showToastMessage(`${targetUser.name || targetUser.id} foi bloqueado!`, "success");
            if (onBlockChange) onBlockChange(true);
        } catch(e) {
            console.error("Erro ao bloquear:", e);
            showToastMessage("Erro ao bloquear usuário!", "error");
        }
    };
    
    // Desbloquear usuário
    const unblockUser = async () => {
        if (!confirm(`Deseja desbloquear ${targetUser.name || targetUser.id}?`)) {
            return;
        }
        
        try {
            await db.ref(`users/${currentUser.id}/blocked/${targetUser.id}`).remove();
            showToastMessage(`${targetUser.name || targetUser.id} foi desbloqueado!`, "success");
            if (onBlockChange) onBlockChange(false);
        } catch(e) {
            console.error("Erro ao desbloquear:", e);
            showToastMessage("Erro ao desbloquear usuário!", "error");
        }
    };
    
    // Denunciar usuário
    const reportUser = async () => {
        if (!reportReason.trim()) {
            showToastMessage("Por favor, digite um motivo para a denúncia!", "error");
            return;
        }
        
        setReporting(true);
        
        try {
            // Salvar denúncia no Firebase
            await db.ref(`reports/${Date.now()}_${currentUser.id}_${targetUser.id}`).set({
                reportedBy: currentUser.id,
                reportedByName: currentUser.name,
                reportedUser: targetUser.id,
                reportedUserName: targetUser.name || targetUser.id,
                reason: reportReason,
                timestamp: Date.now(),
                status: "pending"
            });
            
            // Também bloquear automaticamente
            await db.ref(`users/${currentUser.id}/blocked/${targetUser.id}`).set({
                blockedAt: Date.now(),
                reason: `Denunciado: ${reportReason.substring(0, 100)}`
            });
            
            await db.ref(`users/${currentUser.id}/contacts/${targetUser.id}`).remove();
            
            showToastMessage("Denúncia enviada! O usuário foi bloqueado.", "success");
            setShowReportModal(false);
            setReportReason("");
            if (onBlockChange) onBlockChange(true);
        } catch(e) {
            console.error("Erro ao denunciar:", e);
            showToastMessage("Erro ao enviar denúncia!", "error");
        } finally {
            setReporting(false);
        }
    };
    
    const showToastMessage = (message, type = "info") => {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm ${type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-gray-800'} animate-fade-in-up`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    };
    
    // Se foi bloqueado pelo outro usuário, mostra mensagem
    if (isBlockedByThem) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center">
                <div className="icon-ban text-6xl text-red-500 mb-4"></div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Usuário Bloqueado</h3>
                <p className="text-gray-500 mb-4">Você foi bloqueado por {targetUser.name || targetUser.id}</p>
                <p className="text-sm text-gray-400">Não é possível interagir com este usuário.</p>
            </div>
        );
    }
    
    // Renderizar children com controles adicionais
    return (
        <>
            {/* Botões de ação */}
            <div className="flex gap-2 mt-2">
                {!isBlocked ? (
                    <>
                        <button 
                            onClick={blockUser}
                            className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 transition flex items-center gap-1"
                            title="Bloquear usuário"
                        >
                            <div className="icon-ban text-xs"></div>
                            <span>Bloquear</span>
                        </button>
                        <button 
                            onClick={() => setShowReportModal(true)}
                            className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 transition flex items-center gap-1"
                            title="Denunciar usuário"
                        >
                            <div className="icon-flag text-xs"></div>
                            <span>Denunciar</span>
                        </button>
                    </>
                ) : (
                    <button 
                        onClick={unblockUser}
                        className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg hover:bg-green-600 transition flex items-center gap-1"
                        title="Desbloquear usuário"
                    >
                        <div className="icon-unlock text-xs"></div>
                        <span>Desbloquear</span>
                    </button>
                )}
            </div>
            
            {/* Modal de Denúncia */}
            {showReportModal && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full animate-fade-in">
                        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                <div className="icon-flag text-orange-500"></div>
                                Denunciar {targetUser.name || targetUser.id}
                            </h3>
                            <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-gray-600">
                                <div className="icon-x text-xl"></div>
                            </button>
                        </div>
                        
                        <div className="p-4">
                            <p className="text-sm text-gray-600 mb-3">
                                Conte-nos o motivo da denúncia. O usuário será bloqueado automaticamente.
                            </p>
                            <textarea
                                value={reportReason}
                                onChange={(e) => setReportReason(e.target.value)}
                                placeholder="Ex: Spam, mensagens ofensivas, assédio, etc..."
                                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:border-red-500 resize-none"
                                rows="4"
                                autoFocus
                            />
                        </div>
                        
                        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
                            <button 
                                onClick={() => setShowReportModal(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={reportUser}
                                disabled={reporting || !reportReason.trim()}
                                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition disabled:opacity-50 flex items-center gap-2"
                            >
                                {reporting ? (
                                    <>
                                        <div className="icon-loader animate-spin text-sm"></div>
                                        Enviando...
                                    </>
                                ) : (
                                    <>
                                        <div className="icon-send text-sm"></div>
                                        Enviar Denúncia
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {children}
        </>
    );
}