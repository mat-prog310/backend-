const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_51TzadmFFtKkgYApo2mqOUHq1ZmXLfI79u72gpi0DTuSjEerX69wup86NDbd5SxqDkA7ZCAErjBQ2Z7xH0l61MboC00Cop9j8p3');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4242;
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';

// ✅ CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// ✅ Logger
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`📥 [${timestamp}] ${req.method} ${req.path}`);
  if (req.method !== 'GET' && req.body && Object.keys(req.body).length > 0) {
    const safeBody = { ...req.body };
    if (safeBody.paymentMethodId) safeBody.paymentMethodId = '***';
    if (safeBody.clientSecret) safeBody.clientSecret = '***';
    console.log('   Body:', safeBody);
  }
  if (req.method === 'GET' && req.query && Object.keys(req.query).length > 0) {
    console.log('   Query:', req.query);
  }
  next();
});

// ============================================
// 1️⃣ ROUTES DE TEST
// ============================================

app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: '🚀 API Stripe en ligne sur Railway',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      payment: 'POST /create-payment-intent',
      test: 'GET /create-payment-intent?amount=2000'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    stripe: 'connected',
    environment: process.env.NODE_ENV || 'development'
  });
});

// ============================================
// 2️⃣ ROUTE GET POUR LES TESTS (AUTORISÉE TOUJOURS)
// ============================================

// ✅ GET autorisé même en production (pour les tests rapides)
app.get('/create-payment-intent', async (req, res) => {
  console.log('🧪 GET /create-payment-intent');

  try {
    const amount = parseInt(req.query.amount) || 1000;
    const currency = req.query.currency || 'eur';
    const paymentMethodId = req.query.paymentMethodId || 'pm_card_visa';

    if (amount < 50) {
      return res.status(400).json({
        error: 'amount too small',
        message: 'Le montant minimum est de 0.50€ (50 cents)',
        minAmount: 50
      });
    }

    console.log(`💳 Création PaymentIntent: ${amount} ${currency}`);
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: currency,
      payment_method: paymentMethodId,
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: {
        test: 'true',
        source: 'get-endpoint',
        timestamp: new Date().toISOString()
      }
    });

    console.log(`✅ PaymentIntent créé: ${paymentIntent.id}`);
    console.log(`🔑 ClientSecret: ${paymentIntent.client_secret}`);
    console.log(`   Status: ${paymentIntent.status}`);
    console.log(`   Amount: ${paymentIntent.amount / 100} ${paymentIntent.currency}`);

    res.json({
      success: true,
      mode: process.env.NODE_ENV || 'development',
      message: '✅ PaymentIntent créé avec GET',
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      paymentMethod: paymentMethodId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    res.status(500).json({
      error: error.message,
      type: error.type,
      code: error.code
    });
  }
});

// ============================================
// 3️⃣ ROUTE POST - PAYEMENT PRINCIPAL
// ============================================

// ✅ Middleware pour POST
app.all('/create-payment-intent', (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'POST') {
    return next();
  }
  
  // GET est déjà géré plus haut
  if (req.method === 'GET') {
    return next();
  }
  
  res.status(405).json({
    error: 'Method Not Allowed',
    message: 'Seules les requêtes POST sont acceptées'
  });
});

// ✅ Endpoint POST
app.post('/create-payment-intent', async (req, res) => {
  console.log('🔥 POST /create-payment-intent reçu');
  
  const timeout = setTimeout(() => {
    console.error('⏰ TIMEOUT: Stripe API ne répond pas');
    res.status(504).json({
      error: 'Stripe API timeout',
      message: 'Le serveur Stripe ne répond pas'
    });
  }, 15000);

  try {
    const { 
      amount, 
      currency = 'eur', 
      paymentMethodId,
      metadata = {},
      description,
      customerId,
      testMode = false
    } = req.body;

    if (!amount) {
      clearTimeout(timeout);
      return res.status(400).json({ 
        error: 'amount is required',
        message: 'Le montant est obligatoire'
      });
    }

    const amountNum = parseInt(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      clearTimeout(timeout);
      return res.status(400).json({ 
        error: 'amount must be a positive number',
        message: 'Le montant doit être un nombre positif'
      });
    }

    if (amountNum < 50) {
      clearTimeout(timeout);
      return res.status(400).json({
        error: 'amount too small',
        message: 'Le montant minimum est de 0.50€ (50 cents)'
      });
    }

    console.log(`💳 Création PaymentIntent: ${amountNum} ${currency}`);
    
    const paymentIntentOptions = {
      amount: amountNum,
      currency: currency,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: {
        source: 'api',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        test_mode: testMode ? 'true' : 'false',
        ...metadata
      }
    };

    if (paymentMethodId) {
      console.log(`💳 Confirmation automatique avec: ${paymentMethodId}`);
      paymentIntentOptions.payment_method = paymentMethodId;
      paymentIntentOptions.confirm = true;
    }

    if (customerId) {
      paymentIntentOptions.customer = customerId;
    }

    if (description) {
      paymentIntentOptions.description = description;
    }

    console.log('🏦 Appel Stripe API...');
    const paymentIntent = await stripe.paymentIntents.create(paymentIntentOptions);

    clearTimeout(timeout);
    console.log(`✅ PaymentIntent créé: ${paymentIntent.id}`);
    console.log(`🔑 ClientSecret: ${paymentIntent.client_secret}`);
    console.log(`   Status: ${paymentIntent.status}`);
    console.log(`   Amount: ${paymentIntent.amount / 100} ${paymentIntent.currency}`);
    
    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      created: new Date(paymentIntent.created * 1000).toISOString()
    });

  } catch (error) {
    clearTimeout(timeout);
    
    console.error('❌ ERREUR STRIPE:', {
      message: error.message,
      type: error.type,
      code: error.code,
      statusCode: error.statusCode
    });

    const errorResponse = {
      success: false,
      error: error.message,
      type: error.type,
      code: error.code
    };

    if (error.code === 'card_declined') {
      errorResponse.message = 'La carte a été refusée';
    } else if (error.code === 'incorrect_cvc') {
      errorResponse.message = 'Code de sécurité incorrect';
    } else if (error.code === 'expired_card') {
      errorResponse.message = 'La carte est expirée';
    } else if (error.code === 'insufficient_funds') {
      errorResponse.message = 'Fonds insuffisants';
    }

    res.status(error.statusCode || 500).json(errorResponse);
  }
});

// ============================================
// 4️⃣ ROUTES DE GESTION
// ============================================

app.get('/payment-intent/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const paymentIntent = await stripe.paymentIntents.retrieve(id);
    
    res.json({
      success: true,
      id: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      created: new Date(paymentIntent.created * 1000).toISOString(),
      metadata: paymentIntent.metadata
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: 'PaymentIntent not found',
      message: error.message
    });
  }
});

// ============================================
// 5️⃣ DÉMARRAGE
// ============================================

app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(70));
  console.log(`✅ Serveur Stripe démarré`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`📦 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log('='.repeat(70));
  console.log('');
  console.log('🔗 Endpoints:');
  console.log(`   GET  /`);
  console.log(`   GET  /health`);
  console.log(`   GET  /create-payment-intent?amount=2000`);
  console.log(`   POST /create-payment-intent`);
  console.log('');
  console.log('📝 Exemple GET (50€):');
  console.log(`   https://backend-production-06803.up.railway.app/create-payment-intent?amount=5000`);
  console.log('');
  console.log('='.repeat(70));
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection:', reason);
});

module.exports = app;
