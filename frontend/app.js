/* global Chart */
// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
let BASE_URL = localStorage.getItem('base_url') || 'http://localhost:8000';

function setBaseUrl(v) {
  BASE_URL = v.trim().replace(/\/$/, '');
  localStorage.setItem('base_url', BASE_URL);
}

// ─────────────────────────────────────────────
// API
// ─────────────────────────────────────────────
async function api(method, path, body, params) {
  let url = BASE_URL + path;
  if (params) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== null && v !== undefined && v !== '') q.set(k, v);
    }
    if ([...q].length) url += '?' + q.toString();
  }
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.detail;
    let msg;
    if (Array.isArray(detail)) {
      // Pydantic 422: detail is [{loc, msg, type}, ...]
      msg = detail.map(e => {
        const field = Array.isArray(e.loc) ? e.loc.slice(1).join('.') : '';
        return field ? `${field}: ${e.msg}` : e.msg;
      }).join(' | ');
    } else {
      msg = typeof detail === 'string' ? detail : null;
    }
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return data;
}

const GET    = (p, params) => api('GET',    p, null, params);
const POST   = (p, body)   => api('POST',   p, body);
const PUT    = (p, body)   => api('PUT',    p, body);
const PATCH  = (p, body)   => api('PATCH',  p, body);
const DEL    = (p)         => api('DELETE', p);

// ─────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ─────────────────────────────────────────────
// MODAL
// ─────────────────────────────────────────────
function modal(title, content, footer) {
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `
    <div class="modal">
      <h3>${title}</h3>
      <div id="modal-body">${content}</div>
      <div class="modal-footer">${footer}</div>
    </div>`;
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
  return ov;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const fmt = {
  currency: v => v == null ? '—' : `R$ ${Number(v).toFixed(2)}`,
  num:      v => v == null ? '—' : Number(v).toLocaleString('pt-BR'),
  pct:      v => v == null ? '—' : `${Number(v).toFixed(2)}%`,
  date:     v => v ? v.slice(0,10) : '—',
  ts:       v => v ? new Date(v).toLocaleString('pt-BR') : '—',
  budget:   v => v == null ? '—' : `R$ ${(Number(v)/100).toFixed(2)}`,
};

// Extrai o valor numérico de um campo de vídeo (array de {action_type, value})
function videoVal(arr) {
  if (!arr || !arr.length) return null;
  const item = arr[0];
  return item?.value != null ? Number(item.value) : null;
}

function statusBadge(s) {
  if (!s) return '<span class="badge badge-deleted">—</span>';
  const cls = {
    ACTIVE:'active', PAUSED:'paused', DELETED:'deleted', ARCHIVED:'archived',
    WITH_ISSUES:'issues', CAMPAIGN_PAUSED:'paused', ADSET_PAUSED:'paused',
    IN_PROCESS:'paused',
    pending:'pending', running:'running', completed:'completed',
    failed:'failed', cancelled:'cancelled',
  }[s] || 'muted';
  return `<span class="badge badge-${cls}">${s}</span>`;
}

function objectiveBadge(obj) {
  if (!obj) return '<span class="badge badge-cancelled">—</span>';
  const map = {
    OUTCOME_SALES:          { cls: 'obj-sales',      label: 'Vendas' },
    OUTCOME_TRAFFIC:        { cls: 'obj-traffic',    label: 'Tráfego' },
    OUTCOME_ENGAGEMENT:     { cls: 'obj-engagement', label: 'Engajamento' },
    OUTCOME_AWARENESS:      { cls: 'obj-awareness',  label: 'Reconhecimento' },
    OUTCOME_LEADS:          { cls: 'obj-leads',      label: 'Leads' },
    OUTCOME_APP_PROMOTION:  { cls: 'obj-app',        label: 'App' },
  };
  const { cls, label } = map[obj] || { cls: 'cancelled', label: obj };
  return `<span class="badge badge-${cls}" title="${obj}">${label}</span>`;
}

function buyingTypeBadge(bt) {
  if (!bt) return '<span class="badge badge-cancelled">—</span>';
  const map = {
    AUCTION:  { cls: 'buy-auction',  label: 'Leilão' },
    RESERVED: { cls: 'buy-reserved', label: 'Reservado' },
  };
  const { cls, label } = map[bt] || { cls: 'cancelled', label: bt };
  return `<span class="badge badge-${cls}" title="${bt}">${label}</span>`;
}

function jobTypeBadge(jt) {
  if (!jt) return '<span class="badge badge-cancelled">—</span>';
  const map = {
    sync_full:           { cls: 'badge-obj-app',    label: 'Full' },
    sync_campaigns:      { cls: 'badge-obj-traffic', label: 'Campanhas' },
    sync_adsets:         { cls: 'badge-obj-traffic', label: 'Conjuntos' },
    sync_ads:            { cls: 'badge-obj-traffic', label: 'Anúncios' },
    sync_creatives:      { cls: 'badge-obj-traffic', label: 'Criativos' },
    insights_campaigns:  { cls: 'badge-obj-leads',  label: 'Insights Camp.' },
    insights_adsets:     { cls: 'badge-obj-leads',  label: 'Insights Conj.' },
    insights_ads:        { cls: 'badge-obj-leads',  label: 'Insights An.' },
  };
  const { cls, label } = map[jt] || { cls: 'badge-cancelled', label: jt };
  return `<span class="badge ${cls}" title="${jt}">${label}</span>`;
}

// Botão ⓘ com tooltip — passe o texto da descrição
function tip(text) {
  if (!text) return '';
  return `<span class="tip-btn" data-tip="${text.replace(/"/g,'&quot;')}">ⓘ</span>`;
}

function progBar(pct) {
  const p = Math.min(100, Math.max(0, pct || 0));
  return `<div class="prog-wrap"><div class="prog-fill" style="width:${p}%"></div></div> <span style="font-size:11px;color:var(--muted)">${p.toFixed(1)}%</span>`;
}

function btnGroup(...btns) {
  return `<div class="btn-group">${btns.join('')}</div>`;
}

function accountOpts(accounts, selected = '') {
  return accounts.map(a =>
    `<option value="${a.account_id}" ${a.account_id === selected ? 'selected' : ''}>${a.name || a.account_id} (${a.account_id})</option>`
  ).join('');
}

// ─────────────────────────────────────────────
// CHARTS
// ─────────────────────────────────────────────

function _destroyChart(id) {
  if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
}

// Opções de escala comuns ao tema dark
function _scaleOpts(color) {
  return {
    ticks: { color, font: { size: 10 } },
    grid:  { color: '#2e3349' },
    border:{ color: '#2e3349' },
  };
}

/**
 * Gráfico de linha do tempo (barras de spend + linhas de contagem).
 * @param {string} id          — id do canvas
 * @param {Array}  rows        — linhas de insight (já ordenadas por data)
 * @param {Array}  extraLines  — [{label, key|fn, color, axis?}] para linhas adicionais
 *                               key: nome direto da propriedade; fn(r): função calculada
 */
function buildTimelineChart(id, rows, extraLines = []) {
  if (!rows?.length) return;
  const canvas = document.getElementById(id);
  if (!canvas) return;
  _destroyChart(id);

  const labels = rows.map(r => r.date_start);

  const datasets = [
    {
      type: 'bar', label: 'Spend (R$)',
      data: rows.map(r => Number(r.spend || 0)),
      backgroundColor: 'rgba(245,158,11,0.55)',
      borderColor: '#f59e0b', borderWidth: 1,
      yAxisID: 'yL',
    },
    {
      type: 'line', label: 'Impressões',
      data: rows.map(r => r.impressions || 0),
      borderColor: '#4f8ef7', backgroundColor: 'transparent',
      tension: 0.35, pointRadius: rows.length > 60 ? 0 : 2, borderWidth: 2,
      yAxisID: 'yR',
    },
    {
      type: 'line', label: 'Cliques',
      data: rows.map(r => r.clicks || 0),
      borderColor: '#22c55e', backgroundColor: 'transparent',
      tension: 0.35, pointRadius: rows.length > 60 ? 0 : 2, borderWidth: 2,
      yAxisID: 'yR',
    },
    ...extraLines.map(e => ({
      type: 'line', label: e.label,
      data: rows.map(r => { const v = e.fn ? e.fn(r) : r[e.key]; return v != null ? Number(v) : 0; }),
      borderColor: e.color, backgroundColor: 'transparent',
      tension: 0.35, pointRadius: rows.length > 60 ? 0 : 2, borderWidth: 2,
      borderDash: [4, 3],
      yAxisID: e.axis || 'yR',
    })),
  ];

  _charts[id] = new Chart(canvas, {
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#e2e8f0', font: { size: 11 }, boxWidth: 12, padding: 16 },
        },
        tooltip: {
          backgroundColor: '#1a1d27',
          borderColor: '#2e3349', borderWidth: 1,
          titleColor: '#e2e8f0', bodyColor: '#8892a4',
          callbacks: {
            label: ctx => {
              const v = ctx.parsed.y;
              if (ctx.dataset.label === 'Spend (R$)') return ` R$ ${v.toFixed(2)}`;
              if (ctx.dataset.label.includes('%'))     return ` ${v.toFixed(2)}%`;
              return ` ${v.toLocaleString('pt-BR')}`;
            },
          },
        },
      },
      scales: {
        x: {
          ..._scaleOpts('#8892a4'),
          ticks: { ..._scaleOpts('#8892a4').ticks, maxRotation: 45, maxTicksLimit: 20 },
        },
        yL: {
          type: 'linear', position: 'left',
          ..._scaleOpts('#f59e0b'),
          ticks: { ..._scaleOpts('#f59e0b').ticks, callback: v => 'R$' + v.toFixed(0) },
          title: { display: true, text: 'Spend (R$)', color: '#f59e0b', font: { size: 10 } },
        },
        yR: {
          type: 'linear', position: 'right',
          ..._scaleOpts('#8892a4'),
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Volume', color: '#8892a4', font: { size: 10 } },
        },
      },
    },
  });
}

/**
 * Gráfico de barras horizontais: top entidades por spend total.
 * Agrega múltiplas linhas da mesma entidade (vários dias) em um único bar.
 */
function buildTopSpendChart(id, rows, nameKey, idKey) {
  if (!rows?.length) return;
  const canvas = document.getElementById(id);
  if (!canvas) return;
  _destroyChart(id);

  // Agrega por entidade
  const agg = {};
  rows.forEach(r => {
    const k = r[idKey];
    if (!agg[k]) agg[k] = { name: r[nameKey] || k, spend: 0, impressions: 0, clicks: 0 };
    agg[k].spend       += Number(r.spend       || 0);
    agg[k].impressions += Number(r.impressions  || 0);
    agg[k].clicks      += Number(r.clicks       || 0);
  });

  const top = Object.values(agg).sort((a, b) => b.spend - a.spend).slice(0, 15);
  const truncate = n => n && n.length > 38 ? n.slice(0, 38) + '…' : (n || '—');

  _charts[id] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: top.map(x => truncate(x.name)),
      datasets: [{
        label: 'Spend (R$)',
        data: top.map(x => x.spend),
        backgroundColor: top.map((_, i) =>
          `hsla(${220 + i * 8}, 80%, 60%, 0.7)`
        ),
        borderWidth: 0,
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1d27',
          borderColor: '#2e3349', borderWidth: 1,
          titleColor: '#e2e8f0', bodyColor: '#8892a4',
          callbacks: {
            label: ctx => {
              const item = top[ctx.dataIndex];
              return [
                ` Spend: R$ ${item.spend.toFixed(2)}`,
                ` Impressões: ${item.impressions.toLocaleString('pt-BR')}`,
                ` Cliques: ${item.clicks.toLocaleString('pt-BR')}`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          ..._scaleOpts('#8892a4'),
          ticks: { ..._scaleOpts('#8892a4').ticks, callback: v => 'R$' + v.toFixed(0) },
        },
        y: { ..._scaleOpts('#e2e8f0'), grid: { drawOnChartArea: false } },
      },
    },
  });
}

// ─────────────────────────────────────────────
// ROUTER
// ─────────────────────────────────────────────
const routes = {};

function route(name, fn) { routes[name] = fn; }

function navigate(name) {
  window.location.hash = name;
}

async function renderRoute(name) {
  document.querySelectorAll('nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.route === name);
  });
  const fn = routes[name] || routes['accounts'];
  const el = document.getElementById('content');
  el.innerHTML = '<div class="loading">Carregando...</div>';
  try { await fn(el); } catch(e) {
    el.innerHTML = `<div class="error-msg">Erro: ${e.message}</div>`;
  }
}

window.addEventListener('hashchange', () => {
  renderRoute(window.location.hash.slice(1) || 'accounts');
});

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
let _accounts = [];
let _pollTimer = null;
const _charts  = {}; // instâncias Chart.js ativas

async function loadAccounts() {
  try { _accounts = await GET('/accounts'); }
  catch(e) { _accounts = []; }
}

// ─────────────────────────────────────────────
// PAGE: ACCOUNTS
// ─────────────────────────────────────────────
route('accounts', async el => {
  await loadAccounts();
  render();

  function render() {
    el.innerHTML = `
      <div class="page-header">
        <div><h2>Contas de Anúncio</h2><p>Gerencie as contas cadastradas no sistema</p></div>
        <div class="btn-group">
          <button class="btn btn-ghost" id="btn-save-keys">🔑 Chaves</button>
          <button class="btn btn-ghost" id="btn-check-available">Ver Disponíveis</button>
          <button class="btn btn-primary" id="btn-new-account">+ Nova Conta</button>
        </div>
      </div>
      <div id="content-inner" style="margin-top:20px;"></div>`;

    const inner = el.querySelector('#content-inner');

    if (_accounts.length === 0) {
      inner.innerHTML = `<div class="card"><div class="empty">Nenhuma conta cadastrada. Clique em "+ Nova Conta" para adicionar.</div></div>`;
    } else {
      inner.innerHTML = `
        <div class="card">
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>Account ID</th><th>Nome</th><th>Moeda</th>
                <th>Timezone</th><th>Status</th><th>Criada em</th><th>Ações</th>
              </tr></thead>
              <tbody>${_accounts.map(a => `
                <tr>
                  <td class="mono">${a.account_id}</td>
                  <td>${a.name || '—'}</td>
                  <td>${a.currency || '—'}</td>
                  <td class="muted">${a.timezone_name || '—'}</td>
                  <td>${statusBadge(a.account_status === 1 ? 'ACTIVE' : a.account_status === 2 ? 'PAUSED' : String(a.account_status))}</td>
                  <td class="muted">${fmt.ts(a.created_at)}</td>
                  <td>
                    <div class="btn-group">
                      <button class="btn btn-ghost btn-sm" onclick="editAccount('${a.account_id}')">Editar</button>
                      <button class="btn btn-danger btn-sm" onclick="deleteAccount('${a.account_id}')">Excluir</button>
                    </div>
                  </td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
    }

    el.querySelector('#btn-new-account').onclick = () => openNewAccountModal();
    el.querySelector('#btn-check-available').onclick = () => openAvailableModal();
    el.querySelector('#btn-save-keys').onclick = () => openKeysModal();
  }

  window.deleteAccount = async (id) => {
    if (!confirm(`Excluir conta ${id} e todos os dados vinculados?`)) return;
    try {
      await DEL(`/accounts/${id}`);
      toast('Conta excluída', 'success');
      await loadAccounts();
      render();
    } catch(e) { toast(e.message, 'error'); }
  };

  window.editAccount = (id) => {
    const acc = _accounts.find(a => a.account_id === id);
    if (!acc) return;
    const ov = modal('Editar Conta', `
      <div class="form-group" style="margin-bottom:12px">
        <label>Account ID</label>
        <input value="${acc.account_id}" disabled />
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label>Access Token</label>
        <textarea id="edit-token" rows="3">${acc.access_token || ''}</textarea>
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label>App ID</label>
        <input id="edit-appid" value="${acc.app_id || ''}" />
      </div>
      <div class="form-group">
        <label>App Secret</label>
        <input id="edit-appsecret" type="password" placeholder="(não alterado se vazio)" />
      </div>`,
      `<button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn btn-primary" id="btn-save-edit">Salvar</button>`);
    ov.querySelector('#btn-save-edit').onclick = async () => {
      const body = {};
      const t = ov.querySelector('#edit-token').value.trim();
      const ai = ov.querySelector('#edit-appid').value.trim();
      const as = ov.querySelector('#edit-appsecret').value.trim();
      if (t) body.access_token = t;
      if (ai) body.app_id = ai;
      if (as) body.app_secret = as;
      try {
        await PUT(`/accounts/${id}`, body);
        toast('Conta atualizada', 'success');
        ov.remove();
        await loadAccounts();
        render();
      } catch(e) { toast(e.message, 'error'); }
    };
  };

  function openNewAccountModal() {
    const ov = modal('Nova Conta de Anúncio', `
      <div class="form-group" style="margin-bottom:12px">
        <label>Account ID *</label>
        <input id="new-accid" placeholder="act_1234567890" />
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label>App ID *</label>
        <input id="new-appid" />
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label>App Secret *</label>
        <input id="new-appsecret" type="password" />
      </div>
      <div class="form-group">
        <label>Access Token *</label>
        <textarea id="new-token" rows="3" placeholder="EAABwzLixnjYBO..."></textarea>
      </div>`,
      `<button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn btn-primary" id="btn-create-acc">Cadastrar</button>`);
    ov.querySelector('#btn-create-acc').onclick = async () => {
      const body = {
        account_id: ov.querySelector('#new-accid').value.trim(),
        app_id:     ov.querySelector('#new-appid').value.trim(),
        app_secret: ov.querySelector('#new-appsecret').value.trim(),
        access_token: ov.querySelector('#new-token').value.trim(),
      };
      if (!body.account_id || !body.app_id || !body.app_secret || !body.access_token) {
        toast('Preencha todos os campos', 'error'); return;
      }
      try {
        await POST('/accounts', body);
        toast('Conta cadastrada!', 'success');
        ov.remove();
        await loadAccounts();
        render();
      } catch(e) { toast(e.message, 'error'); }
    };
  }

  function _loadSavedKeys() {
    return JSON.parse(localStorage.getItem('metaKeys') || '{}');
  }

  function openKeysModal() {
    const saved = _loadSavedKeys();
    const ov = modal('🔑 Chaves Meta — App Credentials', `
      <p style="color:var(--muted);font-size:12px;margin-bottom:14px">
        Salve suas credenciais no navegador para não precisar redigitar ao usar "Ver Disponíveis".<br>
        <span style="color:var(--yellow);font-size:11px">⚠ Armazenadas no localStorage do navegador. Não compartilhe este dispositivo sem apagar as chaves.</span>
      </p>
      <div class="form-group" style="margin-bottom:12px">
        <label>App ID ${tip('Identificador do aplicativo na Meta for Developers (ex: 123456789).')}</label>
        <input id="km-appid" value="${saved.app_id || ''}" placeholder="ex: 123456789" />
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label>App Secret ${tip('Chave secreta do app. Mantenha confidencial. Nunca exposta publicamente.')}</label>
        <input id="km-appsecret" type="password" value="${saved.app_secret || ''}" placeholder="••••••••••••••••" />
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label>Access Token ${tip('Token de acesso do usuário ou sistema. Pode ser de curta duração (expirar em 1h) ou longa duração (60 dias).')}</label>
        <textarea id="km-token" rows="3">${saved.access_token || ''}</textarea>
      </div>
      <div id="km-result"></div>`,
      `<button class="btn btn-ghost btn-danger" id="btn-km-clear">Limpar Chaves</button>
       <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn btn-primary" id="btn-km-save">💾 Salvar</button>`);

    ov.querySelector('#btn-km-save').onclick = () => {
      const keys = {
        app_id:       ov.querySelector('#km-appid').value.trim(),
        app_secret:   ov.querySelector('#km-appsecret').value.trim(),
        access_token: ov.querySelector('#km-token').value.trim(),
      };
      localStorage.setItem('metaKeys', JSON.stringify(keys));
      ov.querySelector('#km-result').innerHTML = '<div class="success-msg" style="margin-top:8px">✔ Chaves salvas no navegador.</div>';
      toast('Chaves salvas!', 'success');
    };

    ov.querySelector('#btn-km-clear').onclick = () => {
      if (!confirm('Apagar todas as chaves salvas?')) return;
      localStorage.removeItem('metaKeys');
      ov.querySelector('#km-appid').value = '';
      ov.querySelector('#km-appsecret').value = '';
      ov.querySelector('#km-token').value = '';
      ov.querySelector('#km-result').innerHTML = '<div class="success-msg" style="margin-top:8px">Chaves apagadas.</div>';
      toast('Chaves removidas.', 'success');
    };
  }

  function openAvailableModal() {
    const saved = _loadSavedKeys();
    const ov = modal('Ver Contas Disponíveis pelo Token', `
      <p style="color:var(--muted);font-size:12px;margin-bottom:14px">Informe as credenciais para listar contas sem salvar no banco.
        ${saved.access_token ? '<span style="color:var(--green);font-size:11px"> ✔ Chaves salvas carregadas automaticamente.</span>' : ''}
      </p>
      <div class="form-group" style="margin-bottom:12px">
        <label>App ID</label>
        <input id="av-appid" value="${saved.app_id || ''}" />
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label>App Secret</label>
        <input id="av-appsecret" type="password" value="${saved.app_secret || ''}" />
      </div>
      <div class="form-group">
        <label>Access Token</label>
        <textarea id="av-token" rows="3">${saved.access_token || ''}</textarea>
      </div>
      <div id="av-result"></div>`,
      `<button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
       <button class="btn btn-primary" id="btn-av-check">Verificar</button>`);
    ov.querySelector('#btn-av-check').onclick = async () => {
      const body = {
        app_id:     ov.querySelector('#av-appid').value.trim(),
        app_secret: ov.querySelector('#av-appsecret').value.trim(),
        access_token: ov.querySelector('#av-token').value.trim(),
      };
      try {
        const res = await POST('/accounts/available', body);
        ov.querySelector('#av-result').innerHTML = `
          <div style="margin-top:14px">
            <div class="card-title">${res.total} conta(s) encontrada(s)</div>
            ${res.accounts.map(a => `<div style="padding:8px 0;border-bottom:1px solid var(--border)">
              <strong>${a.name || a.account_id}</strong>
              <span class="mono" style="margin-left:8px;font-size:11px">${a.account_id}</span>
              <span class="muted" style="margin-left:8px;font-size:11px">${a.currency} · ${a.timezone_name}</span>
            </div>`).join('')}
          </div>`;
      } catch(e) { toast(e.message, 'error'); }
    };
  }
});

