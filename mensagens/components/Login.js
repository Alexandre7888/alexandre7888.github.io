// components/Login.js
function Login({ onLogin }) {
    const [status, setStatus] = React.useState("Verificando autenticação...");
    const [loading, setLoading] = React.useState(true);

    const API_URL = "https://code-hub-eta.vercel.app/api/userkey.js";
    const db = window.firebaseDB;

    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const userkeyFromUrl = params.get("userKey");
        
        if (userkeyFromUrl) {
            localStorage.setItem("codehub_userkey", userkeyFromUrl);
            window.history.pushState({}, document.title, window.location.pathname);
            authenticateWithUserKey(userkeyFromUrl);
        } else {
            const savedUserKey = localStorage.getItem("codehub_userkey");
            if (savedUserKey) {
                authenticateWithUserKey(savedUserKey);
            } else {
                setLoading(false);
                setStatus("Faça login para continuar.");
            }
        }
    }, []);

    const authenticateWithUserKey = async (userkey) => {
        setLoading(true);
        setStatus("Buscando dados do usuário...");

        try {
            // 1. Busca nome na API (só consulta, não salva nada)
            const response = await fetch(`${API_URL}?userkey=${encodeURIComponent(userkey)}`);
            
            if (!response.ok) throw new Error("Falha ao buscar dados");
            
            const userData = await response.json();
            if (!userData || !userData.uid) throw new Error("Dados inválidos");

            const userName = userData.nome || userData.name || `Usuário_${userData.uid.substring(0, 8)}`;
            const userUid = userData.uid;
            
            // 2. Gera um ID ÚNICO e GRANDE para o usuário
            let userId = localStorage.getItem(`chat_id_${userUid}`);
            if (!userId) {
                // ID com 20 caracteres: timestamp + random + uid
                const timestamp = Date.now().toString(36);
                const random = Math.random().toString(36).substring(2, 10);
                const uidShort = userUid.substring(0, 6);
                userId = `${timestamp}_${random}_${uidShort}`;
                localStorage.setItem(`chat_id_${userUid}`, userId);
            }
            
            setStatus("Criando/atualizando perfil...");
            
            // 3. Verifica se usuário já existe no Firebase
            const userSnapshot = await db.ref(`users/${userId}`).once('value');
            let avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`;
            
            if (!userSnapshot.exists()) {
                // Usuário novo: cria registro
                await db.ref(`users/${userId}`).set({
                    name: userName,
                    uid: userUid,
                    id: userId,
                    avatar: avatar,
                    createdAt: Date.now(),
                    lastSeen: Date.now(),
                    contacts: {},
                    groups: {}
                });
            } else {
                // Usuário existente: atualiza dados
                const existingData = userSnapshot.val();
                avatar = existingData.avatar || avatar;
                await db.ref(`users/${userId}`).update({
                    name: userName,
                    lastSeen: Date.now(),
                    uid: userUid
                });
            }
            
            // 4. Prepara dados para o chat
            const chatUserData = {
                name: userName,
                userKey: userkey,
                uid: userUid,
                id: userId,
                avatar: avatar
            };
            
            localStorage.setItem("chat_user", JSON.stringify(chatUserData));
            localStorage.setItem("userName", userName);
            localStorage.setItem("userKey", userkey);
            localStorage.setItem("userId", userId);
            
            setStatus("Login realizado!");
            setTimeout(() => onLogin(chatUserData), 500);
            
        } catch (error) {
            console.error("Erro:", error);
            setStatus(`Erro: ${error.message}`);
            setLoading(false);
            localStorage.removeItem("codehub_userkey");
        }
    };

    const handleCodeHubLogin = () => {
        setLoading(true);
        setStatus("Redirecionando para CodeHUB...");
        const redirectUrl = encodeURIComponent(window.location.href);
        window.location.href = `https://alexandre7888.github.io/CodeHUB/mensagens/?token=jeQgPoh4LYHl260Fu51E&redirect=${redirectUrl}`;
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00a884] to-[#075e54] p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                <div className="mb-6 flex justify-center">
                    <div className="w-24 h-24 bg-gradient-to-br from-[#00a884] to-[#075e54] rounded-full flex items-center justify-center shadow-lg">
                        <div className="icon-message-circle text-5xl text-white"></div>
                    </div>
                </div>
                
                <h2 className="text-2xl font-bold text-gray-800 mb-2">MensagensHUB</h2>
                <p className="text-gray-500 text-sm mb-6">Conecte-se com sua conta CodeHUB</p>
                
                {loading ? (
                    <div className="flex flex-col items-center gap-3">
                        <div className="icon-loader animate-spin text-3xl text-[#00a884]"></div>
                        <p className="text-sm text-gray-500">{status}</p>
                    </div>
                ) : (
                    <button 
                        onClick={handleCodeHubLogin}
                        className="w-full bg-gradient-to-r from-[#00a884] to-[#075e54] text-white py-3 px-6 rounded-xl font-semibold hover:opacity-90 transition flex items-center justify-center gap-2"
                    >
                        <div className="icon-log-in text-xl"></div>
                        <span>Entrar com CodeHUB</span>
                    </button>
                )}
            </div>
        </div>
    );
}
