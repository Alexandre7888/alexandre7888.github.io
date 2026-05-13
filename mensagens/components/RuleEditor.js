function RuleEditor({ activeChat, onClose }) {
    const [scripts, setScripts] = React.useState({});
    const [selectedScriptId, setSelectedScriptId] = React.useState(null);
    const [code, setCode] = React.useState("");
    const [name, setName] = React.useState("");

    React.useEffect(() => {
        const rulesRef = window.firebaseDB.ref(`groups/${activeChat.id}/scripts`);
        rulesRef.on('value', snap => {
            setScripts(snap.val() || {});
        });
        return () => rulesRef.off();
    }, [activeChat.id]);

    const handleSave = () => {
        if (!name) return alert("Dê um nome para a regra.");
        const id = selectedScriptId || 'rule_' + Date.now();
        
        window.firebaseDB.ref(`groups/${activeChat.id}/scripts/${id}`).set({
            name: name,
            code: code,
            active: true,
            updatedAt: Date.now()
        });
        
        setSelectedScriptId(null);
        setName("");
        setCode("");
        alert("Regra salva!");
    };

    const loadScript = (id) => {
        const s = scripts[id];
        setSelectedScriptId(id);
        setName(s.name);
        setCode(s.code);
    };

    const deleteScript = (id) => {
        if(confirm("Apagar regra?")) {
            window.firebaseDB.ref(`groups/${activeChat.id}/scripts/${id}`).remove();
            if (selectedScriptId === id) {
                setSelectedScriptId(null);
                setName("");
                setCode("");
            }
        }
    };

    return (
        <div className="absolute inset-0 bg-white z-30 flex flex-col animate-slide-in-right">
            <div className="bg-gray-800 text-white p-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onClose}><div className="icon-arrow-left"></div></button>
                    <h2 className="font-mono font-bold text-green-400">{'<Editor de Regras />'}</h2>
                </div>
                <button onClick={() => window.open('https://github.com/Alexandre7888/CodeHUB/blob/main/mensagens/api-rule.md', '_blank')} className="text-xs bg-gray-700 px-2 py-1 rounded hover:bg-gray-600">
                    Docs da API
                </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar List */}
                <div className="w-1/3 border-r border-gray-200 bg-gray-50 flex flex-col">
                    <div className="p-2 border-b">
                        <button 
                            onClick={() => { setSelectedScriptId(null); setName(""); setCode(""); }}
                            className="w-full bg-[#00a884] text-white py-2 rounded shadow hover:bg-[#008f6f]"
                        >
                            + Nova Regra
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {Object.entries(scripts).map(([id, script]) => (
                            <div 
                                key={id} 
                                onClick={() => loadScript(id)}
                                className={`p-3 border-b cursor-pointer hover:bg-gray-100 ${selectedScriptId === id ? 'bg-white border-l-4 border-l-[#00a884]' : ''}`}
                            >
                                <div className="font-bold text-sm text-gray-700">{script.name}</div>
                                <div className="text-xs text-gray-400 font-mono truncate">{script.code.substring(0, 30)}...</div>
                                <div className="flex justify-end mt-1">
                                    <div className="icon-trash text-red-400 hover:text-red-600 text-xs p-1" onClick={(e) => { e.stopPropagation(); deleteScript(id); }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Editor Area */}
                <div className="flex-1 flex flex-col bg-[#1e1e1e]">
                    <div className="p-2 bg-gray-700 flex gap-2">
                        <input 
                            type="text" 
                            placeholder="Nome da Regra (ex: Filtro Anti-Spam)" 
                            className="flex-1 bg-gray-600 text-white px-3 py-1 rounded outline-none border border-transparent focus:border-green-500"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <button onClick={handleSave} className="bg-green-600 text-white px-4 rounded hover:bg-green-500 font-bold text-sm">
                            SALVAR
                        </button>
                    </div>
                    <textarea 
                        className="flex-1 w-full bg-[#1e1e1e] text-[#d4d4d4] p-4 font-mono text-sm outline-none resize-none"
                        spellCheck="false"
                        placeholder="// Escreva seu JavaScript aqui...
// Exemplo:
// if (message.text.includes('spam')) {
//    chat.deleteMessage(message.id);
// }"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                    ></textarea>
                    <div className="bg-gray-800 text-gray-400 text-xs p-2 font-mono border-t border-gray-700">
                        Variáveis globais: message, member, chat
                    </div>
                </div>
            </div>
        </div>
    );
}