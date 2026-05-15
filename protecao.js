// === CONFIGURAÇÕES ===
const dominiosPermitidos = [
    "code.codehub.ct.ws", // domínio específico
    "codehub.ct.ws"       // domínio principal (aceita subdomínios)
    "code-hub-eta.vercel.app"       // domínio principal (aceita subdomínios)

];

const webhookURL = "https://discord.com/api/webhooks/1416615114077110372/bcsRqA7uTdo3Z4o3EmsADepTcrbl5C30QBUMekF8nLYvrhqEUd8fo8-gFss7qZfNVWRJ";

// === VERIFICAÇÃO PRINCIPAL ===
function verificarDominio() {
    const dominioAtual = window.location.hostname;

    const dominioPermitido = dominiosPermitidos.some(dominio =>
        dominioAtual === dominio || dominioAtual.endsWith("." + dominio)
    );

    if (!dominioPermitido) {
        console.log('🚨 DOMÍNIO BLOQUEADO:', dominioAtual);
        mostrarPaginaBloqueio(dominioAtual);
        return false;
    }

    console.log('✅ Domínio autorizado:', dominioAtual);
    return true;
}

// === PÁGINA DE BLOQUEIO ===
function mostrarPaginaBloqueio(dominio) {

    document.documentElement.innerHTML = '';
    document.documentElement.style.display = 'block';

    document.body.innerHTML = `
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #000;
            color: red;
            font-family: Arial;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            z-index: 99999;
        ">
            <h1 style="font-size: 2.5em; margin-bottom: 20px;">🚫 ACESSO BLOQUEADO</h1>
            <p style="font-size: 1.2em; color: white;">Domínio não autorizado:</p>
            <p style="font-size: 1.5em; color: #ff4444; font-weight: bold; background: #222; padding: 10px; border-radius: 5px;">
                ${dominio}
            </p>

            <p style="color: #ccc; margin-top: 20px;">
                Este domínio não tem permissão para acessar este conteúdo.
            </p>

            <div style="
                margin-top: 30px;
                padding: 15px;
                background: #222;
                border-radius: 8px;
                border-left: 4px solid #ff4444;
            ">
                <p style="color: #ff8888; margin: 0; font-size: 1.1em;">
                    ⚠️ Acesso não autorizado detectado.
                </p>
            </div>

            <p style="color: #666; margin-top: 30px; font-size: 0.9em;">
                ❌ Não copie sites sem autorização
            </p>

            <p style="color: #666; margin-top: 30px; font-size: 0.9em;">
                Caso seja erro, entre em contato:<br>
                <a href="mailto:code.hub.email.com@gmail.com?Subject=Domínio%20não%20autorizado" style="color:#ff4444;">
                    Enviar E-mail
                </a>
            </p>
        </div>
    `;

    setTimeout(() => {
        alert("🚨 ACESSO NÃO AUTORIZADO!\n\nEste domínio não tem permissão para usar este sistema.");
    }, 1500);

    enviarLogDiscord(dominio);
}

// === ENVIAR LOG PARA DISCORD ===
function enviarLogDiscord(dominio) {

    if (!webhookURL) return;

    const dados = {
        username: "🔒 Proteção CodeHUB",
        embeds: [{
            title: "🚨 ACESSO BLOQUEADO",
            description: `Domínio **${dominio}** tentou acessar o site sem autorização`,
            color: 16711680,
            timestamp: new Date().toISOString(),
            fields: [
                {
                    name: "URL",
                    value: window.location.href || 'N/A',
                    inline: false
                },
                {
                    name: "User Agent",
                    value: navigator.userAgent
                        ? navigator.userAgent.substring(0, 200)
                        : 'N/A',
                    inline: false
                }
            ]
        }]
    };

    fetch(webhookURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados)
    }).then(() => {
        console.log('✅ Log enviado para Discord');
    }).catch(error => {
        console.log('❌ Erro ao enviar para Discord:', error);
    });
}

// === INICIALIZAÇÃO ===
console.log('🔒 Iniciando verificação de domínio...');

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', verificarDominio);
} else {
    verificarDominio();
}

window.addEventListener('load', verificarDominio);
window.addEventListener('hashchange', verificarDominio);
window.addEventListener('popstate', verificarDominio);

console.log('✅ Sistema de proteção ativo');