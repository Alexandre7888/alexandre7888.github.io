// components/StatusBadge.js
(function() {
    function StatusBadge({ isOnline, showText = true, size = 'small' }) {
        const sizeClasses = {
            small: 'w-2 h-2',
            medium: 'w-3 h-3',
            large: 'w-4 h-4'
        };
        
        return React.createElement('div', { className: 'flex items-center gap-1.5' },
            React.createElement('div', { 
                className: `${sizeClasses[size]} rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'} ring-2 ring-white` 
            }),
            showText && React.createElement('span', { className: 'text-xs text-gray-500' }, 
                isOnline ? 'Online' : 'Offline'
            )
        );
    }
    
    // Registra globalmente
    window.registerComponent('StatusBadge', StatusBadge);
})();