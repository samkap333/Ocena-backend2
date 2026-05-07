const { Quote, Customer, Lead, Deal, Invoice, Product } = require('../models/crm');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const emailService = require('../services/email.service');

function cleanQuotePayload(data) {
  const payload = { ...data };
  ['customerId', 'leadId', 'dealId', 'invoiceId'].forEach((field) => {
    if (!payload[field] || !mongoose.Types.ObjectId.isValid(payload[field])) {
      delete payload[field];
    }
  });
  ['validUntil', 'acceptedAt', 'rejectedAt'].forEach((field) => {
    if (payload[field] === '') {
      delete payload[field];
    }
  });
  return payload;
}

// Get all quotes
exports.list = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      customerId,
      sortBy = 'createdAt',
      order = 'desc',
    } = req.query;

    const query = { tenantId: req.user.tenantId };

    if (search) {
      query.quoteNumber = { $regex: search, $options: 'i' };
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (customerId) {
      query.customerId = customerId;
    }

    const skip = (page - 1) * limit;
    const sortOrder = order === 'desc' ? -1 : 1;

    const [quotes, total] = await Promise.all([
      Quote.find(query)
        .populate('customerId', 'name email companyName')
        .populate('leadId', 'name email')
        .populate('dealId', 'title stage')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit)),
      Quote.countDocuments(query),
    ]);

    res.json({
      quotes,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get single quote
exports.get = async (req, res, next) => {
  try {
    const quote = await Quote.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    })
      .populate('customerId', 'name email companyName phone billingAddress')
      .populate('leadId', 'name email phone')
      .populate('dealId', 'title stage value')
      .populate('invoiceId', 'invoiceNumber status total');

    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    res.json(quote);
  } catch (error) {
    next(error);
  }
};

// Create quote
exports.create = async (req, res, next) => {
  try {
    // Generate quote number
    const count = await Quote.countDocuments({ tenantId: req.user.tenantId });
    const quoteNumber = `QT-${String(count + 1).padStart(5, '0')}`;

    const quoteData = {
      ...cleanQuotePayload(req.body),
      quoteNumber,
      tenantId: req.user.tenantId,
    };

    const quote = await Quote.create(quoteData);
    res.status(201).json(quote);
  } catch (error) {
    next(error);
  }
};

// Update quote
exports.update = async (req, res, next) => {
  try {
    const quote = await Quote.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      cleanQuotePayload(req.body),
      { new: true, runValidators: true }
    );

    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    res.json(quote);
  } catch (error) {
    next(error);
  }
};

// Delete quote
exports.remove = async (req, res, next) => {
  try {
    const quote = await Quote.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    });

    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// Send quote via email
