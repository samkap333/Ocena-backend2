require('dotenv').config();
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { Tenant, User } = require('../models/crm');

const DEFAULT_PASSWORD = 'Admin12345';

const users = [
  { email: 'business@ocena.in', name: 'Business Admin', role: 'ADMIN' },
  { email: 'admin@ocena.in', name: 'Ocena Admin', role: 'ADMIN' },
  { email: 'aditya2.ocena@gmail.com', name: 'Aditya CRM Manager', role: 'MANAGER' },
  { email: 'testing.ocena@gmail.com', name: 'Testing Sales User', role: 'SALES' },
];

async function seedCrmUsers() {
  const mongoUri = process.env.MONGO_URI;
  await mongoose.connect(mongoUri);

  let tenant = await Tenant.findOne({ subdomain: 'ocena' });
  if (!tenant) {
    tenant = await Tenant.create({
      name: 'Ocena CRM Workspace',
      subdomain: 'ocena',
      settings: {
        timezone: 'Asia/Kolkata',
        currency: 'USD',
      },
    });
  }

  const password = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  for (const user of users) {
    await User.findOneAndUpdate(
      { email: user.email },
      {
        ...user,
        password,
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
    console.log(`Upserted ${user.email} as ${user.role}`);
  }

  await mongoose.disconnect();
}

seedCrmUsers().catch(async (error) => {
  console.error('Failed to seed CRM users:', error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
