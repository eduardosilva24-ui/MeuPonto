// ─── Meu Ponto — calculations.js ─────────────────────────────────────────────
// Cálculos locais (espelha a lógica do PontoCore.gs no frontend)
// ─────────────────────────────────────────────────────────────────────────────

const Calc = (() => {

  /** Converte "HH:MM" em minutos totais */
  function toMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = String(timeStr).split(':');
    if (parts.length < 2) return 0;
    return (parseInt(parts[0], 10) * 60) + parseInt(parts[1], 10);
  }

  /** Converte minutos totais em "HH:MM" (negativo → "-HH:MM") */
  function minutesToText(totalMinutes) {
    const negative = totalMinutes < 0;
    const abs      = Math.abs(Math.round(totalMinutes));
    const h        = Math.floor(abs / 60);
    const m        = abs % 60;
    return (negative ? '-' : '') + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  /** Formata minutos como texto amigável: "06h44" ou "-00h15" */
  function minutesToDisplay(totalMinutes) {
    const negative = totalMinutes < 0;
    const abs      = Math.abs(Math.round(totalMinutes));
    const h        = Math.floor(abs / 60);
    const m        = abs % 60;
    return (negative ? '-' : '') + String(h).padStart(2, '0') + 'h' + String(m).padStart(2, '0');
  }

  function minutesToBalanceDisplay(totalMinutes) {
    if (!totalMinutes) return '00h00';
    return (totalMinutes > 0 ? '+' : '-') + minutesToDisplay(Math.abs(totalMinutes));
  }

  /**
   * Calcula minutos trabalhados:
   * (Saída - Entrada) - intervalo_café
   */
  function calculateWorkedMinutes(entrada, saida, saidaCafe, voltaCafe) {
    if (!entrada || !saida) return 0;
    const entryMin  = toMinutes(entrada);
    const exitMin   = toMinutes(saida);
    let   total     = exitMin - entryMin;
    if (saidaCafe && voltaCafe) {
      total -= (toMinutes(voltaCafe) - toMinutes(saidaCafe));
    }
    return Math.max(total, 0);
  }

  function getExpectedSchedule(date, scheduleMap = {}) {
    const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' }).format(date);
    const normalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    const defaultMap = {
      Segunda: { trabalha: true, entrada: '15:00', saida: '21:00', saidaCafe: '17:00', voltaCafe: '17:15' },
      Terça: { trabalha: true, entrada: '15:00', saida: '21:00', saidaCafe: '17:00', voltaCafe: '17:15' },
      Quarta: { trabalha: true, entrada: '15:00', saida: '21:00', saidaCafe: '17:00', voltaCafe: '17:15' },
      Quinta: { trabalha: true, entrada: '15:00', saida: '21:00', saidaCafe: '17:00', voltaCafe: '17:15' },
      Sexta: { trabalha: true, entrada: '14:00', saida: '20:00', saidaCafe: '16:00', voltaCafe: '16:15' },
      Sábado: { trabalha: true, entrada: '08:00', saida: '15:00', saidaCafe: '', voltaCafe: '' },
      Domingo: { trabalha: false, entrada: '', saida: '', saidaCafe: '', voltaCafe: '' },
    };

    const schedule = scheduleMap[normalizedWeekday] || defaultMap[normalizedWeekday] || { trabalha: false, entrada: '', saida: '', saidaCafe: '', voltaCafe: '' };
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
      weekday: normalizedWeekday,
      schedule,
    };
  }

  /**
   * Calcula os minutos previstos para a jornada do dia
   */
  function getPredictedMinutes(schedule) {
    if (!schedule || !schedule.trabalha) return 0;
    const entrada = toMinutes(schedule.entrada  || '00:00');
    const saida   = toMinutes(schedule.saida    || '00:00');
    const cafe    = (schedule.saidaCafe && schedule.voltaCafe)
      ? toMinutes(schedule.voltaCafe) - toMinutes(schedule.saidaCafe)
      : 0;
    return Math.max(saida - entrada - cafe, 0);
  }

  /**
   * Determina a próxima ação do dia baseado nos registros
   */
  function getNextAction(entradas, schedule, holiday) {
    if (holiday && !holiday.trabalha)        return 'FERIADO';
    const isWorkDay = holiday ? !!holiday.trabalha : !!(schedule && schedule.trabalha);
    if (!isWorkDay)                          return 'FOLGA';
    if (!entradas.entrada)                   return 'ENTRADA';
    if (!entradas.saidaCafe)                 return 'SAIDA_CAFE';
    if (!entradas.voltaCafe)                 return 'VOLTA_CAFE';
    if (!entradas.saida)                     return 'SAIDA';
    return 'FINALIZADO';
  }

  /**
   * Retorna label amigável para a próxima ação
   */
  function getActionLabel(action) {
    const map = {
      ENTRADA:    '⏰ Registrar Entrada',
      SAIDA_CAFE: '☕ Sair para Café',
      VOLTA_CAFE: '🔙 Voltar do Café',
      SAIDA:      '🏁 Registrar Saída',
      FINALIZADO: '✅ Ponto Finalizado',
      FOLGA:      '😴 Dia de Folga',
      FERIADO:    '🎉 Feriado',
    };
    return map[action] || 'Registrar';
  }

  /**
   * Retorna class CSS para o botão baseado na ação
   */
  function getActionClass(action) {
    const map = {
      ENTRADA:    'btn-entrada',
      SAIDA_CAFE: 'btn-saidacafe',
      VOLTA_CAFE: 'btn-voltacafe',
      SAIDA:      'btn-saida',
      FINALIZADO: 'btn-done',
      FOLGA:      'btn-off',
      FERIADO:    'btn-off',
    };
    return map[action] || '';
  }

  /**
   * Mapa de ação → campo no Apps Script
   */
  function actionToType(action) {
    const map = {
      ENTRADA:    'entrada',
      SAIDA_CAFE: 'saidaCafe',
      VOLTA_CAFE: 'voltaCafe',
      SAIDA:      'saida',
    };
    return map[action] || null;
  }

  /**
   * Formata dateKey "YYYY-MM-DD" para exibição "DD/MM/YYYY"
   */
  function formatDateKey(dateKey) {
    const [y, m, d] = String(dateKey).split('-');
    return `${d}/${m}/${y}`;
  }

  /**
   * Formata dateKey para exibição por extenso: "Sábado, 12 de setembro de 2026"
   */
  function formatDateFull(dateKey, weekday) {
    const [y, m, d] = String(dateKey).split('-').map(Number);
    const months = [
      'janeiro','fevereiro','março','abril','maio','junho',
      'julho','agosto','setembro','outubro','novembro','dezembro'
    ];
    const day = weekday || '';
    return `${day ? day + ', ' : ''}${d} de ${months[m-1]} de ${y}`;
  }

  /**
   * Retorna o mês atual como { year, month } (monthIndex 0-based)
   */
  function getCurrentMonth() {
    const parts = getSaoPauloDateParts();
    return { year: parts.year, month: parts.month - 1 };
  }

  /**
   * Retorna a dateKey de hoje em formato "YYYY-MM-DD" (baseado em horário local)
   */
  function getTodayKey() {
    const parts = getSaoPauloDateParts();
    return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  }

  /** Relógio do produto: sempre America/Sao_Paulo, independentemente do dispositivo. */
  function getSaoPauloDateParts(date = new Date()) {
    const pieces = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date).reduce((result, piece) => {
      if (piece.type !== 'literal') result[piece.type] = Number(piece.value);
      return result;
    }, {});
    return { year: pieces.year, month: pieces.month, day: pieces.day, hour: pieces.hour, minute: pieces.minute };
  }

  function getSaoPauloTime(date = new Date()) {
    const parts = getSaoPauloDateParts(date);
    return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
  }

  /**
   * Gera a grade do calendário para um mês
   * Retorna array de dateKey strings (ou null para células vazias)
   * Semana começa na Segunda (offset europeu)
   */
  function buildMonthGrid(year, monthIndex) {
    const firstDay = new Date(year, monthIndex, 1);
    const lastDay  = new Date(year, monthIndex + 1, 0).getDate();
    const grid     = [];
    const offset   = (firstDay.getDay() + 6) % 7; // Seg=0 ... Dom=6

    for (let i = 0; i < offset; i++) grid.push(null);

    for (let d = 1; d <= lastDay; d++) {
      const m  = String(monthIndex + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      grid.push(`${year}-${m}-${dd}`);
    }

    while (grid.length % 7 !== 0) grid.push(null);

    return grid;
  }

  /**
   * Nomes dos meses em português
   */
  const MONTH_NAMES = [
    'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
  ];

  const WEEKDAY_NAMES_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  return {
    toMinutes,
    minutesToText,
    minutesToDisplay,
    minutesToBalanceDisplay,
    calculateWorkedMinutes,
    getExpectedSchedule,
    getPredictedMinutes,
    getNextAction,
    getActionLabel,
    getActionClass,
    actionToType,
    formatDateKey,
    formatDateFull,
    getCurrentMonth,
    getTodayKey,
    getSaoPauloDateParts,
    getSaoPauloTime,
    buildMonthGrid,
    MONTH_NAMES,
    WEEKDAY_NAMES_SHORT,
  };
})();

window.Calc = Calc;
