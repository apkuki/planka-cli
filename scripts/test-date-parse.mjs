import { parseDateInput } from '../src/prompt-utils.js';

const inputs = [
  '30.10.2025',
  '30.10.25',
  '10/30/2025',
  '2025-10-30',
  'tomorrow',
  'in 3 days'
];

for (const input of inputs) {
  const parsed = parseDateInput(input, 'de-CH');
  console.log(input, '=>', parsed ? parsed.toISOString() : 'PARSE_FAILED');
}
