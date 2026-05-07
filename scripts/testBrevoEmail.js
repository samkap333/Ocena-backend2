require('dotenv').config();
const emailService = require('../services/email.service');

async function testBrevoEmail() {
  console.log('🧪 Testing Brevo Email Service...\n');

  // Test 1: Verify connection
  console.log('1️⃣ Verifying Brevo API connection...');
  const connectionResult = await emailService.verifyConnection();
  console.log('Connection Result:', connectionResult);
  console.log('');

  if (!connectionResult.success) {
    console.error('❌ Brevo connection failed. Please check your BREVO_API_KEY in .env');
    process.exit(1);
  }

  // Test 2: Send a test email
  console.log('2️⃣ Sending test email...');
  try {
    const result = await emailService.sendEmail({
      to: process.env.EMAIL_FROM_EMAIL || 'testing.ocena@gmail.com',
      subject: 'Brevo Test Email - Ocena CRM',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #3b82f6;">✅ Brevo Email Service Working!</h1>
          <p>This is a test email from your Ocena CRM backend.</p>
          <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
          <p>If you received this email, your Brevo integration is working correctly.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
          <p style="color: #666; font-size: 12px;">
            Sent from Ocena CRM Backend<br>
            Powered by Brevo (formerly Sendinblue)
          </p>
        </div>
      `,
    });

    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', result.messageId);
    console.log('Recipient:', result.accepted[0]);
    console.log('');
    console.log('📧 Check your inbox at:', process.env.EMAIL_FROM_EMAIL);
  } catch (error) {
    console.error('❌ Failed to send test email:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  }

  console.log('\n✅ All tests passed! Brevo email service is working correctly.');
}

testBrevoEmail().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
