// ─── Meu Ponto — api.js ──────────────────────────────────────────────────────
// Camada de comunicação com o Google Apps Script via GET/CORS
// ─────────────────────────────────────────────────────────────────────────────

function resolveApiUrl() {
  if (typeof window === 'undefined') {
    return 'https://script.google.com/macros/s/SEU_WEB_APP_ID/exec';
  }

  const qs = new URLSearchParams(window.location.search);
  const queryUrl = qs.get('api');
  const storageUrl = window.localStorage ? window.localStorage.getItem('MEU_PONTO_API_URL') : null;
  const globalUrl = window.MEU_PONTO_API_URL;

  return queryUrl || globalUrl || storageUrl || 'https://script.google.com/macros/s/SEU_WEB_APP_ID/exec';
}

const API_URL = resolveApiUrl();
const ACTION_TIMEOUT_MS = {
  registerPunch: 60000,
  editRecord: 60000,
  saveHoliday: 45000,
  deleteHoliday: 45000,
  saveSchedule: 45000,
  saveConfig: 45000,
};

/**
 * Faz uma chamada GET para o Apps Script.
 * Todos os parâmetros são enviados via query string.
 * Objetos/arrays complexos são serializados como JSON no parâmetro `p`.
 */
async function apiCall(action, params = {}) {
  if (API_URL.includes('SEU_WEB_APP_ID')) {
    throw new Error('URL do Apps Script não configurada. Defina window.MEU_PONTO_API_URL ou use ?api=https://.../exec');
  }
  const qs = new URLSearchParams({ action });

  // Parâmetros simples (string/number/boolean) vão direto
  // Parâmetros complexos (objeto) vão no parâmetro `p`
  const simple  = {};
  const complex = {};

  for (const [key, val] of Object.entries(params)) {
    if (val !== null && val !== undefined && typeof val === 'object') {
      complex[key] = val;
    } else if (val !== null && val !== undefined) {
      simple[key] = String(val);
    }
  }

  // Anexar parâmetros simples diretamente
  for (const [key, val] of Object.entries(simple)) {
    qs.set(key, val);
  }

  // Parâmetros complexos como JSON no `p`
  if (Object.keys(complex).length > 0) {
    qs.set('p', JSON.stringify(complex));
  }

  const url = `${API_URL}?${qs.toString()}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ACTION_TIMEOUT_MS[action] || 30000);
    const res = await fetch(url, {
      method:   'GET',
      redirect: 'follow',
      cache:    'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeout);

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

    return data.result;

  } catch (err) {
    console.error(`[API] Erro na ação "${action}":`, err);
    const message = err.name === 'AbortError'
      ? 'A conexão demorou demais. O Google Sheets está processando a ação; espere alguns segundos e tente novamente.'
      : err.message;
    throw new Error(message);
  }
}

// ─── Endpoints específicos ────────────────────────────────────────────────────

const Api = {

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
