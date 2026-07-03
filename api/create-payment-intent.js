const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000,
      currency: "brl",
      automatic_payment_methods: {
        enabled: true
      }
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};