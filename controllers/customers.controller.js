const { Customer, Lead, Deal, Invoice, Payment, Ticket } = require('../models/crm');

// Get all customers
exports.list = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      lifecycleStage,
      type,
      sortBy = 'createdAt',
      order = 'desc',
    } = req.query;

    const query = { tenantId: req.user.tenantId };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } },
      ];
    }

    if (lifecycleStage && lifecycleStage !== 'all') {
      query.lifecycleStage = lifecycleStage;
    }

    if (type && type !== 'all') {
      query.type = type;
    }

    const skip = (page - 1) * limit;
    const sortOrder = order === 'desc' ? -1 : 1;

    const [customers, total] = await Promise.all([
      Customer.find(query)
        .populate('ownerId', 'name email')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit)),
      Customer.countDocuments(query),
    ]);

    res.json({
      customers,
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

// Get single customer with related data
exports.get = async (req, res, next) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    }).populate('ownerId', 'name email avatar');

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Get related data
    const [leads, deals, tickets] = await Promise.all([
      Lead.find({ 
        $or: [
          { email: customer.email },
          { phone: customer.phone }
        ],
        tenantId: req.user.tenantId 
      }).limit(10),
      Deal.find({ customerId: customer._id }).limit(10),
      Ticket.find({ 
        $or: [
          { email: customer.email },
          { customerId: customer._id }
        ]
      }).limit(10),
    ]);
    const invoices = await Invoice.find({ leadId: { $in: leads.map((lead) => lead._id) } }).limit(10);
    const payments = await Payment.find({ invoiceId: { $in: invoices.map((invoice) => invoice._id) } }).limit(10);

    res.json({
      customer,
      related: {
        leads,
        deals,
        invoices,
        payments,
        tickets,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Create customer
exports.create = async (req, res, next) => {
  try {
    const customerData = {
      ...req.body,
      tenantId: req.user.tenantId,
      ownerId: req.body.ownerId || req.user.id,
    };

    const customer = await Customer.create(customerData);

    res.status(201).json(customer);
  } catch (error) {
    next(error);
  }
};

// Update customer
exports.update = async (req, res, next) => {
  try {
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json(customer);
  } catch (error) {
    next(error);
  }
};

// Delete customer
exports.remove = async (req, res, next) => {
  try {
    const customer = await Customer.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// Get customer statistics
exports.stats = async (req, res, next) => {
  try {
    const query = { tenantId: req.user.tenantId };

    const [total, stageCounts] = await Promise.all([
      Customer.countDocuments(query),
      Customer.aggregate([
        { $match: query },
        { $group: { _id: '$lifecycleStage', count: { $sum: 1 } } },
      ]),
    ]);

    const stats = {
      total,
      lead: 0,
      prospect: 0,
      customer: 0,
      inactive: 0,
    };

    stageCounts.forEach((item) => {
      stats[item._id] = item.count;
    });

    res.json(stats);
  } catch (error) {
    next(error);
  }
};

// Convert lead to customer
exports.convertFromLead = async (req, res, next) => {
  try {
    const { leadId } = req.body;

    const lead = await Lead.findOne({
      _id: leadId,
      tenantId: req.user.tenantId,
    });

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    // Check if customer already exists
    const existingCustomer = await Customer.findOne({
      email: lead.email,
      tenantId: req.user.tenantId,
    });

    if (existingCustomer) {
      return res.status(400).json({ message: 'Customer already exists with this email' });
    }

    // Create customer from lead
    const customer = await Customer.create({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      companyName: lead.company,
      type: lead.company ? 'company' : 'individual',
      lifecycleStage: 'customer',
      source: lead.source,
      tags: lead.tags,
      customFields: lead.customFields,
      ownerId: lead.assignedTo,
      tenantId: req.user.tenantId,
    });

    // Update lead status
    lead.status = 'won';
    await lead.save();

    res.status(201).json(customer);
  } catch (error) {
    next(error);
  }
};
