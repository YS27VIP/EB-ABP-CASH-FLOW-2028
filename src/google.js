/* ===== Google Sign-In + Google Sheets API (reemplaza al backend Apps Script) ===== */

const CLIENT_ID = '1047108194529-98buam3t5p1gu1vv48v8d6s3q7o9qoaj.apps.googleusercontent.com'
const SHEET_ID = '1TtrRjRqwvBbwMic-3Epgwl-KabBjY8nTtwD3iOZN5N0'
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets openid email profile'

const MESES = ['ene-28', 'feb-28', 'mar-28', 'abr-28', 'may-28', 'jun-28', 'jul-28', 'ago-28', 'sep-28', 'oct-28', 'nov-28', 'dic-28']
const HEAD = ['EMPRESA', 'RUBRO', 'SBU', 'MARCA'].concat(MESES)
const HIST_HEAD = ['EMPRESA', 'AÑO', 'TIPO', 'RUBRO', 'SBU', 'MARCA', 'MES', 'MONTO', 'CLIENTE', 'PAIS']

let _token = null, _email = null, _name = null, _tokenClient = null
const _subs = []
export function onAuth(cb) { _subs.push(cb); return () => { const i = _subs.indexOf(cb); if (i >= 0) _subs.splice(i, 1) } }
function _emit() { _subs.forEach((cb) => { try { cb({ token: _token, email: _email, name: _name }) } catch { } }) }

export function isSignedIn() { return !!_token }
export function getEmail() { return _email }
export function getName() { return _name }

let _authReady = null
export function initAuth() {
  if (_authReady) return _authReady
  _authReady = new Promise((resolve) => {
    const t = setInterval(() => {
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        clearInterval(t)
        _tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID, scope: SCOPES,
          callback: async (resp) => {
            if (resp && resp.access_token) { _token = resp.access_token; try { localStorage.setItem('abp_granted', '1') } catch { } await _fetchUser(); try { if (_email) localStorage.setItem('abp_email', _email) } catch { } _emit() }
          },
        })
        resolve()
      }
    }, 120)
  })
  return _authReady
}
export function signIn() { if (!_tokenClient) return; let granted = false, hint = ''; try { granted = !!localStorage.getItem('abp_granted'); hint = localStorage.getItem('abp_email') || '' } catch { } const cfg = { prompt: granted ? '' : 'consent' }; if (hint) cfg.hint = hint; _tokenClient.requestAccessToken(cfg) }
export function signOut() { _token = null; _email = null; _name = null; _emit() }

async function _fetchUser() {
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + _token } })
    const j = await r.json(); _email = j.email || ''; _name = j.name || (j.email ? j.email.split('@')[0] : '')
  } catch { }
}

/* ---- Low-level Sheets API v4 ---- */
async function _api(path, opts = {}) {
  const r = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + SHEET_ID + path, {
    ...opts, headers: { Authorization: 'Bearer ' + _token, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  })
  if (r.status === 401) { signIn(); throw new Error('Sesión expirada, vuelve a intentar.') }
  if (!r.ok) { let e = ''; try { e = (await r.json()).error?.message || '' } catch { } throw new Error('Sheets ' + r.status + ' ' + e) }
  return r.json()
}
const A1 = (t) => "'" + String(t).replace(/'/g, "''") + "'"
async function readValues(tab) { try { const j = await _api('/values/' + encodeURIComponent(A1(tab))); return j.values || [] } catch { return [] } }
async function writeValues(tab, a1, values, raw) { return _api('/values/' + encodeURIComponent(A1(tab) + '!' + a1) + '?valueInputOption=' + (raw ? 'RAW' : 'USER_ENTERED'), { method: 'PUT', body: JSON.stringify({ values }) }) }
async function appendValues(tab, values, raw) { return _api('/values/' + encodeURIComponent(A1(tab) + '!A1') + ':append?valueInputOption=' + (raw ? 'RAW' : 'USER_ENTERED') + '&insertDataOption=INSERT_ROWS', { method: 'POST', body: JSON.stringify({ values }) }) }
async function clearValues(tab) { return _api('/values/' + encodeURIComponent(A1(tab)) + ':clear', { method: 'POST', body: '{}' }) }
async function batchUpdateValues(data) { return _api('/values:batchUpdate', { method: 'POST', body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }) }) }
async function sheetTitles() { const j = await _api('?fields=sheets.properties.title'); return (j.sheets || []).map((s) => s.properties.title) }
async function ensureTab(title, header) {
  const titles = await sheetTitles()
  if (!titles.includes(title)) {
    await _api(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }) })
    if (header) await writeValues(title, 'A1', [header])
  }
}

