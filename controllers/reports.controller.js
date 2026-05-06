const mongoose = require('mongoose');
const { Invoice, Lead, Task } = require('../models/crm');

function tenantObjectId(tenantId) {
  return mongoose.Types.ObjectId.isValid(tenantId) ? new mongoose.Types.ObjectId(tenantId) : tenantId;
}

exports.overview = async (req, res, next) => {
  try {
    const [leads, invoices, tasks] = await Promise.all([
      Lead.countDocuments({ tenantId: req.tenantId }),
      Invoice.countDocuments({ tenantId: req.tenantId }),
      Task.countDocuments({ tenantId: req.tenantId }),
    ]);
    return res.json({ leads, invoices, tasks });
  } catch (error) {
    return next(error);
  }
};

exports.leads = async (req, res, next) => {
  try {
    const grouped = await Lead.aggregate([
      { $match: { tenantId: tenantObjectId(req.tenantId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { _id: 0, status: '$_id', count: 1 } },
    ]);
    return res.json({ funnel: grouped });
  } catch (error) {
    return next(error);
  }
};

exports.revenue = async (req, res, next) => {
  try {
    const invoices = await Invoice.find({ tenantId: req.tenantId }).select('total status createdAt').lean();
    return res.json({ invoices });
  } catch (error) {
    return next(error);
  }
};

exports.performance = async (req, res) => {
  return res.json({ team: [] });
};

exports.exportReport = async (req, res) => {
  res.setHeader('Content-Type', req.query.format === 'pdf' ? 'application/pdf' : 'text/csv');
  res.send(req.query.format === 'pdf' ? Buffer.from('') : 'metric,value\n');
};
