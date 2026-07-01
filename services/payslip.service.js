const PDFDocument = require('pdfkit');

/**
 * Generate a PDF payslip as a Buffer
 * @param {Object} employee - Employee object
 * @param {Object} payroll - Payroll details
 * @returns {Promise<Buffer>}
 */
function generatePayslipPdf(employee, payroll) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];
      doc.on('data', (data) => buffers.push(data));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Color Palette
      const primaryColor = '#1e3a8a';   // Indigo/Navy
      const secondaryColor = '#475569'; // Slate Gray
      const accentColor = '#0f766e';    // Teal
      const lightBg = '#f8fafc';        // Light gray
      const borderColor = '#cbd5e1';    // Slate border

      // 1. Header (Company details)
      doc.rect(0, 0, 595.28, 120).fill(primaryColor);
      doc.fillColor('#ffffff')
         .fontSize(22)
         .font('Helvetica-Bold')
         .text('OCENA SMART SOLUTIONS', 50, 30);
      
      doc.fontSize(9)
         .font('Helvetica')
         .text('Plot No. 3-A, Amari Greens, Mohali, Punjab, India - 140301', 50, 60)
         .text('Phone: +91 7652992906 | Email: Finance@ocena.in', 50, 75);

      doc.fontSize(16)
         .font('Helvetica-Bold')
         .text('PAYSLIP', 450, 30, { align: 'right', width: 95 })
         .fontSize(10)
         .font('Helvetica')
         .text(payroll.month, 450, 55, { align: 'right', width: 95 });

      // Reset text color
      doc.fillColor('#000000');

      // 2. Employee Details Block
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('Employee Information', 50, 140);
      
      // Draw grid line
      doc.moveTo(50, 155).lineTo(545, 155).strokeColor(borderColor).stroke();

      const detailsY = 165;
      doc.fontSize(9)
         .font('Helvetica-Bold').text('Employee Name:', 50, detailsY)
         .font('Helvetica').text(employee.name, 140, detailsY)
         .font('Helvetica-Bold').text('Employee ID:', 300, detailsY)
         .font('Helvetica').text(employee.employeeId, 390, detailsY);

      doc.font('Helvetica-Bold').text('Designation:', 50, detailsY + 15)
         .font('Helvetica').text(employee.designation || employee.role || 'N/A', 140, detailsY + 15)
         .font('Helvetica-Bold').text('Department:', 300, detailsY + 15)
         .font('Helvetica').text(employee.department, 390, detailsY + 15);

      doc.font('Helvetica-Bold').text('Joining Date:', 50, detailsY + 30)
         .font('Helvetica').text(employee.joiningDate ? new Date(employee.joiningDate).toLocaleDateString('en-IN') : 'N/A', 140, detailsY + 30)
         .font('Helvetica-Bold').text('PAN Number:', 300, detailsY + 30)
         .font('Helvetica').text((employee.panNumber || 'N/A').toUpperCase(), 390, detailsY + 30);

      doc.font('Helvetica-Bold').text('Bank Account:', 50, detailsY + 45)
         .font('Helvetica').text(employee.accountNumber ? `${employee.bankName || 'Bank'} - ${employee.accountNumber}` : 'Not Provided', 140, detailsY + 45)
         .font('Helvetica-Bold').text('Payment Mode:', 300, detailsY + 45)
         .font('Helvetica').text(employee.paymentMode || 'Bank Transfer', 390, detailsY + 45);

      // 3. Net Salary Block (Premium Card)
      const netY = 245;
      doc.rect(50, netY, 495, 80).fill('#eff6ff').strokeColor('#bfdbfe').stroke();
      
      doc.fillColor('#1e40af')
         .fontSize(14)
         .font('Helvetica-Bold')
         .text('NET SALARY PAYABLE:', 75, netY + 30);

      doc.fontSize(22)
         .text('INR ' + payroll.netSalary.toLocaleString('en-IN'), 300, netY + 26, { align: 'right', width: 220 });

      // Amount in words
      doc.fillColor(secondaryColor)
         .fontSize(9.5)
         .font('Helvetica-Oblique')
         .text('Amount in words: ' + numberToWords(payroll.netSalary) + ' Only', 50, netY + 95);

      // 4. Verification & Signature Block
      const sigY = netY + 135;
      
      // Draw Placeholder QR Code (for visual premium feel)
      doc.rect(50, sigY, 70, 70).fillColor('#f1f5f9').strokeColor(borderColor).stroke();
      doc.fillColor('#475569')
         .fontSize(6)
         .font('Helvetica')
         .text('SECURE QR\nVERIFICATION', 58, sigY + 25, { align: 'center', width: 54 });

      // Digital seal verified label
      doc.rect(130, sigY, 150, 70).fillColor('#f8fafc').strokeColor(borderColor).stroke();
      doc.fillColor(accentColor)
         .fontSize(8)
         .font('Helvetica-Bold')
         .text('DIGITAL SEAL VERIFIED', 140, sigY + 10)
         .fillColor(secondaryColor)
         .font('Helvetica')
         .text('OCENA Finance Operations\nApproved Electronically', 140, sigY + 25)
         .fontSize(6)
         .text('IP Signature: 192.168.1.104\nTimestamp: ' + new Date().toISOString(), 140, sigY + 48);

      // Signature line for employee
      doc.moveTo(395, sigY + 50).lineTo(545, sigY + 50).strokeColor(borderColor).stroke();
      doc.fillColor(secondaryColor)
         .fontSize(8)
         .text('Employee Signature', 395, sigY + 55, { align: 'center', width: 150 });

      // Footer
      doc.fontSize(8)
         .font('Helvetica')
         .text('This payslip is a system-generated document. No physical signature is required.', 50, 740, { align: 'center', width: 495 });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Convert numbers to words helper
function numberToWords(num) {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if ((num = num.toString()).length > 9) return 'overflow';
  const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';
  let str = '';
  str += (Number(n[1]) !== 0) ? (a[Number(n[1])] || b[Number(n[1])[0]] + ' ' + a[Number(n[1])[1]]) + 'Crore ' : '';
  str += (Number(n[2]) !== 0) ? (a[Number(n[2])] || b[Number(n[2])[0]] + ' ' + a[Number(n[2])[1]]) + 'Lakh ' : '';
  str += (Number(n[3]) !== 0) ? (a[Number(n[3])] || b[Number(n[3])[0]] + ' ' + a[Number(n[3])[1]]) + 'Thousand ' : '';
  str += (Number(n[4]) !== 0) ? a[Number(n[4])] + 'Hundred ' : '';
  str += (Number(n[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[Number(n[5])[0]] + ' ' + a[Number(n[5])[1]]) + 'Rupees' : 'Rupees';
  return str;
}

module.exports = {
  generatePayslipPdf
};
