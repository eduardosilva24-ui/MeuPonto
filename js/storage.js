(function () {
  const KEY = 'MEU_PONTO_API_URL';

  function readApiUrl() {
    return localStorage.getItem(KEY) || (window.MEU_PONTO_API_URL || '');
  }

  function writeApiUrl(value) {
    if (!value) return;
    localStorage.setItem(KEY, value);
    window.MEU_PONTO_API_URL = value;
  }

  window.PontoStorage = {
    readApiUrl,
    writeApiUrl
  };
})();
