(function () {
  function renderCalendar(date, dayMap, monthLabelId, gridId, onSelect) {
    const monthLabel = document.getElementById(monthLabelId);
    const grid = document.getElementById(gridId);
    if (!monthLabel || !grid) return;

    const viewDate = new Date(date.getFullYear(), date.getMonth(), 1);
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    monthLabel.textContent = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(viewDate);

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const offset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const totalCells = Math.ceil((offset + lastDay.getDate()) / 7) * 7;

    const fragment = document.createDocumentFragment();
    const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    dayNames.forEach(function (name) {
      const el = document.createElement('div');
      el.className = 'cal-weekday';
      el.textContent = name;
      fragment.appendChild(el);
    });

    for (let i = 0; i < totalCells; i += 1) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cal-day';
      const dayNumber = i - offset + 1;
      if (dayNumber <= 0 || dayNumber > lastDay.getDate()) {
        cell.classList.add('empty');
        cell.disabled = true;
      } else {
        const currentKey = PontoCalc.formatDateKey(new Date(year, month, dayNumber));
        const item = dayMap && dayMap[currentKey] ? dayMap[currentKey] : null;
        cell.textContent = String(dayNumber);
        cell.dataset.dateKey = currentKey;
        if (item) {
          if (item.nextAction === 'FINALIZADO') cell.classList.add('complete');
          else if (item.status === 'Feriado' || item.nextAction === 'FERIADO') cell.classList.add('feriado');
          else if (item.nextAction === 'FOLGA') cell.classList.add('off');
          else if (item.nextAction === 'ENTRADA' || item.nextAction === 'SAIDA_CAFE' || item.nextAction === 'VOLTA_CAFE' || item.nextAction === 'SAIDA') cell.classList.add('pending');
        }
        cell.addEventListener('click', function () {
          if (onSelect) onSelect(currentKey);
        });
      }
      fragment.appendChild(cell);
    }

    grid.innerHTML = '';
    grid.appendChild(fragment);
  }

  window.PontoCalendar = {
    renderCalendar
  };
})();
