// /api/github.js

export default async function handler(req, res) {

  const { code } = req.query;

  if (!code) {
    return res.status(400).json({
      error: "code não encontrado"
    });
  }

  try {

    const response = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code: code
        })
      }
    );

    const data = await response.json();

    console.log(data);

    if (data.error) {
      return res.status(400).json(data);
    }

    return res.status(200).json({
      token: data.access_token
    });

  } catch (err) {

    return res.status(500).json({
      error: err.message
    });

  }

}
