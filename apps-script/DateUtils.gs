const TZ = 'America/Sao_Paulo';

function pad2(value) {
  return String(value).padStart(2, '0');
}

function toDateKey(date) {
  return Utilities.formatDate(date, TZ, 'yyyy-MM-dd');
}

function parseDateKey(key) {
  var parts = String(key).split('-');
  if (parts.length < 3) {
    return new Date();
  }
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function getWeekdayName(date) {
  var weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return weekdays[date.getDay()];
}

function getMonthName(monthIndex) {
  var months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return months[monthIndex];
}

function getLastDayOfMonth(year, monthIndex) {
  var normalizedMonth = (monthIndex >= 0 && monthIndex <= 11) ? monthIndex : monthIndex - 1;
  return new Date(year, normalizedMonth + 1, 0).getDate();
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getMonthCalendar(year, monthIndex) {
  var firstDay = parseDateKey(year + '-' + pad2(monthIndex + 1) + '-01');
  var lastDay = getLastDayOfMonth(year, monthIndex);
  var calendar = [];
  var offset = (firstDay.getDay() + 6) % 7;

  for (var i = 0; i < offset; i += 1) {
    calendar.push(null);
  }

  for (var day = 1; day <= lastDay; day += 1) {
    calendar.push(parseDateKey(year + '-' + pad2(monthIndex + 1) + '-' + pad2(day)));
  }

  while (calendar.length % 7 !== 0) {
    calendar.push(null);
  }

  return calendar;
}

function addDays(date, amount) {
  var copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function minutesToText(totalMinutes) {
  var negative = totalMinutes < 0;
  var absolute = Math.abs(totalMinutes);
  var hours = Math.floor(absolute / 60);
  var minutes = absolute % 60;
  return (negative ? '-' : '') + pad2(hours) + ':' + pad2(minutes);
}

function toMinutes(value) {
  if (!value) {
    return 0;
  }
  var parts = String(value).split(':');
  if (parts.length < 2) {
    return 0;
  }
  var hours = Number(parts[0]);
  var minutes = Number(parts[1]);
  return (hours * 60) + minutes;
}

function getDisplayDate(date) {
  return Utilities.formatDate(date, TZ, 'dd/MM/yyyy');
}

function zeroPadDate(date) {
  return Utilities.formatDate(date, TZ, 'yyyy-MM-dd');
}

function getTodayInTimeZone() {
  return parseDateKey(toDateKey(new Date()));
}
