// components/ContextMenu.js
(function() {
    function ContextMenu({ items, position, onClose }) {
        if (!position.visible) return null;
        
        return React.createElement('div', {
            className: 'fixed z-50 bg-white rounded-lg shadow-xl py-1 border border-gray-200',
            style: { top: position.y, left: position.x }
        }, 
            items.map((item, idx) => 
                React.createElement('button', {
                    key: idx,
                    onClick: () => { item.action(); onClose(); },
                    className: `w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 ${item.color || 'text-gray-700'}`
                },
                    React.createElement('div', { className: item.icon }),
                    item.label
                )
            )
        );
    }
    
    window.registerComponent('ContextMenu', ContextMenu);
})();