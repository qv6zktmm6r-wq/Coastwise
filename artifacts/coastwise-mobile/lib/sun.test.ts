import assert from 'node:assert/strict';
import test from 'node:test';
import { isAfterDark, sunTimes } from './sun.ts';

const SAN_JOSE = { latitude: 37.3382, longitude: -121.8863 };
const MINUTE = 60_000;

function near(actual: number, expectedIso: string, toleranceMinutes = 6) {
  const difference = Math.abs(actual - Date.parse(expectedIso)) / MINUTE;
  assert.ok(difference <= toleranceMinutes, `${new Date(actual).toISOString()} is ${difference.toFixed(1)} min from ${expectedIso}`);
}

test('San Jose sunrise and sunset in early October', () => {
  const times = sunTimes(Date.parse('2026-10-07T20:00:00Z'), SAN_JOSE.latitude, SAN_JOSE.longitude);
  assert.ok(!('polar' in times));
  near(times.sunrise, '2026-10-07T14:10:00Z');
  near(times.sunset, '2026-10-08T01:44:00Z');
});

test('San Jose around the summer solstice', () => {
  const times = sunTimes(Date.parse('2026-06-21T20:00:00Z'), SAN_JOSE.latitude, SAN_JOSE.longitude);
  assert.ok(!('polar' in times));
  near(times.sunrise, '2026-06-21T12:48:00Z');
  near(times.sunset, '2026-06-22T03:32:00Z');
});

test('after dark is judged against local sunrise and sunset', () => {
  const at = (iso: string) => isAfterDark(Date.parse(iso), SAN_JOSE.latitude, SAN_JOSE.longitude);
  assert.equal(at('2026-10-07T19:00:00Z'), false, 'noon PDT');
  assert.equal(at('2026-10-08T01:30:00Z'), false, '6:30 pm PDT, before sunset');
  assert.equal(at('2026-10-08T02:15:00Z'), true, '7:15 pm PDT, after sunset');
  assert.equal(at('2026-10-08T06:00:00Z'), true, '11 pm PDT');
  assert.equal(at('2026-10-08T13:30:00Z'), true, '6:30 am PDT, before sunrise');
});

test('polar day and night are handled', () => {
  assert.equal(isAfterDark(Date.parse('2026-06-21T12:00:00Z'), 78, 15), false);
  assert.equal(isAfterDark(Date.parse('2026-12-21T12:00:00Z'), 78, 15), true);
});
