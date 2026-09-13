var SHEET_ID = '1Q0-QD1lk7xn76Z5QMSvqvfDYQOKZKVj1pKBFDh61wAs';
var TZ = 'America/Sao_Paulo';
var VALID_POINT_TYPES = ['entrada', 'saidaCafe', 'voltaCafe', 'saida'];

function normalizeSheetName(name) {
  return String(name || '').trim().toUpperCase();
}

function getSpreadsheet() {
  if (!SHEET_ID) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
  return SpreadsheetApp.openById(SHEET_ID);
}

function findSheetByName(spreadsheet, name) {
  var targetName = normalizeSheetName(name);
  var sheets = spreadsheet.getSheets();
  for (var i = 0; i < sheets.length; i += 1) {
    if (normalizeSheetName(sheets[i].getName()) === targetName) {
      return sheets[i];
    }
  }
  return null;
}

function getSheet(name) {
  var spreadsheet = getSpreadsheet();
  ensureCoreSheets();
  return findSheetByName(spreadsheet, name);
}

function ensureCoreSheets() {
  var spreadsheet = getSpreadsheet();

  var requiredSheets = [
    { name: 'CONFIG', headers: ['Campo', 'Valor'] },
    { name: 'JORNADA', headers: ['Dia', 'Trabalha', 'Entrada', 'SaidaCafe', 'VoltaCafe', 'Saida', 'Observacao'] },
    { name: 'PONTOS', headers: ['ID', 'Data', 'Tipo', 'Hora', 'Observacao', 'Origem', 'CriadoEm', 'AtualizadoEm'] },
    { name: 'FERIADOS', headers: ['Data', 'Nome', 'Trabalha'] },
    { name: 'AJUSTES', headers: ['ID', 'Data', 'Tipo', 'ValorAntigo', 'ValorNovo', 'Motivo', 'Responsavel', 'CriadoEm'] }
  ];

  requiredSheets.forEach(function (sheetConfig) {
    var sheet = findSheetByName(spreadsheet, sheetConfig.name);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetConfig.name);
    }

    var existing = sheet.getDataRange().getValues();
    if (!existing.length) {
      sheet.appendRow(sheetConfig.headers);
      return;
    }

    var headerRow = existing[0] || [];
    if (headerRow.length < sheetConfig.headers.length) {
      sheet.getRange(1, 1, 1, sheetConfig.headers.length).setValues([sheetConfig.headers]);
      return;
    }

    for (var i = 0; i < sheetConfig.headers.length; i += 1) {
      if (String(headerRow[i] || '').trim() !== String(sheetConfig.headers[i])) {
        sheet.getRange(1, 1, 1, sheetConfig.headers.length).setValues([sheetConfig.headers]);
        break;
      }
    }
  });

  var jornadaSheet = getSheet('JORNADA');
  var jornadaRows = jornadaSheet.getDataRange().getValues();
  if (jornadaRows.length <= 1) {
    var defaultSchedule = getDefaultSchedule();
    var orderedDays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    var rows = orderedDays.map(function (dayName) {
      var item = defaultSchedule[dayName];
      return [
        item.dia,
        item.trabalha ? 'Sim' : 'Não',
        item.entrada || '',
        item.saidaCafe || '',
        item.voltaCafe || '',
        item.saida || '',
        item.observacao || ''
      ];
    });
    jornadaSheet.clear();
    jornadaSheet.getRange(1, 1, rows.length + 1, 7).setValues([
      ['Dia', 'Trabalha', 'Entrada', 'SaidaCafe', 'VoltaCafe', 'Saida', 'Observacao']
    ].concat(rows));
  }

  return spreadsheet;
}

function pad2(value) {
  return String(Number(value)).padStart(2, '0');
}

function normalizeTimeCell(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (value instanceof Date) {
    return pad2(value.getHours()) + ':' + pad2(value.getMinutes());
  }

  if (typeof value === 'string') {
    var text = value.trim();
    if (!text) return '';
    if (/^\d{1,2}:\d{2}$/.test(text)) {
      return pad2(Number(text.split(':')[0])) + ':' + pad2(Number(text.split(':')[1]));
    }
    var match = text.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      return pad2(Number(match[1])) + ':' + pad2(Number(match[2]));
    }
    try {
      var date = new Date(text);
      if (!isNaN(date.getTime())) {
        return pad2(date.getHours()) + ':' + pad2(date.getMinutes());
      }
    } catch (error) {
      return text;
    }
    return text;
  }

  return String(value);
}

