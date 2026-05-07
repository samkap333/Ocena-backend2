const crmModels = require('../models/crm');
const createCrudController = require('./crudController');
const emailService = require('../services/email.service');
const smsService = require('../services/sms.service');
const { Lead } = require('../models/crm');

const campaignModels = {
  email: 'EmailCampaign',
  whatsapp: 'WhatsAppCampaign',
  facebook: 'FacebookCampaign',
};

exports.crud = (type) => createCrudController(campaignModels[type]);

async function updateCampaign(type, req, status) {
  // Validate campaign ID
  if (!req.params.id || req.params.id === 'undefined' || req.params.id === 'null') {
    throw new Error('Invalid campaign ID');
  }
  
  return crmModels[campaignModels[type]].findOneAndUpdate(
    { _id: req.params.id, tenantId: req.tenantId },
    { status },
    { new: true }
  );
}

exports.send = (type) => async (req, res, next) => {
  try {
    // Validate campaign ID
    if (!req.params.id || req.params.id === 'undefined' || req.params.id === 'null') {
      return res.status(400).json({ message: 'Invalid campaign ID' });
    }

    const campaign = await crmModels[campaignModels[type]].findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Get target leads
    const { leadIds, status: leadStatus } = req.body;
    let leads = [];

    if (leadIds && leadIds.length > 0) {
      leads = await Lead.find({ _id: { $in: leadIds }, tenantId: req.tenantId });
    } else if (leadStatus) {
      leads = await Lead.find({ status: leadStatus, tenantId: req.tenantId });
    } else {
      leads = await Lead.find({ tenantId: req.tenantId });
    }

    if (leads.length === 0) {
      return res.status(400).json({ message: 'No leads found to send campaign' });
    }

    // Initialize stats
    const stats = {
      sent: 0,
      failed: 0,
      total: leads.length,
    };

    // Send campaign based on type
    if (type === 'email') {
      for (const lead of leads) {
        if (!lead.email) {
          stats.failed++;
          continue;
        }

        try {
          await emailService.sendEmail({
            to: lead.email,
            subject: campaign.subject,
            html: campaign.content.replace(/\{\{name\}\}/g, lead.name),
          });
          stats.sent++;
        } catch (error) {
          console.error(`Failed to send email to ${lead.email}:`, error);
          stats.failed++;
        }
      }
    } else if (type === 'whatsapp') {
      for (const lead of leads) {
        if (!lead.phone) {
          stats.failed++;
          continue;
        }

        try {
          await smsService.sendWhatsApp(
            lead.phone,
            campaign.message.replace(/\{\{name\}\}/g, lead.name)
          );
          stats.sent++;
        } catch (error) {
          console.error(`Failed to send WhatsApp to ${lead.phone}:`, error);
          stats.failed++;
        }
      }
    } else if (type === 'facebook') {
      // Facebook campaigns are managed externally via Facebook Ads Manager
      // Just update status
      stats.sent = leads.length;
    }

    // Update campaign with stats
    campaign.status = 'active';
    campaign.stats = {
      ...campaign.stats,
      sent: (campaign.stats?.sent || 0) + stats.sent,
      failed: (campaign.stats?.failed || 0) + stats.failed,
      total: (campaign.stats?.total || 0) + stats.total,
      lastSent: new Date(),
    };
    await campaign.save();

    return res.json({
      message: 'Campaign sent successfully',
      campaign,
      stats,
    });
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
    // Validate campaign ID
    if (!req.params.id || req.params.id === 'undefined' || req.params.id === 'null') {
      return res.status(400).json({ message: 'Invalid campaign ID' });
    }

    const campaign = await crmModels[campaignModels[type]].findOne({ _id: req.params.id, tenantId: req.tenantId }).lean();
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    return res.json(campaign.stats || {});
  } catch (error) {
    return next(error);
  }
};
