// components/RuleEditor.js
function RuleEditor({ activeChat, user, onClose }) {
    const [scripts, setScripts] = React.useState({});
    const [selectedScriptId, setSelectedScriptId] = React.useState(null);
    const [code, setCode] = React.useState("");
    const [name, setName] = React.useState("");
    const [description, setDescription] = React.useState("");
    const [isActive, setIsActive] = React.useState(true);
    const [triggerType, setTriggerType] = React.useState('onMessage'); // onMessage, onMemberJoin, onMemberLeave, onCall
    const [executionDelay, setExecutionDelay] = React.useState(0);
    const [cooldown, setCooldown] = React.useState(0);
    const [actionType, setActionType] = React.useState('javascript');
    const [showApiDocs, setShowApiDocs] = React.useState(false);
    const [testResult, setTestResult] = React.useState(null);
    const [testInput, setTestInput] = React.useState("");
    const [variables, setVariables] = React.useState({
        message: { text: "", senderId: "", senderName: "" },
        member: { id: "", name: "", role: "" },
        chat: { id: "", name: "" }
    });
    const [templates, setTemplates] = React.useState([
        { name: "🚫 Anti-Spam", code: `// Bloqueia mensagens repetidas
const messageCount = chat.getUserMessageCount(member.id, 60000);
if (messageCount > 5) {
    chat.warnUser(member.id, "Evite spam!");
    chat.deleteMessage(message.id);
}` },
        { name: "👋 Boas-vindas", code: `// Envia mensagem de boas-vindas
if (message.text.includes("oi") || message.text.includes("olá")) {
    chat.sendMessage("👋 Bem-vindo(a) ao grupo, " + member.name + "!");
}` },
        { name: "🔞 Filtro de Palavrões", code: `// Lista de palavras proibidas
const blockedWords = ["palavrao1", "palavrao2", "xingamento"];
for (let word of blockedWords) {
    if (message.text.toLowerCase().includes(word)) {
        chat.deleteMessage(message.id);
        chat.warnUser(member.id, "Linguagem inadequada detectada!");
        break;
    }
}` },
        { name: "📢 Auto-Responder", code: `// Responde automaticamente a perguntas comuns
const faq = {
    "horario": "Funcionamos das 9h às 18h",
    "preco": "Consulte nosso site para valores",
    "contato": "Envie uma mensagem privada para o admin"
};
for (let key in faq) {
    if (message.text.toLowerCase().includes(key)) {
        chat.sendMessage(faq[key]);
        break;
    }
}` },
        { name: "🎮 Comandos Personalizados", code: `// Comandos como !regras, !ajuda
if (message.text.startsWith("!regras")) {
    chat.sendMessage("📜 1. Respeito acima de tudo\\n2. Sem spam\\n3. Conteúdo apropriado");
}
if (message.text.startsWith("!ajuda")) {
    chat.sendMessage("Comandos disponíveis: !regras, !info, !admin");
}` },
        { name: "📊 Log de Atividades", code: `// Registra ações importantes
chat.logActivity(member.id, "Enviou mensagem: " + message.text.substring(0, 50));
console.log(`[${new Date().toLocaleString()}] ${member.name}: ${message.text}`);` },
        { name: "🔒 Moderador Automático", code: `// Detecta e remove conteúdo suspeito
const suspicious = ["link", "apostas", "promoção"];
for (let word of suspicious) {
    if (message.text.toLowerCase().includes(word)) {
        chat.sendMessageToAdmin(`⚠️ Mensagem suspeita de ${member.name}: ${message.text}`);
        break;
    }
}` }
    ]);

    const db = window.firebaseDB;

    React.useEffect(() => {
        if (!activeChat) return;
        const rulesRef = db.ref(`groups/${activeChat.id}/scripts`);
        rulesRef.on('value', snap => {
            setScripts(snap.val() || {});
        });
        return () => rulesRef.off();
    }, [activeChat]);

    const handleSave = async () => {
        if (!name) return alert("Dê um nome para a regra.");
        const id = selectedScriptId || 'rule_' + Date.now();

        await db.ref(`groups/${activeChat.id}/scripts/${id}`).set({
            name: name,
            description: description,
            code: code,
            active: isActive,
            triggerType: triggerType,
            executionDelay: executionDelay,
            cooldown: cooldown,
            actionType: actionType,
            createdBy: user.id,
            createdByName: user.name,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lastExecuted: null,
            executionCount: 0
        });

        setSelectedScriptId(null);
        setName("");
        setDescription("");
        setCode("");
        setIsActive(true);
        setTriggerType('onMessage');
        setExecutionDelay(0);
        setCooldown(0);
        alert("Regra salva com sucesso!");
    };

    const loadScript = (id) => {
        const s = scripts[id];
        setSelectedScriptId(id);
        setName(s.name || "");
        setDescription(s.description || "");
        setCode(s.code || "");
        setIsActive(s.active !== false);
        setTriggerType(s.triggerType || 'onMessage');
        setExecutionDelay(s.executionDelay || 0);
        setCooldown(s.cooldown || 0);
        setActionType(s.actionType || 'javascript');
    };

    const deleteScript = async (id) => {
        if (confirm("Apagar esta regra permanentemente?")) {
            await db.ref(`groups/${activeChat.id}/scripts/${id}`).remove();
            if (selectedScriptId === id) {
                setSelectedScriptId(null);
                setName("");
                setDescription("");
                setCode("");
            }
        }
    };

    const toggleScriptActive = async (id, currentActive) => {
        await db.ref(`groups/${activeChat.id}/scripts/${id}/active`).set(!currentActive);
    };

    const loadTemplate = (template) => {
        setName(template.name);
        setCode(template.code);
        setDescription(`Template: ${template.name}`);
    };

    const testScript = async () => {
        try {
            // Simular execução do script
            const mockMessage = {
                text: testInput || "mensagem de teste",
                senderId: "test_user",
                senderName: "Testador",
                id: "test_msg_123",
                timestamp: Date.now()
            };
            const mockMember = {
                id: user.id,
                name: user.name,
                role: "member"
            };
            const mockChat = {
                id: activeChat.id,
                name: activeChat.name,
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

            // Executar código (com segurança)
            const asyncEval = new Function('message', 'member', 'chat', 'console', code);
            await asyncEval(mockMessage, mockMember, mockChat, console);
            
            setTestResult({ success: true, message: "Script executado com sucesso! Verifique o console para logs." });
        } catch (error) {
            setTestResult({ success: false, message: `Erro: ${error.message}` });
        }
        setTimeout(() => setTestResult(null), 5000);
    };

    const exportScripts = () => {
        const data = JSON.stringify(scripts, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rules_${activeChat.id}_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const importScripts = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const imported = JSON.parse(event.target.result);
                for (const [id, script] of Object.entries(imported)) {
                    await db.ref(`groups/${activeChat.id}/scripts/${id}`).set({
                        ...script,
                        importedAt: Date.now(),
                        importedBy: user.id
                    });
                }
                alert("Regras importadas com sucesso!");
            } catch (error) {
                alert("Erro ao importar: " + error.message);
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="fixed inset-0 bg-white z-30 flex flex-col animate-slide-in-right">
            {/* Header */}
            <div className="bg-gray-800 text-white p-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="hover:bg-gray-700 p-1 rounded">
                        <div className="icon-arrow-left"></div>
                    </button>
                    <h2 className="font-mono font-bold text-green-400">{'<Editor de Regras Avançado />'}</h2>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowApiDocs(!showApiDocs)} className="text-xs bg-blue-600 px-3 py-1 rounded hover:bg-blue-500">
                        📚 API Docs
                    </button>
                    <button onClick={exportScripts} className="text-xs bg-green-600 px-3 py-1 rounded hover:bg-green-500">
                        📤 Exportar
                    </button>
                    <label className="text-xs bg-purple-600 px-3 py-1 rounded hover:bg-purple-500 cursor-pointer">
                        📥 Importar
                        <input type="file" accept=".json" onChange={importScripts} className="hidden" />
                    </label>
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
                                    <div><code className="bg-gray-200 px-1 rounded">chat.muteUser(userId, seconds)</code> - Silencia usuário</div>
                                    <div><code className="bg-gray-200 px-1 rounded">chat.kickMember(userId)</code> - Expulsa membro</div>
                                    <div><code className="bg-gray-200 px-1 rounded">chat.banMember(userId)</code> - Bane membro</div>
                                    <div><code className="bg-gray-200 px-1 rounded">chat.sendMessageToAdmin(text)</code> - Envia para admins</div>
                                    <div><code className="bg-gray-200 px-1 rounded">chat.logActivity(userId, action)</code> - Registra log</div>
                                    <div><code className="bg-gray-200 px-1 rounded">chat.getUserMessageCount(userId, timeWindowMs)</code> - Conta msgs</div>
                                </div>
                            </div>
                            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                <h4 className="font-bold text-yellow-700 mb-2">⚠️ Exemplo Completo</h4>
                                <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded overflow-x-auto">{`// Anti-spam avançado
const msgCount = chat.getUserMessageCount(member.id, 60000);
if (msgCount > 10) {
    chat.warnUser(member.id, "Spam detectado!");
    chat.muteMember(member.id, 300);
    chat.logActivity(member.id, "Mutado por spam");
}
if (message.text.includes("palavrao")) {
    chat.deleteMessage(message.id);
    chat.warnUser(member.id, "Linguagem inadequada!");
}`}</pre>
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
                            onClick={() => { setSelectedScriptId(null); setName(""); setDescription(""); setCode(""); setIsActive(true); setTriggerType('onMessage'); setExecutionDelay(0); setCooldown(0); }}
                            className="w-full bg-[#00a884] text-white py-2 rounded-lg shadow hover:bg-[#008f6f] transition flex items-center justify-center gap-2"
                        >
                            <div className="icon-plus"></div> Nova Regra
                        </button>
                        
                        {/* Templates Dropdown */}
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
                                        <div className="text-[10px] text-gray-400 mt-1 flex gap-2">
                                            <span>🔄 {script.executionCount || 0} execuções</span>
                                            <span>⚡ {script.triggerType === 'onMessage' ? 'Mensagem' : script.triggerType === 'onMemberJoin' ? 'Entrada' : 'Saída'}</span>
                                        </div>
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
                            <option value="onCall">📞 Durante chamada</option>
                        </select>
                        <label className="flex items-center gap-2 text-white text-sm">
                            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4" />
                            Regra Ativa
                        </label>
                    </div>
                    
                    <div className="p-2 bg-gray-700 border-t border-gray-600 flex gap-2 flex-wrap">
                        <div className="flex items-center gap-2 text-white text-sm">
                            <span>⏱️ Delay:</span>
                            <input type="number" value={executionDelay} onChange={(e) => setExecutionDelay(parseInt(e.target.value) || 0)} className="w-16 bg-gray-600 text-white px-2 py-1 rounded" />
                            <span>ms</span>
                        </div>
                        <div className="flex items-center gap-2 text-white text-sm">
                            <span>🔄 Cooldown:</span>
                            <input type="number" value={cooldown} onChange={(e) => setCooldown(parseInt(e.target.value) || 0)} className="w-16 bg-gray-600 text-white px-2 py-1 rounded" />
                            <span>ms</span>
                        </div>
                        <div className="flex-1"></div>
                        <button onClick={testScript} className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-500 flex items-center gap-1">
                            <div className="icon-play"></div> Testar
                        </button>
                        <button onClick={handleSave} className="bg-green-600 text-white px-4 py-1 rounded font-bold text-sm hover:bg-green-500 flex items-center gap-1">
                            <div className="icon-save"></div> SALVAR
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
                        placeholder={`// Escreva seu código JavaScript aqui...
// Exemplo:
// if (message.text.includes('spam')) {
//    chat.warnUser(member.id, "Evite spam!");
//    chat.deleteMessage(message.id);
// }`}
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
