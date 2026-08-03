const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_51TzadmFFtKkgYApo2mqOUHq1ZmXLfI79u72gpi0DTuSjEerX69wup86NDbd5SxqDkA7ZCAErjBQ2Z7xH0l61MboC00Cop9j8p3');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4242;
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';

// ✅ CORS pour toutes les origines (Railway + local)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ✅ Middleware
app.use(express.json({ limit: '10mb' }));

// ✅ Logger simplifié
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

// ✅ Route racine
app.get('/', (req, res) => {
  console.log('✅ GET / reçu');
  res.json({
    status: 'OK',
    message: '🚀 API Stripe en ligne sur Railway',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      payment: 'POST /create-payment-intent',
      test: 'GET /create-payment-intent?amount=2000 (DEV ONLY)'
    }
  });
});

// ✅ Health check pour Railway
app.get('/health', (req, res) => {
  console.log('💚 Health check');
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    stripe: 'connected',
    environment: process.env.NODE_ENV || 'development'
  });
});

// ============================================
// 2️⃣ ROUTE GET POUR LES TESTS (DEV UNIQUEMENT)
// ============================================

app.get('/create-payment-intent', async (req, res) => {
  // ⚠️ Bloqué en production sur Railway
  if (!IS_DEVELOPMENT) {
    console.log('⚠️ GET /create-payment-intent bloqué en production');
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: 'Utilisez POST pour les paiements en production'
    });
  }

  console.log('🧪 GET /create-payment-intent (mode test)');
  
  try {
    const amount = parseInt(req.query.amount) || 1000;
    const currency = req.query.currency || 'eur';
    const paymentMethodId = req.query.paymentMethodId || 'pm_card_visa';
    const confirm = req.query.confirm !== 'false';

    if (amount < 50) {
      return res.status(400).json({
        error: 'amount too small',
        message: 'Le montant minimum est de 0.50€ (50 cents)'
      });
    }

    console.log(`💳 Création PaymentIntent de test: ${amount} ${currency}`);
    
    const paymentIntentOptions = {
      amount: amount,
      currency: currency,
      payment_method: paymentMethodId,
      confirm: confirm,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: {
        test: 'true',
        source: 'get-alias',
        timestamp: new Date().toISOString()
      }
    };

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentOptions);

    console.log(`✅ PaymentIntent de test créé: ${paymentIntent.id}`);
    console.log(`🔑 ClientSecret: ${paymentIntent.client_secret}`);
    console.log(`   Status: ${paymentIntent.status}`);
    console.log(`   Amount: ${paymentIntent.amount / 100} ${paymentIntent.currency}`);
    
    res.json({
      success: true,
      mode: 'test',
      message: '✅ PaymentIntent créé via GET (mode test)',
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      paymentMethod: paymentMethodId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Erreur GET test:', error.message);
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

// ✅ Middleware pour POST uniquement
app.all('/create-payment-intent', (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'POST') {
    return next();
  }
  
  // GET déjà géré plus haut
  if (req.method === 'GET') {
    return next(); // laisse passer vers la route GET
  }
  
  console.error(`⚠️ Requête ${req.method} sur /create-payment-intent - REJETÉE`);
  res.status(405).json({
    error: 'Method Not Allowed',
    message: 'Seules les requêtes POST sont acceptées pour les paiements'
  });
});

// ✅ Endpoint principal de paiement (POST)
app.post('/create-payment-intent', async (req, res) => {
  console.log('🔥 POST /create-payment-intent reçu');
  
  const timeout = setTimeout(() => {
    console.error('⏰ TIMEOUT: Stripe API ne répond pas');
    res.status(504).json({
      error: 'Stripe API timeout',
      message: 'Le serveur Stripe ne répond pas, veuillez réessayer'
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

    // ✅ Validation
    if (!amount) {
      clearTimeout(timeout);
      console.error('❌ amount manquant');
      return res.status(400).json({ 
        error: 'amount is required',
        message: 'Le montant est obligatoire'
      });
    }

    const amountNum = parseInt(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      clearTimeout(timeout);
      console.error('❌ amount invalide:', amount);
      return res.status(400).json({ 
        error: 'amount must be a positive number',
        message: 'Le montant doit être un nombre positif'
      });
    }

    if (amountNum < 50) {
      clearTimeout(timeout);
      console.error('❌ Montant trop petit:', amountNum);
      return res.status(400).json({
        error: 'amount too small',
        message: 'Le montant minimum est de 0.50€ (50 cents)'
      });
    }

    console.log(`💳 Création du PaymentIntent: ${amountNum} ${currency}`);
    
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

    // ✅ Si paymentMethodId est fourni, confirmer automatiquement
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
    
    // ✅ Réponse
    const response = {
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      created: new Date(paymentIntent.created * 1000).toISOString(),
      ...(IS_DEVELOPMENT && {
        debug: {
          testMode: testMode,
          environment: process.env.NODE_ENV || 'development'
        }
      })
    };

    res.json(response);

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

    // Messages d'erreur personnalisés
    if (error.code === 'card_declined') {
      errorResponse.message = 'La carte a été refusée';
      errorResponse.solution = 'Essayez une autre carte ou vérifiez les informations';
    } else if (error.code === 'incorrect_cvc') {
      errorResponse.message = 'Code de sécurité incorrect';
      errorResponse.solution = 'Vérifiez le CVC de votre carte';
    } else if (error.code === 'expired_card') {
      errorResponse.message = 'La carte est expirée';
      errorResponse.solution = 'Utilisez une carte non expirée';
    } else if (error.code === 'insufficient_funds') {
      errorResponse.message = 'Fonds insuffisants';
      errorResponse.solution = 'Vérifiez le solde de votre compte';
    }

    res.status(error.statusCode || 500).json(errorResponse);
  }
});

// ============================================
// 4️⃣ ROUTES DE GESTION
// ============================================

// ✅ Récupérer un PaymentIntent
app.get('/payment-intent/:id', async (req, res) => {
  // Sécuriser en production
  if (!IS_DEVELOPMENT) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Cette route est réservée au développement'
    });
  }

  try {
    const { id } = req.params;
    const paymentIntent = await stripe.paymentIntents.retrieve(id);
    
    console.log(`🔍 Récupération du PaymentIntent: ${id}`);
    
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
  console.log(`✅ Serveur Stripe démarré sur Railway`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`📦 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🧪 Mode test: ${IS_DEVELOPMENT ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);
  console.log('='.repeat(70));
  console.log('');
  console.log('🔗 Endpoints disponibles:');
  console.log(`   GET  /`);
  console.log(`   GET  /health`);
  console.log(`   POST /create-payment-intent`);
  
  if (IS_DEVELOPMENT) {
    console.log(`   GET  /create-payment-intent?amount=2000`);
  }
  
  console.log('');
  console.log('📝 Exemples:');
  console.log(`   POST /create-payment-intent`);
  console.log(`   Body: {"amount":2000, "currency":"eur"}`);
  console.log('');
  console.log('='.repeat(70));
});

// ✅ Gestion des erreurs
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection:', reason);
});

module.exports = app;
