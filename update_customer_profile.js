const fs = require('fs');
const path = 'mobile/src/screens/CustomerProfileScreen.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Update extractPaymentMethod
const newExtract = `function extractPaymentMethod(note) {
  if (!note) return null;
  const parts = note.split(' - ');
  const mode = parts[0].trim();
  if (['Cash', 'UPI', 'Bank'].includes(mode)) return mode;
  
  const lower = note.toLowerCase();
  if (lower.includes('upi')) return 'UPI';
  if (lower.includes('cash')) return 'Cash';
  if (lower.includes('card')) return 'Card';
  if (lower.includes('cheque') || lower.includes('check')) return 'Cheque';
  if (lower.includes('neft') || lower.includes('rtgs') || lower.includes('imps') || lower.includes('bank')) return 'Bank';
  return null;
}`;
content = content.replace(/function extractPaymentMethod\(note\) \{[\s\S]*?return null;\n\}/, newExtract);

// 2. Update PaymentRow to extract user note
const oldNoteDisplay = `{isExpanded && item.note ? (
        <View style={styles.expandedBox}>
          <Text style={styles.noteText}>{item.note}</Text>
        </View>
      ) : null}`;
const newNoteDisplay = `// Expanded: show full note if present
      {(() => {
        if (!isExpanded || !item.note) return null;
        let displayNote = item.note;
        if (method) {
          const prefix = method + ' - ';
          if (displayNote.startsWith(prefix)) {
            displayNote = displayNote.substring(prefix.length).trim();
          } else if (displayNote === method) {
            displayNote = null;
          }
        }
        if (!displayNote) return null;
        return (
          <View style={styles.expandedBox}>
            <Text style={styles.noteText}>{displayNote}</Text>
          </View>
        );
      })()}`;
content = content.replace(/\{isExpanded && item\.note \? \([\s\S]*?\) : null\}/, newNoteDisplay);

// 3. Remove modal states
content = content.replace(/  \/\/ Payment modal state\n  const \[payModalVisible, setPayModalVisible\] = useState\(false\);\n  const \[paymentAmount, setPaymentAmount\] = useState\(''\);\n  const \[paymentNote, setPaymentNote\] = useState\(''\);\n  const \[savingPayment, setSavingPayment\] = useState\(false\);\n/, '');
// In case the modal state is slightly different, let's also remove them individually
content = content.replace(/const \[payModalVisible, setPayModalVisible\] = useState\(false\);\n/g, '');
content = content.replace(/const \[paymentAmount, setPaymentAmount\] = useState\(''\);\n/g, '');
content = content.replace(/const \[paymentNote, setPaymentNote\] = useState\(''\);\n/g, '');
content = content.replace(/const \[savingPayment, setSavingPayment\] = useState\(false\);\n/g, '');
content = content.replace(/  \/\/ Payment modal state\n/g, '');

// 4. Remove handleRecordPayment
content = content.replace(/  \/\/ ── Payment recording \(preserved from original\) ──[\s\S]*?loadProfile\(\);\n    \} catch \(e\) \{\n      Alert\.alert\('Error', 'Could not record payment: ' \+ e\.message\);\n    \} finally \{\n      setSavingPayment\(false\);\n    \}\n  \};\n/g, '');

// 5. Update the Record Payment button
const oldButton = `onPress={() => {
              setPaymentAmount(String(totalDue.toFixed(2)));
              setPaymentNote('');
              setPayModalVisible(true);
            }}`;
const newButton = `onPress={() => navigation.navigate('RecordPayment', { customerId: customer.customer_id })}`;
content = content.replace(oldButton, newButton);

// 6. Remove <Modal>
content = content.replace(/      \{\/\* ── Record Payment Modal ──[\s\S]*?<\/Modal>/, '');
content = content.replace(/      \{\/\*  Record Payment Modal \n \*\/\}[\s\S]*?<\/Modal>/, ''); // handle weird unicode comments if they exist

// 7. Remove modal styles
content = content.replace(/  \/\/ ── Payment Modal ──[\s\S]*?modalConfirmBtnText: \{[\s\S]*?\},/g, '');
content = content.replace(/  \/\/  Payment Modal[\s\S]*?modalConfirmBtnText: \{[\s\S]*?\},/g, '');

// Save back
fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated CustomerProfileScreen.js');
