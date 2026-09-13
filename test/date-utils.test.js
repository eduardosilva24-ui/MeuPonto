const assert = require('node:assert');
const { formatDateKey, getWeekdayName, getLastDayOfMonth, dayInMonth } = require('../src/dateUtils.js');

assert.strictEqual(formatDateKey(new Date('2026-09-12T12:00:00-03:00')), '2026-09-12');
assert.strictEqual(getWeekdayName(new Date('2026-09-12T12:00:00-03:00')), 'Sábado');
assert.strictEqual(getLastDayOfMonth(2024, 1), 29);
assert.strictEqual(dayInMonth(new Date('2024-02-29T12:00:00-03:00')), 29);

console.log('date-utils tests passed');
