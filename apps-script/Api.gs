// ─── Meu Ponto — Apps Script API ─────────────────────────────────────────────
// Versão: 2.0  (API JSON para frontend externo na Vercel)
// Todos os requests chegam via GET com o parâmetro ?action=X
// Parâmetros extras são passados em ?p=<JSON encodado>
// ─────────────────────────────────────────────────────────────────────────────

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action) : '';
  if (!action) {
    return jsonResponse({
      ok: false,
      error: 'Endpoint de API. Informe uma ação válida.',
      service: 'Meu Ponto API'
    });
  }

  var rawParam = (e && e.parameter && e.parameter.p) ? e.parameter.p : '{}';
  var params;
  try {
    params = JSON.parse(rawParam);
  } catch (_) {
    params = {};
  }

  var result;
  try {
    result = routeAction(action, params, e);
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }

  return jsonResponse({ ok: true, result: result });
}

// ─── Roteador ────────────────────────────────────────────────────────────────

function routeAction(action, params, e) {
  switch (action) {

    // Carregamento inicial: config + jornada + feriados + estado de hoje
    case 'getShell':
      var shellContext = createDataContext();
      return {
        config:   shellContext.config,
        schedule: shellContext.schedule,
        holidays: shellContext.holidays,
        today:    buildDailyState(new Date(), shellContext)
      };

    // Calendário completo de um mês
    case 'getCalendar': {
      var year  = Number(params.year  || (e && e.parameter.year)  || new Date().getFullYear());
      var month = Number(params.month || (e && e.parameter.month) || new Date().getMonth());
      if (!isFinite(year) || !isFinite(month) || year < 2000 || year > 2100 || month < 0 || month > 11) {
        throw new Error('Período inválido.');
      }
      return getAppDataForMonth(parseDateKey(year + '-' + pad2(month + 1) + '-01'));
    }

    // Registrar ponto (entrada / saidaCafe / voltaCafe / saida)
    case 'registerPunch': {
      var type = String(params.type || (e && e.parameter.type) || '');
      if (!type) throw new Error('Parâmetro "type" é obrigatório.');
      return registerPunch(type);
    }

    // Editar registro existente
    case 'editRecord': {
      var dateKey  = String(params.dateKey  || (e && e.parameter.dateKey)  || '');
      var field    = String(params.field    || (e && e.parameter.field)    || '');
      var value    = String(params.value    || (e && e.parameter.value)    || '');
      var motivo   = String(params.motivo   || (e && e.parameter.motivo)   || 'Correção manual');
      if (!dateKey || !field || !value) throw new Error('Parâmetros dateKey, field e value são obrigatórios.');
      return editRecord(dateKey, field, value, motivo);
    }

    // Salvar configurações do perfil
    case 'saveConfig': {
      var config = readConfig();
      config.nome              = params.nome              !== undefined ? params.nome              : config.nome;
      config.empresa           = params.empresa           !== undefined ? params.empresa           : config.empresa;
      config.cnpj              = params.cnpj              !== undefined ? params.cnpj              : config.cnpj;
      config.endereco          = params.endereco          !== undefined ? params.endereco          : config.endereco;
      config.atividade         = params.atividade         !== undefined ? params.atividade         : config.atividade;
      config.cargo             = params.cargo             !== undefined ? params.cargo             : config.cargo;
      config.horarioPadrao     = params.horarioPadrao     !== undefined ? params.horarioPadrao     : config.horarioPadrao;
      config.intervaloPadrao   = params.intervaloPadrao   !== undefined ? Number(params.intervaloPadrao) : config.intervaloPadrao;
      config.trabalhaFeriado   = params.trabalhaFeriado   !== undefined ? (params.trabalhaFeriado === true || params.trabalhaFeriado === 'true') : config.trabalhaFeriado;
      writeConfig(config);
      return config;
    }

    // Salvar jornada semanal
    case 'saveSchedule': {
      var schedule = readSchedule();
      var dayNames = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
      dayNames.forEach(function (dayName) {
        var data = params[dayName] || {};
        if (Object.keys(data).length > 0) {
          schedule[dayName] = {
            dia:        dayName,
            trabalha:   data.trabalha === true || data.trabalha === 'true' || data.trabalha === 'sim',
            entrada:    data.entrada    || '',
            saidaCafe:  data.saidaCafe  || '',
            voltaCafe:  data.voltaCafe  || '',
            saida:      data.saida      || '',
            observacao: data.observacao || ''
          };
        }
      });
      validateSchedule(schedule);
      saveSchedule(schedule);
      return schedule;
    }

    // Adicionar ou atualizar feriado
    case 'saveHoliday': {
      var hDateKey  = String(params.dateKey || (e && e.parameter.dateKey) || '');
      var hNome     = String(params.nome    || (e && e.parameter.nome)    || 'Feriado');
      var hTrabalha = params.trabalha === true || params.trabalha === 'true';
      if (!hDateKey) throw new Error('Parâmetro "dateKey" é obrigatório.');
      writeHoliday(hDateKey, hNome, hTrabalha);
      return readHolidays();
    }

    // Remover feriado
    case 'deleteHoliday': {
      var dDateKey = String(params.dateKey || (e && e.parameter.dateKey) || '');
      if (!dDateKey) throw new Error('Parâmetro "dateKey" é obrigatório.');
      deleteHoliday(dDateKey);
      return readHolidays();
    }

    // Resumo mensal
    case 'getMonthlySummary': {
      var sYear  = Number(params.year  || (e && e.parameter.year)  || new Date().getFullYear());
      var sMonth = Number(params.month || (e && e.parameter.month) || new Date().getMonth());
      if (!isFinite(sYear) || !isFinite(sMonth) || sYear < 2000 || sYear > 2100 || sMonth < 0 || sMonth > 11) {
        throw new Error('Período inválido.');
      }
      return getMonthlySummary(sYear, sMonth);
    }

    // Estado de um dia específico
    case 'getDayState': {
      var dKey = String(params.dateKey || (e && e.parameter.dateKey) || '');
      if (!dKey) throw new Error('Parâmetro "dateKey" é obrigatório.');
      return buildDailyState(parseDateKey(dKey));
    }

    default:
      throw new Error('Ação desconhecida: "' + action + '"');
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(payload) {
  var output = ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

function getAppShell() {
  return routeAction('getShell', {});
}

function getCalendarData(year, monthIndex) {
  return routeAction('getCalendar', { year: year, month: monthIndex });
}

function saveConfigEndpoint(payload) {
  return routeAction('saveConfig', payload || {});
}

function saveScheduleEndpoint(payload) {
  return routeAction('saveSchedule', payload || {});
}

function registerPunchEndpoint(type) {
  return routeAction('registerPunch', { type: type });
}

function editRecordEndpoint(dateKey, field, value, motivo) {
  return routeAction('editRecord', { dateKey: dateKey, field: field, value: value, motivo: motivo });
}

function getCurrentState() {
  return routeAction('getShell', {});
}
