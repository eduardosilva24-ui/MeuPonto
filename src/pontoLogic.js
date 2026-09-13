const { formatDateKey, getWeekdayName, getLastDayOfMonth } = require('./dateUtils');

function scorePointRow(row = []) {
  let score = 0;
  if (String(row[1] || '').trim()) score += 5;
  for (let i = 2; i <= 5; i += 1) {
    if (String(row[i] || '').trim()) score += 4;
  }
  if (String(row[6] || '').trim()) score += 2;
  if (String(row[7] || '').trim()) score += 2;
  if (String(row[8] || '').trim()) score += 1;
  return score;
}

function mergeDuplicateDailyEntries(rows = []) {
  const byDate = new Map();

  rows.forEach((row) => {
    if (!row || !String(row[1] || '').trim()) return;

    const dateKey = String(row[1]).trim();
    const candidate = Array.isArray(row) ? row.slice() : [];
    while (candidate.length < 14) candidate.push('');

    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, candidate.slice(0, 14));
      return;
    }

    const current = byDate.get(dateKey);
    for (let i = 0; i < 14; i += 1) {
      const currentValue = String(current[i] || '').trim();
      const nextValue = String(candidate[i] || '').trim();
      if (nextValue && (currentValue === '' || i === 0 || (i >= 2 && i <= 5 && nextValue !== currentValue))) {
        current[i] = candidate[i];
      }
    }
    byDate.set(dateKey, current);
  });

  return Array.from(byDate.values()).filter((row) => String(row[1] || '').trim());
}

function getExpectedSchedule(date, scheduleMap = {}) {
  const dayName = getWeekdayName(date);
  const defaultMap = {
    Segunda: { trabalha: true, entrada: '15:00', saida: '21:00', saidaCafe: '17:00', voltaCafe: '17:15' },
    Terça: { trabalha: true, entrada: '15:00', saida: '21:00', saidaCafe: '17:00', voltaCafe: '17:15' },
    Quarta: { trabalha: true, entrada: '15:00', saida: '21:00', saidaCafe: '17:00', voltaCafe: '17:15' },
    Quinta: { trabalha: true, entrada: '15:00', saida: '21:00', saidaCafe: '17:00', voltaCafe: '17:15' },
    Sexta: { trabalha: true, entrada: '14:00', saida: '20:00', saidaCafe: '16:00', voltaCafe: '16:15' },
    Sábado: { trabalha: true, entrada: '08:00', saida: '15:00', saidaCafe: '', voltaCafe: '' },
    Domingo: { trabalha: false, entrada: '', saida: '', saidaCafe: '', voltaCafe: '' },
  };

  const schedule = scheduleMap[dayName] || defaultMap[dayName] || { trabalha: false, entrada: '', saida: '', saidaCafe: '', voltaCafe: '' };

  const start = schedule.trabalha ? schedule.entrada || null : null;
  const end = schedule.trabalha ? schedule.saida || null : null;
  const expectedMinutes = schedule.trabalha
    ? Math.max(toMinutes(end) - toMinutes(start) - ((schedule.saidaCafe && schedule.voltaCafe) ? (toMinutes(schedule.voltaCafe) - toMinutes(schedule.saidaCafe)) : 0), 0)
    : 0;

  return {
    isWorkday: !!schedule.trabalha,
    start,
    end,
    expectedMinutes,
    dayName,
    schedule,
  };
}

function getNextActionForDay(dayState) {
  if (dayState && dayState.feriado && !dayState.trabalhaNoFeriado) {
    return 'feriado';
  }

  if (!dayState || !dayState.available) {
    return 'folga';
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
  getExpectedSchedule,
  getNextActionForDay,
  minutesToTime,
  calculateWorkedMinutes,
  toMinutes,
  calculateDailySummary,
  getExpectedHoursForMonth,
  mergeDuplicateDailyEntries,
  scorePointRow,
  formatDateKey
};
