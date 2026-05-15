// components/ContactStatusBadge.js
(function() {
    function ContactStatusBadge({ contact, user }) {
        const [status, setStatus] = React.useState({
            state: 'offline',
            lastChanged: null,
            lastSeen: null
        });
        
        const db = window.firebaseDB;
        
        React.useEffect(() => {
            if (!contact || contact.type === 'group') return;
            
            // Busca status do contato no Firebase
            const statusRef = db.ref(`users/${contact.id}/status`);
            const userRef = db.ref(`users/${contact.id}`);
            
            const handleStatus = (snap) => {
                const statusData = snap.val();
                if (statusData) {
                    setStatus(prev => ({
                        ...prev,
                        state: statusData.state || 'offline',
                        lastChanged: statusData.lastChanged
                    }));
                }
            };
            
            // Busca também o lastSeen
            const handleUser = (snap) => {
                const userData = snap.val();
                if (userData && userData.lastActive) {
                    setStatus(prev => ({
                        ...prev,
                        lastSeen: userData.lastActive
                    }));
                }
            };
            
            statusRef.on('value', handleStatus);
            userRef.on('value', handleUser);
            
            return () => {
                statusRef.off('value', handleStatus);
                userRef.off('value', handleUser);
            };
        }, [contact?.id]);
        
        // Formata o último visto
        const formatLastSeen = (timestamp) => {
            if (!timestamp) return 'nunca visto';
            
            const now = Date.now();
            const diff = now - timestamp;
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);
            
            if (minutes < 1) return 'agora mesmo';
            if (minutes < 60) return `há ${minutes} min`;
            if (hours < 24) return `há ${hours} h`;
            if (days < 7) return `há ${days} d`;
            
            const date = new Date(timestamp);
            return `${date.getDate()}/${date.getMonth() + 1}`;
        };
        
        const isOnline = status.state === 'online';
        const lastSeenText = formatLastSeen(status.lastSeen || status.lastChanged);
        
        // Se for grupo, mostra apenas ícone de grupo
        if (contact.type === 'group') {
            return React.createElement('div', { className: 'flex items-center gap-1 mt-0.5' },
                React.createElement('div', { className: 'icon-users text-gray-400 text-xs' }),
                React.createElement('span', { className: 'text-xs text-gray-400' }, 'Grupo')
            );
        }
        
        return React.createElement('div', { className: 'flex items-center gap-1.5 mt-0.5' },
            // Indicador de status (bolinha colorida)
            React.createElement('div', {
                className: `w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`,
                title: isOnline ? 'Online' : 'Offline'
            }),
            
            // Texto de status
            React.createElement('span', {
                className: `text-xs ${isOnline ? 'text-green-600 font-medium' : 'text-gray-400'}`
            }, isOnline ? 'Online' : `Último visto ${lastSeenText}`)
        );
    }
    
    // Registra o componente
    window.registerComponent('ContactStatusBadge', ContactStatusBadge, null);
    
    console.log('✅ ContactStatusBadge registrado!');
})();