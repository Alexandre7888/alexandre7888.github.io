const WORKER_URL = "https://proud-flower-677b.braatzjunioralexandre5.workers.dev";

export default async function handler(req, res) {
  const { action, id, token, share, download, owner } = req.query;

  if (!action) return res.status(400).send("Ação não especificada.");

  // 1. VISUALIZADOR
  if (action === 'view') {
    if (!id) return res.status(400).send("ID obrigatório.");
    
    const workerUrl = share 
      ? `${WORKER_URL}/api/workspace/public/${share}`
      : `${WORKER_URL}/api/workspace/view/${id}?tokenid=${token}`;

    try {
      const fileRes = await fetch(workerUrl);
      if (!fileRes.ok) return res.status(fileRes.status).send("Acesso negado.");

      const contentType = fileRes.headers.get("content-type") || "application/octet-stream";
      let mediaHtml = "";

      if (contentType.includes("image")) {
        mediaHtml = `<img src="/api?action=stream&id=${id}&token=${token}&share=${share || ''}" />`;
      } else if (contentType.includes("pdf")) {
        mediaHtml = `<iframe src="/api?action=stream&id=${id}&token=${token}&share=${share || ''}"></iframe>`;
      } else if (contentType.includes("video")) {
        mediaHtml = `<video controls><source src="/api?action=stream&id=${id}&token=${token}&share=${share || ''}" type="${contentType}"></video>`;
      } else {
        mediaHtml = `<p>Formato não suportado. <a href="/api?action=stream&id=${id}&token=${token}&download=true" class="btn">Baixar</a></p>`;
      }

      const html = `
        <!DOCTYPE html>
        <html lang="pt-br" style="background:#0a0e1a;color:#e8eef8;font-family:sans-serif;height:100vh;margin:0;display:flex;flex-direction:column;">
        <head><title>Visualizador CodeHUB</title>
        <style>
          .header { padding:15px 20px; background:#101626; border-bottom:1px solid #1f2a44; display:flex; justify-content:space-between; align-items:center; }
          .content { flex:1; display:flex; justify-content:center; align-items:center; padding:20px; }
          img, video, iframe { max-width:100%; max-height:80vh; border-radius:8px; }
          iframe { width:100%; height:80vh; }
          .btn { background:#4f8cff; color:white; text-decoration:none; padding:10px 20px; border-radius:8px; font-weight:bold; font-size:14px; }
          .btn-sec { background:#2d3b5c; margin-left:10px; }
        </style>
        </head>
        <body>
          <div class="header">
            <h3 style="margin:0;">Visualizador CodeHUB</h3>
            <div>
              <a href="https://codehub.giize.com/workspace.html?id=${id}" class="btn">Salvar no Workspace</a>
              <a href="/api?action=stream&id=${id}&token=${token}&download=true" class="btn btn-sec">Baixar</a>
            </div>
          </div>
          <div class="content">${mediaHtml}</div>
        </body>
        </html>
      `;
      res.setHeader("Content-Type", "text/html");
      return res.send(html);
    } catch (e) { return res.status(500).send("Erro."); }
  }

  // 2. STREAM/DOWNLOAD
  if (action === 'stream') {
    const workerUrl = share 
      ? `${WORKER_URL}/api/workspace/public/${share}`
      : `${WORKER_URL}/api/workspace/view/${id}?tokenid=${token}`;

    try {
      const response = await fetch(workerUrl);
      if (!response.ok) return res.status(response.status).send("Erro.");

      res.setHeader("Content-Type", response.headers.get("content-type"));
      if (download === 'true') res.setHeader("Content-Disposition", `attachment; filename="arquivo"`);
      
      const buffer = await response.arrayBuffer();
      return res.send(Buffer.from(buffer));
    } catch (e) { return res.status(500).send("Erro."); }
  }

  return res.status(404).send("Ação não encontrada.");
}
