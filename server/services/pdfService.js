const PDFDocument = require('pdfkit');

/**
 * Generates a clean, simple PDF invoice for a Khata purchase entry
 * @param {Object} data Entry details with customer and medicines
 * @param {WritableStream} outputStream Stream to write the PDF to
 */
function generateBillPdf(data, outputStream) {
  const doc = new PDFDocument({
    size: 'A5',
    layout: 'portrait',
    margins: { top: 25, bottom: 25, left: 30, right: 30 },
  });

  doc.pipe(outputStream);

  const shopName = 'Medical Shop';

  // Header - Shop Info
  doc
    .fontSize(16)
    .font('Helvetica-Bold')
    .fillColor('#4f46e5') // Indigo accent
    .text(shopName, { align: 'center' });

  doc
    .fontSize(8)
    .font('Helvetica')
    .fillColor('#6b7280')
    .text('Customer Khata Ledger Bill', { align: 'center' });

  doc.moveDown(0.5);
  doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(30, doc.y).lineTo(doc.page.width - 30, doc.y).stroke();
  doc.moveDown(0.5);

  // Meta & Customer Details
  const metaY = doc.y;
  const colWidth = (doc.page.width - 60) / 2;

  // Left column
  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .fillColor('#111827')
    .text(`BILL / ENTRY #${String(data.entry_id || data.entryId).padStart(5, '0')}`, 30, metaY)
    .font('Helvetica')
    .fillColor('#4b5563')
    .text(`Date: ${new Date(data.entry_date || data.entryDate || Date.now()).toLocaleString()}`);

  // Right column: Customer info
  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .fillColor('#111827')
    .text('CUSTOMER:', 30 + colWidth, metaY)
    .font('Helvetica')
    .fillColor('#374151')
    .text(`Name: ${data.customer_name || data.customerName || 'Customer'}`, 30 + colWidth)
    .text(`Phone: ${data.phone_number || data.phone || 'N/A'}`)
    .text(`Village: ${data.village || 'N/A'}`);

  doc.moveDown(0.8);
  const tableStartY = doc.y + 5;

  // Table Header
  doc
    .rect(30, tableStartY, doc.page.width - 60, 20)
    .fill('#f3f4f6');

  doc
    .fontSize(8)
    .font('Helvetica-Bold')
    .fillColor('#374151')
    .text('#', 35, tableStartY + 6, { width: 20 })
    .text('MEDICINE / ITEM', 60, tableStartY + 6, { width: 220 })
    .text('PRICE', 300, tableStartY + 6, { width: 85, align: 'right' });

  let currentY = tableStartY + 24;

  const medicines = data.medicines || [];
  medicines.forEach((med, index) => {
    const isEven = index % 2 === 0;
    if (isEven) {
      doc
        .rect(30, currentY - 2, doc.page.width - 60, 16)
        .fill('#fafafa');
    }

    const name = med.medicine_name || med.name || 'Medicine';
    const price = parseFloat(med.price || 0);

    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#1f2937')
      .text(`${index + 1}`, 35, currentY, { width: 20 })
      .text(name, 60, currentY, { width: 220, ellipsis: true })
      .text(price > 0 ? `₹${price.toFixed(2)}` : '—', 300, currentY, { width: 85, align: 'right' });

    currentY += 16;
  });

  doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(30, currentY + 4).lineTo(doc.page.width - 30, currentY + 4).stroke();
  currentY += 10;

  // Financial summary
  const summaryX = doc.page.width - 200;

  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor('#374151')
    .text('Total Amount:', summaryX, currentY, { width: 90, align: 'right' })
    .font('Helvetica-Bold')
    .text(`₹${parseFloat(data.total_amount || data.totalAmount || 0).toFixed(2)}`, summaryX + 95, currentY, { width: 75, align: 'right' });

  currentY += 14;

  doc
    .font('Helvetica')
    .fillColor('#16a34a')
    .text('Amount Paid:', summaryX, currentY, { width: 90, align: 'right' })
    .font('Helvetica-Bold')
    .text(`₹${parseFloat(data.amount_paid || data.amountPaid || 0).toFixed(2)}`, summaryX + 95, currentY, { width: 75, align: 'right' });

  currentY += 14;

  const dueCreated = parseFloat(data.due_amount || data.dueAmount || 0);
  doc
    .font('Helvetica')
    .fillColor(dueCreated > 0 ? '#d97706' : '#374151')
    .text('Due on this Entry:', summaryX, currentY, { width: 90, align: 'right' })
    .font('Helvetica-Bold')
    .text(`₹${dueCreated.toFixed(2)}`, summaryX + 95, currentY, { width: 75, align: 'right' });

  currentY += 16;

  // Total Customer Due
  if (data.totalDue !== undefined) {
    const totalDue = parseFloat(data.totalDue || 0);
    doc
      .rect(summaryX - 10, currentY - 4, 180, 22)
      .fill(totalDue > 0 ? '#fffbeb' : '#f0fdf4');

    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor(totalDue > 0 ? '#b45309' : '#15803d')
      .text('Total Customer Due:', summaryX, currentY + 2, { width: 100, align: 'right' })
      .text(`₹${totalDue.toFixed(2)}`, summaryX + 105, currentY + 2, { width: 65, align: 'right' });
  }

  // Footer notes
  const footerY = doc.page.height - 45;
  doc
    .fontSize(8)
    .font('Helvetica-Bold')
    .fillColor('#4f46e5')
    .text('Thank you!', 30, footerY, { align: 'center' });

  doc.end();
}

module.exports = {
  generateBillPdf,
};
