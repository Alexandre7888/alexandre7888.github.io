// /api/github.js

export default async function handler(req, res) {

  const code = req.query.code;

  if (!code) {
    return res.status(400).json({
      error: "Código OAuth não encontrado"
    });
  }

  try {

    const github = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code
        })
      }
    );

    const data = await github.json();

    if (data.error) {
      return res.status(400).json(data);
    }

    return res.status(200).json({
      access_token: data.access_token
    });

  } catch (err) {

    return res.status(500).json({
      error: err.message
    });

  }

}
