// Initialize Stripe only if API key is provided
let stripe = null;

const getStripeClient = () => {
  if (!stripe) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    
    if (!apiKey) {
      throw new Error('Stripe API key not configured. Please set STRIPE_SECRET_KEY in your .env file.');
    }
    
    stripe = require('stripe')(apiKey);
  }
  
  return stripe;
};

/**
 * Process payment through Stripe
 */
exports.processPayment = async ({ amount, currency = 'usd', paymentMethodId, description }) => {
  try {
    const stripeClient = getStripeClient();
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      payment_method: paymentMethodId,
      confirm: true,
      description,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
    });

    return {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
    };
  } catch (error) {
    console.error('Stripe payment error:', error);
    throw new Error(error.message || 'Payment processing failed');
  }
};

/**
 * Create payment intent (for client-side confirmation)
 */
exports.createPaymentIntent = async ({ amount, currency = 'usd', customerId, description }) => {
  try {
    const stripeClient = getStripeClient();
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      customer: customerId,
      description,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id,
    };
  } catch (error) {
    console.error('Stripe payment intent error:', error);
    throw new Error(error.message || 'Failed to create payment intent');
  }
};

/**
 * Create Stripe customer
 */
exports.createCustomer = async ({ email, name, metadata }) => {
  try {
    const stripeClient = getStripeClient();
    const customer = await stripeClient.customers.create({
      email,
      name,
      metadata,
    });

    return customer;
  } catch (error) {
    console.error('Stripe customer creation error:', error);
    throw new Error(error.message || 'Failed to create customer');
  }
};

/**
 * Retrieve payment details
 */
exports.getPayment = async (paymentIntentId) => {
  try {
    const stripeClient = getStripeClient();
    const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);

    return {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      created: new Date(paymentIntent.created * 1000),
    };
  } catch (error) {
    console.error('Stripe retrieve payment error:', error);
    throw new Error(error.message || 'Failed to retrieve payment');
  }
};

/**
 * Refund payment
 */
exports.refundPayment = async (paymentIntentId, amount) => {
  try {
    const stripeClient = getStripeClient();
    const refund = await stripeClient.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined,
    });

    return {
      id: refund.id,
      status: refund.status,
      amount: refund.amount / 100,
    };
  } catch (error) {
    console.error('Stripe refund error:', error);
    throw new Error(error.message || 'Failed to process refund');
  }
};
