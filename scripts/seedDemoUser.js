require('dotenv').config();
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { Tenant, User } = require('../models/crm');

const DEMO_EMAIL = 'demo@ocena.com';
const DEMO_PASSWORD = 'demo123';

async function seedDemoUser() {
  const mongoUri = process.env.MONGO_URI;
  await mongoose.connect(mongoUri);

  let tenant = await Tenant.findOne({ subdomain: 'demo' });
  if (!tenant) {
    tenant = await Tenant.create({
      name: 'Ocena Demo Workspace',
      subdomain: 'demo',
      settings: {
        timezone: 'Asia/Kolkata',
        currency: 'USD',
      },
    });
  }

  const password = await bcrypt.hash(DEMO_PASSWORD, 12);
  await User.findOneAndUpdate(
    { email: DEMO_EMAIL },
    {
      email: DEMO_EMAIL,
      password,
      name: 'Demo Admin',
      role: 'ADMIN',
      tenantId: tenant._id,
      preferences: {
        notifications: true,
        timezone: 'Asia/Kolkata',
        language: 'en',
        currency: 'USD',
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  console.log(`Seeded CRM demo user: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  await mongoose.disconnect();
}

seedDemoUser().catch(async (error) => {
  console.error('Failed to seed CRM demo user:', error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
