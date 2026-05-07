const { Lead, Activity } = require('../models/crm');
const leadScoringService = require('../services/leadScoring.service');

// Get all leads with filters
exports.list = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      source,
      sortBy = 'createdAt',
      order = 'desc',
    } = req.query;

    const query = { tenantId: req.user.tenantId };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
      ];
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (source && source !== 'all') {
      query.source = source;
    }

    const skip = (page - 1) * limit;
    const sortOrder = order === 'desc' ? -1 : 1;

    const [leads, total] = await Promise.all([
      Lead.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit)),
      Lead.countDocuments(query),
    ]);

    res.json({
      leads,
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

// Get single lead
exports.get = async (req, res, next) => {
  try {
    const lead = await Lead.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    });

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    res.json(lead);
  } catch (error) {
    next(error);
  }
};

// Create lead
exports.create = async (req, res, next) => {
  try {
    const leadData = {
      ...req.body,
      tenantId: req.user.tenantId,
      assignedTo: req.body.assignedTo || req.user.id,
    };

    const lead = await Lead.create(leadData);

    // Calculate initial score
    const score = await leadScoringService.calculateScore(lead);
    lead.score = score;
    await lead.save();

    // Create activity
    await Activity.create({
      leadId: lead._id,
      type: 'created',
      description: `Lead created by ${req.user.name}`,
      createdBy: req.user.id,
    });

    res.status(201).json(lead);
  } catch (error) {
    next(error);
  }
};

// Update lead
exports.update = async (req, res, next) => {
  try {
    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    // Recalculate score if relevant fields changed
    if (req.body.status || req.body.value || req.body.source) {
      const score = await leadScoringService.calculateScore(lead);
      lead.score = score;
      await lead.save();
    }

    // Create activity
    await Activity.create({
      leadId: lead._id,
      type: 'updated',
      description: `Lead updated by ${req.user.name}`,
      createdBy: req.user.id,
    });

    res.json(lead);
  } catch (error) {
    next(error);
  }
};

// Delete lead
exports.remove = async (req, res, next) => {
  try {
    const lead = await Lead.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    });

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    // Delete associated activities
    await Activity.deleteMany({ leadId: lead._id });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// Get lead statistics
exports.stats = async (req, res, next) => {
  try {
    const query = { tenantId: req.user.tenantId };

    const [total, statusCounts, recentLeads] = await Promise.all([
      Lead.countDocuments(query),
      Lead.aggregate([
        { $match: query },
        { $group: { _id: '$status', count: { $sum: 1 }, totalValue: { $sum: '$value' } } },
      ]),
      Lead.find(query).sort({ createdAt: -1 }).limit(30),
    ]);

    const stats = {
      total,
      new: 0,
      contacted: 0,
      qualified: 0,
      proposal: 0,
      negotiation: 0,
      won: 0,
      lost: 0,
      totalValue: 0,
    };

    statusCounts.forEach((item) => {
      stats[item._id] = item.count;
      stats.totalValue += item.totalValue || 0;
    });

    // Calculate changes (last 7 days vs previous 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const [recentCount, previousCount] = await Promise.all([
      Lead.countDocuments({ ...query, createdAt: { $gte: sevenDaysAgo } }),
      Lead.countDocuments({
        ...query,
        createdAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo },
      }),
    ]);

    const calculateChange = (current, previous) => {
      if (previous === 0) return current > 0 ? '+100%' : '0%';
      const change = ((current - previous) / previous) * 100;
      return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
    };

    stats.totalChange = calculateChange(total, total - recentCount + previousCount);
    stats.newChange = calculateChange(recentCount, previousCount);

    res.json(stats);
  } catch (error) {
    next(error);
  }
};

// Get lead activities
exports.activities = async (req, res, next) => {
  try {
    const lead = await Lead.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    });

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    const activities = await Activity.find({ leadId: lead._id }).sort({
      createdAt: -1,
    });

    res.json({ activities });
  } catch (error) {
    next(error);
  }
};

// Add activity to lead
exports.addActivity = async (req, res, next) => {
  try {
    const lead = await Lead.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    });

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    const activity = await Activity.create({
      leadId: lead._id,
      ...req.body,
      createdBy: req.user.id,
    });

    res.status(201).json(activity);
  } catch (error) {
    next(error);
  }
};

// Convert lead to customer
exports.convert = async (req, res, next) => {
  try {
    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      { status: 'won' },
      { new: true }
    );

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    await Activity.create({
      leadId: lead._id,
      type: 'converted',
      description: `Lead converted to customer by ${req.user.name}`,
      createdBy: req.user.id,
    });

    res.json(lead);
  } catch (error) {
    next(error);
  }
};

// Calculate lead score
exports.score = async (req, res, next) => {
  try {
    const lead = await Lead.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    });

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    const score = await leadScoringService.calculateScore(lead);
    lead.score = score;
    await lead.save();

    res.json({ score });
  } catch (error) {
    next(error);
  }
};

// Import leads from CSV
exports.import = async (req, res, next) => {
  try {
    const { parse } = require('csv-parse/sync');
    
    if (!req.file) {
      return res.status(400).json({ message: 'No CSV file uploaded' });
    }

    // Parse CSV file
    const records = parse(req.file.buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (records.length === 0) {
      return res.status(400).json({ message: 'CSV file is empty' });
    }

    // Validate and prepare leads
    const leadsToImport = [];
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      // Validate required fields
      if (!record.name || !record.email) {
        errors.push({ row: i + 2, message: 'Name and email are required' });
        continue;
      }

      // Check for duplicate email in tenant
      const existingLead = await Lead.findOne({
        email: record.email,
        tenantId: req.user.tenantId,
      });

      if (existingLead) {
        errors.push({ row: i + 2, message: `Email ${record.email} already exists` });
        continue;
      }

      leadsToImport.push({
        name: record.name,
        email: record.email,
        phone: record.phone || '',
        company: record.company || '',
        status: record.status || 'new',
        source: record.source || 'import',
        value: parseFloat(record.value) || 0,
        notes: record.notes || '',
        assignedTo: record.assignedTo || req.user.id,
        tenantId: req.user.tenantId,
      });
    }

    // Bulk insert leads
    let imported = [];
    if (leadsToImport.length > 0) {
      imported = await Lead.insertMany(leadsToImport);

      // Calculate scores for imported leads
      for (const lead of imported) {
        const score = await leadScoringService.calculateScore(lead);
        lead.score = score;
        await lead.save();

        // Create activity
        await Activity.create({
          leadId: lead._id,
          type: 'imported',
          description: `Lead imported from CSV by ${req.user.name}`,
          createdBy: req.user.id,
        });
      }
    }

    res.json({
      message: 'Import completed',
      imported: imported.length,
      errors: errors.length,
      details: errors,
    });
  } catch (error) {
    next(error);
  }
};

// Export leads to CSV
exports.export = async (req, res, next) => {
  try {
    const query = { tenantId: req.user.tenantId };

    if (req.query.status && req.query.status !== 'all') {
      query.status = req.query.status;
    }

    const leads = await Lead.find(query);

    // Simple CSV generation
    const csv = [
      'Name,Email,Phone,Company,Status,Source,Value,Score,Created',
      ...leads.map((lead) =>
        [
          lead.name,
          lead.email,
          lead.phone,
          lead.company,
          lead.status,
          lead.source,
          lead.value,
          lead.score,
          lead.createdAt.toISOString(),
        ].join(',')
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=leads.csv');
    res.send(csv);
  } catch (error) {
    next(error);
  }
};
