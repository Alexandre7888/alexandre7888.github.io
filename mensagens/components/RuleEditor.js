// components/RuleEditor.js
function RuleEditor({ activeChat, user, onClose }) {
    const [scripts, setScripts] = React.useState({});
    const [selectedScriptId, setSelectedScriptId] = React.useState(null);
    const [code, setCode] = React.useState("");
    const [name, setName] = React.useState("");
    const [description, setDescription] = React.useState("");
    const [isActive, setIsActive] = React.useState(true);
    const [triggerType, setTriggerType] = React.useState('onMessage');
    const [executionDelay, setExecutionDelay] = React.useState(0);
    const [cooldown, setCooldown] = React.useState(0);
    const [showApiDocs, setShowApiDocs] = React.useState(false);
    const [testResult, setTestResult] = React.useState(null);
    const [testInput, setTestInput] = React.useState("");
    const [saving, setSaving] = React.useState(false);
    const [loading, setLoading] = React.useState(true);

    const db = window.firebaseDB;

    // Templates sem template strings problemáticas
    const templates = [
        { name: "🚫 Anti-Spam", code: "const messageCount = chat.getUserMessageCount(member.id, 60000);\nif (messageCount > 5) {\n    chat.warnUser(member.id, 'Evite spam!');\n    chat.deleteMessage(message.id);\n}" },
        { name: "👋 Boas-vindas", code: "if (message.text.includes('oi') || message.text.includes('olá')) {\n    chat.sendMessage('👋 Bem-vindo(a) ao grupo, ' + member.name + '!');\n}" },
        { name: "🔞 Filtro", code: "const blockedWords = ['palavrao1', 'palavrao2'];\nfor (let word of blockedWords) {\n    if (message.text.toLowerCase().includes(word)) {\n        chat.deleteMessage(message.id);\n        chat.warnUser(member.id, 'Linguagem inadequada!');\n        break;\n    }\n}" },
        { name: "📢 Auto-Responder", code: "const faq = { 'horario': 'Funcionamos das 9h as 18h', 'preco': 'Consulte nosso site' };\nfor (let key in faq) {\n    if (message.text.toLowerCase().includes(key)) {\n        chat.sendMessage(faq[key]);\n        break;\n    }\n}" },
        { name: "🎮 Comandos", code: "if (message.text.startsWith('!regras')) {\n    chat.sendMessage('Regras do grupo: 1. Respeito 2. Sem spam');\n}\nif (message.text.startsWith('!ajuda')) {\n    chat.sendMessage('Comandos: !regras, !info');\n}" }
    ];

    // Carregar scripts
    React.useEffect(() => {
        if (!activeChat || !db) {
            setLoading(false);
            return;
        }
        
        const rulesRef = db.ref(`groups/${activeChat.id}/scripts`);
        
        const handleData = (snapshot) => {
            const data = snapshot.val();
            setScripts(data || {});
            setLoading(false);
        };
        
        rulesRef.on('value', handleData);
        
        return () => {
            rulesRef.off('value', handleData);
        };
    }, [activeChat, db]);

    // Salvar regra
    const handleSave = async () => {
        if (!name.trim()) {
            alert("Digite um nome para a regra!");
            return;
        }
        
        if (!code.trim()) {
            alert("Digite o código da regra!");
            return;
        }
        
        setSaving(true);
        
        try {
            const id = selectedScriptId || 'rule_' + Date.now();
            const scriptRef = db.ref(`groups/${activeChat.id}/scripts/${id}`);
            
            await scriptRef.set({
                name: name,
                description: description || "",
                code: code,
                active: isActive,
                triggerType: triggerType,
                executionDelay: executionDelay,
                cooldown: cooldown,
                createdBy: user?.id || "unknown",
                createdByName: user?.name || "unknown",
                createdAt: Date.now(),
                updatedAt: Date.now(),
                executionCount: 0
            });
            
            // Limpar formulário
            setSelectedScriptId(null);
            setName("");
            setDescription("");
            setCode("");
            setIsActive(true);
            setTriggerType('onMessage');
            setExecutionDelay(0);
            setCooldown(0);
            
            alert("Regra salva com sucesso!");
            
        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Erro ao salvar regra: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    // Carregar regra para edição
    const loadScript = (id) => {
        const script = scripts[id];
        if (!script) return;
        
        setSelectedScriptId(id);
        setName(script.name || "");
        setDescription(script.description || "");
        setCode(script.code || "");
        setIsActive(script.active !== false);
        setTriggerType(script.triggerType || 'onMessage');
        setExecutionDelay(script.executionDelay || 0);
        setCooldown(script.cooldown || 0);
    };

    // Excluir regra
    const deleteScript = async (id) => {
        if (!confirm("Tem certeza que deseja excluir esta regra permanentemente?")) {
            return;
        }
        
        try {
            await db.ref(`groups/${activeChat.id}/scripts/${id}`).remove();
            
            if (selectedScriptId === id) {
                setSelectedScriptId(null);
                setName("");
                setDescription("");
                setCode("");
            }
            
            alert("Regra excluída com sucesso!");
            
        } catch (error) {
            console.error("Erro ao excluir:", error);
            alert("Erro ao excluir regra!");
        }
    };

    // Ativar/Desativar regra
    const toggleScriptActive = async (id, currentActive) => {
        try {
            await db.ref(`groups/${activeChat.id}/scripts/${id}/active`).set(!currentActive);
        } catch (error) {
            console.error("Erro ao alterar status:", error);
            alert("Erro ao alterar status da regra!");
        }
    };

    // Carregar template
    const loadTemplate = (template) => {
        setName(template.name);
        setCode(template.code);
        setDescription(`Template: ${template.name}`);
    };

    // Testar script
    const testScript = () => {
        if (!code.trim()) {
            setTestResult({ success: false, message: "Digite um código para testar!" });
            setTimeout(() => setTestResult(null), 3000);
            return;
        }
        
        try {
            // Criar funções mock para teste
            const mockChat = {
                sendMessage: (text) => console.log("[TEST] sendMessage:", text),
                deleteMessage: (id) => console.log("[TEST] deleteMessage:", id),
                warnUser: (id, reason) => console.log("[TEST] warnUser:", id, reason),
                kickMember: (id) => console.log("[TEST] kickMember:", id),
                muteMember: (id, duration) => console.log("[TEST] muteMember:", id, duration),
                banMember: (id) => console.log("[TEST] banMember:", id),
                sendMessageToAdmin: (text) => console.log("[TEST] sendMessageToAdmin:", text),
                logActivity: (userId, action) => console.log("[TEST] logActivity:", userId, action),
                getUserMessageCount: (userId, timeWindow) => 3
            };
            
            const mockMessage = {
                text: testInput || "mensagem de teste",
                senderId: "test_user",
                senderName: "Testador",
                id: "test_msg_123"
            };
            
            const mockMember = {
                id: user?.id || "test_user",
                name: user?.name || "Testador",
                role: "member"
            };
            
            // Executar código
            const asyncEval = new Function('message', 'member', 'chat', code);
            asyncEval(mockMessage, mockMember, mockChat);
            
            setTestResult({ success: true, message: "✅ Script executado sem erros! Verifique o console." });
            
        } catch (error) {
            setTestResult({ success: false, message: `❌ Erro: ${error.message}` });
        }
        
        setTimeout(() => setTestResult(null), 5000);
    };

    // Nova regra
    const newRule = () => {
        setSelectedScriptId(null);
        setName("");
        setDescription("");
        setCode("");
        setIsActive(true);
        setTriggerType('onMessage');
        setExecutionDelay(0);
        setCooldown(0);
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-white z-30 flex flex-col animate-slide-in-right">
                <div className="bg-gray-800 text-white p-4 flex items-center gap-3">
                    <button onClick={onClose} className="hover:bg-gray-700 p-1 rounded">
                        <div className="icon-arrow-left"></div>
                    </button>
                    <h2 className="font-mono font-bold text-green-400">Editor de Regras</h2>
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <div className="icon-loader animate-spin text-3xl text-[#00a884]"></div>
                    <span className="ml-2 text-gray-500">Carregando...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-white z-30 flex flex-col animate-slide-in-right">
            {/* Header */}
            <div className="bg-gray-800 text-white p-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="hover:bg-gray-700 p-1 rounded">
                        <div className="icon-arrow-left"></div>
                    </button>
                    <h2 className="font-mono font-bold text-green-400">Editor de Regras Avançado</h2>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowApiDocs(!showApiDocs)} className="text-xs bg-blue-600 px-3 py-1 rounded hover:bg-blue-500">
                        📚 API Docs
                    </button>
                </div>
            </div>

            {/* API Docs Modal */}
            {showApiDocs && (
                <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                        <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white">
                            <h3 className="text-xl font-bold text-gray-800">📖 API de Regras</h3>
                            <button onClick={() => setShowApiDocs(false)} className="text-gray-500 hover:text-gray-700">
                                <div className="icon-x text-xl"></div>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-gray-100 p-3 rounded-lg">
                                <h4 className="font-bold text-green-600 mb-2">📌 Variáveis Disponíveis</h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div><code className="bg-gray-200 px-1 rounded">message.text</code> - Texto da mensagem</div>
                                    <div><code className="bg-gray-200 px-1 rounded">message.senderId</code> - ID do remetente</div>
                                    <div><code className="bg-gray-200 px-1 rounded">message.senderName</code> - Nome do remetente</div>
                                    <div><code className="bg-gray-200 px-1 rounded">message.id</code> - ID da mensagem</div>
                                    <div><code className="bg-gray-200 px-1 rounded">member.id</code> - ID do membro</div>
                                    <div><code className="bg-gray-200 px-1 rounded">member.name</code> - Nome do membro</div>
                                    <div><code className="bg-gray-200 px-1 rounded">member.role</code> - Cargo (admin/member)</div>
                                    <div><code className="bg-gray-200 px-1 rounded">chat.id</code> - ID do grupo</div>
                                    <div><code className="bg-gray-200 px-1 rounded">chat.name</code> - Nome do grupo</div>
                                </div>
                            </div>
                            <div className="bg-gray-100 p-3 rounded-lg">
                                <h4 className="font-bold text-blue-600 mb-2">⚙️ Funções Disponíveis</h4>
                                <div className="space-y-2 text-sm">
                                    <div><code className="bg-gray-200 px-1 rounded">chat.sendMessage(text)</code> - Envia mensagem no grupo</div>
                                    <div><code className="bg-gray-200 px-1 rounded">chat.deleteMessage(msgId)</code> - Apaga mensagem</div>
                                    <div><code className="bg-gray-200 px-1 rounded">chat.warnUser(userId, reason)</code> - Adverte usuário</div>
                                    <div><code className="bg-gray-200 px-1 rounded">chat.kickMember(userId)</code> - Expulsa membro</div>
                                    <div><code className="bg-gray-200 px-1 rounded">chat.banMember(userId)</code> - Bane membro</div>
                                    <div><code className="bg-gray-200 px-1 rounded">chat.sendMessageToAdmin(text)</code> - Envia para admins</div>
                                    <div><code className="bg-gray-200 px-1 rounded">chat.logActivity(userId, action)</code> - Registra log</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar List */}
                <div className="w-80 border-r border-gray-200 bg-gray-50 flex flex-col">
                    <div className="p-3 border-b space-y-2">
                        <button 
                            onClick={newRule}
                            className="w-full bg-[#00a884] text-white py-2 rounded-lg shadow hover:bg-[#008f6f] transition flex items-center justify-center gap-2"
                        >
                            <div className="icon-plus"></div> Nova Regra
                        </button>
                        
                        <details className="text-sm">
                            <summary className="cursor-pointer text-gray-600 hover:text-gray-800 p-2 rounded-lg bg-gray-100">📋 Templates Prontos</summary>
                            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                                {templates.map((t, i) => (
                                    <button 
                                        key={i}
                                        onClick={() => loadTemplate(t)}
                                        className="w-full text-left p-2 text-xs hover:bg-gray-200 rounded flex items-center gap-2"
                                    >
                                        {t.name}
                                    </button>
                                ))}
                            </div>
                        </details>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto">
                        <div className="p-2 text-xs text-gray-400 font-semibold uppercase">Minhas Regras ({Object.keys(scripts).length})</div>
                        {Object.entries(scripts).map(([id, script]) => (
                            <div 
                                key={id} 
                                className={`p-3 border-b cursor-pointer hover:bg-gray-100 transition ${selectedScriptId === id ? 'bg-white border-l-4 border-l-[#00a884]' : ''}`}
                                onClick={() => loadScript(id)}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="font-bold text-sm text-gray-800 flex items-center gap-2">
                                            {script.name}
                                            <span className={`text-xs px-1.5 py-0.5 rounded ${script.active ? 'bg-green-100 text-green-700' : 'bg-gray-300 text-gray-600'}`}>
                                                {script.active ? 'Ativa' : 'Inativa'}
                                            </span>
                                        </div>
                                        {script.description && <div className="text-xs text-gray-500 mt-0.5 truncate">{script.description}</div>}
                                        <div className="text-xs text-gray-400 font-mono truncate mt-1">{script.code?.substring(0, 40)}...</div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); toggleScriptActive(id, script.active); }}
                                            className={`p-1 rounded ${script.active ? 'text-green-500 hover:text-green-700' : 'text-gray-400 hover:text-gray-600'}`}
                                            title={script.active ? 'Desativar' : 'Ativar'}
                                        >
                                            <div className={script.active ? "icon-toggle-right" : "icon-toggle-left"}></div>
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); deleteScript(id); }}
                                            className="p-1 text-red-400 hover:text-red-600 rounded"
                                            title="Excluir"
                                        >
                                            <div className="icon-trash text-sm"></div>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {Object.keys(scripts).length === 0 && (
                            <div className="p-8 text-center text-gray-400 text-sm">
                                <div className="icon-code text-4xl mb-2 opacity-30"></div>
                                Nenhuma regra criada.<br/>Clique em "+ Nova Regra" para começar!
                            </div>
                        )}
                    </div>
                </div>

                {/* Editor Area */}
                <div className="flex-1 flex flex-col bg-[#1e1e1e]">
                    <div className="p-3 bg-gray-700 flex flex-wrap gap-3 items-center">
                        <input 
                            type="text" 
                            placeholder="Nome da Regra" 
                            className="flex-1 min-w-[200px] bg-gray-600 text-white px-3 py-2 rounded-lg outline-none border border-transparent focus:border-green-500"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <input 
                            type="text" 
                            placeholder="Descrição (opcional)" 
                            className="flex-1 min-w-[200px] bg-gray-600 text-white px-3 py-2 rounded-lg outline-none border border-transparent focus:border-green-500"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                        <select 
                            value={triggerType}
                            onChange={(e) => setTriggerType(e.target.value)}
                            className="bg-gray-600 text-white px-3 py-2 rounded-lg outline-none"
                        >
                            <option value="onMessage">📨 Ao receber mensagem</option>
                            <option value="onMemberJoin">👤 Quando membro entra</option>
                            <option value="onMemberLeave">🚪 Quando membro sai</option>
                        </select>
                        <label className="flex items-center gap-2 text-white text-sm">
                            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4" />
                            Regra Ativa
                        </label>
                    </div>
                    
                    <div className="p-2 bg-gray-700 border-t border-gray-600 flex gap-2 flex-wrap">
                        <div className="flex items-center gap-2 text-white text-sm">
                            <span>⏱️ Delay:</span>
                            <input type="number" value={executionDelay} onChange={(e) => setExecutionDelay(parseInt(e.target.value) || 0)} className="w-20 bg-gray-600 text-white px-2 py-1 rounded" />
                            <span>ms</span>
                        </div>
                        <div className="flex-1"></div>
                        <button onClick={testScript} className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-500 flex items-center gap-1">
                            <div className="icon-play"></div> Testar
                        </button>
                        <button onClick={handleSave} disabled={saving} className="bg-green-600 text-white px-4 py-1 rounded font-bold text-sm hover:bg-green-500 flex items-center gap-1 disabled:opacity-50">
                            <div className="icon-save"></div> {saving ? 'Salvando...' : 'SALVAR'}
                        </button>
                    </div>
                    
                    {testResult && (
                        <div className={`mx-3 mt-2 p-2 rounded text-sm ${testResult.success ? 'bg-green-800 text-green-200' : 'bg-red-800 text-red-200'}`}>
                            {testResult.message}
                        </div>
                    )}
                    
                    {/* Área de Teste Rápido */}
                    <div className="mx-3 mt-2 p-2 bg-gray-800 rounded flex gap-2 items-center">
                        <span className="text-white text-xs">🧪 Testar com:</span>
                        <input 
                            type="text" 
                            value={testInput} 
                            onChange={(e) => setTestInput(e.target.value)}
                            placeholder="Mensagem de teste" 
                            className="flex-1 bg-gray-700 text-white px-2 py-1 rounded text-sm outline-none"
                        />
                        <button onClick={() => setTestInput("")} className="text-gray-400 text-xs">Limpar</button>
                    </div>
                    
                    <textarea 
                        className="flex-1 w-full bg-[#1e1e1e] text-[#d4d4d4] p-4 font-mono text-sm outline-none resize-none"
                        spellCheck="false"
                        placeholder="// Escreva seu código JavaScript aqui...
// Exemplo:
// if (message.text.includes('spam')) {
//    chat.warnUser(member.id, 'Evite spam!');
//    chat.deleteMessage(message.id);
// }"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                    ></textarea>
                    
                    <div className="bg-gray-800 text-gray-400 text-xs p-2 font-mono border-t border-gray-700 flex justify-between">
                        <div>
                            📌 Variáveis: <code className="bg-gray-700 px-1 rounded">message</code>, <code className="bg-gray-700 px-1 rounded">member</code>, <code className="bg-gray-700 px-1 rounded">chat</code>
                        </div>
                        <div>
                            ⚡ Funções: <code className="bg-gray-700 px-1 rounded">sendMessage()</code>, <code className="bg-gray-700 px-1 rounded">deleteMessage()</code>, <code className="bg-gray-700 px-1 rounded">warnUser()</code>, <code className="bg-gray-700 px-1 rounded">kickMember()</code>, <code className="bg-gray-700 px-1 rounded">banMember()</code>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
