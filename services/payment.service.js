const Stripe = require('stripe');

function stripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || '');
}

exports.processPayment = async ({ amount, currency = 'usd', paymentMethodId, metadata = {} }) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { status: 'skipped', message: 'Stripe is not configured' };
  }

  return stripe().paymentIntents.create({
    amount,
    currency,
    payment_method: paymentMethodId,
    confirm: Boolean(paymentMethodId),
    metadata,
  });
};
