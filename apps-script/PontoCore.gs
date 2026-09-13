// ─── Meu Ponto — PontoCore.gs ────────────────────────────────────────────────
// Versão: 2.0 — Lógica de negócio central
// ─────────────────────────────────────────────────────────────────────────────

function normalizeBoolean(value) {
  return value === true || String(value).toLowerCase() === 'sim' || String(value).toLowerCase() === 'true';
}

function getDefaultConfig() {
  return {
    nome:            '',
    empresa:         '',
    cnpj:            '',
    endereco:        '',
    atividade:       '',
    cargo:           '',
    jornada:         '08:00',
    horarioPadrao:   '08:00',
    intervaloPadrao: 15,
    timezone:        TZ,
    trabalhaFeriado: false
  };
}

// ─── Jornada ─────────────────────────────────────────────────────────────────

function createDataContext() {
  var points = getSheet('PONTOS').getDataRange().getValues();
  var pointsByDate = {};
  for (var i = 1; i < points.length; i += 1) {
    var row = points[i];
    if (row[1]) pointsByDate[String(row[1]).trim()] = row;
  }
  return {
    config: readConfig(),
    schedule: readSchedule(),
    holidays: readHolidays(),
    pointsByDate: pointsByDate
  };
}

function getScheduleForDate(date, context) {
  var weekday  = getWeekdayName(date);
  var schedule = context && context.schedule ? context.schedule : readSchedule();
  var defaultSchedule = {
    dia:        weekday,
    trabalha:   false,
    entrada:    '',
    saidaCafe:  '',
    voltaCafe:  '',
    saida:      '',
    observacao: ''
  };

  return schedule[weekday] || defaultSchedule;
}

// ─── Feriados ────────────────────────────────────────────────────────────────

function isHoliday(dateKey) {
  var holidays = readHolidays();
  return !!holidays[dateKey];
}

function getHolidayConfig(dateKey, context) {
  var holidays = context && context.holidays ? context.holidays : readHolidays();
  return holidays[dateKey] || null;
}

// ─── Cálculos ────────────────────────────────────────────────────────────────

function calculateWorkedMinutes(row) {
  var entry        = row.Entrada   || '';
  var exit         = row.Saida     || '';
  var coffeeExit   = row.SaidaCafe || '';
  var coffeeReturn = row.VoltaCafe || '';

  if (!entry || !exit) {
    return 0;
  }

  var entryMinutes = toMinutes(entry);
  var exitMinutes  = toMinutes(exit);
  var total        = exitMinutes - entryMinutes;

  if (coffeeExit && coffeeReturn) {
    total -= (toMinutes(coffeeReturn) - toMinutes(coffeeExit));
  }

  return Math.max(total, 0);
}

function getPredictedMinutes(schedule) {
  if (!schedule || !schedule.trabalha) return 0;
  var entrada  = toMinutes(schedule.entrada  || '00:00');
  var saida    = toMinutes(schedule.saida    || '00:00');
  var intervalo = (schedule.saidaCafe && schedule.voltaCafe)
    ? (toMinutes(schedule.voltaCafe) - toMinutes(schedule.saidaCafe))
    : 0;
  return Math.max(saida - entrada - intervalo, 0);
}

