const express = require('express');
const stripe = require('stripe')('sk_test_51TzadmFFtKkgYApo2mqOUHq1ZmXLfI79u72gpi0DTuSjEerX69wup86NDbd5SxqDkA7ZCAErjBQ2Z7xH0l61MboC00Cop9j8p3');
const cors = require('cors');

const app = express();
const PORT = 4242;

// ✅ CORS plus permissif + logs
app.use(cors());
app.use(express.json());

// ✅ Route de test
app.get('/', (req, res) => {
  console.log('✅ Ping reçu !');
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ✅ Endpoint principal avec logs
app.post('/create-payment-intent', async (req, res) => {
  console.log('📥 Requête reçue:', req.body);

  try {
    const { amount, paymentMethodId, userId, plan } = req.body;

    if (!amount) {
      console.error('❌ amount manquant');
      return res.status(400).json({ error: 'amount is required' });
    }

    console.log('🔥 Création PaymentIntent...');
    const paymentIntent = await stripe.paymentIntents.create({
      amount: parseInt(amount),
      currency: 'eur',
      payment_method: paymentMethodId || 'pm_card_visa', // ID de test si manquant
      confirm: true,
      automatic_payment_methods: { enabled: true },
      metadata: { user_id: userId || 'test', plan: plan || 'test' },
    });

    console.log('✅ PaymentIntent créé:', paymentIntent.id);
    res.json({
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
    });

  } catch (error) {
    console.error('❌ ERREUR:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Serveur sur http://localhost:${PORT}`);
  console.log(`🌐 Test avec: http://localhost:${PORT}/`);
});
