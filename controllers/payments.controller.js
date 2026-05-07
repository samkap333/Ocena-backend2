const { Payment, Invoice } = require('../models/crm');
const paymentService = require('../services/payment.service');

// Get all payments
exports.list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const query = { tenantId: req.user.tenantId };

    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate('invoiceId', 'number total')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Payment.countDocuments(query),
    ]);

    res.json({
      payments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get single payment
exports.get = async (req, res, next) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    }).populate('invoiceId', 'number total leadId');

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    res.json(payment);
  } catch (error) {
    next(error);
  }
};

// Create payment
exports.create = async (req, res, next) => {
  try {
    const payment = await Payment.create({
      ...req.body,
      tenantId: req.user.tenantId,
    });

    // Update invoice status if fully paid
    if (payment.invoiceId) {
      const invoice = await Invoice.findById(payment.invoiceId);
      if (invoice) {
        const totalPaid = await Payment.aggregate([
          { $match: { invoiceId: invoice._id, status: 'completed' } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);

        if (totalPaid.length > 0 && totalPaid[0].total >= invoice.total) {
          invoice.status = 'paid';
          await invoice.save();
        }
      }
    }

    res.status(201).json(payment);
  } catch (error) {
    next(error);
  }
};

// Process payment (Stripe integration)
exports.process = async (req, res, next) => {
  try {
    const { invoiceId, amount, method, paymentMethodId } = req.body;

    const invoice = await Invoice.findOne({
      _id: invoiceId,
      tenantId: req.user.tenantId,
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Process payment through Stripe
    const result = await paymentService.processPayment({
      amount,
      currency: 'usd',
      paymentMethodId,
      description: `Payment for invoice ${invoice.number}`,
    });

    // Create payment record
    const payment = await Payment.create({
      invoiceId: invoice._id,
      amount,
      method,
      status: result.status === 'succeeded' ? 'completed' : 'pending',
      transactionId: result.id,
      tenantId: req.user.tenantId,
    });

    // Update invoice status
    if (result.status === 'succeeded') {
      const totalPaid = await Payment.aggregate([
        { $match: { invoiceId: invoice._id, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);

      if (totalPaid.length > 0 && totalPaid[0].total >= invoice.total) {
        invoice.status = 'paid';
        await invoice.save();
      }
    }

    res.json({ payment, transaction: result });
  } catch (error) {
    next(error);
  }
};