function toDateKey(date) {
  var value = date instanceof Date ? date : new Date(date);
  return Utilities.formatDate(value, TZ, 'yyyy-MM-dd');
}

function parseDateKey(dateKey) {
  var text = String(dateKey || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error('Data inválida: ' + dateKey);
  }
  var parts = text.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
}

function getWeekdayName(dateKeyOrDate) {
  var value = dateKeyOrDate instanceof Date ? dateKeyOrDate : parseDateKey(String(dateKeyOrDate));
  var weekday = Utilities.formatDate(value, TZ, 'EEEE');
  var map = {
    Monday: 'Segunda',
    Tuesday: 'Terça',
    Wednesday: 'Quarta',
    Thursday: 'Quinta',
    Friday: 'Sexta',
    Saturday: 'Sábado',
    Sunday: 'Domingo'
  };
  return map[weekday] || weekday;
}

function isValidTime(value) {
  if (!value) return false;
  var match = String(value).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return false;
  var hours = Number(match[1]);
  var minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function toMinutes(timeText) {
  if (!timeText) return 0;
  if (!isValidTime(timeText)) return 0;
  var parts = String(timeText).split(':');
  return Number(parts[0]) * 60 + Number(parts[1]);
}

function minutesToText(minutes) {
  var total = Number(minutes) || 0;
  var sign = total < 0 ? '-' : '';
  total = Math.abs(total);
  var hours = Math.floor(total / 60);
  var mins = total % 60;
  return sign + pad2(hours) + ':' + pad2(mins);
}

function calculateWorkedMinutes(entry, coffeeExit, coffeeReturn, exit) {
  if (!entry || !exit) {
    return 0;
  }

  var total = toMinutes(exit) - toMinutes(entry);
  if (coffeeExit && coffeeReturn) {
    total -= (toMinutes(coffeeReturn) - toMinutes(coffeeExit));
  }
  return Math.max(total, 0);
}

function normalizeType(type) {
  var normalized = String(type || '').trim().toLowerCase();
  if (VALID_POINT_TYPES.indexOf(normalized) === -1) {
    throw new Error('Tipo de ponto inválido: ' + type);
  }
  return normalized;
}

function readConfig() {
  var sheet = getSheet('CONFIG');
  var values = sheet.getDataRange().getValues();
  var config = {
    nome: '',
    empresa: '',
    cnpj: '',
    endereco: '',
    atividade: '',
    cargo: '',
    jornada: '08:00',
    horarioPadrao: '08:00',
    intervaloPadrao: 15,
    timezone: TZ,
    trabalhaFeriado: false
  };

  for (var i = 1; i < values.length; i += 1) {
    var row = values[i];
    if (!row || !row[0]) continue;
    var key = String(row[0]).trim();
    var value = row[1];
    if (!key) continue;
    if (key === 'trabalhaFeriado') {
      config[key] = value === true || String(value).toLowerCase() === 'true' || String(value).toLowerCase() === 'sim';
    } else if (key === 'intervaloPadrao') {
      config[key] = Number(value) || 15;
    } else if (key === 'jornada' || key === 'horarioPadrao') {
      config[key] = normalizeTimeCell(value);
    } else {
      config[key] = value;
    }
  }

  return config;
}

function writeConfig(config) {
  var sheet = getSheet('CONFIG');
  var keys = ['nome', 'empresa', 'cnpj', 'endereco', 'atividade', 'cargo', 'jornada', 'horarioPadrao', 'intervaloPadrao', 'timezone', 'trabalhaFeriado'];
  var rows = [['Campo', 'Valor']];

  keys.forEach(function (key) {
    rows.push([key, config && config[key] !== undefined ? config[key] : '']);
  });

  sheet.clear();
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  return readConfig();
}

function getDefaultSchedule() {
  return {
    'Segunda': { dia: 'Segunda', trabalha: true, entrada: '15:00', saidaCafe: '', voltaCafe: '', saida: '21:00', observacao: '' },
    'Terça': { dia: 'Terça', trabalha: true, entrada: '15:00', saidaCafe: '', voltaCafe: '', saida: '21:00', observacao: '' },
    'Quarta': { dia: 'Quarta', trabalha: true, entrada: '15:00', saidaCafe: '', voltaCafe: '', saida: '21:00', observacao: '' },
    'Quinta': { dia: 'Quinta', trabalha: true, entrada: '15:00', saidaCafe: '', voltaCafe: '', saida: '21:00', observacao: '' },
    'Sexta': { dia: 'Sexta', trabalha: true, entrada: '14:00', saidaCafe: '', voltaCafe: '', saida: '20:00', observacao: '' },
    'Sábado': { dia: 'Sábado', trabalha: true, entrada: '08:00', saidaCafe: '', voltaCafe: '', saida: '15:00', observacao: '' },
    'Domingo': { dia: 'Domingo', trabalha: false, entrada: '', saidaCafe: '', voltaCafe: '', saida: '', observacao: 'Folga' }
  };
}

function sanitizeScheduleItem(dayName, item) {
  var finalItem = {
    dia: String(dayName || item && item.dia || '').trim(),
    trabalha: !!(item && (item.trabalha === true || String(item.trabalha).toLowerCase() === 'sim' || String(item.trabalha).toLowerCase() === 'true')),
    entrada: normalizeTimeCell(item && item.entrada),
    saidaCafe: normalizeTimeCell(item && item.saidaCafe),
    voltaCafe: normalizeTimeCell(item && item.voltaCafe),
    saida: normalizeTimeCell(item && item.saida),
    observacao: String((item && item.observacao) || '')
  };

  if (dayName === 'Domingo') {
    finalItem.trabalha = false;
    finalItem.entrada = '';
    finalItem.saidaCafe = '';
    finalItem.voltaCafe = '';
    finalItem.saida = '';
    finalItem.observacao = 'Folga';
    return finalItem;
  }

  if (dayName === 'Sábado') {
    finalItem.saidaCafe = '';
    finalItem.voltaCafe = '';
  }

  return finalItem;
}

function readSchedule() {
  var sheet = getSheet('JORNADA');
  var values = sheet.getDataRange().getValues();
  if (!values.length) {
    return getDefaultSchedule();
  }

  var schedule = {};
  for (var i = 1; i < values.length; i += 1) {
    var row = values[i];
    if (!row || !String(row[0] || '').trim()) continue;
    var dayName = String(row[0]).trim();
    schedule[dayName] = sanitizeScheduleItem(dayName, {
      dia: dayName,
      trabalha: row[1] === true || String(row[1]).toLowerCase() === 'sim' || String(row[1]).toLowerCase() === 'true',
      entrada: normalizeTimeCell(row[2]),
      saidaCafe: normalizeTimeCell(row[3]),
      voltaCafe: normalizeTimeCell(row[4]),
      saida: normalizeTimeCell(row[5]),
      observacao: String(row[6] || '')
    });
  }

  return Object.keys(schedule).length ? schedule : getDefaultSchedule();
}

function saveSchedule(schedule) {
  var sheet = getSheet('JORNADA');
  var orderedDays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  var rows = [['Dia', 'Trabalha', 'Entrada', 'SaidaCafe', 'VoltaCafe', 'Saida', 'Observacao']];

  orderedDays.forEach(function (dayName) {
    var item = schedule && schedule[dayName] ? schedule[dayName] : getDefaultSchedule()[dayName];
    var safeItem = sanitizeScheduleItem(dayName, item || {});
    rows.push([
      safeItem.dia,
      safeItem.trabalha ? 'Sim' : 'Não',
      safeItem.entrada || '',
      safeItem.saidaCafe || '',
      safeItem.voltaCafe || '',
      safeItem.saida || '',
      safeItem.observacao || ''
    ]);
  });

  sheet.clear();
  sheet.getRange(1, 1, rows.length, 7).setValues(rows);
  return readSchedule();
}

function readHolidays() {
  var sheet = getSheet('FERIADOS');
  var values = sheet.getDataRange().getValues();
  var holidays = {};

  for (var i = 1; i < values.length; i += 1) {
    var row = values[i];
    if (!row || !String(row[0] || '').trim()) continue;
    var dateKey = String(row[0]).trim();
    holidays[dateKey] = {
      data: dateKey,
      nome: String(row[1] || 'Feriado'),
      trabalha: String(row[2] || '').trim().toLowerCase() === 'sim' || row[2] === true || String(row[2]).toLowerCase() === 'true'
    };
  }

  return holidays;
}

function writeHoliday(dateKey, nome, trabalha) {
  var sheet = getSheet('FERIADOS');
  var values = sheet.getDataRange().getValues();
  var targetRow = -1;

  for (var i = 1; i < values.length; i += 1) {
    if (String(values[i][0] || '').trim() === String(dateKey)) {
      targetRow = i + 1;
      break;
    }
  }

  var row = [String(dateKey), String(nome || 'Feriado'), trabalha ? 'Sim' : 'Não'];
  if (targetRow === -1) {
    sheet.appendRow(row);
  } else {
    sheet.getRange(targetRow, 1, 1, 3).setValues([row]);
  }

  return readHolidays();
}

function deleteHoliday(dateKey) {
  var sheet = getSheet('FERIADOS');
  var values = sheet.getDataRange().getValues();

  for (var i = values.length - 1; i >= 1; i -= 1) {
    if (String(values[i][0] || '').trim() === String(dateKey)) {
      sheet.deleteRow(i + 1);
      return readHolidays();
    }
  }

  return readHolidays();
}

function canonicalizePunchRow(row, dateKey) {
  if (!row) return null;

  var values = Array.isArray(row) ? row.slice() : [];
  while (values.length < 8) values.push('');

  var date = String(dateKey || values[1] || '').trim();
  if (!date) return null;

  var type = String(values[2] || '').trim().toLowerCase();
  var time = normalizeTimeCell(values[3]);

  if (VALID_POINT_TYPES.indexOf(type) !== -1 && time) {
    return {
      id: String(values[0] || '').trim(),
      dateKey: date,
      type: type,
      time: time,
      note: String(values[4] || '').trim(),
      origem: String(values[5] || 'web').trim(),
      criadoEm: String(values[6] || '').trim(),
      atualizadoEm: String(values[7] || '').trim()
    };
  }

  var legacyType = '';
  var legacyTime = '';
  var legacyMap = {
    entrada: 2,
    saidaCafe: 3,
    voltaCafe: 4,
    saida: 5
  };

  Object.keys(legacyMap).forEach(function (key) {
    if (!legacyType && normalizeTimeCell(values[legacyMap[key]])) {
      legacyType = key;
      legacyTime = normalizeTimeCell(values[legacyMap[key]]);
    }
  });

  if (legacyType && legacyTime) {
    return {
      id: String(values[0] || '').trim(),
      dateKey: date,
      type: legacyType,
      time: legacyTime,
      note: String(values[8] || '').trim(),
      origem: String(values[12] || 'web').trim(),
      criadoEm: String(values[13] || values[9] || '').trim(),
      atualizadoEm: String(values[9] || values[13] || '').trim()
    };
  }

  return null;
}

function getPunchRowsByDate(dateKey) {
  var sheet = getSheet('PONTOS');
  var values = sheet.getDataRange().getValues();
  var result = [];

  for (var i = 1; i < values.length; i += 1) {
    var row = values[i];
    if (!row || !String(row[1] || '').trim()) continue;
    if (String(row[1]).trim() !== String(dateKey)) continue;

    var item = canonicalizePunchRow(row, String(dateKey));
    if (item) {
      result.push(item);
    }
  }

  return result;
}

function getDayState(dateKey) {
  var rows = getPunchRowsByDate(dateKey);
  var state = {
    dateKey: String(dateKey),
    entrada: '',
    saidaCafe: '',
    voltaCafe: '',
    saida: '',
    observacao: '',
    status: 'Pendente',
    totalTrabalhado: '00:00',
    nextAction: 'ENTRADA',
    available: true,
    trabalhaNoFeriado: false,
    holiday: null,
    schedule: null,
    predictedMinutes: 0,
    totalWorkedMinutes: 0
  };

  rows.forEach(function (item) {
    if (!item || !item.type) return;
    state[item.type] = item.time;
    if (item.note) state.observacao = item.note;
  });

  var holiday = readHolidays()[dateKey];
  state.holiday = holiday || null;
  var schedule = readSchedule();
  var weekday = getWeekdayName(dateKey);
  var daySchedule = schedule[weekday] || { trabalha: false, entrada: '', saida: '', saidaCafe: '', voltaCafe: '', observacao: '' };
  state.schedule = sanitizeScheduleItem(weekday, daySchedule);

  var workday = !!(holiday ? holiday.trabalha : state.schedule.trabalha);
  state.available = workday;
  state.trabalhaNoFeriado = holiday ? !!holiday.trabalha : false;

  var entry = state.entrada || '';
  var coffeeExit = state.saidaCafe || '';
  var coffeeReturn = state.voltaCafe || '';
  var exit = state.saida || '';

  if (holiday && !holiday.trabalha) {
    state.status = 'Feriado';
    state.nextAction = 'FERIADO';
    state.totalTrabalhado = '00:00';
    state.predictedMinutes = 0;
    state.totalWorkedMinutes = 0;
    return state;
  }

  if (!state.schedule.trabalha) {
    state.status = 'FOLGA';
    state.nextAction = 'FOLGA';
    state.totalTrabalhado = '00:00';
    state.predictedMinutes = 0;
    state.totalWorkedMinutes = 0;
    return state;
  }

  var expectedMinutes = 0;
  if (state.schedule.entrada && state.schedule.saida) {
    expectedMinutes = Math.max(toMinutes(state.schedule.saida) - toMinutes(state.schedule.entrada), 0);
    if (state.schedule.saidaCafe && state.schedule.voltaCafe) {
      expectedMinutes -= Math.max(toMinutes(state.schedule.voltaCafe) - toMinutes(state.schedule.saidaCafe), 0);
    }
  }
  state.predictedMinutes = expectedMinutes;
  state.totalWorkedMinutes = calculateWorkedMinutes(entry, coffeeExit, coffeeReturn, exit);
  state.totalTrabalhado = minutesToText(state.totalWorkedMinutes);

  if (!entry) {
    state.nextAction = 'ENTRADA';
    state.status = 'Pendente';
  } else if (!coffeeExit) {
    state.nextAction = 'SAIDA_CAFE';
    state.status = 'Pendente';
  } else if (!coffeeReturn) {
    state.nextAction = 'VOLTA_CAFE';
    state.status = 'Pendente';
  } else if (!exit) {
    state.nextAction = 'SAIDA';
    state.status = 'Pendente';
  } else {
    state.nextAction = 'FINALIZADO';
    state.status = 'Completo';
  }

  return state;
}

function validatePunchSequence(dateKey, type, time) {
  var state = getDayState(dateKey);
  var entrada = state.entrada || '';
  var saidaCafe = state.saidaCafe || '';
  var voltaCafe = state.voltaCafe || '';
  var saida = state.saida || '';
  var timeMinutes = toMinutes(time);

  if (holidayExists(dateKey) && !readHolidays()[dateKey].trabalha) {
    return { valid: false, message: 'Data marcada como feriado sem trabalho.' };
  }

  if (!state.available) {
    return { valid: false, message: 'Não há jornada para esse dia.' };
  }

  switch (type) {
    case 'entrada':
      if (entrada) return { valid: false, message: 'Entrada já registrada.' };
      return { valid: true };
    case 'saidaCafe':
      if (!entrada) return { valid: false, message: 'Registre a entrada antes de sair para o café.' };
      if (saidaCafe) return { valid: false, message: 'Saída para café já registrada.' };
      if (timeMinutes <= toMinutes(entrada)) return { valid: false, message: 'Saída para café deve ser depois da entrada.' };
      return { valid: true };
    case 'voltaCafe':
      if (!saidaCafe) return { valid: false, message: 'Registre a saída para café antes de voltar.' };
      if (voltaCafe) return { valid: false, message: 'Volta do café já registrada.' };
      if (timeMinutes <= toMinutes(saidaCafe)) return { valid: false, message: 'Volta do café deve ser depois da saída para café.' };
      return { valid: true };
    case 'saida':
      if (!entrada) return { valid: false, message: 'Registre a entrada antes da saída.' };
      if (saidaCafe && !voltaCafe) return { valid: false, message: 'Registre a volta do café antes de encerrar o dia.' };
      if (saida) return { valid: false, message: 'Saída já registrada.' };
      if (voltaCafe && timeMinutes <= toMinutes(voltaCafe)) return { valid: false, message: 'Saída deve ser depois da volta do café.' };
      if (!voltaCafe && timeMinutes <= toMinutes(entrada)) return { valid: false, message: 'Saída deve ser depois da entrada.' };
      return { valid: true };
    default:
      return { valid: false, message: 'Tipo inválido.' };
  }
}

function holidayExists(dateKey) {
  var holidays = readHolidays();
  return !!holidays[String(dateKey)];
}

function appendPunch(dateKey, type, time, note) {
  var normalizedType = normalizeType(type);
  var sheet = getSheet('PONTOS');
  var now = new Date();
  var timestamp = Utilities.formatDate(now, TZ, 'yyyy-MM-dd HH:mm:ss');

  var rows = getPunchRowsByDate(String(dateKey));
  for (var i = 0; i < rows.length; i += 1) {
    if (rows[i].type === normalizedType) {
      throw new Error('Esse tipo de ponto já foi batido para este dia.');
    }
  }

  var row = [
    Utilities.formatDate(now, TZ, 'yyyyMMddHHmmss'),
    String(dateKey),
    normalizedType,
    normalizeTimeCell(time),
    String(note || '').trim(),
    'web',
    timestamp,
    timestamp
  ];

  sheet.appendRow(row);
  return canonicalizePunchRow(row, String(dateKey));
}

function registerPunch(type) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error('Outro registro está sendo processado. Tente novamente em alguns segundos.');
  }

  try {
    var dateKey = toDateKey(new Date());
    var time = Utilities.formatDate(new Date(), TZ, 'HH:mm');
    var normalizedType = normalizeType(type);

    var validation = validatePunchSequence(dateKey, normalizedType, time);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    appendPunch(dateKey, normalizedType, time, '');
    return getDayState(dateKey);
  } finally {
    lock.releaseLock();
  }
}

