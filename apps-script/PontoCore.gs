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
    cargo:           '',
    jornada:         '08:00',
    horarioPadrao:   '08:00',
    intervaloPadrao: 15,
    timezone:        TZ,
    trabalhaFeriado: false
  };
}

// ─── Jornada ─────────────────────────────────────────────────────────────────

function getScheduleForDate(date) {
  var weekday  = getWeekdayName(date);
  var schedule = readSchedule();
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

function getHolidayConfig(dateKey) {
  var holidays = readHolidays();
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

// ─── Estado diário ───────────────────────────────────────────────────────────

function buildDailyState(date) {
  var dateKey  = toDateKey(date);
  var config   = readConfig();
  var schedule = getScheduleForDate(date);
  var holiday  = getHolidayConfig(dateKey);
  var row      = getDailyPointRow(dateKey) || {
    0: '', 1: dateKey, 2: '', 3: '', 4: '', 5: '', 6: 'Pendente', 7: '0:00', 8: '', 9: ''
  };

  var isWorkDay = !!(schedule.trabalha || (holiday && holiday.trabalha));

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

  daily.predictedMinutes   = getPredictedMinutes(schedule);
  daily.totalWorkedMinutes = calculateWorkedMinutes(daily.entradas);
  daily.hoursWorked        = minutesToText(daily.totalWorkedMinutes);
  daily.saldo              = daily.totalWorkedMinutes - daily.predictedMinutes;
  daily.saldoText          = minutesToText(daily.saldo);

  // Próxima ação
  if (!daily.available) {
    daily.nextAction = 'FOLGA';
  } else if (holiday && !holiday.trabalha) {
    daily.nextAction = 'FERIADO';
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
  var row = [
    Utilities.formatDate(new Date(), TZ, 'yyyyMMddHHmmss'),
    dateKey,
    type,
    oldValue  || '',
    newValue  || '',
    reason    || 'Correção manual',
    Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss')
  ];
  sheet.appendRow(row);
}

// ─── Registro de ponto ────────────────────────────────────────────────────────

function registerPunch(type) {
  var date    = new Date();
  var dateKey = toDateKey(date);
  var time    = Utilities.formatDate(date, TZ, 'HH:mm');

  var validation = validatePunch(dateKey, type, time);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  var existingRow = ensureDailyRow(dateKey);

  var values = {
    ID:       existingRow[0] || Utilities.formatDate(date, TZ, 'yyyyMMddHHmmss'),
    Data:     dateKey,
    Entrada:  type === 'entrada'   ? time : String(existingRow[2] || ''),
    SaidaCafe: type === 'saidaCafe' ? time : String(existingRow[3] || ''),
    VoltaCafe: type === 'voltaCafe' ? time : String(existingRow[4] || ''),
    Saida:    type === 'saida'     ? time : String(existingRow[5] || ''),
    Status:   'Pendente',
    TotalTrabalhado: '0:00',
    Observacao: String(existingRow[8] || '')
  };

  // Calcular status e total trabalhado com os valores atualizados
  var worked = calculateWorkedMinutes({
    Entrada:   values.Entrada,
    Saida:     values.Saida,
    SaidaCafe: values.SaidaCafe,
    VoltaCafe: values.VoltaCafe
  });

  var hasAllPunches = !!(values.Entrada && values.SaidaCafe && values.VoltaCafe && values.Saida);
  values.Status          = hasAllPunches ? 'Completo' : 'Pendente';
  values.TotalTrabalhado = minutesToText(worked);

  updateDailyRow(dateKey, values);

  // Retorna o estado atualizado
  return buildDailyState(date);
}

// ─── Edição de registro ──────────────────────────────────────────────────────

function editRecord(dateKey, field, newValue, motivo) {
  var row = getDailyPointRow(dateKey);
  if (!row) {
    throw new Error('Não existe registro para a data: ' + dateKey);
  }

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
  var worked = calculateWorkedMinutes(updatedRow);
  var hasAll = !!(updatedRow.Entrada && updatedRow.SaidaCafe && updatedRow.VoltaCafe && updatedRow.Saida);

  values.TotalTrabalhado = minutesToText(worked);
  values.Status          = hasAll ? 'Completo' : 'Pendente';

  updateDailyRow(dateKey, values);
  createAuditLog(dateKey, field, oldValue, newValue, motivo || 'Correção manual');

  return buildDailyState(parseDateKey(dateKey));
}

// ─── Resumo mensal ────────────────────────────────────────────────────────────

function getMonthlySummary(year, monthIndex) {
  var totalWorked   = 0;
  var totalPlanned  = 0;
  var daysWorked    = 0;
  var daysIncomplete = 0;
  var daysFolga     = 0;
  var daysFeriado   = 0;
  var daysInMonth   = getLastDayOfMonth(year, monthIndex);

  for (var day = 1; day <= daysInMonth; day += 1) {
    var date      = new Date(year, monthIndex, day);
    var dateKey   = toDateKey(date);
    var holiday   = getHolidayConfig(dateKey);
    var schedule  = getScheduleForDate(date);
    var isWorkDay = !!(schedule.trabalha || (holiday && holiday.trabalha));
    var row       = getDailyPointRow(dateKey) || [];

    if (holiday && !holiday.trabalha) {
      daysFeriado += 1;
    } else if (!isWorkDay) {
      daysFolga += 1;
    }

    if (isWorkDay) {
      daysWorked  += 1;
      totalPlanned += getPredictedMinutes(schedule);

      if (row.length && row[2] && row[5]) {
        var worked = calculateWorkedMinutes({
          Entrada:   String(row[2] || ''),
          Saida:     String(row[5] || ''),
          SaidaCafe: String(row[3] || ''),
          VoltaCafe: String(row[4] || '')
        });
        totalWorked += worked;
      }

      // Dia incompleto: deveria trabalhar mas não tem todos os pontos
      var status = String(row[6] || '');
      if (status === 'Pendente' || (!row.length && new Date(year, monthIndex, day) < new Date())) {
        var hasEntry = row.length && row[2];
        if (!hasEntry && new Date(year, monthIndex, day) < new Date()) {
          daysIncomplete += 1;
        } else if (hasEntry && !(row[2] && row[3] && row[4] && row[5])) {
          daysIncomplete += 1;
        }
      }
    }
  }

  return {
    year:              year,
    monthIndex:        monthIndex,
    monthName:         getMonthName(monthIndex),
    daysInMonth:       daysInMonth,
    daysWorked:        daysWorked,
    daysFolga:         daysFolga,
    daysFeriado:       daysFeriado,
    daysIncomplete:    daysIncomplete,
    horasPrevistas:    minutesToText(totalPlanned),
    horasTrabalhadas:  minutesToText(totalWorked),
    saldo:             minutesToText(totalWorked - totalPlanned),
    saldoMinutes:      totalWorked - totalPlanned
  };
}

// ─── Dados do mês (calendário completo) ──────────────────────────────────────

function getAppDataForMonth(baseDate) {
  var year        = baseDate.getFullYear();
  var monthIndex  = baseDate.getMonth();
  var monthCal    = getMonthCalendar(year, monthIndex);
  var summary     = getMonthlySummary(year, monthIndex);
  var data        = [];

  monthCal.forEach(function (day) {
    if (!day) {
      data.push(null);
      return;
    }
    data.push(buildDailyState(day));
  });

  return {
    monthName:  getMonthName(monthIndex),
    year:       year,
    monthIndex: monthIndex,
    today:      buildDailyState(new Date()),
    calendar:   data,
    summary:    summary,
    config:     readConfig(),
    schedule:   readSchedule(),
    holidays:   readHolidays()
  };
}
