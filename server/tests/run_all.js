const { spawnSync } = require('child_process');
const path = require('path');

const scripts = [
  'core_tests.js',
  'phase1_extra_tests.js',
  'phase2_discount_test.js'
];

let totalPassed = 0;
let totalFailed = 0;

console.log('====================================================');
console.log('  Running All MedTrack Test Suites');
console.log('====================================================\n');

for (const script of scripts) {
  const result = spawnSync('node', [path.join(__dirname, script)], { encoding: 'utf8' });
  console.log(result.stdout);
  if (result.stderr) console.error(result.stderr);
  
  const passedMatch = result.stdout.match(/Tests Passed: (\d+)/);
  const failedMatch = result.stdout.match(/Tests Failed: (\d+)/);
  
  if (passedMatch) totalPassed += parseInt(passedMatch[1], 10);
  if (failedMatch) totalFailed += parseInt(failedMatch[1], 10);
  
  if (result.status !== 0) {
    console.error(`\n❌ Script ${script} failed with exit code ${result.status}`);
    process.exit(1);
  }
}

console.log('====================================================');
console.log(`  COMBINED TOTAL TESTS PASSED: ${totalPassed}`);
console.log(`  COMBINED TOTAL TESTS FAILED: ${totalFailed}`);
console.log('====================================================\n');

if (totalFailed > 0) process.exit(1);
