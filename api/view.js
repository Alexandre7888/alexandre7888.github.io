// api/view.js
export default async function handler(req, res) {
  const { id, token, share } = req.query;
  if (!id) return res.status(400).send("ID obrigatório.");

  // Tenta pegar o arquivo. Se tiver `share`, busca na rota pública do Worker
  const workerUrl = share 
    ? `https://proud-flower-677b.braatzjunioralexandre5.workers.dev/api/workspace/public/${share}`
    : `https://proud-flower-677b.braatzjunioralexandre5.workers.dev/api/workspace/view/${id}?tokenid=${token}`;

  try {
    const fileRes = await fetch(workerUrl);
    if (!fileRes.ok) return res.status(fileRes.status).send("Acesso negado.");

    const contentType = fileRes.headers.get("content-type") || "application/octet-stream";
    let mediaHtml = "";

    if (contentType.includes("image")) {
      mediaHtml = `<img src="/api/stream?id=${id}&token=${token}&share=${share || ''}" />`;
    } else if (contentType.includes("pdf")) {
      mediaHtml = `<iframe src="/api/stream?id=${id}&token=${token}&share=${share || ''}"></iframe>`;
    } else if (contentType.includes("video")) {
      mediaHtml = `<video controls><source src="/api/stream?id=${id}&token=${token}&share=${share || ''}" type="${contentType}"></video>`;
    } else {
      mediaHtml = `<p>Formato não suportado. <a href="/api/stream?id=${id}&token=${token}&download=true">Baixar</a></p>`;
    }

    const html = `
      <!DOCTYPE html>
      <html lang="pt-br" style="background:#0a0e1a;color:#e8eef8;font-family:sans-serif;height:100vh;margin:0;display:flex;flex-direction:column;">
      <head><title>Visualizador</title>
      <style>
        .header { padding:15px 20px; background:#101626; border-bottom:1px solid #1f2a44; display:flex; justify-content:space-between; }
        .content { flex:1; display:flex; justify-content:center; align-items:center; padding:20px; }
        img, video, iframe { max-width:100%; max-height:80vh; border-radius:8px; }
        iframe { width:100%; height:80vh; }
        .btn { background:#4f8cff; color:white; text-decoration:none; padding:10px 20px; border-radius:8px; font-weight:bold; }
      </style>
      </head>
      <body>
        <div class="header">
          <h3 style="margin:0;">Visualizador CodeHUB</h3>
          <div>
            <a href="/api/add-to-workspace?id=${id}&token=${token}" class="btn">Salvar no Workspace</a>
            <a href="/api/stream?id=${id}&token=${token}&download=true" class="btn" style="background:#2d3b5c;">Baixar</a>
          </div>
        </div>
        <div class="content">${mediaHtml}</div>
      </body>
      </html>
    `;
    res.setHeader("Content-Type", "text/html");
    return res.send(html);
  } catch (e) {
    res.status(500).send("Erro ao carregar arquivo.");
  }
}
