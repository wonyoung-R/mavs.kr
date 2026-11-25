import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeRecordsSync,currentNbaSeason} from '../../src/lib/records/season-sync';
test('records writer authentication fails closed and matches only exact bearer',()=>{
  assert.equal(authorizeRecordsSync(null,undefined),false);
  assert.equal(authorizeRecordsSync('Bearer x','x'),false);
  const secret='a'.repeat(32);
  assert.equal(authorizeRecordsSync(`Bearer ${secret}`,secret),true);
  assert.equal(authorizeRecordsSync(`Bearer ${secret}x`,secret),false);
  assert.equal(authorizeRecordsSync(`bearer ${secret}`,secret),false);
});
test('NBA season rolls in September and spans calendar years',()=>{
  assert.equal(currentNbaSeason(new Date('2026-11-13T00:00:00Z')),2026);
  assert.equal(currentNbaSeason(new Date('2027-06-20T00:00:00Z')),2026);
  assert.equal(currentNbaSeason(new Date('2027-09-01T00:00:00Z')),2027);
});
