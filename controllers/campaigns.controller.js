const crmModels = require('../models/crm');
const createCrudController = require('./crudController');

const campaignModels = {
  email: 'EmailCampaign',
  whatsapp: 'WhatsAppCampaign',
  facebook: 'FacebookCampaign',
};

exports.crud = (type) => createCrudController(campaignModels[type]);

async function updateCampaign(type, req, status) {
  return crmModels[campaignModels[type]].findOneAndUpdate(
    { _id: req.params.id, tenantId: req.tenantId },
    { status },
    { new: true }
  );
}

exports.send = (type) => async (req, res, next) => {
  try {
    const campaign = await updateCampaign(type, req, 'active');
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    return res.json(campaign);
  } catch (error) {
    return next(error);
  }
};

exports.pause = (type) => async (req, res, next) => {
  try {
    const campaign = await updateCampaign(type, req, 'paused');
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    return res.json(campaign);
  } catch (error) {
    return next(error);
  }
};

exports.resume = (type) => async (req, res, next) => {
  try {
    const campaign = await updateCampaign(type, req, 'active');
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    return res.json(campaign);
  } catch (error) {
    return next(error);
  }
};

exports.stats = (type) => async (req, res, next) => {
  try {
    const campaign = await crmModels[campaignModels[type]].findOne({ _id: req.params.id, tenantId: req.tenantId }).lean();
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    return res.json(campaign.stats || {});
  } catch (error) {
    return next(error);
  }
};
