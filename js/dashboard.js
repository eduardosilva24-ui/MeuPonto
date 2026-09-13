(function () {
  function renderDashboardSummary(monthData, dateKey) {
    const hero = document.getElementById('closing-saldo');
    const message = document.getElementById('closing-saldo-message');
    const progressFill = document.getElementById('closing-progress-fill');
    const progressLabel = document.getElementById('closing-progress-label');
    const expected = document.getElementById('closing-previstas');
    const worked = document.getElementById('closing-trabalhadas');
    const diasTrabalhados = document.getElementById('closing-dias-trabalhados');
    const diasRestantes = document.getElementById('closing-dias-restantes');
    const diasIncompletos = document.getElementById('closing-dias-incompletos');
    const faltantes = document.getElementById('closing-horas-faltantes');
    const extras = document.getElementById('closing-horas-extras');
    const folga = document.getElementById('closing-dias-folga');
    const feriado = document.getElementById('closing-dias-feriado');
    const mes = document.getElementById('closing-dias-mes');

    if (!monthData) return;

    const planned = Number(monthData.totalPlanned || 0);
    const workedMinutes = Number(monthData.totalWorked || 0);
    const saldo = workedMinutes - planned;
    const progressRatio = planned > 0 ? Math.min((workedMinutes / planned) * 100, 100) : 0;

    hero.textContent = PontoCalc.minutesToText(saldo);
    hero.parentElement.classList.toggle('saldo-positive', saldo >= 0);
    hero.parentElement.classList.toggle('saldo-negative', saldo < 0);
    message.textContent = saldo >= 0 ? 'Você está em saldo positivo.' : 'Você ainda está abaixo do esperado.';
    progressFill.style.width = progressRatio + '%';
    progressLabel.textContent = PontoCalc.minutesToText(workedMinutes) + ' / ' + PontoCalc.minutesToText(planned);

    expected.textContent = PontoCalc.minutesToText(planned);
    worked.textContent = PontoCalc.minutesToText(workedMinutes);
    diasTrabalhados.textContent = String(monthData.countDaysWorked || 0);
    diasRestantes.textContent = String(Math.max((monthData.daysInMonth || 0) - (monthData.countDaysWorked || 0), 0));
    diasIncompletos.textContent = String(monthData.countIncomplete || 0);
    faltantes.textContent = PontoCalc.minutesToText(Math.max(-saldo, 0));
    extras.textContent = PontoCalc.minutesToText(Math.max(saldo, 0));
    folga.textContent = '0';
    feriado.textContent = '0';
    mes.textContent = monthData.daysInMonth ? monthData.daysInMonth + ' dias' : '—';
  }

  window.PontoDashboard = {
    renderDashboardSummary
  };
})();
