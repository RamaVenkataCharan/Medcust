const PDFDocument = require('pdfkit');
const config = require('../config');

/**
 * Generates a clean, legible PDF receipt for a Khata purchase entry
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

  const shop = config.SHOP || {};
  const shopName = shop.name || 'MedTrack Medical Store';
  const shopTagline = shop.tagline || 'Customer Khata Ledger Bill';
  const shopAddress = shop.address ? `${shop.address}, ${shop.city || ''}` : 'Main Road, Counter Billing';
  const shopPhone = shop.phone || '';
  const shopDl = shop.dlNo || '';
  const shopGstin = shop.gstin || '';

  // ── Header - Shop Info ──
  doc
    .fontSize(15)
    .font('Helvetica-Bold')
    .fillColor('#4f46e5') // Indigo accent
    .text(shopName, { align: 'center' });

  doc
    .fontSize(8)
    .font('Helvetica')
    .fillColor('#6b7280')
    .text(shopTagline, { align: 'center' })
    .text(`${shopAddress}  ${shopPhone ? '| Ph: ' + shopPhone : ''}`, { align: 'center' });

  if (shopDl || shopGstin) {
    doc
      .fontSize(7.5)
      .fillColor('#9ca3af')
      .text(`${shopDl ? 'D.L. No: ' + shopDl : ''}   ${shopGstin ? 'GSTIN: ' + shopGstin : ''}`, { align: 'center' });
  }

  doc.moveDown(0.4);
  doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(30, doc.y).lineTo(doc.page.width - 30, doc.y).stroke();
  doc.moveDown(0.4);

  // ── Meta & Customer Details ──
  const metaY = doc.y;
  const colWidth = (doc.page.width - 60) / 2;

  // Left column: Bill info
  doc
    .fontSize(8.5)
    .font('Helvetica-Bold')
    .fillColor('#111827')
    .text(`RECEIPT / ENTRY #${String(data.entry_id || data.entryId).padStart(5, '0')}`, 30, metaY)
    .font('Helvetica')
    .fillColor('#4b5563')
    .text(`Date: ${new Date(data.entry_date || data.entryDate || Date.now()).toLocaleString()}`);

  // Right column: Customer info
  doc
    .fontSize(8.5)
    .font('Helvetica-Bold')
    .fillColor('#111827')
    .text('CUSTOMER:', 30 + colWidth, metaY)
    .font('Helvetica')
    .fillColor('#374151')
    .text(`Name: ${data.customer_name || data.customerName || 'Customer'}`, 30 + colWidth)
    .text(`Phone: ${data.phone_number || data.phone || 'N/A'}`)
    .text(`Village: ${data.village || 'N/A'}`);

  doc.moveDown(0.6);
  const tableStartY = doc.y + 4;

  // ── Itemized Table Header ──
  doc
    .rect(30, tableStartY, doc.page.width - 60, 18)
    .fill('#f1f5f9');

  doc
    .fontSize(8)
    .font('Helvetica-Bold')
    .fillColor('#334155')
    .text('#', 35, tableStartY + 5, { width: 20 })
    .text('MEDICINE / ITEM', 60, tableStartY + 5, { width: 215 })
    .text('PRICE', 285, tableStartY + 5, { width: 100, align: 'right' });

  let currentY = tableStartY + 22;

  const medicines = data.medicines || [];
  medicines.forEach((med, index) => {
    const isEven = index % 2 === 0;
    if (isEven) {
      doc
        .rect(30, currentY - 2, doc.page.width - 60, 15)
        .fill('#f8fafc');
    }

    const name = med.medicine_name || med.name || 'Medicine';
    const price = parseFloat(med.price || 0);

    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#1e293b')
      .text(`${index + 1}`, 35, currentY, { width: 20 })
      .text(name, 60, currentY, { width: 215, ellipsis: true })
      .text(price > 0 ? `Rs. ${price.toFixed(2)}` : '—', 285, currentY, { width: 100, align: 'right' });

    currentY += 15;
  });

  doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(30, currentY + 3).lineTo(doc.page.width - 30, currentY + 3).stroke();
  currentY += 8;

  // ── Financial Summary ──
  const summaryX = doc.page.width - 210;

  doc
    .fontSize(8.5)
    .font('Helvetica')
    .fillColor('#334155')
    .text('Total Amount:', summaryX, currentY, { width: 100, align: 'right' })
    .font('Helvetica-Bold')
    .text(`Rs. ${parseFloat(data.total_amount || data.totalAmount || 0).toFixed(2)}`, summaryX + 105, currentY, { width: 75, align: 'right' });

  currentY += 13;

  doc
    .font('Helvetica')
    .fillColor('#16a34a')
    .text('Amount Paid:', summaryX, currentY, { width: 100, align: 'right' })
    .font('Helvetica-Bold')
    .text(`Rs. ${parseFloat(data.amount_paid || data.amountPaid || 0).toFixed(2)}`, summaryX + 105, currentY, { width: 75, align: 'right' });

  currentY += 13;

  const dueCreated = parseFloat(data.due_amount || data.dueAmount || 0);
  doc
    .font('Helvetica')
    .fillColor(dueCreated > 0 ? '#b45309' : '#334155')
    .text('Due on this Visit:', summaryX, currentY, { width: 100, align: 'right' })
    .font('Helvetica-Bold')
    .text(`Rs. ${dueCreated.toFixed(2)}`, summaryX + 105, currentY, { width: 75, align: 'right' });

  currentY += 15;

  // Total Customer Due Box
  if (data.totalDue !== undefined) {
    const totalDue = parseFloat(data.totalDue || 0);
    doc
      .rect(summaryX - 10, currentY - 3, 190, 20)
      .fill(totalDue > 0 ? '#fffbeb' : '#f0fdf4');

    doc
      .fontSize(8.5)
      .font('Helvetica-Bold')
      .fillColor(totalDue > 0 ? '#b45309' : '#15803d')
      .text('Current Khata Due:', summaryX - 5, currentY + 3, { width: 110, align: 'right' })
      .text(`Rs. ${totalDue.toFixed(2)}`, summaryX + 110, currentY + 3, { width: 65, align: 'right' });
  }

  // ── Footer ──
  const footerY = doc.page.height - 35;
  doc
    .fontSize(8)
    .font('Helvetica')
    .fillColor('#64748b')
    .text('Thank you for your visit! Keep medicines in a cool, dry place.', 30, footerY, { align: 'center' });

  doc.end();
}

module.exports = {
  generateBillPdf,
};