/* ---- Helpers de dominio (equivalentes al backend) ---- */
const up = (s) => String(s == null ? '' : s).trim().toUpperCase()
const k4 = (a, b, c, d) => [a, b, c, d].map(up).join('|')
const pad12 = (a) => { const o = (a || []).slice(0, 12); while (o.length < 12) o.push(0); return o }
const colLetter = (n) => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26) } return s }

export async function gReadTab(tab) { const values = await readValues(tab); return { ok: true, values } }

/* ---- Histórico EN VIVO desde el libro EBP (se actualiza solo al avanzar el EBP) ---- */
const EBP_SHEET_ID = '1OZNU8e2P8D8Dewa0rz9fGL7B-h8RJ6_7XGGuUpro8wc'
const EBP_TABS = [{ names: ['UNIDADES COSTO VENTAS', 'UNIDADES VENTA COSTO'], year: 2026 }, { names: ['VENTA REAL 2025'], year: 2025 }]
const MES_NUM = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, sept: 8, oct: 9, nov: 10, dic: 11 }
async function readValuesFrom(sheetId, tab) {
  try {
    const r = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + sheetId + '/values/' + encodeURIComponent(A1(tab)), { headers: { Authorization: 'Bearer ' + _token } })
    if (!r.ok) return []
    const j = await r.json(); return j.values || []
  } catch { return [] }
}
let _histCache = null, _histAt = 0, _histPromise = null
async function _buildHistorico() {
  const out = [HIST_HEAD]
  // Otras empresas (TUMAR, TAHO, …): histórico importado por Excel y guardado en la hoja Historico (todo lo que NO sea ENERGY BRANDS).
  try { const tab = await readValues('Historico'); tab.slice(1).forEach((r) => { if (String(r[0] || '').trim().toUpperCase() !== 'ENERGY BRANDS') out.push(r) }) } catch { }
  let ebRows = 0
  for (const t of EBP_TABS) {
    let rows = []
    // Reintenta la lectura del EBP: un 429/red transitorio no debe dejar el histórico vacío
    for (const nm of t.names) { for (let intento = 0; intento < 3; intento++) { rows = await readValuesFrom(EBP_SHEET_ID, nm); if (rows && rows.length) break; await new Promise((r) => setTimeout(r, 500 * (intento + 1))) } if (rows && rows.length) break }
    let hr = -1
    for (let i = 0; i < Math.min(rows.length, 15); i++) { const cells = rows[i].map((x) => String(x || '').trim().toUpperCase()); if ((cells.includes('SBU') && cells.includes('MARCA')) || cells.join('|').indexOf('CLIENTE ARMONIZADO') >= 0) { hr = i; break } }
    if (hr < 0) continue
    const H = rows[hr].map((x) => String(x || '').trim().toUpperCase())
    const idx = (cands, last) => { let f = -1; for (const c of cands) { for (let k = 0; k < H.length; k++) { if (H[k] === c) { if (last) f = k; else return k } } if (f >= 0 && !last) return f } return f }
    const iT = idx(['TIPO']), iR = idx(['RUBRO']), iS = idx(['SBU']), iM = idx(['MARCA', 'BRAND', 'ARCH']), iC = idx(['CLIENTE ARMONIZADO', 'BUYER', 'CLIENTE']), iV = idx(['VALOR EN DOLARES', 'DOLARES', 'VALOR']), iMes = idx(['FECHA ARREGLADA', 'MES', 'FECHA']), iP = idx(['PAIS'], true), iA = idx(['AÑO', 'ANO'])
    for (let r = hr + 1; r < rows.length; r++) {
      const row = rows[r]
      const cli = String(row[iC] || '').trim()
      const mar = String(row[iM] || '').trim()
      const tipo = up(row[iT]); if (tipo === 'TAHO') continue // EB = "SIN TAHO"; TAHO es empresa aparte
      const rub = String(row[iR] || '').trim().toUpperCase(); if (!(rub.indexOf('UNIDAD') >= 0 || rub.indexOf('COSTO') >= 0 || rub.indexOf('VENTA') >= 0)) continue
      if (!mar && !cli) continue
      const mm = String(row[iMes] || '').trim().toLowerCase().replace(' ', '-').split('-'); const mo = MES_NUM[mm[0]]; if (mo == null) continue
      const yr = (iA >= 0 && row[iA]) ? parseInt(row[iA], 10) : (mm[1] ? 2000 + parseInt(mm[1], 10) : t.year)
      const monto = Number(String(row[iV] || '').replace(/[^0-9.\-]/g, '')) || 0
      out.push(['ENERGY BRANDS', yr, String(row[iT] || ''), String(row[iR] || ''), String(row[iS] || ''), String(row[iM] || ''), yr + '-' + String(mo + 1).padStart(2, '0') + '-01', monto, cli, String(row[iP] || '')])
      ebRows++
    }
  }
  // Solo cachea si trajo datos del EBP; si vino vacío (cuota/red), NO envenena la caché y reintenta al próximo llamado
  if (ebRows > 0) { _histCache = out; _histAt = Date.now() }
  return out
}
export async function gHistorico() {
  if (_histCache && Date.now() - _histAt < 60000) return { ok: true, values: _histCache }
  // Deduplica llamadas simultáneas: todas las pantallas comparten una sola lectura del EBP
  if (!_histPromise) _histPromise = _buildHistorico().finally(() => { _histPromise = null })
  const out = await _histPromise
  return { ok: true, values: out }
}

