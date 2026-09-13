// Geração do cartão formal A4. A mesma composição é usada para imprimir ou salvar como PDF.
const Print = (() => {
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
    }[char]));
  }

  function scheduleText(schedule) {
    const weekdays = ['Segunda', 'Terça', 'Quarta', 'Quinta'];
    const first = schedule[weekdays[0]] || {};
    const same = weekdays.every((day) => {
      const row = schedule[day] || {};
      return row.trabalha === first.trabalha && row.entrada === first.entrada && row.saida === first.saida;
    });
    if (same && first.trabalha) return `Segunda a quinta: ${first.entrada} às ${first.saida}`;
    return 'Conforme jornada cadastrada';
  }

  function saturdayText(schedule) {
    const saturday = schedule.Sábado || {};
    return saturday.trabalha ? `${saturday.entrada} às ${saturday.saida}` : 'Folga';
  }

  function statusCell(day) {
    if (day.nextAction === 'FOLGA' || day.nextAction === 'FERIADO') return 'X';
    return '';
  }

  function generatePrintView(monthData, year, monthIndex) {
    const config = monthData.config || {};
    const schedule = monthData.schedule || {};
    const summary = monthData.summary || {};
    const days = (monthData.calendar || []).filter(Boolean);
    const monthName = Calc.MONTH_NAMES[monthIndex].toUpperCase();
    const nowParts = Calc.getSaoPauloDateParts();
    const generatedAt = `${String(nowParts.day).padStart(2, '0')}/${String(nowParts.month).padStart(2, '0')}/${nowParts.year}`;

    const tableRows = days.map((day) => {
      const marks = day.entradas || {};
      const off = statusCell(day);
      const extra = Math.max((Number(day.totalWorkedMinutes) || 0) - (Number(day.predictedMinutes) || 0), 0);
      const dayNumber = Number(day.dateKey.split('-')[2]);
      const week = (day.weekday || '').slice(0, 3);
      return `<tr>
        <td class="print-day">${dayNumber} <small>${escapeHtml(week)}</small></td>
        <td>${escapeHtml(marks.entrada || off)}</td>
        <td>${escapeHtml(marks.saidaCafe || off)}</td>
        <td>${escapeHtml(marks.voltaCafe || off)}</td>
        <td>${escapeHtml(marks.saida || off)}</td>
        <td>${extra ? Calc.minutesToText(extra) : ''}</td>
        <td class="assinatura"></td>
      </tr>`;
    }).join('');

    const html = `
      <article class="print-document">
        <header class="print-header">
          <div class="print-title">FOLHA DE INDIVIDUAL DE PRESENÇA</div>
          <div class="print-subtitle">Cartão de ponto mensal</div>
        </header>

        <section class="print-info-grid">
          <div class="print-info-row"><span class="print-info-label">Empresa:</span><span class="print-info-value">${escapeHtml(config.empresa)}</span></div>
          <div class="print-info-row"><span class="print-info-label">CNPJ:</span><span class="print-info-value">${escapeHtml(config.cnpj)}</span></div>
          <div class="print-info-row print-info-wide"><span class="print-info-label">Endereço:</span><span class="print-info-value">${escapeHtml(config.endereco)}</span></div>
          <div class="print-info-row"><span class="print-info-label">Atividade:</span><span class="print-info-value">${escapeHtml(config.atividade)}</span></div>
          <div class="print-info-row"><span class="print-info-label">Funcionário:</span><span class="print-info-value">${escapeHtml(config.nome)}</span></div>
          <div class="print-info-row"><span class="print-info-label">Cargo:</span><span class="print-info-value">${escapeHtml(config.cargo)}</span></div>
          <div class="print-info-row"><span class="print-info-label">Jornada:</span><span class="print-info-value">${escapeHtml(scheduleText(schedule))}</span></div>
          <div class="print-info-row"><span class="print-info-label">Horário sábado:</span><span class="print-info-value">${escapeHtml(saturdayText(schedule))}</span></div>
          <div class="print-info-row"><span class="print-info-label">Mês:</span><span class="print-info-value">${monthName}</span></div>
          <div class="print-info-row"><span class="print-info-label">Ano:</span><span class="print-info-value">${year}</span></div>
        </section>

        <table class="print-table">
          <thead><tr>
            <th>DIA</th><th>ENTRADA</th><th>SAÍDA</th><th>ENTRADA</th><th>SAÍDA</th><th>HS EXTRA</th><th>ASSINATURA EMPREGADO</th>
          </tr></thead>
          <tbody>${tableRows}</tbody>
        </table>

        <section class="print-totals">
          <span><strong>Horas previstas:</strong> ${escapeHtml(summary.horasPrevistas || '00:00')}</span>
          <span><strong>Horas trabalhadas:</strong> ${escapeHtml(summary.horasTrabalhadas || '00:00')}</span>
          <span><strong>Saldo:</strong> ${escapeHtml(summary.saldo || '00:00')}</span>
        </section>

        <footer class="print-footer">
          <span>Folgas e feriados são identificados por “X”. Emitido em ${generatedAt}.</span>
          <span class="print-sign-line">Responsável</span>
        </footer>
      </article>`;

    document.getElementById('print-view').innerHTML = html;
  }

  function print(monthData, year, monthIndex) {
    generatePrintView(monthData, year, monthIndex);
    window.setTimeout(() => window.print(), 120);
  }

  return { generatePrintView, print };
})();

window.Print = Print;
