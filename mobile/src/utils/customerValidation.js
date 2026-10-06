const { cleanPhoneNumber } = require('./khataLogic');

/**
 * Pure function to validate customer input for edits.
 * @param {Object} values - { name, phone_number }
 * @param {Array} existingCustomers - All customers (active and deleted)
 * @param {Number} selfId - The customer_id being edited
 * @returns {Object} { isValid, error }
 */
function validateCustomerInput(values, existingCustomers, selfId) {
  const name = (values.name || '').trim();
  const phone = cleanPhoneNumber(values.phone_number);

  if (!name) {
    return { isValid: false, error: 'Name is required.' };
  }

  if (phone.length < 10) {
    return { isValid: false, error: 'Phone number must be exactly 10 digits.' };
  }

  const numericSelfId = parseInt(selfId, 10);
  
  const duplicate = existingCustomers.find(c => 
    c.customer_id !== numericSelfId && c.phone_number === phone
  );

  if (duplicate) {
    if (duplicate.deleted_at) {
      return { 
        isValid: false, 
        error: `This number is in the Recycle Bin.`,
        duplicateId: duplicate.customer_id,
        isDeleted: true 
      };
    } else {
      return { 
        isValid: false, 
        error: `This number belongs to ${duplicate.name}.`,
        duplicateId: duplicate.customer_id,
        isDeleted: false 
      };
    }
  }

  return { isValid: true, error: null, cleanPhone: phone, cleanName: name };
}

module.exports = { validateCustomerInput };
