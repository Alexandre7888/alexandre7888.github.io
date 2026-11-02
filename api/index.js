const WORKER_URL = "https://proud-flower-677b.braatzjunioralexandre5.workers.dev";

export default async function handler(req, res) {
  const { action, id, token, share, download, owner, type } = req.query;
  if (!action) return res.status(400).send("Ação não especificada.");

  if (action === 'view') {
    if (!id) return res.status(400).send("ID obrigatório.");
    const workerUrl = share
      ? `${WORKER_URL}/api/workspace/public/${share}`
      : `${WORKER_URL}/api/workspace/view/${id}?tokenid=${token}&type=${type || 'file'}`;

    try {
      const fileRes = await fetch(workerUrl);
      if (!fileRes.ok) return res.status(fileRes.status).send("Acesso negado.");

      const contentType = fileRes.headers.get("content-type") || "application/octet-stream";
      let mediaHtml = "";

      if (contentType.includes("application/json")) {
        const data = await fileRes.json();
        let list = data.files ? data.files.map(f => `<li style="margin-bottom:10px;">📄 <a href="/api?action=view&id=${f.id}&token=${token || ''}&share=${share || ''}&owner=${owner || ''}&type=file" style="color:#4f8cff;text-decoration:none;">${f.name}</a></li>`).join('') : '';
        mediaHtml = `<div style="text-align:left;width:100%;max-width:600px;"><h3>Conteúdo da Pasta</h3><ul style="list-style:none;padding:0;">${list || 'Vazia'}</ul></div>`;
      } else if (contentType.includes("image")) {
        mediaHtml = `<img src="/api?action=stream&id=${id}&token=${token || ''}&share=${share || ''}&type=file" style="max-width:100%;max-height:80vh;border-radius:8px;" />`;
      } else if (contentType.includes("pdf")) {
        mediaHtml = `<iframe src="/api?action=stream&id=${id}&token=${token || ''}&share=${share || ''}&type=file" style="width:100%;height:80vh;border:none;"></iframe>`;
      } else if (contentType.includes("video")) {
        mediaHtml = `<video controls style="max-width:100%;max-height:80vh;border-radius:8px;"><source src="/api?action=stream&id=${id}&token=${token || ''}&share=${share || ''}&type=file" type="${contentType}"></video>`;
      } else {
        mediaHtml = `<p>Formato não suportado. <a href="/api?action=stream&id=${id}&token=${token || ''}&download=true&type=file">Baixar Arquivo</a></p>`;
      }

      const html = `
        <!DOCTYPE html>
        <html lang="pt-br" style="background:#0a0e1a;color:#e8eef8;font-family:'Segoe UI',sans-serif;height:100vh;margin:0;display:flex;flex-direction:column;">
        <head><title>Visualizador CodeHUB</title><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin:0;display:flex;flex-direction:column;height:100vh;">
          <div style="padding:15px 20px;background:#101626;border-bottom:1px solid #1f2a44;display:flex;justify-content:space-between;align-items:center;">
            <h3 style="margin:0;font-size:1.1rem;">Visualizador CodeHUB</h3>
            <div>
              <a href="https://codehub.giize.com/workspace/?id=${id}&owner=${owner || ''}&type=${type || 'file'}" style="background:#4f8cff;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:bold;font-size:14px;">Salvar no Workspace</a>
              <a href="/api?action=stream&id=${id}&token=${token || ''}&download=true&type=${type || 'file'}" style="background:#2d3b5c;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:bold;font-size:14px;margin-left:10px;">Baixar</a>
            </div>
          </div>
          <div style="flex:1;display:flex;justify-content:center;align-items:center;padding:20px;">${mediaHtml}</div>
        </body>
        </html>
      `;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    } catch (e) {
      return res.status(500).send("Erro.");
    }
  }

  if (action === 'stream') {
    const workerUrl = share
      ? `${WORKER_URL}/api/workspace/public/${share}`
      : `${WORKER_URL}/api/workspace/view/${id}?tokenid=${token}&type=${type || 'file'}`;
    try {
      const response = await fetch(workerUrl);
      if (!response.ok) return res.status(response.status).send("Erro.");
      res.setHeader("Content-Type", response.headers.get("content-type") || "application/octet-stream");
      if (download === 'true') res.setHeader("Content-Disposition", `attachment; filename="arquivo"`);
      const buffer = await response.arrayBuffer();
      return res.send(Buffer.from(buffer));
    } catch (e) {
      return res.status(500).send("Erro.");
    }
  }

  return res.status(404).send("Ação não encontrada.");
}
