const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_51TzadmFFtKkgYApo2mqOUHq1ZmXLfI79u72gpi0DTuSjEerX69wup86NDbd5SxqDkA7ZCAErjBQ2Z7xH0l61MboC00Cop9j8p3');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4242;
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';

// ✅ MIDDLEWARE SIMPLIFIÉ (plus rapide)
app.use(cors({
  origin: '*', // ⚠️ TEMPORAIRE pour les tests
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: '*',
  credentials: true,
}));

// ✅ MIDDLEWARE EXPRESS AVEC TIMEOUT RÉDUIT
app.use(express.json({ limit: '10mb' }));

// ✅ LOGGER SIMPLIFIÉ
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path}`);
  next();
});

// ============================================
// ROUTES RAPIDES
// ============================================

// ✅ Route de test RAPIDE
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: '✅ Serveur Stripe fonctionne !'
  });
});

// ✅ Health check RAPIDE
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    stripe: 'connected'
  });
});

// ✅ Route GET pour les tests (RAPIDE)
app.get('/create-payment-intent', async (req, res) => {
  if (!IS_DEVELOPMENT) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const amount = parseInt(req.query.amount) || 1000;
    const currency = req.query.currency || 'eur';
    const paymentMethodId = req.query.paymentMethodId || 'pm_card_visa';

    console.log(`💳 Création PaymentIntent: ${amount} ${currency}`);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: currency,
      payment_method: paymentMethodId,
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: { test: 'true' }
    });

    console.log(`✅ PaymentIntent créé: ${paymentIntent.id}`);
    console.log(`🔑 ClientSecret: ${paymentIntent.client_secret}`);

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      status: paymentIntent.status
    });

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Route POST pour les paiements (RAPIDE)
app.post('/create-payment-intent', async (req, res) => {
  console.log('🔥 POST /create-payment-intent');

  try {
    const { amount, currency = 'eur', paymentMethodId } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'amount is required' });
    }

    const amountNum = parseInt(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: 'amount must be positive' });
    }

    console.log(`💳 Création PaymentIntent: ${amountNum} ${currency}`);

    const paymentIntentOptions = {
      amount: amountNum,
      currency: currency,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: { source: 'api' }
    };

    if (paymentMethodId) {
      paymentIntentOptions.payment_method = paymentMethodId;
      paymentIntentOptions.confirm = true;
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentOptions);

    console.log(`✅ PaymentIntent créé: ${paymentIntent.id}`);
    console.log(`🔑 ClientSecret: ${paymentIntent.client_secret}`);

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency
    });

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Route GET pour récupérer un PaymentIntent
app.get('/payment-intent/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const paymentIntent = await stripe.paymentIntents.retrieve(id);
    
    res.json({
      id: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency
    });
  } catch (error) {
    res.status(404).json({ error: 'PaymentIntent not found' });
  }
});

// ============================================
// DÉMARRAGE - ÉCOUTE SUR TOUTES LES INTERFACES
// ============================================

// ✅ Démarrer le serveur sur toutes les interfaces
app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(60));
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
  console.log(`✅ Accessible sur http://192.168.102.248:${PORT}`);
  console.log(`📦 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log('='.repeat(60));
  console.log('');
  console.log('🔗 Tester depuis le navigateur du téléphone :');
  console.log(`   http://192.168.102.248:${PORT}/health`);
  console.log('');
  console.log('📝 Commandes de test:');
  console.log(`   GET:  curl http://localhost:${PORT}/create-payment-intent?amount=2000`);
  console.log(`   POST: curl -X POST http://localhost:${PORT}/create-payment-intent -H "Content-Type: application/json" -d '{"amount":2000}'`);
  console.log('='.repeat(60));
});

// ✅ Gestion des erreurs
process.on('uncaughtException', (error) => {
  console.error('💥 Erreur non capturée:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Rejet non géré:', reason);
});
