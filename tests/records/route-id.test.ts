import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeRecordRouteId } from '../../src/lib/records/route-id';

test('game and player links resolve the same ID with or without URL escapes', () => {
  for (const id of ['nba:game:0022501193', 'nba:player:1717', 'dirk']) {
    assert.equal(decodeRecordRouteId(id), id);
    assert.equal(decodeRecordRouteId(encodeURIComponent(id)), id);
    assert.equal(decodeRecordRouteId(encodeURIComponent(id).replace(/%3A/g, '%3a')), id);
  }
});

test('invalid path segments fail closed without a URI exception or recursive decode', () => {
  for (const id of ['', '%', '%ZZ', '%E0%A4%A', 'nba%253Agame%253A0022501193',
    'nba%2Fgame', 'nba%5Cgame', 'nba%00game', 'nba%3Fgame', 'nba%23game']) {
    assert.equal(decodeRecordRouteId(id), null, id);
  }
});
