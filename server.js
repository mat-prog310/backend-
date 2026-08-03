const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_51TzadmFFtKkgYApo2mqOUHq1ZmXLfI79u72gpi0DTuSjEerX69wup86NDbd5SxqDkA7ZCAErjBQ2Z7xH0l61MboC00Cop9j8p3');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4242;
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';

// ✅ Configuration CORS complète
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:4242',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'https://votre-domaine.com' // À remplacer par votre domaine
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

// ✅ Logger amélioré
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
// 1️⃣ ROUTES DE TEST (UNIQUEMENT EN DÉVELOPPEMENT)
// ============================================

// ✅ Route de test simple
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

// ✅ Endpoint de santé
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
    
    res.json({
      mode: 'test',
      message: '🧪 PaymentIntent de test créé avec succès',
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amount / 100,
      currency: 'EUR',
      status: paymentIntent.status,
      timestamp: new Date().toISOString()
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
// 2️⃣ ROUTE GET POUR LES TESTS (ALIAS)
// ============================================

// ✅ Route GET pour les tests (UNIQUEMENT EN DÉVELOPPEMENT)
app.get('/create-payment-intent', async (req, res) => {
  // Bloquer en production
  if (!IS_DEVELOPMENT) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Cette route est uniquement disponible en développement'
    });
  }

  console.log('🧪 GET /create-payment-intent (mode test)');
  
  try {
    // Récupérer les paramètres de la query string
    const amount = parseInt(req.query.amount) || 1000; // 10€ par défaut
    const currency = req.query.currency || 'eur';
    const paymentMethodId = req.query.paymentMethodId || 'pm_card_visa';
    const confirm = req.query.confirm !== 'false'; // true par défaut

    // Validation
    if (amount < 50) {
      return res.status(400).json({
        error: 'amount too small',
        message: 'Le montant minimum est de 0.50€ (50 cents)'
      });
    }

    console.log(`💳 Création PaymentIntent de test: ${amount} ${currency}`);
    
    // Créer le PaymentIntent
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
    console.log(`   Status: ${paymentIntent.status}`);
    console.log(`   Amount: ${paymentIntent.amount / 100} ${paymentIntent.currency}`);
    
    res.json({
      mode: 'test',
      message: '✅ PaymentIntent créé via GET (mode test)',
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      paymentMethod: paymentMethodId,
      confirm: confirm,
      timestamp: new Date().toISOString(),
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

// ✅ Middleware de validation pour /create-payment-intent (POST uniquement)
app.all('/create-payment-intent', (req, res, next) => {
  // Autoriser OPTIONS pour CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Accepter POST en production ET en développement
  if (req.method === 'POST') {
    return next();
  }
  
  // Si c'est GET, on a déjà une route spécifique ci-dessus
  // Donc on ne devrait pas arriver ici pour GET
  if (req.method === 'GET') {
    // Cette route est déjà gérée plus haut
    // Mais si on arrive ici, c'est qu'il y a un problème
    console.warn('⚠️ GET /create-payment-intent déjà traité plus haut');
    return res.status(200).json({
      message: 'Utilisez la route GET /create-payment-intent?amount=2000 pour les tests'
    });
  }
  
  // Rejeter toutes les autres méthodes
  console.error(`⚠️ Requête ${req.method} sur /create-payment-intent - REJETÉE`);
  res.status(405).json({
    error: 'Method Not Allowed',
    message: 'Seules les requêtes POST sont acceptées pour les paiements réels'
  });
});

// ✅ Endpoint principal de paiement (POST)
app.post('/create-payment-intent', async (req, res) => {
  console.log('🔥 POST /create-payment-intent reçu');
  
  // ⏱️ Timeout
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

    // ✅ Validation de l'amount
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

    if (paymentMethodId) {
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
    console.log(`   Status: ${paymentIntent.status}`);
    console.log(`   Amount: ${paymentIntent.amount / 100} ${paymentIntent.currency}`);
    
    const response = {
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
// 4️⃣ ROUTES DE GESTION DES PAIEMENTS
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
    
    res.json({
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      created: new Date(paymentIntent.created * 1000).toISOString(),
      metadata: paymentIntent.metadata
    });
  } catch (error) {
    res.status(404).json({
      error: 'PaymentIntent not found',
      message: error.message
    });
  }
});

// ============================================
// 5️⃣ DÉMARRAGE DU SERVEUR
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
  console.log('2️⃣ Test avec paramètres (GET - DEV UNIQUEMENT):');
  console.log(`   curl "http://localhost:${PORT}/create-payment-intent?amount=5000&currency=usd"`);
  console.log('');
  console.log('3️⃣ Vrai paiement (POST - TOUJOURS):');
  console.log(`   curl -X POST http://localhost:${PORT}/create-payment-intent \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"amount":2000, "currency":"eur"}'`);
  console.log('');
  console.log('4️⃣ Paiement avec carte spécifique (POST):');
  console.log(`   curl -X POST http://localhost:${PORT}/create-payment-intent \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"amount":2000, "paymentMethodId":"pm_card_visa"}'`);
  console.log('');
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
