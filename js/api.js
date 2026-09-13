(function () {
  const FALLBACK_API_URL = 'https://script.google.com/macros/s/AKfycbw0BiP9Ymq9NMLkQnmXOd-rnTIlmmuWI6-ex3Qdt-eL1hBUCo4G9cfiKUL96A_oEwFVVA/exec';
  const API_URL = window.MEU_PONTO_API_URL || FALLBACK_API_URL;

  function normalizeResponse(payload) {
    if (!payload) return {};
    if (typeof payload === 'string') {
      try {
        return JSON.parse(payload);
      } catch (error) {
        return { ok: false, error: payload };
      }
    }
    return payload;
  }

  async function apiCall(action, params, method) {
    const url = new URL(API_URL);
    const options = { method: method || 'GET', headers: { Accept: 'application/json' } };

    if (method === 'POST') {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(Object.assign({ action }, params || {}));
    } else {
      Object.keys(params || {}).forEach(function (key) {
        url.searchParams.set(key, params[key]);
      });
      url.searchParams.set('action', action);
    }

    const response = await fetch(url.toString(), options);
    const payload = normalizeResponse(await response.text());
    if (!response.ok || payload && payload.error) {
      throw new Error(payload && payload.error ? payload.error : 'Erro ao chamar API');
    }
    return payload || {};
  }

  window.Api = {
    async getConfig() {
      return apiCall('config', {}, 'GET');
    },
    async getSchedule() {
      return apiCall('schedule', {}, 'GET');
    },
    async getHolidays() {
      return apiCall('holidays', {}, 'GET');
    },
    async getDay(dateKey) {
      return apiCall('day', { dateKey }, 'GET');
    },
    async getMonth(year, month) {
      return apiCall('month', { year, month }, 'GET');
    },
    async saveConfig(config) {
      return apiCall('save-config', { config }, 'POST');
    },
    async saveSchedule(schedule) {
      return apiCall('save-schedule', { schedule }, 'POST');
    },
    async saveHoliday(dateKey, nome, trabalha) {
      return apiCall('save-holiday', { dateKey, nome, trabalha }, 'POST');
    },
    async deleteHoliday(dateKey) {
      return apiCall('delete-holiday', { dateKey }, 'POST');
    },
    async registerPunch(type) {
      return apiCall('register-punch', { type }, 'POST');
    },
    async editRecord(dateKey, field, value, motivo) {
      return apiCall('edit-record', { dateKey, field, value, motivo }, 'POST');
    }
  };
})();
