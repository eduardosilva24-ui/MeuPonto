(function () {
  const state = {
    config: {},
    schedule: {},
    holidays: {},
    selectedDate: new Date(),
    monthDate: new Date(),
    screen: 'today',
    todayState: null,
    monthSummary: null,
    dayMap: {},
    initialized: false
  };

  const dayLabels = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  function safeText(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    return String(value);
  }

  function formatDateKey(date) {
    return PontoCalc.formatDateKey(date);
  }

  function formatDateLabel(date) {
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(date);
  }

  function setSyncStatus(text, isError) {
    document.querySelectorAll('[data-sync-status]').forEach(function (node) {
      node.textContent = text;
      node.classList.toggle('error', !!isError);
    });
  }

  function showLoader(message) {
    const loader = document.getElementById('loader');
    const loaderText = document.getElementById('loader-text');
    if (loader && loaderText) {
      loaderText.textContent = message || 'Carregando...';
      loader.classList.remove('hidden');
    }
  }

  function hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
      loader.classList.add('hidden');
    }
  }

  function showToast(message, type) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast ' + (type || 'info');
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(function () {
      toast.classList.add('hide');
      setTimeout(function () {
        toast.remove();
      }, 260);
    }, 2200);
  }

  function setScreen(screenName) {
    state.screen = screenName;
    document.querySelectorAll('.screen').forEach(function (screen) {
      screen.classList.toggle('active', screen.id === 'screen-' + screenName);
    });
    document.querySelectorAll('.side-nav-item, .nav-item').forEach(function (button) {
      button.classList.toggle('active', button.dataset.screen === screenName);
    });
  }

  function getDayState(dateKey) {
    const dayState = state.dayMap[dateKey] || null;
    if (dayState) return dayState;
    return { dateKey, status: 'Pendente', nextAction: 'ENTRADA', entrada: '', saidaCafe: '', voltaCafe: '', saida: '', totalTrabalhado: '00:00', totalWorkedMinutes: 0, predictedMinutes: 0, available: true };
  }

  function updateTodayClock() {
    const el = document.getElementById('today-clock');
    if (!el) return;
    const now = new Date();
    const timeText = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    el.textContent = timeText;
  }

  function renderToday() {
    const dateEl = document.getElementById('today-date');
    const greetingEl = document.getElementById('today-greeting');
    const metaEl = document.getElementById('today-meta');
    const badge = document.getElementById('today-status-badge');
    const punchBtn = document.getElementById('punch-btn');
    const listEl = document.getElementById('record-list');
    const lastRecord = document.getElementById('today-last-record');
    const metricPrevisto = document.getElementById('metric-previsto');
    const metricTrabalhado = document.getElementById('metric-trabalhado');
    const metricSaldo = document.getElementById('metric-saldo');
    const metricStatus = document.getElementById('metric-status');
    const holidayRow = document.getElementById('feriado-trabalhar-row');
    const confirmation = document.getElementById('punch-confirmation');

    const dateKey = formatDateKey(new Date());
    const dayState = getDayState(dateKey);
    state.todayState = dayState;

    dateEl.textContent = formatDateLabel(new Date());
    const weekday = PontoCalc.getWeekdayName(new Date());
    greetingEl.textContent = 'Hoje é ' + weekday;
    metaEl.textContent = dayState.holiday && dayState.holiday.nome ? 'Feriado: ' + dayState.holiday.nome : 'Jornada do dia';

    if (!dayState.available || dayState.status === 'FOLGA' || dayState.status === 'Feriado') {
      badge.textContent = dayState.status === 'Feriado' ? 'Feriado' : dayState.status || 'Folga';
      badge.className = 'status-badge ' + (dayState.status === 'Feriado' ? 'badge-holiday' : 'badge-off');
    } else if (dayState.nextAction === 'FINALIZADO') {
      badge.textContent = 'Completo';
      badge.className = 'status-badge badge-complete';
    } else {
      badge.textContent = 'Pendente';
      badge.className = 'status-badge badge-pending';
    }

    if (dayState.nextAction === 'ENTRADA') {
      punchBtn.textContent = 'Registrar entrada';
      punchBtn.className = 'punch-btn btn-entrada';
    } else if (dayState.nextAction === 'SAIDA_CAFE') {
      punchBtn.textContent = 'Registrar saída para café';
      punchBtn.className = 'punch-btn btn-cafe';
    } else if (dayState.nextAction === 'VOLTA_CAFE') {
      punchBtn.textContent = 'Registrar volta do café';
      punchBtn.className = 'punch-btn btn-cafe';
    } else if (dayState.nextAction === 'SAIDA') {
      punchBtn.textContent = 'Registrar saída';
      punchBtn.className = 'punch-btn btn-exit';
    } else {
      punchBtn.textContent = 'Hoje concluído';
      punchBtn.className = 'punch-btn btn-complete';
      punchBtn.disabled = true;
    }

    if (punchBtn.disabled === false || punchBtn.hasAttribute('disabled')) {
      punchBtn.disabled = false;
    }

    const ordered = ['entrada', 'saidaCafe', 'voltaCafe', 'saida'];
    const records = ordered
      .filter(function (field) { return dayState[field]; })
      .map(function (field) {
        const labelMap = {
          entrada: 'Entrada',
          saidaCafe: 'Saída para café',
          voltaCafe: 'Volta do café',
          saida: 'Saída'
        };
        return { label: labelMap[field], time: dayState[field] };
      });

    listEl.innerHTML = '';
    if (!records.length) {
      listEl.innerHTML = '<div class="empty-state">Nenhum ponto registrado hoje.</div>';
      lastRecord.textContent = 'Nenhum registro ainda';
    } else {
      records.forEach(function (record) {
        const row = document.createElement('div');
        row.className = 'record-item';
        row.innerHTML = '<span>' + record.label + '</span><strong>' + record.time + '</strong>';
        listEl.appendChild(row);
      });
      const last = records[records.length - 1];
      lastRecord.textContent = last.label + ': ' + last.time;
    }

    metricPrevisto.textContent = PontoCalc.minutesToText(dayState.predictedMinutes || 0);
    metricTrabalhado.textContent = PontoCalc.minutesToText(dayState.totalWorkedMinutes || 0);
    metricSaldo.textContent = PontoCalc.minutesToText((dayState.totalWorkedMinutes || 0) - (dayState.predictedMinutes || 0));
    metricStatus.textContent = dayState.status || 'Pendente';

    if (holidayRow) {
      const isHoliday = !!(dayState.holiday && !dayState.holiday.trabalha);
      holidayRow.classList.toggle('hidden', !isHoliday);
    }

    if (confirmation) {
      confirmation.classList.add('hidden');
    }
  }

  function renderCalendarGrid() {
    const grid = document.getElementById('cal-grid');
    if (!grid) return;
    const currentMonth = new Date(state.monthDate.getFullYear(), state.monthDate.getMonth(), 1);
    const title = document.getElementById('cal-title');
    if (title) {
      title.textContent = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(currentMonth);
    }

    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const offset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const totalDays = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const cells = [];
    const weekdayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    weekdayNames.forEach(function (label) {
      const el = document.createElement('div');
      el.className = 'cal-weekday';
      el.textContent = label;
      cells.push(el);
    });

    const blankCount = offset;
    for (let i = 0; i < blankCount; i += 1) {
      const el = document.createElement('div');
      el.className = 'cal-day empty';
      el.disabled = true;
      cells.push(el);
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const key = formatDateKey(date);
      const stateDay = getDayState(key);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-day';
      btn.textContent = String(day);
      btn.dataset.dateKey = key;

      if (stateDay.nextAction === 'FINALIZADO') btn.classList.add('complete');
      else if (stateDay.status === 'Feriado' || stateDay.nextAction === 'FERIADO') btn.classList.add('feriado');
      else if (stateDay.status === 'FOLGA' || stateDay.nextAction === 'FOLGA') btn.classList.add('off');
      else if (stateDay.nextAction && stateDay.nextAction !== 'ENTRADA') btn.classList.add('pending');
      else if (!stateDay.available) btn.classList.add('danger');

      btn.addEventListener('click', function () {
        state.selectedDate = date;
        showDayModal(key);
      });
      cells.push(btn);
    }

    grid.innerHTML = '';
    cells.forEach(function (node) { grid.appendChild(node); });
  }

  function renderHistoryTable() {
    const tbody = document.getElementById('hist-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const year = state.monthDate.getFullYear();
    const month = state.monthDate.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const rows = [];

    for (let day = 1; day <= lastDay; day += 1) {
      const date = new Date(year, month, day);
      const key = formatDateKey(date);
      const dayState = getDayState(key);
      if (!dayState || (!dayState.entrada && !dayState.saidaCafe && !dayState.voltaCafe && !dayState.saida && !dayState.schedule)) continue;

      const status = dayState.status || 'Pendente';
      const total = PontoCalc.minutesToText(dayState.totalWorkedMinutes || 0);
      const row = document.createElement('tr');
      row.innerHTML = '<td>' + key + '</td><td>' + (dayState.entrada || '—') + '</td><td>' + (dayState.saidaCafe || '—') + '</td><td>' + (dayState.voltaCafe || '—') + '</td><td>' + (dayState.saida || '—') + '</td><td>' + total + '</td><td>' + status + '</td><td><button type="button" class="table-detail-btn" data-date-key="' + key + '">Ver</button></td>';
      tbody.appendChild(row);
      const btn = row.querySelector('.table-detail-btn');
      if (btn) {
        btn.addEventListener('click', function () {
          showDayModal(key);
        });
      }
    }

    if (!tbody.children.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhum registro neste mês.</td></tr>';
    }
  }

  function showDayModal(dateKey) {
    const modal = document.getElementById('modal-day');
    if (!modal) return;
    const dayState = getDayState(dateKey);
    const dateLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(dateKey + 'T12:00:00'));
    document.getElementById('day-modal-date').textContent = dateLabel;
    document.getElementById('day-modal-status').textContent = dayState.status || 'Pendente';
    document.getElementById('day-modal-status').className = 'status-badge badge-pending mb-12';
    document.getElementById('day-modal-worked').textContent = PontoCalc.minutesToText(dayState.totalWorkedMinutes || 0);
    document.getElementById('day-modal-planned').textContent = PontoCalc.minutesToText(dayState.predictedMinutes || 0);
    document.getElementById('day-modal-saldo').textContent = PontoCalc.minutesToText((dayState.totalWorkedMinutes || 0) - (dayState.predictedMinutes || 0));

    const recordsBox = document.getElementById('day-modal-records');
    recordsBox.innerHTML = '';
    const ordered = ['entrada', 'saidaCafe', 'voltaCafe', 'saida'];
    ordered.forEach(function (field) {
      if (!dayState[field]) return;
      const item = document.createElement('div');
      item.className = 'record-item';
      item.innerHTML = '<span>' + (field === 'entrada' ? 'Entrada' : field === 'saidaCafe' ? 'Saída para café' : field === 'voltaCafe' ? 'Volta do café' : 'Saída') + '</span><strong>' + dayState[field] + '</strong>';
      recordsBox.appendChild(item);
    });

    if (!recordsBox.children.length) {
      recordsBox.innerHTML = '<div class="empty-state">Nenhum registro para este dia.</div>';
    }

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function renderSettings() {
    const config = state.config || {};
    document.getElementById('cfg-nome').value = config.nome || '';
    document.getElementById('cfg-empresa').value = config.empresa || '';
    document.getElementById('cfg-cnpj').value = config.cnpj || '';
    document.getElementById('cfg-atividade').value = config.atividade || '';
    document.getElementById('cfg-endereco').value = config.endereco || '';
    document.getElementById('cfg-cargo').value = config.cargo || '';

    const tbody = document.getElementById('schedule-tbody');
    if (tbody) {
      tbody.innerHTML = '';
      const ordered = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
      ordered.forEach(function (dayName) {
        const item = state.schedule && state.schedule[dayName] ? state.schedule[dayName] : { trabalha: false, entrada: '', saidaCafe: '', voltaCafe: '', saida: '' };
        const row = document.createElement('tr');
        row.innerHTML = [
          '<td>' + dayName + '</td>',
          '<td><input type="checkbox" data-day="' + dayName + '" data-field="trabalha" ' + (item.trabalha ? 'checked' : '') + ' /></td>',
          '<td><input type="time" data-day="' + dayName + '" data-field="entrada" value="' + (item.entrada || '') + '" /></td>',
          '<td><input type="time" data-day="' + dayName + '" data-field="saidaCafe" value="' + (item.saidaCafe || '') + '" /></td>',
          '<td><input type="time" data-day="' + dayName + '" data-field="voltaCafe" value="' + (item.voltaCafe || '') + '" /></td>',
          '<td><input type="time" data-day="' + dayName + '" data-field="saida" value="' + (item.saida || '') + '" /></td>'
        ].join('');
        tbody.appendChild(row);
      });
    }

    const holidayList = document.getElementById('holiday-list');
    if (holidayList) {
      holidayList.innerHTML = '';
      const entries = Object.values(state.holidays || {});
      if (!entries.length) {
        holidayList.innerHTML = '<div class="empty-state">Nenhum feriado cadastrado.</div>';
        return;
      }
      entries.forEach(function (holiday) {
        const item = document.createElement('div');
        item.className = 'holiday-item';
        item.innerHTML = '<div><strong>' + safeText(holiday.nome, 'Feriado') + '</strong><span>' + safeText(holiday.data, '') + '</span></div><button type="button" class="btn btn-sm" data-delete-holiday="' + holiday.data + '">Excluir</button>';
        item.querySelector('button').addEventListener('click', function () {
          Api.deleteHoliday(holiday.data).then(function () { refreshData(); }).catch(function (error) { showToast(error.message || 'Erro ao excluir feriado', 'error'); });
        });
        holidayList.appendChild(item);
      });
    }
  }

  async function refreshData() {
    try {
      showLoader('Carregando dados...');
      setSyncStatus('Carregando');
      const [config, schedule, holidays] = await Promise.all([
        Api.getConfig(),
        Api.getSchedule(),
        Api.getHolidays()
      ]);
      state.config = config || {};
      state.schedule = schedule || {};
      state.holidays = holidays || {};
      const currentYear = state.monthDate.getFullYear();
      const currentMonth = state.monthDate.getMonth();
      const monthSummary = await Api.getMonth(currentYear, currentMonth);
      state.monthSummary = monthSummary || {};

      const dayMap = {};
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(currentYear, currentMonth, day);
        const dateKey = formatDateKey(date);
        try {
          const result = await Api.getDay(dateKey);
          dayMap[dateKey] = result || { dateKey, status: 'Pendente', nextAction: 'ENTRADA', available: true, totalWorkedMinutes: 0, predictedMinutes: 0 };
        } catch (error) {
          dayMap[dateKey] = { dateKey, status: 'Pendente', nextAction: 'ENTRADA', available: true, totalWorkedMinutes: 0, predictedMinutes: 0 };
        }
      }
      state.dayMap = dayMap;
      setSyncStatus('Sincronizado');
      renderToday();
      renderCalendarGrid();
      renderHistoryTable();
      renderSettings();
      renderClosingSummary();
    } catch (error) {
      console.error(error);
      setSyncStatus(error.message || 'Erro de conexão', true);
      showToast(error.message || 'Falha ao carregar dados', 'error');
    } finally {
      hideLoader();
    }
  }

  function renderClosingSummary() {
    const title = document.getElementById('closing-title');
    if (title) {
      title.textContent = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(state.monthDate);
    }

    const hero = document.getElementById('saldo-hero');
    const saldo = PontoCalc.minutesToText((state.monthSummary && state.monthSummary.totalWorked) ? Number(state.monthSummary.totalWorked) - Number(state.monthSummary.totalPlanned || 0) : 0);
    if (hero) {
      hero.classList.toggle('saldo-positive', Number(saldo.replace(':', '')) >= 0);
      hero.classList.toggle('saldo-negative', Number(saldo.replace(':', '')) < 0);
    }

    const closingSaldo = document.getElementById('closing-saldo');
    if (closingSaldo) {
      closingSaldo.textContent = saldo;
    }
  }

  function attachEvents() {
    document.querySelectorAll('.side-nav-item, .nav-item').forEach(function (button) {
      button.addEventListener('click', function () {
        setScreen(button.dataset.screen);
      });
    });

    document.querySelectorAll('.settings-tab').forEach(function (button) {
      button.addEventListener('click', function () {
        document.querySelectorAll('.settings-tab').forEach(function (tab) { tab.classList.toggle('active', tab === button); });
        document.querySelectorAll('.settings-panel').forEach(function (panel) { panel.classList.toggle('active', panel.id === 'settings-' + button.dataset.tab); });
      });
    });

    document.getElementById('punch-btn')?.addEventListener('click', async function () {
      const todayKey = formatDateKey(new Date());
      const todayState = getDayState(todayKey);
      const nextType = (todayState.nextAction || 'ENTRADA').toLowerCase();
      try {
        const actionMap = {
          entrada: 'entrada',
          saida_cafe: 'saidaCafe',
          volta_cafe: 'voltaCafe',
          saida: 'saida'
        };
        const resolved = actionMap[nextType] || 'entrada';
        await Api.registerPunch(resolved);
        await refreshData();
        const confirmation = document.getElementById('punch-confirmation');
        if (confirmation) {
          confirmation.classList.remove('hidden');
        }
      } catch (error) {
        showToast(error.message || 'Erro ao registrar ponto', 'error');
      }
    });

    document.getElementById('save-profile-btn')?.addEventListener('click', async function () {
      const config = {
        nome: document.getElementById('cfg-nome').value,
        empresa: document.getElementById('cfg-empresa').value,
        cnpj: document.getElementById('cfg-cnpj').value,
        atividade: document.getElementById('cfg-atividade').value,
        endereco: document.getElementById('cfg-endereco').value,
        cargo: document.getElementById('cfg-cargo').value
      };
      await Api.saveConfig(config);
      await refreshData();
      showToast('Perfil salvo', 'success');
    });

    document.getElementById('save-schedule-btn')?.addEventListener('click', async function () {
      const schedule = {};
      document.querySelectorAll('#schedule-tbody [data-day]').forEach(function (input) {
        const day = input.dataset.day;
        if (!schedule[day]) schedule[day] = {};
        const field = input.dataset.field;
        if (field === 'trabalha') {
          schedule[day][field] = input.checked;
        } else {
          schedule[day][field] = input.value;
        }
      });
      await Api.saveSchedule(schedule);
      await refreshData();
      showToast('Jornada salva', 'success');
    });

    document.getElementById('save-holiday-btn')?.addEventListener('click', async function () {
      const date = document.getElementById('holiday-date').value;
      const nome = document.getElementById('holiday-nome').value;
      const trabalha = document.getElementById('holiday-trabalha').checked;
      if (!date) {
        showToast('Selecione uma data', 'error');
        return;
      }
      await Api.saveHoliday(date, nome || 'Feriado', trabalha);
      document.getElementById('holiday-date').value = '';
      document.getElementById('holiday-nome').value = '';
      document.getElementById('holiday-trabalha').checked = false;
      await refreshData();
      showToast('Feriado salvo', 'success');
    });

    document.getElementById('cal-prev-btn')?.addEventListener('click', function () {
      state.monthDate = new Date(state.monthDate.getFullYear(), state.monthDate.getMonth() - 1, 1);
      renderCalendarGrid();
      renderHistoryTable();
      renderClosingSummary();
    });

    document.getElementById('cal-next-btn')?.addEventListener('click', function () {
      state.monthDate = new Date(state.monthDate.getFullYear(), state.monthDate.getMonth() + 1, 1);
      renderCalendarGrid();
      renderHistoryTable();
      renderClosingSummary();
    });

    document.getElementById('hist-prev-btn')?.addEventListener('click', function () {
      state.monthDate = new Date(state.monthDate.getFullYear(), state.monthDate.getMonth() - 1, 1);
      renderHistoryTable();
      renderClosingSummary();
    });

    document.getElementById('hist-next-btn')?.addEventListener('click', function () {
      state.monthDate = new Date(state.monthDate.getFullYear(), state.monthDate.getMonth() + 1, 1);
      renderHistoryTable();
      renderClosingSummary();
    });

    document.getElementById('closing-prev-btn')?.addEventListener('click', function () {
      state.monthDate = new Date(state.monthDate.getFullYear(), state.monthDate.getMonth() - 1, 1);
      renderClosingSummary();
      renderCalendarGrid();
    });

    document.getElementById('closing-next-btn')?.addEventListener('click', function () {
      state.monthDate = new Date(state.monthDate.getFullYear(), state.monthDate.getMonth() + 1, 1);
      renderClosingSummary();
      renderCalendarGrid();
    });

    document.querySelectorAll('[data-close-modal]').forEach(function (button) {
      button.addEventListener('click', function () {
        closeModal(button.dataset.closeModal);
      });
    });

    window.addEventListener('click', function (event) {
      const modal = document.getElementById('modal-day');
      if (modal && event.target === modal) {
        closeModal('modal-day');
      }
    });
  }

  async function init() {
    attachEvents();
    setScreen('today');
    updateTodayClock();
    setInterval(updateTodayClock, 1000);
    await refreshData();
    state.initialized = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
