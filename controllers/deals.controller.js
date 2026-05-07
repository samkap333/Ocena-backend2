const { Deal, Customer, Lead, Activity, Product } = require('../models/crm');
const mongoose = require('mongoose');

function cleanDealPayload(data) {
  const payload = { ...data };
  ['customerId', 'leadId', 'ownerId'].forEach((field) => {
    if (!payload[field] || !mongoose.Types.ObjectId.isValid(payload[field])) {
      delete payload[field];
    }
  });
  ['expectedCloseDate', 'actualCloseDate'].forEach((field) => {
    if (payload[field] === '') {
      delete payload[field];
    }
  });
  return payload;
}

// Get all deals
exports.list = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      stage,
      ownerId,
      sortBy = 'createdAt',
      order = 'desc',
    } = req.query;

    const query = { tenantId: req.user.tenantId };

    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    if (stage && stage !== 'all') {
      query.stage = stage;
    }

    if (ownerId && ownerId !== 'all') {
      query.ownerId = ownerId;
    }

    const skip = (page - 1) * limit;
    const sortOrder = order === 'desc' ? -1 : 1;

    const [deals, total] = await Promise.all([
      Deal.find(query)
        .populate('customerId', 'name email companyName')
        .populate('leadId', 'name email')
        .populate('ownerId', 'name email avatar')
        .populate('products', 'name unitPrice')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit)),
      Deal.countDocuments(query),
    ]);

    res.json({
      deals,
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

// Get single deal
exports.get = async (req, res, next) => {
  try {
    const deal = await Deal.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    })
      .populate('customerId', 'name email companyName phone')
      .populate('leadId', 'name email phone')
      .populate('ownerId', 'name email avatar')
      .populate('products', 'name sku unitPrice type');

    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }

    // Get activities
    const activities = await Activity.find({
      type: 'deal_activity',
      'metadata.dealId': deal._id,
    }).sort({ createdAt: -1 }).limit(20);

    res.json({ deal, activities });
  } catch (error) {
    next(error);
  }
};

// Create deal
exports.create = async (req, res, next) => {
  try {
    const dealData = {
      ...cleanDealPayload(req.body),
      tenantId: req.user.tenantId,
      ownerId: req.body.ownerId || req.user.id,
    };

    const deal = await Deal.create(dealData);

    // Create activity
    await Activity.create({
      type: 'deal_created',
      description: `Deal "${deal.title}" created by ${req.user.name}`,
      createdBy: req.user.id,
      metadata: { dealId: deal._id },
    });

    res.status(201).json(deal);
  } catch (error) {
    next(error);
  }
};

// Update deal
exports.update = async (req, res, next) => {
  try {
    const oldDeal = await Deal.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    });

    if (!oldDeal) {
      return res.status(404).json({ message: 'Deal not found' });
    }

    const deal = await Deal.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      cleanDealPayload(req.body),
      { new: true, runValidators: true }
    );

    // Log stage change
    if (oldDeal.stage !== deal.stage) {
      await Activity.create({
        type: 'deal_stage_changed',
        description: `Deal stage changed from ${oldDeal.stage} to ${deal.stage}`,
        createdBy: req.user.id,
        metadata: { dealId: deal._id, oldStage: oldDeal.stage, newStage: deal.stage },
      });
    }

    // Log won/lost
    if (deal.stage === 'won' && oldDeal.stage !== 'won') {
      deal.actualCloseDate = new Date();
      await deal.save();
      
      await Activity.create({
        type: 'deal_won',
        description: `Deal won! Value: ${deal.value} ${deal.currency}`,
        createdBy: req.user.id,
        metadata: { dealId: deal._id },
      });
    }

    if (deal.stage === 'lost' && oldDeal.stage !== 'lost') {
      deal.actualCloseDate = new Date();
      await deal.save();
      
      await Activity.create({
        type: 'deal_lost',
        description: `Deal lost. Reason: ${deal.lostReason || 'Not specified'}`,
        createdBy: req.user.id,
        metadata: { dealId: deal._id },
      });
    }

    res.json(deal);
  } catch (error) {
    next(error);
  }
};

// Delete deal
exports.remove = async (req, res, next) => {
  try {
    const deal = await Deal.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    });

    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// Get deal statistics
exports.stats = async (req, res, next) => {
  try {
    const query = { tenantId: req.user.tenantId };

    const [total, stageCounts, valueByStage] = await Promise.all([
      Deal.countDocuments(query),
      Deal.aggregate([
        { $match: query },
        { $group: { _id: '$stage', count: { $sum: 1 } } },
      ]),
      Deal.aggregate([
        { $match: query },
        { $group: { _id: '$stage', totalValue: { $sum: '$value' } } },
      ]),
    ]);

    const stats = {
      total,
      prospecting: 0,
      qualified: 0,
      proposal: 0,
      negotiation: 0,
      won: 0,
      lost: 0,
      totalValue: 0,
      wonValue: 0,
      lostValue: 0,
    };

    stageCounts.forEach((item) => {
      stats[item._id] = item.count;
    });

    valueByStage.forEach((item) => {
      stats.totalValue += item.totalValue;
      if (item._id === 'won') stats.wonValue = item.totalValue;
      if (item._id === 'lost') stats.lostValue = item.totalValue;
    });

    // Calculate win rate
    const totalClosed = stats.won + stats.lost;
    stats.winRate = totalClosed > 0 ? ((stats.won / totalClosed) * 100).toFixed(1) : 0;

    res.json(stats);
  } catch (error) {
    next(error);
  }
};

// Get pipeline view (grouped by stage)
exports.pipeline = async (req, res, next) => {
  try {
    const query = { tenantId: req.user.tenantId };

    if (req.query.ownerId && req.query.ownerId !== 'all') {
      query.ownerId = req.query.ownerId;
    }

    const deals = await Deal.find(query)
      .populate('customerId', 'name email companyName')
      .populate('ownerId', 'name email avatar')
      .sort({ createdAt: -1 });

    // Group by stage
    const pipeline = {
      prospecting: [],
      qualified: [],
      proposal: [],
      negotiation: [],
      won: [],
      lost: [],
    };

    deals.forEach((deal) => {
      if (pipeline[deal.stage]) {
        pipeline[deal.stage].push(deal);
      }
    });

    res.json(pipeline);
  } catch (error) {
    next(error);
  }
};

// Convert lead to deal
exports.convertFromLead = async (req, res, next) => {
  try {
    const { leadId, title, value, expectedCloseDate } = req.body;

    const lead = await Lead.findOne({
      _id: leadId,
      tenantId: req.user.tenantId,
    });

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    // Create deal from lead
    const deal = await Deal.create({
      title: title || `Deal with ${lead.name}`,
      leadId: lead._id,
      stage: 'qualified',
      value: value || lead.value || 0,
      expectedCloseDate: expectedCloseDate || null,
      ownerId: lead.assignedTo,
      tenantId: req.user.tenantId,
    });

    // Update lead status
    lead.status = 'qualified';
    await lead.save();

    await Activity.create({
      leadId: lead._id,
      type: 'converted_to_deal',
      description: `Lead converted to deal by ${req.user.name}`,
      createdBy: req.user.id,
    });

    res.status(201).json(deal);
  } catch (error) {
    next(error);
  }
};
