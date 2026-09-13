// ─── Meu Ponto — SheetService.gs ─────────────────────────────────────────────
// Versão: 2.0 — Camada de acesso ao Google Sheets
// ─────────────────────────────────────────────────────────────────────────────

var SHEET_ID = '1Q0-QD1lk7xn76Z5QMSvqvfDYQOKZKVj1pKBFDh61wAs';

function normalizeSheetName(name) {
  return String(name || '').trim().toUpperCase();
}

function findSheetByName(spreadsheet, sheetName) {
  var targetName = normalizeSheetName(sheetName);
  var sheets = spreadsheet.getSheets();
  for (var i = 0; i < sheets.length; i += 1) {
    if (normalizeSheetName(sheets[i].getName()) === targetName) {
      return sheets[i];
    }
  }
  return null;
}

function getSpreadsheet() {
  if (!SHEET_ID) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
  return SpreadsheetApp.openById(SHEET_ID);
}

function ensureCoreSheets() {
  var spreadsheet = getSpreadsheet();
  var requiredSheets = [
    {
      name: 'CONFIG',
      headers: ['Campo', 'Valor']
    },
    {
      name: 'JORNADA',
      headers: ['Dia', 'Trabalha', 'Entrada', 'SaidaCafe', 'VoltaCafe', 'Saida', 'Observacao']
    },
    {
      name: 'PONTOS',
      headers: ['ID', 'Data', 'Entrada', 'SaidaCafe', 'VoltaCafe', 'Saida', 'Status', 'TotalTrabalhado', 'Observacao', 'AtualizadoEm', 'JornadaPrevistaMinutos', 'JornadaSnapshot', 'Origem', 'CriadoEm']
    },
    {
      name: 'FERIADOS',
      headers: ['Data', 'Nome', 'Trabalha']
    },
    {
      name: 'AJUSTES',
      headers: ['ID', 'Data', 'Tipo', 'ValorAntigo', 'ValorNovo', 'Motivo', 'Responsavel', 'CriadoEm']
    }
  ];

  requiredSheets.forEach(function (sheetConfig) {
    var sheet = findSheetByName(spreadsheet, sheetConfig.name);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetConfig.name);
    }

    var existing = sheet.getDataRange().getValues();
    if (!existing.length) {
      sheet.appendRow(sheetConfig.headers);
    } else {
      var headerRow = existing[0];
      for (var i = 0; i < sheetConfig.headers.length; i += 1) {
        if (headerRow[i] !== sheetConfig.headers[i]) {
          sheet.getRange(1, 1, 1, sheetConfig.headers.length).setValues([sheetConfig.headers]);
          break;
        }
      }
    }
  });

  var scheduleSheet = findSheetByName(spreadsheet, 'JORNADA');
  if (scheduleSheet && scheduleSheet.getLastRow() < 2) {
    var defaults = getDefaultSchedule();
    var orderedDays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    var rows = orderedDays.map(function (day) {
      var item = defaults[day];
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
    scheduleSheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }

  return spreadsheet;
}

function getSheet(name) {
  var spreadsheet = getSpreadsheet();
  ensureCoreSheets();
  return findSheetByName(spreadsheet, name) || findSheetByName(getSpreadsheet(), name);
}

// ─── CONFIG ───────────────────────────────────────────────────────────────────

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

    if (/^\d{2}:\d{2}$/.test(text)) {
      return text;
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
    } catch (_) {}

    return text;
  }

  return String(value);
}

