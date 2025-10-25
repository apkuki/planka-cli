import assert from 'assert';
import { normalizeTitle, extractDatePhrase, computeEndOfNextWeek } from '../src/interpret.js';

// 1) Title normalization
const t1 = "Please add a task to my planka board that i should test ai input until end of next week";
const n1 = normalizeTitle(t1);
assert(n1.length > 0, 'Normalized title should not be empty');
assert(!/please/i.test(n1), 'Polite prefix should be removed');

// 2) Extract date phrase
const dp = extractDatePhrase(t1);
assert(dp === 'end of next week', 'Should detect "end of next week"');

// 3) Compute end of next week returns a Date in future and is Sunday end-of-day
const d = computeEndOfNextWeek(new Date('2025-10-25T00:00:00Z')); // 2025-10-25 is Saturday
// expected Sunday 2025-11-02
const expected = new Date('2025-11-02T23:59:59.999Z');
assert(d.getUTCFullYear() === expected.getUTCFullYear() && d.getUTCMonth() === expected.getUTCMonth() && d.getUTCDate() === expected.getUTCDate(), `Expected ${expected.toISOString()} got ${d.toISOString()}`);

console.log('All interpret tests passed');
