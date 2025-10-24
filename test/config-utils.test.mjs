import assert from 'assert';
import path from 'path';
import { findMatchingProjectBoard } from '../src/config-utils.js';

function makeCfg(map) {
  return { projects: map };
}

// Test: exact match
const cfg1 = makeCfg({
  'C:/projects/foo': { PLANKA_BOARD_ID: 'A' }
});
assert.strictEqual(findMatchingProjectBoard(cfg1, path.resolve('C:/projects/foo')), 'A');

// Test: prefer longest prefix (parent vs ancestor)
const cfg2 = makeCfg({
  'C:/projects': { PLANKA_BOARD_ID: 'ROOT' },
  'C:/projects/foo/sub': { PLANKA_BOARD_ID: 'SUB' }
});
assert.strictEqual(findMatchingProjectBoard(cfg2, path.resolve('C:/projects/foo/sub/deep')), 'SUB');

// Test: fallback when only root matches
const cfg3 = makeCfg({
  'C:/projects': { PLANKA_BOARD_ID: 'ROOT' }
});
assert.strictEqual(findMatchingProjectBoard(cfg3, path.resolve('C:/projects/other')), 'ROOT');

// Test: no match
const cfg4 = makeCfg({
  'D:/other': { PLANKA_BOARD_ID: 'X' }
});
assert.strictEqual(findMatchingProjectBoard(cfg4, path.resolve('C:/projects/foo')), undefined);

console.log('All config-utils tests passed');
