require('dotenv').config();
const mongoose = require('mongoose');
const googleChatService = require('../services/googleChat.service');

const mongoUri = process.env.MONGO_URI || 'mongodb+srv://nandaniocena:husnsalon@cluster0.iq7z74o.mongodb.net/ocenacrm?appName=Cluster0';
const spaceId = 'spaces/AAQAPS5LtCQ';
const tenantId = '69fc1e35df3a9372538f0039';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const result = await googleChatService.syncAttendanceFromChat(spaceId, tenantId);
  console.log('=== Sync Results ===');
  console.log(`Synced Count: ${result.syncCount}`);
  console.log('Logs:', JSON.stringify(result.logs, null, 2));

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