function isValidDateKey(value) {
  var text = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  var parts = text.split('-');
  var year = Number(parts[0]);
  var month = Number(parts[1]);
  var day = Number(parts[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1) return false;
  return day <= getLastDayOfMonth(year, month - 1);
}

function isValidTime(value) {
  if (!/^\d{2}:\d{2}$/.test(String(value || ''))) return false;
  var parts = String(value).split(':');
  return Number(parts[0]) >= 0 && Number(parts[0]) <= 23 && Number(parts[1]) >= 0 && Number(parts[1]) <= 59;
}

function validateTimeline(row) {
  var entry = row.Entrada || '';
  var coffeeExit = row.SaidaCafe || '';
  var coffeeReturn = row.VoltaCafe || '';
  var exit = row.Saida || '';
  var times = [entry, coffeeExit, coffeeReturn, exit];
  for (var i = 0; i < times.length; i += 1) {
    if (times[i] && !isValidTime(times[i])) return { valid: false, message: 'Horário inválido. Use HH:MM.' };
  }
  if (coffeeExit && !entry) return { valid: false, message: 'Saída para café exige uma entrada.' };
  if (coffeeReturn && !coffeeExit) return { valid: false, message: 'Volta do café exige saída para café.' };
  if (exit && !entry) return { valid: false, message: 'Saída exige uma entrada.' };
  if (entry && coffeeExit && toMinutes(coffeeExit) <= toMinutes(entry)) return { valid: false, message: 'Saída para café deve ser posterior à entrada.' };
  if (coffeeExit && coffeeReturn && toMinutes(coffeeReturn) <= toMinutes(coffeeExit)) return { valid: false, message: 'Volta do café deve ser posterior à saída para café.' };
  if (coffeeReturn && exit && toMinutes(exit) <= toMinutes(coffeeReturn)) return { valid: false, message: 'Saída deve ser posterior à volta do café.' };
  if (!coffeeReturn && entry && exit && toMinutes(exit) <= toMinutes(entry)) return { valid: false, message: 'Saída deve ser posterior à entrada.' };
  return { valid: true };
}

function validateSchedule(schedule) {
  var names = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  names.forEach(function (name) {
    var item = schedule[name] || {};
    if (!item.trabalha) return;
    if (!isValidTime(item.entrada) || !isValidTime(item.saida)) {
      throw new Error('Informe entrada e saída válidas para ' + name + '.');
    }
    if (toMinutes(item.saida) <= toMinutes(item.entrada)) {
      throw new Error('A saída deve ser posterior à entrada em ' + name + '.');
    }
    if ((item.saidaCafe && !item.voltaCafe) || (!item.saidaCafe && item.voltaCafe)) {
      throw new Error('Informe os dois horários de café em ' + name + ' ou deixe ambos vazios.');
    }
    if (item.saidaCafe && (toMinutes(item.saidaCafe) <= toMinutes(item.entrada) || toMinutes(item.voltaCafe) <= toMinutes(item.saidaCafe) || toMinutes(item.saida) <= toMinutes(item.voltaCafe))) {
      throw new Error('Os horários de café em ' + name + ' não estão em ordem.');
    }
  });
}

// ─── Estado diário ───────────────────────────────────────────────────────────

function parseScheduleSnapshot(value) {
  if (!value) return null;
  try {
    var parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

function buildDailyState(date, context) {
  var dateKey  = toDateKey(date);
  var config   = context && context.config ? context.config : readConfig();
  var row      = context && context.pointsByDate ? context.pointsByDate[dateKey] : getDailyPointRow(dateKey);
  row = row || {
    0: '', 1: dateKey, 2: '', 3: '', 4: '', 5: '', 6: 'Pendente', 7: '0:00', 8: '', 9: '', 10: '', 11: ''
  };
  var schedule = parseScheduleSnapshot(row[11]) || getScheduleForDate(date, context);
  var holiday  = getHolidayConfig(dateKey, context);

  var isWorkDay = holiday ? !!holiday.trabalha : !!schedule.trabalha;

  var daily = {
    id:          row[0] || '',
    dateKey:     dateKey,
    data:        dateKey,
    dataDisplay: getDisplayDate(date),
    weekday:     getWeekdayName(date),
    schedule:    schedule,
    holiday:     holiday,
    trabalhaNoFeriado: holiday ? holiday.trabalha : false,
    entradas: {
      entrada:    String(row[2] || ''),
      saidaCafe:  String(row[3] || ''),
      voltaCafe:  String(row[4] || ''),
      saida:      String(row[5] || ''),
      observacao: String(row[8] || '')
    },
    status:         String(row[6] || 'Pendente'),
    totalTrabalhado: String(row[7] || '0:00'),
    config:         config,
    available:      isWorkDay
  };

  if (holiday && !holiday.trabalha) {
    daily.status = 'Feriado';
  }

  daily.predictedMinutes   = holiday && !holiday.trabalha ? 0 : (Number(row[10]) || getPredictedMinutes(schedule));
  daily.totalWorkedMinutes = calculateWorkedMinutes(daily.entradas);
  daily.hoursWorked        = minutesToText(daily.totalWorkedMinutes);
  daily.saldo              = daily.totalWorkedMinutes - daily.predictedMinutes;
  daily.saldoText          = minutesToText(daily.saldo);

  // Próxima ação
  if (holiday && !holiday.trabalha) {
    daily.nextAction = 'FERIADO';
  } else if (!daily.available) {
    daily.nextAction = 'FOLGA';
  } else if (!daily.entradas.entrada) {
    daily.nextAction = 'ENTRADA';
  } else if (!daily.entradas.saidaCafe) {
    daily.nextAction = 'SAIDA_CAFE';
  } else if (!daily.entradas.voltaCafe) {
    daily.nextAction = 'VOLTA_CAFE';
  } else if (!daily.entradas.saida) {
    daily.nextAction = 'SAIDA';
  } else {
    daily.nextAction = 'FINALIZADO';
  }

  return daily;
}

// ─── Validação ───────────────────────────────────────────────────────────────

function validatePunch(dateKey, type, value) {
  if (!isValidDateKey(dateKey) || !isValidTime(value)) {
    return { valid: false, message: 'Data ou horário inválido.' };
  }
  var day          = buildDailyState(parseDateKey(dateKey));
  var entry        = day.entradas.entrada;
  var coffeeExit   = day.entradas.saidaCafe;
  var coffeeReturn = day.entradas.voltaCafe;
  var exit         = day.entradas.saida;

  if (!day.available && !day.trabalhaNoFeriado) {
    return { valid: false, message: 'Dia sem jornada definida ou em folga.' };
  }

  switch (type) {
    case 'entrada':
      if (entry) return { valid: false, message: 'Já existe uma entrada registrada para este dia.' };
      return { valid: true };

    case 'saidaCafe':
      if (!entry)     return { valid: false, message: 'Registre a entrada antes de sair para o café.' };
      if (coffeeExit) return { valid: false, message: 'Saída para café já registrada.' };
      if (value && toMinutes(value) <= toMinutes(entry))
        return { valid: false, message: 'Saída para café não pode ser antes ou igual à entrada.' };
      return { valid: true };

    case 'voltaCafe':
      if (!coffeeExit)   return { valid: false, message: 'Registre a saída para café antes de voltar.' };
      if (coffeeReturn)  return { valid: false, message: 'Volta do café já registrada.' };
      if (value && toMinutes(value) <= toMinutes(coffeeExit))
        return { valid: false, message: 'Volta do café não pode ser antes ou igual à saída do café.' };
      return { valid: true };

    case 'saida':
      if (!entry)                     return { valid: false, message: 'Registre a entrada antes da saída.' };
      if (coffeeExit && !coffeeReturn) return { valid: false, message: 'Registre a volta do café antes de encerrar o dia.' };
      if (exit)                        return { valid: false, message: 'Saída já registrada.' };
      if (coffeeReturn && value && toMinutes(value) <= toMinutes(coffeeReturn))
        return { valid: false, message: 'Saída não pode ser antes ou igual ao retorno do café.' };
      if (!coffeeReturn && value && toMinutes(value) <= toMinutes(entry))
        return { valid: false, message: 'Saída não pode ser antes ou igual à entrada.' };
      return { valid: true };

    default:
      return { valid: false, message: 'Tipo de registro inválido: ' + type };
  }
}

// ─── Auditoria ───────────────────────────────────────────────────────────────

function createAuditLog(dateKey, type, oldValue, newValue, reason) {
  var sheet = getSheet('AJUSTES');
  var config = readConfig();
  var row = [
    Utilities.formatDate(new Date(), TZ, 'yyyyMMddHHmmss'),
    dateKey,
    type,
    oldValue  || '',
    newValue  || '',
    reason    || 'Correção manual',
    config.nome || 'Usuário',
    Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss')
  ];
  sheet.appendRow(row);
}

// ─── Registro de ponto ────────────────────────────────────────────────────────

function registerPunch(type) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Outro registro está sendo processado. Tente novamente em alguns segundos.');
  try {
    var date    = new Date();
    var dateKey = toDateKey(date);
    var time    = Utilities.formatDate(date, TZ, 'HH:mm');
    var validation = validatePunch(dateKey, type, time);
    if (!validation.valid) throw new Error(validation.message);

    var existingRow = ensureDailyRow(dateKey);
    var values = {
      ID:       existingRow[0] || Utilities.formatDate(date, TZ, 'yyyyMMddHHmmss'),
      Data:     dateKey,
      Entrada:  type === 'entrada' ? time : String(existingRow[2] || ''),
      SaidaCafe: type === 'saidaCafe' ? time : String(existingRow[3] || ''),
      VoltaCafe: type === 'voltaCafe' ? time : String(existingRow[4] || ''),
      Saida:    type === 'saida' ? time : String(existingRow[5] || ''),
      Status:   'Pendente',
      TotalTrabalhado: '0:00',
      Observacao: String(existingRow[8] || '')
    };
    var timeline = validateTimeline(values);
    if (!timeline.valid) throw new Error(timeline.message);
    var worked = calculateWorkedMinutes(values);
    var hasAllPunches = !!(values.Entrada && values.SaidaCafe && values.VoltaCafe && values.Saida);
    values.Status = hasAllPunches ? 'Completo' : 'Pendente';
    values.TotalTrabalhado = minutesToText(worked);
    updateDailyRow(dateKey, values);
    return buildDailyState(date);
  } finally {
    lock.releaseLock();
  }
}

// ─── Edição de registro ──────────────────────────────────────────────────────

function editRecord(dateKey, field, newValue, motivo) {
  if (!isValidDateKey(dateKey)) throw new Error('Data inválida.');
  if (field !== 'Observacao' && !isValidTime(newValue)) throw new Error('Horário inválido. Use HH:MM.');

  var fieldIndexMap = {
    Entrada:    2,
    SaidaCafe:  3,
    VoltaCafe:  4,
    Saida:      5,
    Observacao: 8
  };

  var fieldIndex = fieldIndexMap[field];
  if (fieldIndex === undefined) {
    throw new Error('Campo inválido: ' + field + '. Use Entrada, SaidaCafe, VoltaCafe, Saida ou Observacao.');
  }

  var row = getDailyPointRow(dateKey);
  if (!row) {
    var day = buildDailyState(parseDateKey(dateKey));
    if (!day.available) {
      throw new Error('Não há jornada prevista para esta data. Cadastre trabalho no feriado ou ajuste a jornada antes de inserir marcações.');
    }
    row = ensureDailyRow(dateKey);
  }
  var oldValue = row[fieldIndex];
  var values   = {};
  values[field] = newValue;

  // Recalcular total trabalhado
  var updatedRow = {
    Entrada:   field === 'Entrada'   ? newValue : String(row[2] || ''),
    Saida:     field === 'Saida'     ? newValue : String(row[5] || ''),
    SaidaCafe: field === 'SaidaCafe' ? newValue : String(row[3] || ''),
    VoltaCafe: field === 'VoltaCafe' ? newValue : String(row[4] || '')
  };
  var timeline = validateTimeline(updatedRow);
  if (!timeline.valid) throw new Error(timeline.message);
  var worked = calculateWorkedMinutes(updatedRow);
  var hasAll = !!(updatedRow.Entrada && updatedRow.SaidaCafe && updatedRow.VoltaCafe && updatedRow.Saida);

  values.TotalTrabalhado = minutesToText(worked);
  values.Status          = hasAll ? 'Completo' : 'Pendente';

  updateDailyRow(dateKey, values);
  createAuditLog(dateKey, field, oldValue, newValue, motivo || 'Correção manual');

  return buildDailyState(parseDateKey(dateKey));
}

// ─── Resumo mensal ────────────────────────────────────────────────────────────

function getMonthlySummary(year, monthIndex, context) {
  var runtime = context || createDataContext();
  var totalWorked = 0;
  var totalPlanned = 0;
  var totalExtra = 0;
  var totalMissing = 0;
  var daysWorked = 0;
  var daysIncomplete = 0;
  var daysFolga = 0;
  var daysFeriado = 0;
  var daysRemaining = 0;
  var daysInMonth = getLastDayOfMonth(year, monthIndex);
  var todayKey = toDateKey(new Date());

  for (var day = 1; day <= daysInMonth; day += 1) {
    var date = parseDateKey(year + '-' + pad2(monthIndex + 1) + '-' + pad2(day));
    var daily = buildDailyState(date, runtime);
    var isFuture = daily.dateKey > todayKey;
    if (daily.nextAction === 'FERIADO') { daysFeriado += 1; continue; }
    if (daily.nextAction === 'FOLGA') { daysFolga += 1; continue; }
    if (!daily.available) continue;

    totalPlanned += daily.predictedMinutes;
    totalWorked += daily.totalWorkedMinutes;
    totalExtra += Math.max(daily.totalWorkedMinutes - daily.predictedMinutes, 0);
    if (isFuture) {
      daysRemaining += 1;
    } else {
      totalMissing += Math.max(daily.predictedMinutes - daily.totalWorkedMinutes, 0);
      if (daily.nextAction === 'FINALIZADO') daysWorked += 1;
      else daysIncomplete += 1;
    }
  }

  return {
    year: year,
    monthIndex: monthIndex,
    monthName: getMonthName(monthIndex),
    daysInMonth: daysInMonth,
    daysWorked: daysWorked,
    daysRemaining: daysRemaining,
    daysFolga: daysFolga,
    daysFeriado: daysFeriado,
    daysIncomplete: daysIncomplete,
    horasPrevistas: minutesToText(totalPlanned),
    horasTrabalhadas: minutesToText(totalWorked),
    horasFaltantes: minutesToText(totalMissing),
    horasExtras: minutesToText(totalExtra),
    saldo: minutesToText(totalWorked - totalPlanned),
    saldoMinutes: totalWorked - totalPlanned
  };
}

// ─── Dados do mês (calendário completo) ──────────────────────────────────────

function getAppDataForMonth(baseDate) {
  var year        = Number(Utilities.formatDate(baseDate, TZ, 'yyyy'));
  var monthIndex  = Number(Utilities.formatDate(baseDate, TZ, 'M')) - 1;
  var monthCal    = getMonthCalendar(year, monthIndex);
  var context     = createDataContext();
  var summary     = getMonthlySummary(year, monthIndex, context);
  var data        = [];

  monthCal.forEach(function (day) {
    if (!day) {
      data.push(null);
      return;
    }
    data.push(buildDailyState(day, context));
  });

  return {
    monthName:  getMonthName(monthIndex),
    year:       year,
    monthIndex: monthIndex,
    today:      buildDailyState(new Date(), context),
    calendar:   data,
    summary:    summary,
    config:     context.config,
    schedule:   context.schedule,
    holidays:   context.holidays
  };
}
