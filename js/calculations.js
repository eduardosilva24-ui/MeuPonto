(function () {
  function pad2(value) {
    return String(Number(value || 0)).padStart(2, '0');
  }

  function toMinutes(timeText) {
    if (!timeText) return 0;
    const match = String(timeText).trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return 0;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    return hours * 60 + minutes;
  }

  function minutesToText(value) {
    const total = Number(value) || 0;
    const sign = total < 0 ? '-' : '';
    const abs = Math.abs(total);
    const hours = Math.floor(abs / 60);
    const minutes = abs % 60;
    return sign + pad2(hours) + ':' + pad2(minutes);
  }

  function calculateWorkedMinutes(entry, coffeeExit, coffeeReturn, exit) {
    if (!entry || !exit) return 0;
    let total = toMinutes(exit) - toMinutes(entry);
    if (coffeeExit && coffeeReturn) {
      total -= (toMinutes(coffeeReturn) - toMinutes(coffeeExit));
    }
    return Math.max(total, 0);
  }

  function getExpectedSchedule(date, scheduleMap) {
    const defaultMap = {
      'Segunda': { trabalha: true, entrada: '15:00', saida: '21:00', saidaCafe: '', voltaCafe: '' },
      'Terça': { trabalha: true, entrada: '15:00', saida: '21:00', saidaCafe: '', voltaCafe: '' },
      'Quarta': { trabalha: true, entrada: '15:00', saida: '21:00', saidaCafe: '', voltaCafe: '' },
      'Quinta': { trabalha: true, entrada: '15:00', saida: '21:00', saidaCafe: '', voltaCafe: '' },
      'Sexta': { trabalha: true, entrada: '14:00', saida: '20:00', saidaCafe: '', voltaCafe: '' },
      'Sábado': { trabalha: true, entrada: '08:00', saida: '15:00', saidaCafe: '', voltaCafe: '' },
      'Domingo': { trabalha: false, entrada: '', saida: '', saidaCafe: '', voltaCafe: '' }
    };

    const weekday = getWeekdayName(date);
    const base = scheduleMap && scheduleMap[weekday] ? scheduleMap[weekday] : defaultMap[weekday] || defaultMap['Domingo'];
    const working = !!base.trabalha;
    const start = working ? String(base.entrada || '00:00') : '';
    const end = working ? String(base.saida || '00:00') : '';
    let expectedMinutes = 0;

    if (working && start && end) {
      expectedMinutes = Math.max(toMinutes(end) - toMinutes(start), 0);
      if (base.saidaCafe && base.voltaCafe) {
        expectedMinutes -= Math.max(toMinutes(base.voltaCafe) - toMinutes(base.saidaCafe), 0);
      }
    }

    return {
      isWorkday: working,
      start,
      end,
      expectedMinutes,
      dayName: weekday,
      schedule: base
    };
  }

  function getWeekdayName(dateLike) {
    const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
    const day = date.getDay();
    const names = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return names[day];
  }

  function formatDateKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function getActionType(state) {
    if (!state) return 'ENTRADA';
    const { entrada, saidaCafe, voltaCafe, saida } = state;
    if (!entrada) return 'ENTRADA';
    if (!saidaCafe) return 'SAIDA_CAFE';
    if (!voltaCafe) return 'VOLTA_CAFE';
    if (!saida) return 'SAIDA';
    return 'FINALIZADO';
  }

  window.PontoCalc = {
    pad2,
    toMinutes,
    minutesToText,
    calculateWorkedMinutes,
    getExpectedSchedule,
    getWeekdayName,
    formatDateKey,
    getActionType
  };
})();
