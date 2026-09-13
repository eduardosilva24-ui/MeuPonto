// Cálculos de apresentação do painel de saldo. A fonte de verdade continua na API.
const Dashboard = (() => {
  function toDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function getWeekRange(todayKey = Calc.getTodayKey()) {
    const [year, month, day] = todayKey.split('-').map(Number);
    const start = new Date(year, month - 1, day, 12);
    start.setHours(12, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start: toDateKey(start), end: toDateKey(end) };
  }

  function summarize(days, range, todayKey = Calc.getTodayKey()) {
    const scoped = days.filter((day) => day && day.dateKey >= range.start && day.dateKey <= range.end);
    let worked = 0;
    let planned = 0;
    let extras = 0;
    let missing = 0;
    let daysWorked = 0;
    let daysRemaining = 0;
    let incomplete = 0;
    let folgas = 0;
    let feriados = 0;

    scoped.forEach((day) => {
      const isFuture = day.dateKey > todayKey;
      const isComplete = CalendarUI.isComplete(day);
      const dayWorked = Number(day.totalWorkedMinutes) || 0;
      const dayPlanned = Number(day.predictedMinutes) || 0;

      if (day.nextAction === 'FERIADO') { feriados += 1; return; }
      if (day.nextAction === 'FOLGA') { folgas += 1; return; }
      if (isFuture) {
        if (day.available) daysRemaining += 1;
        return;
      }

      planned += dayPlanned;
      worked += dayWorked;
      if (isComplete) daysWorked += 1;
      else incomplete += 1;
      extras += Math.max(dayWorked - dayPlanned, 0);
      missing += Math.max(dayPlanned - dayWorked, 0);
    });

    return {
      range,
      worked,
      planned,
      balance: worked - planned,
      extras,
      missing,
      daysWorked,
      daysRemaining,
      incomplete,
      folgas,
      feriados,
      totalDays: scoped.length,
    };
  }

  function describeBalance(balance) {
    if (balance > 0) return `Você está com saldo positivo de ${Calc.minutesToDisplay(balance)}.`;
    if (balance < 0) return `Você precisa trabalhar mais ${Calc.minutesToDisplay(Math.abs(balance))} para ficar em dia.`;
    return 'Sua jornada está em dia.';
  }

  return { getWeekRange, summarize, describeBalance };
})();

window.Dashboard = Dashboard;
