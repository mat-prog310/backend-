const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_51TzadmFFtKkgYApo2mqOUHq1ZmXLfI79u72gpi0DTuSjEerX69wup86NDbd5SxqDkA7ZCAErjBQ2Z7xH0l61MboC00Cop9j8p3');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4242;
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';

// ✅ Configuration CORS
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:4242',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'https://votre-domaine.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

// ✅ Middlewares
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

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
  console.log('✅ GET / reçu');
  res.json({
    status: 'OK',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    endpoints: {
      test: 'GET /test',
      payment: 'POST /create-payment-intent',
      health: 'GET /health',
      'test-payment': 'GET /test-payment',
      'get-payment-test': 'GET /create-payment-intent?amount=2000 (DEV ONLY)'
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

// ✅ Route de test Stripe (GET - UNIQUEMENT EN DEV)
app.get('/test-payment', async (req, res) => {
  if (!IS_DEVELOPMENT) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Cette route est uniquement disponible en développement'
    });
  }

  console.log('🧪 TEST: GET /test-payment');
  
  try {
    const amount = parseInt(req.query.amount) || 1000;
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
      metadata: {
        test: 'true',
        source: 'test-endpoint'
      }
    });

    console.log('✅ PaymentIntent de test créé:', paymentIntent.id);
    console.log('🔑 ClientSecret:', paymentIntent.client_secret);
    
    res.json({
      mode: 'test',
      message: '🧪 PaymentIntent de test créé avec succès',
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amount / 100,
      currency: 'EUR',
      status: paymentIntent.status,
      timestamp: new Date().toISOString(),
      instructions: {
        nextStep: 'Utilisez ce clientSecret avec Stripe.js pour finaliser le paiement',
        example: `stripe.confirmCardPayment('${paymentIntent.client_secret}', { payment_method: { card: cardElement } })`
      }
    });
  } catch (error) {
    console.error('❌ Erreur test Stripe:', error.message);
    res.status(500).json({
      error: error.message,
      type: error.type,
      code: error.code
    });
  }
});

// ============================================
// 2️⃣ ROUTE GET POUR LES TESTS (AVEC CONFIRMATION AUTO)
// ============================================

// ✅ Route GET pour les tests
app.get('/create-payment-intent', async (req, res) => {
  if (!IS_DEVELOPMENT) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Cette route est uniquement disponible en développement'
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
      
      // ⭐ CLIENT SECRET - Stocké automatiquement
      clientSecret: paymentIntent.client_secret,
      
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      paymentMethod: paymentMethodId,
      confirm: confirm,
      
      timestamp: new Date().toISOString(),
      
      // ✅ Instructions pour le frontend
     如何使用: {
        step1: 'Le clientSecret est automatiquement géré par StripeProvider',
        step2: 'Utilisez stripeProvider.confirmPayment() pour finaliser',
        example: `
// Dans votre Flutter app
await stripeProvider.confirmPayment(
  paymentMethodId: 'pm_card_visa',
);
// Le clientSecret est utilisé automatiquement !`,
        documentation: 'https://stripe.com/docs/payments/accept-a-payment'
      },
      
      debug: {
        endpoint: 'GET /create-payment-intent',
        environment: process.env.NODE_ENV || 'development'
      }
    });
  } catch (error) {
    console.error('❌ Erreur GET test:', error.message);
    
    res.status(500).json({
      error: error.message,
      type: error.type,
      code: error.code,
      message: 'Erreur lors de la création du PaymentIntent de test'
    });
  }
});

// ============================================
// 3️⃣ ROUTES DE PAIEMENT PRODUCTION
// ============================================

// ✅ Middleware de validation
app.all('/create-payment-intent', (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'POST') {
    return next();
  }
  
  if (req.method === 'GET') {
    return res.status(200).json({
      message: 'Utilisez la route GET /create-payment-intent?amount=2000 pour les tests'
    });
  }
  
  console.error(`⚠️ Requête ${req.method} sur /create-payment-intent - REJETÉE`);
  res.status(405).json({
    error: 'Method Not Allowed',
    message: 'Seules les requêtes POST sont acceptées pour les paiements réels'
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
    
    // ✅ Réponse avec clientSecret
    const response = {
      success: true,
      
      // ⭐ CLIENT SECRET - Auto-géré par le provider
      clientSecret: paymentIntent.client_secret,
      
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      created: new Date(paymentIntent.created * 1000).toISOString(),
      
      // ✅ Instructions pour le frontend
     如何使用: {
        step1: 'Le clientSecret est automatiquement stocké dans StripeProvider',
        step2: 'Confirmez le paiement avec StripeProvider.confirmPayment()',
        note: 'Le clientSecret est utilisé automatiquement, pas besoin de le manipuler'
      },
      
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
    console.log(`🔑 ClientSecret: ${paymentIntent.client_secret}`);
    
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

app.listen(PORT, () => {
  console.log('='.repeat(70));
  console.log(`✅ Serveur Stripe démarré sur http://localhost:${PORT}`);
  console.log(`📦 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🧪 Mode test: ${IS_DEVELOPMENT ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);
  console.log('='.repeat(70));
  console.log('');
  console.log('🔗 Endpoints disponibles:');
  console.log(`   GET  http://localhost:${PORT}/`);
  console.log(`   GET  http://localhost:${PORT}/health`);
  console.log(`   POST http://localhost:${PORT}/create-payment-intent`);
  
  if (IS_DEVELOPMENT) {
    console.log('');
    console.log('🧪 Endpoints de test:');
    console.log(`   GET  http://localhost:${PORT}/test-payment`);
    console.log(`   GET  http://localhost:${PORT}/create-payment-intent?amount=2000`);
    console.log(`   GET  http://localhost:${PORT}/create-payment-intent?amount=5000&currency=usd`);
    console.log(`   GET  http://localhost:${PORT}/payment-intent/:id`);
  }
  
  console.log('');
  console.log('📝 Exemples de commandes:');
  console.log('');
  console.log('1️⃣ Test rapide (GET - DEV UNIQUEMENT):');
  console.log(`   curl "http://localhost:${PORT}/create-payment-intent?amount=2000"`);
  console.log('');
  console.log('2️⃣ Vrai paiement (POST - TOUJOURS):');
  console.log(`   curl -X POST http://localhost:${PORT}/create-payment-intent \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"amount":2000, "currency":"eur"}'`);
  console.log('');
  console.log('3️⃣ Paiement avec confirmation automatique (POST):');
  console.log(`   curl -X POST http://localhost:${PORT}/create-payment-intent \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"amount":2000, "paymentMethodId":"pm_card_visa"}'`);
  console.log('');
  console.log('='.repeat(70));
  console.log('');
  console.log('🔑 Le clientSecret est automatiquement géré par StripeProvider');
  console.log('📱 Utilisez stripeProvider.confirmPayment() pour confirmer');
  console.log('   Le clientSecret est utilisé automatiquement !');
  console.log('='.repeat(70));
});

// ✅ Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection:', reason);
});

module.exports = app;
