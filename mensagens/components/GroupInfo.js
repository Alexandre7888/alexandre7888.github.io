{/* Notification Settings Section - NOVA */}
<div className="bg-white rounded-lg shadow-sm border border-gray-100 mb-6 overflow-hidden">
    <div className="p-4 bg-gray-50 border-b border-gray-100 font-semibold text-gray-700 flex justify-between items-center">
        <div className="flex items-center gap-2">
            <div className="icon-bell text-gray-500"></div>
            <span>Notificações do Grupo</span>
        </div>
    </div>
    <div className="p-4 space-y-4">
        <div className="flex justify-between items-center">
            <div>
                <span className="text-sm text-gray-700 block">Silenciar Notificações</span>
                <span className="text-xs text-gray-400">Não receber alertas deste grupo</span>
            </div>
            <button 
                onClick={() => {
                    if (window.NotificationSystem.isBlocked(activeChat.id)) {
                        window.NotificationSystem.removeFromBlacklist(activeChat.id);
                        alert("Notificações reativadas para este grupo!");
                    } else {
                        window.NotificationSystem.addToBlacklist(activeChat.id);
                        alert("Notificações silenciadas para este grupo!");
                    }
                }}
                className={`w-10 h-5 rounded-full p-0.5 transition-colors ${window.NotificationSystem.isBlocked(activeChat.id) ? 'bg-red-500' : 'bg-gray-300'}`}
            >
                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${window.NotificationSystem.isBlocked(activeChat.id) ? 'translate-x-5' : ''}`}></div>
            </button>
        </div>
    </div>
</div>
