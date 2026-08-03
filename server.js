const express = require('express');
const stripe = require('stripe')('sk_test_51TzadmFFtKkgYApo2mqOUHq1ZmXLfI79u72gpi0DTuSjEerX69wup86NDbd5SxqDkA7ZCAErjBQ2Z7xH0l61MboC00Cop9j8p3');
const cors = require('cors');

const app = express();
const PORT = 4242;

// ✅ Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// ✅ Route de test
app.get('/', (req, res) => {
  console.log('✅ Ping reçu !');
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ✅ Endpoint principal
app.post('/create-payment-intent', async (req, res) => {
  console.log('📥 Requête reçue:', req.body);

  try {
    const { amount, paymentMethodId } = req.body;

    if (!amount) {
      console.error('❌ amount manquant');
      return res.status(400).json({ error: 'amount is required' });
    }

    console.log('🔥 Création du PaymentIntent...');
    const paymentIntent = await stripe.paymentIntents.create({
      amount: parseInt(amount),
      currency: 'eur',
      payment_method: paymentMethodId || 'pm_card_visa',
      confirm: true,
      automatic_payment_methods: { enabled: true },
    });

    console.log('✅ PaymentIntent créé:', paymentIntent.id);
    res.json({
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
    });

  } catch (error) {
    console.error('❌ Erreur Stripe:', error);
    res.status(500).json({
      error: error.message,
      type: error.type,
      code: error.code,
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
  console.log(`🔗 Test: curl http://localhost:${PORT}/`);
});
