module.exports = async (req, res) => {

  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      erro: "Método não permitido"
    });
  }

  try {

    const response = await fetch(
      "https://api.stripe.com/v1/payment_intents",
      {
        method:"POST",

        headers:{
          Authorization:
            "Bearer " +
            process.env.STRIPE_SECRET_KEY,

          "Content-Type":
            "application/x-www-form-urlencoded"
        },

        body:
          "amount=2500" +
          "&currency=brl" +
          "&payment_method_types[]=pix"
      }
    );

    const data = await response.json();

    res.status(200).json(data);

  } catch (e) {

    res.status(500).json({
      erro:e.message
    });

  }

};
