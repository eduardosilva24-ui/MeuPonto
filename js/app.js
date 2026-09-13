// ─── Meu Ponto — app.js ──────────────────────────────────────────────────────
// Controller principal — gerencia estado, navegação e todas as telas
// ─────────────────────────────────────────────────────────────────────────────

const App = (() => {

  // ─── Estado global ──────────────────────────────────────────────────────────

  const state = {
    config:      {},
    schedule:    {},
    holidays:    {},
    today:       null,
    monthData:   null,
    currentYear:  new Date().getFullYear(),
    currentMonth: new Date().getMonth(),   // 0-based
    histYear:     new Date().getFullYear(),
    histMonth:    new Date().getMonth(),
    activeScreen: 'today',
    settingsTab:  'profile',
    loading:      false,
  };

  // ─── Utilitários de UI ───────────────────────────────────────────────────────

  function showLoader(msg = 'Carregando...') {
    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('loader-text').textContent = msg;
  }

  function hideLoader() {
    document.getElementById('loader').classList.add('hidden');
  }

  function toast(msg, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), duration);
  }

  function openModal(id) {
    document.getElementById(id).classList.add('open');
  }

  function closeModal(id) {
    document.getElementById(id).classList.remove('open');
  }

  // ─── Navegação ───────────────────────────────────────────────────────────────

  function navigate(screen) {
    state.activeScreen = screen;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item, .side-nav-item').forEach(n => {
      n.classList.toggle('active', n.dataset.screen === screen);
    });
    const el = document.getElementById(`screen-${screen}`);
    if (el) el.classList.add('active');

    if (screen === 'today')    renderToday();
    if (screen === 'calendar') renderCalendarScreen();
    if (screen === 'history')  renderHistory();
    if (screen === 'closing')  renderClosing();
    if (screen === 'settings') renderSettings();
  }

  // ─── Tela: HOJE ─────────────────────────────────────────────────────────────

  function renderToday() {
    const today = state.today;
    if (!today) return;

    // Data e cabeçalho
    document.getElementById('today-date').textContent = Calc.formatDateFull(today.dateKey, today.weekday);
    const jornada = today.schedule;
    const jornadaStr = jornada && jornada.trabalha && jornada.entrada && jornada.saida
      ? `Jornada prevista: ${jornada.entrada} → ${jornada.saida}`
      : today.available ? 'Jornada definida' : 'Dia de folga ou feriado';
    document.getElementById('today-meta').innerHTML = jornadaStr;

    // Badge de status
    const badgeEl = document.getElementById('today-status-badge');
    const action  = today.nextAction;
    const badges  = {
      FINALIZADO:  ['badge-complete', '✅ Ponto completo'],
      ENTRADA:     ['badge-pending',  '⏳ Aguardando entrada'],
      SAIDA_CAFE:  ['badge-pending',  '⏳ Saída café pendente'],
      VOLTA_CAFE:  ['badge-pending',  '⏳ Retorno café pendente'],
      SAIDA:       ['badge-pending',  '⏳ Saída pendente'],
      FOLGA:       ['badge-folga',    '😴 Folga'],
      FERIADO:     ['badge-feriado',  '🎉 Feriado'],
    };
    const [badgeClass, badgeText] = badges[action] || ['badge-pending', '—'];
    badgeEl.className = `status-badge ${badgeClass}`;
    badgeEl.textContent = badgeText;

    // Se feriado com opção de trabalhar
    const feriadoRow = document.getElementById('feriado-trabalhar-row');
    if (today.holiday && !today.holiday.trabalha) {
      feriadoRow.classList.remove('hidden');
      document.getElementById('feriado-nome').textContent = today.holiday.nome;
    } else {
      feriadoRow.classList.add('hidden');
    }

    // Registros do dia
    renderRecords(today);

    // Botão principal
    renderPunchButton(today);

    // Métricas
    const predicted = today.predictedMinutes || 0;
    const worked    = today.totalWorkedMinutes || 0;
    const saldo     = worked - predicted;

    document.getElementById('metric-previsto').textContent  = predicted ? Calc.minutesToText(predicted) : '—';
    document.getElementById('metric-trabalhado').textContent = Calc.minutesToText(worked);
    const saldoEl = document.getElementById('metric-saldo');
    saldoEl.textContent = Calc.minutesToText(saldo);
    saldoEl.className   = `metric-value ${saldo >= 0 ? 'positive' : 'negative'}`;
    document.getElementById('metric-status').textContent = action === 'FINALIZADO' ? 'Completo' : action === 'FOLGA' ? 'Folga' : action === 'FERIADO' ? 'Feriado' : 'Em andamento';
  }

  function renderRecords(today) {
    const e = today.entradas || {};
    const records = [
      { key: 'Entrada',    label: 'Entrada',         value: e.entrada,    field: 'Entrada'   },
      { key: 'SaidaCafe',  label: 'Saída para café', value: e.saidaCafe,  field: 'SaidaCafe' },
      { key: 'VoltaCafe',  label: 'Volta do café',   value: e.voltaCafe,  field: 'VoltaCafe' },
      { key: 'Saida',      label: 'Saída',           value: e.saida,      field: 'Saida'     },
    ];

    const container = document.getElementById('record-list');
    container.innerHTML = records.map(r => `
      <div class="record-row">
        <span class="record-label">${r.label}</span>
        <div class="flex items-center gap-8">
          <span class="record-value ${r.value ? '' : 'empty'}">${r.value || 'Não registrado'}</span>
          ${r.value ? `<span class="record-check">✓</span>` : ''}
          ${r.value ? `<button class="record-edit-btn" onclick="App.openEditModal('${today.dateKey}','${r.field}','${r.value}')">Editar</button>` : ''}
        </div>
      </div>
    `).join('');
  }

  function renderPunchButton(today) {
    const btn    = document.getElementById('punch-btn');
    const action = today.nextAction;
    const isActionable = !['FOLGA', 'FERIADO', 'FINALIZADO'].includes(action);

    btn.className = `punch-btn ${Calc.getActionClass(action)}`;
    btn.disabled  = !isActionable;

    const icon = { ENTRADA:'⏰', SAIDA_CAFE:'☕', VOLTA_CAFE:'🔙', SAIDA:'🏁',
                   FINALIZADO:'✅', FOLGA:'😴', FERIADO:'🎉' };
    const label = {
      ENTRADA:    'REGISTRAR ENTRADA',
      SAIDA_CAFE: 'SAIR PARA O CAFÉ',
      VOLTA_CAFE: 'VOLTAR DO CAFÉ',
      SAIDA:      'REGISTRAR SAÍDA',
      FINALIZADO: 'PONTO FINALIZADO',
      FOLGA:      'DIA DE FOLGA',
      FERIADO:    'FERIADO',
    };

    // Horário atual exibido
    const now = new Date();
    const timeStr = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');

    btn.innerHTML = `
      <span class="btn-icon">${icon[action] || '⏰'}</span>
      <span>${label[action] || 'REGISTRAR'}</span>
      ${isActionable ? `<span class="btn-time">${timeStr}</span>` : ''}
    `;

    btn.onclick = isActionable ? () => handlePunch(action) : null;
  }

  // Atualizar o relógio no botão a cada minuto
  function startClockUpdate() {
    setInterval(() => {
      if (state.activeScreen === 'today' && state.today) {
        const isActionable = !['FOLGA','FERIADO','FINALIZADO'].includes(state.today.nextAction);
        if (isActionable) {
          const now = new Date();
          const timeStr = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
          const timeEl = document.querySelector('#punch-btn .btn-time');
          if (timeEl) timeEl.textContent = timeStr;
        }
      }
    }, 30000); // Atualiza a cada 30s
  }

  async function handlePunch(action) {
    const type = Calc.actionToType(action);
    if (!type) return;

    const btn = document.getElementById('punch-btn');
    btn.disabled   = true;
    btn.innerHTML  = '<span class="btn-icon">⏳</span><span>Registrando...</span>';

    try {
      const updatedDay = await Api.registerPunch(type);
      state.today = updatedDay;

      // Atualizar no monthData também
      if (state.monthData && state.monthData.calendar) {
        const idx = state.monthData.calendar.findIndex(d => d && d.dateKey === updatedDay.dateKey);
        if (idx !== -1) state.monthData.calendar[idx] = updatedDay;
      }

      renderToday();
      toast(`✅ ${actionLabels[type] || 'Ponto'} registrado!`, 'success');
    } catch (err) {
      renderPunchButton(state.today);
      toast(`❌ ${err.message}`, 'error', 5000);
    }
  }

  const actionLabels = {
    entrada:    'Entrada',
    saidaCafe:  'Saída para café',
    voltaCafe:  'Volta do café',
    saida:      'Saída',
  };

  // ─── Modal: Editar Registro ──────────────────────────────────────────────────

  function openEditModal(dateKey, field, currentValue) {
    document.getElementById('edit-datekey').value   = dateKey;
    document.getElementById('edit-field').value     = field;
    document.getElementById('edit-value').value     = currentValue || '';
    document.getElementById('edit-motivo').value    = '';

    const fieldLabels = { Entrada:'Entrada', SaidaCafe:'Saída para café', VoltaCafe:'Volta do café', Saida:'Saída' };
    document.getElementById('edit-field-label').textContent = `Editando: ${fieldLabels[field] || field} — ${Calc.formatDateKey(dateKey)}`;
    openModal('modal-edit');
  }

  async function handleEditSave() {
    const dateKey = document.getElementById('edit-datekey').value;
    const field   = document.getElementById('edit-field').value;
    const value   = document.getElementById('edit-value').value.trim();
    const motivo  = document.getElementById('edit-motivo').value.trim() || 'Correção manual';

    if (!value || !/^\d{2}:\d{2}$/.test(value)) {
      toast('❌ Horário inválido. Use o formato HH:MM.', 'error');
      return;
    }

    try {
      showLoader('Salvando correção...');
      const updatedDay = await Api.editRecord(dateKey, field, value, motivo);

      // Atualizar estado
      if (updatedDay.dateKey === state.today?.dateKey) {
        state.today = updatedDay;
      }
      if (state.monthData?.calendar) {
        const idx = state.monthData.calendar.findIndex(d => d && d.dateKey === updatedDay.dateKey);
        if (idx !== -1) state.monthData.calendar[idx] = updatedDay;
      }

      closeModal('modal-edit');
      hideLoader();
      toast('✅ Registro corrigido com sucesso!', 'success');

      if (state.activeScreen === 'today') renderToday();
      if (state.activeScreen === 'history') renderHistory();
      if (state.activeScreen === 'calendar') renderCalendarScreen();
    } catch (err) {
      hideLoader();
      toast(`❌ ${err.message}`, 'error', 5000);
    }
  }

  // ─── Modal: Detalhe do dia (calendário) ──────────────────────────────────────

  function openDayModal(dayData) {
    if (!dayData) return;
    const e = dayData.entradas || {};

    document.getElementById('day-modal-date').textContent = Calc.formatDateFull(dayData.dateKey, dayData.weekday);
    document.getElementById('day-modal-status').textContent = dayData.nextAction === 'FINALIZADO' ? '✅ Ponto completo'
      : dayData.nextAction === 'FOLGA' ? '😴 Folga'
      : dayData.nextAction === 'FERIADO' ? `🎉 Feriado — ${dayData.holiday?.nome || ''}`
      : '⏳ Incompleto';

    const rows = [
      ['Entrada',         e.entrada   ],
      ['Saída para café', e.saidaCafe ],
      ['Volta do café',   e.voltaCafe ],
      ['Saída',           e.saida     ],
    ];

    document.getElementById('day-modal-records').innerHTML = rows.map(([label, val]) => `
      <div class="record-row">
        <span class="record-label">${label}</span>
        <div class="flex items-center gap-8">
          <span class="record-value ${val ? '' : 'empty'}">${val || '—'}</span>
          ${val ? '<span class="record-check">✓</span>' : ''}
        </div>
      </div>
    `).join('');

    document.getElementById('day-modal-worked').textContent  = dayData.hoursWorked || '—';
    document.getElementById('day-modal-planned').textContent = dayData.predictedMinutes ? Calc.minutesToText(dayData.predictedMinutes) : '—';
    const saldo = (dayData.totalWorkedMinutes || 0) - (dayData.predictedMinutes || 0);
    const saldoEl = document.getElementById('day-modal-saldo');
    saldoEl.textContent = Calc.minutesToText(saldo);
    saldoEl.className   = `metric-value ${saldo >= 0 ? 'positive' : 'negative'}`;

    // Botões de edição
    const editBtnsEl = document.getElementById('day-modal-edit-btns');
    editBtnsEl.innerHTML = '';
    if (dayData.available || e.entrada) {
      [
        ['Entrada','Entrada',e.entrada], ['Saída Café','SaidaCafe',e.saidaCafe],
        ['Volta Café','VoltaCafe',e.voltaCafe], ['Saída','Saida',e.saida]
      ].forEach(([lbl, field, val]) => {
        if (val) {
          const b = document.createElement('button');
          b.className = 'btn btn-sm';
          b.textContent = `Editar ${lbl}`;
          b.onclick = () => {
            closeModal('modal-day');
            openEditModal(dayData.dateKey, field, val);
          };
          editBtnsEl.appendChild(b);
        }
      });
    }

    openModal('modal-day');
  }

  // ─── Tela: CALENDÁRIO ────────────────────────────────────────────────────────

  function renderCalendarScreen() {
    const monthData = state.monthData;
    if (!monthData) return;

    const y = state.currentYear;
    const m = state.currentMonth;

    document.getElementById('cal-title').textContent = `${Calc.MONTH_NAMES[m]} ${y}`;
    document.getElementById('cal-nav-today-btn').classList.toggle(
      'hidden', y === new Date().getFullYear() && m === new Date().getMonth()
    );

    // Cabeçalho de dias
    const grid   = document.getElementById('cal-grid');
    const todayKey = Calc.getTodayKey();
    const calMap = {};
    (monthData.calendar || []).filter(Boolean).forEach(d => { calMap[d.dateKey] = d; });

    const cells = Calc.buildMonthGrid(y, m).map(dateKey => {
      if (!dateKey) return '<div class="cal-cell empty"></div>';
      const day = calMap[dateKey];
      const dn  = parseInt(dateKey.split('-')[2], 10);
      const isToday = dateKey === todayKey;
      let dot = 'off';
      if (day) {
        if (day.nextAction === 'FINALIZADO')       dot = 'complete';
        else if (day.nextAction === 'FERIADO')     dot = 'feriado';
        else if (day.nextAction === 'FOLGA')       dot = 'off';
        else if (day.available && day.entradas?.entrada) dot = 'pending';
        else if (day.available && dateKey < todayKey)    dot = 'danger';
        else                                              dot = 'off';
      }

      return `<div class="cal-cell${isToday ? ' today' : ''}" data-datekey="${dateKey}">
        <span class="cal-day-num">${dn}</span>
        <span class="cal-dot ${dot}"></span>
      </div>`;
    }).join('');

    grid.innerHTML = cells;

    grid.querySelectorAll('.cal-cell[data-datekey]').forEach(cell => {
      cell.addEventListener('click', () => {
        const dk  = cell.dataset.datekey;
        const day = calMap[dk];
        if (day) openDayModal(day);
      });
    });
  }

  function changeCalendarMonth(offset) {
    let m = state.currentMonth + offset;
    let y = state.currentYear;
    if (m < 0)  { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    state.currentMonth = m;
    state.currentYear  = y;
    loadMonthData(y, m).then(() => renderCalendarScreen());
  }

  // ─── Tela: HISTÓRICO ─────────────────────────────────────────────────────────

  function renderHistory() {
    const monthData = state.monthData;
    if (!monthData) return;

    document.getElementById('hist-title').textContent =
      `${Calc.MONTH_NAMES[state.currentMonth]} ${state.currentYear}`;

    const tbody = document.getElementById('hist-tbody');
    const rows  = (monthData.calendar || []).filter(Boolean);

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding:20px;">Sem registros neste mês.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(day => {
      const e       = day.entradas || {};
      const statusMap = {
        FINALIZADO: ['badge-complete','Completo'],
        FOLGA:      ['badge-folga','Folga'],
        FERIADO:    ['badge-feriado','Feriado'],
        ENTRADA:    ['badge-danger','Sem entrada'],
      };
      const [badgeClass, statusText] = statusMap[day.nextAction]
        || ['badge-pending', 'Incompleto'];

      return `<tr>
        <td>${Calc.formatDateKey(day.dateKey)} <small class="text-muted">${(day.weekday||'').slice(0,3)}</small></td>
        <td>${e.entrada    || '—'}</td>
        <td>${e.saidaCafe  || '—'}</td>
        <td>${e.voltaCafe  || '—'}</td>
        <td>${e.saida      || '—'}</td>
        <td><strong>${day.hoursWorked && day.hoursWorked !== '00:00' ? day.hoursWorked : '—'}</strong></td>
        <td><span class="status-pill ${badgeClass}">${statusText}</span></td>
        <td><button class="hist-edit-btn" onclick="App.openDayModal(${JSON.stringify(JSON.stringify(day))})">Ver</button></td>
      </tr>`;
    }).join('');
  }

  // ─── Tela: FECHAMENTO ────────────────────────────────────────────────────────

  function renderClosing() {
    const monthData = state.monthData;
    if (!monthData) return;
    const s = monthData.summary || {};
    const y = state.currentYear;
    const m = state.currentMonth;

    document.getElementById('closing-title').textContent = `Fechamento — ${Calc.MONTH_NAMES[m]} ${y}`;
    document.getElementById('closing-previstas').textContent    = s.horasPrevistas    || '—';
    document.getElementById('closing-trabalhadas').textContent  = s.horasTrabalhadas  || '—';

    const saldoEl = document.getElementById('closing-saldo');
    saldoEl.textContent = s.saldo || '—';
    const saldoCard = document.getElementById('closing-saldo-card');
    saldoCard.className = `closing-stat ${(s.saldoMinutes || 0) >= 0 ? 'saldo-positive' : 'saldo-negative'}`;

    document.getElementById('closing-dias-trabalhados').textContent = s.daysWorked    || '0';
    document.getElementById('closing-dias-incompletos').textContent = s.daysIncomplete || '0';
    document.getElementById('closing-dias-folga').textContent      = s.daysFolga      || '0';
    document.getElementById('closing-dias-feriado').textContent    = s.daysFeriado    || '0';
    document.getElementById('closing-dias-mes').textContent        = s.daysInMonth    || '—';
  }

  // ─── Tela: CONFIGURAÇÕES ─────────────────────────────────────────────────────

  function renderSettings() {
    renderProfileForm();
    renderScheduleTable();
    renderHolidayList();
  }

  function renderProfileForm() {
    const c = state.config || {};
    document.getElementById('cfg-nome').value    = c.nome    || '';
    document.getElementById('cfg-empresa').value = c.empresa || '';
    document.getElementById('cfg-cargo').value   = c.cargo   || '';
  }

  function renderScheduleTable() {
    const days = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
    const tbody = document.getElementById('schedule-tbody');
    tbody.innerHTML = days.map(day => {
      const s = (state.schedule || {})[day] || {};
      const checked = s.trabalha ? 'checked' : '';
      const disabled = s.trabalha ? '' : 'disabled';
      return `<tr id="sched-row-${day}">
        <td><strong>${day}</strong></td>
        <td>
          <label class="toggle">
            <input type="checkbox" ${checked} onchange="App.toggleScheduleDay('${day}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </td>
        <td><input type="time" class="sched-entrada"  value="${s.entrada   ||''}" ${disabled}></td>
        <td><input type="time" class="sched-saidacafe" value="${s.saidaCafe ||''}" ${disabled}></td>
        <td><input type="time" class="sched-voltacafe" value="${s.voltaCafe ||''}" ${disabled}></td>
        <td><input type="time" class="sched-saida"    value="${s.saida     ||''}" ${disabled}></td>
      </tr>`;
    }).join('');
  }

  function toggleScheduleDay(day, works) {
    const row = document.getElementById(`sched-row-${day}`);
    row.querySelectorAll('input[type="time"]').forEach(inp => {
      inp.disabled = !works;
      if (!works) inp.value = '';
    });
  }

  async function saveSchedule() {
    const days = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
    const schedule = {};
    days.forEach(day => {
      const row = document.getElementById(`sched-row-${day}`);
      const chk = row.querySelector('input[type="checkbox"]');
      schedule[day] = {
        trabalha:   chk.checked,
        entrada:    row.querySelector('.sched-entrada').value,
        saidaCafe:  row.querySelector('.sched-saidacafe').value,
        voltaCafe:  row.querySelector('.sched-voltacafe').value,
        saida:      row.querySelector('.sched-saida').value,
      };
    });
    try {
      showLoader('Salvando jornada...');
      state.schedule = await Api.saveSchedule(schedule);
      hideLoader();
      toast('✅ Jornada salva com sucesso!', 'success');
    } catch (err) {
      hideLoader();
      toast(`❌ ${err.message}`, 'error', 5000);
    }
  }

  async function saveProfile() {
    const config = {
      nome:    document.getElementById('cfg-nome').value.trim(),
      empresa: document.getElementById('cfg-empresa').value.trim(),
      cargo:   document.getElementById('cfg-cargo').value.trim(),
    };
    try {
      showLoader('Salvando perfil...');
      state.config = await Api.saveConfig(config);
      hideLoader();
      document.getElementById('topbar-user').textContent = state.config.nome || '';
      toast('✅ Perfil salvo com sucesso!', 'success');
    } catch (err) {
      hideLoader();
      toast(`❌ ${err.message}`, 'error', 5000);
    }
  }

  function renderHolidayList() {
    const holidays = state.holidays || {};
    const list = document.getElementById('holiday-list');
    const entries = Object.values(holidays).sort((a,b) => a.data.localeCompare(b.data));

    if (!entries.length) {
      list.innerHTML = '<p class="text-muted text-sm">Nenhum feriado cadastrado.</p>';
      return;
    }

    list.innerHTML = entries.map(h => `
      <div class="holiday-item">
        <div class="holiday-info">
          <div class="holiday-date">${Calc.formatDateKey(h.data)}</div>
          <div class="holiday-name">${h.nome}</div>
        </div>
        <span class="holiday-tag ${h.trabalha ? 'badge-pending' : 'badge-feriado'}">
          ${h.trabalha ? 'Trabalho' : 'Folga'}
        </span>
        <button class="holiday-del-btn" onclick="App.deleteHoliday('${h.data}')" title="Remover">✕</button>
      </div>
    `).join('');
  }

  async function saveHoliday() {
    const dateVal = document.getElementById('holiday-date').value;
    const nomeVal = document.getElementById('holiday-nome').value.trim();
    const trabalha = document.getElementById('holiday-trabalha').checked;

    if (!dateVal) { toast('❌ Informe a data do feriado.', 'error'); return; }
    if (!nomeVal) { toast('❌ Informe o nome do feriado.', 'error'); return; }

    // Converter "YYYY-MM-DD" do input date
    const dateKey = dateVal; // já está no formato correto

    try {
      showLoader('Salvando feriado...');
      state.holidays = await Api.saveHoliday(dateKey, nomeVal, trabalha);
      hideLoader();
      renderHolidayList();
      document.getElementById('holiday-date').value = '';
      document.getElementById('holiday-nome').value = '';
      document.getElementById('holiday-trabalha').checked = false;
      toast('✅ Feriado cadastrado!', 'success');
    } catch (err) {
      hideLoader();
      toast(`❌ ${err.message}`, 'error', 5000);
    }
  }

  async function deleteHoliday(dateKey) {
    if (!confirm(`Remover feriado de ${Calc.formatDateKey(dateKey)}?`)) return;
    try {
      showLoader('Removendo feriado...');
      state.holidays = await Api.deleteHoliday(dateKey);
      hideLoader();
      renderHolidayList();
      toast('✅ Feriado removido.', 'success');
    } catch (err) {
      hideLoader();
      toast(`❌ ${err.message}`, 'error', 5000);
    }
  }

  function switchSettingsTab(tab) {
    state.settingsTab = tab;
    document.querySelectorAll('.settings-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    document.querySelectorAll('.settings-panel').forEach(p => {
      p.classList.toggle('active', p.id === `settings-${tab}`);
    });
  }

  // ─── Carregamento de dados ────────────────────────────────────────────────────

  async function loadMonthData(year, month) {
    try {
      const data = await Api.getCalendar(year, month);
      state.monthData    = data;
      state.currentYear  = year;
      state.currentMonth = month;
      // Atualiza o "hoje" se o mês carregado for o mês atual
      const now = new Date();
      if (year === now.getFullYear() && month === now.getMonth()) {
        state.today = data.today;
      }
    } catch (err) {
      toast(`❌ Erro ao carregar mês: ${err.message}`, 'error', 6000);
    }
  }

  // ─── Inicialização ────────────────────────────────────────────────────────────

  async function init() {
    showLoader('Iniciando Meu Ponto...');

    try {
      const shell = await Api.getShell();
      state.config   = shell.config   || {};
      state.schedule = shell.schedule || {};
      state.holidays = shell.holidays || {};
      state.today    = shell.today    || null;

      // Exibir nome do usuário na topbar
      if (state.config.nome) {
        document.getElementById('topbar-user').textContent = state.config.nome;
      }

      // Carregar mês atual
      await loadMonthData(state.currentYear, state.currentMonth);

    } catch (err) {
      hideLoader();
      toast(`❌ Erro ao conectar: ${err.message}`, 'error', 8000);
      document.getElementById('today-date').textContent = 'Erro de conexão';
      document.getElementById('today-meta').textContent = 'Verifique se o Apps Script está publicado corretamente.';
      return;
    }

    hideLoader();
    navigate('today');
    startClockUpdate();
    setupEvents();
  }

  function setupEvents() {
    // Navegação bottom nav / side nav
    document.querySelectorAll('[data-screen]').forEach(el => {
      el.addEventListener('click', () => navigate(el.dataset.screen));
    });

    // Botões de navegação do calendário
    document.getElementById('cal-prev-btn').addEventListener('click', () => changeCalendarMonth(-1));
    document.getElementById('cal-next-btn').addEventListener('click', () => changeCalendarMonth(1));
    document.getElementById('cal-nav-today-btn').addEventListener('click', () => {
      const now = new Date();
      state.currentYear  = now.getFullYear();
      state.currentMonth = now.getMonth();
      loadMonthData(state.currentYear, state.currentMonth).then(() => renderCalendarScreen());
    });

    // Histórico: navegação
    document.getElementById('hist-prev-btn').addEventListener('click', () => {
      changeCalendarMonth(-1);
      renderHistory();
    });
    document.getElementById('hist-next-btn').addEventListener('click', () => {
      changeCalendarMonth(1);
      renderHistory();
    });

    // Fechar modais
    document.querySelectorAll('.modal-close, [data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.closeModal || btn.closest('.modal-overlay')?.id;
        if (target) closeModal(target);
      });
    });
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) closeModal(overlay.id);
      });
    });

    // Salvar edição
    document.getElementById('edit-save-btn').addEventListener('click', handleEditSave);

    // Configurações — tabs
    document.querySelectorAll('.settings-tab').forEach(t => {
      t.addEventListener('click', () => switchSettingsTab(t.dataset.tab));
    });

    // Salvar perfil
    document.getElementById('save-profile-btn').addEventListener('click', saveProfile);

    // Salvar jornada
    document.getElementById('save-schedule-btn').addEventListener('click', saveSchedule);

    // Feriados
    document.getElementById('save-holiday-btn').addEventListener('click', saveHoliday);

    // Impressão / PDF
    document.getElementById('print-btn-closing').addEventListener('click', () => {
      Print.print(state.monthData, state.currentYear, state.currentMonth);
    });
    document.getElementById('print-btn-hist').addEventListener('click', () => {
      Print.print(state.monthData, state.currentYear, state.currentMonth);
    });

    // Fechamento: navegação de mês
    document.getElementById('closing-prev-btn').addEventListener('click', () => {
      changeCalendarMonth(-1);
      renderClosing();
    });
    document.getElementById('closing-next-btn').addEventListener('click', () => {
      changeCalendarMonth(1);
      renderClosing();
    });

    // Trabalhar no feriado
    document.getElementById('feriado-trabalhar-btn').addEventListener('click', async () => {
      if (!state.today?.holiday) return;
      try {
        showLoader('Atualizando feriado...');
        state.holidays = await Api.saveHoliday(state.today.dateKey, state.today.holiday.nome, true);
        const updatedDay = await Api.getDayState(state.today.dateKey);
        state.today = updatedDay;
        hideLoader();
        renderToday();
        toast('✅ Modo "trabalho no feriado" ativado.', 'success');
      } catch (err) {
        hideLoader();
        toast(`❌ ${err.message}`, 'error');
      }
    });
  }

  // ─── API pública do módulo ────────────────────────────────────────────────────

  return {
    init,
    navigate,
    openEditModal,
    openDayModal: (dayJsonStr) => {
      try {
        const day = typeof dayJsonStr === 'string' ? JSON.parse(dayJsonStr) : dayJsonStr;
        openDayModal(day);
      } catch {}
    },
    toggleScheduleDay,
    deleteHoliday,
  };

})();

// Iniciar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => App.init());

window.App = App;
