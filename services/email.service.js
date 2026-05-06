const nodemailer = require('nodemailer');

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

exports.sendEmail = async ({ to, subject, html, text }) => {
  const transporter = createTransport();
  return transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, html, text });
};
