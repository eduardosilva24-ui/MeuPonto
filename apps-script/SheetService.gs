// ─── Meu Ponto — SheetService.gs ─────────────────────────────────────────────
// Versão: 2.0 — Camada de acesso ao Google Sheets
// ─────────────────────────────────────────────────────────────────────────────

var SHEET_ID = '1Q0-QD1lk7xn76Z5QMSvqvfDYQOKZKVj1pKBFDh61wAs';

function getSpreadsheet() {
  try {
    return SpreadsheetApp.openById(SHEET_ID);
  } catch (err) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
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
      headers: ['ID', 'Data', 'Entrada', 'SaidaCafe', 'VoltaCafe', 'Saida', 'Status', 'TotalTrabalhado', 'Observacao', 'AtualizadoEm']
    },
    {
      name: 'FERIADOS',
      headers: ['Data', 'Nome', 'Trabalha']
    },
    {
      name: 'AJUSTES',
      headers: ['ID', 'Data', 'Tipo', 'ValorAntigo', 'ValorNovo', 'Motivo', 'CriadoEm']
    }
  ];

  requiredSheets.forEach(function (sheetConfig) {
    var sheet = spreadsheet.getSheetByName(sheetConfig.name);
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

  return spreadsheet;
}

function getSheet(name) {
  ensureCoreSheets();
  return getSpreadsheet().getSheetByName(name);
}

// ─── CONFIG ───────────────────────────────────────────────────────────────────

function readConfig() {
  var sheet = getSheet('CONFIG');
  var values = sheet.getDataRange().getValues();
  var config = {
    nome:            '',
    empresa:         '',
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
    } else {
      config[key] = value;
    }
  }

  return config;
}

function writeConfig(config) {
  var sheet = getSheet('CONFIG');
  var keys = ['nome', 'empresa', 'cargo', 'jornada', 'horarioPadrao', 'intervaloPadrao', 'timezone', 'trabalhaFeriado'];
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
    return {};
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
      entrada:    String(row[2] || ''),
      saidaCafe:  String(row[3] || ''),
      voltaCafe:  String(row[4] || ''),
      saida:      String(row[5] || ''),
      observacao: String(row[6] || '')
    };
  }

  return schedule;
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

function getDailyPointRow(dateKey) {
  var sheet = getSheet('PONTOS');
  var values = sheet.getDataRange().getValues();

  for (var i = 1; i < values.length; i += 1) {
    if (String(values[i][1] || '').trim() === String(dateKey)) {
      return values[i];
    }
  }

  return null;
}

function ensureDailyRow(dateKey) {
  var sheet = getSheet('PONTOS');
  var existing = getDailyPointRow(dateKey);
  if (existing) {
    return existing;
  }

  var now = new Date();
  var rowData = [
    Utilities.formatDate(now, TZ, 'yyyyMMddHHmmss'),
    dateKey,
    '', '', '', '',
    'Pendente',
    '0:00',
    '',
    Utilities.formatDate(now, TZ, 'yyyy-MM-dd HH:mm:ss')
  ];

  sheet.appendRow(rowData);
  return rowData;
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

  var range = sheet.getRange(rowIndex, 1, 1, 10);
  var row = range.getValues()[0];
  var updated = row.slice();

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

  range.setValues([updated]);
  return updated;
}