/* ABP 2027 (plan) desde la hoja PLAN del EBP: suma Venta/Costo/Unidades por marca (solo EB = "SIN TAHO"). */
let _planCache = null, _planAt = 0
export async function gPlan2027() {
  if (_planCache && Date.now() - _planAt < 300000) return _planCache
  const rows = await readValuesFrom(EBP_SHEET_ID, 'PLAN')
  const out = {}
  let hr = -1
  for (let i = 0; i < Math.min(rows.length, 15); i++) { const c = rows[i].map((x) => String(x || '').trim().toUpperCase()); if (c.includes('SBU') && c.includes('MARCA')) { hr = i; break } }
  if (hr >= 0) {
    const H = rows[hr].map((x) => String(x || '').trim().toUpperCase())
    const idx = (cands) => { for (const c of cands) { const k = H.indexOf(c); if (k >= 0) return k } return -1 }
    const iT = idx(['TIPO']), iR = idx(['RUBRO']), iM = idx(['MARCA', 'BRAND', 'ARCH']), iV = idx(['VALOR EN DOLARES', 'VALOR'])
    for (let r = hr + 1; r < rows.length; r++) {
      const row = rows[r]; if (up(row[iT]) === 'TAHO') continue
      const mar = String(row[iM] || '').trim(); if (!mar) continue
      const rub = up(row[iR]); const monto = Number(String(row[iV] || '').replace(/[^0-9.\-]/g, '')) || 0
      const o = out[up(mar)] || (out[up(mar)] = { venta: 0, costo: 0, unidades: 0 })
      if (rub.indexOf('VENTA') >= 0) o.venta += monto; else if (rub.indexOf('COSTO') >= 0) o.costo += monto; else if (rub.indexOf('UNIDAD') >= 0) o.unidades += monto
    }
  }
  _planCache = { ok: true, map: out }; _planAt = Date.now(); return _planCache
}

/* Administradores: quién ve Gerencia y Combinaciones. yalik siempre es admin. */
export async function gLoadAdmins() {
  const v = await readValues('Config_Admins')
  return v.slice(1).map((r) => String(r[0] || '').trim().toLowerCase()).filter(Boolean)
}
export async function gSaveAdmins(emails) {
  await ensureTab('Config_Admins', ['EMAIL'])
  await clearValues('Config_Admins')
  const out = [['EMAIL'], ...emails.filter(Boolean).map((e) => [String(e).trim().toLowerCase()])]
  await writeValues('Config_Admins', 'A1', out)
  return { ok: true }
}

