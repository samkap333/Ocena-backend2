const { Invoice, Payment } = require('../models/crm');

// Get all invoices
exports.list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const query = { tenantId: req.user.tenantId };

    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .populate('leadId', 'name email company')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Invoice.countDocuments(query),
    ]);

    res.json({
      invoices,
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

// Get single invoice
exports.get = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    }).populate('leadId', 'name email company');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Get payments for this invoice
    const payments = await Payment.find({ invoiceId: invoice._id });

    res.json({ ...invoice.toObject(), payments });
  } catch (error) {
    next(error);
  }
};

// Create invoice
exports.create = async (req, res, next) => {
  try {
    // Generate invoice number
    const count = await Invoice.countDocuments({ tenantId: req.user.tenantId });
    const number = `INV-${String(count + 1).padStart(5, '0')}`;

    const invoice = await Invoice.create({
      ...req.body,
      number,
      tenantId: req.user.tenantId,
    });

    res.status(201).json(invoice);
  } catch (error) {
    next(error);
  }
};

// Update invoice
exports.update = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.json(invoice);
  } catch (error) {
    next(error);
  }
};

// Delete invoice
exports.remove = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Delete associated payments
    await Payment.deleteMany({ invoiceId: invoice._id });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// Send invoice via email
exports.send = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    }).populate('leadId', 'name email');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (!invoice.leadId || !invoice.leadId.email) {
      return res.status(400).json({ message: 'Lead email not found' });
    }

    // Send email with invoice
    const emailService = require('../services/email.service');
    await emailService.sendEmail({
      to: invoice.leadId.email,
      subject: `Invoice ${invoice.number}`,
      html: `
        <h2>Invoice ${invoice.number}</h2>
        <p>Dear ${invoice.leadId.name},</p>
        <p>Please find your invoice details below:</p>
        <table style="border-collapse: collapse; width: 100%;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="border: 1px solid #ddd; padding: 8px;">Item</th>
              <th style="border: 1px solid #ddd; padding: 8px;">Quantity</th>
              <th style="border: 1px solid #ddd; padding: 8px;">Price</th>
              <th style="border: 1px solid #ddd; padding: 8px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items.map(item => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.description}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.quantity}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">$${item.price.toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">$${(item.quantity * item.price).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <p><strong>Subtotal:</strong> $${invoice.subtotal.toFixed(2)}</p>
        <p><strong>Tax:</strong> $${invoice.tax.toFixed(2)}</p>
        <p><strong>Total:</strong> $${invoice.total.toFixed(2)}</p>
        <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
        <p>Thank you for your business!</p>
      `,
    });

    // Update status
    invoice.status = 'sent';
    await invoice.save();

    res.json({ message: 'Invoice sent successfully', invoice });
  } catch (error) {
    next(error);
  }
};

// Generate PDF
exports.pdf = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    }).populate('leadId', 'name email company');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.number}.pdf`);

    // Pipe PDF to response
    doc.pipe(res);

    // Add company header
    doc.fontSize(20).text('INVOICE', { align: 'center' });
    doc.moveDown();

    // Invoice details
    doc.fontSize(10);
    doc.text(`Invoice Number: ${invoice.number}`, 50, 120);
    doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString()}`, 50, 135);
    doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`, 50, 150);
    doc.text(`Status: ${invoice.status.toUpperCase()}`, 50, 165);

    // Customer details
    doc.moveDown(2);
    doc.fontSize(12).text('Bill To:', 50, 200);
    doc.fontSize(10);
    if (invoice.leadId) {
      doc.text(invoice.leadId.name, 50, 220);
      if (invoice.leadId.company) doc.text(invoice.leadId.company, 50, 235);
      if (invoice.leadId.email) doc.text(invoice.leadId.email, 50, 250);
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
    invoice.items.forEach((item) => {
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
    doc.text(`$${invoice.subtotal.toFixed(2)}`, 450, yPosition);

    yPosition += 20;
    doc.text('Tax:', 370, yPosition);
    doc.text(`$${invoice.tax.toFixed(2)}`, 450, yPosition);

    yPosition += 20;
    doc.font('Helvetica-Bold');
    doc.text('Total:', 370, yPosition);
    doc.text(`$${invoice.total.toFixed(2)}`, 450, yPosition);

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
