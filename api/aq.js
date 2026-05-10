export default async function handler(req, res) {
  // Habilitar CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: "code não encontrado" });
  }

  try {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Credenciais não configuradas");
    }

    // 1. Trocar código por token
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
          code: code,
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return res.status(400).json({
        erro: tokenData.error,
        descricao: tokenData.error_description,
      });
    }

    const accessToken = tokenData.access_token;

    // 2. Consultar dados do usuário
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "Vercel-App",
      },
    });

    const userData = await userResponse.json();

    // Retornar tudo
    return res.status(200).json({
      token: accessToken,
      usuario: userData,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