/* Marcas personalizadas (además de las predefinidas) */
export async function gLoadMarcas() {
  const v = await readValues('Config_Marcas')
  return v.slice(1).map((r) => String(r[0] || '').trim()).filter(Boolean)
}
export async function gSaveMarcas(list) {
  await ensureTab('Config_Marcas', ['MARCA'])
  await clearValues('Config_Marcas')
  await writeValues('Config_Marcas', 'A1', [['MARCA'], ...list.filter(Boolean).map((m) => [String(m).trim()])])
  return { ok: true }
}

export async function gLoadConfig() {
  const [emps, comb] = await Promise.all([readValues('Config_Empresas'), readValues('Config_Combinaciones')])
  const empresas = emps.slice(1).map((r) => r[0]).filter(Boolean)
  const combos = {}
  comb.slice(1).forEach((r) => { const em = r[0], sbu = r[1], m = r[2]; if (!em || !sbu || !m) return; (combos[em] = combos[em] || {}); (combos[em][sbu] = combos[em][sbu] || []).push(m) })
  return { ok: true, empresas, combos }
}

export async function gSaveConfig(empresa, combos) {
  await ensureTab('Config_Empresas', ['EMPRESA'])
  await ensureTab('Config_Combinaciones', ['EMPRESA', 'SBU', 'MARCA'])
  const emps = (await readValues('Config_Empresas')).slice(1).map((r) => r[0])
  if (empresa && emps.indexOf(empresa) < 0) await appendValues('Config_Empresas', [[empresa]])
  const all = await readValues('Config_Combinaciones')
  const header = all[0] || ['EMPRESA', 'SBU', 'MARCA']
  const kept = all.slice(1).filter((r) => String(r[0]) !== empresa)
  const added = []
  Object.keys(combos || {}).forEach((sbu) => (combos[sbu] || []).forEach((m) => added.push([empresa, sbu, m])))
  const out = [header, ...kept, ...added]
  await clearValues('Config_Combinaciones')
  await writeValues('Config_Combinaciones', 'A1', out)
  return { ok: true }
}

export async function gSaveRows(tab, empresa, usuario, rol, rows) {
  await ensureTab(tab, HEAD)
  const values = await readValues(tab)
  const idx = {}
  for (let r = 1; r < values.length; r++) idx[k4(values[r][0], values[r][1], values[r][2], values[r][3])] = r
  const data = [], appends = []
  rows.forEach((row) => {
    const key = k4(empresa, row.rubro, row.sbu, row.marca), meses = pad12(row.meses || [])
    if (idx[key] !== undefined) { const r = idx[key] + 1; data.push({ range: A1(tab) + '!E' + r + ':P' + r, values: [meses] }) }
    else appends.push([empresa, row.rubro, row.sbu, row.marca, ...meses])
  })
  if (data.length) await batchUpdateValues(data)
  if (appends.length) await appendValues(tab, appends)
  await registrar(usuario, rol, tab, empresa, rows.length + ' fila(s)')
  return { ok: true, filas: rows.length }
}

export async function gSaveHistorico(values) {
  await ensureTab('Historico', HIST_HEAD)
  const W = HIST_HEAD.length
  const hasHeader = up((values[0] || [])[0]).indexOf('EMPRESA') >= 0
  const incoming = (hasHeader ? values.slice(1) : values).map((r) => {
    const o = []; let vacia = true
    for (let i = 0; i < W; i++) { const v = (r && r[i] != null) ? r[i] : ''; if (v !== '') vacia = false; o.push(v) }
    return vacia ? null : o
  }).filter(Boolean)
  const nuevas = {}; incoming.forEach((r) => { nuevas[up(r[0])] = true })
  const cur = await readValues('Historico')
  const kept = cur.slice(1).filter((r) => { const em = up(r[0]); return em && !nuevas[em] })
  const out = [HIST_HEAD, ...kept, ...incoming]
  await clearValues('Historico')
  await writeValues('Historico', 'A1', out)
  return { ok: true, filas: incoming.length, total: out.length - 1 }
}

