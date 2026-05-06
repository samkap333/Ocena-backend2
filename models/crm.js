const mongoose = require('mongoose');

const { Schema } = mongoose;

const json = Schema.Types.Mixed;
const objectId = Schema.Types.ObjectId;

const tenantSchema = new Schema({
  name: { type: String, required: true },
  subdomain: { type: String, unique: true, sparse: true },
  settings: json,
}, { timestamps: true });

const userSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  phone: String,
  avatar: String,
  role: { type: String, enum: ['ADMIN', 'MANAGER', 'SALES', 'SUPPORT'], default: 'SALES' },
  tenantId: { type: objectId, ref: 'Tenant', required: true, index: true },
  refreshToken: String,
  preferences: json,
}, { timestamps: true });

const leadSchema = new Schema({
  name: { type: String, required: true },
  email: String,
  phone: String,
  company: String,
  status: { type: String, default: 'new', index: true },
  source: String,
  value: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  notes: String,
  assignedTo: String,
  tenantId: { type: objectId, ref: 'Tenant', required: true, index: true },
}, { timestamps: true });

const activitySchema = new Schema({
  leadId: { type: objectId, ref: 'Lead', required: true, index: true },
  type: { type: String, required: true },
  description: { type: String, required: true },
  scheduledAt: Date,
  createdBy: String,
}, { timestamps: { createdAt: true, updatedAt: false } });

const invoiceSchema = new Schema({
  leadId: { type: objectId, ref: 'Lead' },
  number: { type: String, required: true },
  items: { type: [json], default: [] },
  subtotal: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  status: { type: String, default: 'draft', index: true },
  dueDate: Date,
  tenantId: { type: objectId, ref: 'Tenant', required: true, index: true },
}, { timestamps: true });

invoiceSchema.index({ tenantId: 1, number: 1 }, { unique: true });

const paymentSchema = new Schema({
  invoiceId: { type: objectId, ref: 'Invoice' },
  amount: { type: Number, required: true },
  method: { type: String, required: true },
  status: { type: String, default: 'pending', index: true },
  transactionId: String,
  tenantId: { type: objectId, ref: 'Tenant', index: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

const taskSchema = new Schema({
  title: { type: String, required: true },
  description: String,
  status: { type: String, default: 'open', index: true },
  priority: { type: String, default: 'medium' },
  assignedTo: String,
  dueDate: Date,
  tenantId: { type: objectId, ref: 'Tenant', required: true, index: true },
}, { timestamps: true });

const campaignBase = {
  name: { type: String, required: true },
  status: { type: String, default: 'draft', index: true },
  stats: { type: json, default: {} },
  tenantId: { type: objectId, ref: 'Tenant', required: true, index: true },
};

const emailCampaignSchema = new Schema({
  ...campaignBase,
  subject: { type: String, required: true },
  content: { type: String, required: true },
}, { timestamps: true });

const whatsAppCampaignSchema = new Schema({
  ...campaignBase,
  message: { type: String, required: true },
}, { timestamps: true });

const facebookCampaignSchema = new Schema({
  ...campaignBase,
  objective: String,
  budget: { type: Number, default: 0 },
  startDate: Date,
  endDate: Date,
}, { timestamps: true });

const sheetConnectionSchema = new Schema({
  name: { type: String, required: true },
  sheetId: { type: String, required: true },
  sheetUrl: String,
  status: { type: String, default: 'connected' },
  lastSync: Date,
  syncDirection: { type: String, default: 'both' },
  autoSync: { type: Boolean, default: true },
  tenantId: { type: objectId, ref: 'Tenant', required: true, index: true },
}, { timestamps: true });

const workflowSchema = new Schema({
  name: { type: String, required: true },
  trigger: { type: json, required: true },
  actions: { type: [json], default: [] },
  enabled: { type: Boolean, default: false },
  tenantId: { type: objectId, ref: 'Tenant', required: true, index: true },
}, { timestamps: true });

const ticketSchema = new Schema({
  subject: { type: String, required: true },
  description: String,
  status: { type: String, default: 'open', index: true },
  priority: { type: String, default: 'medium' },
  assignedTo: String,
  tenantId: { type: objectId, ref: 'Tenant', required: true, index: true },
}, { timestamps: true });

const ticketMessageSchema = new Schema({
  ticketId: { type: objectId, ref: 'Ticket', required: true, index: true },
  message: { type: String, required: true },
  createdBy: String,
}, { timestamps: { createdAt: true, updatedAt: false } });

const notificationSchema = new Schema({
  userId: { type: objectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false, index: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = {
  Tenant: mongoose.models.Tenant || mongoose.model('Tenant', tenantSchema),
  User: mongoose.models.User || mongoose.model('User', userSchema),
  Lead: mongoose.models.Lead || mongoose.model('Lead', leadSchema),
  Activity: mongoose.models.Activity || mongoose.model('Activity', activitySchema),
  Invoice: mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema),
  Payment: mongoose.models.Payment || mongoose.model('Payment', paymentSchema),
  Task: mongoose.models.Task || mongoose.model('Task', taskSchema),
  EmailCampaign: mongoose.models.EmailCampaign || mongoose.model('EmailCampaign', emailCampaignSchema),
  WhatsAppCampaign: mongoose.models.WhatsAppCampaign || mongoose.model('WhatsAppCampaign', whatsAppCampaignSchema),
  FacebookCampaign: mongoose.models.FacebookCampaign || mongoose.model('FacebookCampaign', facebookCampaignSchema),
  SheetConnection: mongoose.models.SheetConnection || mongoose.model('SheetConnection', sheetConnectionSchema),
  Workflow: mongoose.models.Workflow || mongoose.model('Workflow', workflowSchema),
  Ticket: mongoose.models.Ticket || mongoose.model('Ticket', ticketSchema),
  TicketMessage: mongoose.models.TicketMessage || mongoose.model('TicketMessage', ticketMessageSchema),
  Notification: mongoose.models.Notification || mongoose.model('Notification', notificationSchema),
};
