// components/MessageInput.js
(function() {
    function MessageInput({ value, onChange, onSend, onAudioRecord, onFileUpload, placeholder = 'Mensagem' }) {
        return React.createElement('div', { className: 'bg-[#f0f2f5] p-3 px-4 flex items-center gap-2' },
            React.createElement('div', { className: 'icon-smile text-2xl text-gray-500 cursor-pointer' }),
            React.createElement('div', { 
                className: 'icon-image text-2xl text-gray-500 cursor-pointer',
                onClick: () => onFileUpload?.('image')
            }),
            React.createElement('div', { 
                className: 'icon-file text-2xl text-gray-500 cursor-pointer',
                onClick: () => onFileUpload?.('file')
            }),
            React.createElement('div', { className: 'flex-1 bg-white rounded-lg px-4 py-2' },
                React.createElement('input', {
                    type: 'text',
                    value: value,
                    onChange: (e) => onChange(e.target.value),
                    onKeyDown: (e) => e.key === 'Enter' && onSend(),
                    placeholder: placeholder,
                    className: 'w-full bg-transparent border-none outline-none text-gray-700 text-sm'
                })
            ),
            value.trim() ? 
                React.createElement('div', { onClick: onSend, className: 'icon-send text-2xl text-gray-500 cursor-pointer' }) :
                React.createElement('div', { onClick: onAudioRecord, className: 'icon-mic text-2xl text-gray-500 cursor-pointer' })
        );
    }
    
    window.registerComponent('MessageInput', MessageInput);
})(); 