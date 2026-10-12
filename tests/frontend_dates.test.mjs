import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapshotLabel, snapshotAsOf, istDate, periodWindow } from '../src/services/dates.js';

test('IST date crosses midnight independently of the browser timezone', () => {
  assert.equal(istDate(new Date('2026-10-12T18:31:00Z')), '2026-10-13');
  assert.equal(snapshotLabel(0, new Date('2026-10-12T18:31:00Z')), 'Tue 13 Oct 2026');
});
test('today uses current time, rather than unreplayed future evening rows', () => {
  const now = new Date('2026-10-12T04:30:00Z');
  assert.equal(snapshotAsOf('Mon 12 Oct 2026', now), now.toISOString());
  assert.equal(snapshotAsOf('Sun 11 Oct 2026', now), '2026-10-11T17:30:00.000Z');
  assert.equal(snapshotAsOf('2026-10-12', now), now.toISOString());
});
test('monthly windows use IST calendar boundaries across a UTC month rollover', () => {
  assert.equal(periodWindow('2026-10-01T00:30:00+05:30', 'This month').start, '2026-09-30T18:30:00.000Z');
  const previous = periodWindow('2027-01-01T00:30:00+05:30', 'Last month');
  assert.equal(previous.start, '2026-11-30T18:30:00.000Z');
  assert.equal(previous.end, '2026-12-31T18:29:59.999Z');
});