function updatePunchRow(dateKey, type, newValue, note) {
  var sheet = getSheet('PONTOS');
  var values = sheet.getDataRange().getValues();
  var targetType = normalizeType(type);
  var rowIndex = -1;

  for (var i = 1; i < values.length; i += 1) {
    if (String(values[i][1] || '').trim() !== String(dateKey)) continue;
    if (String(values[i][2] || '').trim().toLowerCase() !== targetType) continue;
    rowIndex = i + 1;
    break;
  }

  if (rowIndex === -1) {
    appendPunch(String(dateKey), targetType, newValue, note || '');
    return getDayState(String(dateKey));
  }

  var timestamp = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');
  sheet.getRange(rowIndex, 4, 1, 1).setValue(normalizeTimeCell(newValue));
  sheet.getRange(rowIndex, 5, 1, 1).setValue(String(note || ''));
  sheet.getRange(rowIndex, 8, 1, 1).setValue(timestamp);

  return getDayState(String(dateKey));
}

function editRecord(dateKey, field, newValue, motivo) {
  var date = String(dateKey || '').trim();
  var fieldName = String(field || '').trim();
  var map = {
    Entrada: 'entrada',
    SaidaCafe: 'saidaCafe',
    VoltaCafe: 'voltaCafe',
    Saida: 'saida',
    Observacao: 'observacao'
  };

  if (!map[fieldName]) {
    throw new Error('Campo inválido: ' + field);
  }

  var type = map[fieldName];
  var current = getDayState(date);

  if (fieldName === 'Observacao') {
    var random = getPunchRowsByDate(date);
    if (!random.length) {
      throw new Error('Não há registro para atualizar observação.');
    }
    var destinationType = type === 'observacao' ? 'entrada' : type;
    var target = getSheet('PONTOS');
    var values = target.getDataRange().getValues();
    for (var i = 1; i < values.length; i += 1) {
      if (String(values[i][1] || '').trim() !== date) continue;
      if (String(values[i][2] || '').trim().toLowerCase() === destinationType) {
        target.getRange(i + 1, 5, 1, 1).setValue(String(newValue || ''));
        target.getRange(i + 1, 8, 1, 1).setValue(Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'));
        return getDayState(date);
      }
    }
    throw new Error('Ponto da data não encontrado para observação.');
  }

  if (!isValidTime(newValue)) {
    throw new Error('Horário inválido. Use HH:MM.');
  }

  if (!current[type]) {
    appendPunch(date, type, newValue, motivo || '');
    return getDayState(date);
  }

  return updatePunchRow(date, type, newValue, motivo || '');
}

function getMonthlySummary(year, monthIndex) {
  var date = new Date(Number(year), Number(monthIndex), 1);
  var daysInMonth = new Date(Number(year), Number(monthIndex) + 1, 0).getDate();
  var totalWorked = 0;
  var totalPlanned = 0;
  var totalExtra = 0;
  var countDaysWorked = 0;
  var countIncomplete = 0;

  for (var day = 1; day <= daysInMonth; day += 1) {
    var dateKey = String(year) + '-' + pad2(monthIndex + 1) + '-' + pad2(day);
    var state = getDayState(dateKey);
    var holiday = readHolidays()[dateKey];

    if (holiday && !holiday.trabalha) continue;
    if (!state.schedule || !state.schedule.trabalha) continue;

    totalPlanned += state.predictedMinutes || 0;
    totalWorked += state.totalWorkedMinutes || 0;
    if ((state.totalWorkedMinutes || 0) > (state.predictedMinutes || 0)) totalExtra += (state.totalWorkedMinutes || 0) - (state.predictedMinutes || 0);
    countDaysWorked += 1;
    if (state.nextAction !== 'FINALIZADO') countIncomplete += 1;
  }

  return {
    year: Number(year),
    monthIndex: Number(monthIndex),
    daysInMonth: daysInMonth,
    totalWorked: totalWorked,
    totalPlanned: totalPlanned,
    totalExtra: totalExtra,
    countDaysWorked: countDaysWorked,
    countIncomplete: countIncomplete
  };
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var params = e && e.parameter ? e.parameter : {};
  var action = String(params.action || params.route || 'health').toLowerCase();

  try {
    switch (action) {
      case 'health':
        return jsonResponse({ ok: true, message: 'Apps Script ativo', timestamp: new Date().toISOString() });
      case 'config':
        return jsonResponse(readConfig());
      case 'schedule':
        return jsonResponse(readSchedule());
      case 'holidays':
        return jsonResponse(readHolidays());
      case 'day':
        return jsonResponse(getDayState(String(params.dateKey || toDateKey(new Date()))));
      case 'month':
        return jsonResponse(getMonthlySummary(Number(params.year || new Date().getFullYear()), Number(params.month || new Date().getMonth())));
      default:
        return jsonResponse({ ok: false, message: 'Ação desconhecida: ' + action });
    }
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function doPost(e) {
  try {
    var payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }

    var action = String(payload.action || '').toLowerCase();
    var type = payload.type || payload.punchType || '';
    var dateKey = payload.dateKey || toDateKey(new Date());

    switch (action) {
      case 'save-config':
        return jsonResponse(writeConfig(payload.config || {}));
      case 'save-schedule':
        return jsonResponse(saveSchedule(payload.schedule || {}));
      case 'save-holiday':
        return jsonResponse(writeHoliday(payload.dateKey, payload.nome, payload.trabalha));
      case 'delete-holiday':
        return jsonResponse(deleteHoliday(payload.dateKey));
      case 'register-punch':
        return jsonResponse(registerPunch(type));
      case 'edit-record':
        return jsonResponse(editRecord(dateKey, payload.field, payload.value, payload.motivo || ''));
      case 'day':
        return jsonResponse(getDayState(dateKey));
      default:
        return jsonResponse({ ok: false, message: 'Ação inválida.' });
    }
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}
