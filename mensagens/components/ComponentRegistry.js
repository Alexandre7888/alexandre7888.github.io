// components/ComponentRegistry.js
(function() {
    // Registro global de componentes
    window.AppComponents = window.AppComponents || {};
    window.ComponentRegistry = window.ComponentRegistry || new Map();
    
    // Container para componentes auto-renderizados
    window.AutoComponents = window.AutoComponents || {
        sidebarTop: [],     // componentes no topo da sidebar
        sidebarBottom: [],  // componentes no fim da sidebar
        headerLeft: [],     // componentes no header esquerdo
        headerRight: [],    // componentes no header direito (ao lado dos botões)
        chatHeader: [],     // componentes no header do chat
        chatFooter: [],     // componentes no footer do chat (acima do input)
        floating: []        // componentes flutuantes
    };
    
    // Função para registrar componentes
    window.registerComponent = function(name, component, autoPlace = null, position = null) {
        window.AppComponents[name] = component;
        window.ComponentRegistry.set(name, component);
        
        // Se especificou um local automático, adiciona na lista
        if (autoPlace && window.AutoComponents[autoPlace]) {
            window.AutoComponents[autoPlace].push({ 
                name, 
                component,
                position: position || 0
            });
            // Ordena por posição
            window.AutoComponents[autoPlace].sort((a, b) => (a.position || 0) - (b.position || 0));
        }
        
        console.log(`✅ Componente registrado: ${name} ${autoPlace ? `(auto: ${autoPlace})` : ''}`);
    };
    
    // Função para renderizar componentes automáticos
    window.renderAutoComponents = function(place, props = {}) {
        const components = window.AutoComponents[place] || [];
        if (!components.length) return null;
        
        return React.createElement(React.Fragment, null,
            components.map((comp, idx) => 
                React.createElement(comp.component, { key: `${comp.name}_${idx}`, ...props })
            )
        );
    };
    
    // Função para verificar se tem componentes em um local
    window.hasAutoComponents = function(place) {
        return (window.AutoComponents[place] || []).length > 0;
    };
    
    // Componente StatusIndicator padrão
    function StatusIndicator({ isOnline, showText = true, size = 'small' }) {
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
    
    window.registerComponent('StatusIndicator', StatusIndicator);
    
    console.log("✅ ComponentRegistry inicializado!");
})();