const models = require('../models/crm');

const tenantScopedModels = new Set([
  'Lead',
  'Invoice',
  'Payment',
  'Task',
  'EmailCampaign',
  'WhatsAppCampaign',
  'FacebookCampaign',
  'SheetConnection',
  'Workflow',
  'Ticket',
]);

function tenantWhere(model, req, extra = {}) {
  return tenantScopedModels.has(model) ? { tenantId: req.tenantId, ...extra } : extra;
}

function createCrudController(model) {
  const Model = models[model];

  return {
    list: async (req, res, next) => {
      try {
        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 20);
        const where = tenantWhere(model, req, req.query.status ? { status: req.query.status } : {});
        const [items, total] = await Promise.all([
          Model.find(where).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
          Model.countDocuments(where),
        ]);
        res.json({ data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
      } catch (error) {
        next(error);
      }
    },
    get: async (req, res, next) => {
      try {
        const item = await Model.findOne(tenantWhere(model, req, { _id: req.params.id })).lean();
        if (!item) return res.status(404).json({ message: 'Record not found' });
        return res.json(item);
      } catch (error) {
        return next(error);
      }
    },
    create: async (req, res, next) => {
      try {
        const data = tenantScopedModels.has(model) ? { ...req.body, tenantId: req.tenantId } : req.body;
        const item = await Model.create(data);
        return res.status(201).json(item);
      } catch (error) {
        return next(error);
      }
    },
    update: async (req, res, next) => {
      try {
        const item = await Model.findOneAndUpdate(
          tenantWhere(model, req, { _id: req.params.id }),
          req.body,
          { new: true, runValidators: true }
        );
        if (!item) return res.status(404).json({ message: 'Record not found' });
        return res.json(item);
      } catch (error) {
        return next(error);
      }
    },
    remove: async (req, res, next) => {
      try {
        const existing = await Model.findOneAndDelete(tenantWhere(model, req, { _id: req.params.id }));
        if (!existing) return res.status(404).json({ message: 'Record not found' });
        return res.status(204).send();
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = createCrudController;
