require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();

app.use(cors());
app.use(express.json());

// Middleware pour logger les requêtes
app.use((req, res, next) => {
  console.log('Request:', req.method, req.path, req.body);
  next();
});

app.post('/create-payment-intent', async (req, res) => {
  try {
    console.log('Body received:', req.body);
    if (!req.body || !req.body.amount) {
      return res.status(400).json({ error: 'Missing amount in request body' });
    }
    const { amount } = req.body;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'eur',
      payment_method_types: ['card'],
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Stripe backend sur http://0.0.0.0:${PORT}`);
});
