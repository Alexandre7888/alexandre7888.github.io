// api/add-to-workspace.js
export default async function handler(req, res) {
  const { id, token, owner } = req.query;
  
  try {
    // Chama o worker para criar a referência
    const response = await fetch("https://proud-flower-677b.braatzjunioralexandre5.workers.dev/api/workspace/add-reference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenid: token, fileId: id, ownerUid: owner || "root" })
    });

    const data = await response.json();
    if (data.ok) {
      res.setHeader("Content-Type", "text/html");
      return res.send(`<script>alert('${data.mensagem}'); window.location.href='https://codehub.giize.com/workspace.html';</script>`);
    }
    
    res.status(400).send(data.erro);
  } catch (e) {
    res.status(500).send("Erro ao adicionar.");
  }
}
