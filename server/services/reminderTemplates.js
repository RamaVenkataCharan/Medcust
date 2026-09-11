/**
 * Reminder Templates — MedTrack Pharmacy
 * 
 * Strict tone guidelines:
 * - Always gentle, polite, and respectful (neighborly shopkeeper, NOT a debt collector).
 * - Always include the shop name.
 * - Always mention counter contact ("counter par baat kar sakte hain").
 * - Never use urgency/penalty words ("immediately", "overdue", "legal", "fine", "action required").
 */

const reminderConfig = require('./reminderConfig');

function formatCurrency(amount) {
  return Number(amount || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

function formatDate(dateStr) {
  if (!dateStr) return 'kuchh din';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

const templates = {
  hinglish: {
    name: 'Hinglish (Default)',
    render: ({ customerName, shopName, amount, date, paymentLink, shopPhone }) => {
      const cleanShop = shopName || reminderConfig.shopInfo.name;
      const cleanAmt = formatCurrency(amount);
      const cleanDate = formatDate(date);
      const linkText = paymentLink ? `\n\nJab suvidha ho, yahan se direct pay kar sakte hain:\n${paymentLink}` : '';
      return (
        `Namaste ${customerName || 'Ji'}, ${cleanShop} se ek chhota reminder — ` +
        `aapka ₹${cleanAmt} ka bill pending hai ${cleanDate} se.${linkText}\n\n` +
        `Kisi bhi sawal ya suvidha ke liye counter par baat kar sakte hain (${shopPhone || reminderConfig.shopInfo.phone}). Dhanyavaad!`
      );
    },
  },

  hindi: {
    name: 'Hindi',
    render: ({ customerName, shopName, amount, date, paymentLink, shopPhone }) => {
      const cleanShop = shopName || reminderConfig.shopInfo.name;
      const cleanAmt = formatCurrency(amount);
      const cleanDate = formatDate(date);
      const linkText = paymentLink ? `\n\nसुविधा अनुसार यहाँ से ऑनलाइन भुगतान कर सकते हैं:\n${paymentLink}` : '';
      return (
        `नमस्ते ${customerName || 'जी'}, ${cleanShop} से एक विनम्र रिमाइंडर — ` +
        `आपका ₹${cleanAmt} का बिल ${cleanDate} से बाकी है।${linkText}\n\n` +
        `किसी भी जानकारी या सहायता के लिए दुकान के काउंटर पर संपर्क करें (${shopPhone || reminderConfig.shopInfo.phone})। धन्यवाद!`
      );
    },
  },

  english: {
    name: 'English',
    render: ({ customerName, shopName, amount, date, paymentLink, shopPhone }) => {
      const cleanShop = shopName || reminderConfig.shopInfo.name;
      const cleanAmt = formatCurrency(amount);
      const cleanDate = formatDate(date);
      const linkText = paymentLink ? `\n\nYou can conveniently pay online here:\n${paymentLink}` : '';
      return (
        `Namaste ${customerName || 'Sir/Madam'}, a gentle reminder from ${cleanShop} — ` +
        `your bill of ₹${cleanAmt} has been pending since ${cleanDate}.${linkText}\n\n` +
        `Feel free to speak with us at the counter if you have any questions (${shopPhone || reminderConfig.shopInfo.phone}). Thank you!`
      );
    },
  },

  // One-way informational courtesy call script (strictly informational, no dialogue, no negotiation)
  courtesyCall: {
    name: 'Courtesy Call Script (One-Way)',
    render: ({ customerName, shopName, amount, shopPhone }) => {
      const cleanShop = shopName || reminderConfig.shopInfo.name;
      const cleanAmt = formatCurrency(amount);
      return (
        `Namaste ${customerName || ''}, yeh ${cleanShop} se ek automated reminder call hai. ` +
        `Aapke pass ₹${cleanAmt} ka pending bill hai jiska WhatsApp aur SMS bhi bheja gaya tha. ` +
        `Kripya jab suvidha ho counter par sampark karein. Dhanyavaad.`
      );
    },
  },
};

/**
 * Render message for a customer in the chosen language
 */
function renderMessage({ language = 'hinglish', customerName, amount, date, paymentLink }) {
  const selectedLang = (language || 'hinglish').toLowerCase();
  const template = templates[selectedLang] || templates.hinglish;
  return template.render({
    customerName,
    shopName: reminderConfig.shopInfo.name,
    shopPhone: reminderConfig.shopInfo.phone,
    amount,
    date,
    paymentLink,
  });
}

module.exports = {
  templates,
  renderMessage,
  formatCurrency,
  formatDate,
};
