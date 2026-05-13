function Login({ onLogin }) {
    const [status, setStatus] = React.useState("Verificando autenticação...");
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        // Tenta validar login automaticamente usando a função global do CodeHUB injetada pelo script
        if (typeof window.validarLogin === "function") {
            window.validarLogin(function(res) {
                if (res.success) {
                    console.log("Login CodeHUB verificado com sucesso:", res);
                    handleAuthSuccess(res.userName, res.userKey);
                } else {
                    console.log("Nenhuma sessão CodeHUB ativa encontrada.");
                    setLoading(false);
                    setStatus("Faça login para continuar.");
                }
            });
        } else {
            console.error("Script CodeHUB não carregado corretamente.");
            setLoading(false);
            setStatus("Erro ao carregar script de autenticação.");
        }
    }, []);

    const handleAuthSuccess = (name, key) => {
        // Verifica se já temos um ID salvo para este userKey, senão cria
        let storedID = localStorage.getItem(`chat_id_${key}`);
        if (!storedID) {
            storedID = Math.floor(10000 + Math.random() * 90000).toString();
            localStorage.setItem(`chat_id_${key}`, storedID);
        }

        const userData = {
            name: name,
            userKey: key,
            id: storedID,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${storedID}`
        };
        
        // Salva usuário no Firebase
        if (window.firebaseDB) {
            window.firebaseDB.ref(`users/${storedID}`).set({
                name: name,
                id: storedID,
                avatar: userData.avatar,
                lastSeen: window.firebase.database.ServerValue.TIMESTAMP
            });
        }

        localStorage.setItem("chat_user", JSON.stringify(userData));
        localStorage.setItem("userName", name);
        localStorage.setItem("userKey", key);
        
        onLogin(userData);
    };

    const handleCodeHubLogin = () => {
        setLoading(true);
        setStatus("Redirecionando para CodeHUB...");
        // Redirecionamento real usando o token fornecido: jeQgPoh4LYHl260Fu51E
        window.location.href = "https://code.codehub.ct.ws/API/continuar-conta?token=jeQgPoh4LYHl260Fu51E"; 
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#eef2f9] p-4">
            <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center">
                <div className="mb-6 flex justify-center">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                        <div className="icon-lock text-4xl text-blue-600"></div>
                    </div>
                </div>
                
                <h2 className="text-2xl font-bold text-gray-800 mb-2">CodeHub Auth Real</h2>
                <p className="text-gray-500 mb-8">{status}</p>
                
                {!loading && (
                    <button 
                        onClick={handleCodeHubLogin}
                        className="w-full bg-[#1777ff] text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-600 transition flex items-center justify-center gap-2"
                    >
                        <span>🔵</span>
                        <span>Entrar com CodeHub</span>
                    </button>
                )}
                
                {loading && (
                     <div className="flex justify-center mt-4">
                        <div className="icon-loader animate-spin text-blue-500 text-2xl"></div>
                    </div>
                )}
            </div>
        </div>
    );
}