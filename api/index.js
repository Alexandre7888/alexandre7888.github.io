const WORKER_URL = "https://proud-flower-677b.braatzjunioralexandre5.workers.dev";

export default async function handler(req, res) {
  const { action, id, token, share, download, owner } = req.query;

  if (!action) {
    return res.status(400).send("Ação não especificada. Use ?action=view ou ?action=stream.");
  }

  // ==========================================
  // 1. VISUALIZADOR (/api?action=view)
  // ==========================================
  if (action === 'view') {
    if (!id) return res.status(400).send("ID do arquivo obrigatório.");
    
    const workerUrl = share 
      ? `${WORKER_URL}/api/workspace/public/${share}`
      : `${WORKER_URL}/api/workspace/view/${id}?tokenid=${token}`;

    try {
      const fileRes = await fetch(workerUrl);
      if (!fileRes.ok) return res.status(fileRes.status).send("Acesso negado ou arquivo não encontrado.");

      const contentType = fileRes.headers.get("content-type") || "application/octet-stream";
      let mediaHtml = "";

      if (contentType.includes("image")) {
        mediaHtml = `<img src="/api?action=stream&id=${id}&token=${token || ''}&share=${share || ''}" style="max-width:100%;max-height:80vh;border-radius:8px;" />`;
      } else if (contentType.includes("pdf")) {
        mediaHtml = `<iframe src="/api?action=stream&id=${id}&token=${token || ''}&share=${share || ''}" style="width:100%;height:80vh;border:none;"></iframe>`;
      } else if (contentType.includes("video")) {
        mediaHtml = `<video controls style="max-width:100%;max-height:80vh;border-radius:8px;"><source src="/api?action=stream&id=${id}&token=${token || ''}&share=${share || ''}" type="${contentType}"></video>`;
      } else {
        mediaHtml = `<p>Formato não suportado para visualização.</p>`;
      }

      const html = `
        <!DOCTYPE html>
        <html lang="pt-br" style="background:#0a0e1a;color:#e8eef8;font-family:'Segoe UI',sans-serif;height:100vh;margin:0;display:flex;flex-direction:column;">
        <head>
          <title>Visualizador CodeHUB</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0;display:flex;flex-direction:column;height:100vh;">
          <div style="padding:15px 20px;background:#101626;border-bottom:1px solid #1f2a44;display:flex;justify-content:space-between;align-items:center;">
            <h3 style="margin:0;font-size:1.1rem;">Visualizador CodeHUB</h3>
            <div>
              <!-- Redireciona para o Workspace com a URL limpa -->
              <a href="https://codehub.giize.com/workspace/?id=${id}&owner=${owner || ''}" style="background:#4f8cff;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:bold;font-size:14px;">Salvar no Workspace</a>
              <a href="/api?action=stream&id=${id}&token=${token || ''}&download=true" style="background:#2d3b5c;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:bold;font-size:14px;margin-left:10px;">Baixar</a>
            </div>
          </div>
          <div style="flex:1;display:flex;justify-content:center;align-items:center;padding:20px;">
            ${mediaHtml}
          </div>
        </body>
        </html>
      `;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    } catch (e) {
      return res.status(500).send("Erro ao carregar arquivo.");
    }
  }

  // ==========================================
  // 2. STREAM/DOWNLOAD (/api?action=stream)
  // ==========================================
  if (action === 'stream') {
    const workerUrl = share 
      ? `${WORKER_URL}/api/workspace/public/${share}`
      : `${WORKER_URL}/api/workspace/view/${id}?tokenid=${token}`;

    try {
      const response = await fetch(workerUrl);
      if (!response.ok) return res.status(response.status).send("Erro no acesso ao arquivo.");

      res.setHeader("Content-Type", response.headers.get("content-type") || "application/octet-stream");
      
      if (download === 'true') {
        res.setHeader("Content-Disposition", `attachment; filename="arquivo"`);
      }
      
      const buffer = await response.arrayBuffer();
      return res.send(Buffer.from(buffer));
    } catch (e) {
      return res.status(500).send("Erro interno no stream.");
    }
  }

  return res.status(404).send("Ação não encontrada.");
}
