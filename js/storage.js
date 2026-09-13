// Cache local apenas para leitura. Marcações nunca são confirmadas localmente.
const Storage = (() => {
  const PREFIX = 'meu-ponto:';
  const MAX_AGE_MS = 1000 * 60 * 60 * 12;

  function get(key) {
    try {
      const item = JSON.parse(localStorage.getItem(PREFIX + key));
      if (!item || Date.now() - item.savedAt > MAX_AGE_MS) return null;
      return item.value;
    } catch (_) {
      return null;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify({ savedAt: Date.now(), value }));
    } catch (_) {
      // O aplicativo continua funcionando se o navegador bloquear armazenamento.
    }
  }

  function getShell() { return get('shell'); }
  function setShell(value) { set('shell', value); }
  function getMonth(year, month) { return get(`month:${year}-${month}`); }
  function setMonth(year, month, value) { set(`month:${year}-${month}`, value); }

  return { getShell, setShell, getMonth, setMonth };
})();

window.Storage = Storage;
