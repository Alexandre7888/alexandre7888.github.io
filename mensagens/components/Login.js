// components/Login.js
function Login({ onLogin }) {
    const [status, setStatus] = React.useState("Verificando autenticação...");
    const [loading, setLoading] = React.useState(true);
    const [showAvatarUpload, setShowAvatarUpload] = React.useState(false);
    const [tempUserData, setTempUserData] = React.useState(null);
    const [avatarPreview, setAvatarPreview] = React.useState(null);
    const [uploading, setUploading] = React.useState(false);
    const fileInputRef = React.useRef(null);

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
            const response = await fetch(`${API_URL}?userkey=${encodeURIComponent(userkey)}`);

            if (!response.ok) throw new Error("Falha ao buscar dados");

            const userData = await response.json();
            if (!userData || !userData.uid) throw new Error("Dados inválidos");

            const userName = userData.nome || userData.name || `Usuário_${userData.uid.substring(0, 8)}`;
            const userUid = userData.uid;

            let userId = localStorage.getItem(`chat_id_${userUid}`);
            if (!userId) {
                const timestamp = Date.now().toString(36);
                const random = Math.random().toString(36).substring(2, 10);
                const uidShort = userUid.substring(0, 6);
                userId = `${timestamp}_${random}_${uidShort}`;
                localStorage.setItem(`chat_id_${userUid}`, userId);
            }

            // Verifica se usuário já existe no Firebase
            const userSnapshot = await db.ref(`users/${userId}`).once('value');

            if (!userSnapshot.exists()) {
                // Usuário novo: mostra tela de upload de avatar
                setTempUserData({
                    name: userName,
                    uid: userUid,
                    id: userId,
                    userKey: userkey
                });
                setLoading(false);
                setShowAvatarUpload(true);
                setStatus("Escolha uma foto de perfil");
                return;
            } else {
                // Usuário existente: carrega dados
                const existingData = userSnapshot.val();
                const avatar = existingData.avatar || null;

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
                
                // 🔥 LINHA ADICIONADA: Inicia o OneSignal com o ID do usuário 🔥
                if (window.OneSignalManager) {
                    await window.OneSignalManager.init(userId);
                }
                
                setTimeout(() => onLogin(chatUserData), 500);
            }

        } catch (error) {
            console.error("Erro:", error);
            setStatus(`Erro: ${error.message}`);
            setLoading(false);
            localStorage.removeItem("codehub_userkey");
        }
    };

    const handleAvatarUpload = async () => {
        const file = fileInputRef.current?.files[0];
        if (!file) {
            alert("Selecione uma foto de perfil!");
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            alert("A imagem deve ter no máximo 2MB!");
            return;
        }

        setUploading(true);
        setStatus("Enviando foto...");

        try {
            // Converter para Base64
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64Avatar = reader.result;

                // Salvar no Firebase
                await db.ref(`users/${tempUserData.id}`).set({
                    name: tempUserData.name,
                    uid: tempUserData.uid,
                    id: tempUserData.id,
                    avatar: base64Avatar,
                    createdAt: Date.now(),
                    lastSeen: Date.now(),
                    contacts: {},
                    groups: {}
                });

                const chatUserData = {
                    name: tempUserData.name,
                    userKey: tempUserData.userKey,
                    uid: tempUserData.uid,
                    id: tempUserData.id,
                    avatar: base64Avatar
                };

                localStorage.setItem("chat_user", JSON.stringify(chatUserData));
                localStorage.setItem("userName", tempUserData.name);
                localStorage.setItem("userKey", tempUserData.userKey);
                localStorage.setItem("userId", tempUserData.id);

                setStatus("Login realizado!");
                
                // 🔥 LINHA ADICIONADA: Inicia o OneSignal 🔥
                if (window.OneSignalManager) {
                    await window.OneSignalManager.init(tempUserData.id);
                }
                
                setTimeout(() => onLogin(chatUserData), 500);
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error("Erro ao enviar foto:", error);
            setStatus("Erro ao enviar foto. Tente novamente.");
            setUploading(false);
        }
    };

    const skipAvatar = async () => {
        setUploading(true);
        setStatus("Finalizando cadastro...");

        try {
            // Salvar sem avatar (null)
            await db.ref(`users/${tempUserData.id}`).set({
                name: tempUserData.name,
                uid: tempUserData.uid,
                id: tempUserData.id,
                avatar: null,
                createdAt: Date.now(),
                lastSeen: Date.now(),
                contacts: {},
                groups: {}
            });

            const chatUserData = {
                name: tempUserData.name,
                userKey: tempUserData.userKey,
                uid: tempUserData.uid,
                id: tempUserData.id,
                avatar: null
            };

            localStorage.setItem("chat_user", JSON.stringify(chatUserData));
            localStorage.setItem("userName", tempUserData.name);
            localStorage.setItem("userKey", tempUserData.userKey);
            localStorage.setItem("userId", tempUserData.id);

            setStatus("Login realizado!");
            
            // 🔥 LINHA ADICIONADA: Inicia o OneSignal 🔥
            if (window.OneSignalManager) {
                await window.OneSignalManager.init(tempUserData.id);
            }
            
            setTimeout(() => onLogin(chatUserData), 500);
        } catch (error) {
            console.error("Erro:", error);
            setStatus("Erro ao finalizar cadastro.");
            setUploading(false);
        }
    };

    const previewAvatar = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCodeHubLogin = () => {
        setLoading(true);
        setStatus("Redirecionando para CodeHUB...");
        const redirectUrl = encodeURIComponent(window.location.href);
        window.location.href = `https://alexandre7888.github.io/CodeHUB/API/continuar-conta.html?token=jeQgPoh4LYHl260Fu51E&redirect=${redirectUrl}`;
    };

    // Tela de upload de avatar
    if (showAvatarUpload) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00a884] to-[#075e54] p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                    <div className="mb-6 flex justify-center">
                        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                            {avatarPreview ? (
                                <img src={avatarPreview} className="w-full h-full object-cover" alt="Preview" />
                            ) : (
                                <div className="icon-camera text-4xl text-gray-400"></div>
                            )}
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Escolha sua foto</h2>
                    <p className="text-gray-500 text-sm mb-6">Selecione uma foto de perfil</p>

                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        accept="image/*" 
                        className="hidden" 
                        onChange={previewAvatar}
                    />

                    <button 
                        onClick={() => fileInputRef.current.click()}
                        className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-xl font-semibold hover:bg-gray-200 transition mb-3"
                    >
                        📷 Selecionar foto
                    </button>

                    <div className="flex gap-3">
                        <button 
                            onClick={handleAvatarUpload}
                            disabled={uploading || !avatarPreview}
                            className={`flex-1 bg-[#00a884] text-white py-3 px-6 rounded-xl font-semibold hover:bg-[#008f6f] transition ${(!avatarPreview || uploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {uploading ? 'Enviando...' : 'Continuar'}
                        </button>
                        <button 
                            onClick={skipAvatar}
                            disabled={uploading}
                            className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-xl font-semibold hover:bg-gray-300 transition"
                        >
                            Pular
                        </button>
                    </div>
                </div>
            </div>
        );
    }

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