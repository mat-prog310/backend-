const express = require('express');
const stripe = require('stripe')('sk_test_51TzadmFFtKkgYApo2mqOUHq1ZmXLfI79u72gpi0DTuSjEerX69wup86NDbd5SxqDkA7ZCAErjBQ2Z7xH0l61MboC00Cop9j8p3');
const cors = require('cors');

const app = express();
const PORT = 4242;

// ✅ Middleware amélioré
app.use(cors({ origin: true }));
app.use(express.json({ limit: '10mb' })); // 👈 Augmente la limite

// ✅ Logs pour TOUTES les requêtes
app.use((req, res, next) => {
  console.log(`📥 [${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (req.body) console.log('   Body:', req.body);
  next();
});

// ✅ Route de test
app.get('/', (req, res) => {
  console.log('✅ GET / reçu');
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ✅ Endpoint avec GESTION DES ERREURS COMPLÈTE
app.post('/create-payment-intent', async (req, res) => {
  console.log('🔥 POST /create-payment-intent reçu');

  // ⏱️ Timeout manuel au cas où
  const timeout = setTimeout(() => {
    console.error('⏰ TIMEOUT: Stripe API ne répond pas');
    res.status(504).json({ error: 'Stripe API timeout' });
  }, 10000); // 10 secondes

  try {
    console.log('📦 Body:', req.body);
    const { amount, paymentMethodId } = req.body;

    if (!amount) {
      clearTimeout(timeout);
      console.error('❌ amount manquant');
      return res.status(400).json({ error: 'amount is required' });
    }

    console.log('💳 Création du PaymentIntent avec amount:', amount);

    // ✅ Vérifie que amount est un nombre
    const amountNum = parseInt(amount);
    if (isNaN(amountNum)) {
      clearTimeout(timeout);
      console.error('❌ amount n\'est pas un nombre:', amount);
      return res.status(400).json({ error: 'amount must be a number' });
    }

    console.log('🏦 Appel Stripe API...');
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountNum,
      currency: 'eur',
      payment_method: paymentMethodId || 'pm_card_visa',
      confirm: true,
      automatic_payment_methods: { enabled: true },
    });

    clearTimeout(timeout);
    console.log('✅ PaymentIntent créé:', paymentIntent.id);
    console.log('   Status:', paymentIntent.status);
    console.log('   ClientSecret:', paymentIntent.client_secret.substring(0, 10) + '...');

    res.json({
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
      paymentIntentId: paymentIntent.id,
    });

  } catch (error) {
    clearTimeout(timeout);
    console.error('❌ ERREUR STRIPE:', {
      message: error.message,
      type: error.type,
      code: error.code,
      stack: error.stack,
    });
    res.status(500).json({
      error: error.message,
      type: error.type,
      code: error.code,
      details: error.details,
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
  console.log(`🔗 Teste avec:`);
  console.log(`   GET:  curl http://localhost:${PORT}/`);
  console.log(`   POST: curl -X POST http://localhost:${PORT}/create-payment-intent -H \"Content-Type: application/json\" -d '{\"amount\":2000}'`);
});