// ─────────────────────────────────────────────
// PAGE: SYNC
// ─────────────────────────────────────────────
route('sync', async el => {
  await loadAccounts();
  const today = new Date().toISOString().slice(0, 10);

  el.innerHTML = `
    <div class="page-header">
      <div><h2>Sincronização</h2><p>Sincronize a estrutura das campanhas, conjuntos, anúncios e criativos</p></div>
    </div>
    <div style="margin-top:20px">

    <div class="card">
      <div class="card-title">Conta e Filtro de Data</div>
      <div class="form-row">
        <div class="form-group">
          <label>Conta de Anúncio</label>
          <select id="sync-account">
            <option value="">— selecione —</option>
            ${accountOpts(_accounts)}
          </select>
        </div>
        <div class="form-group">
          <label>Atualizado após ${tip('Filtra objetos cujo updated_time na Meta API seja posterior a esta data. Deixe em branco para sincronizar tudo.')}</label>
          <input type="date" id="unified-date-from" />
        </div>
        <div class="form-group">
          <label>Atualizado até</label>
          <input type="date" id="unified-date-to" value="${today}" />
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Sincronização Estrutural ${tip('Atualiza campos das campanhas, conjuntos, anúncios e criativos no banco local. Usa updated_time como filtro. Para insights (métricas), use o botão Sincronizar dentro de cada campanha no Explorador.')}</div>
      <p style="color:var(--muted);font-size:12px;margin-bottom:12px">
        <span style="color:var(--yellow);font-size:11px">💡 Insights de métricas são sincronizados por campanha no Explorador (botão ⚡ Sincronizar na campanha).</span>
      </p>
      <p style="color:var(--muted);font-size:12px;margin-bottom:12px">
        Ordem recomendada: <strong>Full</strong> — sincroniza campanhas, conjuntos, anúncios e criativos em sequência.
      </p>
      <div class="btn-group" id="struct-btns">
        <button class="btn btn-primary" data-sync="full">⚡ Full</button>
        <button class="btn btn-ghost" data-sync="campaigns">Campanhas</button>
        <button class="btn btn-ghost" data-sync="adsets">Conjuntos</button>
        <button class="btn btn-ghost" data-sync="ads">Anúncios</button>
        <button class="btn btn-ghost" data-sync="creatives">Criativos</button>
      </div>
      <div id="sync-results" style="margin-top:14px"></div>
    </div>

    </div>`;

  el.querySelector('#sync-account').addEventListener('change', () => {
    el.querySelector('#sync-results').innerHTML = '';
  });

  function getAccountId() {
    const v = el.querySelector('#sync-account').value;
    if (!v) { toast('Selecione uma conta', 'error'); return null; }
    return v;
  }

  function getSharedDates() {
    return {
      date_from: el.querySelector('#unified-date-from').value || undefined,
      date_to:   el.querySelector('#unified-date-to').value   || undefined,
    };
  }

  function appendResult(html) {
    const res = el.querySelector('#sync-results');
    res.insertAdjacentHTML('beforeend', html);
  }

  const _syncLabels = { full:'⚡ Full', campaigns:'Campanhas', adsets:'Conjuntos', ads:'Anúncios', creatives:'Criativos' };

  const _SYNC_TERMINAL = new Set(['completed', 'failed', 'cancelled']);

  function _syncRenderCard(jobId, label) {
    return `
      <div id="sync-card-${jobId}" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:10px 14px;margin-bottom:8px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:12px;font-weight:600">${label}</span>
          <span id="sync-badge-${jobId}">${statusBadge('pending')}</span>
        </div>
        <div style="background:var(--border);border-radius:4px;height:7px;overflow:hidden;margin-bottom:5px">
          <div id="sync-bar-${jobId}" style="background:var(--blue);height:100%;width:0%;transition:width .4s"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted)">
          <span id="sync-prog-${jobId}">0 / ? itens</span>
          <span class="mono" style="cursor:pointer" title="${jobId}" onclick="jobDetail('${jobId}')">${jobId.slice(0,14)}… ↗</span>
        </div>
        <div id="sync-err-${jobId}" style="font-size:11px;color:var(--red);margin-top:4px;display:none"></div>
      </div>`;
  }

  function _syncPollJob(jobId, timer) {
    GET(`/jobs/${jobId}`).then(data => {
      const pct = data.total_days ? Math.round(data.days_processed / data.total_days * 100) : 0;
      const barEl   = document.getElementById(`sync-bar-${jobId}`);
      const badgeEl = document.getElementById(`sync-badge-${jobId}`);
      const progEl  = document.getElementById(`sync-prog-${jobId}`);
      const errEl   = document.getElementById(`sync-err-${jobId}`);
      if (barEl) {
        barEl.style.width = (data.status === 'completed' ? 100 : pct) + '%';
        barEl.style.background = data.status === 'completed' ? 'var(--green)'
          : data.status === 'failed' ? 'var(--red)' : 'var(--blue)';
      }
      if (badgeEl) badgeEl.innerHTML = statusBadge(data.status);
      if (progEl) progEl.textContent = `${data.days_processed || 0} / ${data.total_days || '?'} itens`;
      if (errEl && data.error_message) { errEl.textContent = data.error_message; errEl.style.display = ''; }
      if (_SYNC_TERMINAL.has(data.status)) {
        clearInterval(timer.id);
        if (data.status === 'completed') toast(`Job ${jobId.slice(0,8)}… concluído!`, 'success');
      }
    }).catch(() => {});
  }

  el.querySelectorAll('[data-sync]').forEach(btn => {
    btn.onclick = async () => {
      const accId = getAccountId(); if (!accId) return;
      const dateFrom = el.querySelector('#unified-date-from').value;
      if (!dateFrom) {
        const ok = window.confirm('Sem data inicial definida, todos os registros da conta serão sincronizados. Isso pode ser lento para contas antigas. Continuar?');
        if (!ok) return;
      }
      const type = btn.dataset.sync;
      btn.disabled = true; btn.textContent = '...';
      try {
        const activeJobs = await api('GET', '/jobs', null, { account_id: accId, status: 'running', limit: 1 });
        if (activeJobs.items?.length > 0) {
          toast('Já existe um job em execução para esta conta.', 'warn');
          return;
        }
        const data = await api('POST', `/sync/${accId}/${type}`, null, getSharedDates());
        const label = `Estrutural — ${_syncLabels[type] || type}`;
        appendResult(_syncRenderCard(data.job_id, label));
        toast('Job de sync estrutural iniciado!', 'success');
        const timer = {};
        timer.id = setInterval(() => _syncPollJob(data.job_id, timer), 5000);
        _syncPollJob(data.job_id, timer);
      } catch(e) {
        appendResult(`<div class="error-msg" style="margin-bottom:6px">Estrutural: ${e.message}</div>`);
        toast(e.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = _syncLabels[type] || type;
      }
    };
  });
});

// ─────────────────────────────────────────────
// PAGE: JOBS
// ─────────────────────────────────────────────
route('jobs', async el => {
  await loadAccounts();
  let autoRefresh = false;
  let jobsPage = 0;
  let jobsLimit = 20;
  const _jobColDefs = [
    { key: 'id',        label: 'Job ID',    tip: 'Identificador único do job.' },
    { key: 'conta',     label: 'Conta',     tip: 'ID da conta de anúncio vinculada a este job.' },
    { key: 'progresso', label: 'Progresso', tip: 'Barra de progresso e contador de dias/itens processados.' },
    { key: 'registros', label: 'Registros', tip: 'Total de registros sincronizados pelo job.' },
    { key: 'retries',   label: 'Retries',   tip: 'Contagem de tentativas / máximo de retentativas.' },
    { key: 'criado',    label: 'Criado',    tip: 'Data e hora em que o job foi criado.' },
  ];
  const _jobDefaultCols = { id: true, conta: true, progresso: true, registros: true, retries: false, criado: true };
  let visibleJobCols = { ..._jobDefaultCols, ...(JSON.parse(localStorage.getItem('jobCols') || 'null') || {}) };

  el.innerHTML = `
    <div class="page-header">
      <div><h2>Jobs de Sync</h2><p>Acompanhe o progresso dos jobs de insights em background</p></div>
      <div class="btn-group">
        <button class="btn btn-ghost btn-sm" onclick="jobToggleColFilter()">⚙ Colunas</button>
        <button class="btn btn-ghost btn-sm" id="btn-refresh">↺ Atualizar</button>
        <button class="btn btn-ghost btn-sm" id="btn-auto-refresh">Auto-refresh: OFF</button>
      </div>
    </div>
    <div style="margin-top:20px">
    <div class="card">
      <div class="form-row">
        <div class="form-group">
          <label>Conta</label>
          <select id="jobs-account">
            <option value="">Todas</option>
            ${accountOpts(_accounts)}
          </select>
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="jobs-status">
            <option value="">Todos</option>
            <option>pending</option><option>running</option>
            <option>completed</option><option>failed</option><option>cancelled</option>
          </select>
        </div>
        <div class="form-group">
          <label>Tipo</label>
          <select id="jobs-type">
            <option value="">Todos</option>
            <option>sync_full</option><option>sync_campaigns</option><option>sync_adsets</option>
            <option>sync_ads</option><option>sync_creatives</option>
            <option>insights_campaigns</option><option>insights_adsets</option><option>insights_ads</option>
          </select>
        </div>
        <div class="form-group">
          <label>Por página</label>
          <select id="jobs-limit">
            <option value="10">10</option>
            <option value="15">15</option>
            <option value="20" selected>20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
        <div class="form-group" style="justify-content:flex-end">
          <button class="btn btn-primary" id="btn-jobs-filter" style="margin-top:18px">Filtrar</button>
        </div>
      </div>
    </div>
    <div id="job-col-panel-wrap"></div>
    <div id="jobs-table-wrap"></div>
    <div id="jobs-pagination" style="display:flex;align-items:center;gap:10px;padding:12px 0;justify-content:center"></div>
    </div>`;

  function renderJobColPanel() {
    const wrap = el.querySelector('#job-col-panel-wrap');
    if (!wrap) return;
    wrap.innerHTML = `<div id="job-col-filter-panel" style="display:none;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:10px">
      <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Colunas visíveis</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;opacity:.5;cursor:not-allowed">
          <input type="checkbox" checked disabled /> Tipo
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;opacity:.5;cursor:not-allowed">
          <input type="checkbox" checked disabled /> Status
        </label>
        ${_jobColDefs.map(c => `<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer" title="${c.tip}">
          <input type="checkbox" onchange="jobToggleCol('${c.key}')" ${visibleJobCols[c.key] ? 'checked' : ''} />
          ${c.label}
        </label>`).join('')}
      </div>
    </div>`;
  }

  window.jobToggleColFilter = () => {
    const panel = el.querySelector('#job-col-filter-panel');
    if (panel) panel.style.display = panel.style.display === 'none' ? '' : 'none';
  };

  window.jobToggleCol = (key) => {
    visibleJobCols[key] = !visibleJobCols[key];
    localStorage.setItem('jobCols', JSON.stringify(visibleJobCols));
    const wasOpen = el.querySelector('#job-col-filter-panel')?.style.display !== 'none';
    renderJobColPanel();
    if (wasOpen) {
      const panel = el.querySelector('#job-col-filter-panel');
      if (panel) panel.style.display = '';
    }
    loadJobs();
  };

  renderJobColPanel();

  async function loadJobs() {
    jobsLimit = parseInt(el.querySelector('#jobs-limit').value) || 20;
    const params = {
      account_id: el.querySelector('#jobs-account').value || undefined,
      status:     el.querySelector('#jobs-status').value || undefined,
      job_type:   el.querySelector('#jobs-type').value || undefined,
      limit: jobsLimit,
      offset: jobsPage * jobsLimit,
    };
    const wrap = el.querySelector('#jobs-table-wrap');
    const pag  = el.querySelector('#jobs-pagination');
    try {
      const jobs = await GET('/jobs', params);
      if (!jobs.length && jobsPage === 0) {
        wrap.innerHTML = '<div class="empty">Nenhum job encontrado.</div>';
        pag.innerHTML = '';
        return;
      }
      const v = visibleJobCols;
      wrap.innerHTML = `
        <div class="card">
          <div class="table-wrap">
            <table>
              <thead><tr>
                ${v.id ? '<th>Job ID</th>' : ''}
                ${v.conta ? '<th>Conta</th>' : ''}
                <th>Tipo</th><th>Status</th>
                ${v.progresso ? `<th>Progresso ${tip('Barra de progresso e contador de dias/itens processados.')}</th>` : ''}
                ${v.registros ? `<th>Registros ${tip('Total de registros sincronizados pelo job.')}</th>` : ''}
                ${v.retries ? `<th>Retries ${tip('Contagem de tentativas / máximo de retentativas.')}</th>` : ''}
                ${v.criado ? '<th>Criado</th>' : ''}
                <th>Ações ${tip('Retomar: reprocessa jobs com falha a partir do cursor. Cancelar: interrompe jobs pendentes ou em execução.')}</th>
              </tr></thead>
              <tbody>${jobs.map(j => {
                const pct = j.total_days ? (j.days_processed / j.total_days * 100) : 0;
                return `<tr>
                  ${v.id ? `<td class="mono" style="font-size:11px;cursor:pointer;color:var(--blue)" onclick="jobDetail('${j.job_id}')">${j.job_id.slice(0,12)}…</td>` : ''}
                  ${v.conta ? `<td class="mono">${j.account_id}</td>` : ''}
                  <td>${jobTypeBadge(j.job_type)}</td>
                  <td>${statusBadge(j.status)}</td>
                  ${v.progresso ? `<td>${j.total_days ? progBar(pct) : '—'} <span style="font-size:10px;color:var(--muted)">${j.days_processed}/${j.total_days || '?'} ${j.job_type && j.job_type.includes('insight') ? 'dias' : 'itens'}</span></td>` : ''}
                  ${v.registros ? `<td class="num">${fmt.num(j.records_synced)}</td>` : ''}
                  ${v.retries ? `<td class="num">${j.retry_count || 0}/${j.max_retries || 10}</td>` : ''}
                  ${v.criado ? `<td class="muted">${fmt.ts(j.created_at)}</td>` : ''}
                  <td>
                    <div class="btn-group">
                      ${j.status === 'failed' ? `<button class="btn btn-warn btn-sm" title="Retoma o job a partir do último cursor salvo" onclick="resumeJob('${j.job_id}')">Retomar</button>` : ''}
                      ${['running','pending'].includes(j.status) ? `<button class="btn btn-ghost btn-sm" title="Cancela o job imediatamente" onclick="cancelJob('${j.job_id}')">Cancelar</button>` : ''}
                      <button class="btn btn-ghost btn-sm" title="Exibe todos os detalhes do job" onclick="jobDetail('${j.job_id}')">Ver</button>
                    </div>
                  </td>
                </tr>`;
              }).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
      // paginação
      const hasPrev = jobsPage > 0;
      const hasNext = jobs.length === jobsLimit;
      pag.innerHTML = `
        <button class="btn btn-ghost btn-sm" id="jobs-prev" ${hasPrev ? '' : 'disabled'}>← Anterior</button>
        <span style="font-size:12px;color:var(--muted)">Página ${jobsPage + 1}</span>
        <button class="btn btn-ghost btn-sm" id="jobs-next" ${hasNext ? '' : 'disabled'}>Próxima →</button>`;
      pag.querySelector('#jobs-prev').onclick = () => { jobsPage--; loadJobs(); };
      pag.querySelector('#jobs-next').onclick = () => { jobsPage++; loadJobs(); };
    } catch(e) {
      wrap.innerHTML = `<div class="error-msg">${e.message}</div>`;
    }
  }

  el.querySelector('#btn-refresh').onclick = loadJobs;
  el.querySelector('#btn-jobs-filter').onclick = () => { jobsPage = 0; loadJobs(); };

  const autoBtn = el.querySelector('#btn-auto-refresh');
  autoBtn.onclick = () => {
    autoRefresh = !autoRefresh;
    autoBtn.textContent = `Auto-refresh: ${autoRefresh ? 'ON' : 'OFF'}`;
    autoBtn.className = autoRefresh ? 'btn btn-success btn-sm' : 'btn btn-ghost btn-sm';
    if (autoRefresh) {
      _pollTimer = setInterval(loadJobs, 5000);
    } else {
      clearInterval(_pollTimer); _pollTimer = null;
    }
  };

  window.resumeJob = async (id) => {
    try {
      await POST(`/jobs/${id}/resume`);
      toast('Job retomado!', 'success');
      loadJobs();
    } catch(e) { toast(e.message, 'error'); }
  };

  window.cancelJob = async (id) => {
    if (!confirm('Cancelar este job?')) return;
    try {
      await POST(`/jobs/${id}/cancel`);
      toast('Job cancelado', 'info');
      loadJobs();
    } catch(e) { toast(e.message, 'error'); }
  };

  window.jobDetail = async (id) => {
    try {
      const j = await GET(`/jobs/${id}`);
      const pct = j.total_days ? (j.days_processed / j.total_days * 100) : 0;
      modal('Detalhe do Job', `
        <table style="width:100%;font-size:12px">
          ${[
            ['job_id', j.job_id],
            ['account_id', j.account_id],
            ['job_type', j.job_type],
            ['status', statusBadge(j.status)],
            ['date_from → date_to', `${j.date_from} → ${j.date_to}`],
            ['chunk_size_days', j.chunk_size_days],
            ['cursor_date', j.cursor_date || '—'],
            ['days_processed', `${j.days_processed} / ${j.total_days || '?'}`],
            ['records_synced', fmt.num(j.records_synced)],
            ['retry_count', `${j.retry_count || 0} / ${j.max_retries || 10}`],
            ['retry_after', j.retry_after ? fmt.ts(j.retry_after) : '—'],
            ['error_message', j.error_message ? `<span style="color:var(--red)">${j.error_message}</span>` : '—'],
            ['created_at', fmt.ts(j.created_at)],
            ['updated_at', fmt.ts(j.updated_at)],
          ].map(([k,v]) => `<tr><td style="color:var(--muted);padding:5px 8px;white-space:nowrap">${k}</td><td style="padding:5px 8px">${v}</td></tr>`).join('')}
        </table>
        ${j.total_days ? `<div style="margin-top:12px">${progBar(pct)}</div>` : ''}`,
        `<button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Fechar</button>`);
    } catch(e) { toast(e.message, 'error'); }
  };

  loadJobs();
});

// ─────────────────────────────────────────────
// PAGE: EXPLORER
// ─────────────────────────────────────────────
/**
 * Gráfico de funil de vídeo: agrega totais de cada percentual e exibe barras horizontais.
 */
function buildVideoFunnelChart(id, rows) {
  if (!rows?.length) return;
  const canvas = document.getElementById(id);
  if (!canvas) return;
  _destroyChart(id);

  const sum = key => rows.reduce((acc, r) => {
    const v = videoVal(r[key]);
    return acc + (v != null ? v : 0);
  }, 0);

  const labels = ['Plays', '25%', '50%', '75%', '95%', '100%', '30s'];
  const values = [
    sum('video_play_actions'),
    sum('video_p25_watched_actions'),
    sum('video_p50_watched_actions'),
    sum('video_p75_watched_actions'),
    sum('video_p95_watched_actions'),
    sum('video_p100_watched_actions'),
    sum('video_30_sec_watched_actions'),
  ];

  if (!values[0]) return; // sem dados de vídeo

  _charts[id] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Visualizações',
        data: values,
        backgroundColor: labels.map((_, i) => `hsla(${200 + i * 20}, 70%, 55%, 0.75)`),
        borderWidth: 0,
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1d27',
          borderColor: '#2e3349', borderWidth: 1,
          titleColor: '#e2e8f0', bodyColor: '#8892a4',
          callbacks: { label: ctx => ` ${ctx.parsed.x.toLocaleString('pt-BR')}` },
        },
      },
      scales: {
        x: { ..._scaleOpts('#8892a4'), ticks: { ..._scaleOpts('#8892a4').ticks, callback: v => v.toLocaleString('pt-BR') } },
        y: { ..._scaleOpts('#8892a4') },
      },
    },
  });
}

route('explorer', async el => {
  await loadAccounts();

  // Restore persisted state
  const _saved = JSON.parse(localStorage.getItem('explorer') || '{}');
  let campLimit = parseInt(_saved.campLimit) || 20;
  const _defaultCols = { id:false, objetivo:true, statusEfetivo:true, orcDiario:true, orcVit:false, tipoCompra:false, inicio:false, fim:true, insGasto:false, insImpr:false, insCTR:false, insCPM:false };
  const _savedCols = JSON.parse(localStorage.getItem('campCols') || 'null') || _defaultCols;
  const S = {
    account_id: _saved.account_id || '',
    dateFrom:   _saved.dateFrom   || '',
    dateTo:     _saved.dateTo     || new Date().toISOString().slice(0, 10),
    gran:       _saved.gran       || 'daily',
    status:     _saved.status     || '',
    campaigns: null, campaignsPage: 0, campaignsHasNext: false,
    campaign: null, campInsights: null, campInsightsMap: {},
    adset: null, adsetInsights: null, ads: null,
    ad: null, adInsights: null, placementInsights: null, creative: null,
    visibleCols: { ..._savedCols },
  };

  function saveExplorerState() {
    localStorage.setItem('explorer', JSON.stringify({
      account_id: S.account_id,
      dateFrom:   S.dateFrom,
      dateTo:     S.dateTo,
      gran:       S.gran,
      status:     S.status,
      campLimit,
    }));
  }

  function totals(rows) {
    if (!rows?.length) return null;
    return rows.reduce((a, r) => ({
      impressions: a.impressions + (r.impressions || 0),
      reach:       a.reach       + (r.reach       || 0),
      clicks:      a.clicks      + (r.clicks       || 0),
      link_clicks: a.link_clicks + (r.inline_link_clicks || 0),
      spend:       a.spend       + Number(r.spend  || 0),
    }), { impressions: 0, reach: 0, clicks: 0, link_clicks: 0, spend: 0 });
  }

  function miniTiles(t) {
    if (!t) return `<span style="color:var(--muted);font-size:12px">Sem insights para o periodo selecionado.</span>`;
    const ctr = t.impressions ? (t.clicks / t.impressions * 100).toFixed(2) + '%' : '-';
    return [
      ['Impressões',  fmt.num(t.impressions), 'var(--text)',    'Número de vezes que o anúncio foi exibido na tela de um usuário.'],
      ['Alcance',     fmt.num(t.reach),       'var(--text)',    'Número de pessoas únicas que viram o anúncio ao menos uma vez no período.'],
      ['Cliques',     fmt.num(t.clicks),      'var(--text)',    'Total de cliques no anúncio (inclui cliques no link, curtidas, comentários, etc.).'],
      ['Link Clicks', fmt.num(t.link_clicks), 'var(--blue)',    'Cliques exclusivamente no link de destino do anúncio (exclui curtidas, comentários, etc.).'],
      ['Gasto',       fmt.currency(t.spend),  'var(--yellow)',  'Valor total gasto no período selecionado, na moeda da conta.'],
      ['CTR',         ctr,                    'var(--green)',   'Taxa de cliques: (cliques ÷ impressões) × 100. Indica a atratividade do anúncio.'],
    ].map(([l, v, c, tipText]) => `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:10px 14px;min-width:110px">
      <div style="font-size:20px;font-weight:700;color:${c}">${v}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px">${l} ${tip(tipText)}</div>
    </div>`).join('');
  }

  function insightTable(rows, nameKey, extraCols = []) {
    if (!rows?.length) return '<div class="empty">Sem dados para o periodo.</div>';
    return `<div class="table-wrap"><table>
      <thead><tr><th>Nome</th><th>Período</th>
        <th class="num">Impressões ${tip('Número de vezes que o anúncio foi exibido na tela de um usuário.')}</th>
        <th class="num">Alcance ${tip('Número de pessoas únicas que viram o anúncio ao menos uma vez.')}</th>
        <th class="num">Cliques ${tip('Total de cliques no anúncio (link, curtidas, comentários, etc.).')}</th>
        <th class="num">Link Clicks ${tip('Cliques exclusivamente no link de destino do anúncio.')}</th>
        <th class="num">Gasto ${tip('Valor total gasto no período, na moeda da conta.')}</th>
        <th class="num">CTR ${tip('Taxa de cliques: (cliques ÷ impressões) × 100. Indica a atratividade do anúncio.')}</th>
        <th class="num">CPM ${tip('Custo por mil impressões. Métrica de eficiência de entrega.')}</th>
        <th class="num">CPC ${tip('Custo por clique. Total gasto dividido pelo número de cliques.')}</th>
        ${extraCols.map(c => `<th class="num">${c.label}${c.tip ? ' '+tip(c.tip) : ''}</th>`).join('')}
      </tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${r[nameKey] || '-'}</td>
        <td class="muted">${r.date_start} > ${r.date_stop}</td>
        <td class="num">${fmt.num(r.impressions)}</td>
        <td class="num">${fmt.num(r.reach)}</td>
        <td class="num">${fmt.num(r.clicks)}</td>
        <td class="num">${fmt.num(r.inline_link_clicks)}</td>
        <td class="num">${fmt.currency(r.spend)}</td>
        <td class="num">${fmt.pct(r.ctr)}</td>
        <td class="num">${fmt.currency(r.cpm)}</td>
        <td class="num">${fmt.currency(r.cpc)}</td>
        ${extraCols.map(c => `<td class="num">${c.render(r)}</td>`).join('')}
      </tr>`).join('')}
      </tbody></table></div>`;
  }

  function infoGrid(pairs) {
    return `<div class="grid3">${pairs.map(([k, v, t]) =>
      `<div style="margin-bottom:10px"><div style="font-size:10px;color:var(--muted);display:flex;align-items:center;gap:2px">${k}${t?tip(t):''}</div><div style="font-size:13px;margin-top:2px">${v}</div></div>`
    ).join('')}</div>`;
  }

  // Cards de Ações, Resultados e Cliques Externos — reutilizado em campaign, adset e ad
  const _actionTypesTip =
    'Eventos registrados pela Meta API. Tipos mais comuns:\n\n' +
    '• post_engagement — engajamento total na publicação (curtidas, comentários, compartilhamentos e cliques)\n' +
    '• page_engagement — engajamento com a Página (visitas, curtidas na página etc.)\n' +
    '• like — curtidas na publicação\n' +
    '• comment — comentários\n' +
    '• link_click — cliques no link do anúncio\n' +
    '• video_view — visualizações de vídeo (mín. 3 s)\n' +
    '• post_reaction — reações (Amei, Haha, Uau, Triste, Grr)\n' +
    '• photo_view — visualizações de foto\n' +
    '• landing_page_view — visualizações da landing page após o clique\n' +
    '• onsite_conversion.post_save — publicação salva pelo usuário\n' +
    '• onsite_conversion.messaging_conversation_started_7d — conversa iniciada no Messenger (janela 7 dias)\n' +
    '• onsite_conversion.messaging_first_reply — primeira resposta no Messenger\n' +
    '• offsite_conversion.fb_pixel_purchase — compra registrada pelo Pixel\n' +
    '• offsite_conversion.fb_pixel_lead — lead registrado pelo Pixel\n' +
    '• offsite_conversion.fb_pixel_add_to_cart — adição ao carrinho via Pixel\n' +
    '• offsite_conversion.fb_pixel_view_content — visualização de conteúdo via Pixel\n' +
    '• offsite_conversion.fb_pixel_initiate_checkout — início de checkout via Pixel\n' +
    '• offsite_conversion.fb_pixel_complete_registration — cadastro completo via Pixel\n' +
    '• offsite_conversion.fb_pixel_custom — evento personalizado do Pixel\n' +
    '• omni_purchase — compras em todos os canais (online + offline)\n' +
    '• omni_lead — leads em todos os canais\n' +
    '• omni_add_to_cart — adições ao carrinho em todos os canais\n' +
    '• app_install / mobile_app_install — instalação do aplicativo\n' +
    '• app_custom_event.fb_mobile_purchase — compra no app mobile';

  const _outboundClicksTip =
    'Cliques que saem do ecossistema Meta para URLs externas (site, app ou landing page).\n\n' +
    'Tipos:\n' +
    '• outbound_click — total de cliques externos (link principal do anúncio)\n' +
    '• link_click — cliques em links secundários que saem da plataforma\n\n' +
    'Diferem dos cliques internos (curtir, ver perfil, expandir foto etc.).\n' +
    'Use esta métrica para medir o tráfego real enviado ao seu site.';

  function _renderActionCards(data, hasOutboundCost) {
    const lastRow = data?.slice(-1)[0];
    if (!lastRow) return '';
    const actArr = lastRow.actions || [];
    const cpaArr = lastRow.cost_per_action_type || [];
    const resArr = lastRow.results || [];
    const cprArr = lastRow.cost_per_result || [];
    const obArr  = lastRow.outbound_clicks || [];
    const cobArr = hasOutboundCost ? (lastRow.cost_per_outbound_click || []) : [];
    const cubArr = hasOutboundCost ? (lastRow.cost_per_unique_outbound_click || []) : [];

    const cpMap  = Object.fromEntries(cpaArr.map(x => [x.action_type, x.value]));
    const cprMap = Object.fromEntries(cprArr.map(x => [x.action_type, x.value]));
    const cobMap = Object.fromEntries(cobArr.map(x => [x.action_type, x.value]));
    const cubMap = Object.fromEntries(cubArr.map(x => [x.action_type, x.value]));

    const actCard = actArr.length ? `
    <div class="card">
      <details open>
        <summary style="cursor:pointer;font-size:13px;font-weight:600;color:var(--text)">Acoes ${tip(_actionTypesTip)}</summary>
        <div class="table-wrap" style="margin-top:10px"><table>
          <thead><tr><th>Tipo de Acao</th><th class="num">Valor</th><th class="num">Custo por Acao</th></tr></thead>
          <tbody>${actArr.map(a => `<tr>
            <td class="muted" style="font-size:12px">${a.action_type}</td>
            <td class="num">${fmt.num(a.value)}</td>
            <td class="num">${cpMap[a.action_type]!=null?fmt.currency(cpMap[a.action_type]):'-'}</td>
          </tr>`).join('')}</tbody>
        </table></div>
      </details>
    </div>` : '';

    const resCard = resArr.length ? `
    <div class="card">
      <div class="card-title">Resultados Principais</div>
      <div class="table-wrap"><table>
        <thead><tr><th>Tipo</th><th class="num">Resultados</th><th class="num">Custo por Resultado</th></tr></thead>
        <tbody>${resArr.map(a => `<tr>
          <td class="muted" style="font-size:12px">${a.action_type}</td>
          <td class="num" style="font-weight:600;color:var(--green)">${fmt.num(a.value)}</td>
          <td class="num">${cprMap[a.action_type]!=null?fmt.currency(cprMap[a.action_type]):'-'}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>` : '';

    const obHead = hasOutboundCost ? `<th class="num">Custo/Click</th><th class="num">Custo/Click Unico</th>` : '';
    const obCard = obArr.length ? `
    <div class="card">
      <div class="card-title">Cliques Externos ${tip(_outboundClicksTip)}</div>
      <div class="table-wrap"><table>
        <thead><tr><th>Tipo</th><th class="num">Cliques</th>${obHead}</tr></thead>
        <tbody>${obArr.map(a => `<tr>
          <td class="muted" style="font-size:12px">${a.action_type}</td>
          <td class="num">${fmt.num(a.value)}</td>
          ${hasOutboundCost?`<td class="num">${cobMap[a.action_type]!=null?fmt.currency(cobMap[a.action_type]):'-'}</td><td class="num">${cubMap[a.action_type]!=null?fmt.currency(cubMap[a.action_type]):'-'}</td>`:''}
        </tr>`).join('')}</tbody>
      </table></div>
    </div>` : '';

    return resCard + actCard + obCard;
  }

  function renderFilters() {
    return `<div class="card"><div class="form-row">
      <div class="form-group"><label>Conta *</label>
        <select id="exp-account"><option value="">selecione</option>${accountOpts(_accounts, S.account_id)}</select></div>
      <div class="form-group"><label>Status</label><select id="exp-status">
        <option value="" ${!S.status?'selected':''}>Todos</option>
        <option value="ACTIVE"   ${S.status==='ACTIVE'   ?'selected':''}>ACTIVE</option>
        <option value="PAUSED"   ${S.status==='PAUSED'   ?'selected':''}>PAUSED</option>
        <option value="ARCHIVED" ${S.status==='ARCHIVED' ?'selected':''}>ARCHIVED</option>
        <option value="DELETED"  ${S.status==='DELETED'  ?'selected':''}>DELETED</option>
      </select></div>
      <div class="form-group"><label>Data inicial ${tip('Período usado para exibir métricas de insights nas campanhas, conjuntos e anúncios.')}</label>
        <input type="date" id="exp-date-from" value="${S.dateFrom||''}" /></div>
      <div class="form-group"><label>Data final</label>
        <input type="date" id="exp-date-to" value="${S.dateTo||''}" /></div>
      <div class="form-group"><label>Granularidade</label>
        <select id="exp-gran">
          <option value="daily"   ${S.gran==='daily'  ?'selected':''}>Diário</option>
          <option value="weekly"  ${S.gran==='weekly' ?'selected':''}>Semanal</option>
          <option value="monthly" ${S.gran==='monthly'?'selected':''}>Mensal</option>
        </select></div>
      <div class="form-group" style="justify-content:flex-end">
        <button class="btn btn-primary" id="btn-exp-load" style="margin-top:18px">Buscar Campanhas</button>
      </div>
    </div></div>`;
  }

  function renderBreadcrumb() {
    if (!S.campaign) return '';
    const parts = [
      { label: 'Campanhas',      fn: "expBack('campaigns')" },
      S.campaign && { label: S.campaign.name, fn: S.adset ? "expBack('campaign')" : null },
      S.adset    && { label: S.adset.name,    fn: S.ad   ? "expBack('adset')"    : null },
      S.ad       && { label: S.ad.name,       fn: null },
    ].filter(Boolean);
    return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:16px;font-size:13px;flex-wrap:wrap">
      ${parts.map((p, i) =>
        (i > 0 ? '<span style="color:var(--muted)">›</span>' : '') +
        `<span style="color:${p.fn?'var(--blue)':'var(--text)'};cursor:${p.fn?'pointer':'default'}"
               ${p.fn?`onclick="${p.fn}"`:''}>${p.label}</span>`
      ).join('')}
    </div>`;
  }

  // ── Column filter helpers ──
  const _colDefs = [
    { key:'id',           label:'ID',              tip:'Identificador único da campanha na Meta API.' },
    { key:'objetivo',     label:'Objetivo',        tip:'Objetivo de marketing: OUTCOME_TRAFFIC, OUTCOME_CONVERSIONS, OUTCOME_AWARENESS, etc.' },
    { key:'statusEfetivo',label:'Status Efetivo',  tip:'Estado real de entrega. Pode diferir do status configurado.' },
    { key:'orcDiario',    label:'Orçamento Diário',tip:'Orçamento máximo por dia. Nulo se usar orçamento vitalício.' },
    { key:'orcVit',       label:'Orçamento Vit.',  tip:'Orçamento total pelo tempo de vida. Nulo se usar orçamento diário.' },
    { key:'tipoCompra',   label:'Tipo de Compra',  tip:'AUCTION: leilão em tempo real. RESERVED: alcance e frequência reservados.' },
    { key:'inicio',       label:'Início',          tip:'Data e hora de início da campanha.' },
    { key:'fim',          label:'Fim',             tip:'Data e hora de término. "Indefinido" quando não há data de término configurada.' },
    { key:'insGasto',     label:'Gasto',           tip:'Gasto total no período selecionado. Requer data inicial e final definidas nos filtros.' },
    { key:'insImpr',      label:'Impressões',      tip:'Total de impressões no período selecionado.' },
    { key:'insCTR',       label:'CTR',             tip:'Taxa de cliques no período: (cliques ÷ impressões) × 100.' },
    { key:'insCPM',       label:'CPM',             tip:'Custo por mil impressões no período selecionado.' },
  ];

  // ── Colunas de Conjuntos ──
  const _adsetColDefs = [
    { key:'id',          label:'ID',               tip:'Identificador único do conjunto na Meta API.' },
    { key:'statusEfet',  label:'Status Efetivo',   tip:'Estado real de entrega considerando conjunto e campanha pai.' },
    { key:'objetivo',    label:'Objetivo',         tip:'Evento de otimização que o algoritmo usa para distribuir o orçamento.' },
    { key:'billing',     label:'Evento de Cobrança',tip:'Evento pelo qual você é cobrado: IMPRESSIONS (CPM), LINK_CLICKS (CPC), etc.' },
    { key:'bidStrategy', label:'Estratégia Lance', tip:'Como o sistema determina os lances automáticos ou manuais.' },
    { key:'orcDiario',   label:'Orçamento Diário', tip:'Orçamento diário do conjunto (ABO). Nulo quando a campanha usa CBO.' },
    { key:'orcVit',      label:'Orçamento Vit.',   tip:'Orçamento total pelo período. Incompatível com orçamento diário.' },
    { key:'lance',       label:'Lance',            tip:'Valor máximo de lance. Obrigatório para BID_CAP e COST_CAP.' },
    { key:'inicio',      label:'Início',           tip:'Data e hora de início do conjunto.' },
    { key:'fim',         label:'Fim',              tip:'Data e hora de término. Nulo = sem data de término definida.' },
  ];
  const _adsetDefaultCols = { id:false, statusEfet:true, objetivo:true, billing:false, bidStrategy:false, orcDiario:true, orcVit:false, lance:false, inicio:false, fim:true };
  let visibleAdsetCols = { ..._adsetDefaultCols, ...(JSON.parse(localStorage.getItem('adsetCols') || 'null') || {}) };

  // ── Colunas de Anúncios ──
  const _adColDefs = [
    { key:'id',         label:'ID',              tip:'Identificador único do anúncio na Meta API.' },
    { key:'statusEfet', label:'Status Efetivo',  tip:'Estado real considerando status do anúncio, conjunto e campanha pai.' },
    { key:'creative',   label:'ID do Criativo',  tip:'Identificador do criativo associado. Clique em "Ver" para detalhes.' },
    { key:'lance',      label:'Lance',           tip:'Lance específico deste anúncio. Geralmente herdado do conjunto pai.' },
    { key:'dominio',    label:'Domínio',         tip:'Domínio de conversão para verificação do pixel.' },
    { key:'criado',     label:'Criado',          tip:'Data de criação do anúncio na Meta API.' },
  ];
  const _adDefaultCols = { id:false, statusEfet:true, creative:true, lance:false, dominio:false, criado:true };
  let visibleAdCols = { ..._adDefaultCols, ...(JSON.parse(localStorage.getItem('adCols') || 'null') || {}) };

  window.expToggleAdsetColFilter = () => {
    const panel = document.getElementById('adset-col-filter-panel');
    if (panel) panel.style.display = panel.style.display === 'none' ? '' : 'none';
  };
  window.expToggleAdsetCol = (key) => {
    visibleAdsetCols[key] = !visibleAdsetCols[key];
    localStorage.setItem('adsetCols', JSON.stringify(visibleAdsetCols));
    render();
  };

  window.expToggleAdColFilter = () => {
    const panel = document.getElementById('ad-col-filter-panel');
    if (panel) panel.style.display = panel.style.display === 'none' ? '' : 'none';
  };
  window.expToggleAdCol = (key) => {
    visibleAdCols[key] = !visibleAdCols[key];
    localStorage.setItem('adCols', JSON.stringify(visibleAdCols));
    render();
  };

  function renderAdsetColFilterPanel() {
    return `<div id="adset-col-filter-panel" style="display:none;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:10px">
      <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Colunas visíveis</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;opacity:.5;cursor:not-allowed"><input type="checkbox" checked disabled /> Nome</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;opacity:.5;cursor:not-allowed"><input type="checkbox" checked disabled /> Status</label>
        ${_adsetColDefs.map(c => `<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer" title="${c.tip}">
          <input type="checkbox" onchange="expToggleAdsetCol('${c.key}')" ${visibleAdsetCols[c.key] ? 'checked' : ''} /> ${c.label}
        </label>`).join('')}
      </div>
    </div>`;
  }

  function renderAdColFilterPanel() {
    return `<div id="ad-col-filter-panel" style="display:none;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:10px">
      <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Colunas visíveis</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;opacity:.5;cursor:not-allowed"><input type="checkbox" checked disabled /> Nome</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;opacity:.5;cursor:not-allowed"><input type="checkbox" checked disabled /> Status</label>
        ${_adColDefs.map(c => `<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer" title="${c.tip}">
          <input type="checkbox" onchange="expToggleAdCol('${c.key}')" ${visibleAdCols[c.key] ? 'checked' : ''} /> ${c.label}
        </label>`).join('')}
      </div>
    </div>`;
  }

  window.expChangeCampLimit = (val) => {
    campLimit = parseInt(val) || 20;
    S.campaignsPage = 0;
    saveExplorerState();
    loadCampaigns(false);
  };

  window.expToggleColFilter = () => {
    const panel = document.getElementById('col-filter-panel');
    if (panel) panel.style.display = panel.style.display === 'none' ? '' : 'none';
  };

  window.expToggleCol = (key) => {
    S.visibleCols[key] = !S.visibleCols[key];
    localStorage.setItem('campCols', JSON.stringify(S.visibleCols));
    render();
  };

  function renderColFilterPanel() {
    return `<div id="col-filter-panel" style="display:none;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:10px">
      <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Colunas visíveis</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;opacity:.5;cursor:not-allowed">
          <input type="checkbox" checked disabled /> Nome
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;opacity:.5;cursor:not-allowed">
          <input type="checkbox" checked disabled /> Status
        </label>
        ${_colDefs.map(c => `<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer" title="${c.tip}">
          <input type="checkbox" onchange="expToggleCol('${c.key}')" ${S.visibleCols[c.key] ? 'checked' : ''} />
          ${c.label}
        </label>`).join('')}
      </div>
    </div>`;
  }

  function renderCampaignsList() {
    if (!S.campaigns) return '';
    if (!S.campaigns.length && S.campaignsPage === 0) return '<div class="card"><div class="empty">Nenhuma campanha encontrada.</div></div>';
    const v = S.visibleCols;
    const pagCtrl = `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;justify-content:center">
      <button class="btn btn-ghost btn-sm" onclick="expCampaignsPage(-1)" ${S.campaignsPage === 0 ? 'disabled' : ''}>← Anterior</button>
      <span style="font-size:12px;color:var(--muted)">Página ${S.campaignsPage + 1}</span>
      <button class="btn btn-ghost btn-sm" onclick="expCampaignsPage(1)" ${S.campaignsHasNext ? '' : 'disabled'}>Próxima →</button>
    </div>`;
    return `<div class="card">
      <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Campanhas (${S.campaigns.length}${S.campaignsHasNext ? '+' : ''})</span>
        <div style="display:flex;gap:6px;align-items:center">
          <select id="exp-camp-limit" onchange="expChangeCampLimit(this.value)" title="Resultados por página" style="font-size:12px;padding:3px 8px;height:28px;border:1px solid var(--border);border-radius:4px;background:var(--surface2);color:var(--fg);cursor:pointer">
            <option value="10"  ${campLimit===10  ?'selected':''}>10 / pág</option>
            <option value="15"  ${campLimit===15  ?'selected':''}>15 / pág</option>
            <option value="20"  ${campLimit===20  ?'selected':''}>20 / pág</option>
            <option value="50"  ${campLimit===50  ?'selected':''}>50 / pág</option>
            <option value="100" ${campLimit===100 ?'selected':''}>100 / pág</option>
          </select>
          <button class="btn btn-ghost btn-sm" onclick="expToggleColFilter()" title="Escolher colunas visíveis">⚙ Colunas</button>
          <button class="btn btn-primary btn-sm" onclick="expCreateCampaign()">+ Nova Campanha</button>
        </div>
      </div>
      ${renderColFilterPanel()}
      <div id="bulk-bar" style="display:none;align-items:center;gap:10px;padding:8px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;margin-bottom:10px">
        <span id="bulk-count" style="font-size:13px;font-weight:600;color:var(--blue)">0 selecionadas</span>
        <button class="btn btn-ghost btn-sm" onclick="expBulkCampaigns('ACTIVE')">&#9654; Ativar</button>
        <button class="btn btn-ghost btn-sm" onclick="expBulkCampaigns('PAUSED')">&#9646;&#9646; Pausar</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="expBulkCampaigns('DELETE')">&#128465; Deletar</button>
        <button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="expBulkDeselect()">Limpar seleção</button>
      </div>
      <div class="table-wrap" style="overflow-x:auto"><table style="min-width:600px">
        <thead><tr>
          <th style="width:32px"><input type="checkbox" id="chk-all-camps" title="Selecionar todas" /></th>
          ${v.id           ? `<th>ID ${tip('Identificador único desta campanha na Meta API. Útil para debug ou para referenciar a campanha em integrações externas.')}</th>` : ''}
          <th>Nome ${tip('Nome da campanha definido no momento da criação. Identifica a campanha na lista e nos relatórios.')}</th>
          ${v.objetivo     ? `<th>Objetivo ${tip('Define como o algoritmo da Meta otimiza a entrega. Vendas: conversões e ROAS. Tráfego: cliques no site. Leads: formulários. Engajamento: curtidas e mensagens. Reconhecimento: alcance e lembrança de marca. App: instalações e eventos in-app.')}</th>` : ''}
          <th>Status ${tip('Status configurado manualmente. ACTIVE: campanha rodando. PAUSED: pausada pelo gestor. ARCHIVED: arquivada, sem entrega e sem edição. DELETED: excluída permanentemente.')}</th>
          ${v.statusEfetivo? `<th>Status Efetivo ${tip('Estado real de entrega, considerando fatores além do status configurado — problemas na conta, revisão de conteúdo, conta de anúncio bloqueada ou pagamento pendente. ACTIVE: entregando normalmente. WITH_ISSUES: entregando com restrições. IN_PROCESS: processando alteração recente.')}</th>` : ''}
          ${v.orcDiario    ? `<th class="num">Orçamento Diário ${tip('Valor máximo que pode ser gasto por dia nesta campanha (CBO). Quando configurado aqui, o orçamento é distribuído automaticamente entre os conjuntos. Exibido na moeda da conta. Nulo quando a campanha usa orçamento vitalício.')}</th>` : ''}
          ${v.orcVit       ? `<th class="num">Orçamento Vit. ${tip('Valor total disponível para toda a vida útil da campanha. Recomendado quando há data de término definida. Incompatível com orçamento diário. Nulo quando a campanha usa orçamento diário.')}</th>` : ''}
          ${v.tipoCompra   ? `<th>Tipo de Compra ${tip('Leilão (AUCTION): formato padrão — o sistema compra impressões em tempo real via leilão, com custo variável. Reservado (RESERVED): alcance e frequência garantidos com antecedência (Reach & Frequency), exige orçamento mínimo e aprovação prévia da Meta.')}</th>` : ''}
          ${v.inicio       ? `<th>Início ${tip('Data e hora em que a campanha começou ou está programada para começar. Campanhas sem data de início já publicadas rodam imediatamente após aprovação.')}</th>` : ''}
          ${v.fim          ? `<th>Fim ${tip('Data e hora de término da campanha. Quando não configurada, a campanha roda indefinidamente até ser pausada ou o orçamento se esgotar. Exibe "Indefinido" quando não há data de término.')}</th>` : ''}
          ${v.insGasto     ? `<th class="num">Gasto ${tip('Gasto total no período dos filtros. Disponível apenas se insights estiverem sincronizados.')}</th>` : ''}
          ${v.insImpr      ? `<th class="num">Impressões ${tip('Total de impressões no período dos filtros.')}</th>` : ''}
          ${v.insCTR       ? `<th class="num">CTR ${tip('Taxa de cliques no período: (cliques ÷ impressões) × 100.')}</th>` : ''}
          ${v.insCPM       ? `<th class="num">CPM ${tip('Custo por mil impressões no período dos filtros.')}</th>` : ''}
          <th>Ações ${tip('Operações: ativar/pausar, pausar em cascata, editar, sincronizar insights ou excluir.')}</th>
        </tr></thead>
        <tbody>${S.campaigns.map(c => `<tr data-camp-id="${c.campaign_id}">
          <td><input type="checkbox" class="chk-camp" data-id="${c.campaign_id}" /></td>
          ${v.id           ? `<td class="mono" style="font-size:11px">${c.campaign_id}</td>` : ''}
          <td><strong>${c.name}</strong></td>
          ${v.objetivo     ? `<td>${objectiveBadge(c.objective)}</td>` : ''}
          <td>${statusBadge(c.status)}</td>
          ${v.statusEfetivo? `<td>${statusBadge(c.effective_status)}</td>` : ''}
          ${v.orcDiario    ? `<td class="num">${fmt.budget(c.daily_budget)}</td>` : ''}
          ${v.orcVit       ? `<td class="num">${fmt.budget(c.lifetime_budget)}</td>` : ''}
          ${v.tipoCompra   ? `<td>${buyingTypeBadge(c.buying_type)}</td>` : ''}
          ${v.inicio       ? `<td class="muted">${fmt.date(c.start_time)}</td>` : ''}
          ${v.fim          ? `<td class="muted">${c.stop_time ? fmt.date(c.stop_time) : '<span style="color:var(--muted);font-size:11px">Indefinido</span>'}</td>` : ''}
          ${v.insGasto     ? `<td class="num">${S.campInsightsMap[c.campaign_id] ? fmt.currency(S.campInsightsMap[c.campaign_id].spend) : '<span style="color:var(--muted)">—</span>'}</td>` : ''}
          ${v.insImpr      ? `<td class="num">${S.campInsightsMap[c.campaign_id] ? fmt.num(S.campInsightsMap[c.campaign_id].impressions) : '<span style="color:var(--muted)">—</span>'}</td>` : ''}
          ${v.insCTR       ? `<td class="num">${S.campInsightsMap[c.campaign_id]?.ctr != null ? S.campInsightsMap[c.campaign_id].ctr + '%' : '<span style="color:var(--muted)">—</span>'}</td>` : ''}
          ${v.insCPM       ? `<td class="num">${S.campInsightsMap[c.campaign_id]?.cpm != null ? fmt.currency(S.campInsightsMap[c.campaign_id].cpm) : '<span style="color:var(--muted)">—</span>'}</td>` : ''}
          <td style="white-space:nowrap">
            <button class="btn btn-primary btn-sm" title="Abre a visão detalhada" onclick="expSelectCampaign('${c.campaign_id}')">Ver &#9658;</button>
            <div class="action-dropdown" style="display:inline-block;margin-left:4px">
              <button class="btn btn-ghost btn-sm dropdown-toggle" onclick="event.stopPropagation();this.closest('.action-dropdown').classList.toggle('open')">Ações ▾</button>
              <div class="dropdown-menu">
                <button class="dropdown-item" title="${c.status === 'ACTIVE' ? 'Pausa esta campanha. Os conjuntos e anúncios filhos ficam suspensos enquanto a campanha estiver pausada.' : 'Reativa esta campanha. Os conjuntos e anúncios voltam a ser entregues conforme seus próprios status.'}" onclick="this.closest('.action-dropdown').classList.remove('open');expChangeStatus('campaigns','${c.campaign_id}','${c.status}')">⇄ ${c.status === 'ACTIVE' ? 'Pausar' : 'Ativar'}</button>
                ${c.status === 'ACTIVE' ? `<button class="dropdown-item" title="Pausa esta campanha e todos os seus conjuntos de anúncios de uma vez, independente do status individual de cada conjunto." onclick="this.closest('.action-dropdown').classList.remove('open');expCascadePause('${c.campaign_id}','${c.name.replace(/'/g,"\\'")}')">⏸ Pausar em Cascata</button>` : ''}
                <button class="dropdown-item" title="Abre o formulário para editar nome, objetivo, orçamento, tipo de compra e categorias especiais da campanha." onclick="this.closest('.action-dropdown').classList.remove('open');expEditCampaign('${c.campaign_id}')">✎ Editar</button>
                <button class="dropdown-item" title="Dispara jobs para sincronizar métricas de campanha, conjuntos e anúncios. Abre o painel de progresso para acompanhar em tempo real." onclick="this.closest('.action-dropdown').classList.remove('open');expSyncCampaignFull('${c.campaign_id}','${c.name.replace(/'/g,"\\'")}')">⚡ Sincronizar Insights</button>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item danger" title="Exclui permanentemente esta campanha e todos os seus conjuntos e anúncios. Esta ação não pode ser desfeita." onclick="this.closest('.action-dropdown').classList.remove('open');expDeleteCampaign('${c.campaign_id}','${c.name}')">🗑 Excluir</button>
              </div>
            </div>
          </td>
        </tr>`).join('')}</tbody>
      </table></div>
      ${pagCtrl}
    </div>`;
  }

  function _getSelectedCampIds() {
    return [...document.querySelectorAll('.chk-camp:checked')].map(c => c.dataset.id);
  }

  function _updateBulkBar() {
    const bar   = document.getElementById('bulk-bar');
    const count = document.getElementById('bulk-count');
    if (!bar) return;
    const selected = _getSelectedCampIds();
    if (selected.length > 0) {
      bar.style.display = 'flex';
      count.textContent = `${selected.length} selecionada${selected.length > 1 ? 's' : ''}`;
    } else {
      bar.style.display = 'none';
    }
    // sincroniza o "select all"
    const all = document.getElementById('chk-all-camps');
    if (all) all.indeterminate = selected.length > 0 && selected.length < S.campaigns.length;
    if (all) all.checked = selected.length === S.campaigns.length;
  }

  window.expBulkDeselect = () => {
    document.querySelectorAll('.chk-camp').forEach(c => c.checked = false);
    const all = document.getElementById('chk-all-camps');
    if (all) { all.checked = false; all.indeterminate = false; }
    _updateBulkBar();
  };

  window.expBulkCampaigns = async (action) => {
    const ids = _getSelectedCampIds();
    if (!ids.length) return;
    const isDel = action === 'DELETE';
    if (isDel && !confirm(`Marcar ${ids.length} campanha(s) como DELETED no Meta? Ação irreversível.`)) return;

    const actionLabel = { ACTIVE: 'Ativar', PAUSED: 'Pausar', DELETE: 'Deletar' }[action];

    let jobData;
    try {
      jobData = await POST(`/sync/${S.account_id}/campaigns/bulk-status`, { campaign_ids: ids, action });
    } catch(e) {
      toast(`Erro ao criar job: ${e.message}`, 'error');
      return;
    }

    expBulkDeselect();

    // Abre modal de acompanhamento com polling
    const ov = modal(
      `${actionLabel} em massa — ${ids.length} campanha(s)`,
      `<div id="bjob-body">
         <p style="font-size:12px;color:var(--muted);margin-bottom:12px">
           Job ID: <code>${jobData.job_id}</code>
         </p>
         <div id="bjob-progress" style="margin-bottom:10px"></div>
         <div id="bjob-status" style="font-size:13px"></div>
         <div id="bjob-error" style="font-size:12px;color:var(--red);margin-top:8px;white-space:pre-wrap"></div>
       </div>`,
      `<button class="btn btn-ghost" id="btn-bjob-close" onclick="this.closest('.modal-overlay').remove()">Fechar</button>`
    );

    let pollInterval;
    const stopPoll = () => clearInterval(pollInterval);

    const poll = async () => {
      try {
        const j = await GET(`/jobs/${jobData.job_id}`);
        const done = j.days_processed || 0;
        const total = j.total_days || ids.length;
        const pct = total ? Math.round(done / total * 100) : 0;
        const progressEl = ov.querySelector('#bjob-progress');
        const statusEl = ov.querySelector('#bjob-status');
        const errorEl = ov.querySelector('#bjob-error');
        if (progressEl) progressEl.innerHTML =
          `<div style="background:var(--border);border-radius:4px;height:8px;overflow:hidden">
             <div style="background:var(--blue);height:100%;width:${pct}%;transition:width .3s"></div>
           </div>
           <span style="font-size:11px;color:var(--muted);margin-top:4px;display:block">${done}/${total} campanhas (${pct}%)</span>`;
        if (statusEl) statusEl.innerHTML = `Status: ${statusBadge(j.status)}`;
        if (errorEl && j.error_message) errorEl.textContent = j.error_message;

        if (['completed', 'failed', 'cancelled'].includes(j.status)) {
          stopPoll();
          await loadCampaigns();
          if (j.status === 'completed') toast(`${j.records_synced} campanha(s) atualizadas!`, 'success');
          else toast(`Job finalizado com erros. Veja detalhes no modal.`, 'error');
        }
      } catch(e) {
        stopPoll();
      }
    };

    poll();
    pollInterval = setInterval(poll, 2000);

    // Limpa intervalo se fechar o modal
    const closeBtn = ov.querySelector('#btn-bjob-close');
    if (closeBtn) closeBtn.addEventListener('click', stopPoll);
  };

  function renderCampaignDetail() {
    const c = S.campaign, t = totals(S.campInsights?.data), adsets = c._adsets || [];
    const today = new Date().toISOString().slice(0,10);
    return `
    <div class="card" style="border-left:3px solid var(--blue)">
      <div class="card-title" style="display:flex;align-items:center;gap:8px">
        <span>⚡ Sincronização — ${c.name}</span>
        <span style="font-size:11px;color:var(--muted)">${tip('Dispare sincronizações estruturais ou de insights diretamente para esta campanha, sem precisar ir à aba Sync.')}</span>
      </div>
      <div class="form-row" style="align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:12px">
        <div class="form-group" style="min-width:110px">
          <label>Data inicial</label>
          <input type="date" id="cs-df" />
        </div>
        <div class="form-group" style="min-width:110px">
          <label>Data final</label>
          <input type="date" id="cs-dt" value="${today}" />
        </div>
        <div class="form-group" style="min-width:90px" id="cs-chunk-wrap">
          <label>Chunk ${tip('Tamanho do bloco de dias processado por vez. Menor = mais tolerante a erros. Recomendado: 7.')}</label>
          <input type="number" id="cs-chunk" value="7" min="1" max="90" style="width:70px" />
        </div>
        <div class="form-group" style="min-width:150px">
          <label>Tipo ${tip('Estrutural: atualiza campos da campanha, conjuntos, anúncios e criativos. Insights: busca métricas do período selecionado. Completo: faz os dois.')}</label>
          <select id="cs-type" onchange="expInlineSyncTypeChange()">
            <option value="insights">Insights (métricas)</option>
            <option value="structural">Estrutural (conta toda — campanhas, conjuntos, anúncios, criativos)</option>
            <option value="full">Completo (ambos)</option>
          </select>
        </div>
        <div>
          <button id="cs-sync-btn" class="btn btn-primary btn-sm" style="margin-top:18px" onclick="expInlineCampSync('${c.campaign_id}','${c.name.replace(/'/g,"\\'")}')">⚡ Sincronizar</button>
        </div>
      </div>
      <div id="cs-jobs-panel" style="display:none"></div>
    </div>
    <div class="card">
      <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Campanha: ${c.name} <span style="font-size:11px;color:var(--muted)">${c.campaign_id}</span></span>
      </div>
      ${infoGrid([
        ['Objetivo',objectiveBadge(c.objective),'Objetivo de marketing: define como o sistema otimiza a entrega. Ex.: OUTCOME_TRAFFIC, OUTCOME_CONVERSIONS, OUTCOME_AWARENESS, OUTCOME_LEADS.'],
        ['Status',statusBadge(c.status),'Status configurado: ACTIVE (ativo), PAUSED (pausado), DELETED, ARCHIVED.'],
        ['Status Efetivo',statusBadge(c.effective_status),'Estado real de entrega. Pode ser ACTIVE, PAUSED, DELETED, ARCHIVED, IN_PROCESS (processando) ou WITH_ISSUES (problemas de entrega).'],
        ['Status Config.',c.configured_status||'-','Sinônimo de Status — valor configurado pelo usuário sem considerar fatores externos.'],
        ['Tipo de Compra',buyingTypeBadge(c.buying_type),'AUCTION: leilão em tempo real (padrão). RESERVED: alcance e frequência reservados (Reach & Frequency).'],
        ['Bid Strategy',c.bid_strategy||'-','LOWEST_COST_WITHOUT_CAP: automático sem teto. LOWEST_COST_WITH_BID_CAP: teto manual de lance. COST_CAP: limita custo médio. LOWEST_COST_WITH_MIN_ROAS: ROAS mínimo garantido.'],
        ['Orcamento Diario',fmt.budget(c.daily_budget),'Orçamento diário em centavos da moeda da conta. Compartilhado entre os conjuntos via CBO.'],
        ['Orcamento Vitalicio',fmt.budget(c.lifetime_budget),'Orçamento total pelo tempo de vida da campanha em centavos. Use em vez do diário para campanhas com data de término.'],
        ['Restante',fmt.budget(c.budget_remaining),'Saldo de orçamento ainda disponível para uso nesta campanha.'],
        ['Spend Cap',fmt.budget(c.spend_cap),'Teto máximo de gasto total da campanha. Para remover, defina como 922337203685478.'],
        ['Cat. Especial',c.special_ad_category||'-','Obrigatório pela Meta: HOUSING (habitação), EMPLOYMENT (emprego), CREDIT (crédito) ou NONE. Afeta as opções de segmentação disponíveis.'],
        ['Pacing',Array.isArray(c.pacing_type)?c.pacing_type.join(', '):(c.pacing_type||'-'),'Tipo de ritmo de entrega. "standard" = orçamento distribuído uniformemente ao longo do dia.'],
        ['Budget Schedule',c.is_budget_schedule_enabled!=null?(c.is_budget_schedule_enabled?'Sim':'Nao'):'-','Permite definir períodos de alta/baixa demanda com orçamentos diferentes ao longo do dia.'],
        ['Budget Sharing',c.is_adset_budget_sharing_enabled!=null?(c.is_adset_budget_sharing_enabled?'Sim':'Nao'):'-','Permite que conjuntos filhos compartilhem até 20% do orçamento entre si.'],
        ['Conjuntos',adsets.length||c.adset_count||'-','Quantidade de conjuntos de anúncios vinculados a esta campanha.'],
        ['Anuncios',c.ad_count||'-','Quantidade total de anúncios em todos os conjuntos desta campanha.'],
        ['Inicio',fmt.ts(c.start_time),'Consolidação dos horários de início dos conjuntos. Configure no conjunto, não na campanha.'],
        ['Fim',fmt.ts(c.stop_time),'Consolidação dos horários de término. Somente leitura no nível da campanha.'],
        ['Criado no Meta',fmt.ts(c.meta_created_time),'Data e hora em que a campanha foi criada na Meta API.'],
        ['Atualizado no Meta',fmt.ts(c.meta_updated_time),'Última vez que a campanha foi modificada na Meta API.'],
        ['Sincronizado',fmt.ts(c.synced_at),'Última vez que os dados foram sincronizados do Meta para o banco local.'],
      ])}
    </div>
    <div class="card">
      <div class="card-title">Insights da Campanha</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">${miniTiles(t)}</div>
      ${S.campInsights?.data?.length ? `
        <div style="position:relative;height:260px;margin-bottom:16px">
          <canvas id="chart-camp"></canvas>
        </div>
        <details>
          <summary style="cursor:pointer;font-size:12px;color:var(--blue);margin-bottom:8px">Ver tabela completa (${S.campInsights.data.length} linhas)</summary>
          ${insightTable(S.campInsights.data, 'campaign_name', [
            {label:'Plays',       tip:'Número de vezes que o vídeo foi iniciado.',                                                              render:r=>videoVal(r.video_play_actions)!=null?fmt.num(videoVal(r.video_play_actions)):'-'},
            {label:'30s',         tip:'Visualizações com pelo menos 30 segundos assistidos. Indica engajamento qualificado.',                   render:r=>videoVal(r.video_30_sec_watched_actions)!=null?fmt.num(videoVal(r.video_30_sec_watched_actions)):'-'},
            {label:'Tempo Médio', tip:'Tempo médio em segundos que os usuários assistiram ao vídeo.',                                           render:r=>videoVal(r.video_avg_time_watched_actions)!=null?videoVal(r.video_avg_time_watched_actions).toFixed(1)+'s':'-'},
            {label:'25%',         tip:'Visualizações que chegaram a 25% do vídeo.',                                                             render:r=>videoVal(r.video_p25_watched_actions)!=null?fmt.num(videoVal(r.video_p25_watched_actions)):'-'},
            {label:'50%',         tip:'Visualizações que chegaram a 50% do vídeo.',                                                             render:r=>videoVal(r.video_p50_watched_actions)!=null?fmt.num(videoVal(r.video_p50_watched_actions)):'-'},
            {label:'75%',         tip:'Visualizações que chegaram a 75% do vídeo.',                                                             render:r=>videoVal(r.video_p75_watched_actions)!=null?fmt.num(videoVal(r.video_p75_watched_actions)):'-'},
            {label:'95%',         tip:'Visualizações que chegaram a 95% do vídeo.',                                                             render:r=>videoVal(r.video_p95_watched_actions)!=null?fmt.num(videoVal(r.video_p95_watched_actions)):'-'},
            {label:'100%',        tip:'Visualizações completas — usuários que assistiram o vídeo inteiro.',                                     render:r=>videoVal(r.video_p100_watched_actions)!=null?fmt.num(videoVal(r.video_p100_watched_actions)):'-'},
          ])}
        </details>` : ''}
    </div>
    ${S.campInsights?.data?.some(r => videoVal(r.video_play_actions) != null) ? `
    <div class="card">
      <div class="card-title">Funil de Video</div>
      <div style="position:relative;height:200px">
        <canvas id="chart-camp-video-funnel"></canvas>
      </div>
    </div>` : ''}
    ${_renderActionCards(S.campInsights?.data, false)}
    <div class="card">
      <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Conjuntos de Anuncios (${adsets.length})</span>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn btn-ghost btn-sm" onclick="expToggleAdsetColFilter()" title="Escolher colunas visíveis">⚙ Colunas</button>
          <button class="btn btn-primary btn-sm" onclick="expCreateAdSet('${c.campaign_id}')">+ Novo Conjunto</button>
        </div>
      </div>
      ${!adsets.length ? '<div class="empty">Nenhum conjunto encontrado.</div>' :
      (() => { const va = visibleAdsetCols; return `
      ${renderAdsetColFilterPanel()}
      <div class="table-wrap"><table>
        <thead><tr>
          ${va.id         ? `<th>ID ${tip('Identificador único do conjunto na Meta API.')}</th>` : ''}
          <th>Nome ${tip('Nome do conjunto definido na criação.')}</th>
          <th>Status ${tip('Status configurado: ACTIVE (rodando), PAUSED (pausado), DELETED (excluído), ARCHIVED (arquivado).')}</th>
          ${va.statusEfet ? `<th>Status Efetivo ${tip('Estado real de entrega. Pode ser diferente do status configurado se a campanha pai estiver pausada, ou se houver problemas de conta ou revisão.')}</th>` : ''}
          ${va.objetivo   ? `<th>Objetivo ${tip('Evento de otimização: define como o algoritmo distribui o orçamento. LINK_CLICKS, LANDING_PAGE_VIEWS, CONVERSIONS, REACH, IMPRESSIONS, THRUPLAY, etc.')}</th>` : ''}
          ${va.billing    ? `<th>Evento de Cobrança ${tip('Evento pelo qual você é cobrado. IMPRESSIONS = CPM (por mil impressões). LINK_CLICKS = CPC (por clique). THRUPLAY = por visualização completa de vídeo.')}</th>` : ''}
          ${va.bidStrategy? `<th>Estratégia Lance ${tip('LOWEST_COST_WITHOUT_CAP: automático, sem limite de custo. BID_CAP: teto máximo de lance por leilão. COST_CAP: limita o custo médio por resultado. MIN_ROAS: garante retorno mínimo sobre o investimento.')}</th>` : ''}
          ${va.orcDiario  ? `<th class="num">Orçamento Diário ${tip('Orçamento diário deste conjunto (ABO). Usado quando o orçamento é definido no conjunto, e não na campanha. Nulo quando a campanha usa CBO.')}</th>` : ''}
          ${va.orcVit     ? `<th class="num">Orçamento Vit. ${tip('Orçamento total do conjunto pelo período de veiculação. Use com data de término. Incompatível com orçamento diário.')}</th>` : ''}
          ${va.lance      ? `<th class="num">Lance ${tip('Valor máximo de lance em centavos. Obrigatório quando a estratégia é BID_CAP ou COST_CAP. Nulo em estratégias automáticas.')}</th>` : ''}
          ${va.inicio     ? `<th>Início ${tip('Data e hora de início do conjunto.')}</th>` : ''}
          ${va.fim        ? `<th>Fim ${tip('Data e hora de término. Exibe traço quando não há data de término definida.')}</th>` : ''}
          <th>Ações ${tip('Ver: abre o detalhe completo com targeting e anúncios filhos. Pausar/Ativar: altera status sem afetar os anúncios. Editar: abre o formulário de edição. Excluir: remove permanentemente.')}</th>
        </tr></thead>
        <tbody>${adsets.map(a => `<tr>
          ${va.id         ? `<td class="mono" style="font-size:11px">${a.adset_id}</td>` : ''}
          <td><strong>${a.name}</strong></td>
          <td>${statusBadge(a.status)}</td>
          ${va.statusEfet ? `<td>${statusBadge(a.effective_status)}</td>` : ''}
          ${va.objetivo   ? `<td class="muted" style="font-size:11px">${a.optimization_goal||'-'}</td>` : ''}
          ${va.billing    ? `<td class="muted" style="font-size:11px">${a.billing_event||'-'}</td>` : ''}
          ${va.bidStrategy? `<td class="muted" style="font-size:11px">${a.bid_strategy||'-'}</td>` : ''}
          ${va.orcDiario  ? `<td class="num">${fmt.budget(a.daily_budget)}</td>` : ''}
          ${va.orcVit     ? `<td class="num">${fmt.budget(a.lifetime_budget)}</td>` : ''}
          ${va.lance      ? `<td class="num">${fmt.budget(a.bid_amount)}</td>` : ''}
          ${va.inicio     ? `<td class="muted">${fmt.date(a.start_time)}</td>` : ''}
          ${va.fim        ? `<td class="muted">${fmt.date(a.end_time)}</td>` : ''}
          <td style="white-space:nowrap">
            <button class="btn btn-primary btn-sm" title="Abre o detalhe completo com targeting, métricas e anúncios filhos" onclick="expSelectAdSet('${a.adset_id}')">Ver &#9658;</button>
            <div class="action-dropdown" style="display:inline-block;margin-left:4px">
              <button class="btn btn-ghost btn-sm dropdown-toggle" onclick="event.stopPropagation();this.closest('.action-dropdown').classList.toggle('open')">Ações ▾</button>
              <div class="dropdown-menu">
                <button class="dropdown-item" title="${a.status === 'ACTIVE' ? 'Pausa este conjunto. Os anúncios filhos ficam suspensos enquanto o conjunto estiver pausado.' : 'Reativa este conjunto. Os anúncios voltam a ser entregues conforme seus próprios status.'}" onclick="this.closest('.action-dropdown').classList.remove('open');expChangeStatus('adsets','${a.adset_id}','${a.status}')">⇄ ${a.status === 'ACTIVE' ? 'Pausar' : 'Ativar'}</button>
                <button class="dropdown-item" title="Abre o formulário para editar orçamento, lance, público-alvo e datas do conjunto." onclick="this.closest('.action-dropdown').classList.remove('open');expEditAdSet('${a.adset_id}')">✎ Editar</button>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item danger" title="Exclui permanentemente este conjunto e todos os seus anúncios. Esta ação não pode ser desfeita." onclick="this.closest('.action-dropdown').classList.remove('open');expDeleteAdSet('${a.adset_id}','${a.name}')">🗑 Excluir</button>
              </div>
            </div>
          </td>
        </tr>`).join('')}</tbody>
      </table></div>`; })()}
    </div>`;
  }

  function renderTargeting(tg) {
    if (!tg || !Object.keys(tg).length)
      return '<span style="color:var(--muted);font-size:12px">Sem dados de targeting sincronizados.</span>';

    // ── helpers locais ──
    const tgTag  = (v, color) => `<span style="background:var(--surface2);border:1px solid ${color||'var(--border)'};border-radius:4px;padding:2px 7px;font-size:11px;margin:2px;display:inline-block">${v}</span>`;
    const tgTagList = (arr, key='name', color) => (arr||[]).map(x => tgTag(x[key]||x, color)).join('') || null;
    const tgRow  = (label, content, tipText) => content
      ? `<div style="margin-bottom:6px">
           <div style="font-size:10px;color:var(--muted);margin-bottom:3px;text-transform:uppercase;letter-spacing:.5px">${label}${tipText ? ' '+tip(tipText) : ''}</div>
           <div>${content}</div>
         </div>`
      : '';
    const tgSection = (title, rows, borderColor) => {
      const body = rows.join('');
      if (!body) return '';
      return `<div style="border-left:3px solid ${borderColor};padding-left:10px;margin-bottom:12px">
        <div style="font-size:11px;font-weight:600;color:${borderColor};margin-bottom:8px;text-transform:uppercase;letter-spacing:.7px">${title}</div>
        ${body}
      </div>`;
    };

    // ── DEMOGRÁFICO ──
    const geo    = tg.geo_locations || {};
    const excGeo = tg.excluded_geo_locations || {};
    const ages   = (tg.age_min||tg.age_max) ? tgTag(`${tg.age_min||'?'} – ${tg.age_max||'?'} anos`) : null;
    const genderMap = {1:'Masculino', 2:'Feminino'};
    const genders = (tg.genders||[]).length ? tgTagList(tg.genders.map(g=>({name:genderMap[g]||String(g)}))) : null;
    const locales = (tg.locales||[]).length ? tgTagList(tg.locales.map(l=>({name:l}))) : null;

    const demoRows = [
      tgRow('Faixa Etária', ages, 'Faixa etária do público-alvo. Mínimo: 13 anos. Máximo: 65+ (significa "65 anos ou mais").'),
      tgRow('Gênero', genders, 'Gêneros segmentados. 1 = Masculino, 2 = Feminino. Ausente = todos os gêneros.'),
      tgRow('Idiomas', locales, 'Idiomas do navegador/dispositivo para filtrar o público.'),
    ];

    // ── LOCALIZAÇÃO (incluída) ──
    const incCountries = tgTagList(geo.countries?.map(c=>({name:c})));
    const incRegions   = tgTagList(geo.regions);
    const incCities    = tgTagList(geo.cities);
    const incZips      = tgTagList(geo.zips, 'name');
    const incPlaces    = tgTagList(geo.place_page_set_ids?.map(x=>({name:x})));
    const incCustom    = tgTagList(geo.custom_locations?.map(x=>({name:x.name||x.address||JSON.stringify(x)})));
    const locIncRows = [
      tgRow('Países', incCountries, 'Países que receberão os anúncios.'),
      tgRow('Regiões / Estados', incRegions, 'Estados ou regiões segmentados dentro dos países selecionados.'),
      tgRow('Cidades', incCities, 'Cidades específicas segmentadas. Pode incluir raio de cobertura ao redor da cidade.'),
      tgRow('CEPs / Postais', incZips, 'Códigos postais ou CEPs segmentados para alcance geográfico preciso.'),
      tgRow('Lugares (Page Sets)', incPlaces, 'Segmentação por conjuntos de lugares (Page Sets) — locais físicos cadastrados no Meta.'),
      tgRow('Locais Customizados', incCustom, 'Localizações personalizadas por endereço ou coordenadas geográficas.'),
    ];

    // ── LOCALIZAÇÃO (excluída) ──
    const exCountries = tgTagList(excGeo.countries?.map(c=>({name:c})));
    const exRegions   = tgTagList(excGeo.regions);
    const exCities    = tgTagList(excGeo.cities);
    const exZips      = tgTagList(excGeo.zips, 'name');
    const locExRows = [
      tgRow('Países excl.', exCountries, 'Países explicitamente excluídos do alcance dos anúncios.'),
      tgRow('Regiões excl.', exRegions, 'Regiões ou estados excluídos do alcance.'),
      tgRow('Cidades excl.', exCities, 'Cidades excluídas do alcance.'),
      tgRow('CEPs excl.', exZips, 'Códigos postais excluídos do alcance.'),
    ];

    // ── INTERESSES / COMPORTAMENTOS (flexible_spec = OU entre grupos, E dentro do grupo) ──
    const flexRows = [];
    (tg.flexible_spec||[]).forEach((group, i) => {
      const interests  = tgTagList(group.interests);
      const behaviors  = tgTagList(group.behaviors);
      const education  = tgTagList(group.education_statuses?.map(s=>({name:s})));
      const lifeEvents = tgTagList(group.life_events);
      const workPos    = tgTagList(group.work_positions);
      const industries = tgTagList(group.industries);
      const politics   = tgTagList(group.politics?.map(s=>({name:s})));
      const grpRows = [
        tgRow('Interesses', interests, 'Segmentos de interesse da plataforma Meta usados para alcançar pessoas com afinidade com o tema.'),
        tgRow('Comportamentos', behaviors, 'Segmentos baseados no comportamento de compra, uso de dispositivo ou outros padrões comportamentais.'),
        tgRow('Eventos de Vida', lifeEvents, 'Segmentos baseados em mudanças recentes na vida do usuário (ex: noivado, mudança de cidade, formatura).'),
        tgRow('Educação', education, 'Segmentação por nível de escolaridade.'),
        tgRow('Cargos', workPos, 'Segmentação por cargo ou função profissional declarada no perfil.'),
        tgRow('Indústrias', industries, 'Segmentação por setor econômico ou indústria de atuação.'),
        tgRow('Política', politics, 'Segmentação por afinidade política (disponível apenas nos EUA).'),
      ].join('');
      if (grpRows) flexRows.push(`<div style="margin-bottom:6px"><div style="font-size:10px;color:var(--muted);margin-bottom:3px">GRUPO ${i+1} (qualquer um)</div>${grpRows}</div>`);
    });

    // ── EXCLUSÕES de interesse ──
    const excSpec = tg.exclusions || {};
    const excInterests  = tgTagList(excSpec.interests, 'name', 'var(--red)');
    const excBehaviors  = tgTagList(excSpec.behaviors, 'name', 'var(--red)');
    const excLifeEvents = tgTagList(excSpec.life_events, 'name', 'var(--red)');
    const excSpecRows = [
      tgRow('Interesses excl.', excInterests, 'Interesses explicitamente excluídos — pessoas com esses interesses não verão o anúncio.'),
      tgRow('Comportamentos excl.', excBehaviors, 'Comportamentos excluídos — pessoas com esses padrões não serão alcançadas.'),
      tgRow('Eventos de Vida excl.', excLifeEvents, 'Eventos de vida excluídos da segmentação.'),
    ];

    // ── PÚBLICOS ──
    const customAuds    = tgTagList(tg.custom_audiences);
    const excCustomAuds = tgTagList(tg.excluded_custom_audiences, 'name', 'var(--red)');
    const connections   = tgTagList(tg.connections?.map(c=>({name:c.id||c.name||JSON.stringify(c)})));
    const excConns      = tgTagList(tg.excluded_connections?.map(c=>({name:c.id||c.name||JSON.stringify(c)})), 'name', 'var(--red)');
    const friendsConns  = tgTagList(tg.friends_of_connections?.map(c=>({name:c.id||c.name||JSON.stringify(c)})));
    const audienceRows = [
      tgRow('Públicos Customizados', customAuds, 'Públicos criados a partir de dados próprios: lista de clientes, visitantes do site via pixel, engajadores de perfil ou vídeo.'),
      tgRow('Públicos Excluídos', excCustomAuds, 'Públicos customizados explicitamente excluídos — pessoas nestes públicos não verão o anúncio.'),
      tgRow('Conexões (Páginas/Apps)', connections, 'Segmenta pessoas que já têm conexão com sua página, app ou evento no Facebook.'),
      tgRow('Conexões excl.', excConns, 'Exclui pessoas com conexão existente com sua página ou app.'),
      tgRow('Amigos de Conexões', friendsConns, 'Alcança amigos de pessoas que já têm conexão com sua página ou app.'),
    ];

    // ── DISPOSITIVOS / PLATAFORMAS ──
    const platforms   = tgTagList((tg.publisher_platforms||[]).map(x=>({name:x})));
    const fbPos       = tgTagList((tg.facebook_positions||[]).map(x=>({name:x})));
    const igPos       = tgTagList((tg.instagram_positions||[]).map(x=>({name:x})));
    const anPos       = tgTagList((tg.audience_network_positions||[]).map(x=>({name:x})));
    const devices     = tgTagList((tg.device_platforms||[]).map(x=>({name:x})));
    const userOS      = tgTagList((tg.user_os||[]).map(x=>({name:x})));
    const userDevice  = tgTagList((tg.user_device||[]).map(x=>({name:x})));
    const deviceRows = [
      tgRow('Plataformas', platforms, 'Plataformas onde os anúncios serão exibidos: facebook, instagram, audience_network, messenger.'),
      tgRow('Posições Facebook', fbPos, 'Posicionamentos específicos no Facebook: feed, right_hand_column, video_feeds, marketplace, stories, reels, etc.'),
      tgRow('Posições Instagram', igPos, 'Posicionamentos específicos no Instagram: stream (feed), story, reels, explore, explore_home.'),
      tgRow('Posições Audience Network', anPos, 'Posicionamentos na Audience Network (apps e sites parceiros): classic, rewarded_video, instream_video.'),
      tgRow('Dispositivos', devices, 'Tipo de dispositivo: mobile (celular/tablet) ou desktop.'),
      tgRow('Sistemas Operacionais', userOS, 'Sistema operacional do dispositivo: iOS, Android, etc. Útil para campanhas de apps.'),
      tgRow('Modelos de Dispositivo', userDevice, 'Modelos específicos de dispositivo mobile segmentados (ex: iPhone 14, Samsung Galaxy S23).'),
    ];

    const html = [
      tgSection('Demográfico', demoRows, 'var(--blue)'),
      tgSection('Localização incluída', locIncRows),
      Object.keys(excGeo).length ? tgSection('Localização excluída', locExRows, 'var(--red)') : '',
      flexRows.length ? tgSection('Interesses & Comportamentos', flexRows, 'var(--purple)') : '',
      (excInterests||excBehaviors||excLifeEvents) ? tgSection('Exclusões de interesse', excSpecRows, 'var(--red)') : '',
      tgSection('Públicos', audienceRows, 'var(--cyan)'),
      tgSection('Dispositivos & Plataformas', deviceRows, 'var(--yellow)'),
    ].join('');

    return `
      ${html || '<span style="color:var(--muted);font-size:12px">Nenhum campo de targeting reconhecido.</span>'}
      <details style="margin-top:10px">
        <summary style="cursor:pointer;font-size:11px;color:var(--muted)">JSON completo do targeting</summary>
        <pre class="json" style="margin-top:8px">${JSON.stringify(tg,null,2)}</pre>
      </details>`;
  }

  function renderAdSetDetail() {
    const a = S.adset, t = totals(S.adsetInsights?.data), tg = a.targeting || {};
    return `
    <div class="card">
      <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Conjunto: ${a.name} <span style="font-size:11px;color:var(--muted)">${a.adset_id}</span></span>
        <button class="btn btn-ghost btn-sm" title="Dispara job de insights para este conjunto no período selecionado" onclick="expSyncInsights('adsets','adset_id','${a.adset_id}')">⚡ Sync Insights</button>
      </div>
      ${infoGrid([
        ['Status',statusBadge(a.status),'Status configurado: ACTIVE (ativo), PAUSED (pausado), DELETED, ARCHIVED.'],
        ['Status Efetivo',statusBadge(a.effective_status),'Estado real de entrega. Considera status do conjunto E da campanha pai. Pode ser ACTIVE, PAUSED, CAMPAIGN_PAUSED, IN_PROCESS, WITH_ISSUES.'],
        ['Status Config.',a.configured_status||'-','Sinônimo de Status — valor explicitamente configurado pelo usuário, sem considerar fatores externos.'],
        ['Estado Auto/Manual',a.automatic_manual_state||'-','Indica se o conjunto usa lances automáticos (AUTO) ou manuais (MANUAL). Automático = sistema decide o lance.'],
        ['Objetivo',a.optimization_goal||'-','Evento de otimização: LINK_CLICKS, LANDING_PAGE_VIEWS, CONVERSIONS, REACH, IMPRESSIONS, etc. Define como o algoritmo distribui o orçamento.'],
        ['Evento de Cobrança',a.billing_event||'-','Evento pelo qual você é cobrado: LINK_CLICKS (CPC), IMPRESSIONS (CPM), PAGE_LIKES, POST_ENGAGEMENT, THRUPLAY.'],
        ['Estratégia de Lance',a.bid_strategy||'-','LOWEST_COST_WITHOUT_CAP: automático sem teto. LOWEST_COST_WITH_BID_CAP: teto de lance manual. COST_CAP: limita custo médio por resultado.'],
        ['Lance',fmt.budget(a.bid_amount),'Valor máximo de lance em centavos. Obrigatório quando a estratégia é BID_CAP ou COST_CAP.'],
        ['Orçamento Diário',fmt.budget(a.daily_budget),'Orçamento diário do conjunto em centavos. Usado em ABO (orçamento no conjunto). Nulo em CBO (orçamento na campanha).'],
        ['Orçamento Vit.',fmt.budget(a.lifetime_budget),'Orçamento total do conjunto pelo período de veiculação. Incompatível com orçamento diário.'],
        ['Restante',fmt.budget(a.budget_remaining),'Saldo disponível para uso neste conjunto no período atual.'],
        ['Gasto Mín. Diário',fmt.budget(a.daily_min_spend_target),'Gasto mínimo diário garantido para este conjunto. Útil quando há múltiplos conjuntos competindo.'],
        ['Teto Gasto Diário',fmt.budget(a.daily_spend_cap),'Teto de gasto diário para este conjunto. Não pode ser excedido mesmo se houver budget disponível.'],
        ['Impr. Vitalícias',fmt.num(a.lifetime_imps),'Total de impressões ao longo de toda a vida do conjunto.'],
        ['Destino',a.destination_type||'-','Tipo de destino do clique: WEBSITE, APP, MESSENGER, WHATSAPP, INSTAGRAM_DIRECT, ON_POST.'],
        ['Atribuição',a.campaign_attribution||'-','Janela de atribuição: período em que conversões são creditadas ao anúncio após clique ou visualização.'],
        ['Tempo Ativo',a.campaign_active_time?a.campaign_active_time+'s':'-','Tempo total em segundos que este conjunto ficou com status ACTIVE.'],
        ['Criativo Dinâmico',a.is_dynamic_creative!=null?(a.is_dynamic_creative?'Sim':'Não'):'-','Se ativo, a Meta combina automaticamente diferentes elementos do criativo para otimizar resultados (Dynamic Creative Optimization).'],
        ['Início',fmt.ts(a.start_time),'Data e hora de início do conjunto.'],
        ['Fim',fmt.ts(a.end_time),'Data e hora de término. Nulo = sem data de término definida.'],
        ['Criado no Meta',fmt.ts(a.meta_created_time),'Data e hora de criação do conjunto na Meta API.'],
        ['Atualizado no Meta',fmt.ts(a.meta_updated_time),'Última vez que o conjunto foi modificado na Meta API.'],
        ['Sincronizado',fmt.ts(a.synced_at),'Última vez que os dados foram sincronizados do Meta para o banco local.'],
        ['Campaign ID',`<span class="mono" style="font-size:11px">${a.campaign_id}</span>`,'ID da campanha pai a que este conjunto pertence.'],
      ])}
      <div class="section-label">Publico-alvo (Targeting)</div>
      ${renderTargeting(tg)}
    </div>
    <div class="card">
      <div class="card-title">Insights do Conjunto</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">${miniTiles(t)}</div>
      ${S.adsetInsights?.data?.length ? `
        <div style="position:relative;height:260px;margin-bottom:16px">
          <canvas id="chart-adset"></canvas>
        </div>
        <details>
          <summary style="cursor:pointer;font-size:12px;color:var(--blue);margin-bottom:8px">Ver tabela completa (${S.adsetInsights.data.length} linhas)</summary>
          ${insightTable(S.adsetInsights.data,'adset_name',[
            {label:'Impr. Completas',tip:'Total de impressões ao longo de toda a vida do conjunto.',                                            render:r=>fmt.num(r.full_view_impressions)},
            {label:'Alc. Completo',  tip:'Alcance total (pessoas únicas) ao longo de toda a vida do conjunto.',                                render:r=>fmt.num(r.full_view_reach)},
            {label:'Plays',          tip:'Número de vezes que o vídeo foi iniciado.',                                                          render:r=>videoVal(r.video_play_actions)!=null?fmt.num(videoVal(r.video_play_actions)):'-'},
            {label:'30s',            tip:'Visualizações com pelo menos 30 segundos assistidos. Indica engajamento qualificado.',                render:r=>videoVal(r.video_30_sec_watched_actions)!=null?fmt.num(videoVal(r.video_30_sec_watched_actions)):'-'},
            {label:'Tempo Médio',    tip:'Tempo médio em segundos que os usuários assistiram ao vídeo.',                                       render:r=>videoVal(r.video_avg_time_watched_actions)!=null?videoVal(r.video_avg_time_watched_actions).toFixed(1)+'s':'-'},
            {label:'25%',            tip:'Visualizações que chegaram a 25% do vídeo.',                                                         render:r=>videoVal(r.video_p25_watched_actions)!=null?fmt.num(videoVal(r.video_p25_watched_actions)):'-'},
            {label:'50%',            tip:'Visualizações que chegaram a 50% do vídeo.',                                                         render:r=>videoVal(r.video_p50_watched_actions)!=null?fmt.num(videoVal(r.video_p50_watched_actions)):'-'},
            {label:'75%',            tip:'Visualizações que chegaram a 75% do vídeo.',                                                         render:r=>videoVal(r.video_p75_watched_actions)!=null?fmt.num(videoVal(r.video_p75_watched_actions)):'-'},
            {label:'95%',            tip:'Visualizações que chegaram a 95% do vídeo.',                                                         render:r=>videoVal(r.video_p95_watched_actions)!=null?fmt.num(videoVal(r.video_p95_watched_actions)):'-'},
            {label:'100%',           tip:'Visualizações completas — usuários que assistiram o vídeo inteiro.',                                 render:r=>videoVal(r.video_p100_watched_actions)!=null?fmt.num(videoVal(r.video_p100_watched_actions)):'-'},
          ])}
        </details>` : ''}
    </div>
    <div class="card">
      <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Anuncios (${(S.ads||[]).length})</span>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn btn-ghost btn-sm" onclick="expToggleAdColFilter()" title="Escolher colunas visíveis">⚙ Colunas</button>
          <button class="btn btn-primary btn-sm" onclick="expCreateAd('${a.adset_id}')">+ Novo Anuncio</button>
        </div>
      </div>
      ${!(S.ads||[]).length ? '<div class="empty">Nenhum anuncio encontrado.</div>' :
      (() => { const vd = visibleAdCols; return `
      ${renderAdColFilterPanel()}
      <div class="table-wrap"><table>
        <thead><tr>
          ${vd.id       ? `<th>ID ${tip('Identificador único do anúncio na Meta API.')}</th>` : ''}
          <th>Nome ${tip('Nome do anúncio definido na criação.')}</th>
          <th>Status ${tip('Status configurado: ACTIVE (ativo), PAUSED (pausado), DELETED (excluído), ARCHIVED (arquivado).')}</th>
          ${vd.statusEfet ? `<th>Status Efetivo ${tip('Estado real de entrega, considerando o status do anúncio, do conjunto pai e da campanha. Um anúncio ACTIVE só entrega se conjunto e campanha também estiverem ativos.')}</th>` : ''}
          ${vd.creative   ? `<th>ID do Criativo ${tip('Identificador do criativo vinculado. O criativo contém a imagem ou vídeo, o texto, o título e o botão de ação (CTA). Clique em "Ver" para abrir o detalhe completo.')}</th>` : ''}
          ${vd.lance      ? `<th class="num">Lance ${tip('Lance específico definido para este anúncio, em centavos. Na maioria dos casos é nulo — o anúncio herda o lance configurado no conjunto pai.')}</th>` : ''}
          ${vd.dominio    ? `<th>Domínio ${tip('Domínio onde ocorrem as conversões rastreadas pelo pixel. Necessário para verificação de domínio pela Meta e para rastrear eventos corretamente.')}</th>` : ''}
          ${vd.criado     ? `<th>Criado ${tip('Data e hora em que o anúncio foi criado na Meta API.')}</th>` : ''}
          <th>Ações ${tip('Ver: abre o detalhe completo com criativo e métricas. Pausar/Ativar: altera o status do anúncio individualmente. Editar: abre o formulário de edição. Excluir: remove permanentemente.')}</th>
        </tr></thead>
        <tbody>${S.ads.map(ad=>`<tr>
          ${vd.id       ? `<td class="mono" style="font-size:11px">${ad.ad_id}</td>` : ''}
          <td><strong>${ad.name}</strong></td>
          <td>${statusBadge(ad.status)}</td>
          ${vd.statusEfet ? `<td>${statusBadge(ad.effective_status)}</td>` : ''}
          ${vd.creative   ? `<td class="mono" style="font-size:11px">${ad.creative_id||'-'}</td>` : ''}
          ${vd.lance      ? `<td class="num">${fmt.budget(ad.bid_amount)}</td>` : ''}
          ${vd.dominio    ? `<td class="muted" style="font-size:11px">${ad.conversion_domain||'-'}</td>` : ''}
          ${vd.criado     ? `<td class="muted">${fmt.date(ad.meta_created_time)}</td>` : ''}
          <td style="white-space:nowrap">
            <button class="btn btn-primary btn-sm" title="Abre o detalhe completo com criativo, métricas e histórico do anúncio" onclick="expSelectAd('${ad.ad_id}')">Ver &#9658;</button>
            <div class="action-dropdown" style="display:inline-block;margin-left:4px">
              <button class="btn btn-ghost btn-sm dropdown-toggle" onclick="event.stopPropagation();this.closest('.action-dropdown').classList.toggle('open')">Ações ▾</button>
              <div class="dropdown-menu">
                <button class="dropdown-item" title="${ad.status === 'ACTIVE' ? 'Pausa este anúncio individualmente. O conjunto e a campanha continuam ativos.' : 'Reativa este anúncio. A entrega depende também do status do conjunto e da campanha pai.'}" onclick="this.closest('.action-dropdown').classList.remove('open');expChangeStatus('ads','${ad.ad_id}','${ad.status}')">⇄ ${ad.status === 'ACTIVE' ? 'Pausar' : 'Ativar'}</button>
                <button class="dropdown-item" title="Abre o formulário para editar o criativo, o domínio de conversão e o lance deste anúncio." onclick="this.closest('.action-dropdown').classList.remove('open');expEditAd('${ad.ad_id}')">✎ Editar</button>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item danger" title="Exclui permanentemente este anúncio. O criativo vinculado não é excluído automaticamente. Esta ação não pode ser desfeita." onclick="this.closest('.action-dropdown').classList.remove('open');expDeleteAd('${ad.ad_id}','${ad.name}')">🗑 Excluir</button>
              </div>
            </div>
          </td>
        </tr>`).join('')}</tbody>
      </table></div>`; })()}
    </div>`;
  }

  function _renderAssetFeedSpec(afs) {
    const listSection = (label, items, key = 'text') => {
      if (!items || !items.length) return '';
      return `<div style="margin-bottom:10px">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">${label} (${items.length} variação${items.length>1?'ões':''})</div>
        ${items.map((x, i) => `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:6px 10px;font-size:12px;margin-bottom:4px;line-height:1.5">
          <span style="color:var(--muted);font-size:10px">${i+1}.</span> ${typeof x === 'string' ? x : (x[key] || JSON.stringify(x))}
        </div>`).join('')}
      </div>`;
    };
    const ctaList = (afs.call_to_action_types || []).length
      ? `<div style="margin-bottom:10px">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">CTAs</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${afs.call_to_action_types.map(c => `<span style="background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:3px 8px;font-size:11px">${c}</span>`).join('')}
          </div>
        </div>` : '';
    const hasContent = (afs.bodies||afs.titles||afs.descriptions||afs.call_to_action_types||afs.images||afs.videos);
    if (!hasContent) {
      return `<details style="margin-top:8px"><summary style="cursor:pointer;font-size:11px;color:var(--muted)">asset_feed_spec (JSON)</summary><pre class="json" style="margin-top:8px">${JSON.stringify(afs,null,2)}</pre></details>`;
    }
    return `<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px">
      <div style="font-size:11px;font-weight:600;color:var(--blue);margin-bottom:10px">
        Variações de Conteúdo (asset_feed_spec) ${tip('Este criativo usa múltiplas variações de texto. A Meta realiza testes A/B automáticos entre elas para otimizar a entrega.')}
      </div>
      ${listSection('Textos Principais', afs.bodies, 'text')}
      ${listSection('Títulos', afs.titles, 'text')}
      ${listSection('Descrições', afs.descriptions, 'text')}
      ${ctaList}
      ${(afs.images||[]).length?`<div style="font-size:11px;color:var(--muted)">${afs.images.length} imagem(ns) no feed</div>`:''}
      ${(afs.videos||[]).length?`<div style="font-size:11px;color:var(--muted)">${afs.videos.length} vídeo(s) no feed</div>`:''}
      <details style="margin-top:8px"><summary style="cursor:pointer;font-size:11px;color:var(--muted)">Ver JSON completo</summary><pre class="json" style="margin-top:8px">${JSON.stringify(afs,null,2)}</pre></details>
    </div>`;
  }

  // Labels de exibição para posicionamentos
  const _platformLabels = {
    facebook: 'Facebook', instagram: 'Instagram',
    audience_network: 'Audience Network', messenger: 'Messenger',
  };
  const _positionLabels = {
    feed: 'Feed', right_hand_column: 'Coluna Direita', marketplace: 'Marketplace',
    video_feeds: 'Video Feeds', stories: 'Stories', reels: 'Reels',
    search: 'Pesquisa', stream: 'Feed (IG)', story: 'Stories', explore: 'Explorar',
    explore_home: 'Explorar Home', instream_video: 'Instream Vídeo',
    rewarded_video: 'Vídeo Premiado', classic: 'AN Classic',
    instant_article: 'Instant Article', an_classic: 'AN Classic',
  };

  function _renderPlacementCard(placements) {
    const rows = placements?.data || [];
    if (!rows.length) return `
    <div class="card">
      <div class="card-title">Posicionamentos ${tip('Distribuição de impressões e gasto do anúncio por posicionamento (Facebook Feed, Instagram Reels, Stories, etc.).\nSincronize via "⚡ Sync Posicionamentos" para ver os dados.')}</div>
      <div style="color:var(--muted);font-size:12px">Sem dados de posicionamento. Use o botão "⚡ Sync Posicionamentos" para sincronizar.</div>
    </div>`;

    // Calcula totais para percentuais
    const totalImpr = rows.reduce((s, r) => s + (r.impressions || 0), 0);
    const totalSpend = rows.reduce((s, r) => s + Number(r.spend || 0), 0);

    return `
    <div class="card">
      <div class="card-title">Posicionamentos ${tip('Distribuição de impressões e gasto do anúncio por posicionamento.\n\nPlataformas: Facebook, Instagram, Audience Network, Messenger.\nPosições: Feed, Reels, Stories, Explorar, Marketplace, Coluna Direita, etc.\n\nOrdenado por impressões (maior primeiro).')}</div>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>Plataforma</th>
          <th>Posição</th>
          <th class="num">Impressões</th>
          <th class="num">% Impr.</th>
          <th class="num">Gasto</th>
          <th class="num">% Gasto</th>
          <th class="num">Cliques</th>
          <th class="num">CTR</th>
          <th class="num">CPM</th>
        </tr></thead>
        <tbody>${rows.map(r => {
          const pctImpr  = totalImpr  ? (r.impressions / totalImpr * 100).toFixed(1) : '-';
          const pctSpend = totalSpend ? (Number(r.spend || 0) / totalSpend * 100).toFixed(1) : '-';
          const platform = _platformLabels[r.publisher_platform] || r.publisher_platform;
          const position = _positionLabels[r.platform_position]  || r.platform_position;
          return `<tr>
            <td style="font-size:12px">${platform}</td>
            <td class="muted" style="font-size:12px">${position}</td>
            <td class="num">${fmt.num(r.impressions)}</td>
            <td class="num" style="color:var(--muted)">${pctImpr}%</td>
            <td class="num">${r.spend != null ? fmt.currency(r.spend) : '-'}</td>
            <td class="num" style="color:var(--muted)">${pctSpend}%</td>
            <td class="num">${fmt.num(r.clicks)}</td>
            <td class="num">${r.ctr != null ? Number(r.ctr).toFixed(2)+'%' : '-'}</td>
            <td class="num">${r.cpm != null ? fmt.currency(r.cpm) : '-'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>`;
  }

  function renderAdDetail() {
    const ad = S.ad, t = totals(S.adInsights?.data), cr = S.creative;
    const crHtml = !cr
      ? `<div style="color:var(--muted);font-size:12px">Criativo nao sincronizado (creative_id: <span class="mono">${ad.creative_id||'-'}</span>).</div>`
      : `<div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start">
          ${cr.thumbnail_url?`<img src="${cr.thumbnail_url}" style="width:130px;height:130px;object-fit:cover;border-radius:8px;border:1px solid var(--border);flex-shrink:0" />`:''}
          <div style="flex:1;min-width:220px">
            ${infoGrid([
              ['ID',`<span class="mono" style="font-size:11px">${cr.creative_id}</span>`,'Identificador único do criativo na Meta API.'],
              ['Nome',cr.name||'-','Nome do criativo. Interno — não aparece para o usuário final.'],
              ['Status',statusBadge(cr.status),'Status do criativo: ACTIVE (ativo), PAUSED (pausado), DELETED (excluído).'],
              ['Tipo',cr.object_type||'-','Tipo do criativo: IMAGE (imagem estática), VIDEO, SHARE (post compartilhado), STATUS.'],
              ['CTA',cr.call_to_action_type||'-','Botão de chamada para ação exibido no anúncio: LEARN_MORE, SHOP_NOW, SIGN_UP, CONTACT_US, etc.'],
              ['Video ID',cr.video_id||'-','ID do vídeo na biblioteca de mídia da conta. Presente apenas em criativos de vídeo.']])}
            ${cr.title?`<div style="margin-bottom:10px"><div style="font-size:10px;color:var(--muted)">TÍTULO ${tip('Título do anúncio. Aparece no headline abaixo da mídia.')}</div><div style="font-size:15px;font-weight:600;margin-top:3px">${cr.title}</div></div>`:''}
            ${cr.body?`<div style="margin-bottom:10px"><div style="font-size:10px;color:var(--muted)">TEXTO PRINCIPAL ${tip('Texto principal exibido acima da mídia na maioria dos formatos de anúncio.')}</div><div style="font-size:13px;margin-top:4px;line-height:1.6;white-space:pre-wrap">${cr.body}</div></div>`:''}
            ${cr.image_url?`<div><div style="font-size:10px;color:var(--muted)">IMAGEM ${tip('URL da imagem usada no criativo. Clique em "Ver imagem" para visualizar em tamanho original.')}</div><a href="${cr.image_url}" target="_blank" style="color:var(--blue);font-size:12px">Ver imagem ↗</a></div>`:''}
          </div>
        </div>
        ${cr.object_story_spec?`<details style="margin-top:14px"><summary style="cursor:pointer;font-size:11px;color:var(--muted)">object_story_spec (JSON)</summary><pre class="json" style="margin-top:8px">${JSON.stringify(cr.object_story_spec,null,2)}</pre></details>`:''}
        ${cr.asset_feed_spec ? _renderAssetFeedSpec(cr.asset_feed_spec) : ''}`;
    return `
    <div class="card">
      <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Anuncio: ${ad.name} <span style="font-size:11px;color:var(--muted)">${ad.ad_id}</span></span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" title="Abre o formulário de edição do anúncio" onclick="expEditAd('${ad.ad_id}')">&#9998; Editar</button>
          <button class="btn btn-ghost btn-sm" title="Dispara job de insights para este anúncio no período selecionado" onclick="expSyncInsights('ads','ad_id','${ad.ad_id}')">⚡ Sync Insights</button>
          <button class="btn btn-ghost btn-sm" title="Dispara job de insights de posicionamento (breakdown por Feed, Reels, Stories, etc.)" onclick="expSyncInsights('placements','ad_id','${ad.ad_id}')">⚡ Sync Posicionamentos</button>
        </div>
      </div>
      ${infoGrid([
        ['Status',statusBadge(ad.status),'Status configurado: ACTIVE (ativo), PAUSED (pausado), DELETED, ARCHIVED.'],
        ['Status Efetivo',statusBadge(ad.effective_status),'Estado real de entrega considerando status do anúncio, conjunto e campanha pai.'],
        ['Status Config.',ad.configured_status||'-','Valor explicitamente configurado para este anúncio, sem considerar fatores externos.'],
        ['ID do Criativo',`<span class="mono" style="font-size:11px">${ad.creative_id||'-'}</span>`,'ID do criativo associado a este anúncio na Meta API. Veja o card "Criativo" abaixo para imagem, texto e CTA.'],
        ['Lance',fmt.budget(ad.bid_amount),'Lance específico para este anúncio em centavos. Geralmente nulo — o lance é definido no conjunto pai.'],
        ['Domínio de Conversão',ad.conversion_domain||'-','Domínio onde ocorrem as conversões rastreadas pelo pixel. Ex.: seusite.com.br. Usado para verificação de domínio.'],
        ['Sequência',ad.display_sequence!=null?ad.display_sequence:'-','Posição do anúncio em campanhas de storytelling sequencial. 1 = primeiro anúncio da sequência.'],
        ['Audiência de Engajamento',ad.engagement_audience!=null?(ad.engagement_audience?'Sim':'Não'):'-','Se ativo, cria automaticamente uma audiência personalizada com pessoas que interagiram com este anúncio.'],
        ['Tempo Ativo',ad.ad_active_time?ad.ad_active_time+'s':'-','Tempo total em segundos que este anúncio ficou com status ACTIVE.'],
        ['Início Agendado',fmt.ts(ad.ad_schedule_start_time),'Horário de início agendado específico para este anúncio (diferente do conjunto pai, se configurado).'],
        ['Fim Agendado',fmt.ts(ad.ad_schedule_end_time),'Horário de término agendado específico para este anúncio.'],
        ['Criado no Meta',fmt.ts(ad.meta_created_time),'Data e hora de criação do anúncio na Meta API.'],
        ['Atualizado no Meta',fmt.ts(ad.meta_updated_time),'Última vez que o anúncio foi modificado na Meta API.'],
        ['Sincronizado',fmt.ts(ad.synced_at),'Última vez que os dados foram sincronizados do Meta para o banco local.'],
        ['AdSet ID',`<span class="mono" style="font-size:11px">${ad.adset_id}</span>`,'ID do conjunto de anúncios pai.'],
        ['Campaign ID',`<span class="mono" style="font-size:11px">${ad.campaign_id}</span>`,'ID da campanha avó deste anúncio.'],
      ])}
    </div>
    <div class="card">
      <div class="card-title">Insights do Anuncio</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">${miniTiles(t)}</div>
      ${S.adInsights?.data?.length ? `
        <div style="position:relative;height:260px;margin-bottom:16px">
          <canvas id="chart-ad"></canvas>
        </div>
        <details>
          <summary style="cursor:pointer;font-size:12px;color:var(--blue);margin-bottom:8px">Ver tabela completa (${S.adInsights.data.length} linhas)</summary>
          ${insightTable(S.adInsights.data,'ad_name',[
            {label:'Custo/Clique Único',tip:'Custo médio por clique único (pessoas únicas). Exclui múltiplos cliques da mesma pessoa.',        render:r=>fmt.currency(r.cost_per_unique_click)},
            {label:'Plays',             tip:'Número de vezes que o vídeo foi iniciado.',                                                      render:r=>videoVal(r.video_play_actions)!=null?fmt.num(videoVal(r.video_play_actions)):'-'},
            {label:'30s',               tip:'Visualizações com pelo menos 30 segundos assistidos. Indica engajamento qualificado.',            render:r=>videoVal(r.video_30_sec_watched_actions)!=null?fmt.num(videoVal(r.video_30_sec_watched_actions)):'-'},
            {label:'Tempo Médio',       tip:'Tempo médio em segundos que os usuários assistiram ao vídeo.',                                   render:r=>videoVal(r.video_avg_time_watched_actions)!=null?videoVal(r.video_avg_time_watched_actions).toFixed(1)+'s':'-'},
            {label:'25%',               tip:'Visualizações que chegaram a 25% do vídeo.',                                                     render:r=>videoVal(r.video_p25_watched_actions)!=null?fmt.num(videoVal(r.video_p25_watched_actions)):'-'},
            {label:'50%',               tip:'Visualizações que chegaram a 50% do vídeo.',                                                     render:r=>videoVal(r.video_p50_watched_actions)!=null?fmt.num(videoVal(r.video_p50_watched_actions)):'-'},
            {label:'75%',               tip:'Visualizações que chegaram a 75% do vídeo.',                                                     render:r=>videoVal(r.video_p75_watched_actions)!=null?fmt.num(videoVal(r.video_p75_watched_actions)):'-'},
            {label:'95%',               tip:'Visualizações que chegaram a 95% do vídeo.',                                                     render:r=>videoVal(r.video_p95_watched_actions)!=null?fmt.num(videoVal(r.video_p95_watched_actions)):'-'},
            {label:'100%',              tip:'Visualizações completas — usuários que assistiram o vídeo inteiro.',                             render:r=>videoVal(r.video_p100_watched_actions)!=null?fmt.num(videoVal(r.video_p100_watched_actions)):'-'},
          ])}
        </details>` : ''}
    </div>
    <div class="card">
      <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Criativo</span>
        ${ad.creative_id
          ? `<button class="btn btn-ghost btn-sm" id="btn-sync-creative"
               onclick="expSyncCreative('${ad.creative_id}')"
               title="Busca dados atualizados deste criativo na Meta API">
               &#x27F3; Sync
             </button>`
          : ''}
      </div>
      ${crHtml}
    </div>
    ${_renderPlacementCard(S.placementInsights)}`;
  }

  function render() {
    const level = S.ad ? 'ad' : S.adset ? 'adset' : S.campaign ? 'campaign' : 'campaigns';
    el.innerHTML = `
      <div class="page-header"><div><h2>Explorador</h2>
        <p>Campanhas &rsaquo; Conjuntos &rsaquo; Anuncios &rsaquo; Criativos</p></div></div>
      <div style="margin-top:20px">
        ${renderFilters()}${renderBreadcrumb()}
        ${level==='campaigns' ? renderCampaignsList()  : ''}
        ${level==='campaign'  ? renderCampaignDetail() : ''}
        ${level==='adset'     ? renderAdSetDetail()    : ''}
        ${level==='ad'        ? renderAdDetail()       : ''}
      </div>`;
    bindEvents();
    _initExplorerCharts();
  }

  function _initExplorerCharts() {
    // Campanha: spend + impressões + cliques + plays de vídeo
    if (S.campInsights?.data?.length && !S.adset) {
      buildTimelineChart('chart-camp', S.campInsights.data, [
        { label: 'Video Plays', fn: r => videoVal(r.video_play_actions), color: '#f472b6' },
      ]);
      buildVideoFunnelChart('chart-camp-video-funnel', S.campInsights.data);
    }
    // Conjunto: spend + impressões + cliques + impr. completas + plays de vídeo
    if (S.adsetInsights?.data?.length && !S.ad) {
      buildTimelineChart('chart-adset', S.adsetInsights.data, [
        { label: 'Impr. Completas', key: 'full_view_impressions', color: '#a78bfa' },
        { label: 'Video Plays', fn: r => videoVal(r.video_play_actions), color: '#f472b6' },
      ]);
    }
    // Anúncio: spend + impressões + cliques + CTR% + plays de vídeo
    if (S.adInsights?.data?.length) {
      buildTimelineChart('chart-ad', S.adInsights.data, [
        { label: 'CTR (%)', key: 'ctr', color: '#22d3ee' },
        { label: 'Video Plays', fn: r => videoVal(r.video_play_actions), color: '#f472b6' },
      ]);
    }
  }

  function bindEvents() {
    const sel = el.querySelector('#exp-account');
    if (sel) { sel.value = S.account_id; sel.onchange = e => { S.account_id = e.target.value; }; }
    const dfEl = el.querySelector('#exp-date-from');
    if (dfEl) dfEl.onchange = e => { S.dateFrom = e.target.value; saveExplorerState(); };
    const dtEl = el.querySelector('#exp-date-to');
    if (dtEl) dtEl.onchange = e => { S.dateTo = e.target.value; saveExplorerState(); };
    const granEl = el.querySelector('#exp-gran');
    if (granEl) granEl.onchange = e => { S.gran = e.target.value; saveExplorerState(); };
    const btn = el.querySelector('#btn-exp-load');
    if (btn) btn.onclick = loadCampaigns;

    // Checkboxes de seleção múltipla de campanhas
    const chkAll = el.querySelector('#chk-all-camps');
    if (chkAll) {
      chkAll.onchange = () => {
        el.querySelectorAll('.chk-camp').forEach(c => c.checked = chkAll.checked);
        _updateBulkBar();
      };
    }
    el.querySelectorAll('.chk-camp').forEach(c => {
      c.onchange = () => _updateBulkBar();
    });
  }

  async function loadCampaigns(resetPage = true) {
    S.account_id = el.querySelector('#exp-account').value;
    S.status     = el.querySelector('#exp-status').value;
    S.dateFrom   = el.querySelector('#exp-date-from')?.value || '';
    S.dateTo     = el.querySelector('#exp-date-to')?.value   || '';
    S.gran       = el.querySelector('#exp-gran')?.value      || 'daily';
    const limitSel = el.querySelector('#exp-camp-limit');
    if (limitSel) campLimit = parseInt(limitSel.value) || 20;
    if (!S.account_id) { toast('Selecione uma conta', 'error'); return; }
    if (resetPage) S.campaignsPage = 0;
    S.campaign = null; S.campInsights = null; S.campInsightsMap = {}; S.adset = null; S.adsetInsights = null;
    S.ads = null; S.ad = null; S.adInsights = null; S.placementInsights = null; S.creative = null;
    saveExplorerState();
    try {
      const params = { limit: campLimit + 1, offset: S.campaignsPage * campLimit };
      if (S.status) params.status = S.status;
      const insParams = { account_id: S.account_id, date_from: S.dateFrom || undefined, date_to: S.dateTo || undefined };
      const [result, insData] = await Promise.all([
        GET(`/accounts/${S.account_id}/campaigns`, params),
        GET('/insights/campaigns', insParams).catch(() => ({ data: [] })),
      ]);
      S.campaignsHasNext = result.length > campLimit;
      S.campaigns = result.slice(0, campLimit);
      // Agregar insights por campaign_id
      const map = {};
      for (const row of (insData.data || [])) {
        const cid = row.campaign_id;
        if (!map[cid]) map[cid] = { spend: 0, impressions: 0, clicks: 0 };
        map[cid].spend       += Number(row.spend || 0);
        map[cid].impressions += Number(row.impressions || 0);
        map[cid].clicks      += Number(row.clicks || 0);
      }
      for (const cid of Object.keys(map)) {
        const d = map[cid];
        d.ctr = d.impressions ? (d.clicks / d.impressions * 100).toFixed(2) : null;
        d.cpm = d.impressions ? (d.spend / d.impressions * 1000).toFixed(2) : null;
      }
      S.campInsightsMap = map;
      render();
    }
    catch(e) { toast(e.message, 'error'); }
  }

  window.expCampaignsPage = async (dir) => {
    S.campaignsPage += dir;
    if (S.campaignsPage < 0) S.campaignsPage = 0;
    await loadCampaigns(false);
  };

  window.expCascadePause = async (campaignId, campaignName) => {
    if (!confirm(`Pausar a campanha "${campaignName}" e todos os conjuntos e anúncios filhos?\n\nEsta ação pausa em cascata: campanha → conjuntos → anúncios.`)) return;

    const statusEl = document.createElement('div');
    statusEl.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#1e2130;border:1px solid var(--border);padding:14px 18px;border-radius:8px;font-size:12px;z-index:9999;max-width:320px';
    statusEl.textContent = 'Buscando conjuntos...';
    document.body.appendChild(statusEl);

    try {
      const adsets = await GET(`/accounts/${S.account_id}/adsets`, { campaign_id: campaignId, limit: 500 });
      let totalAds = 0;
      let doneAdsets = 0;
      let doneAds = 0;

      for (const adset of adsets) {
        const ads = await GET(`/accounts/${S.account_id}/ads`, { adset_id: adset.adset_id, limit: 500 });
        totalAds += ads.length;
        statusEl.textContent = `Pausando ${adsets.length} conjunto(s) e ~${totalAds} anúncio(s)...`;

        for (const ad of ads) {
          if (ad.status !== 'PAUSED') {
            await PATCH(`/accounts/${S.account_id}/ads/${ad.ad_id}`, { status: 'PAUSED' });
          }
          doneAds++;
          statusEl.textContent = `Anúncios: ${doneAds}/${totalAds} | Conjuntos: ${doneAdsets}/${adsets.length}`;
        }

        if (adset.status !== 'PAUSED') {
          await PATCH(`/accounts/${S.account_id}/adsets/${adset.adset_id}`, { status: 'PAUSED' });
        }
        doneAdsets++;
        statusEl.textContent = `Anúncios: ${doneAds}/${totalAds} | Conjuntos: ${doneAdsets}/${adsets.length}`;
      }

      await PATCH(`/accounts/${S.account_id}/campaigns/${campaignId}`, { status: 'PAUSED' });
      toast(`Campanha "${campaignName}" e ${doneAdsets} conjunto(s) com ${doneAds} anúncio(s) pausados.`, 'success');
      await loadCampaigns(false);
    } catch(e) {
      toast(`Erro durante pausa em cascata: ${e.message}`, 'error');
    } finally {
      statusEl.remove();
    }
  };

  window.expBack = level => {
    if (level === 'campaigns') {
      S.campaign = null; S.campInsights = null; S.adset = null; S.adsetInsights = null;
      S.ads = null; S.ad = null; S.adInsights = null; S.placementInsights = null; S.creative = null;
    } else if (level === 'campaign') {
      S.adset = null; S.adsetInsights = null; S.ads = null; S.ad = null; S.adInsights = null; S.placementInsights = null; S.creative = null;
    } else if (level === 'adset') {
      S.ad = null; S.adInsights = null; S.placementInsights = null; S.creative = null;
    }
    render();
  };

  window.expSelectCampaign = async campId => {
    if (_csPollTimer) { clearInterval(_csPollTimer); _csPollTimer = null; }
    _csCurrentJobs = [];
    try {
      const [detail, adsets, ins] = await Promise.all([
        GET(`/accounts/${S.account_id}/campaigns/${campId}`),
        GET(`/accounts/${S.account_id}/adsets`, { campaign_id: campId, limit: 200 }),
        GET('/insights/campaigns', { account_id: S.account_id, campaign_id: campId,
          date_from: S.dateFrom||undefined, date_to: S.dateTo||undefined, granularity: S.gran,
        }).catch(() => ({ data: [] })),
      ]);
      S.campaign = { ...detail, _adsets: adsets }; S.campInsights = ins;
      S.adset = null; S.adsetInsights = null; S.ads = null; S.ad = null; S.adInsights = null; S.placementInsights = null; S.creative = null;
      render();
    } catch(e) { toast(e.message, 'error'); }
  };

  window.expSelectAdSet = async adsetId => {
    try {
      const [adset, ins, ads] = await Promise.all([
        GET(`/accounts/${S.account_id}/adsets/${adsetId}`),
        GET('/insights/adsets', { account_id: S.account_id, adset_id: adsetId,
          date_from: S.dateFrom||undefined, date_to: S.dateTo||undefined, granularity: S.gran,
        }).catch(() => ({ data: [] })),
        GET(`/accounts/${S.account_id}/ads`, { adset_id: adsetId, limit: 200 }),
      ]);
      S.adset = adset; S.adsetInsights = ins; S.ads = ads;
      S.ad = null; S.adInsights = null; S.placementInsights = null; S.creative = null;
      render();
    } catch(e) { toast(e.message, 'error'); }
  };

  window.expSelectAd = async adId => {
    try {
      const [ad, ins, placements] = await Promise.all([
        GET(`/accounts/${S.account_id}/ads/${adId}`),
        GET('/insights/ads', { account_id: S.account_id, ad_id: adId,
          date_from: S.dateFrom||undefined, date_to: S.dateTo||undefined, granularity: S.gran,
        }).catch(() => ({ data: [] })),
        GET('/insights/placements', { account_id: S.account_id, ad_id: adId,
          date_from: S.dateFrom||undefined, date_to: S.dateTo||undefined,
        }).catch(() => ({ data: [] })),
      ]);
      S.ad = ad; S.adInsights = ins; S.placementInsights = placements; S.creative = null;
      if (ad.creative_id) {
        try { S.creative = await GET(`/accounts/${S.account_id}/creatives/${ad.creative_id}`); } catch(_) {}
      }
      render();
    } catch(e) { toast(e.message, 'error'); }
  };

  // ── Sync inline na campanha ──────────────────────────────────────────────
  let _csPollTimer = null;
  let _csAutoRefresh = true;
  const _TERMINAL = new Set(['completed', 'failed', 'cancelled']);

  window.expInlineSyncTypeChange = () => {
    const type = document.getElementById('cs-type')?.value;
    const chunkWrap = document.getElementById('cs-chunk-wrap');
    if (chunkWrap) chunkWrap.style.display = (type === 'structural') ? 'none' : '';
  };

  function _csRenderPanel(panel, jobDefs) {
    panel.style.display = '';
    panel.innerHTML = `
      <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <span style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Jobs em execução</span>
          <div style="display:flex;gap:6px">
            <button id="cs-auto-btn" class="btn btn-success btn-sm" onclick="csToggleAuto()"><span id="cs-auto-dot" style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#fff;margin-right:5px;animation:cs-pulse .8s ease-in-out infinite"></span>Auto-refresh: ON</button>
            <button class="btn btn-ghost btn-sm" onclick="csPollNow()">↺ Atualizar</button>
          </div>
        </div>
        <div id="cs-jobs-list">
          ${jobDefs.map(j => `
            <div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:10px 14px;margin-bottom:8px">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                <span style="font-size:12px;font-weight:600">${j.label}</span>
                <span id="cs-badge-${j.id}">${statusBadge('pending')}</span>
              </div>
              <div style="background:var(--border);border-radius:4px;height:7px;overflow:hidden;margin-bottom:5px">
                <div id="cs-bar-${j.id}" style="background:var(--blue);height:100%;width:0%;transition:width .4s"></div>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted)">
                <span id="cs-prog-${j.id}">0 / ? ${j.isInsight ? 'dias' : 'itens'}</span>
                <span class="mono" style="cursor:pointer" title="${j.id}" onclick="jobDetail('${j.id}')">${j.id.slice(0,14)}… ↗</span>
              </div>
              <div id="cs-err-${j.id}" style="font-size:11px;color:var(--red);margin-top:4px;display:none"></div>
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  async function _csPollJobs(jobDefs) {
    let allDone = true;
    for (const j of jobDefs) {
      try {
        const data = await GET(`/jobs/${j.id}`);
        const pct = data.total_days ? Math.round(data.days_processed / data.total_days * 100) : 0;
        const barEl   = document.getElementById(`cs-bar-${j.id}`);
        const badgeEl = document.getElementById(`cs-badge-${j.id}`);
        const progEl  = document.getElementById(`cs-prog-${j.id}`);
        const errEl   = document.getElementById(`cs-err-${j.id}`);
        if (barEl) {
          barEl.style.width = (data.status === 'completed' ? 100 : pct) + '%';
          barEl.style.background = data.status === 'completed' ? 'var(--green)'
            : data.status === 'failed' ? 'var(--red)'
            : 'var(--blue)';
        }
        if (badgeEl) badgeEl.innerHTML = statusBadge(data.status);
        if (progEl) progEl.textContent = `${data.days_processed} / ${data.total_days || '?'} ${j.isInsight ? 'dias' : 'itens'}`;
        if (errEl && data.error_message) { errEl.textContent = data.error_message; errEl.style.display = ''; }
        if (!_TERMINAL.has(data.status)) allDone = false;
      } catch(_) { allDone = false; }
    }
    if (allDone) {
      if (_csPollTimer) { clearInterval(_csPollTimer); _csPollTimer = null; }
      _csAutoRefresh = false;
      const autoBtn = document.getElementById('cs-auto-btn');
      if (autoBtn) { autoBtn.textContent = 'Concluído'; autoBtn.className = 'btn btn-ghost btn-sm'; autoBtn.disabled = true; }
      toast('Todos os jobs finalizaram!', 'success');
      // Re-busca insights para refletir os dados recém sincronizados
      if (S.campaign) {
        try {
          const campId = S.campaign.campaign_id;
          const ins = await GET('/insights/campaigns', {
            account_id: S.account_id, campaign_id: campId,
            date_from: S.dateFrom || undefined, date_to: S.dateTo || undefined,
            granularity: S.gran,
          });
          S.campInsights = ins;
          render();
        } catch(_) {}
      }
    }
  }

  window.csToggleAuto = () => {
    _csAutoRefresh = !_csAutoRefresh;
    const btn = document.getElementById('cs-auto-btn');
    if (btn) {
      btn.className = _csAutoRefresh ? 'btn btn-success btn-sm' : 'btn btn-ghost btn-sm';
      btn.innerHTML = _csAutoRefresh
        ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#fff;margin-right:5px;animation:cs-pulse .8s ease-in-out infinite"></span>Auto-refresh: ON`
        : `Auto-refresh: OFF`;
    }
    if (_csAutoRefresh && !_csPollTimer && _csCurrentJobs.length) {
      _csPollTimer = setInterval(() => _csPollJobs(_csCurrentJobs), 800);
    } else if (!_csAutoRefresh && _csPollTimer) {
      clearInterval(_csPollTimer); _csPollTimer = null;
    }
  };

  let _csCurrentJobs = [];
  window.csPollNow = () => { if (_csCurrentJobs.length) _csPollJobs(_csCurrentJobs); };

  window.expInlineCampSync = async (campaignId, campaignName) => {
    const type     = document.getElementById('cs-type')?.value || 'insights';
    const dateFrom = document.getElementById('cs-df')?.value || undefined;
    const dateTo   = document.getElementById('cs-dt')?.value || undefined;
    const chunk    = parseInt(document.getElementById('cs-chunk')?.value) || 7;
    const btn      = document.getElementById('cs-sync-btn');
    const panel    = document.getElementById('cs-jobs-panel');
    const campLabel = campaignName || campaignId;

    if (_csPollTimer) { clearInterval(_csPollTimer); _csPollTimer = null; }
    _csCurrentJobs = [];
    _csAutoRefresh = true;

    if (btn) { btn.disabled = true; btn.textContent = '⏳ Disparando...'; }

    const jobDefs = [];
    try {
      const activeJobs = await api('GET', '/jobs', null, { account_id: S.account_id, status: 'running', limit: 1 });
      if (activeJobs.items?.length > 0) {
        toast('Já existe um job em execução para esta conta.', 'warn');
        return;
      }
      if (type === 'structural' || type === 'full') {
        const j = await api('POST', `/sync/${S.account_id}/full`, null,
          (dateFrom || dateTo) ? { date_from: dateFrom, date_to: dateTo } : undefined);
        jobDefs.push({ id: j.job_id, label: `Estrutural — ${campLabel}`, isInsight: false });
      }
      if (type === 'insights' || type === 'full') {
        const base = { date_from: dateFrom, date_to: dateTo, chunk_size_days: chunk };
        const j1 = await api('POST', `/sync/${S.account_id}/insights/campaigns`, null, { ...base, campaign_id: campaignId });
        jobDefs.push({ id: j1.job_id, label: `Insights — Campanhas (${campLabel})`, isInsight: true });
        const j2 = await api('POST', `/sync/${S.account_id}/insights/adsets`, null, { ...base, campaign_id: campaignId });
        jobDefs.push({ id: j2.job_id, label: `Insights — Conjuntos (${campLabel})`, isInsight: true });
        const j3 = await api('POST', `/sync/${S.account_id}/insights/ads`, null, { ...base, campaign_id: campaignId });
        jobDefs.push({ id: j3.job_id, label: `Insights — Anúncios (${campLabel})`, isInsight: true });
      }

      _csCurrentJobs = jobDefs;
      if (panel) _csRenderPanel(panel, jobDefs);
      await _csPollJobs(jobDefs);
      _csPollTimer = setInterval(() => _csPollJobs(jobDefs), 800);
      toast(`${jobDefs.length} job(s) iniciados!`, 'success');
    } catch(e) {
      if (panel) { panel.style.display = ''; panel.innerHTML = `<div class="error-msg" style="margin-top:8px">${e.message}</div>`; }
      toast(e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '⚡ Sincronizar'; }
    }
  };

  // ── Sync a partir da lista de campanhas (dropdown "Sincronizar") ──
  window.expSyncCampaignFull = (campaignId, campaignName) => {
    const today = new Date().toISOString().slice(0,10);
    const ov = modal(`⚡ Sincronizar Insights — ${campaignName || campaignId}`, `
      <p style="color:var(--muted);font-size:12px;margin-bottom:14px">
        Dispara 3 jobs de insights em cascata:<br>
        <strong>1.</strong> Insights da campanha (filtrado por esta campanha)<br>
        <strong>2.</strong> Insights de conjuntos da conta no período<br>
        <strong>3.</strong> Insights de anúncios da conta no período
      </p>
      <div class="form-row" style="gap:12px;flex-wrap:wrap;margin-bottom:12px">
        <div class="form-group">
          <label>Data inicial</label>
          <input type="date" id="scf-df" />
        </div>
        <div class="form-group">
          <label>Data final</label>
          <input type="date" id="scf-dt" value="${today}" />
        </div>
        <div class="form-group">
          <label>Chunk (dias) ${tip('Período processado por vez. Recomendado: 7.')}</label>
          <input type="number" id="scf-chunk" value="7" min="1" max="90" style="width:90px" />
        </div>
      </div>
      <div id="scf-progress" style="display:none;margin-bottom:12px">
        <div style="background:var(--border);border-radius:4px;height:8px;overflow:hidden;margin-bottom:6px">
          <div id="scf-bar" style="background:var(--blue);height:100%;width:0%;transition:width .3s"></div>
        </div>
        <div id="scf-status" style="font-size:12px;color:var(--muted)"></div>
      </div>
      <div id="scf-result"></div>`,
      `<button class="btn btn-ghost" id="btn-scf-close" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
       <button class="btn btn-primary" id="btn-scf-start">⚡ Iniciar</button>`);

    ov.querySelector('#btn-scf-start').onclick = async () => {
      const dateFrom = ov.querySelector('#scf-df').value || undefined;
      const dateTo   = ov.querySelector('#scf-dt').value || undefined;
      const chunk    = parseInt(ov.querySelector('#scf-chunk').value) || 7;
      const btn      = ov.querySelector('#btn-scf-start');
      const resEl    = ov.querySelector('#scf-result');
      const progWrap = ov.querySelector('#scf-progress');
      const bar      = ov.querySelector('#scf-bar');
      const statusEl = ov.querySelector('#scf-status');
      btn.disabled = true; btn.textContent = '...';
      resEl.innerHTML = '';
      progWrap.style.display = '';

      const msgs = [];
      const addMsg = (html, pct) => {
        msgs.push(html);
        resEl.innerHTML = msgs.join('');
        if (bar) bar.style.width = pct + '%';
      };

      try {
        statusEl.textContent = 'Disparando job de insights da campanha...';
        const j1 = await api('POST', `/sync/${S.account_id}/insights/campaigns`, null,
          { campaign_id: campaignId, date_from: dateFrom, date_to: dateTo, chunk_size_days: chunk });
        addMsg(`<div class="success-msg" style="margin-bottom:6px">✔ Insights Campanha: <code>${j1.job_id}</code> — ${j1.total_days} dias</div>`, 33);

        statusEl.textContent = 'Disparando job de insights dos conjuntos...';
        const j2 = await api('POST', `/sync/${S.account_id}/insights/adsets`, null,
          { date_from: dateFrom, date_to: dateTo, chunk_size_days: chunk });
        addMsg(`<div class="success-msg" style="margin-bottom:6px">✔ Insights Conjuntos: <code>${j2.job_id}</code></div>`, 66);

        statusEl.textContent = 'Disparando job de insights dos anúncios...';
        const j3 = await api('POST', `/sync/${S.account_id}/insights/ads`, null,
          { date_from: dateFrom, date_to: dateTo, chunk_size_days: chunk });
        addMsg(`<div class="success-msg" style="margin-bottom:6px">✔ Insights Anúncios: <code>${j3.job_id}</code></div>`, 100);

        statusEl.textContent = '3 jobs disparados. Acompanhe na aba Jobs.';
        toast('3 jobs de insights iniciados!', 'success');
        btn.textContent = 'Fechar';
        btn.onclick = () => ov.remove();
      } catch(e) {
        addMsg(`<div class="error-msg">${e.message}</div>`, 0);
        btn.disabled = false; btn.textContent = '⚡ Iniciar';
      }
    };
  };

  // ── CRUD Campanhas ──────────────────────────────────────────────────────

  window.expCreateCampaign = () => {
    const ov = modal('Nova Campanha', `
      <div class="form-group"><label>Nome *</label><input id="cc-name" placeholder="Nome da campanha" /></div>
      <div class="form-group"><label>Objetivo</label>
        <select id="cc-objective">
          <option value="OUTCOME_TRAFFIC">🚦 Tráfego — levar pessoas ao site, app ou WhatsApp</option>
          <option value="OUTCOME_ENGAGEMENT">💬 Engajamento — curtidas, comentários, mensagens</option>
          <option value="OUTCOME_AWARENESS">📢 Reconhecimento de Marca — alcance e lembrança</option>
          <option value="OUTCOME_LEADS">📋 Captação de Leads — formulários de contato</option>
          <option value="OUTCOME_SALES">🛒 Vendas — conversões, catálogo, ROAS</option>
          <option value="OUTCOME_APP_PROMOTION">📱 Promoção de Aplicativo — instalações e eventos in-app</option>
        </select>
      </div>
      <div class="form-group"><label>Status inicial</label>
        <select id="cc-status"><option value="PAUSED" selected>PAUSED</option><option value="ACTIVE">ACTIVE</option></select>
      </div>
      <div class="form-group"><label>Orçamento Diário (R$)</label>
        <input type="number" id="cc-daily" placeholder="ex: 50.00" min="0" step="0.01" />
      </div>
      <div class="form-group"><label>Orçamento Vitalício (R$) — exclui diário</label>
        <input type="number" id="cc-lifetime" placeholder="ex: 1000.00" min="0" step="0.01" />
      </div>
      <div class="form-group"><label>Tipo de Compra</label>
        <select id="cc-buying"><option value="AUCTION" selected>AUCTION</option><option value="RESERVED">RESERVED</option></select>
      </div>
      <div class="form-group"><label>Estratégia de Lance</label>
        <select id="cc-bidstrategy">
          <option value="">— automático (sem seleção) —</option>
          <option value="LOWEST_COST_WITHOUT_CAP">LOWEST_COST_WITHOUT_CAP</option>
          <option value="LOWEST_COST_WITH_BID_CAP">LOWEST_COST_WITH_BID_CAP</option>
          <option value="COST_CAP">COST_CAP</option>
          <option value="LOWEST_COST_WITH_MIN_ROAS">LOWEST_COST_WITH_MIN_ROAS</option>
        </select>
      </div>
      <div class="form-group"><label>Spend Cap (R$) — teto máximo total da campanha</label>
        <input type="number" id="cc-spend-cap" placeholder="ex: 5000.00" min="0" step="0.01" />
      </div>
      <div class="form-group"><label>Data de Início</label>
        <input type="datetime-local" id="cc-start" />
      </div>
      <div class="form-group"><label>Data de Término</label>
        <input type="datetime-local" id="cc-stop" />
      </div>
      <div class="form-group"><label>Categorias Especiais — segure Ctrl para múltiplas</label>
        <select id="cc-special-cats" multiple size="5" style="width:100%">
          <option value="NONE" selected>NONE — Nenhuma categoria especial</option>
          <option value="CREDIT">CREDIT — Crédito financeiro</option>
          <option value="EMPLOYMENT">EMPLOYMENT — Emprego e recrutamento</option>
          <option value="HOUSING">HOUSING — Moradia e imóveis</option>
          <option value="ISSUES_ELECTIONS_POLITICS">ISSUES_ELECTIONS_POLITICS — Política e eleições</option>
          <option value="ONLINE_GAMBLING_AND_GAMING">ONLINE_GAMBLING_AND_GAMING — Apostas e jogos online</option>
          <option value="FINANCIAL_PRODUCTS_SERVICES">FINANCIAL_PRODUCTS_SERVICES — Produtos financeiros</option>
        </select>
        <span style="font-size:11px;color:var(--muted)">Deixe em NONE para campanha sem restrições especiais.</span>
      </div>
      <div id="cc-result"></div>`,
      `<button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn btn-primary" id="btn-cc-save">Criar Campanha</button>`);

    ov.querySelector('#btn-cc-save').onclick = async () => {
      const name = ov.querySelector('#cc-name').value.trim();
      if (!name) { toast('Nome é obrigatório', 'error'); return; }
      const daily    = ov.querySelector('#cc-daily').value;
      const lifetime = ov.querySelector('#cc-lifetime').value;
      const cats = [...ov.querySelectorAll('#cc-special-cats option:checked')]
        .map(o => o.value).filter(v => v !== 'NONE');
      const body = {
        name,
        objective:              ov.querySelector('#cc-objective').value,
        status:                 ov.querySelector('#cc-status').value,
        buying_type:            ov.querySelector('#cc-buying').value,
        special_ad_categories:  cats,
      };
      if (daily)    body.daily_budget    = Math.round(parseFloat(daily)    * 100);
      if (lifetime) body.lifetime_budget = Math.round(parseFloat(lifetime) * 100);
      const bidStrat = ov.querySelector('#cc-bidstrategy').value;
      const spendCap = ov.querySelector('#cc-spend-cap').value;
      const startTime= ov.querySelector('#cc-start').value;
      const stopTime = ov.querySelector('#cc-stop').value;
      if (bidStrat)  body.bid_strategy = bidStrat;
      if (spendCap)  body.spend_cap    = Math.round(parseFloat(spendCap) * 100);
      if (startTime) body.start_time   = new Date(startTime).toISOString();
      if (stopTime)  body.stop_time    = new Date(stopTime).toISOString();
      const btn = ov.querySelector('#btn-cc-save');
      btn.disabled = true; btn.textContent = '...';
      try {
        await POST(`/accounts/${S.account_id}/campaigns`, body);
        toast('Campanha criada!', 'success');
        ov.remove();
        loadCampaigns();
      } catch(e) {
        ov.querySelector('#cc-result').innerHTML = `<div class="error-msg">${e.message}</div>`;
        btn.disabled = false; btn.textContent = 'Criar Campanha';
      }
    };
  };

  window.expEditCampaign = async (campaignId) => {
    let c = S.campaigns?.find(x => x.campaign_id === campaignId);
    if (!c && S.campaign?.campaign_id === campaignId) c = S.campaign;
    if (!c) { toast('Campanha não encontrada no estado local', 'error'); return; }

    const ov = modal(`Editar Campanha`, `
      <p class="mono" style="font-size:11px;color:var(--muted);margin-bottom:12px">${campaignId}</p>
      <div class="form-group"><label>Nome *</label><input id="ec-name" value="${c.name}" /></div>
      <div class="form-group"><label>Status</label>
        <select id="ec-status">
          <option value="ACTIVE" ${c.status==='ACTIVE'?'selected':''}>ACTIVE</option>
          <option value="PAUSED" ${c.status==='PAUSED'?'selected':''}>PAUSED</option>
          <option value="ARCHIVED" ${c.status==='ARCHIVED'?'selected':''}>ARCHIVED</option>
        </select>
      </div>
      <div class="form-group"><label>Orçamento Diário (R$)</label>
        <input type="number" id="ec-daily" value="${c.daily_budget ? (c.daily_budget/100).toFixed(2) : ''}" min="0" step="0.01" />
      </div>
      <div class="form-group"><label>Orçamento Vitalício (R$)</label>
        <input type="number" id="ec-lifetime" value="${c.lifetime_budget ? (c.lifetime_budget/100).toFixed(2) : ''}" min="0" step="0.01" />
      </div>
      <div class="form-group"><label>Spend Cap (R$) — 922337203685478 para remover</label>
        <input type="number" id="ec-spend-cap" value="${c.spend_cap ? (c.spend_cap/100).toFixed(2) : ''}" min="0" step="0.01" />
      </div>
      <div id="ec-result"></div>`,
      `<button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn btn-primary" id="btn-ec-save">Salvar</button>`);

    ov.querySelector('#btn-ec-save').onclick = async () => {
      const name = ov.querySelector('#ec-name').value.trim();
      if (!name) { toast('Nome é obrigatório', 'error'); return; }
      const body = {
        name,
        status: ov.querySelector('#ec-status').value,
      };
      const daily    = ov.querySelector('#ec-daily').value;
      const lifetime = ov.querySelector('#ec-lifetime').value;
      const cap      = ov.querySelector('#ec-spend-cap').value;
      if (daily)    body.daily_budget    = Math.round(parseFloat(daily)    * 100);
      if (lifetime) body.lifetime_budget = Math.round(parseFloat(lifetime) * 100);
      if (cap)      body.spend_cap       = Math.round(parseFloat(cap)      * 100);
      const btn = ov.querySelector('#btn-ec-save');
      btn.disabled = true; btn.textContent = '...';
      try {
        await PATCH(`/accounts/${S.account_id}/campaigns/${campaignId}`, body);
        toast('Campanha atualizada!', 'success');
        ov.remove();
        loadCampaigns();
      } catch(e) {
        ov.querySelector('#ec-result').innerHTML = `<div class="error-msg">${e.message}</div>`;
        btn.disabled = false; btn.textContent = 'Salvar';
      }
    };
  };

  window.expDeleteCampaign = (campaignId, campaignName) => {
    const ov = modal('Deletar Campanha', `
      <p>Tem certeza que deseja marcar como <strong>DELETED</strong> a campanha:</p>
      <p><strong>${campaignName}</strong> <span class="mono" style="font-size:11px;color:var(--muted)">${campaignId}</span></p>
      <p style="color:var(--muted);font-size:12px">Esta ação não remove o histórico de insights.</p>
      <div id="del-camp-result"></div>`,
      `<button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn btn-primary" style="background:var(--red,#ef4444)" id="btn-del-camp">Confirmar Delete</button>`);

    ov.querySelector('#btn-del-camp').onclick = async () => {
      const btn = ov.querySelector('#btn-del-camp');
      btn.disabled = true; btn.textContent = '...';
      try {
        await DEL(`/accounts/${S.account_id}/campaigns/${campaignId}`);
        toast('Campanha deletada.', 'success');
        ov.remove();
        loadCampaigns();
      } catch(e) {
        ov.querySelector('#del-camp-result').innerHTML = `<div class="error-msg">${e.message}</div>`;
        btn.disabled = false; btn.textContent = 'Confirmar Delete';
      }
    };
  };

  // ── Targeting Builder ─────────────────────────────────────────────────────

  const _BR_STATES = [
    {key:"438",uf:"AC",name:"Acre"},         {key:"439",uf:"AL",name:"Alagoas"},
    {key:"440",uf:"AP",name:"Amapá"},         {key:"441",uf:"AM",name:"Amazonas"},
    {key:"442",uf:"BA",name:"Bahia"},         {key:"443",uf:"CE",name:"Ceará"},
    {key:"444",uf:"DF",name:"Distrito Federal"},{key:"445",uf:"ES",name:"Espírito Santo"},
    {key:"462",uf:"GO",name:"Goiás"},         {key:"447",uf:"MA",name:"Maranhão"},
    {key:"448",uf:"MT",name:"Mato Grosso"},   {key:"446",uf:"MS",name:"Mato Grosso do Sul"},
    {key:"449",uf:"MG",name:"Minas Gerais"},  {key:"450",uf:"PA",name:"Pará"},
    {key:"451",uf:"PB",name:"Paraíba"},       {key:"452",uf:"PR",name:"Paraná"},
    {key:"463",uf:"PE",name:"Pernambuco"},    {key:"453",uf:"PI",name:"Piauí"},
    {key:"454",uf:"RJ",name:"Rio de Janeiro"},{key:"455",uf:"RN",name:"Rio Grande do Norte"},
    {key:"456",uf:"RS",name:"Rio Grande do Sul"},{key:"457",uf:"RO",name:"Rondônia"},
    {key:"458",uf:"RR",name:"Roraima"},       {key:"459",uf:"SC",name:"Santa Catarina"},
    {key:"460",uf:"SP",name:"São Paulo"},     {key:"461",uf:"SE",name:"Sergipe"},
    {key:"464",uf:"TO",name:"Tocantins"},
  ];

  function _stateOpts(selectedKeys = []) {
    return _BR_STATES.map(s =>
      `<option value="${s.key}" ${selectedKeys.includes(s.key) ? 'selected' : ''}>${s.uf} — ${s.name}</option>`
    ).join('');
  }

  function _addCityRow(tbody, city = null) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="padding:2px 4px"><input type="text" value="${city?.key||''}" placeholder="key" style="width:80px;background:var(--surface);border:1px solid var(--border);color:inherit;border-radius:4px;padding:2px 6px" class="tg-city-key" /></td>
      <td style="padding:2px 4px"><input type="text" value="${city?.name||''}" placeholder="Nome da cidade" style="width:130px;background:var(--surface);border:1px solid var(--border);color:inherit;border-radius:4px;padding:2px 6px" class="tg-city-name" /></td>
      <td style="padding:2px 4px"><input type="text" value="${city?.region_id||''}" placeholder="ID estado" style="width:75px;background:var(--surface);border:1px solid var(--border);color:inherit;border-radius:4px;padding:2px 6px" class="tg-city-region" /></td>
      <td style="padding:2px 4px"><input type="number" value="${city?.radius||17}" min="1" max="80" style="width:55px;background:var(--surface);border:1px solid var(--border);color:inherit;border-radius:4px;padding:2px 6px" class="tg-city-radius" /></td>
      <td style="padding:2px 4px"><button type="button" onclick="this.closest('tr').remove()" style="background:none;border:none;color:var(--red,#ef4444);cursor:pointer;font-size:14px">✕</button></td>`;
    tbody.appendChild(tr);
  }

  function _addTgItemRow(tbody, id = '', name = '') {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="padding:2px 4px"><input type="text" value="${id}" placeholder="ID numérico" style="width:150px;background:var(--surface);border:1px solid var(--border);color:inherit;border-radius:4px;padding:2px 6px" class="tg-item-id" /></td>
      <td style="padding:2px 4px"><input type="text" value="${name}" placeholder="Nome" style="width:170px;background:var(--surface);border:1px solid var(--border);color:inherit;border-radius:4px;padding:2px 6px" class="tg-item-name" /></td>
      <td style="padding:2px 4px"><button type="button" onclick="this.closest('tr').remove()" style="background:none;border:none;color:var(--red,#ef4444);cursor:pointer;font-size:14px">✕</button></td>`;
    tbody.appendChild(tr);
  }

  function initTargetingBuilder(el, initial = null) {
    const tg        = initial || {};
    const cities    = tg.geo_locations?.cities   || [];
    const incRegions= (tg.geo_locations?.regions  || []).map(r => r.key);
    const excRegions= (tg.excluded_geo_locations?.regions || []).map(r => r.key);
    const incCtry   = tg.geo_locations?.countries || ['BR'];
    const locTypes  = tg.geo_locations?.location_types
                   || tg.excluded_geo_locations?.location_types || ['home','recent'];
    const geoMode   = cities.length ? 'cities' : incRegions.length ? 'states' : 'countries';
    const ageMin    = tg.age_min || 18;
    const ageMax    = tg.age_max || 65;
    const genderVal = (tg.genders || [0])[0];
    const interests = tg.flexible_spec?.[0]?.interests || [];
    const behaviors = tg.flexible_spec?.[0]?.behaviors || [];
    const advAud    = tg.targeting_automation?.advantage_audience ?? 1;

    const s = (id) => el.querySelector(id);

    el.innerHTML = `
<div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:10px">
  <div style="font-size:12px;font-weight:700;color:var(--blue);margin-bottom:10px;letter-spacing:.5px">📍 LOCALIZAÇÃO</div>
  <div style="margin-bottom:10px">
    <div style="font-size:11px;color:var(--muted);margin-bottom:6px">Modo de segmentação</div>
    <div style="display:flex;gap:16px;font-size:13px">
      <label><input type="radio" name="tg-geomode" value="countries" ${geoMode==='countries'?'checked':''}> País inteiro</label>
      <label><input type="radio" name="tg-geomode" value="states"    ${geoMode==='states'   ?'checked':''}> Estados específicos</label>
      <label><input type="radio" name="tg-geomode" value="cities"    ${geoMode==='cities'   ?'checked':''}> Cidades específicas</label>
    </div>
  </div>
  <div id="tg-countries-wrap" style="${geoMode!=='countries'?'display:none;':''}margin-bottom:8px">
    <div style="font-size:11px;color:var(--muted);margin-bottom:4px">País(es) — Ctrl+clique para múltiplos</div>
    <select id="tg-countries" multiple size="3" style="width:100%;background:var(--surface);border:1px solid var(--border);color:inherit;border-radius:4px;padding:4px">
      <option value="BR" ${incCtry.includes('BR')?'selected':''}>🇧🇷 Brasil (BR)</option>
      <option value="US" ${incCtry.includes('US')?'selected':''}>🇺🇸 Estados Unidos (US)</option>
      <option value="PT" ${incCtry.includes('PT')?'selected':''}>🇵🇹 Portugal (PT)</option>
      <option value="AR" ${incCtry.includes('AR')?'selected':''}>🇦🇷 Argentina (AR)</option>
      <option value="MX" ${incCtry.includes('MX')?'selected':''}>🇲🇽 México (MX)</option>
    </select>
  </div>
  <div id="tg-states-wrap" style="${geoMode!=='states'?'display:none;':''}margin-bottom:8px">
    <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Estados incluídos — Ctrl+clique para múltiplos</div>
    <select id="tg-states-inc" multiple size="6" style="width:100%;background:var(--surface);border:1px solid var(--border);color:inherit;border-radius:4px;padding:4px">${_stateOpts(incRegions)}</select>
  </div>
  <div id="tg-cities-wrap" style="${geoMode!=='cities'?'display:none;':''}margin-bottom:8px">
    <div style="font-size:11px;color:var(--muted);margin-bottom:6px">
      Cidades — obtenha os IDs via <code style="background:var(--surface2);padding:1px 4px;border-radius:3px">GET /search?type=adgeolocation&q=joao+pessoa&location_types=city</code>
    </div>
    <table style="width:100%;font-size:12px;border-collapse:collapse">
      <thead><tr style="color:var(--muted);font-size:11px">
        <th style="text-align:left;padding:2px 4px">Key (ID)</th>
        <th style="text-align:left;padding:2px 4px">Cidade</th>
        <th style="text-align:left;padding:2px 4px">ID Estado</th>
        <th style="text-align:left;padding:2px 4px">Raio km</th>
        <th></th>
      </tr></thead>
      <tbody id="tg-cities-body"></tbody>
    </table>
    <button type="button" class="btn btn-ghost btn-sm" style="margin-top:6px;font-size:12px" id="btn-tg-add-city">+ Adicionar cidade</button>
  </div>
  <div style="margin-bottom:8px">
    <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Excluir estados — Ctrl+clique para múltiplos</div>
    <select id="tg-states-exc" multiple size="5" style="width:100%;background:var(--surface);border:1px solid var(--border);color:inherit;border-radius:4px;padding:4px">${_stateOpts(excRegions)}</select>
  </div>
  <div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Tipo de localização das pessoas</div>
    <div style="display:flex;gap:14px;font-size:13px">
      <label><input type="checkbox" id="tg-lt-home"   ${locTypes.includes('home')     ?'checked':''}> Residência</label>
      <label><input type="checkbox" id="tg-lt-recent" ${locTypes.includes('recent')   ?'checked':''}> Localização recente</label>
      <label><input type="checkbox" id="tg-lt-travel" ${locTypes.includes('travel_in')?'checked':''}> Viajante na região</label>
    </div>
  </div>
</div>

<div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:10px">
  <div style="font-size:12px;font-weight:700;color:var(--blue);margin-bottom:10px;letter-spacing:.5px">👤 DADOS DEMOGRÁFICOS</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
    <div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Idade mínima</div>
      <input type="number" id="tg-age-min" value="${ageMin}" min="13" max="65" style="width:100%;background:var(--surface);border:1px solid var(--border);color:inherit;border-radius:4px;padding:4px 8px" />
    </div>
    <div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Idade máxima</div>
      <input type="number" id="tg-age-max" value="${ageMax}" min="13" max="65" style="width:100%;background:var(--surface);border:1px solid var(--border);color:inherit;border-radius:4px;padding:4px 8px" />
    </div>
  </div>
  <div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Gênero</div>
    <div style="display:flex;gap:16px;font-size:13px">
      <label><input type="radio" name="tg-gender" value="0" ${genderVal===0?'checked':''}> Todos</label>
      <label><input type="radio" name="tg-gender" value="1" ${genderVal===1?'checked':''}> Masculino</label>
      <label><input type="radio" name="tg-gender" value="2" ${genderVal===2?'checked':''}> Feminino</label>
    </div>
  </div>
</div>

<div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:10px">
  <div style="font-size:12px;font-weight:700;color:var(--blue);margin-bottom:6px;letter-spacing:.5px">🎯 INTERESSES E COMPORTAMENTOS</div>
  <div style="font-size:11px;color:var(--muted);margin-bottom:10px">IDs obtidos via <code style="background:var(--surface2);padding:1px 4px;border-radius:3px">GET /search?type=adinterest&q=familia</code> na Graph API</div>
  <div style="margin-bottom:12px">
    <div style="font-size:12px;font-weight:600;margin-bottom:6px">Interesses</div>
    <table style="width:100%;font-size:12px;border-collapse:collapse">
      <thead><tr style="color:var(--muted);font-size:11px">
        <th style="text-align:left;padding:2px 4px">ID numérico</th>
        <th style="text-align:left;padding:2px 4px">Nome</th><th></th>
      </tr></thead>
      <tbody id="tg-interests-body"></tbody>
    </table>
    <button type="button" class="btn btn-ghost btn-sm" style="margin-top:6px;font-size:12px" id="btn-tg-add-interest">+ Interesse</button>
  </div>
  <div>
    <div style="font-size:12px;font-weight:600;margin-bottom:6px">Comportamentos</div>
    <table style="width:100%;font-size:12px;border-collapse:collapse">
      <thead><tr style="color:var(--muted);font-size:11px">
        <th style="text-align:left;padding:2px 4px">ID numérico</th>
        <th style="text-align:left;padding:2px 4px">Nome</th><th></th>
      </tr></thead>
      <tbody id="tg-behaviors-body"></tbody>
    </table>
    <button type="button" class="btn btn-ghost btn-sm" style="margin-top:6px;font-size:12px" id="btn-tg-add-behavior">+ Comportamento</button>
  </div>
</div>

<div style="margin-bottom:10px">
  <label style="font-size:13px;display:flex;align-items:center;gap:8px">
    <input type="checkbox" id="tg-adv-audience" ${advAud?'checked':''}>
    Advantage Audience (Meta expande o público automaticamente via IA)
  </label>
</div>

<details>
  <summary style="cursor:pointer;font-size:12px;color:var(--muted)">👁 Visualizar JSON gerado</summary>
  <pre id="tg-preview" style="margin-top:8px;background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:10px;font-size:11px;max-height:200px;overflow:auto;white-space:pre-wrap"></pre>
</details>`;

    // Populate tables
    const citiesBody = s('#tg-cities-body');
    cities.forEach(c => _addCityRow(citiesBody, c));
    if (!cities.length) _addCityRow(citiesBody);

    const intBody = s('#tg-interests-body');
    interests.forEach(i => _addTgItemRow(intBody, i.id, i.name));
    if (!interests.length) _addTgItemRow(intBody);

    const behBody = s('#tg-behaviors-body');
    behaviors.forEach(b => _addTgItemRow(behBody, b.id, b.name));
    if (!behaviors.length) _addTgItemRow(behBody);

    // Geo mode switch
    el.querySelectorAll('input[name="tg-geomode"]').forEach(r => {
      r.addEventListener('change', () => {
        s('#tg-countries-wrap').style.display = r.value==='countries' ? '' : 'none';
        s('#tg-states-wrap').style.display    = r.value==='states'    ? '' : 'none';
        s('#tg-cities-wrap').style.display    = r.value==='cities'    ? '' : 'none';
      });
    });

    s('#btn-tg-add-city').onclick     = () => _addCityRow(s('#tg-cities-body'));
    s('#btn-tg-add-interest').onclick = () => _addTgItemRow(s('#tg-interests-body'));
    s('#btn-tg-add-behavior').onclick = () => _addTgItemRow(s('#tg-behaviors-body'));

    // Live JSON preview
    const updatePreview = () => {
      try { s('#tg-preview').textContent = JSON.stringify(readTargetingBuilder(el), null, 2); } catch {}
    };
    el.addEventListener('change', updatePreview);
    el.addEventListener('input',  updatePreview);
    updatePreview();
  }

  function readTargetingBuilder(el) {
    const s = (id) => el.querySelector(id);
    const geoMode = s('input[name="tg-geomode"]:checked')?.value || 'countries';

    const locTypes = [];
    if (s('#tg-lt-home')?.checked)   locTypes.push('home');
    if (s('#tg-lt-recent')?.checked) locTypes.push('recent');
    if (s('#tg-lt-travel')?.checked) locTypes.push('travel_in');
    const lt = locTypes.length ? locTypes : ['home','recent'];

    const geoLoc = { location_types: lt };

    if (geoMode === 'countries') {
      const ctry = [...el.querySelectorAll('#tg-countries option:checked')].map(o => o.value);
      if (ctry.length) geoLoc.countries = ctry;
    } else if (geoMode === 'states') {
      const opts = [...el.querySelectorAll('#tg-states-inc option:checked')];
      if (opts.length) geoLoc.regions = opts.map(o => ({
        key: o.value, name: o.text.split(' — ')[1], country: 'BR',
      }));
    } else {
      const rows = el.querySelectorAll('#tg-cities-body tr');
      const cities = [];
      rows.forEach(tr => {
        const key    = tr.querySelector('.tg-city-key')?.value.trim();
        const name   = tr.querySelector('.tg-city-name')?.value.trim();
        const region = tr.querySelector('.tg-city-region')?.value.trim();
        const radius = parseInt(tr.querySelector('.tg-city-radius')?.value) || 17;
        if (key && name) {
          const c = { country:'BR', distance_unit:'kilometer', key, name, radius };
          if (region) c.region_id = region;
          cities.push(c);
        }
      });
      if (cities.length) geoLoc.cities = cities;
    }

    const exclOpts = [...el.querySelectorAll('#tg-states-exc option:checked')];
    const exclGeo  = exclOpts.length ? {
      regions: exclOpts.map(o => ({ key: o.value, name: o.text.split(' — ')[1], country: 'BR' })),
      location_types: lt,
    } : null;

    const ageMin    = parseInt(s('#tg-age-min')?.value)  || 18;
    const ageMax    = parseInt(s('#tg-age-max')?.value)  || 65;
    const genderVal = parseInt(s('input[name="tg-gender"]:checked')?.value ?? '0');

    const interests = [];
    el.querySelectorAll('#tg-interests-body tr').forEach(tr => {
      const id   = tr.querySelector('.tg-item-id')?.value.trim();
      const name = tr.querySelector('.tg-item-name')?.value.trim();
      if (id && name) interests.push({ id, name });
    });

    const behaviors = [];
    el.querySelectorAll('#tg-behaviors-body tr').forEach(tr => {
      const id   = tr.querySelector('.tg-item-id')?.value.trim();
      const name = tr.querySelector('.tg-item-name')?.value.trim();
      if (id && name) behaviors.push({ id, name });
    });

    const advAud = s('#tg-adv-audience')?.checked ? 1 : 0;

    const result = { geo_locations: geoLoc, age_min: ageMin, age_max: ageMax, genders: [genderVal] };
    if (exclGeo)  result.excluded_geo_locations = exclGeo;
    if (interests.length || behaviors.length) {
      const spec = {};
      if (interests.length) spec.interests = interests;
      if (behaviors.length) spec.behaviors = behaviors;
      result.flexible_spec = [spec];
    }
    if (advAud) result.targeting_automation = { advantage_audience: 1 };
    return result;
  }

  // ── CRUD Conjuntos ───────────────────────────────────────────────────────

  window.expCreateAdSet = (campaignId) => {
    const ov = modal('Novo Conjunto de Anúncios', `
      <div class="form-group"><label>Nome *</label><input id="cas-name" placeholder="Nome do conjunto" /></div>
      <div class="form-group">
        <label>Objetivo de Otimização</label>
        <select id="cas-optgoal">
          <option value="LINK_CLICKS">LINK_CLICKS — cliques no link</option>
          <option value="LANDING_PAGE_VIEWS">LANDING_PAGE_VIEWS — visualizações de página de destino</option>
          <option value="REACH">REACH — alcance máximo</option>
          <option value="IMPRESSIONS">IMPRESSIONS — exibições</option>
          <option value="CONVERSATIONS">CONVERSATIONS — mensagens (WhatsApp/Messenger)</option>
          <option value="OFFSITE_CONVERSIONS">OFFSITE_CONVERSIONS — conversões no site</option>
          <option value="LEAD_GENERATION">LEAD_GENERATION — formulário de lead</option>
          <option value="QUALITY_LEAD">QUALITY_LEAD — lead qualificado</option>
          <option value="POST_ENGAGEMENT">POST_ENGAGEMENT — engajamento com post</option>
          <option value="PAGE_LIKES">PAGE_LIKES — curtidas na página</option>
          <option value="APP_INSTALLS">APP_INSTALLS — instalações de app</option>
          <option value="THRUPLAY">THRUPLAY — vídeo assistido até o fim</option>
          <option value="VALUE">VALUE — valor de conversão (ROAS)</option>
        </select>
      </div>
      <div class="form-group">
        <label>Evento de Cobrança <span id="cas-billing-hint" style="font-size:11px;color:var(--muted)"></span></label>
        <select id="cas-billing">
          <option value="LINK_CLICKS">LINK_CLICKS</option>
          <option value="IMPRESSIONS">IMPRESSIONS</option>
          <option value="THRUPLAY">THRUPLAY</option>
          <option value="POST_ENGAGEMENT">POST_ENGAGEMENT</option>
          <option value="APP_INSTALLS">APP_INSTALLS</option>
          <option value="PAGE_LIKES">PAGE_LIKES</option>
          <option value="PURCHASE">PURCHASE</option>
        </select>
      </div>
      <div class="form-group"><label>Estratégia de Lance</label>
        <select id="cas-bidstrategy">
          <option value="">— automático (sem seleção) —</option>
          <option value="LOWEST_COST_WITHOUT_CAP">LOWEST_COST_WITHOUT_CAP</option>
          <option value="LOWEST_COST_WITH_BID_CAP">LOWEST_COST_WITH_BID_CAP</option>
          <option value="COST_CAP">COST_CAP</option>
        </select>
      </div>
      <div class="form-group"><label>Lance (R$) — obrigatório se LOWEST_COST_WITH_BID_CAP</label>
        <input type="number" id="cas-bid" placeholder="ex: 1.50" min="0" step="0.01" />
      </div>
      <div class="form-group"><label>Destino dos Anúncios</label>
        <select id="cas-destination">
          <option value="">— padrão (Website) —</option>
          <option value="WEBSITE">WEBSITE</option>
          <option value="APP">APP</option>
          <option value="MESSENGER">MESSENGER</option>
          <option value="WHATSAPP">WHATSAPP</option>
          <option value="INSTAGRAM_DIRECT">INSTAGRAM_DIRECT</option>
        </select>
      </div>
      <div id="cas-promoted-wrap" style="display:none;background:var(--surface2);border:1px solid var(--yellow);border-radius:6px;padding:10px;margin-bottom:10px">
        <div style="font-size:12px;font-weight:600;color:var(--yellow);margin-bottom:8px">⚠ Objeto Promovido (promoted_object) — obrigatório para este destino/objetivo</div>
        <div id="cas-promoted-app" style="display:none">
          <div class="form-group"><label>Application ID (Facebook App ID) *</label>
            <input id="cas-app-id" placeholder="ex: 1234567890" style="font-family:monospace" />
          </div>
          <div class="form-group"><label>URL da App Store (opcional)</label>
            <input id="cas-app-store-url" placeholder="ex: https://play.google.com/store/apps/details?id=..." />
          </div>
        </div>
        <div id="cas-promoted-pixel" style="display:none">
          <div class="form-group"><label>Pixel ID *</label>
            <input id="cas-pixel-id" placeholder="ex: 1234567890" style="font-family:monospace" />
          </div>
          <div class="form-group"><label>Custom Event Type (opcional)</label>
            <select id="cas-pixel-event">
              <option value="">— padrão —</option>
              <option value="PURCHASE">PURCHASE</option>
              <option value="ADD_TO_CART">ADD_TO_CART</option>
              <option value="LEAD">LEAD</option>
              <option value="COMPLETE_REGISTRATION">COMPLETE_REGISTRATION</option>
              <option value="VIEW_CONTENT">VIEW_CONTENT</option>
            </select>
          </div>
        </div>
        <div id="cas-promoted-page" style="display:none">
          <div class="form-group">
            <label>Página do Facebook * — obrigatório para WhatsApp, Messenger, Instagram Direct e PAGE_LIKES</label>
            <div id="cas-page-loading" style="display:none;font-size:12px;color:var(--muted);margin-bottom:6px">⏳ Buscando páginas...</div>
            <div id="cas-page-error" style="display:none;font-size:12px;color:var(--red,#ef4444);margin-bottom:6px"></div>
            <input id="cas-page-search" placeholder="Filtrar páginas pelo nome..." style="display:none;margin-bottom:6px" />
            <select id="cas-page-select" style="display:none;margin-bottom:8px">
              <option value="">— selecione uma página —</option>
            </select>
            <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Ou insira o Page ID manualmente:</div>
            <input id="cas-page-id" placeholder="ex: 1234567890" style="font-family:monospace" />
          </div>
        </div>
      </div>
      <div class="form-group"><label>Status</label>
        <select id="cas-status"><option value="PAUSED" selected>PAUSED</option><option value="ACTIVE">ACTIVE</option></select>
      </div>
      <div class="form-group"><label>Orçamento Diário (R$)</label>
        <input type="number" id="cas-daily" placeholder="ex: 20.00" min="0" step="0.01" />
      </div>
      <div class="form-group"><label>Orçamento Vitalício (R$)</label>
        <input type="number" id="cas-lifetime" placeholder="ex: 500.00" min="0" step="0.01" />
      </div>
      <div class="form-group"><label>Data de Início</label>
        <input type="datetime-local" id="cas-start" />
      </div>
      <div class="form-group"><label>Data de Término (obrigatório se vitalício)</label>
        <input type="datetime-local" id="cas-end" />
      </div>
      <div style="margin-bottom:10px"><label style="font-size:12px;font-weight:600;display:block;margin-bottom:8px">Targeting *</label>
        <div id="cas-targeting-builder"></div>
      </div>
      <details style="margin-bottom:10px">
        <summary style="cursor:pointer;font-size:12px;color:var(--muted)">Campos EU (DSA) — obrigatório se segmentar União Europeia</summary>
        <div style="padding-top:8px">
          <div class="form-group"><label>DSA Beneficiário</label>
            <input id="cas-dsa-ben" placeholder="Nome de quem se beneficia do anúncio" />
          </div>
          <div class="form-group"><label>DSA Pagador</label>
            <input id="cas-dsa-pay" placeholder="Nome de quem paga pelo anúncio" />
          </div>
        </div>
      </details>
      <div id="cas-result"></div>`,
      `<button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn btn-primary" id="btn-cas-save">Criar Conjunto</button>`);

    // Initialize targeting builder after modal is in DOM
    initTargetingBuilder(ov.querySelector('#cas-targeting-builder'));

    // billing_event ↔ optimization_goal compatibility
    const _OPTGOAL_BILLING = {
      'LINK_CLICKS':         ['LINK_CLICKS', 'IMPRESSIONS'],
      'LANDING_PAGE_VIEWS':  ['IMPRESSIONS'],
      'REACH':               ['IMPRESSIONS'],
      'IMPRESSIONS':         ['IMPRESSIONS'],
      'CONVERSATIONS':       ['IMPRESSIONS'],
      'OFFSITE_CONVERSIONS': ['IMPRESSIONS'],
      'LEAD_GENERATION':     ['IMPRESSIONS'],
      'QUALITY_LEAD':        ['IMPRESSIONS'],
      'POST_ENGAGEMENT':     ['POST_ENGAGEMENT', 'IMPRESSIONS'],
      'PAGE_LIKES':          ['PAGE_LIKES'],
      'APP_INSTALLS':        ['APP_INSTALLS', 'IMPRESSIONS'],
      'THRUPLAY':            ['THRUPLAY', 'IMPRESSIONS'],
      'VALUE':               ['IMPRESSIONS'],
    };
    const billingEl = ov.querySelector('#cas-billing');
    const optgoalEl = ov.querySelector('#cas-optgoal');
    const hintEl    = ov.querySelector('#cas-billing-hint');
    function _syncBilling() {
      const allowed = _OPTGOAL_BILLING[optgoalEl.value] || [];
      [...billingEl.options].forEach(o => {
        o.disabled = allowed.length > 0 && !allowed.includes(o.value);
      });
      if (allowed.length > 0 && !allowed.includes(billingEl.value)) {
        billingEl.value = allowed[0];
      }
      hintEl.textContent = allowed.length ? `(válido: ${allowed.join(', ')})` : '';
    }
    optgoalEl.addEventListener('change', _syncBilling);
    _syncBilling(); // apply on open

    // promoted_object visibility
    const destEl       = ov.querySelector('#cas-destination');
    const promoWrap    = ov.querySelector('#cas-promoted-wrap');
    const promoApp     = ov.querySelector('#cas-promoted-app');
    const promoPixel   = ov.querySelector('#cas-promoted-pixel');
    const promoPage    = ov.querySelector('#cas-promoted-page');
    function _syncPromo() {
      const dest = destEl.value;
      const goal = optgoalEl.value;
      const needApp   = dest === 'APP';
      const needPixel = !needApp && (goal === 'OFFSITE_CONVERSIONS' || goal === 'VALUE');
      const needPage  = !needApp && (goal === 'PAGE_LIKES' || dest === 'WHATSAPP' || dest === 'MESSENGER' || dest === 'INSTAGRAM_DIRECT');
      promoApp.style.display   = needApp   ? '' : 'none';
      promoPixel.style.display = needPixel ? '' : 'none';
      promoPage.style.display  = needPage  ? '' : 'none';
      promoWrap.style.display  = (needApp || needPixel || needPage) ? '' : 'none';

      // Auto-fetch Facebook pages when section becomes visible for the first time
      if (needPage && !promoPage._pagesFetched) {
        promoPage._pagesFetched = true;
        const loadingEl = ov.querySelector('#cas-page-loading');
        const searchEl  = ov.querySelector('#cas-page-search');
        const selectEl  = ov.querySelector('#cas-page-select');
        const errorEl   = ov.querySelector('#cas-page-error');
        const pageIdEl  = ov.querySelector('#cas-page-id');
        loadingEl.style.display = '';
        GET(`/accounts/${S.account_id}/pages`).then(data => {
          loadingEl.style.display = 'none';
          const pages = data.pages || [];
          if (pages.length === 0) {
            errorEl.textContent = 'Nenhuma página encontrada. Insira o ID manualmente.';
            errorEl.style.display = '';
            return;
          }
          selectEl.innerHTML = '<option value="">— selecione uma página —</option>' +
            pages.map(p => `<option value="${p.page_id}">${p.name} (${p.page_id})</option>`).join('');
          selectEl.style.display = '';
          searchEl.style.display = '';
          searchEl.addEventListener('input', () => {
            const q = searchEl.value.toLowerCase();
            [...selectEl.options].forEach(o => {
              o.hidden = o.value !== '' && !o.text.toLowerCase().includes(q);
            });
          });
          selectEl.addEventListener('change', () => {
            pageIdEl.value = selectEl.value;
          });
        }).catch(err => {
          loadingEl.style.display = 'none';
          errorEl.textContent = `Erro ao buscar páginas: ${err.message}`;
          errorEl.style.display = '';
        });
      }
    }
    destEl.addEventListener('change', _syncPromo);
    optgoalEl.addEventListener('change', _syncPromo);
    _syncPromo();

    // bid_amount required hint
    const bidStratEl = ov.querySelector('#cas-bidstrategy');
    const bidAmountEl = ov.querySelector('#cas-bid');
    const bidLabel = bidAmountEl.closest('.form-group')?.querySelector('label');
    function _syncBidHint() {
      const needsBid = ['LOWEST_COST_WITH_BID_CAP', 'COST_CAP'].includes(bidStratEl.value);
      if (bidLabel) bidLabel.innerHTML = needsBid
        ? 'Lance (R$) <span style="color:var(--red,#ef4444)">*obrigatório para ' + bidStratEl.value + '</span>'
        : 'Lance (R$) — obrigatório se LOWEST_COST_WITH_BID_CAP ou COST_CAP';
      bidAmountEl.required = needsBid;
    }
    bidStratEl.addEventListener('change', _syncBidHint);
    _syncBidHint();

    ov.querySelector('#btn-cas-save').onclick = async () => {
      const name     = ov.querySelector('#cas-name').value.trim();
      const lifetime = ov.querySelector('#cas-lifetime').value;
      const endTime  = ov.querySelector('#cas-end').value;
      if (!name) { toast('Nome é obrigatório', 'error'); return; }
      if (lifetime && !endTime) { toast('Data de término é obrigatória com orçamento vitalício', 'error'); return; }
      const _bidStratVal = ov.querySelector('#cas-bidstrategy').value;
      const _bidAmtVal   = ov.querySelector('#cas-bid').value;
      if (['LOWEST_COST_WITH_BID_CAP', 'COST_CAP'].includes(_bidStratVal) && !_bidAmtVal) {
        toast(`bid_amount é obrigatório para ${_bidStratVal}`, 'error'); return;
      }
      const targeting = readTargetingBuilder(ov.querySelector('#cas-targeting-builder'));
      if (!targeting.geo_locations || (!targeting.geo_locations.countries?.length &&
          !targeting.geo_locations.regions?.length && !targeting.geo_locations.cities?.length)) {
        toast('Targeting: informe ao menos um país, estado ou cidade', 'error'); return;
      }
      const body = {
        campaign_id:        campaignId,
        name,
        billing_event:      ov.querySelector('#cas-billing').value,
        optimization_goal:  ov.querySelector('#cas-optgoal').value,
        status:             ov.querySelector('#cas-status').value,
        targeting,
      };
      const daily      = ov.querySelector('#cas-daily').value;
      const bidStrat   = ov.querySelector('#cas-bidstrategy').value;
      const bidAmount  = ov.querySelector('#cas-bid').value;
      const destination= ov.querySelector('#cas-destination').value;
      const startTime  = ov.querySelector('#cas-start').value;
      const dsaBen     = ov.querySelector('#cas-dsa-ben').value.trim();
      const dsaPay     = ov.querySelector('#cas-dsa-pay').value.trim();
      if (daily)       body.daily_budget    = Math.round(parseFloat(daily)    * 100);
      if (lifetime)    body.lifetime_budget = Math.round(parseFloat(lifetime) * 100);
      if (endTime)     body.end_time        = new Date(endTime).toISOString();
      if (startTime)   body.start_time      = new Date(startTime).toISOString();
      if (bidStrat)    body.bid_strategy    = bidStrat;
      if (bidAmount)   body.bid_amount      = Math.round(parseFloat(bidAmount) * 100);
      if (destination) body.destination_type = destination;
      if (dsaBen)      body.dsa_beneficiary = dsaBen;
      if (dsaPay)      body.dsa_payor       = dsaPay;

      // promoted_object
      const dest2 = ov.querySelector('#cas-destination').value;
      const goal2 = ov.querySelector('#cas-optgoal').value;
      if (dest2 === 'APP') {
        const appId = ov.querySelector('#cas-app-id').value.trim();
        if (!appId) { toast('Application ID é obrigatório para destino APP', 'error'); return; }
        const promo = { application_id: appId };
        const storeUrl = ov.querySelector('#cas-app-store-url').value.trim();
        if (storeUrl) promo.object_store_url = storeUrl;
        body.promoted_object = promo;
      } else if (goal2 === 'OFFSITE_CONVERSIONS' || goal2 === 'VALUE') {
        const pixelId = ov.querySelector('#cas-pixel-id').value.trim();
        if (!pixelId) { toast('Pixel ID é obrigatório para este objetivo de otimização', 'error'); return; }
        const promo = { pixel_id: pixelId };
        const pixelEvent = ov.querySelector('#cas-pixel-event').value;
        if (pixelEvent) promo.custom_event_type = pixelEvent;
        body.promoted_object = promo;
      } else if (goal2 === 'PAGE_LIKES' || ['WHATSAPP','MESSENGER','INSTAGRAM_DIRECT'].includes(dest2)) {
        const pageId = ov.querySelector('#cas-page-id').value.trim();
        if (!pageId) { toast('Page ID é obrigatório para este destino/objetivo', 'error'); return; }
        body.promoted_object = { page_id: pageId };
      }

      const btn = ov.querySelector('#btn-cas-save');
      btn.disabled = true; btn.textContent = '...';
      try {
        await POST(`/accounts/${S.account_id}/adsets`, body);
        toast('Conjunto criado!', 'success');
        ov.remove();
        if (S.campaign) window.expSelectCampaign(campaignId);
      } catch(e) {
        ov.querySelector('#cas-result').innerHTML = `<div class="error-msg">${e.message}</div>`;
        btn.disabled = false; btn.textContent = 'Criar Conjunto';
      }
    };
  };

  window.expEditAdSet = (adsetId) => {
    const a = S.campaign?._adsets?.find(x => x.adset_id === adsetId) || S.adset;
    if (!a) { toast('Conjunto não encontrado no estado local', 'error'); return; }

    const ov = modal('Editar Conjunto', `
      <p class="mono" style="font-size:11px;color:var(--muted);margin-bottom:12px">${adsetId}</p>
      <div class="form-group"><label>Nome *</label><input id="eas-name" value="${a.name}" /></div>
      <div class="form-group"><label>Status</label>
        <select id="eas-status">
          <option value="ACTIVE" ${a.status==='ACTIVE'?'selected':''}>ACTIVE</option>
          <option value="PAUSED" ${a.status==='PAUSED'?'selected':''}>PAUSED</option>
          <option value="ARCHIVED" ${a.status==='ARCHIVED'?'selected':''}>ARCHIVED</option>
        </select>
      </div>
      <div class="form-group"><label>Orçamento Diário (R$)</label>
        <input type="number" id="eas-daily" value="${a.daily_budget?(a.daily_budget/100).toFixed(2):''}" min="0" step="0.01" />
      </div>
      <div class="form-group"><label>Orçamento Vitalício (R$)</label>
        <input type="number" id="eas-lifetime" value="${a.lifetime_budget?(a.lifetime_budget/100).toFixed(2):''}" min="0" step="0.01" />
      </div>
      <div class="form-group"><label>Lance (R$)</label>
        <input type="number" id="eas-bid" value="${a.bid_amount?(a.bid_amount/100).toFixed(2):''}" min="0" step="0.01" />
      </div>
      <div class="form-group"><label>Data de Término</label>
        <input type="datetime-local" id="eas-end" value="${a.end_time?a.end_time.slice(0,16):''}" />
      </div>
      <div id="eas-result"></div>`,
      `<button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn btn-primary" id="btn-eas-save">Salvar</button>`);

    ov.querySelector('#btn-eas-save').onclick = async () => {
      const name = ov.querySelector('#eas-name').value.trim();
      if (!name) { toast('Nome é obrigatório', 'error'); return; }
      const body = { name, status: ov.querySelector('#eas-status').value };
      const daily    = ov.querySelector('#eas-daily').value;
      const lifetime = ov.querySelector('#eas-lifetime').value;
      const bid      = ov.querySelector('#eas-bid').value;
      const endTime  = ov.querySelector('#eas-end').value;
      if (daily)    body.daily_budget    = Math.round(parseFloat(daily)    * 100);
      if (lifetime) body.lifetime_budget = Math.round(parseFloat(lifetime) * 100);
      if (bid)      body.bid_amount      = Math.round(parseFloat(bid)      * 100);
      if (endTime)  body.end_time = new Date(endTime).toISOString();
      const btn = ov.querySelector('#btn-eas-save');
      btn.disabled = true; btn.textContent = '...';
      try {
        await PATCH(`/accounts/${S.account_id}/adsets/${adsetId}`, body);
        toast('Conjunto atualizado!', 'success');
        ov.remove();
        if (S.campaign) window.expSelectCampaign(S.campaign.campaign_id);
      } catch(e) {
        ov.querySelector('#eas-result').innerHTML = `<div class="error-msg">${e.message}</div>`;
        btn.disabled = false; btn.textContent = 'Salvar';
      }
    };
  };

  window.expDeleteAdSet = (adsetId, adsetName) => {
    const ov = modal('Deletar Conjunto', `
      <p>Marcar como <strong>DELETED</strong>: <strong>${adsetName}</strong></p>
      <p class="mono" style="font-size:11px;color:var(--muted)">${adsetId}</p>
      <div id="del-as-result"></div>`,
      `<button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn btn-primary" style="background:var(--red,#ef4444)" id="btn-del-as">Confirmar Delete</button>`);

    ov.querySelector('#btn-del-as').onclick = async () => {
      const btn = ov.querySelector('#btn-del-as');
      btn.disabled = true; btn.textContent = '...';
      try {
        await DEL(`/accounts/${S.account_id}/adsets/${adsetId}`);
        toast('Conjunto deletado.', 'success');
        ov.remove();
        if (S.campaign) window.expSelectCampaign(S.campaign.campaign_id);
      } catch(e) {
        ov.querySelector('#del-as-result').innerHTML = `<div class="error-msg">${e.message}</div>`;
        btn.disabled = false; btn.textContent = 'Confirmar Delete';
      }
    };
  };

  // ── CRUD Anúncios ────────────────────────────────────────────────────────

  window.expCreateAd = (adsetId) => {
    const ov = modal('Novo Anúncio', `
      <p style="color:var(--yellow);font-size:12px;margin-bottom:12px">
        ⚠ O anúncio irá para revisão automática após criação (status efetivo: PENDING_REVIEW).
      </p>

      <div class="form-group"><label>Nome do Anúncio *</label><input id="cad-name" placeholder="Nome do anúncio" /></div>
      <div class="form-group"><label>Status</label>
        <select id="cad-status"><option value="PAUSED" selected>PAUSED</option><option value="ACTIVE">ACTIVE</option></select>
      </div>
      <div class="form-group"><label>Domínio de Conversão (opcional)</label>
        <input id="cad-domain" placeholder="ex: seusite.com.br" />
      </div>

      <div style="border:1px solid var(--border);border-radius:8px;padding:14px;margin:12px 0">
        <div style="font-size:12px;font-weight:600;margin-bottom:10px;color:var(--blue)">
          Criativo ${tip('Você pode usar um criativo existente (informe o ID) ou criar um novo inline. Se criar inline, o criativo será salvo separadamente antes do anúncio.')}
        </div>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <button type="button" id="cad-tab-existing" class="btn btn-primary btn-sm">Usar criativo existente</button>
          <button type="button" id="cad-tab-new" class="btn btn-ghost btn-sm">Criar criativo inline</button>
        </div>

        <div id="cad-existing-panel">
          <div class="form-group"><label>Creative ID *</label>
            <input id="cad-creative-id" placeholder="ID do criativo existente" />
          </div>
        </div>

        <div id="cad-new-panel" style="display:none">
          <div class="form-group"><label>Nome do Criativo *</label>
            <input id="cad-cr-name" placeholder="Nome do criativo" />
          </div>
          <div class="form-group"><label>object_story_id ${tip('ID de um post existente no Facebook. Use este OU object_story_spec abaixo.')}</label>
            <input id="cad-cr-story-id" placeholder="ex: 123456_789012" />
          </div>
          <div class="form-group"><label>Texto Principal (body)</label>
            <textarea id="cad-cr-body" rows="3" placeholder="Texto do anúncio..." style="width:100%;resize:vertical;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:8px;color:var(--text);font-size:13px"></textarea>
          </div>
          <div class="form-group"><label>Título</label>
            <input id="cad-cr-title" placeholder="Título do anúncio" />
          </div>
          <div class="form-group"><label>URL da Imagem</label>
            <input id="cad-cr-image-url" placeholder="https://..." />
          </div>
          <div class="form-group"><label>Image Hash ${tip('Hash da imagem já enviada para a biblioteca de imagens da conta.')}</label>
            <input id="cad-cr-image-hash" placeholder="hash da imagem" />
          </div>
          <div class="form-group"><label>Video ID</label>
            <input id="cad-cr-video-id" placeholder="ID do vídeo" />
          </div>
          <div class="form-group"><label>Call to Action ${tip('Botão de ação do anúncio. Exemplos: LEARN_MORE, SHOP_NOW, SIGN_UP, CONTACT_US, SEND_MESSAGE.')}</label>
            <input id="cad-cr-cta" placeholder="ex: LEARN_MORE" />
          </div>
          <div class="form-group"><label>object_story_spec (JSON) ${tip('Estrutura de criação do post inline. Para imagens: {page_id, link_data}. Para vídeos: {page_id, video_data}.')}</label>
            <textarea id="cad-cr-spec" rows="4" placeholder='{"page_id":"...","link_data":{...}}' style="width:100%;resize:vertical;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:8px;color:var(--text);font-family:monospace;font-size:12px"></textarea>
          </div>
        </div>
      </div>

      <div class="form-group"><label>Engagement Audience</label>
        <select id="cad-engagement">
          <option value="">— não definir —</option>
          <option value="true">true — criar público de engajamento</option>
          <option value="false">false</option>
        </select>
      </div>
      <div class="form-group"><label>Início do Agendamento</label>
        <input type="datetime-local" id="cad-sched-start" />
      </div>
      <div class="form-group"><label>Término do Agendamento</label>
        <input type="datetime-local" id="cad-sched-end" />
      </div>
      <div id="cad-result"></div>`,
      `<button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn btn-primary" id="btn-cad-save">Criar Anúncio</button>`);

    // Tabs criativo
    let cadMode = 'existing';
    ov.querySelector('#cad-tab-existing').onclick = () => {
      cadMode = 'existing';
      ov.querySelector('#cad-existing-panel').style.display = '';
      ov.querySelector('#cad-new-panel').style.display = 'none';
      ov.querySelector('#cad-tab-existing').className = 'btn btn-primary btn-sm';
      ov.querySelector('#cad-tab-new').className = 'btn btn-ghost btn-sm';
    };
    ov.querySelector('#cad-tab-new').onclick = () => {
      cadMode = 'new';
      ov.querySelector('#cad-existing-panel').style.display = 'none';
      ov.querySelector('#cad-new-panel').style.display = '';
      ov.querySelector('#cad-tab-existing').className = 'btn btn-ghost btn-sm';
      ov.querySelector('#cad-tab-new').className = 'btn btn-primary btn-sm';
    };

    ov.querySelector('#btn-cad-save').onclick = async () => {
      const name = ov.querySelector('#cad-name').value.trim();
      if (!name) { toast('Nome é obrigatório', 'error'); return; }

      const body = {
        adset_id: adsetId,
        name,
        status: ov.querySelector('#cad-status').value,
      };

      if (cadMode === 'existing') {
        const creativeId = ov.querySelector('#cad-creative-id').value.trim();
        if (!creativeId) { toast('Creative ID é obrigatório', 'error'); return; }
        body.creative_id = creativeId;
      } else {
        const crName = ov.querySelector('#cad-cr-name').value.trim();
        if (!crName) { toast('Nome do criativo é obrigatório', 'error'); return; }
        const specRaw = ov.querySelector('#cad-cr-spec').value.trim();
        let specParsed = null;
        if (specRaw) {
          try { specParsed = JSON.parse(specRaw); }
          catch { toast('object_story_spec inválido — verifique o JSON', 'error'); return; }
        }
        const creative_data = { name: crName };
        const storyId  = ov.querySelector('#cad-cr-story-id').value.trim();
        const crBody   = ov.querySelector('#cad-cr-body').value.trim();
        const crTitle  = ov.querySelector('#cad-cr-title').value.trim();
        const imageUrl = ov.querySelector('#cad-cr-image-url').value.trim();
        const imageHash= ov.querySelector('#cad-cr-image-hash').value.trim();
        const videoId  = ov.querySelector('#cad-cr-video-id').value.trim();
        const cta      = ov.querySelector('#cad-cr-cta').value.trim();
        if (storyId)   creative_data.object_story_id  = storyId;
        if (specParsed) creative_data.object_story_spec = specParsed;
        if (crBody)    creative_data.body              = crBody;
        if (crTitle)   creative_data.title             = crTitle;
        if (imageUrl)  creative_data.image_url         = imageUrl;
        if (imageHash) creative_data.image_hash        = imageHash;
        if (videoId)   creative_data.video_id          = videoId;
        if (cta)       creative_data.call_to_action_type = cta;
        body.creative_data = creative_data;
      }

      const domain     = ov.querySelector('#cad-domain').value.trim();
      const engagement = ov.querySelector('#cad-engagement').value;
      const schedStart = ov.querySelector('#cad-sched-start').value;
      const schedEnd   = ov.querySelector('#cad-sched-end').value;
      if (domain)     body.conversion_domain      = domain;
      if (engagement) body.engagement_audience    = engagement === 'true';
      if (schedStart) body.ad_schedule_start_time = new Date(schedStart).toISOString();
      if (schedEnd)   body.ad_schedule_end_time   = new Date(schedEnd).toISOString();

      const btn = ov.querySelector('#btn-cad-save');
      btn.disabled = true; btn.textContent = cadMode === 'new' ? 'Criando criativo e anúncio...' : '...';
      try {
        await POST(`/accounts/${S.account_id}/ads`, body);
        toast('Anúncio criado!', 'success');
        ov.remove();
        if (S.adset) window.expSelectAdSet(adsetId);
      } catch(e) {
        ov.querySelector('#cad-result').innerHTML = `<div class="error-msg">${e.message}</div>`;
        btn.disabled = false; btn.textContent = 'Criar Anúncio';
      }
    };
  };

  window.expEditAd = (adId) => {
    const ad = S.ads?.find(x => x.ad_id === adId) || S.ad;
    if (!ad) { toast('Anúncio não encontrado no estado local', 'error'); return; }

    const ov = modal('Editar Anúncio', `
      <p class="mono" style="font-size:11px;color:var(--muted);margin-bottom:12px">${adId}</p>
      <div class="form-group"><label>Nome *</label><input id="ead-name" value="${ad.name}" /></div>
      <div class="form-group"><label>Status</label>
        <select id="ead-status">
          <option value="ACTIVE" ${ad.status==='ACTIVE'?'selected':''}>ACTIVE</option>
          <option value="PAUSED" ${ad.status==='PAUSED'?'selected':''}>PAUSED</option>
          <option value="ARCHIVED" ${ad.status==='ARCHIVED'?'selected':''}>ARCHIVED</option>
        </select>
      </div>
      <div class="form-group"><label>Creative ID</label>
        <input id="ead-creative" value="${ad.creative_id||''}" placeholder="ID do criativo" />
      </div>
      <div id="ead-result"></div>`,
      `<button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn btn-primary" id="btn-ead-save">Salvar</button>`);

    ov.querySelector('#btn-ead-save').onclick = async () => {
      const name = ov.querySelector('#ead-name').value.trim();
      if (!name) { toast('Nome é obrigatório', 'error'); return; }
      const body = { name, status: ov.querySelector('#ead-status').value };
      const cr = ov.querySelector('#ead-creative').value.trim();
      if (cr) body.creative_id = cr;
      const btn = ov.querySelector('#btn-ead-save');
      btn.disabled = true; btn.textContent = '...';
      try {
        await PATCH(`/accounts/${S.account_id}/ads/${adId}`, body);
        toast('Anúncio atualizado!', 'success');
        ov.remove();
        if (S.adset) window.expSelectAdSet(S.adset.adset_id);
      } catch(e) {
        ov.querySelector('#ead-result').innerHTML = `<div class="error-msg">${e.message}</div>`;
        btn.disabled = false; btn.textContent = 'Salvar';
      }
    };
  };

  window.expDeleteAd = (adId, adName) => {
    const ov = modal('Deletar Anúncio', `
      <p>Marcar como <strong>DELETED</strong>: <strong>${adName}</strong></p>
      <p class="mono" style="font-size:11px;color:var(--muted)">${adId}</p>
      <div id="del-ad-result"></div>`,
      `<button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn btn-primary" style="background:var(--red,#ef4444)" id="btn-del-ad">Confirmar Delete</button>`);

    ov.querySelector('#btn-del-ad').onclick = async () => {
      const btn = ov.querySelector('#btn-del-ad');
      btn.disabled = true; btn.textContent = '...';
      try {
        await DEL(`/accounts/${S.account_id}/ads/${adId}`);
        toast('Anúncio deletado.', 'success');
        ov.remove();
        if (S.adset) window.expSelectAdSet(S.adset.adset_id);
      } catch(e) {
        ov.querySelector('#del-ad-result').innerHTML = `<div class="error-msg">${e.message}</div>`;
        btn.disabled = false; btn.textContent = 'Confirmar Delete';
      }
    };
  };

  window.expSyncCreative = async (creativeId) => {
    const btn = document.getElementById('btn-sync-creative');
    if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }
    try {
      S.creative = await POST(`/accounts/${S.account_id}/creatives/${creativeId}/sync`);
      render();
      toast('Criativo sincronizado!', 'success');
    } catch(e) {
      toast(e.message, 'error');
    }
  };

  window.expSyncInsights = (type, paramKey, paramValue) => {
    const today = new Date().toISOString().slice(0,10);
    const labels = { campaigns: 'Campanha', adsets: 'Conjunto', ads: 'Anuncio', placements: 'Anuncio (Posicionamentos)' };
    const ov = modal(`Sync Insights — ${labels[type]||type}`, `
      <p style="color:var(--muted);font-size:12px;margin-bottom:14px">
        Cria um job de insights filtrado por este ${labels[type]||type}.<br>
        <span class="mono" style="font-size:11px">${paramKey}: ${paramValue}</span>
      </p>
      <div class="form-group" style="margin-bottom:12px">
        <label>Data inicial</label>
        <input type="date" id="si-df" />
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label>Data final</label>
        <input type="date" id="si-dt" value="${today}" />
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label>Chunk (dias)</label>
        <input type="number" id="si-chunk" value="7" min="1" max="90" style="width:90px" />
      </div>
      <div id="si-result"></div>`,
      `<button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
       <button class="btn btn-primary" id="btn-si-start">⚡ Iniciar Job</button>`);
    ov.querySelector('#btn-si-start').onclick = async () => {
      const params = {
        [paramKey]:      paramValue,
        date_from:       ov.querySelector('#si-df').value   || undefined,
        date_to:         ov.querySelector('#si-dt').value   || undefined,
        chunk_size_days: ov.querySelector('#si-chunk').value || 7,
      };
      const btn = ov.querySelector('#btn-si-start');
      btn.disabled = true; btn.textContent = '...';
      try {
        const data = await api('POST', `/sync/${S.account_id}/insights/${type}`, null, params);
        ov.querySelector('#si-result').innerHTML =
          `<div class="success-msg">Job criado! ID: <code>${data.job_id}</code> — ${data.total_days} dias</div>`;
        toast('Job iniciado! Acompanhe na aba Jobs.', 'success');
      } catch(e) {
        ov.querySelector('#si-result').innerHTML = `<div class="error-msg">${e.message}</div>`;
        btn.disabled = false; btn.textContent = '⚡ Iniciar Job';
      }
    };
  };

  window.expChangeStatus = (type, id, currentStatus) => {
    const typeLabel = { campaigns: 'Campanha', adsets: 'Conjunto', ads: 'Anuncio' }[type];
    const pathMap   = { campaigns: 'campaigns', adsets: 'adsets', ads: 'ads' };

    const ov = modal(`Mudar Status — ${typeLabel}`,
      `<p style="color:var(--muted);font-size:12px;margin-bottom:14px">
         Status atual: ${statusBadge(currentStatus)}
         <span class="mono" style="font-size:11px;margin-left:6px">${id}</span>
       </p>
       <div class="form-group" style="margin-bottom:12px">
         <label>Novo status</label>
         <select id="cs-status">
           <option value="ACTIVE">ACTIVE — Ativar</option>
           <option value="PAUSED">PAUSED — Pausar</option>
           <option value="ARCHIVED">ARCHIVED — Arquivar</option>
           <option value="DELETED">DELETED — Deletar (irreversível)</option>
         </select>
       </div>
       <div id="cs-result"></div>`,
      `<button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn btn-primary" id="btn-cs-confirm">Confirmar</button>`);

    // Pré-selecionar o oposto do status atual
    const sel = ov.querySelector('#cs-status');
    if (currentStatus === 'ACTIVE') sel.value = 'PAUSED';
    else if (currentStatus === 'PAUSED') sel.value = 'ACTIVE';
    else sel.value = currentStatus || 'PAUSED';

    ov.querySelector('#btn-cs-confirm').onclick = async () => {
      const newStatus = sel.value;
      if (newStatus === 'DELETED' && !confirm('DELETED é irreversível no Meta. Confirmar?')) return;

      const btn = ov.querySelector('#btn-cs-confirm');
      btn.disabled = true; btn.textContent = '...';
      try {
        const updated = await PATCH(`/accounts/${S.account_id}/${pathMap[type]}/${id}`, { status: newStatus });

        // Atualiza o estado local sem precisar recarregar tudo
        if (type === 'campaigns' && S.campaigns) {
          const idx = S.campaigns.findIndex(c => c.campaign_id === id);
          if (idx !== -1) S.campaigns[idx] = { ...S.campaigns[idx], status: updated.status, effective_status: updated.effective_status };
        } else if (type === 'adsets' && S.campaign?._adsets) {
          const idx = S.campaign._adsets.findIndex(a => a.adset_id === id);
          if (idx !== -1) S.campaign._adsets[idx] = { ...S.campaign._adsets[idx], status: updated.status, effective_status: updated.effective_status };
        } else if (type === 'ads' && S.ads) {
          const idx = S.ads.findIndex(a => a.ad_id === id);
          if (idx !== -1) S.ads[idx] = { ...S.ads[idx], status: updated.status, effective_status: updated.effective_status };
        }

        toast(`Status atualizado para ${updated.status}`, 'success');
        ov.remove();
        render();
      } catch(e) {
        ov.querySelector('#cs-result').innerHTML = `<div class="error-msg">${e.message}</div>`;
        btn.disabled = false; btn.textContent = 'Confirmar';
      }
    };
  };

  render();
});

// ─────────────────────────────────────────────
// PAGE: INSIGHTS
// ─────────────────────────────────────────────
route('insights', async el => {
  await loadAccounts();
  let currentTab = 'campaigns';

  function render() {
    el.innerHTML = `
      <div class="page-header">
        <div><h2>Insights</h2><p>Metricas de performance sincronizadas</p></div>
      </div>
      <div style="margin-top:20px">
      <div class="card">
        <div class="form-row">
          <div class="form-group">
            <label>Conta *</label>
            <select id="ins-account">
              <option value="">selecione</option>
              ${accountOpts(_accounts)}
            </select>
          </div>
          <div class="form-group"><label>Data inicial</label><input type="date" id="ins-df" /></div>
          <div class="form-group"><label>Data final</label><input type="date" id="ins-dt" value="${new Date().toISOString().slice(0,10)}" /></div>
          <div class="form-group"><label>Granularidade</label>
            <select id="ins-gran">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div class="form-group"><label>ID (opcional)</label>
            <input id="ins-entity-id" placeholder="campaign_id / adset_id / ad_id" style="width:200px" />
          </div>
        </div>
        <div class="tabs">
          <div class="tab ${currentTab==='campaigns'?'active':''}" data-tab="campaigns">Campanhas</div>
          <div class="tab ${currentTab==='adsets'?'active':''}" data-tab="adsets">Conjuntos</div>
          <div class="tab ${currentTab==='ads'?'active':''}" data-tab="ads">Anuncios</div>
        </div>
        <button class="btn btn-primary" id="btn-load-ins">Carregar Insights</button>
      </div>
      <div id="ins-result"></div>
      </div>`;

    el.querySelectorAll('.tab').forEach(t => {
      t.onclick = () => { currentTab = t.dataset.tab; el.querySelectorAll('.tab').forEach(x => x.classList.remove('active')); t.classList.add('active'); };
    });
    el.querySelector('#btn-load-ins').onclick = loadInsights;
  }

  async function loadInsights() {
    const accId = el.querySelector('#ins-account').value;
    if (!accId) { toast('Selecione uma conta', 'error'); return; }
    const entityId = el.querySelector('#ins-entity-id').value.trim();
    const params = { account_id: accId,
      date_from:   el.querySelector('#ins-df').value   || undefined,
      date_to:     el.querySelector('#ins-dt').value   || undefined,
      granularity: el.querySelector('#ins-gran').value,
    };
    if (entityId) {
      if (currentTab === 'campaigns') params.campaign_id = entityId;
      else if (currentTab === 'adsets') params.adset_id  = entityId;
      else params.ad_id = entityId;
    }
    const res = el.querySelector('#ins-result');
    res.innerHTML = '<div class="loading">Carregando...</div>';
    try {
      const data = await GET('/insights/' + currentTab, params);
      if (!data.data || !data.data.length) { res.innerHTML = '<div class="empty">Nenhum insight encontrado para este periodo.</div>'; return; }
      const tot = data.data.reduce((acc, r) => ({
        impressions: acc.impressions + (r.impressions||0),
        reach:       acc.reach       + (r.reach||0),
        clicks:      acc.clicks      + (r.clicks||0),
        spend:       acc.spend       + (Number(r.spend)||0),
      }), { impressions:0, reach:0, clicks:0, spend:0 });
      const nameKey = currentTab==='campaigns'?'campaign_name':currentTab==='adsets'?'adset_name':'ad_name';
      const idKey   = currentTab==='campaigns'?'campaign_id'  :currentTab==='adsets'?'adset_id'  :'ad_id';
      const tabLabel = currentTab==='campaigns'?'Campanhas':currentTab==='adsets'?'Conjuntos':'Anúncios';
      // calcula altura dinâmica para o gráfico horizontal (máx 15 barras × 34px)
      const uniqueCount = new Set(data.data.map(r => r[idKey])).size;
      const chartH = Math.max(180, Math.min(15, uniqueCount) * 34 + 50);
      res.innerHTML = `
        <div class="grid3" style="margin-bottom:16px">
          <div class="stat-tile"><div class="val">${fmt.num(tot.impressions)}</div><div class="lbl">Impressoes (total)</div></div>
          <div class="stat-tile"><div class="val">${fmt.num(tot.clicks)}</div><div class="lbl">Cliques (total)</div></div>
          <div class="stat-tile"><div class="val" style="color:var(--yellow)">${fmt.currency(tot.spend)}</div><div class="lbl">Gasto total</div></div>
        </div>
        <div class="card" style="margin-bottom:16px">
          <div class="card-title">Evolucao no Tempo — ${tabLabel}</div>
          <div style="position:relative;height:260px">
            <canvas id="chart-ins-timeline"></canvas>
          </div>
        </div>
        <div class="card" style="margin-bottom:16px">
          <div class="card-title">Top Spend — ${tabLabel}</div>
          <div style="position:relative;height:${chartH}px">
            <canvas id="chart-ins-top"></canvas>
          </div>
        </div>
        <div class="card">
          <div class="card-title">${data.total} registros · ${data.granularity} · ${data.date_from||'?'} > ${data.date_to||'?'}</div>
          <div class="table-wrap"><table>
            <thead><tr><th>Nome</th><th>ID</th><th>Periodo</th>
              <th class="num">Impressoes ${tip('Número de vezes que o anúncio foi exibido na tela de um usuário.')}</th><th class="num">Alcance ${tip('Número de pessoas únicas que viram o anúncio ao menos uma vez.')}</th>
              <th class="num">Freq. ${tip('Número médio de vezes que cada pessoa viu o anúncio no período. Valores altos (>3) podem indicar saturação de público.')}</th><th class="num">Cliques ${tip('Total de cliques no anúncio (inclui cliques no link, curtidas, comentários, etc.).')}</th><th class="num">Link Clicks ${tip('Cliques exclusivamente no link de destino do anúncio (exclui curtidas, comentários, etc.).')}</th>
              <th class="num">Gasto ${tip('Valor total gasto no período, na moeda da conta.')}</th><th class="num">Gasto Social ${tip('Parte do gasto gerada por anúncios exibidos com contexto social (ex: "Seu amigo curtiu isto").')}</th><th class="num">CTR ${tip('Taxa de cliques: (cliques ÷ impressões) × 100. Indica a atratividade do anúncio.')}</th><th class="num">CTR Link ${tip('Taxa de cliques no link de destino: (link clicks ÷ impressões) × 100. Exclui cliques em curtidas e comentários.')}</th>
              <th class="num">CPM ${tip('Custo por mil impressões. Métrica de eficiência de entrega.')}</th><th class="num">CPC ${tip('Custo por clique. Total gasto dividido pelo número de cliques.')}</th><th class="num">CPP ${tip('Custo por pessoa alcançada. Gasto dividido pelo alcance.')}</th>
              <th class="num">Engaj. ${tip('Total de engajamentos no post do anúncio: curtidas, comentários, compartilhamentos e cliques no link.')}</th>
              ${currentTab==='adsets'?`<th class="num">Impr. Completas ${tip('Impressões em que o anúncio foi exibido inteiramente na tela sem rolagem.')}</th><th class="num">Alc. Completo ${tip('Número de pessoas únicas que tiveram o anúncio inteiramente visível na tela.')}</th>`:''}
              ${currentTab==='ads'?`<th class="num">Custo/Click Unico ${tip('Custo por clique único (de pessoas distintas). Exclui múltiplos cliques da mesma pessoa.')}</th>`:''}
              ${currentTab==='campaigns'?'<th>Objetivo</th><th>Tipo Compra</th>':''}
              ${currentTab==='ads'?`<th>Qualidade ${tip('Ranking de qualidade do anúncio em comparação com outros que competem pelo mesmo público.')}</th><th>Engaj. Rank. ${tip('Ranking da taxa de engajamento em comparação com anúncios competindo pelo mesmo público.')}</th><th>Conversao Rank. ${tip('Ranking da taxa de conversão esperada em comparação com anúncios com o mesmo objetivo e público.')}</th>`:''}
              <th>Atribuicao ${tip('Janela de atribuição configurada: período em que conversões são creditadas ao anúncio após clique ou visualização.')}</th>
              <th class="num">Plays ${tip('Número de vezes que o vídeo foi iniciado.')}</th><th class="num">30s ${tip('Visualizações com pelo menos 30 segundos assistidos. Indica engajamento qualificado.')}</th><th class="num">Tempo Medio ${tip('Tempo médio em segundos que os usuários assistiram ao vídeo.')}</th>
              <th class="num">25% ${tip('Visualizações que chegaram a 25% do vídeo.')}</th><th class="num">50% ${tip('Visualizações que chegaram a 50% do vídeo.')}</th><th class="num">75% ${tip('Visualizações que chegaram a 75% do vídeo.')}</th><th class="num">95% ${tip('Visualizações que chegaram a 95% do vídeo.')}</th><th class="num">100% ${tip('Visualizações completas — usuários que assistiram o vídeo inteiro.')}</th>
            </tr></thead>
            <tbody>${data.data.map(r => `<tr>
              <td>${r[nameKey]||'-'}</td>
              <td class="mono" style="font-size:11px">${r[idKey]}</td>
              <td class="muted">${r.date_start} > ${r.date_stop}</td>
              <td class="num">${fmt.num(r.impressions)}</td>
              <td class="num">${fmt.num(r.reach)}</td>
              <td class="num">${r.frequency!=null?Number(r.frequency).toFixed(2):'-'}</td>
              <td class="num">${fmt.num(r.clicks)}</td>
              <td class="num">${fmt.num(r.inline_link_clicks)}</td>
              <td class="num">${fmt.currency(r.spend)}</td>
              <td class="num">${fmt.currency(r.social_spend)}</td>
              <td class="num">${fmt.pct(r.ctr)}</td>
              <td class="num">${r.inline_link_click_ctr!=null?fmt.pct(r.inline_link_click_ctr):'-'}</td>
              <td class="num">${fmt.currency(r.cpm)}</td>
              <td class="num">${fmt.currency(r.cpc)}</td>
              <td class="num">${fmt.currency(r.cpp)}</td>
              <td class="num">${fmt.num(r.inline_post_engagement)}</td>
              ${currentTab==='adsets'?`<td class="num">${fmt.num(r.full_view_impressions)}</td><td class="num">${fmt.num(r.full_view_reach)}</td>`:''}
              ${currentTab==='ads'?`<td class="num">${fmt.currency(r.cost_per_unique_click)}</td>`:''}
              ${currentTab==='campaigns'?`<td>${objectiveBadge(r.objective)}</td><td>${buyingTypeBadge(r.buying_type)}</td>`:''}
              ${currentTab==='ads'?`<td class="muted" style="font-size:11px">${r.quality_ranking||'-'}</td><td class="muted" style="font-size:11px">${r.engagement_rate_ranking||'-'}</td><td class="muted" style="font-size:11px">${r.conversion_rate_ranking||'-'}</td>`:''}
              <td class="muted" style="font-size:11px">${r.attribution_setting||'-'}</td>
              <td class="num">${videoVal(r.video_play_actions)!=null?fmt.num(videoVal(r.video_play_actions)):'-'}</td>
              <td class="num">${videoVal(r.video_30_sec_watched_actions)!=null?fmt.num(videoVal(r.video_30_sec_watched_actions)):'-'}</td>
              <td class="num">${videoVal(r.video_avg_time_watched_actions)!=null?videoVal(r.video_avg_time_watched_actions).toFixed(1)+'s':'-'}</td>
              <td class="num">${videoVal(r.video_p25_watched_actions)!=null?fmt.num(videoVal(r.video_p25_watched_actions)):'-'}</td>
              <td class="num">${videoVal(r.video_p50_watched_actions)!=null?fmt.num(videoVal(r.video_p50_watched_actions)):'-'}</td>
              <td class="num">${videoVal(r.video_p75_watched_actions)!=null?fmt.num(videoVal(r.video_p75_watched_actions)):'-'}</td>
              <td class="num">${videoVal(r.video_p95_watched_actions)!=null?fmt.num(videoVal(r.video_p95_watched_actions)):'-'}</td>
              <td class="num">${videoVal(r.video_p100_watched_actions)!=null?fmt.num(videoVal(r.video_p100_watched_actions)):'-'}</td>
            </tr>`).join('')}
            </tbody></table></div>
        </div>`;
      buildTopSpendChart('chart-ins-top', data.data, nameKey, idKey);

      // Timeline agregado por data (soma de todas as entidades do resultado)
      const byDate = {};
      data.data.forEach(r => {
        const d = r.date_start;
        if (!byDate[d]) byDate[d] = { date_start: d, spend: 0, impressions: 0, clicks: 0, video_plays: 0 };
        byDate[d].spend       += Number(r.spend || 0);
        byDate[d].impressions += Number(r.impressions || 0);
        byDate[d].clicks      += Number(r.clicks || 0);
        const vp = videoVal(r.video_play_actions);
        if (vp != null) byDate[d].video_plays += vp;
      });
      const timelineRows = Object.values(byDate).sort((a, b) => a.date_start.localeCompare(b.date_start));
      const hasVideo = timelineRows.some(r => r.video_plays > 0);
      buildTimelineChart('chart-ins-timeline', timelineRows,
        hasVideo ? [{ label: 'Video Plays', key: 'video_plays', color: '#f472b6' }] : []
      );
    } catch(e) { res.innerHTML = `<div class="error-msg">${e.message}</div>`; }
  }

  render();
});

// ─────────────────────────────────────────────
// PAGE: CREATIVES
// ─────────────────────────────────────────────
route('creatives', async el => {
  await loadAccounts();
  let _accountId = localStorage.getItem('creatives_account') || '';
  let _creatives = null;

  function render() {
    el.innerHTML = `
      <div class="page-header">
        <div><h2>Criativos</h2><p>Gerencie criativos da conta selecionada</p></div>
      </div>
      <div style="margin-top:20px">
      <div class="card">
        <div class="form-row" style="align-items:flex-end">
          <div class="form-group">
            <label>Conta *</label>
            <select id="cr-account">
              <option value="">— selecione —</option>
              ${accountOpts(_accounts, _accountId)}
            </select>
          </div>
          <div class="form-group" style="justify-content:flex-end">
            <button class="btn btn-primary" id="btn-cr-load" style="margin-top:18px">Carregar Criativos</button>
          </div>
        </div>
      </div>
      <div id="cr-table"></div>
      </div>`;

    el.querySelector('#cr-account').value = _accountId;
    el.querySelector('#btn-cr-load').onclick = loadCreatives;
    if (_creatives) renderTable();
  }

  function renderTable() {
    const container = el.querySelector('#cr-table');
    if (!_creatives || !_creatives.length) {
      container.innerHTML = '<div class="card"><div class="empty">Nenhum criativo encontrado.</div></div>';
      return;
    }
    container.innerHTML = `<div class="card">
      <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Criativos (${_creatives.length})</span>
        <button class="btn btn-primary btn-sm" onclick="crCreate()">+ Novo Criativo</button>
      </div>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>Thumb</th><th>ID ${tip('Identificador único do criativo na Meta API. Útil para debug ou para reusar o criativo em novos anúncios.')}</th><th>Nome ${tip('Nome interno do criativo. Não aparece para o usuário final — usado apenas para organização.')}</th><th>Status ${tip('Status do criativo: ACTIVE (ativo), PAUSED (pausado), DELETED (excluído).')}</th><th>Tipo ${tip('Tipo do criativo: IMAGE (imagem estática), VIDEO, SHARE (post compartilhado), STATUS.')}</th><th>CTA ${tip('Botão de chamada para ação exibido no anúncio: LEARN_MORE, SHOP_NOW, SIGN_UP, CONTACT_US, etc.')}</th><th>Sincronizado ${tip('Última vez que os dados deste criativo foram sincronizados do Meta para o banco local.')}</th><th>Acoes</th>
        </tr></thead>
        <tbody>${_creatives.map(cr => `<tr>
          <td>${cr.thumbnail_url?`<img src="${cr.thumbnail_url}" style="width:48px;height:48px;object-fit:cover;border-radius:4px;border:1px solid var(--border)">`:'<span style="color:var(--muted);font-size:11px">—</span>'}</td>
          <td class="mono" style="font-size:11px">${cr.creative_id}</td>
          <td><strong>${cr.name||'-'}</strong></td>
          <td>${statusBadge(cr.status)}</td>
          <td class="muted" style="font-size:11px">${cr.object_type||'-'}</td>
          <td class="muted" style="font-size:11px">${cr.call_to_action_type||'-'}</td>
          <td class="muted">${fmt.ts(cr.synced_at)}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-ghost btn-sm" onclick="crRename('${cr.creative_id}','${(cr.name||'').replace(/'/g,"\\'")}')">&#9998; Renomear</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="crDelete('${cr.creative_id}','${(cr.name||'').replace(/'/g,"\\'")}')">&#128465;</button>
          </td>
        </tr>`).join('')}
        </tbody>
      </table></div>
    </div>`;
  }

  async function loadCreatives() {
    _accountId = el.querySelector('#cr-account').value;
    if (!_accountId) { toast('Selecione uma conta', 'error'); return; }
    localStorage.setItem('creatives_account', _accountId);
    const container = el.querySelector('#cr-table');
    container.innerHTML = '<div class="loading">Carregando...</div>';
    try {
      _creatives = await GET(`/accounts/${_accountId}/creatives`, { limit: 500 });
      renderTable();
    } catch(e) {
      container.innerHTML = `<div class="error-msg">${e.message}</div>`;
    }
  }

  window.crCreate = () => {
    let tab = 'post';
    const ov = modal('Novo Criativo', `
      <div class="tabs" style="margin-bottom:16px">
        <div class="tab active" data-ctab="post" onclick="crSwitchTab('post',this)">Post Existente</div>
        <div class="tab" data-ctab="inline" onclick="crSwitchTab('inline',this)">Link Inline</div>
      </div>
      <div id="cr-tab-post">
        <div class="form-group"><label>Nome *</label><input id="cr-name-post" placeholder="Nome do criativo" /></div>
        <div class="form-group"><label>object_story_id * <span style="color:var(--muted);font-size:11px">(pageID_postID)</span></label>
          <input id="cr-story-id" placeholder="ex: 123456789_987654321" /></div>
      </div>
      <div id="cr-tab-inline" style="display:none">
        <div class="form-group"><label>Nome *</label><input id="cr-name-inline" placeholder="Nome do criativo" /></div>
        <div class="form-group"><label>Page ID *</label><input id="cr-page-id" placeholder="ID da página do Facebook" /></div>
        <div class="form-group"><label>URL de destino *</label><input id="cr-link" type="url" placeholder="https://seusite.com.br" /></div>
        <div class="form-group"><label>Texto do anuncio <span style="color:var(--muted);font-size:11px">(máx 125 chars)</span></label>
          <textarea id="cr-message" rows="3" maxlength="200"></textarea></div>
        <div class="form-group"><label>Título <span style="color:var(--muted);font-size:11px">(máx 25 chars)</span></label>
          <input id="cr-title" maxlength="25" /></div>
        <div class="form-group"><label>Call to Action</label>
          <select id="cr-cta">
            <option value="LEARN_MORE">LEARN_MORE</option>
            <option value="SHOP_NOW">SHOP_NOW</option>
            <option value="SIGN_UP">SIGN_UP</option>
            <option value="DOWNLOAD">DOWNLOAD</option>
            <option value="GET_QUOTE">GET_QUOTE</option>
            <option value="CONTACT_US">CONTACT_US</option>
          </select>
        </div>
        <div class="form-group"><label>URL da imagem (opcional)</label><input id="cr-img-url" type="url" /></div>
      </div>
      <div id="cr-create-result"></div>`,
      `<button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn btn-primary" id="btn-cr-create">Criar</button>`);

    window.crSwitchTab = (t, el2) => {
      tab = t;
      ov.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      el2.classList.add('active');
      ov.querySelector('#cr-tab-post').style.display   = t === 'post'   ? '' : 'none';
      ov.querySelector('#cr-tab-inline').style.display = t === 'inline' ? '' : 'none';
    };

    ov.querySelector('#btn-cr-create').onclick = async () => {
      const btn = ov.querySelector('#btn-cr-create');
      btn.disabled = true; btn.textContent = '...';
      const resEl = ov.querySelector('#cr-create-result');
      try {
        let body;
        if (tab === 'post') {
          const name    = ov.querySelector('#cr-name-post').value.trim();
          const storyId = ov.querySelector('#cr-story-id').value.trim();
          if (!name || !storyId) throw new Error('Nome e object_story_id são obrigatórios');
          body = { name, object_story_id: storyId };
        } else {
          const name   = ov.querySelector('#cr-name-inline').value.trim();
          const pageId = ov.querySelector('#cr-page-id').value.trim();
          const link   = ov.querySelector('#cr-link').value.trim();
          if (!name || !pageId || !link) throw new Error('Nome, Page ID e URL são obrigatórios');
          const spec = {
            page_id: pageId,
            link_data: {
              link,
              message: ov.querySelector('#cr-message').value.trim() || undefined,
              name:    ov.querySelector('#cr-title').value.trim()   || undefined,
              call_to_action: { type: ov.querySelector('#cr-cta').value },
            },
          };
          const imgUrl = ov.querySelector('#cr-img-url').value.trim();
          if (imgUrl) spec.link_data.picture = imgUrl;
          body = { name, object_story_spec: spec };
        }
        await POST(`/accounts/${_accountId}/creatives`, body);
        toast('Criativo criado!', 'success');
        ov.remove();
        loadCreatives();
      } catch(e) {
        resEl.innerHTML = `<div class="error-msg">${e.message}</div>`;
        btn.disabled = false; btn.textContent = 'Criar';
      }
    };
  };

  window.crRename = (creativeId, currentName) => {
    const ov = modal('Renomear Criativo', `
      <p class="mono" style="font-size:11px;color:var(--muted);margin-bottom:12px">${creativeId}</p>
      <div class="form-group"><label>Novo nome *</label><input id="cr-new-name" value="${currentName}" /></div>
      <div id="cr-rename-result"></div>`,
      `<button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn btn-primary" id="btn-cr-rename">Salvar</button>`);

    ov.querySelector('#btn-cr-rename').onclick = async () => {
      const name = ov.querySelector('#cr-new-name').value.trim();
      if (!name) { toast('Nome é obrigatório', 'error'); return; }
      const btn = ov.querySelector('#btn-cr-rename');
      btn.disabled = true; btn.textContent = '...';
      try {
        await PATCH(`/accounts/${_accountId}/creatives/${creativeId}`, { name });
        toast('Criativo renomeado!', 'success');
        ov.remove();
        loadCreatives();
      } catch(e) {
        ov.querySelector('#cr-rename-result').innerHTML = `<div class="error-msg">${e.message}</div>`;
        btn.disabled = false; btn.textContent = 'Salvar';
      }
    };
  };

  window.crDelete = (creativeId, creativeName) => {
    const ov = modal('Deletar Criativo', `
      <p>Deletar: <strong>${creativeName}</strong></p>
      <p class="mono" style="font-size:11px;color:var(--muted)">${creativeId}</p>
      <p style="color:var(--yellow);font-size:12px">⚠ Não é possível deletar criativos vinculados a anúncios ativos.</p>
      <div id="cr-del-result"></div>`,
      `<button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn btn-primary" style="background:var(--red,#ef4444)" id="btn-cr-del">Deletar</button>`);

    ov.querySelector('#btn-cr-del').onclick = async () => {
      const btn = ov.querySelector('#btn-cr-del');
      btn.disabled = true; btn.textContent = '...';
      try {
        await DEL(`/accounts/${_accountId}/creatives/${creativeId}`);
        toast('Criativo deletado.', 'success');
        ov.remove();
        loadCreatives();
      } catch(e) {
        ov.querySelector('#cr-del-result').innerHTML = `<div class="error-msg">${e.message}</div>`;
        btn.disabled = false; btn.textContent = 'Deletar';
      }
    };
  };

  render();
});

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Base URL input sync
  const input = document.getElementById('base-url-input');
  input.value = BASE_URL;
  input.addEventListener('change', e => setBaseUrl(e.target.value));

  // Clean up poll on navigation
  window.addEventListener('hashchange', () => {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  });

  // ── Tooltip global (data-tip) ──
  const globalTip = document.getElementById('global-tip');
  let _tipHideTimer = null;

  function _showTip(el) {
    if (!globalTip) return;
    if (_tipHideTimer) { clearTimeout(_tipHideTimer); _tipHideTimer = null; }
    globalTip.textContent = el.dataset.tip;
    globalTip.style.display = 'block';
    const r = el.getBoundingClientRect();
    const tipW = globalTip.offsetWidth;
    const tipH = globalTip.offsetHeight;
    let left = r.left;
    if (left + tipW > window.innerWidth - 10) left = window.innerWidth - tipW - 10;
    // position: fixed → coordenadas relativas à viewport, sem somar scrollX/scrollY
    let top = r.bottom + 6;
    if (top + tipH > window.innerHeight - 10) top = r.top - tipH - 6;
    globalTip.style.left = Math.max(6, left) + 'px';
    globalTip.style.top  = Math.max(6, top) + 'px';
  }

  function _scheduleTipHide() {
    _tipHideTimer = setTimeout(() => {
      if (globalTip) globalTip.style.display = 'none';
      _tipHideTimer = null;
    }, 150);
  }

  document.addEventListener('mouseover', e => {
    const el = e.target.closest('[data-tip]');
    if (el) { _showTip(el); return; }
    // Se o mouse entrou no próprio tooltip, cancelar o hide
    if (e.target.closest('#global-tip')) {
      if (_tipHideTimer) { clearTimeout(_tipHideTimer); _tipHideTimer = null; }
    }
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest('[data-tip]') || e.target.closest('#global-tip')) {
      _scheduleTipHide();
    }
  });

  // ── Fechar dropdowns ao clicar fora ──
  document.addEventListener('click', e => {
    if (!e.target.closest('.action-dropdown')) {
      document.querySelectorAll('.action-dropdown.open').forEach(d => d.classList.remove('open'));
    }
  });

  const page = window.location.hash.slice(1) || 'accounts';
  renderRoute(page);
});
