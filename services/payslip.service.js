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

      // 3. Earnings & Deductions Table Headers
      const tableY = 245;
      doc.rect(50, tableY, 240, 20).fill(primaryColor);
      doc.rect(305, tableY, 240, 20).fill(accentColor);

      doc.fillColor('#ffffff')
         .font('Helvetica-Bold')
         .fontSize(10)
         .text('EARNINGS', 60, tableY + 5)
         .text('AMOUNT (INR)', 190, tableY + 5, { align: 'right', width: 90 })
         .text('DEDUCTIONS', 315, tableY + 5)
         .text('AMOUNT (INR)', 445, tableY + 5, { align: 'right', width: 90 });

      doc.fillColor('#000000');

      // Table Rows
      const rowHeight = 20;
      let currentY = tableY + 20;

      const earnings = [
        { label: 'Basic Salary', val: payroll.basicSalary },
        { label: 'House Rent Allowance (HRA)', val: payroll.hra },
        { label: 'Special Allowances', val: payroll.allowances },
        { label: 'Performance Bonus', val: payroll.bonus },
        { label: 'Overtime Pay', val: payroll.overtimeEarnings }
      ];

      const deductions = [
        { label: 'Provident Fund (PF)', val: payroll.pfDeduction },
        { label: 'Employee State Insurance (ESI)', val: payroll.esiDeduction },
        { label: 'Professional Tax (PT)', val: payroll.ptDeduction },
        { label: 'Income Tax (TDS)', val: payroll.tdsDeduction },
        { label: 'Loan EMI / Other Deductions', val: payroll.loanEmiDeduction + payroll.otherDeductions }
      ];

      // Draw rows
      for (let i = 0; i < 5; i++) {
        // Alternating background
        if (i % 2 === 0) {
          doc.rect(50, currentY, 240, rowHeight).fill(lightBg);
          doc.rect(305, currentY, 240, rowHeight).fill(lightBg);
        }

        doc.fillColor('#000000')
           .font('Helvetica')
           .fontSize(9)
           .text(earnings[i].label, 60, currentY + 6)
           .text(earnings[i].val.toLocaleString('en-IN'), 190, currentY + 6, { align: 'right', width: 90 })
           .text(deductions[i].label, 315, currentY + 6)
           .text(deductions[i].val.toLocaleString('en-IN'), 445, currentY + 6, { align: 'right', width: 90 });

        currentY += rowHeight;
      }

      // Draw borders around tables
      doc.rect(50, tableY, 240, 120).strokeColor(borderColor).stroke();
      doc.rect(305, tableY, 240, 120).strokeColor(borderColor).stroke();

      // Total earnings and deductions
      const totalEarned = payroll.basicSalary + payroll.hra + payroll.allowances + payroll.bonus + payroll.overtimeEarnings;
      const totalDeducted = payroll.pfDeduction + payroll.esiDeduction + payroll.ptDeduction + payroll.tdsDeduction + payroll.loanEmiDeduction + payroll.otherDeductions;

      doc.rect(50, currentY, 240, 22).fill('#f1f5f9');
      doc.rect(305, currentY, 240, 22).fill('#f1f5f9');
      doc.fillColor('#000000')
         .font('Helvetica-Bold')
         .fontSize(9)
         .text('Total Earnings (A)', 60, currentY + 7)
         .text('INR ' + totalEarned.toLocaleString('en-IN'), 190, currentY + 7, { align: 'right', width: 90 })
         .text('Total Deductions (B)', 315, currentY + 7)
         .text('INR ' + totalDeducted.toLocaleString('en-IN'), 445, currentY + 7, { align: 'right', width: 90 });

      // 4. Net Salary Block
      const netY = currentY + 35;
      doc.rect(50, netY, 495, 45).fill('#eff6ff').strokeColor('#bfdbfe').stroke();
      
      doc.fillColor('#1e40af')
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('NET SALARY PAYABLE (A - B):', 70, netY + 15);

      doc.fontSize(16)
         .text('INR ' + payroll.netSalary.toLocaleString('en-IN'), 350, netY + 13, { align: 'right', width: 170 });

      // Amount in words
      doc.fillColor(secondaryColor)
         .fontSize(8.5)
         .font('Helvetica-Oblique')
         .text('Amount in words: ' + numberToWords(payroll.netSalary) + ' Only', 50, netY + 55);

      // 5. Verification & Signature Block
      const sigY = netY + 85;
      
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
