const express = require('express');
const stripe = require('stripe')('sk_test_51TzadmFFtKkgYApo2mqOUHq1ZmXLfI79u72gpi0DTuSjEerX69wup86NDbd5SxqDkA7ZCAErjBQ2Z7xH0l61MboC00Cop9j8p3');
const cors = require('cors');

const app = express();
const PORT = 4242;

// ✅ Middleware optimisé
app.use(cors({ origin: true }));
app.use(express.json({ limit: '10mb' }));

// ✅ Endpoint avec timeout et logs détaillés
app.post('/create-payment-intent', async (req, res) => {
  console.log('🔍 [DEBUT] Requête reçue à', new Date().toISOString());

  // ⏱️ Timeout après 10 secondes
  const timeout = setTimeout(() => {
    console.log('⏰ Timeout atteint !');
    res.status(408).json({ error: 'Request timeout' });
  }, 10000);

  try {
    console.log('📦 Body reçu:', JSON.stringify(req.body, null, 2));

    const { amount, paymentMethodId, userId, plan } = req.body;

    if (!amount) {
      clearTimeout(timeout);
      console.error('❌ amount manquant');
      return res.status(400).json({ error: 'amount is required' });
    }

    if (!paymentMethodId) {
      clearTimeout(timeout);
      console.error('❌ paymentMethodId manquant');
      return res.status(400).json({ error: 'paymentMethodId is required' });
    }

    console.log('🔥 Création du PaymentIntent...');
    console.time('Stripe API');

    // ✅ Créer le PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: parseInt(amount),  // ⚠️ Convertir en nombre
      currency: 'eur',
      payment_method: paymentMethodId,
      confirm: true,
      automatic_payment_methods: { enabled: true },
      metadata: { user_id: userId || 'unknown', plan: plan || 'unknown' },
    });

    console.timeEnd('Stripe API');
    console.log('✅ PaymentIntent créé:', paymentIntent.id, '| Status:', paymentIntent.status);

    clearTimeout(timeout);

    res.json({
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
      paymentIntentId: paymentIntent.id,
    });

  } catch (error) {
    clearTimeout(timeout);
    console.error('❌ ERREUR COMPLÈTE:', {
      message: error.message,
      type: error.type,
      code: error.code,
      stack: error.stack,
    });

    res.status(500).json({
      error: error.message,
      type: error.type,
      code: error.code,
    });
  }
});

// 🌐 Démarrer avec vérification
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📡 Test: curl -X POST http://localhost:${PORT}/create-payment-intent \\
    -H "Content-Type: application/json" \\
    -d '{"amount":5000,"paymentMethodId":"pm_card_visa"}'`);
});
