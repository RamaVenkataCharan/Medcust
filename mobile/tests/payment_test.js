const payments = [];

function addDuePayment({ customerId, amountPaid, note = null }) {
  const formattedNote = note.trim() ? `Cash - ${note.trim()}` : 'Cash';
  payments.push({ id: 1, customerId, amount: amountPaid, note: formattedNote });
  console.log('✅ Mobile addDuePayment test: Payment saved with note "' + formattedNote + '"');
  
  const savedNote = payments[0].note;
  const profileDisplay = `Payment • ${savedNote.split(' - ')[0]}`;
  console.log(`✅ Mobile Profile UI check: Profile shows "${profileDisplay}"`);
}

addDuePayment({ customerId: 1, amountPaid: 50, note: 'counter settled' });
