import test from 'node:test';
import assert from 'node:assert/strict';
import { organizeBoxScore } from '../../src/components/records/box-score';
import { STAT_KEYS, type RecordPlayerStat, type StatValues } from '../../src/lib/records/types';

function row(id: string, starter: boolean | null, position: RecordPlayerStat['starterPosition'], minutes: number | null, participation: RecordPlayerStat['participation'] = 'played'): RecordPlayerStat {
  return { gameId: 'g', teamId: 'dal', playerId: id, starter, starterPosition: position,
    participation, reason: null, sourceId: 's',
    values: Object.fromEntries(STAT_KEYS.map(key => [key, key === 'MIN_SECONDS' ? minutes : null])) as StatValues };
}
const startingFive = () => [row('c', true, 'C', 600), row('f1', true, 'F', 1200), row('g1', true, 'G', 900), row('f2', true, 'F', 500), row('g2', true, 'G', 400)];

test('box score sorts five starters G/F/C, then bench by minutes, then non-participants', () => {
  const input = [row('dnp', null, null, 9999, 'dnp'), row('bench-short', null, null, 0), ...startingFive(), row('bench-long', false, null, 2400), row('bench-null', null, null, null), row('inactive', null, null, null, 'inactive')];
  const original = input.map(r => r.playerId);
  const result = organizeBoxScore(input);
  assert.equal(result.lineupKnown, true);
  assert.deepEqual(result.rows.map(({row}) => row.playerId), ['g1', 'g2', 'f1', 'f2', 'c', 'bench-long', 'bench-short', 'bench-null', 'dnp', 'inactive']);
  assert.deepEqual(result.rows.slice(0, 5).map(r => r.role), Array(5).fill('Starter'));
  assert.equal(result.rows[6].role, 'Bench');
  assert.deepEqual(input.map(r => r.playerId), original);
});

test('missing or conflicting source lineups never invent five starters or bench roles', () => {
  for (const input of [startingFive().slice(0, 4), [...startingFive(), row('sixth', true, 'G', 200)], [row('unknown', null, null, 1200)], [...startingFive().slice(0, 4), row('bad', true, 'C', null, 'dnp')]]) {
    const result = organizeBoxScore(input);
    assert.equal(result.lineupKnown, false);
    assert(result.rows.every(({role}) => !['Starter', 'Bench'].includes(role)));
  }
});

test('unknown participation remains unknown even when a starting five exists', () => {
  const result = organizeBoxScore([...startingFive(), row('uncertain', false, null, 120, 'unknown')]);
  assert.equal(result.rows.at(-1)!.role, 'Unknown');
});
