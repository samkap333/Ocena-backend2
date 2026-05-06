const twilio = require('twilio');

function client() {
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

exports.sendSms = async ({ to, body }) => {
  return client().messages.create({ from: process.env.TWILIO_FROM, to, body });
};
