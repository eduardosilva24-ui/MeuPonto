const { formatDateKey, getWeekdayName, getLastDayOfMonth } = require('./dateUtils');

function getNextActionForDay(dayState) {
  if (!dayState || !dayState.available) {
    return 'folga';
  }

  if (dayState.feriado && !dayState.trabalhaNoFeriado) {
    return 'feriado';
  }

  const { registros } = dayState;
  if (!registros.entrada) return 'ENTRADA';
  if (!registros.saidaCafe) return 'SAIDA_CAFE';
  if (!registros.voltaCafe) return 'VOLTA_CAFE';
  if (!registros.saida) return 'SAIDA';
  return 'FINALIZADO';
}

function minutesToTime(totalMinutes) {
  const negative = totalMinutes < 0;
  const abs = Math.abs(totalMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  const sign = negative ? '-' : '';
  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function calculateWorkedMinutes(entry, exit, coffeeExit, coffeeReturn) {
  if (!entry || !exit) return 0;

  const entryMinutes = toMinutes(entry);
  const exitMinutes = toMinutes(exit);
  let total = exitMinutes - entryMinutes;

  if (coffeeExit && coffeeReturn) {
    const coffeeExitMinutes = toMinutes(coffeeExit);
    const coffeeReturnMinutes = toMinutes(coffeeReturn);
    total -= (coffeeReturnMinutes - coffeeExitMinutes);
  }

  return Math.max(total, 0);
}

function toMinutes(timeText) {
  if (!timeText) return 0;
  const [hours, minutes] = String(timeText).split(':').map(Number);
  return hours * 60 + minutes;
}

function calculateDailySummary(dayState) {
  const registros = dayState?.registros || {};
  const totalMinutes = calculateWorkedMinutes(
    registros.entrada,
    registros.saida,
    registros.saidaCafe,
    registros.voltaCafe
  );

  const plannedMinutes = dayState?.jornada?.plannedMinutes || 0;
  const saldo = totalMinutes - plannedMinutes;

  return {
    totalMinutes,
    plannedMinutes,
    saldo,
    hoursWorked: minutesToTime(totalMinutes),
    saldoText: minutesToTime(saldo),
    nextAction: getNextActionForDay(dayState)
  };
}

function getExpectedHoursForMonth(year, monthIndex, scheduleMap) {
  let total = 0;
  const daysInMonth = getLastDayOfMonth(year, monthIndex);

  for (let day = 1; day <= daysInMonth; day += 1) {
    const maybeDate = new Date(year, monthIndex, day);
    const dayName = getWeekdayName(maybeDate);
    const schedule = scheduleMap[dayName];
    if (schedule && schedule.trabalha) {
      total += (schedule.entradaMinutes || 0) && (schedule.saidaMinutes || 0)
        ? Math.max((schedule.saidaMinutes - schedule.entradaMinutes) - (schedule.intervalo || 0), 0)
        : 0;
    }
  }

  return total;
}

module.exports = {
  getNextActionForDay,
  minutesToTime,
  calculateWorkedMinutes,
  toMinutes,
  calculateDailySummary,
  getExpectedHoursForMonth,
  formatDateKey
};
