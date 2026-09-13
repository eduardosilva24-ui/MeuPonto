// ─── Meu Ponto — print.js ────────────────────────────────────────────────────
// Geração da folha de ponto A4 para impressão / PDF
// ─────────────────────────────────────────────────────────────────────────────

const Print = (() => {

  /**
   * Gera o HTML da folha de ponto A4 e injeta em #print-view
   * @param {Object} monthData  - dados do mês (calendar, config, summary)
   * @param {number} year
   * @param {number} monthIndex - 0-based
   */
  function generatePrintView(monthData, year, monthIndex) {
    const config   = monthData.config   || {};
    const summary  = monthData.summary  || {};
    const calendar = (monthData.calendar || []).filter(Boolean);

    const monthName = Calc.MONTH_NAMES[monthIndex];
    const hoje      = new Date();
    const geradoEm  = `${String(hoje.getDate()).padStart(2,'0')}/${String(hoje.getMonth()+1).padStart(2,'0')}/${hoje.getFullYear()}`;

    // Filtra apenas dias que devem aparecer na folha:
    // dias úteis (trabalha=true) + dias que têm registros (mesmo que folga)
    const rows = calendar.filter(day => {
      const hasRecords = day.entradas && (day.entradas.entrada || day.entradas.saida);
      const isWorkDay  = day.available || hasRecords;
      return isWorkDay;
    });

    const tableRows = rows.map(day => {
      const e  = day.entradas || {};
      const dateDisplay = Calc.formatDateKey(day.dateKey);

      // Abreviação do dia da semana
      const weekdayMap = {
        'Segunda': 'Seg', 'Terça': 'Ter', 'Quarta': 'Qua',
        'Quinta': 'Qui', 'Sexta': 'Sex', 'Sábado': 'Sáb', 'Domingo': 'Dom'
      };
      const dow = weekdayMap[day.weekday] || day.weekday;

      const statusText = day.nextAction === 'FINALIZADO' ? '✓'
        : day.nextAction === 'FERIADO'   ? 'Feriado'
        : day.nextAction === 'FOLGA'     ? 'Folga'
        : e.entrada                      ? '...'
        : '—';

      return `<tr>
        <td>${dateDisplay} ${dow}</td>
        <td>${e.entrada    || ''}</td>
        <td>${e.saidaCafe  || ''}</td>
        <td>${e.voltaCafe  || ''}</td>
        <td>${e.saida      || ''}</td>
        <td>${day.hoursWorked && day.hoursWorked !== '00:00' ? day.hoursWorked : ''}</td>
        <td class="assinatura"></td>
      </tr>`;
    }).join('');

    const html = `
      <div class="print-header">
        <div class="print-title">FOLHA DE PONTO</div>
        <div class="print-subtitle">Registro de Frequência</div>
      </div>

      <div class="print-info-grid">
        <div class="print-info-row">
          <span class="print-info-label">Empresa:</span>
          <span class="print-info-value">${config.empresa || ''}</span>
        </div>
        <div class="print-info-row">
          <span class="print-info-label">Mês/Ano:</span>
          <span class="print-info-value">${monthName} / ${year}</span>
        </div>
        <div class="print-info-row">
          <span class="print-info-label">Funcionário:</span>
          <span class="print-info-value">${config.nome || ''}</span>
        </div>
        <div class="print-info-row">
          <span class="print-info-label">Cargo:</span>
          <span class="print-info-value">${config.cargo || ''}</span>
        </div>
      </div>

      <table class="print-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Entrada</th>
            <th>Saída Café</th>
            <th>Retorno</th>
            <th>Saída</th>
            <th>Total</th>
            <th>Assinatura</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="5" style="text-align:right; padding-right:8px;">TOTAIS DO MÊS</td>
            <td>${summary.horasTrabalhadas || '00:00'}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <div style="margin-top:8mm; font-size:8pt; color:#444;">
        <strong>Horas previstas:</strong> ${summary.horasPrevistas || '—'} &nbsp;|&nbsp;
        <strong>Horas trabalhadas:</strong> ${summary.horasTrabalhadas || '—'} &nbsp;|&nbsp;
        <strong>Saldo:</strong> ${summary.saldo || '—'} &nbsp;|&nbsp;
        <strong>Dias trabalhados:</strong> ${summary.daysWorked || '—'}
      </div>

      <div class="print-footer">
        <div>Gerado em: ${geradoEm} pelo Meu Ponto</div>
        <div class="print-sign-line">
          _______________________________<br>
          Assinatura do responsável
        </div>
      </div>
    `;

    document.getElementById('print-view').innerHTML = html;
  }

  /** Dispara a impressão do navegador */
  function print(monthData, year, monthIndex) {
    generatePrintView(monthData, year, monthIndex);
    setTimeout(() => window.print(), 150);
  }

  return { generatePrintView, print };
})();

window.Print = Print;
