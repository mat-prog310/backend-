const express = require('express');
const stripe = require('stripe')('sk_test_51TzadmFFtKkgYApo2mqOUHq1ZmXLfI79u72gpi0DTuSjEerX69wup86NDbd5SxqDkA7ZCAErjBQ2Z7xH0l61MboC00Cop9j8p3');
const cors = require('cors');

const app = express();
const PORT = 4242;

// ✅ CORS + JSON
app.use(cors());
app.use(express.json());

// ✅ Route de base pour tester
app.get('/', (req, res) => {
  res.send('✅ Backend Stripe OK');
});

// ✅ Endpoint principal
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, paymentMethodId } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'amount is required' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: parseInt(amount),
      currency: 'eur',
      payment_method: paymentMethodId || 'pm_card_visa',
      confirm: true,
      automatic_payment_methods: { enabled: true },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
  console.log(`🔗 Test: http://localhost:${PORT}/`);
});
