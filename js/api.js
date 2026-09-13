// ─── Meu Ponto — api.js ──────────────────────────────────────────────────────
// Camada de comunicação com o Google Apps Script via GET/CORS
// ─────────────────────────────────────────────────────────────────────────────

function resolveApiUrl() {
  if (typeof window === 'undefined') {
    return 'https://script.google.com/macros/s/AKfycbw0BiP9Ymq9NMLkQnmXOd-rnTIlmmuWI6-ex3Qdt-eL1hBUCo4G9cfiKUL96A_oEwFVVA/exec';
  }

  const qs = new URLSearchParams(window.location.search);
  const queryUrl = qs.get('api');
  const storageUrl = window.localStorage ? window.localStorage.getItem('MEU_PONTO_API_URL') : null;
  const globalUrl = window.MEU_PONTO_API_URL;

  return queryUrl || globalUrl || storageUrl || 'https://script.google.com/macros/s/AKfycbw0BiP9Ymq9NMLkQnmXOd-rnTIlmmuWI6-ex3Qdt-eL1hBUCo4G9cfiKUL96A_oEwFVVA/exec';
}

const API_URL = resolveApiUrl();

/**
 * Faz uma chamada GET para o Apps Script.
 * Todos os parâmetros são enviados via query string.
 * Objetos/arrays complexos são serializados como JSON no parâmetro `p`.
 */
async function apiCall(action, params = {}) {
  const qs = new URLSearchParams({ action });
  // Um único envelope JSON evita discrepâncias entre parâmetros simples e objetos.
  qs.set('p', JSON.stringify(params));

  const url = `${API_URL}?${qs.toString()}`;
  let timeout = null;

  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('meu-ponto:api', { detail: { state: 'syncing', action } }));
    }
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(url, {
      method:   'GET',
      redirect: 'follow',
      cache:    'no-store',
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const text = await res.text();

    // Tenta parsear como JSON (o Apps Script pode retornar HTML em erros)
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('[API] Resposta não-JSON:', text.slice(0, 300));
      throw new Error('Resposta inválida do servidor. Verifique se o Web App está publicado corretamente.');
    }

    if (!data.ok) {
      throw new Error(data.error || 'Erro desconhecido no servidor.');
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('meu-ponto:api', { detail: { state: 'synced', action } }));
    }
    return data.result;

  } catch (err) {
    console.error(`[API] Erro na ação "${action}":`, err);
    const message = err.name === 'AbortError'
      ? 'A conexão demorou demais. Verifique sua internet e tente novamente.'
      : err.message;
    if (typeof window !== 'undefined') {
      const online = typeof navigator === 'undefined' ? true : navigator.onLine;
      window.dispatchEvent(new CustomEvent('meu-ponto:api', { detail: { state: online ? 'error' : 'offline', action } }));
    }
    throw new Error(message);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

// ─── Endpoints específicos ────────────────────────────────────────────────────

const Api = {
  url: API_URL,

  /** Carrega dados iniciais: config, jornada, feriados, estado de hoje */
  async getShell() {
    return apiCall('getShell');
  },

  /** Carrega dados completos de um mês (calendário + resumo) */
  async getCalendar(year, month) {
    return apiCall('getCalendar', { year, month });
  },

  /** Registra um ponto (entrada/saidaCafe/voltaCafe/saida) */
  async registerPunch(type) {
    return apiCall('registerPunch', { type });
  },

  /** Edita um campo de um registro existente */
  async editRecord(dateKey, field, value, motivo = 'Correção manual') {
    return apiCall('editRecord', { dateKey, field, value, motivo });
  },

  /** Salva configurações do perfil */
  async saveConfig(config) {
    return apiCall('saveConfig', config);
  },

  /** Salva jornada semanal completa */
  async saveSchedule(schedule) {
    // schedule é um objeto com keys = nomes dos dias
    return apiCall('saveSchedule', schedule);
  },

  /** Adiciona ou atualiza um feriado */
  async saveHoliday(dateKey, nome, trabalha = false) {
    return apiCall('saveHoliday', { dateKey, nome, trabalha });
  },

  /** Remove um feriado */
  async deleteHoliday(dateKey) {
    return apiCall('deleteHoliday', { dateKey });
  },

  /** Busca resumo mensal */
  async getMonthlySummary(year, month) {
    return apiCall('getMonthlySummary', { year, month });
  },

  /** Busca estado de um dia específico */
  async getDayState(dateKey) {
    return apiCall('getDayState', { dateKey });
  },
};

window.Api = Api;
