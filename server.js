const express = require('express');
const stripe = require('stripe')('sk_test_ticuleCléSecreteStripe'); // ✅ Remplace par TA clé secrète
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 4242;

// Middleware
app.use(cors({ origin: true })); // Autorise toutes les origines (à ajuster en prod)
app.use(bodyParser.json());

// ✅ Endpoint pour créer + confirmer un PaymentIntent avec PaymentMethod
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, paymentMethodId, userId, plan } = req.body;

    if (!amount || !paymentMethodId) {
      return res.status(400).json({
        error: 'Missing required parameters: amount or paymentMethodId'
      });
    }

    // 🔥 Créer et confirmer le PaymentIntent en une seule étape
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,              // Montant en centimes (ex: 5000 = 50.00€)
      currency: 'eur',             // Devise
      payment_method: paymentMethodId,  // 👈 ID du PaymentMethod reçu de Flutter
      confirm: true,               // 👈 Confirme automatiquement !
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      // 📝 Métadonnées pour ton système de tokens
      metadata: {
        user_id: userId || 'unknown',
        plan: plan || 'unknown',
      },
      // 💳 Capture immédiate
      capture_method: 'automatic',
    });

    // ✅ Retourner le clientSecret au frontend
    res.json({
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
      paymentIntentId: paymentIntent.id,
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

// 🏍️ Endpoint pour créer UNIQUEMENT le PaymentIntent (sans confirmation)
app.post('/create-payment-intent-only', async (req, res) => {
  try {
    const { amount, userId, plan } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Missing amount' });
    }

    // Créer le PaymentIntent SANS confirmation
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'eur',
      // ❌ PAS de payment_method ici
      // ❌ PAS de confirm: true ici
      metadata: {
        user_id: userId || 'unknown',
        plan: plan || 'unknown',
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
    res.status(500).json({ error: error.message });
  }
});

// 🌐 Démarrer le serveur
app.listen(PORT, () => {
  console.log(`✅ Serveur Stripe démarré sur http://localhost:${PORT}`);
  console.log(`🔗 Test endpoint: http://localhost:${PORT}/create-payment-intent`);
});
