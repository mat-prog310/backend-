// server.js (ou ton fichier backend)
const express = require('express');
const stripe = require('stripe')('sk_test_t methyleneTaCleSecrete');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Créer un PaymentIntent avec confirmation automatique
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, paymentMethodId } = req.body;

    // Créer le PaymentIntent avec confirm=true
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,  // En centimes (ex: 5000 = 50.00€)
      currency: 'eur',
      payment_method: paymentMethodId,  // 👈 Middle de paiement fourni
      confirm: true,  // 👈 Confirme automatiquement !
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      // Métadonnées optionnelles pour ton système de tokens
      metadata: {
        user_id: req.body.userId,
        plan: req.body.plan,
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
    });

  } catch (error) {
    console.error('Erreur Stripe:', error);
    res.status(400).json({ error: error.message });
  }
});

app.listen(4242, () => console.log('Serveur Stripe sur http://localhost:4242'));