exports.send = async (req, res, next) => {
  try {
    const quote = await Quote.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    })
      .populate('customerId', 'name email')
      .populate('leadId', 'name email');

    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    // Allow manual email override from request body
    let recipientEmail = req.body.email || quote.customerId?.email || quote.leadId?.email;
    let recipientName = req.body.name || quote.customerId?.name || quote.leadId?.name || 'Valued Customer';

    if (!recipientEmail) {
      return res.status(400).json({ 
        message: 'No email address found for recipient. Please provide an email address or link this quote to a customer/lead with an email.',
        details: {
          hasCustomer: !!quote.customerId,
          hasLead: !!quote.leadId,
          customerEmail: quote.customerId?.email || null,
          leadEmail: quote.leadId?.email || null,
        }
      });
    }

    // Send email
    await emailService.sendEmail({
      to: recipientEmail,
      subject: `Quote ${quote.quoteNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Quote ${quote.quoteNumber}</h2>
          <p>Dear ${recipientName},</p>
          <p>Please find your quote details below:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Item</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Qty</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Price</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${quote.items.map(item => `
                <tr>
                  <td style="border: 1px solid #ddd; padding: 8px;">${item.description}</td>
                  <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${item.quantity}</td>
                  <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${item.price.toFixed(2)}</td>
                  <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${(item.quantity * item.price).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p><strong>Subtotal:</strong> $${quote.subtotal.toFixed(2)}</p>
          <p><strong>Discount:</strong> $${quote.discount.toFixed(2)}</p>
          <p><strong>Tax:</strong> $${quote.tax.toFixed(2)}</p>
          <p><strong>Total:</strong> $${quote.total.toFixed(2)}</p>
          <p><strong>Valid Until:</strong> ${new Date(quote.validUntil).toLocaleDateString()}</p>
          <p>Thank you for your interest!</p>
        </div>
      `,
    });

    // Update quote status
    quote.status = 'sent';
    await quote.save();

    res.json({ message: 'Quote sent successfully', quote });
  } catch (error) {
    next(error);
  }
};

// Generate PDF
exports.pdf = async (req, res, next) => {
  try {
    const quote = await Quote.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    })
      .populate('customerId', 'name email companyName billingAddress')
      .populate('leadId', 'name email company');

    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    const doc = new PDFDocument({ margin: 50 });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=quote-${quote.quoteNumber}.pdf`);

    // Pipe PDF to response
    doc.pipe(res);

    // Add header
    doc.fontSize(20).text('QUOTE', { align: 'center' });
    doc.moveDown();

    // Quote details
    doc.fontSize(10);
    doc.text(`Quote Number: ${quote.quoteNumber}`, 50, 120);
    doc.text(`Date: ${new Date(quote.createdAt).toLocaleDateString()}`, 50, 135);
    doc.text(`Valid Until: ${new Date(quote.validUntil).toLocaleDateString()}`, 50, 150);
    doc.text(`Status: ${quote.status.toUpperCase()}`, 50, 165);

    // Customer details
    doc.moveDown(2);
    doc.fontSize(12).text('Quote For:', 50, 200);
    doc.fontSize(10);
    if (quote.customerId) {
      doc.text(quote.customerId.name, 50, 220);
      if (quote.customerId.companyName) doc.text(quote.customerId.companyName, 50, 235);
      if (quote.customerId.email) doc.text(quote.customerId.email, 50, 250);
    } else if (quote.leadId) {
      doc.text(quote.leadId.name, 50, 220);
      if (quote.leadId.company) doc.text(quote.leadId.company, 50, 235);
      if (quote.leadId.email) doc.text(quote.leadId.email, 50, 250);
    }

    // Items table
    const tableTop = 300;
    doc.fontSize(10);

    // Table headers
    doc.font('Helvetica-Bold');
    doc.text('Description', 50, tableTop);
    doc.text('Qty', 300, tableTop);
    doc.text('Price', 370, tableTop);
    doc.text('Total', 450, tableTop);
    doc.font('Helvetica');

    // Draw line under headers
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    // Table rows
    let yPosition = tableTop + 25;
    quote.items.forEach((item) => {
      doc.text(item.description, 50, yPosition, { width: 240 });
      doc.text(item.quantity.toString(), 300, yPosition);
      doc.text(`$${item.price.toFixed(2)}`, 370, yPosition);
      doc.text(`$${(item.quantity * item.price).toFixed(2)}`, 450, yPosition);
      yPosition += 25;
    });

    // Draw line before totals
    yPosition += 10;
    doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();

    // Totals
    yPosition += 20;
    doc.text('Subtotal:', 370, yPosition);
    doc.text(`$${quote.subtotal.toFixed(2)}`, 450, yPosition);

    yPosition += 20;
    doc.text('Discount:', 370, yPosition);
    doc.text(`$${quote.discount.toFixed(2)}`, 450, yPosition);

    yPosition += 20;
    doc.text('Tax:', 370, yPosition);
    doc.text(`$${quote.tax.toFixed(2)}`, 450, yPosition);

    yPosition += 20;
    doc.font('Helvetica-Bold');
    doc.text('Total:', 370, yPosition);
    doc.text(`$${quote.total.toFixed(2)}`, 450, yPosition);

    // Terms and notes
    if (quote.terms || quote.notes) {
      yPosition += 40;
      doc.font('Helvetica');
      doc.fontSize(8);
      if (quote.terms) {
        doc.text('Terms & Conditions:', 50, yPosition);
        doc.text(quote.terms, 50, yPosition + 15, { width: 500 });
      }
      if (quote.notes) {
        yPosition += 60;
        doc.text('Notes:', 50, yPosition);
        doc.text(quote.notes, 50, yPosition + 15, { width: 500 });
      }
    }

    // Footer
    doc.font('Helvetica');
    doc.fontSize(8);
    doc.text('Thank you for your business!', 50, 700, { align: 'center' });

    // Finalize PDF
    doc.end();
  } catch (error) {
    next(error);
  }
};

// Accept quote
exports.accept = async (req, res, next) => {
  try {
    const quote = await Quote.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      { 
        status: 'accepted',
        acceptedAt: new Date(),
      },
      { new: true }
    );

    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    res.json({ message: 'Quote accepted', quote });
  } catch (error) {
    next(error);
  }
};

// Reject quote
exports.reject = async (req, res, next) => {
  try {
    const quote = await Quote.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      { 
        status: 'rejected',
        rejectedAt: new Date(),
      },
      { new: true }
    );

    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    res.json({ message: 'Quote rejected', quote });
  } catch (error) {
    next(error);
  }
};

// Convert quote to invoice
exports.convertToInvoice = async (req, res, next) => {
  try {
    const quote = await Quote.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    });

    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    if (quote.status !== 'accepted') {
      return res.status(400).json({ message: 'Quote must be accepted before converting to invoice' });
    }

    if (quote.invoiceId) {
      return res.status(400).json({ message: 'Quote already converted to invoice' });
    }

    // Generate invoice number
    const invoiceCount = await Invoice.countDocuments({ tenantId: req.user.tenantId });
    const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(5, '0')}`;

    // Create invoice from quote
    const invoice = await Invoice.create({
      invoiceNumber,
      leadId: quote.leadId,
      items: quote.items,
      subtotal: quote.subtotal,
      tax: quote.tax,
      discount: quote.discount,
      total: quote.total,
      status: 'draft',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      notes: quote.notes,
      tenantId: req.user.tenantId,
    });

    // Update quote
    quote.status = 'converted';
    quote.convertedToInvoiceAt = new Date();
    quote.invoiceId = invoice._id;
    await quote.save();

    res.status(201).json({ message: 'Quote converted to invoice', invoice, quote });
  } catch (error) {
    next(error);
  }
};
