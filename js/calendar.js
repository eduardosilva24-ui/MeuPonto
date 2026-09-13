// Regras de apresentação do calendário. Não consulta API nem altera estado.
const CalendarUI = (() => {
  function hasAnyRecord(day) {
    const entries = day?.entradas || {};
    return Boolean(entries.entrada || entries.saidaCafe || entries.voltaCafe || entries.saida);
  }

  function isComplete(day) {
    return day?.nextAction === 'FINALIZADO';
  }

  function getStatus(day, todayKey = Calc.getTodayKey()) {
    if (!day) return { key: 'empty', label: '' };
    if (day.nextAction === 'FERIADO') return { key: 'feriado', label: 'Feriado' };
    if (day.nextAction === 'FOLGA') return { key: 'off', label: 'Folga' };
    if (isComplete(day)) return { key: 'complete', label: 'Jornada completa' };
    if (day.dateKey > todayKey) return { key: 'future', label: 'Futuro' };
    if (hasAnyRecord(day)) return { key: 'pending', label: 'Jornada incompleta' };
    return { key: 'danger', label: 'Ausência' };
  }

  function dotClass(day, todayKey) {
    const status = getStatus(day, todayKey).key;
    return status === 'future' ? 'off' : status;
  }

  return { hasAnyRecord, isComplete, getStatus, dotClass };
})();

window.CalendarUI = CalendarUI;
