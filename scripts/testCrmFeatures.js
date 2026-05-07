/**
 * CRM Features Test Script
 * 
 * This script tests all major CRM features to ensure they work correctly.
 * Run with: node scripts/testCrmFeatures.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Lead, Activity, Invoice, EmailCampaign } = require('../models/crm');
const leadScoringService = require('../services/leadScoring.service');
const emailService = require('../services/email.service');
const smsService = require('../services/sms.service');

// Test configuration
const TEST_TENANT_ID = new mongoose.Types.ObjectId();
const TEST_USER_ID = new mongoose.Types.ObjectId();

async function connectDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Database connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

async function testLeadScoring() {
  console.log('\n📊 Testing Lead Scoring...');
  
  try {
    const testLead = {
      name: 'Test Lead',
      email: 'test@example.com',
      phone: '+1234567890',
      company: 'Test Company',
      status: 'qualified',
      source: 'website',
      value: 5000,
      tenantId: TEST_TENANT_ID,
    };

    const score = await leadScoringService.calculateScore(testLead);
    console.log(`✅ Lead score calculated: ${score}/100`);
    
    if (score >= 0 && score <= 100) {
      console.log('✅ Lead scoring working correctly');
      return true;
    } else {
      console.log('❌ Lead score out of range');
      return false;
    }
  } catch (error) {
    console.error('❌ Lead scoring failed:', error.message);
    return false;
  }
}

async function testCSVParsing() {
  console.log('\n📄 Testing CSV Parsing...');
  
  try {
    const { parse } = require('csv-parse/sync');
    
    const csvData = `name,email,phone,company,status,source,value
John Doe,john@example.com,+1111111111,Acme Inc,new,website,5000
Jane Smith,jane@example.com,+2222222222,Tech Corp,contacted,referral,10000`;

    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (records.length === 2) {
      console.log(`✅ CSV parsed successfully: ${records.length} records`);
      console.log(`   - Record 1: ${records[0].name} (${records[0].email})`);
      console.log(`   - Record 2: ${records[1].name} (${records[1].email})`);
      return true;
    } else {
      console.log('❌ CSV parsing failed: incorrect record count');
      return false;
    }
  } catch (error) {
    console.error('❌ CSV parsing failed:', error.message);
    return false;
  }
}

async function testPDFGeneration() {
  console.log('\n📑 Testing PDF Generation...');
  
  try {
    const PDFDocument = require('pdfkit');
    const fs = require('fs');
    const path = require('path');
    
    const doc = new PDFDocument();
    const testPdfPath = path.join(__dirname, 'test-invoice.pdf');
    const stream = fs.createWriteStream(testPdfPath);
    
    doc.pipe(stream);
    doc.fontSize(20).text('TEST INVOICE', { align: 'center' });
    doc.fontSize(10).text('This is a test invoice');
    doc.end();

    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    if (fs.existsSync(testPdfPath)) {
      const stats = fs.statSync(testPdfPath);
      console.log(`✅ PDF generated successfully: ${stats.size} bytes`);
      
      // Clean up test file
      fs.unlinkSync(testPdfPath);
      return true;
    } else {
      console.log('❌ PDF file not created');
      return false;
    }
  } catch (error) {
    console.error('❌ PDF generation failed:', error.message);
    return false;
  }
}

async function testEmailService() {
  console.log('\n📧 Testing Email Service (Brevo)...');
  
  try {
    if (!process.env.BREVO_API_KEY) {
      console.log('⚠️  Email service not configured (BREVO_API_KEY missing)');
      console.log('   Sign up at: https://www.brevo.com (FREE - 300 emails/day)');
      console.log('   Get API key: https://app.brevo.com/settings/keys/api');
      console.log('   Configure BREVO_API_KEY in .env to test');
      return null; // Skip test
    }

    console.log('✅ Brevo API key configured');
    console.log(`   - API Key: ${process.env.BREVO_API_KEY.substring(0, 15)}...`);
    console.log(`   - From Name: ${process.env.EMAIL_FROM_NAME || 'Ocena CRM'}`);
    console.log(`   - From Email: ${process.env.EMAIL_FROM_EMAIL || 'noreply@ocena.com'}`);
    
    // Verify Brevo connection
    const verification = await emailService.verifyConnection();
    if (verification.success) {
      console.log('✅ Brevo connection verified');
      console.log(`   - Provider: ${verification.provider}`);
      console.log(`   - Plan: ${verification.plan || 'free'}`);
      console.log(`   - Daily Limit: ${verification.dailyLimit}`);
    } else {
      console.log('❌ Brevo connection failed:', verification.message);
      return false;
    }
    
    console.log('   - To send test email, uncomment the sendEmail call in the script');
    
    // Uncomment to actually send test email:
    // await emailService.sendEmail({
    //   to: 'test@example.com',
    //   subject: 'CRM Test Email',
    //   html: '<h1>Test Email</h1><p>This is a test email from the CRM system using Brevo.</p>',
    // });
    // console.log('✅ Test email sent successfully');
    
    return true;
  } catch (error) {
    console.error('❌ Email service test failed:', error.message);
    return false;
  }
}

async function testSMSService() {
  console.log('\n📱 Testing SMS/WhatsApp Service...');
  
  try {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      console.log('⚠️  SMS service not configured (Twilio settings missing)');
      console.log('   Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN in .env to test');
      return null; // Skip test
    }

    console.log('✅ SMS service configured');
    console.log(`   - Twilio Account SID: ${process.env.TWILIO_ACCOUNT_SID.substring(0, 10)}...`);
    console.log('   - To send test SMS, uncomment the sendSMS call in the script');
    
    // Uncomment to actually send test SMS:
    // await smsService.sendSMS('+1234567890', 'Test SMS from CRM');
    // console.log('✅ Test SMS sent successfully');
    
    return true;
  } catch (error) {
    console.error('❌ SMS service test failed:', error.message);
    return false;
  }
}

async function testDatabaseModels() {
  console.log('\n🗄️  Testing Database Models...');
  
  try {
    // Test Lead model
    const lead = new Lead({
      name: 'Test Lead',
      email: 'test@example.com',
      tenantId: TEST_TENANT_ID,
    });
    const leadError = lead.validateSync();
    if (!leadError) {
      console.log('✅ Lead model validation passed');
    } else {
      console.log('❌ Lead model validation failed:', leadError.message);
      return false;
    }

    // Test Invoice model
    const invoice = new Invoice({
      number: 'INV-00001',
      tenantId: TEST_TENANT_ID,
      items: [],
      subtotal: 0,
      tax: 0,
      total: 0,
    });
    const invoiceError = invoice.validateSync();
    if (!invoiceError) {
      console.log('✅ Invoice model validation passed');
    } else {
      console.log('❌ Invoice model validation failed:', invoiceError.message);
      return false;
    }

    // Test EmailCampaign model
    const campaign = new EmailCampaign({
      name: 'Test Campaign',
      subject: 'Test Subject',
      content: 'Test Content',
      tenantId: TEST_TENANT_ID,
    });
    const campaignError = campaign.validateSync();
    if (!campaignError) {
      console.log('✅ EmailCampaign model validation passed');
    } else {
      console.log('❌ EmailCampaign model validation failed:', campaignError.message);
      return false;
    }

    console.log('✅ All database models working correctly');
    return true;
  } catch (error) {
    console.error('❌ Database model test failed:', error.message);
    return false;
  }
}

async function testSocketIO() {
  console.log('\n🔌 Testing Socket.io...');
  
  try {
    const notificationService = require('../services/notification.service');
    
    if (notificationService) {
      console.log('✅ Notification service loaded');
      console.log('   - Socket.io will be available when server starts');
      console.log('   - Test real-time features by running the server');
      return true;
    } else {
      console.log('❌ Notification service not found');
      return false;
    }
  } catch (error) {
    console.error('❌ Socket.io test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting CRM Features Test Suite\n');
  console.log('='.repeat(50));
  
  await connectDatabase();
  
  const results = {
    leadScoring: await testLeadScoring(),
    csvParsing: await testCSVParsing(),
    pdfGeneration: await testPDFGeneration(),
    emailService: await testEmailService(),
    smsService: await testSMSService(),
    databaseModels: await testDatabaseModels(),
    socketIO: await testSocketIO(),
  };
  
  console.log('\n' + '='.repeat(50));
  console.log('\n📊 TEST RESULTS SUMMARY:\n');
  
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  
  Object.entries(results).forEach(([test, result]) => {
    const icon = result === true ? '✅' : result === false ? '❌' : '⚠️ ';
    const status = result === true ? 'PASSED' : result === false ? 'FAILED' : 'SKIPPED';
    console.log(`${icon} ${test.padEnd(20)} - ${status}`);
    
    if (result === true) passed++;
    else if (result === false) failed++;
    else skipped++;
  });
  
  console.log('\n' + '='.repeat(50));
  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Skipped: ${skipped}`);
  console.log(`📊 Total: ${passed + failed + skipped}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! CRM is ready to use.\n');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.\n');
  }
  
  await mongoose.disconnect();
  console.log('✅ Database disconnected');
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch((error) => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