function readConfig() {
  var sheet = getSheet('CONFIG');
  var values = sheet.getDataRange().getValues();
  var config = {
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

  if (!values.length) {
    return config;
  }

  for (var i = 1; i < values.length; i += 1) {
    var row = values[i];
    var key = String(row[0] || '').trim();
    var value = row[1];
    if (!key) {
      continue;
    }
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
  var values = [];

  for (var i = 0; i < keys.length; i += 1) {
    var val = config[keys[i]];
    if (val === undefined || val === null) val = '';
    values.push([keys[i], val]);
  }

  sheet.clear();
  sheet.appendRow(['Campo', 'Valor']);
  if (values.length) {
    sheet.getRange(2, 1, values.length, 2).setValues(values);
  }
}

// ─── JORNADA ─────────────────────────────────────────────────────────────────

function readSchedule() {
  var sheet = getSheet('JORNADA');
  var values = sheet.getDataRange().getValues();
  if (!values.length || !values[0] || values[0][0] !== 'Dia') {
    return getDefaultSchedule();
  }

  var schedule = {};
  for (var i = 1; i < values.length; i += 1) {
    var row = values[i];
    if (!row[0]) {
      continue;
    }
    schedule[row[0]] = {
      dia:        row[0],
      trabalha:   String(row[1]).toLowerCase() === 'sim' || row[1] === true || row[1] === 'TRUE',
      entrada:    normalizeTimeCell(row[2]),
      saidaCafe:  normalizeTimeCell(row[3]),
      voltaCafe:  normalizeTimeCell(row[4]),
      saida:      normalizeTimeCell(row[5]),
      observacao: String(row[6] || '')
    };
  }

  return Object.keys(schedule).length ? schedule : getDefaultSchedule();
}

function getDefaultSchedule() {
  return {
    'Segunda': { dia: 'Segunda', trabalha: true, entrada: '15:00', saidaCafe: '', voltaCafe: '', saida: '21:00', observacao: '' },
    'Terça':   { dia: 'Terça', trabalha: true, entrada: '15:00', saidaCafe: '', voltaCafe: '', saida: '21:00', observacao: '' },
    'Quarta':  { dia: 'Quarta', trabalha: true, entrada: '15:00', saidaCafe: '', voltaCafe: '', saida: '21:00', observacao: '' },
    'Quinta':  { dia: 'Quinta', trabalha: true, entrada: '15:00', saidaCafe: '', voltaCafe: '', saida: '21:00', observacao: '' },
    'Sexta':   { dia: 'Sexta', trabalha: true, entrada: '14:00', saidaCafe: '', voltaCafe: '', saida: '20:00', observacao: '' },
    'Sábado':  { dia: 'Sábado', trabalha: true, entrada: '08:00', saidaCafe: '', voltaCafe: '', saida: '15:00', observacao: '' },
    'Domingo': { dia: 'Domingo', trabalha: false, entrada: '', saidaCafe: '', voltaCafe: '', saida: '', observacao: 'Folga' }
  };
}

function saveSchedule(schedule) {
  var sheet = getSheet('JORNADA');
  var rows = [
    ['Dia', 'Trabalha', 'Entrada', 'SaidaCafe', 'VoltaCafe', 'Saida', 'Observacao']
  ];
  var orderedDays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  orderedDays.forEach(function (day) {
    var item = schedule[day] || {
      dia:        day,
      trabalha:   false,
      entrada:    '',
      saidaCafe:  '',
      voltaCafe:  '',
      saida:      '',
      observacao: ''
    };
    rows.push([
      item.dia,
      item.trabalha ? 'Sim' : 'Não',
      item.entrada    || '',
      item.saidaCafe  || '',
      item.voltaCafe  || '',
      item.saida      || '',
      item.observacao || ''
    ]);
  });

  sheet.clear();
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
}

// ─── FERIADOS ─────────────────────────────────────────────────────────────────

function readHolidays() {
  var sheet = getSheet('FERIADOS');
  var values = sheet.getDataRange().getValues();
  if (!values.length) {
    return {};
  }

  var holidays = {};
  for (var i = 1; i < values.length; i += 1) {
    var row = values[i];
    var dateKey = String(row[0] || '').trim();
    if (!dateKey) {
      continue;
    }
    holidays[dateKey] = {
      data:      dateKey,
      nome:      row[1] || 'Feriado',
      trabalha:  String(row[2]).toLowerCase() === 'sim' || row[2] === true || row[2] === 'TRUE'
    };
  }
  return holidays;
}

function writeHoliday(dateKey, nome, trabalha) {
  var sheet = getSheet('FERIADOS');
  var values = sheet.getDataRange().getValues();
  var rowIndex = -1;

  // Procura linha existente
  for (var i = 1; i < values.length; i += 1) {
    if (String(values[i][0] || '').trim() === String(dateKey)) {
      rowIndex = i + 1; // 1-indexed
      break;
    }
  }

  var rowData = [dateKey, nome || 'Feriado', trabalha ? 'Sim' : 'Não'];

  if (rowIndex === -1) {
    sheet.appendRow(rowData);
  } else {
    sheet.getRange(rowIndex, 1, 1, 3).setValues([rowData]);
  }
}

function deleteHoliday(dateKey) {
  var sheet = getSheet('FERIADOS');
  var values = sheet.getDataRange().getValues();

  for (var i = values.length - 1; i >= 1; i -= 1) {
    if (String(values[i][0] || '').trim() === String(dateKey)) {
      sheet.deleteRow(i + 1); // 1-indexed
      return;
    }
  }
}

// ─── PONTOS ──────────────────────────────────────────────────────────────────

function scorePointRow(row) {
  var score = 0;
  if (String(row[1] || '').trim()) score += 5;
  for (var i = 2; i <= 5; i += 1) {
    if (String(row[i] || '').trim()) score += 4;
  }
  if (String(row[6] || '').trim()) score += 2;
  if (String(row[7] || '').trim()) score += 2;
  if (String(row[8] || '').trim()) score += 1;
  return score;
}

function getDailyPointRow(dateKey) {
  var sheet = getSheet('PONTOS');
  var values = sheet.getDataRange().getValues();
  var match = null;
  var bestScore = -1;

  for (var i = values.length - 1; i >= 1; i -= 1) {
    if (String(values[i][1] || '').trim() === String(dateKey)) {
      var score = scorePointRow(values[i]);
      if (score > bestScore) {
        match = values[i];
        bestScore = score;
      }
    }
  }

  return match;
}

function getRowIndexByDateKey(dateKey) {
  var sheet = getSheet('PONTOS');
  var values = sheet.getDataRange().getValues();
  var bestRowIndex = -1;
  var bestScore = -1;

  for (var i = values.length - 1; i >= 1; i -= 1) {
    if (String(values[i][1] || '').trim() === String(dateKey)) {
      var score = scorePointRow(values[i]);
      if (score > bestScore) {
        bestRowIndex = i + 1;
        bestScore = score;
      }
    }
  }

  return bestRowIndex;
}

function buildDailyRowData(dateKey, now, schedule) {
  var nowText = Utilities.formatDate(now, TZ, 'yyyy-MM-dd HH:mm:ss');
  return [
    Utilities.formatDate(now, TZ, 'yyyyMMddHHmmss'),
    dateKey,
    '', '', '', '',
    'Pendente',
    '0:00',
    '',
    nowText,
    getPredictedMinutes(schedule),
    JSON.stringify(schedule),
    'web',
    nowText
  ];
}

function ensureDailyRow(dateKey) {
  var sheet = getSheet('PONTOS');
  var existing = getDailyPointRow(dateKey);
  if (existing) {
    return existing;
  }

  var now = new Date();
  var schedule = getScheduleForDate(parseDateKey(dateKey));
  var rowData = buildDailyRowData(dateKey, now, schedule);

  sheet.appendRow(rowData);
  return rowData;
}

function mergeDailyRow(row, valuesMap) {
  var updated = row.slice();
  while (updated.length < 14) updated.push('');

  if (valuesMap.ID             !== undefined) updated[0] = valuesMap.ID;
  if (valuesMap.Data           !== undefined) updated[1] = valuesMap.Data;
  if (valuesMap.Entrada        !== undefined) updated[2] = valuesMap.Entrada;
  if (valuesMap.SaidaCafe      !== undefined) updated[3] = valuesMap.SaidaCafe;
  if (valuesMap.VoltaCafe      !== undefined) updated[4] = valuesMap.VoltaCafe;
  if (valuesMap.Saida          !== undefined) updated[5] = valuesMap.Saida;
  if (valuesMap.Status         !== undefined) updated[6] = valuesMap.Status;
  if (valuesMap.TotalTrabalhado !== undefined) updated[7] = valuesMap.TotalTrabalhado;
  if (valuesMap.Observacao     !== undefined) updated[8] = valuesMap.Observacao;
  updated[9] = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');

  return updated;
}

function updateDailyRowAt(rowIndex, valuesMap, baseRow) {
  var sheet = getSheet('PONTOS');
  var row = baseRow || sheet.getRange(rowIndex, 1, 1, 14).getValues()[0];
  var updated = mergeDailyRow(row, valuesMap);
  sheet.getRange(rowIndex, 1, 1, 14).setValues([updated]);
  return updated;
}

function updateDailyRow(dateKey, valuesMap) {
  var sheet = getSheet('PONTOS');
  var values = sheet.getDataRange().getValues();
  var rowIndex = -1;

  for (var i = 1; i < values.length; i += 1) {
    if (String(values[i][1] || '').trim() === String(dateKey)) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    ensureDailyRow(dateKey);
    return updateDailyRow(dateKey, valuesMap);
  }

  var range = sheet.getRange(rowIndex, 1, 1, 14);
  var row = range.getValues()[0];
  var updated = mergeDailyRow(row, valuesMap);

  range.setValues([updated]);
  return updated;
}
