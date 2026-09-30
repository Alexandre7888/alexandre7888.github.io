export default async function handler(req, res) {
  const googleUrl =
    "https://docs.google.com/spreadsheets/d/1hbJf2P67V6SpRJIcc04Ck0EinH5iNRHV4XDZQZB__i0/gviz/tq?tqx=out:json";

  try {
    const response = await fetch(googleUrl);
    const text = await response.text();

    const jsonText = text
      .replace(/^[\s\S]*?setResponse\(/, "")
      .replace(/\);\s*$/, "");

    const data = JSON.parse(jsonText);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json; charset=utf-8");

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      error: "Erro ao buscar a planilha",
      details: error.message
    });
  }
}