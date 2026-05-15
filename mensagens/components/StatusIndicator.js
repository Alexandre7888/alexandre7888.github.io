// components/StatusIndicator.js
function StatusIndicator({ isOnline, showText = true, size = 'small' }) {
    const sizeClasses = {
        small: 'w-2 h-2',
        medium: 'w-3 h-3',
        large: 'w-4 h-4'
    };
    
    return (
        <div className="flex items-center gap-1.5">
            <div className={`${sizeClasses[size]} rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'} ring-2 ring-white`}></div>
            {showText && (
                <span className="text-xs text-gray-500">
                    {isOnline ? 'Online' : 'Offline'}
                </span>
            )}
        </div>
    );
}

// Se precisar usar em outro lugar, exporta (mas como está sem módulo, usa global)
window.StatusIndicator = StatusIndicator;