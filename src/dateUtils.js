function pad2(value) {
  return String(value).padStart(2, '0');
}

function getLocalDateParts(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return { year, month, day };
}

function formatDateKey(date) {
  const { year, month, day } = getLocalDateParts(date);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getWeekdayName(date) {
  const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return weekdays[date.getDay()];
}

function getMonthName(monthIndex) {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return months[monthIndex];
}

function getLastDayOfMonth(year, monthIndex) {
  const normalizedMonth = (monthIndex >= 0 && monthIndex <= 11) ? monthIndex : monthIndex - 1;
  return new Date(year, normalizedMonth + 1, 0).getDate();
}

function getMonthCalendar(year, monthIndex) {
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = getLastDayOfMonth(year, monthIndex);
  const calendar = [];
  const offset = (firstDay.getDay() + 6) % 7;

  for (let i = 0; i < offset; i += 1) {
    calendar.push(null);
  }

  for (let day = 1; day <= lastDay; day += 1) {
    calendar.push(new Date(year, monthIndex, day));
  }

  while (calendar.length % 7 !== 0) {
    calendar.push(null);
  }

  return calendar;
}

function dayInMonth(date) {
  return date.getDate();
}

function addDays(date, offset) {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + offset);
  return newDate;
}

module.exports = {
  pad2,
  getLocalDateParts,
  formatDateKey,
  parseDateKey,
  getWeekdayName,
  getMonthName,
  getLastDayOfMonth,
  getMonthCalendar,
  dayInMonth,
  addDays
};
