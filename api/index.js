const WORKER_URL = "https://proud-flower-677b.braatzjunioralexandre5.workers.dev";

export default async function handler(req, res) {
  const { action, id, token, share, download, owner } = req.query;

  if (!action) return res.status(400).send("Ação não especificada. Use ?action=view, ?action=stream ou ?action=add-to-workspace.");

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

      // Usa ?action=stream no player
      if (contentType.includes("image")) {
        mediaHtml = `<img src="/api?action=stream&id=${id}&token=${token}&share=${share || ''}" />`;
      } else if (contentType.includes("pdf")) {
        mediaHtml = `<iframe src="/api?action=stream&id=${id}&token=${token}&share=${share || ''}"></iframe>`;
      } else if (contentType.includes("video")) {
        mediaHtml = `<video controls><source src="/api?action=stream&id=${id}&token=${token}&share=${share || ''}" type="${contentType}"></video>`;
      } else {
        mediaHtml = `<p>Formato não suportado. <a href="/api?action=stream&id=${id}&token=${token}&download=true" class="btn">Baixar Arquivo</a></p>`;
      }

      // Botão de salvar workspace
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
              <a href="/api?action=add-to-workspace&id=${id}&token=${token}&owner=${owner || ''}" class="btn">Salvar no Workspace</a>
              <a href="/api?action=stream&id=${id}&token=${token}&download=true" class="btn btn-sec">Baixar</a>
            </div>
          </div>
          <div class="content">${mediaHtml}</div>
        </body>
        </html>
      `;
      res.setHeader("Content-Type", "text/html");
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
      if (!response.ok) return res.status(response.status).send("Erro no acesso.");

      res.setHeader("Content-Type", response.headers.get("content-type"));
      if (download === 'true') res.setHeader("Content-Disposition", `attachment; filename="arquivo"`);
      
      const buffer = await response.arrayBuffer();
      return res.send(Buffer.from(buffer));
    } catch (e) {
      return res.status(500).send("Erro interno no stream.");
    }
  }

  // ==========================================
  // 3. ADICIONAR AO WORKSPACE (/api?action=add-to-workspace)
  // ==========================================
  if (action === 'add-to-workspace') {
    try {
      const response = await fetch(`${WORKER_URL}/api/workspace/add-reference`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenid: token, fileId: id, ownerUid: owner || "root" })
      });

      const data = await response.json();
      // Redireciona de volta ao Workspace passando o ID
      const redirectUrl = `https://codehub.giize.com/workspace?id=${id}`;
      
      if (data.ok) {
        res.setHeader("Content-Type", "text/html");
        return res.send(`<script>alert('${data.mensagem}'); window.location.href='${redirectUrl}';</script>`);
      }
      return res.status(400).send(data.erro);
    } catch (e) {
      return res.status(500).send("Erro ao adicionar.");
    }
  }

  return res.status(404).send("Ação não encontrada.");
}