/* ===== Base de clientes: se lee DIRECTO de la hoja "BASE CLIENTES SF" de este mismo
   Sheet (columnas CLIENTE · CLIENTE ARMONIZADO · PAIS). Sin dependencia del EBP.
   El desplegable usa el CLIENTE ARMONIZADO (así concuerda con histórico y captura). */
function _idxCliente(H) {
  let k = H.findIndex((c) => c.indexOf('CLIENTE ARMONIZADO') >= 0)
  if (k < 0) k = H.findIndex((c) => c.indexOf('CLIENTE') >= 0)
  return k < 0 ? 0 : k
}
export async function gLoadClientes() {
  const v = await readValues('BASE CLIENTES SF')
  if (!v || v.length < 2) return { ok: true, clientes: [] }
  const H = (v[0] || []).map((x) => String(x || '').trim().toUpperCase())
  const iC = _idxCliente(H)
  const set = new Set()
  for (let r = 1; r < v.length; r++) { const n = String((v[r] || [])[iC] || '').trim(); if (n) set.add(n) }
  return { ok: true, clientes: [...set].sort((a, b) => a.localeCompare(b)) }
}
export async function gAddCliente(nombre) {
  const n = String(nombre || '').trim(); if (!n) return { ok: false }
  const v = await readValues('BASE CLIENTES SF')
  const H = (v[0] || []).map((x) => String(x || '').trim().toUpperCase())
  const iC = _idxCliente(H)
  const exists = v.slice(1).some((r) => up(r[iC]) === up(n))
  // Se agrega en CLIENTE y en CLIENTE ARMONIZADO (mismo nombre); PAIS vacío
  if (!exists) await appendValues('BASE CLIENTES SF', [[n, n, '']])
  return { ok: true, added: exists ? 0 : 1 }
}

/* ===== Estado del modelo (clave/valor JSON) por empresa =====
   Guarda en la hoja Cap_Estado todo lo que antes vivía solo en localStorage:
   % por cliente-categoría, inventario, precios por temporada, comisiones,
   gastos administrativos, costos logísticos, cash flow, crecimientos, etc.
   Cada fila = EMPRESA · CLAVE (nombre del store) · VALOR (JSON en texto). */
export async function gLoadEstado(empresa) {
  await ensureTab('Cap_Estado', ['EMPRESA', 'CLAVE', 'VALOR'])
  const v = await readValues('Cap_Estado')
  const map = {}
  for (let r = 1; r < v.length; r++) { const row = v[r]; if (up(row[0]) !== up(empresa)) continue; const clave = String(row[1] || ''); if (clave) map[clave] = String(row[2] == null ? '' : row[2]) }
  return { ok: true, map }
}
export async function gSaveEstado(empresa, clave, valor) {
  await ensureTab('Cap_Estado', ['EMPRESA', 'CLAVE', 'VALOR'])
  const valStr = typeof valor === 'string' ? valor : JSON.stringify(valor)
  const v = await readValues('Cap_Estado')
  let row = -1
  for (let r = 1; r < v.length; r++) { if (up(v[r][0]) === up(empresa) && String(v[r][1] || '') === String(clave)) { row = r; break } }
  if (row >= 0) await writeValues('Cap_Estado', 'A' + (row + 1) + ':C' + (row + 1), [[empresa, clave, valStr]], true)
  else await appendValues('Cap_Estado', [[empresa, clave, valStr]], true)
  return { ok: true }
}

/* Bitácora y Colaboradores usan gSaveRows con esquema genérico (ya definido en la app). */
async function registrar(usuario, rol, tab, empresa, detalle) {
  try {
    await ensureTab('Registro', ['Fecha/Hora', 'Usuario', 'Empresa', 'Rol', 'Pestaña', 'Detalle'])
    await appendValues('Registro', [[new Date().toISOString(), usuario || '', empresa || '', rol, tab, detalle]])
  } catch { }
}
