const assert = require('node:assert');
const {
  getNextActionForDay,
  calculateWorkedMinutes,
  calculateDailySummary,
  getExpectedHoursForMonth,
} = require('../src/pontoLogic.js');

const baseDay = {
  available: true,
  feriado: false,
  trabalhaNoFeriado: false,
  jornada: { plannedMinutes: 360 },
  registros: { entrada: '', saidaCafe: '', voltaCafe: '', saida: '' },
};

assert.strictEqual(getNextActionForDay(baseDay), 'ENTRADA');
assert.strictEqual(getNextActionForDay({
  ...baseDay,
  registros: { entrada: '15:00', saidaCafe: '', voltaCafe: '', saida: '' },
}), 'SAIDA_CAFE');
assert.strictEqual(getNextActionForDay({
  ...baseDay,
  registros: { entrada: '15:00', saidaCafe: '17:00', voltaCafe: '', saida: '' },
}), 'VOLTA_CAFE');
assert.strictEqual(getNextActionForDay({
  ...baseDay,
  registros: { entrada: '15:00', saidaCafe: '17:00', voltaCafe: '17:15', saida: '' },
}), 'SAIDA');
assert.strictEqual(getNextActionForDay({
  ...baseDay,
  registros: { entrada: '15:00', saidaCafe: '17:00', voltaCafe: '17:15', saida: '21:00' },
}), 'FINALIZADO');
assert.strictEqual(getNextActionForDay({
  ...baseDay,
  available: false,
  feriado: true,
  trabalhaNoFeriado: false,
}), 'feriado');

assert.strictEqual(calculateWorkedMinutes('15:00', '21:00', '17:00', '17:15'), 345);

const summary = calculateDailySummary({
  ...baseDay,
  registros: { entrada: '15:00', saidaCafe: '17:00', voltaCafe: '17:15', saida: '21:30' },
});
assert.strictEqual(summary.totalMinutes, 375);
assert.strictEqual(summary.saldo, 15);
assert.strictEqual(summary.nextAction, 'FINALIZADO');

const schedule = {
  Segunda: { trabalha: true, entradaMinutes: 900, saidaMinutes: 1260, intervalo: 0 },
  Terça: { trabalha: true, entradaMinutes: 900, saidaMinutes: 1260, intervalo: 0 },
  Quarta: { trabalha: true, entradaMinutes: 900, saidaMinutes: 1260, intervalo: 0 },
  Quinta: { trabalha: true, entradaMinutes: 900, saidaMinutes: 1260, intervalo: 0 },
  Sexta: { trabalha: true, entradaMinutes: 840, saidaMinutes: 1200, intervalo: 0 },
  Sábado: { trabalha: true, entradaMinutes: 480, saidaMinutes: 900, intervalo: 0 },
  Domingo: { trabalha: false },
};
assert.strictEqual(getExpectedHoursForMonth(2024, 1, schedule), 9240);

console.log('ponto-logic tests passed');
