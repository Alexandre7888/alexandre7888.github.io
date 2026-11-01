// api/stream.js
export default async function handler(req, res) {
  const { id, token, share, download } = req.query;
  
  const workerUrl = share 
    ? `https://proud-flower-677b.braatzjunioralexandre5.workers.dev/api/workspace/public/${share}`
    : `https://proud-flower-677b.braatzjunioralexandre5.workers.dev/api/workspace/view/${id}?tokenid=${token}`;

  try {
    const response = await fetch(workerUrl);
    if (!response.ok) return res.status(response.status).send("Erro no acesso.");

    res.setHeader("Content-Type", response.headers.get("content-type"));
    if (download) res.setHeader("Content-Disposition", `attachment; filename="arquivo"`);
    
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (e) {
    res.status(500).send("Erro interno.");
  }
}
