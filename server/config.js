const path = require('path');

module.exports = {
  PORT: process.env.PORT || 4000,
  SHOP: {
    name: process.env.SHOP_NAME || 'MedTrack Medical & General Store',
    tagline: process.env.SHOP_TAGLINE || 'Trusted Care & Healthcare Essentials',
    address: process.env.SHOP_ADDRESS || 'Main Road, Opp. Primary Health Center',
    city: process.env.SHOP_CITY || 'Nizampet, Hyderabad',
    phone: process.env.SHOP_PHONE || '+91 98765 43210',
    dlNo: process.env.SHOP_DL || 'DL-20B/21B-54892',
    gstin: process.env.SHOP_GST || '36AABCM1234F1Z8',
  },
  DB_PATH: path.join(__dirname, 'db', 'medtrack.sqlite'),
  BACKUP_DIR: path.join(__dirname, 'db', 'backups'),
};
