export default async function handler(req, res) {
  // Garantir que o método é GET (já que o code vem na URL)
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: "code não encontrado na URL" });
  }

  // Verifica se o código parece ter o formato correto
  if (code.length < 10 || code.includes(" ")) {
    return res.status(400).json({ 
      error: "Formato de código suspeito",
      code_recebido: code.substring(0, 5) + "..." 
    });
  }

  try {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Credenciais do GitHub não configuradas no ambiente");
    }

    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code: code.trim(), // Remove espaços extras
        }),
      }
    );

    const data = await tokenResponse.json();

    // Log detalhado do que o GitHub retornou
    console.log("Resposta completa do GitHub:", {
      status: tokenResponse.status,
      headers: Object.fromEntries(tokenResponse.headers),
      body: data,
    });

    if (data.error) {
      return res.status(400).json({
        erro_github: data.error,
        descricao: data.error_description,
        sugestao: "Gere um novo código e tente IMEDIATAMENTE",
      });
    }

    return res.status(200).json({ token: data.access_token });

  } catch (err) {
    console.error("Erro no servidor:", err);
    return res.status(500).json({ error: err.message });
  }
}
