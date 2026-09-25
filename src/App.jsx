import { useState, useEffect, useRef } from 'react'
import './App.css'
// Rastreador global de "cambios sin guardar": lo marcan las celdas de captura y lo limpia Guardar.
const ABP_DIRTY = { on: false }
// Barra global: botón "Actualizar" (trae lo último del Sheet) + aviso si cierras con cambios sin guardar.
export function SyncBar() {
  const refrescar = () => {
    if (ABP_DIRTY.on && !window.confirm('Tienes cambios SIN GUARDAR. Si actualizas ahora se perderán. ¿Quieres actualizar de todas formas?')) return
    ABP_DIRTY.on = false
    try { sessionStorage.setItem('abp_nav_ts', String(Date.now())) } catch { } // "Actualizar" es acción explícita: te deja donde estás, no te saca al menú
    window.location.reload()
  }
  useEffect(() => {
    const esCaptura = (t) => { try { return !!(t && ((t.closest && (t.closest('td.cell') || t.closest('table'))) || (t.classList && (t.classList.contains('fillin') || t.classList.contains('cell'))))) } catch { return false } }
    const mark = (e) => { if (esCaptura(e.target)) ABP_DIRTY.on = true }
    const clear = (e) => { const b = e.target && e.target.closest && e.target.closest('button'); if (b && /guardar/i.test(b.textContent || '')) ABP_DIRTY.on = false }
    const before = (e) => { if (ABP_DIRTY.on) { e.preventDefault(); e.returnValue = '' } }
    document.addEventListener('input', mark, true)
    document.addEventListener('change', mark, true)
    document.addEventListener('click', clear, true)
    window.addEventListener('beforeunload', before)
    return () => { document.removeEventListener('input', mark, true); document.removeEventListener('change', mark, true); document.removeEventListener('click', clear, true); window.removeEventListener('beforeunload', before) }
  }, [])
  return <button onClick={refrescar} title="Trae los últimos cambios que guardó tu equipo (recarga la página)" style={{ position: 'fixed', left: 18, bottom: 20, zIndex: 9998, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 22, padding: '9px 15px', fontWeight: 700, fontSize: 13, color: '#0e7490', boxShadow: '0 4px 14px rgba(0,0,0,.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>🔄 Actualizar</button>
}

/* Tooltip propio: aparece AL INSTANTE (sin la demora del navegador) y con estilo uniforme.
   Funciona sobre cualquier elemento que ya tenga `title`: al pasar el mouse lo muestra en una cajita
   y quita el title nativo (para que no salga duplicado ni con retardo); al salir lo restaura. */
export function TipLayer() {
  useEffect(() => {
    const box = document.createElement('div')
    Object.assign(box.style, { position: 'fixed', zIndex: '100000', maxWidth: '380px', background: '#1f2d3d', color: '#fff', padding: '9px 12px', borderRadius: '9px', fontSize: '12.5px', lineHeight: '1.5', boxShadow: '0 8px 24px rgba(0,0,0,.28)', pointerEvents: 'none', whiteSpace: 'pre-line', display: 'none' })
    document.body.appendChild(box)
    let cur = null
    const tipOf = (el) => el && el.getAttribute ? (el.getAttribute('title') || el._tip) : null
    const findTip = (t) => { let el = t; for (let i = 0; i < 5 && el; i++) { if (tipOf(el)) return el; el = el.parentElement } return null }
    const place = (x, y) => { const pad = 15; const r = box.getBoundingClientRect(); let bx = x + pad, by = y + pad; if (bx + r.width > window.innerWidth) bx = x - r.width - pad; if (by + r.height > window.innerHeight) by = y - r.height - pad; box.style.left = Math.max(4, bx) + 'px'; box.style.top = Math.max(4, by) + 'px' }
    const hide = () => { if (cur) { if (cur._tip) { cur.setAttribute('title', cur._tip); cur._tip = null } cur = null } box.style.display = 'none' }
    const over = (e) => { const el = findTip(e.target); if (!el) { hide(); return } if (el !== cur) { hide(); cur = el; const t = el.getAttribute('title'); if (t) { el._tip = t; el.removeAttribute('title') } box.textContent = el._tip || ''; box.style.display = 'block'; place(e.clientX, e.clientY) } }
    const move = (e) => { if (cur) place(e.clientX, e.clientY) }
    const out = (e) => { if (cur && (!e.relatedTarget || !cur.contains(e.relatedTarget))) hide() }
    document.addEventListener('mouseover', over, true)
    document.addEventListener('mousemove', move, true)
    document.addEventListener('mouseout', out, true)
    return () => { document.removeEventListener('mouseover', over, true); document.removeEventListener('mousemove', move, true); document.removeEventListener('mouseout', out, true); box.remove() }
  }, [])
  return null
}
import { initAuth, signIn, isSignedIn, getEmail, getName, onAuth, gReadTab, gLoadConfig, gSaveConfig, gDeleteEmpresa, gLoadAvatars, gSaveAvatar, gSaveRows, gSaveHistorico, gHistorico, gLoadAdmins, gSaveAdmins, gLoadMarcas, gSaveMarcas, gPlan2027, gViajesRef, gMkRef, gLoadEstado, gSaveEstado, gLoadClientes, gAddCliente } from './google'

/* ===== Estado del modelo por empresa: espejo Google Sheet ⇄ localStorage =====
   El Sheet (hoja Cap_Estado) es la fuente de verdad; localStorage es solo un
   caché síncrono para que los cálculos (realAupAuc, etc.) sigan siendo instantáneos.
   Al entrar a una empresa se baja el estado del Sheet a localStorage; al guardar
   cualquier bloque se escribe a los dos. */
const ESTADO_KEYS = ['catpct', 'catpart', 'usarcat', 'ventas_growth', 'ventas_manual', 'addcli', 'interno', 'temp', 'precios', 'comis', 'gadmin', 'gadmin_cfg', 'logcost', 'cf', 'calendario', 'aprob']
async function hydrateEstado(empresa) {
  try {
    const j = await gLoadEstado(empresa)
    if (j && j.map) ESTADO_KEYS.forEach((k) => { const v = j.map[k]; if (v != null && v !== '') { try { localStorage.setItem(`${k}_${empresa}`, v) } catch { } } })
  } catch { }
}
function saveEstado(empresa, clave, valStr) {
  const s = typeof valStr === 'string' ? valStr : JSON.stringify(valStr)
  try { localStorage.setItem(`${clave}_${empresa}`, s) } catch { }
  Promise.resolve().then(() => gSaveEstado(empresa, clave, s)).catch(() => { })
}

/* ===== CONFIG ===== */

const MESES = ['ene-28','feb-28','mar-28','abr-28','may-28','jun-28','jul-28','ago-28','sep-28','oct-28','nov-28','dic-28']

const DEFAULT_SBUS = {
  'SBU 1': ['ALTRA','FJALLRAVEN','HOKA','INJINJI','NORDA'],
  'SBU 2': ['ARIAT','BIRKENSTOCK','BLUNDSTONE','ECCO','FLOWER MOUNTAIN','UGG'],
  'SBU 3': ['COTOPAXI','FITFLOP','FOAMERS','GOORIN BROS','KEEN','MAMMUT'],
}
const ALL_MARCAS = Object.values(DEFAULT_SBUS).flat()
const SBU_NAMES = ['SBU 1', 'SBU 2', 'SBU 3']
/* Empresas del grupo (el nombre debe coincidir con la columna EMPRESA del Histórico). */
const SEED_EMPRESAS = ['TUMAR', 'ENERGY BRANDS', 'TAHO']

/* Colores por SBU y por marca (identidad visual dinámica) */
const SBU_COLORS = { 'SBU 1': '#0e7490', 'SBU 2': '#7c3aed', 'SBU 3': '#b45309', 'RETAIL': '#be123c', 'GERENCIA': '#1f2d3d', 'SIN ASIGNAR': '#64748b' }
const sbuColor = (s) => SBU_COLORS[String(s || '').toUpperCase()] || '#0e7490'
// Paleta sin verde ni amarillo, tonos bien separados (para marcas no fijadas)
const MARCA_PALETTE = ['#2563eb', '#dc2626', '#9333ea', '#ea580c', '#db2777', '#b45309', '#4f46e5', '#e11d48', '#7c3aed', '#c026d3', '#475569', '#be123c']
// Color fijo por marca conocida: garantiza que cada marca de una SBU se vea distinta
const MARCA_FIJO = { ALTRA: '#7c3aed', FJALLRAVEN: '#db2777', HOKA: '#2563eb', NORDA: '#ea580c', ARIAT: '#dc2626', BIRKENSTOCK: '#c026d3', BLUNDSTONE: '#4f46e5', ECCO: '#475569', UGG: '#b45309' }
const marcaColor = (marca) => { const u = String(marca || '').trim().toUpperCase(); if (MARCA_FIJO[u]) return MARCA_FIJO[u]; let h = 0; for (let i = 0; i < u.length; i++) h = (h * 31 + u.charCodeAt(i)) >>> 0; return MARCA_PALETTE[h % MARCA_PALETTE.length] }

/* Desglose de Marketing */
const MK_GROUPS = [
  { g: 'ATL', items: [{ c: '301', n: 'OOH' }, { c: '302', n: 'DOOH' }] },
  { g: 'BTL', items: [{ c: '303', n: 'FEE AGENCIA' }, { c: '304', n: 'EVENTOS / INAUGURACIONES' }, { c: '305', n: 'CARRERAS' }, { c: '306', n: 'OTROS' }] },
  { g: 'TRADE', items: [{ c: '', n: 'TRADE RETAIL' }, { c: '307', n: 'POP' }, { c: '308', n: 'VITRINAS / ESPACIOS BRANDEADOS' }, { c: '309', n: 'ACTIVACIONES EN TIENDA' }, { c: '310', n: 'AGENCIA DE RE-BRANDING' }, { c: '311', n: 'GIFT WITH PURCHASE' }] },
  { g: 'DIGITAL', items: [{ c: '320', n: 'FEE AGENCIA' }, { c: '312', n: 'PAID SOCIAL MEDIA - AWARENESS' }, { c: '313', n: 'PAID SOCIAL MEDIA - PERFORMANCE' }, { c: '314', n: 'E-COMMERCE MARCAS' }, { c: '315', n: 'E-COMMERCE & AGENCIA MUH' }] },
  { g: 'PR', items: [{ c: '330', n: 'FEE AGENCIA' }, { c: '316', n: 'PAGO A INFLUENCERS' }, { c: '317', n: 'CANJE INFLUENCERS' }] },
  { g: 'PRE VENTAS / SALES MEETING', items: [{ c: '340', n: 'ASIGNACION DE PRODUCTO' }, { c: '341', n: 'EVENTOS / REUNIONES' }, { c: '342', n: 'OTROS' }] },
]

/* Desglose de Viajes (igual para todos los roles) */
const VIAJES_GROUPS = [{ g: 'VIAJES', items: [
  { c: '201', n: 'VIAJES A HEAD QUARTERS' }, { c: '202', n: 'VIAJES A MERCADO' }, { c: '203', n: 'EQUIPAJE' },
  { c: '204', n: 'HOSPEDAJE' }, { c: '205', n: 'COMIDAS' }, { c: '206', n: 'TRASLADOS' }, { c: '207', n: 'PENALTY' },
  { c: '208', n: 'ALQUILER AUTO' }, { c: '209', n: 'COMIDAS C/CLIENTES' }, { c: '210', n: 'COMBUSTIBLE' },
  { c: '211', n: 'SEGURO DE VIAJE' }, { c: '212', n: 'OTROS' },
] }]

const VJ = { k: 'VIAJES', u: '$', detalle: VIAJES_GROUPS, extrasKey: 'viajes_extras' }

const ROLES = [
  { id: 'ventas',    label: 'Ventas',    icon: '📈', color: '#0891b2', tab: 'Cap_Ventas',    rubros: [{ k: 'UNIDADES', disp: 'UNIDADES Y VENTA NETA', u: 'ud', proyeccion: true }, VJ] },
  { id: 'producto',  label: 'Producto',  icon: '📦', color: '#017e84', tab: 'Cap_Producto',  rubros: [{ k: 'INVENTARIO · PRECIOS · MARGEN', u: '$', productoall: true }, VJ] },
  { id: 'marketing', label: 'Marketing', icon: '📣', color: '#d9822b', tab: 'Cap_Marketing', rubros: [{ k: 'MARKETING', u: '$', detalle: MK_GROUPS, extrasKey: 'mk_extras' }, VJ] },
  { id: 'logistica', label: 'Logística', icon: '🚚', color: '#3b6ea5', tab: 'Cap_Logistica', rubros: [{ k: 'LOGISTICA', u: '$' }] },
  { id: 'finanzas',  label: 'Finanzas',  icon: '💰', color: '#2e7d32', tab: 'Cap_Finanzas',  rubros: [{ k: 'CASH FLOW', u: '$', cash: true }, VJ, { k: 'GASTOS ADMIN', gadmin: true }, { k: 'APROBACIONES', aprob: true }] },
  { id: 'director',  label: 'Director',  icon: '🧑‍💼', color: '#0d9488', tab: 'Cap_Director',  rubros: [{ k: 'CASH FLOW', u: '$', cash: true }, VJ, { k: 'COMISIONES', comis: true }, { k: 'CATEGORIAS', cat: true }] },
]
const ACCESO_OPCIONES = ['Ventas', 'Producto', 'Marketing', 'Logística', 'Finanzas', 'Director', 'Histórico', 'Combinaciones', 'Bitácora']

/* Cash Flow: proyección 2028 completa (12 meses). Arranca en enero con el saldo en banco al cierre de dic-27. */
const CF_M2028 = ['ene-28', 'feb-28', 'mar-28', 'abr-28', 'may-28', 'jun-28', 'jul-28', 'ago-28', 'sep-28', 'oct-28', 'nov-28', 'dic-28']
const CF_MESES = [...CF_M2028]
const CF_GROUPS = [
  { g: 'PSI · Purchases-Sales-Inventory', items: ['Inventario Inicial', 'Compras (Fecha disponible)', 'Ventas Netas', 'Inventario Final'] },
  { g: 'CASH FLOW', items: ['Cash Inicial', 'Cash In (Cobros)', 'Cash Out (Pagos)', 'Costos Operativos', 'Cash Final'] },
]
const CF_TERMINOS = ['Cash', '30 días', '60 días', '90 días', '120 días', '150 días', '180 días', 'Intercompañía']
/* Meses de desfase para la escalera de cobros según el término de pago */
const CF_PLAZO_MESES = { 'Cash': 0, '30 días': 1, '60 días': 2, '90 días': 3, '120 días': 4, '150 días': 5, '180 días': 6, 'Intercompañía': 0 }
/* Costos Operativos = suma de estos 4 sub-rubros (el usuario los llena; el total es calculado) */
const CF_COSTOS_PARENT = 'Costos Operativos'
const CF_COSTOS = ['Gastos administrativos', 'Logística', 'Viajes', 'Marketing', 'Comisiones']

/* Referencia de peso por categoría (unidades históricas) para decidir el % 2028.
   DEMO: solo ALTRA (leído de FW26 y SS26). Otras marcas se cargan luego por importación. */
const REF_CAT = {
  ALTRA: {
    'NJ IMPACT': { ROAD: { fw: 64, ss: 45 }, TRAIL: { fw: 36, ss: 55 } },
    'SERVIBERICA': { ROAD: { fw: 64, ss: 71 }, TRAIL: { fw: 36, ss: 29 } },
    'SINERGY': { ROAD: { fw: 84 }, TRAIL: { fw: 16 } },
    'TAHO': { ROAD: { fw: 49 }, TRAIL: { fw: 51 } },
  },
}
function refCat(marca, cli, cat) {
  const tbl = REF_CAT[upper(marca)]; if (!tbl) return null
  const key = Object.keys(tbl).find((k) => upper(cli).indexOf(k) >= 0); if (!key) return null
  return tbl[key][upper(cat)] || null
}

/* Gastos administrativos: centros de costo por defecto (código sub-rubro · nombre). Compartidos por todas las SBU. */
const DEFAULT_GADMIN = [
  ['101', 'SALARIO'], ['103', 'PERFORMANCE BONO'], ['104', 'CARGA SOCIAL Y PASIVO LABORAL'], ['105', 'CAPACITACIONES'], ['106', 'SELECCIÓN DE PERSONAL'], ['107', 'ATENCIONES / CLIENTES / PROVEEDORES'], ['108', 'MEMBRESÍA TARJETA DE CRÉDITO'], ['109', 'PLAN CELULAR'], ['110', 'BENEFICIOS - SEGURO DE SALUD'], ['111', 'SEGURIDAD'], ['112', 'BENEFICIO - GIFT CARD ANNUAL'], ['114', 'GASTOS DE OFICINA'], ['115', 'ALQUILER OFICINA'], ['116', 'AGUA / LUZ'], ['117', 'INTERNET'], ['118', 'TELÉFONO OFICINA'], ['119', 'CARRIER / MENSAJERÍA'], ['120', 'LIMPIEZA'], ['121', 'REPARACIONES Y MANTENIMIENTOS'], ['122', 'CAFETERÍA - INSUMOS'], ['123', 'ACARREO / TRANSFERENCIA DE INVENTARIO'], ['124', 'SEGUROS'], ['125', 'CONTABLE - MICROSOFT 365 / LICENCIAS ADOBE'], ['126', 'SALESFORCE'], ['127', 'SISTEMA DE FACTURACIÓN ELECTRÓNICA'], ['128', 'ASESORÍA LEGAL'], ['129', 'ASESORÍA CONTABLE'], ['130', 'ASESORÍA FISCALES'], ['131', 'SERVICIOS DE RRHH'], ['132', 'SERVICIOS DE IT'], ['133', 'HONORARIOS PROFESIONALES'], ['134', 'OTROS'], ['135', 'CARGOS FINANCIEROS'],
].map(([cod, sub]) => ({ cod, sub }))

/* Comisiones: marcas con comisión corporativa por compra (XFD) */
const CORP_MARCAS = ['HOKA', 'UGG']
const esCorpMarca = (m) => CORP_MARCAS.includes(upper(m))
/* Cálculo de comisiones por marca (lo llena el Director; venta externa viene de Comercial, interna de Retail). */
function comisionCalc(marca, comisData, ventaExtMes) {
  const g = (k) => num(comisData[k])
  const pagoExt = MESES.map((_, m) => ventaExtMes[m] * g(`PCTEXT|${marca}|${m}`) / 100)
  const ventaInt = MESES.map(() => 0) // intercompañía (Retail): pendiente
  const pagoInt = MESES.map((_, m) => ventaInt[m] * g(`PCTINT|${marca}|${m}`) / 100)
  const total = MESES.map((_, m) => pagoExt[m] + pagoInt[m])
  return { pagoExt, ventaInt, pagoInt, total }
}
// Comisión CORPORATIVA (solo HOKA/UGG): $/ud sobre las compras. La captura Finanzas y es un PAGO (Cash Out).
function comisionCorpMes(marca, cfData, comprasUdMes) { return MESES.map((_, m) => esCorpMarca(marca) ? comprasUdMes[m] * num(cfData[`CORP|${marca}`]) : 0) }

/* Temporadas: inventario inicial (stock viejo) vs compras 2028 (nuevo, porque el presupuesto es 2028) */
const INV_SEASONS = ['SS25', 'FW25', 'SS26', 'FW26', 'SS27', 'FW27']
const BUY_SEASONS = ['SS28', 'FW28', 'SS29']
const SEASONS = [...INV_SEASONS, ...BUY_SEASONS]

/* ===== helpers ===== */
const num = (v) => { const n = parseFloat(String(v).replace(/[^0-9.-]/g, '')); return isNaN(n) ? 0 : n }
const fmt = (v) => (v ? Math.round(v).toLocaleString('en-US') : '')
const upper = (s) => String(s == null ? '' : s).trim().toUpperCase()
const mesIdx = (v) => { const d = new Date(v); return isNaN(d.getTime()) ? -1 : d.getUTCMonth() }
const M$ = <span className="moneytag" title="Valores en dinero ($)">$</span> // icono discreto de dinero
const UD = <span className="unittag" title="Valores en unidades (ud)"># </span> // icono discreto de unidades
// Marcador discreto (ⓘ gris) para campos CONSOLIDADOS (suma de partes): al pasar el mouse muestra de qué se compone
const Q = (t) => <span title={t} style={{ cursor: 'help', marginLeft: 5, fontSize: 10.5, fontWeight: 700, color: '#94a3b8', border: '1px solid #cbd5e1', borderRadius: '50%', display: 'inline-block', width: 15, height: 15, lineHeight: '14px', textAlign: 'center', verticalAlign: 'middle' }}>i</span>
// 🪞 para vistas ESPEJO (solo lectura, el dato se llena/edita en otro lado): tooltip dice de dónde viene
const ESP = (t) => <span className="unit" title={t} style={{ cursor: 'help', marginLeft: 6, fontSize: 12 }}>🪞</span>

function effSBUS(empresa, combos) {
  const c = combos[empresa]
  const excl = new Set((c && c['NO VENDE']) || [])
  if (!c || !SBU_NAMES.some((s) => (c[s] || []).length)) {
    if (!excl.size) return DEFAULT_SBUS
    const out = {}
    Object.entries(DEFAULT_SBUS).forEach(([s, ms]) => { const f = ms.filter((m) => !excl.has(m)); if (f.length) out[s] = f })
    return out
  }
  const out = {}, asignadas = new Set()
  SBU_NAMES.forEach((s) => { const f = (c[s] || []).filter((m) => !excl.has(m)); if (f.length) { out[s] = f; f.forEach((m) => asignadas.add(m)) } })
  const rest = ALL_MARCAS.filter((m) => !asignadas.has(m) && !excl.has(m))
  if (rest.length) out['Sin asignar'] = rest
  return out
}
const marcasDe = (sbus) => Object.entries(sbus).flatMap(([sbu, ms]) => ms.map((m) => ({ sbu, marca: m })))
const sbuDe = (sbus, marca) => marcasDe(sbus).find((x) => x.marca === marca)?.sbu || ''

/* Venta/costo y AUP/AUC promedio de una marca, con la MEZCLA REAL por categoría:
   unidades por categoría = Σ_cliente (unidades del cliente × % de esa categoría para ese cliente).
   El % por cliente lo captura el Director (localStorage catpct_). AUP/AUC vienen por categoría de Cap_Producto. */
function realAupAuc(empresa, marca, ventasRows, prodRows, catNames) {
  const cats = (catNames && catNames.length) ? catNames : ['General']
  let catPct = {}; try { catPct = JSON.parse(localStorage.getItem(`catpct_${empresa}`) || '{}') } catch { }
  const aupCat = {}, aucCat = {}
  prodRows.forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(marca)) return; const rub = String(r[1] || ''); if (rub.indexOf('AUP · ') === 0) aupCat[rub.slice(6)] = MESES.map((_, j) => num(r[4 + j])); else if (rub.indexOf('AUC · ') === 0) aucCat[rub.slice(6)] = MESES.map((_, j) => num(r[4 + j])); else if (upper(rub) === 'AUC') { const base = MESES.map((_, j) => num(r[4 + j])); cats.forEach((c) => { if (!aucCat[c]) aucCat[c] = base }) } })
  const byClient = {}
  ventasRows.forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(marca)) return; const cli = String(r[1] || '').trim(); if (!cli || cli.toUpperCase().startsWith('VIAJES')) return; const arr = byClient[cli] || (byClient[cli] = Array(12).fill(0)); for (let m = 0; m < 12; m++) arr[m] += num(r[4 + m]) })
  const unitsCat = {}; cats.forEach((c) => unitsCat[c] = Array(12).fill(0)); const totalUnits = Array(12).fill(0)
  Object.keys(byClient).forEach((cli) => { const pcts = cats.map((c) => num(catPct[`${cli}|${marca}|${c}`])); const den = pcts.reduce((a, b) => a + b, 0); for (let m = 0; m < 12; m++) { const u = byClient[cli][m]; totalUnits[m] += u; cats.forEach((c, i) => { const w = den > 0 ? pcts[i] / den : (cats.length ? 1 / cats.length : 0); unitsCat[c][m] += u * w }) } })
  const ventaMes = MESES.map((_, m) => cats.reduce((a, c) => a + unitsCat[c][m] * ((aupCat[c] || [])[m] || 0), 0))
  const costoMes = MESES.map((_, m) => cats.reduce((a, c) => a + unitsCat[c][m] * ((aucCat[c] || [])[m] || 0), 0))
  const aupW = MESES.map((_, m) => totalUnits[m] ? ventaMes[m] / totalUnits[m] : 0)
  const aucW = MESES.map((_, m) => totalUnits[m] ? costoMes[m] / totalUnits[m] : 0)
  return { aupW, aucW, totalUnits, ventaMes, costoMes, unitsCat }
}

/* ===== APP ===== */
export default function App() {
  const [usuario, setUsuario] = useState('')
  const [empresas, setEmpresas] = useState(SEED_EMPRESAS)
  const [empresa, setEmpresa] = useState(() => { try { return localStorage.getItem('abp_nav_emp') || 'ENERGY BRANDS' } catch { return 'ENERGY BRANDS' } })
  const [combos, setCombos] = useState({})
  const [roleId, setRoleId] = useState(() => { try { const v = localStorage.getItem('abp_nav_role'); const ts = Number(localStorage.getItem('abp_nav_ts') || 0); return (v && Date.now() - ts < 8 * 60 * 60 * 1000) ? v : null } catch { return null } }) // tras 8 horas de inactividad, vuelve al menú
  const firstNav = useRef(true) // evita borrar la ubicación guardada en el primer render
  const [connError, setConnError] = useState(false)
  const [authed, setAuthed] = useState(isSignedIn())
  const [estadoReady, setEstadoReady] = useState(false)
  const [avatar, setAvatar] = useState(() => { try { return localStorage.getItem('abp_avatar') || '' } catch { return '' } })
  useEffect(() => { try { document.documentElement.style.setProperty('--avatar', avatar ? '"' + avatar + ' "' : '') } catch { } }, [avatar])
  const elegirAvatar = (a) => { setAvatar(a); try { localStorage.setItem('abp_avatar', a) } catch { } try { const em = getEmail(); if (em) gSaveAvatar(em, a, getName() || '').catch(() => { }) } catch { } }
  // Recuerda dónde estás (sección + empresa) para que "Actualizar" recargue sin sacarte al menú.
  // En el PRIMER render no tocamos nada (así no se borra la ubicación guardada mientras carga la sesión).
  useEffect(() => {
    if (firstNav.current) { firstNav.current = false; return }
    try { if (roleId) { localStorage.setItem('abp_nav_role', roleId); localStorage.setItem('abp_nav_ts', String(Date.now())) } else localStorage.removeItem('abp_nav_role') } catch { }
  }, [roleId])
  // Mantiene "viva" la ubicación mientras trabajas (refresca la marca de tiempo con la actividad, máx. cada 20 s).
  useEffect(() => {
    if (!roleId) return
    let last = 0
    const bump = () => { const n = Date.now(); if (n - last > 20000) { last = n; try { localStorage.setItem('abp_nav_ts', String(n)) } catch { } } }
    window.addEventListener('mousedown', bump, true); window.addEventListener('keydown', bump, true)
    return () => { window.removeEventListener('mousedown', bump, true); window.removeEventListener('keydown', bump, true) }
  }, [roleId])
  useEffect(() => { try { localStorage.setItem('abp_nav_emp', empresa) } catch { } }, [empresa])

  useEffect(() => {
    initAuth()
    const off = onAuth(({ name, email }) => { setAuthed(true); if (name || email) setUsuario((u) => u || name || email) })
    return off
  }, [])

  // Baja el estado del modelo (Cap_Estado) del Sheet a localStorage antes de mostrar los tableros
  useEffect(() => {
    if (!authed || !empresa) return
    setEstadoReady(false)
    let cancel = false
    hydrateEstado(empresa).then(() => { if (!cancel) setEstadoReady(true) })
    return () => { cancel = true }
  }, [authed, empresa])


  useEffect(() => {
    if (!authed) return
    let cancel = false
    const aplicar = (j) => {
      const merged = [...SEED_EMPRESAS, ...((j.empresas) || [])].filter((v, i, a) => v && a.indexOf(v) === i)
      setEmpresas(merged)
      setEmpresa((e) => merged.includes(e) ? e : (merged.includes('ENERGY BRANDS') ? 'ENERGY BRANDS' : merged[0]))
      if (j.combos) setCombos(j.combos)
    }
    async function load(attempt) {
      try {
        const j = await gLoadConfig()
        if (cancel) return
        aplicar(j)
        setConnError(false)
        try { localStorage.setItem('abp_cfg', JSON.stringify({ empresas: j.empresas, combos: j.combos })) } catch {}
      } catch {
        if (cancel) return
        if (attempt < 3) { setTimeout(() => load(attempt + 1), 1200 * (attempt + 1)); return }
        try { const c = JSON.parse(localStorage.getItem('abp_cfg') || 'null'); if (c && c.combos) aplicar(c) } catch {}
        setConnError(true)
      }
    }
    load(0)
    return () => { cancel = true }
  }, [authed])

  const [acceso, setAcceso] = useState(null) // null = acceso total (no está en Colaboradores)
  const [veTodas, setVeTodas] = useState(true) // ¿la persona puede cambiar de empresa? (por defecto sí)
  useEffect(() => {
    if (!authed) return
    let cancel = false
    ;(async () => {
      try {
        const j = await gReadTab('Cap_Colaboradores')
        const em = (getEmail() || '').trim().toLowerCase()
        if (cancel) return
        if (!em || !j.values) { setAcceso(null); setVeTodas(true); return }
        const set = new Set(); let found = false, defEmp = '', todas = false
        j.values.slice(1).forEach((row) => {
          if (String(row[3] || '').trim().toLowerCase() !== em) return
          found = true
          if (!defEmp) defEmp = String(row[0] || '').trim()
          if (upper(row[5]) === 'TODAS') todas = true
          String(row[4] || '').split(';').filter(Boolean).forEach((a) => set.add(a))
        })
        setAcceso(found ? [...set] : null)
        setVeTodas(found ? todas : true)
        if (found && defEmp) setEmpresa(defEmp)
      } catch { if (!cancel) { setAcceso(null); setVeTodas(true) } }
    })()
    return () => { cancel = true }
  }, [authed])
  const puede = (etiqueta) => !acceso || acceso.includes(etiqueta)
  const [admins, setAdmins] = useState([])
  useEffect(() => { if (!authed) return; (async () => { try { setAdmins(await gLoadAdmins()) } catch { } })() }, [authed])
  const emailLow = (getEmail() || '').trim().toLowerCase()
  const esAdmin = emailLow === 'yalik@energybrandsgroup.com' || admins.includes(emailLow)
  const veTodasEff = veTodas || esAdmin // quién puede cambiar de empresa

  // ENERGY BRANDS: el agrupamiento SBU → marcas se deriva EN VIVO del EBP (misma fuente que los clientes),
  // no de la lista fija ni de Combinaciones. Las demás empresas (TUMAR, TAHO) usan lo importado/configurado.
  const [ebSbus, setEbSbus] = useState(null)
  useEffect(() => {
    if (!authed) return
    let cancel = false
    ;(async () => {
      try {
        const j = await gHistorico()
        if (cancel || !j || !j.values) return
        const map = {}
        j.values.slice(1).forEach((r) => {
          if (upper(r[0]) !== 'ENERGY BRANDS') return
          const sbu = String(r[4] || '').trim(), mar = String(r[5] || '').trim()
          if (!sbu || !mar) return
          ;(map[sbu] = map[sbu] || new Set()).add(mar)
        })
        const out = {}
        Object.keys(map).sort().forEach((s) => { out[s] = [...map[s]].sort((a, b) => a.localeCompare(b)) })
        if (!cancel && Object.keys(out).length) setEbSbus(out)
      } catch { }
    })()
    return () => { cancel = true }
  }, [authed])

  const role = ROLES.find((r) => r.id === roleId)
  // EB: manda el EBP en vivo (3 SBU con sus marcas). Mientras carga, se usan las SBU por defecto
  // (NO la config vieja guardada), para que no parpadee mostrando/ocultando SBU 2 y 3.
  const sbusFor = (emp) => emp === 'ENERGY BRANDS' ? (ebSbus || DEFAULT_SBUS) : effSBUS(emp, combos)
  const sbus = sbusFor(empresa)

  function nuevaEmpresa() {
    const n = window.prompt('Nombre de la nueva empresa:')
    if (!n) return
    const nm = n.trim().toUpperCase()
    if (!empresas.includes(nm)) setEmpresas([...empresas, nm])
    setEmpresa(nm)
  }

  if (!authed) {
    return (
      <>
        <header><div className="brand"><span className="logo">A</span> ABP <span style={{ opacity: .8, fontWeight: 500 }}>· Presupuesto</span></div><span className="yr">2028</span></header>
        <main className="menu">
          <div className="hero">
            <div className="hero-tag">ABP · Annual Business Plan + Cash Flow</div>
            <h1>Bienvenido al plan 2028</h1>
            <p>Inicia sesión con tu cuenta de <b>Energy Brands</b> para capturar tu información. Cada área ve solo lo que le corresponde. 🚀</p>
          </div>
          <button className="btn primary" style={{ fontSize: 15, padding: '12px 22px' }} onClick={() => signIn()}>Iniciar sesión con Google</button>
        </main>
      </>
    )
  }

  if (!avatar) {
    const OPTS = [
      '👩🏻', '👩🏼', '👩🏽', '👩🏾', '👩🏿',
      '👱🏻‍♀️', '👱🏼‍♀️', '👩🏻‍🦱', '👩🏼‍🦱', '👩🏾‍🦱', '👩🏻‍🦰', '👩🏼‍🦳',
      '👨🏻', '👨🏼', '👨🏽', '👨🏾', '👨🏿',
      '👱🏻‍♂️', '👱🏼‍♂️', '👨🏻‍🦱', '👨🏽‍🦱', '👨🏻‍🦲', '👨🏼‍🦲', '👨🏾‍🦲',
      '🧑🏻', '🧑🏽', '🧑🏾', '🧑🏻‍🦲', '🧑🏼‍🦳',
      '🤓', '😎', '🧐',
    ]
    return (
      <>
        <header><div className="brand"><span className="logo">A</span> ABP</div><span className="yr">2028</span></header>
        <main className="menu">
          <div className="hero">
            <div className="hero-tag">ABP · Annual Business Plan + Cash Flow</div>
            <h1>¡Hola, {getName() || 'bienvenido'}! 👋</h1>
            <p>Elige tu avatar. Aparecerá en cada bloque que te toca llenar, para que ubiques rápido lo tuyo. 😊</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', maxWidth: 560, margin: '0 auto' }}>
            {OPTS.map((a) => <button key={a} onClick={() => elegirAvatar(a)} style={{ fontSize: 40, width: 72, height: 72, borderRadius: 16, border: '1px solid var(--line)', background: '#fff', cursor: 'pointer' }} title="Elegir">{a}</button>)}
          </div>
        </main>
      </>
    )
  }

  if (!role && !String(roleId || '').startsWith('sbu:') && roleId !== 'config' && roleId !== 'historico' && roleId !== 'bitacora' && roleId !== 'comercial' && roleId !== 'gerencia' && roleId !== 'holding' && roleId !== 'calendario' && roleId !== 'aprobaciones') {
    return (
      <>
        <header><div className="brand"><span className="logo">A</span> ABP <span style={{ opacity: .8, fontWeight: 500 }}>· Presupuesto</span></div><span className="yr">2028</span></header>
        <main className="menu">
          {connError && <div className="banner" style={{ maxWidth: 860, margin: '0 auto 16px' }}>⚠️ <b>No se pudo conectar con el servidor</b> en este momento, así que puede que veas datos por defecto (todas las marcas) o vacíos. <b>Tus datos NO se perdieron</b> — están guardados en el Google Sheet. Recarga la página en unos segundos.</div>}
          <div className="hero">
            <div className="hero-tag">ABP · Annual Business Plan + Cash Flow</div>
            <h1>Construyamos juntos el plan 2028</h1>
            <p>Cada área aporta su parte —ventas, producto, marketing, logística y dirección— para proyectar el negocio y el <b>flujo de caja</b> del año. Lo que capturas aquí se convierte en el plan de todos. 🚀</p>
          </div>
          <div className="hello">
            <h2><span style={{ fontSize: 26 }}>{avatar}</span> Hola, {getName() || usuario || 'bienvenido'} 👋</h2>
            <p className="sub">Estas son las áreas a las que tienes acceso según tu rol. {getEmail() ? <span className="who" style={{ display: 'inline', marginLeft: 0 }}>Sesión: {getEmail()}</span> : null} · <span style={{ cursor: 'pointer', color: 'var(--odoo)', fontWeight: 600 }} onClick={() => { setAvatar(''); try { localStorage.removeItem('abp_avatar') } catch { } }}>cambiar avatar</span></p>
            <div className="row2">
              <label className="who">Empresa:
                <span className="inline">
                  {veTodasEff
                    ? <select value={empresa} onChange={(e) => setEmpresa(e.target.value)}>{empresas.map((e) => <option key={e}>{e}</option>)}</select>
                    : <span className="empchip" style={{ marginLeft: 0, background: 'var(--odoo)' }}>{empresa}</span>}
                </span>
              </label>
            </div>
          </div>
          <div className="apps">
            {Object.keys(sbus).map((s) => (
              <button key={s} className="app" onClick={() => setRoleId('sbu:' + s)}>
                <span className="appicon" style={{ background: sbuColor(s) }}>🧩</span>
                <span className="applabel">{s}</span>
              </button>
            ))}
            <button className="app" onClick={() => setRoleId('sbu:Retail')}>
              <span className="appicon" style={{ background: sbuColor('Retail') }}>🏬</span>
              <span className="applabel">Retail</span>
            </button>
            {puede('Finanzas') && <button className="app" onClick={() => setRoleId('finanzas')}>
              <span className="appicon" style={{ background: '#2e7d32' }}>💰</span>
              <span className="applabel">Finanzas</span>
            </button>}
            {esAdmin && <button className="app" onClick={() => setRoleId('gerencia')}>
              <span className="appicon" style={{ background: '#1f2d3d' }}>📈</span>
              <span className="applabel">Gerencia</span>
            </button>}
            {esAdmin && empresas.length > 1 && <button className="app" onClick={() => setRoleId('holding')}>
              <span className="appicon" style={{ background: '#7c3aed' }}>🏛️</span>
              <span className="applabel">Total Holding</span>
            </button>}
            <button className="app" onClick={() => setRoleId('calendario')}>
              <span className="appicon" style={{ background: '#0e7490' }}>📅</span>
              <span className="applabel">Calendario</span>
            </button>
            {puede('Bitácora') && <button className="app" onClick={() => setRoleId('bitacora')}>
              <span className="appicon" style={{ background: '#455a64' }}>📝</span>
              <span className="applabel">Bitácora</span>
            </button>}
            {esAdmin && <button className="app" onClick={() => setRoleId('config')}>
              <span className="appicon" style={{ background: '#5b6470' }}>⚙️</span>
              <span className="applabel">Configuración</span>
            </button>}
          </div>
          {acceso && <p className="sub" style={{ marginTop: 14 }}>Ves solo las secciones asignadas a tu usuario. Si falta alguna, pídele a un administrador que ajuste tu acceso en Combinaciones → Colaboradores.</p>}
        </main>
      </>
    )
  }

  const cargandoMain = <main><div className="banner">⏳ Cargando los datos del plan desde Google Sheets…</div></main>

  if (roleId === 'comercial') {
    return (
      <>
        <header><div className="brand"><span className="logo">A</span> ABP</div><span className="yr">2028</span><span className="empchip">{empresa}</span><div className="spacer"></div>
          <span className="rolechip" style={{ background: '#0891b2' }}>🧭 Comercial</span>
          <button className="back" onClick={() => setRoleId(null)}>← Volver al menú</button></header>
        {estadoReady ? <main><ComercialScreen empresa={empresa} sbus={sbus} usuario={usuario} /></main> : cargandoMain}
      </>
    )
  }

  if (String(roleId || '').startsWith('sbu:')) {
    const sbuName = roleId.slice(4)
    return (
      <>
        <header><div className="brand"><span className="logo">A</span> ABP</div><span className="yr">2028</span><span className="empchip">{empresa}</span><div className="spacer"></div>
          <span className="rolechip" style={{ background: sbuColor(sbuName) }}>🧩 {sbuName}</span>
          <button className="back" onClick={() => setRoleId(null)}>← Volver al menú</button></header>
        {estadoReady ? <main><SBUWorkspace key={empresa} sbuName={sbuName} empresa={empresa} usuario={usuario} sbus={sbus} puede={puede} /></main> : cargandoMain}
      </>
    )
  }

  if (roleId === 'gerencia') {
    return (
      <>
        <header><div className="brand"><span className="logo">A</span> ABP</div><span className="yr">2028</span><span className="empchip">{empresa}</span><div className="spacer"></div>
          <span className="rolechip" style={{ background: '#1f2d3d' }}>📈 Gerencia</span>
          <button className="back" onClick={() => setRoleId(null)}>← Volver al menú</button></header>
        {estadoReady ? <main><GerenciaScreen key={empresa} empresa={empresa} sbus={sbus} /></main> : cargandoMain}
      </>
    )
  }

  if (roleId === 'holding') {
    return (
      <>
        <header><div className="brand"><span className="logo">A</span> ABP</div><span className="yr">2028</span><span className="empchip" style={{ background: '#7c3aed' }}>TOTAL HOLDING</span><div className="spacer"></div>
          <span className="rolechip" style={{ background: '#7c3aed' }}>🏛️ Total Holding</span>
          <button className="back" onClick={() => setRoleId(null)}>← Volver al menú</button></header>
        {estadoReady ? <main><HoldingScreen empresas={empresas} sbusFor={sbusFor} /></main> : cargandoMain}
      </>
    )
  }

  if (roleId === 'finanzas') {
    return (
      <>
        <header><div className="brand"><span className="logo">A</span> ABP</div><span className="yr">2028</span><span className="empchip">{empresa}</span><div className="spacer"></div>
          <span className="rolechip" style={{ background: '#2e7d32' }}>💰 Finanzas</span>
          <button className="back" onClick={() => setRoleId(null)}>← Volver al menú</button></header>
        {estadoReady ? <main><FinanzasWorkspace key={empresa} empresa={empresa} usuario={usuario} sbus={sbus} /></main> : cargandoMain}
      </>
    )
  }

  if (roleId === 'config') {
    return (
      <>
        <header><div className="brand"><span className="logo">A</span> ABP</div><span className="yr">2028</span><div className="spacer"></div>
          <span className="rolechip" style={{ background: '#5b6470' }}>⚙️ Configuración</span>
          <button className="back" onClick={() => setRoleId(null)}>← Volver al menú</button></header>
        <main><ConfigScreen empresas={empresas} setEmpresas={setEmpresas} combos={combos} setCombos={setCombos} nuevaEmpresa={nuevaEmpresa} abrirHistorico={() => setRoleId('historico')} ebSbus={ebSbus} /></main>
      </>
    )
  }

  if (roleId === 'historico') {
    return (
      <>
        <header><div className="brand"><span className="logo">A</span> ABP</div><span className="yr">2028</span><div className="spacer"></div>
          <span className="rolechip" style={{ background: '#b0473b' }}>📊 Histórico</span>
          <button className="back" onClick={() => setRoleId(null)}>← Volver al menú</button></header>
        <main><HistoricoScreen /></main>
      </>
    )
  }

  if (roleId === 'bitacora') {
    return (
      <>
        <header><div className="brand"><span className="logo">A</span> ABP</div><span className="yr">2028</span><div className="spacer"></div>
          <span className="rolechip" style={{ background: '#455a64' }}>📝 Bitácora</span>
          <button className="back" onClick={() => setRoleId(null)}>← Volver al menú</button></header>
        <main><BitacoraScreen empresas={empresas} empresaSel={empresa} /></main>
      </>
    )
  }

  if (roleId === 'calendario') {
    return (
      <>
        <header><div className="brand"><span className="logo">A</span> ABP</div><span className="yr">2028</span><span className="empchip">{empresa}</span><div className="spacer"></div>
          <span className="rolechip" style={{ background: '#0e7490' }}>📅 Calendario</span>
          <button className="back" onClick={() => setRoleId(null)}>← Volver al menú</button></header>
        {estadoReady ? <main><CalendarioScreen key={empresa} empresa={empresa} puedeEditar={esAdmin} /></main> : cargandoMain}
      </>
    )
  }

  if (roleId === 'aprobaciones') {
    return (
      <>
        <header><div className="brand"><span className="logo">A</span> ABP</div><span className="yr">2028</span><span className="empchip">{empresa}</span><div className="spacer"></div>
          <span className="rolechip" style={{ background: '#15803d' }}>✅ Aprobaciones</span>
          <button className="back" onClick={() => setRoleId(null)}>← Volver al menú</button></header>
        {estadoReady ? <main><AprobacionesForm key={empresa} empresa={empresa} sbus={sbus} /></main> : cargandoMain}
      </>
    )
  }

  return (
    <>
      <header>
        <div className="brand"><span className="logo">A</span> ABP</div>
        <span className="yr">2028</span>
        <span className="empchip">{empresa}</span>
        <div className="spacer"></div>
        <span className="rolechip" style={{ background: role.color }}>{role.icon} {role.label}</span>
        <button className="back" onClick={() => setRoleId(null)}>← Volver al menú</button>
      </header>
      <main><RoleForm role={role} usuario={usuario} empresa={empresa} sbus={sbus} /></main>
    </>
  )
}

/* ===== RoleForm: pestañas de rubro (simple o detalle) ===== */
function RoleForm({ role, usuario, empresa, sbus, fixedMarca, rubrosOverride }) {
  const esTot = String(fixedMarca || '').startsWith('TOTAL::')
  const rubros = (rubrosOverride || role.rubros).filter((rb) => !rb.gadmin || esTot) // Gastos admin solo en TOTAL SBU
  const [tab, setTab] = useState(0)
  const [data, setData] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  if (!rubros.length) return null
  const idx = Math.min(tab, rubros.length - 1)
  const rb = rubros[idx]
  const common = { role, rubro: rb, usuario, empresa, sbus, data, setData, saving, setSaving, msg, setMsg, fixedMarca }

  return (
    <>
      {rubros.length > 1 && <div className="toolbar" style={{ marginBottom: 12, gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>VER:</span>
        <select value={idx} onChange={(e) => { setTab(Number(e.target.value)); setMsg(null) }} style={{ fontWeight: 700, padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--accent, #0e7490)', color: 'var(--accent, #0e7490)', background: '#fff', minWidth: 200 }}>
          {rubros.map((r, i) => <option key={r.k} value={i}>{r.disp || r.k}</option>)}
        </select>
      </div>}
      {msg && <div className={'note ' + msg.t}>{msg.x}</div>}
      {rb.proyeccion ? <ProjectionForm key={rb.k} role={role} rubro={rb} usuario={usuario} empresa={empresa} sbus={sbus} fixedMarca={fixedMarca} />
        : rb.cash ? <CashFlowForm key={rb.k} role={role} rubro={rb} usuario={usuario} empresa={empresa} sbus={sbus} fixedMarca={fixedMarca} />
        : rb.productoall ? <ProductoTab key={rb.k} empresa={empresa} usuario={usuario} sbus={sbus} fixedMarca={fixedMarca} />
        : rb.preciomargen ? <PreciosMargenForm key={rb.k} empresa={empresa} usuario={usuario} sbus={sbus} fixedMarca={fixedMarca} />
        : rb.temporada ? <TemporadaForm key={rb.k} empresa={empresa} sbus={sbus} fixedMarca={fixedMarca} mode="capture" />
        : rb.invflow ? <TemporadaForm key={rb.k} empresa={empresa} sbus={sbus} fixedMarca={fixedMarca} mode="flow" />
        : rb.comis ? <ComisionesForm key={rb.k} empresa={empresa} sbus={sbus} fixedMarca={fixedMarca} />
        : rb.gadmin ? <GastosAdminForm key={rb.k} empresa={empresa} />
        : rb.aprob ? <AprobacionesForm key={rb.k} empresa={empresa} sbus={sbus} />

        : rb.porCat ? <CatCaptureForm key={rb.k} {...common} />
        : rb.cat ? <CategoriasForm key={rb.k} role={role} usuario={usuario} empresa={empresa} sbus={sbus} fixedMarca={fixedMarca} />
        : rb.detalle ? <DetalleForm key={rb.k} {...common} groups={rb.detalle} extrasKey={rb.extrasKey} />
        : <SimpleForm key={rb.k} {...common} />}
    </>
  )
}

/* ===== SimpleForm: un rubro, grid marca × mes ===== */
function SimpleForm({ role, rubro, usuario, empresa, sbus, data, setData, saving, setSaving, setMsg, fixedMarca }) {
  const useSbus = fixedMarca ? { [sbuDe(sbus, fixedMarca)]: [fixedMarca] } : sbus
  const key = (sbu, marca, mi) => `${rubro.k}|${sbu}|${marca}|${mi}`
  const set = (k, v) => setData((d) => ({ ...d, [k]: v }))
  const marcas = marcasDe(useSbus)
  const [bulkMarca, setBulkMarca] = useState(marcas[0] ? marcas[0].marca : '')
  const [bulkVal, setBulkVal] = useState('')
  function aplicarTodos() {
    const bm = fixedMarca || bulkMarca
    if (!bm) return
    const sbu = sbuDe(sbus, bm)
    setData((d) => { const n = { ...d }; for (let mi = 0; mi < 12; mi++) n[key(sbu, bm, mi)] = bulkVal; return n })
  }

  async function guardar() {
    setSaving(true); setMsg(null)
    const rows = []
    marcas.forEach(({ sbu, marca }) => {
      const meses = MESES.map((_, mi) => num(data[key(sbu, marca, mi)]))
      if (meses.some((v) => v !== 0)) rows.push({ rubro: rubro.k, sbu, marca, meses })
    })
    await postRows(role, usuario, empresa, rows, setMsg)
    setSaving(false)
  }
  function exportar() {
    const aoa = [['EMPRESA', 'RUBRO', 'SBU', 'MARCA', ...MESES]]
    marcas.forEach(({ sbu, marca }) => aoa.push([empresa, rubro.k, sbu, marca, ...MESES.map((_, mi) => num(data[key(sbu, marca, mi)]))]))
    exportXlsx(aoa, `${role.tab}_${rubro.k}.xlsx`)
  }
  function importar(ev) {
    const file = ev.target.files[0]; if (!file) return
    importXlsx(file, (aoa) => {
      const next = { ...data }
      aoa.slice(1).forEach((r) => { const sbu = r[2], marca = r[3]; for (let mi = 0; mi < 12; mi++) { const v = num(r[4 + mi]); if (v) next[key(sbu, marca, mi)] = v } })
      setData(next); setMsg({ t: 'ok', x: 'Datos importados. Revisa y pulsa Guardar.' })
    })
    ev.target.value = ''
  }

  return (
    <>
      <div className="toolbar">
        <div className="spacer"></div>
        <button className="btn" onClick={() => { const aoa = [['EMPRESA', 'RUBRO', 'SBU', 'MARCA', ...MESES]]; marcas.forEach(({ sbu, marca }) => aoa.push([empresa, rubro.k, sbu, marca, ...MESES.map(() => 0)])); exportXlsx(aoa, `Plantilla_${role.tab}_${rubro.k}.xlsx`) }}>📄 Plantilla</button>
        <label className="btnfile">⬆ Importar Excel<input type="file" accept=".xlsx,.xls" onChange={importar} hidden /></label>
        <button className="btn" onClick={exportar}>⬇ Exportar Excel</button>
        <button className="btn primary" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : '💾 Guardar'}</button>
      </div>
      <div className="panel">
        <h3>{role.label} — {rubro.k} <span className="unit">({rubro.u})</span><span className="fill-badge">✏️ para llenar</span></h3>
        <div className="sub">Empresa <b>{empresa}</b>. Captura por marca y mes.</div>
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <label>Aplicar a todos los meses{fixedMarca ? ` — ${fixedMarca}` : ''}</label>
          {!fixedMarca && <select value={bulkMarca} onChange={(e) => setBulkMarca(e.target.value)}>
            {Object.entries(useSbus).map(([s, ms]) => <optgroup key={s} label={s}>{ms.map((m) => <option key={m}>{m}</option>)}</optgroup>)}
          </select>}
          <input value={bulkVal} onChange={(e) => setBulkVal(e.target.value)} inputMode="decimal" placeholder="Valor" style={{ width: 120, background: '#fff', border: '1px solid var(--line)', borderRadius: 6, padding: '7px 10px', font: 'inherit', textAlign: 'center' }} />
          <button className="btn" onClick={aplicarTodos}>Aplicar a los 12 meses</button>
        </div>
        <div className="tablewrap">
          <table>
            <thead><tr><th className="l">Marca</th>{MESES.map((m) => <th key={m}>{m}</th>)}<th>Total</th></tr></thead>
            <tbody>
              {Object.entries(useSbus).map(([sbu, ms]) => (
                <Fragment2 key={sbu}>
                  <tr className="sburow"><td className="l" colSpan={14}>{sbu}</td></tr>
                  {ms.map((marca) => {
                    let tot = 0
                    const celdas = MESES.map((_, mi) => { const k = key(sbu, marca, mi); const v = data[k] ?? ''; tot += num(v); return <td key={mi} className="cell"><input value={v} onChange={(e) => set(k, e.target.value)} inputMode="decimal" /></td> })
                    return <tr key={marca}><td className="l">{marca}</td>{celdas}<td className="tot">{fmt(tot)}</td></tr>
                  })}
                </Fragment2>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

/* ===== CatCaptureForm: captura por CATEGORÍA (las que definió el Director) × mes. Ej. AUP ===== */
function CatCaptureForm({ role, rubro, usuario, empresa, sbus, data, setData, saving, setSaving, setMsg, fixedMarca }) {
  const marcas = marcasDe(sbus)
  const [marca, setMarca] = useState(fixedMarca || (marcas[0] ? marcas[0].marca : ''))
  const [cats, setCats] = useState({})
  const [bulkCat, setBulkCat] = useState('')
  const [bulkVal, setBulkVal] = useState('')
  const key = (mar, cat, mi) => `${rubro.k}|${mar}|${cat}|${mi}`
  const set = (k, v) => setData((d) => ({ ...d, [k]: v }))
  const PFX = `${rubro.k} · `
  useEffect(() => { if (fixedMarca) setMarca(fixedMarca) }, [fixedMarca])

  useEffect(() => {
    (async () => {
      try { const j = await gReadTab('Cap_Categorias'); if (j && j.ok && j.values) { const out = {}; j.values.slice(1).forEach((row) => { if (upper(row[0]) !== upper(empresa)) return; const cat = row[1], mar = row[3], peso = num(row[4]); if (!mar || !cat) return; (out[mar] = out[mar] || []).push({ cat, peso }) }); setCats(out) } } catch { }
      try { const j2 = await gReadTab(role.tab); if (j2 && j2.ok && j2.values) { const next = {}; j2.values.slice(1).forEach((row) => { if (upper(row[0]) !== upper(empresa)) return; const rub = String(row[1] || ''); if (rub.indexOf(PFX) !== 0) return; const cat = rub.slice(PFX.length), mar = row[3]; for (let mi = 0; mi < 12; mi++) { const v = num(row[5 + mi]); if (v) next[key(mar, cat, mi)] = v } }); if (Object.keys(next).length) setData((d) => ({ ...d, ...next })) } } catch { }
    })()
  }, [empresa])

  const catList = cats[marca] || []
  function aplicarTodos() { if (!bulkCat) return; setData((d) => { const n = { ...d }; for (let mi = 0; mi < 12; mi++) n[key(marca, bulkCat, mi)] = bulkVal; return n }) }
  async function guardar() {
    setSaving(true); setMsg(null)
    const rows = []
    marcas.forEach(({ sbu: sb, marca: mar }) => (cats[mar] || []).forEach(({ cat }) => { const meses = MESES.map((_, mi) => num(data[key(mar, cat, mi)])); if (meses.some((v) => v !== 0)) rows.push({ rubro: `${rubro.k} · ${cat}`, sbu: sb, marca: mar, meses }) }))
    await postToTab(role.tab, empresa, usuario, role.label, rows, setMsg)
    setSaving(false)
  }
  function exportar() {
    const aoa = [['EMPRESA', 'RUBRO', 'SBU', 'MARCA', ...MESES]]
    marcas.forEach(({ sbu: sb, marca: mar }) => (cats[mar] || []).forEach(({ cat }) => aoa.push([empresa, `${rubro.k} · ${cat}`, sb, mar, ...MESES.map((_, mi) => num(data[key(mar, cat, mi)]))])))
    exportXlsx(aoa, `${role.tab}_${rubro.k}.xlsx`)
  }

  return (
    <>
      <div className="toolbar">
        {!fixedMarca && <><label>Marca</label>
        <select value={marca} onChange={(e) => setMarca(e.target.value)}>{Object.entries(sbus).map(([s, ms]) => <optgroup key={s} label={s}>{ms.map((m) => <option key={m}>{m}</option>)}</optgroup>)}</select></>}
        <div className="spacer"></div>
        <button className="btn" onClick={exportar}>⬇ Exportar Excel</button>
        <button className="btn primary" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : '💾 Guardar'}</button>
      </div>
      <div className="panel">
        <h3>{role.label} — {rubro.k} por categoría <span className="unit">({rubro.u} · {marca})</span><span className="fill-badge">✏️ para llenar</span></h3>
        <div className="sub">Las categorías y su peso las define el Director. Captura el {rubro.k} por categoría y mes.</div>
        {catList.length === 0 ? <div className="note warn">El Director aún no definió categorías para {marca}. Pídele que las cargue en su pestaña de Categorías.</div> : (<>
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <label>Aplicar a todos los meses</label>
            <select value={bulkCat} onChange={(e) => setBulkCat(e.target.value)}><option value="">— categoría —</option>{catList.map(({ cat }) => <option key={cat}>{cat}</option>)}</select>
            <input value={bulkVal} onChange={(e) => setBulkVal(e.target.value)} inputMode="decimal" placeholder="Valor" style={{ width: 120, background: '#fff', border: '1px solid var(--line)', borderRadius: 6, padding: '7px 10px', font: 'inherit', textAlign: 'center' }} />
            <button className="btn" onClick={aplicarTodos}>Aplicar a los 12 meses</button>
          </div>
          <div className="tablewrap">
            <table>
              <thead><tr><th className="l">Categoría</th><th>Peso %</th>{MESES.map((m) => <th key={m}>{m}</th>)}<th>Prom.</th></tr></thead>
              <tbody>
                {catList.map(({ cat, peso }) => {
                  const vals = MESES.map((_, mi) => num(data[key(marca, cat, mi)]))
                  const nz = vals.filter((v) => v !== 0)
                  const prom = nz.length ? nz.reduce((a, b) => a + b, 0) / nz.length : 0
                  return <tr key={cat}><td className="l">{cat}</td><td>{num(peso).toFixed(1)}%</td>{MESES.map((_, mi) => { const k = key(marca, cat, mi); return <td key={mi} className="cell"><input value={data[k] ?? ''} onChange={(e) => set(k, e.target.value)} inputMode="decimal" /></td> })}<td className="tot">{fmt(prom)}</td></tr>
                })}
              </tbody>
            </table>
          </div>
        </>)}
      </div>
    </>
  )
}

/* ===== DetalleForm: sub-rubros por marca (Marketing y Viajes) ===== */
function DetalleForm({ role, rubro, usuario, empresa, sbus, groups, extrasKey, data, setData, saving, setSaving, setMsg, fixedMarca }) {
  const marcas = marcasDe(sbus)
  const [marca, setMarca] = useState(fixedMarca || marcas[0].marca)
  useEffect(() => { if (fixedMarca) setMarca(fixedMarca) }, [fixedMarca])
  const [extras, setExtras] = useState(() => { try { return JSON.parse(localStorage.getItem(extrasKey) || '[]') } catch { return [] } })
  const isTotal = String(marca).startsWith('TOTAL::')
  const sbu = isTotal ? String(marca).slice(7) : sbuDe(sbus, marca)
  const multi = groups.length > 1

  const extraItems = extras.map((e) => ({ c: '', n: e }))
  const grupos = multi ? [...groups, { g: 'ADICIONALES', items: extraItems }] : [{ g: groups[0].g, items: [...groups[0].items, ...extraItems] }]
  // Venta neta (de Comercial) para saber cuánto pesa este rubro (Marketing/Viajes) sobre la venta
  const [vd, setVd] = useState({ ventas: [], producto: [], cats: {} })
  useEffect(() => { (async () => { const g = async (t) => { try { const j = await gReadTab(t); return j.ok && j.values ? j.values.slice(1) : [] } catch { return [] } }; const [ventas, producto, cap] = await Promise.all([g('Cap_Ventas'), g('Cap_Producto'), g('Cap_Categorias')]); const cats = {}; cap.forEach((r) => { if (upper(r[0]) !== upper(empresa)) return; const c = r[1], mar = r[3], peso = num(r[4]); if (!mar || !c) return; (cats[mar] = cats[mar] || []).push({ cat: c, peso }) }); setVd({ ventas, producto, cats }) })() }, [empresa])
  const ventaNetaMesG = (mca) => realAupAuc(empresa, mca, vd.ventas, vd.producto, (vd.cats[mca] || []).map((c) => c.cat)).ventaMes
  const ventaMesT = (mi) => isTotal ? sbuMarcas.reduce((a, m) => a + ventaNetaMesG(m)[mi], 0) : ventaNetaMesG(marca)[mi]

  const key = (mca, id, mi) => `${rubro.k}|${mca}|${id}|${mi}`
  const idDe = (g, it) => `${g}|${it.c}|${it.n}`
  const set = (k, v) => setData((d) => ({ ...d, [k]: v }))
  const val = (mca, id, mi) => num(data[key(mca, id, mi)])
  const sbuMarcas = sbus[sbu] || []
  const valSbu = (id, mi) => sbuMarcas.reduce((s, m) => s + val(m, id, mi), 0)
  const cell = (id, mi) => (isTotal ? valSbu(id, mi) : val(marca, id, mi))
  const grpMes = (gr, mi) => gr.items.reduce((s, it) => s + cell(idDe(gr.g, it), mi), 0)
  const grpTot = (gr) => MESES.reduce((a, _, mi) => a + grpMes(gr, mi), 0)
  const totMes = (mi) => grupos.reduce((s, gr) => s + grpMes(gr, mi), 0)
  const totalGeneral = MESES.reduce((a, _, mi) => a + totMes(mi), 0)

  function agregarRubro() {
    const n = window.prompt('Nombre del nuevo rubro (se agrega a TODAS las marcas):')
    if (!n) return
    const next = [...extras, n.trim().toUpperCase()]
    setExtras(next)
    try { localStorage.setItem(extrasKey, JSON.stringify(next)) } catch {}
  }
  async function guardar() {
    setSaving(true); setMsg(null)
    const rows = []
    marcas.forEach(({ sbu: sb, marca: mca }) => grupos.forEach((gr) => gr.items.forEach((it) => {
      const meses = MESES.map((_, mi) => val(mca, idDe(gr.g, it), mi))
      if (meses.some((v) => v !== 0)) rows.push({ rubro: `${gr.g} - ${it.n}`, sbu: sb, marca: mca, meses })
    })))
    await postRows(role, usuario, empresa, rows, setMsg)
    setSaving(false)
  }
  function exportar() {
    const aoa = [['EMPRESA', 'GRUPO', 'RUBRO', 'SBU', 'MARCA', ...MESES]]
    marcas.forEach(({ sbu: sb, marca: mca }) => grupos.forEach((gr) => gr.items.forEach((it) => {
      aoa.push([empresa, gr.g, it.n, sb, mca, ...MESES.map((_, mi) => val(mca, idDe(gr.g, it), mi))])
    })))
    exportXlsx(aoa, `${role.tab}_${rubro.k}.xlsx`)
  }
  function importar(ev) {
    const file = ev.target.files[0]; if (!file) return
    const lookup = {}
    grupos.forEach((gr) => gr.items.forEach((it) => { lookup[`${gr.g}|${it.n}`.toUpperCase()] = idDe(gr.g, it) }))
    importXlsx(file, (aoa) => {
      const next = { ...data }
      aoa.slice(1).forEach((r) => { const id = lookup[`${r[1]}|${r[2]}`.toUpperCase()]; const mca = r[4]; if (!id || !mca) return; for (let mi = 0; mi < 12; mi++) { const v = num(r[5 + mi]); if (v) next[key(mca, id, mi)] = v } })
      setData(next); setMsg({ t: 'ok', x: 'Datos importados. Revisa y pulsa Guardar.' })
    })
    ev.target.value = ''
  }

  return (
    <>
      <div className="toolbar">
        {!fixedMarca && <><label>Marca</label>
        <select value={marca} onChange={(e) => setMarca(e.target.value)}>
          {Object.entries(sbus).map(([s, ms]) => (<optgroup key={s} label={s}>
            <option value={`TOTAL::${s}`}>▣ TOTAL {s}</option>
            {ms.map((m) => <option key={m} value={m}>{m}</option>)}
          </optgroup>))}
        </select></>}
        {isTotal && !fixedMarca && <button className="seg active" onClick={() => setMarca((sbus[sbu] || [])[0])}>Viendo total {sbu}</button>}
        <div className="spacer"></div>
        <button className="btn" onClick={agregarRubro}>➕ Agregar rubro</button>
        <button className="btn" onClick={() => { const aoa = [['EMPRESA', 'GRUPO', 'RUBRO', 'SBU', 'MARCA', ...MESES]]; marcas.forEach(({ sbu: sb, marca: mca }) => grupos.forEach((gr) => gr.items.forEach((it) => aoa.push([empresa, gr.g, it.n, sb, mca, ...MESES.map(() => 0)])))); exportXlsx(aoa, `Plantilla_${role.tab}_${rubro.k}.xlsx`) }}>📄 Plantilla</button>
        <label className="btnfile">⬆ Importar Excel<input type="file" accept=".xlsx,.xls" onChange={importar} hidden /></label>
        <button className="btn" onClick={exportar}>⬇ Exportar Excel</button>
        <button className="btn primary" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : '💾 Guardar todo'}</button>
      </div>
      <div className="panel">
        <h3>{rubro.k} sobre la venta — {isTotal ? `TOTAL ${sbu}` : marca}{M$} <span className="unit">(👁️ venta viene de Comercial)</span></h3>
        <div className="sub">Cuánto pesa <b>{rubro.k}</b> sobre la <b>venta neta</b> (Unidades×AUP de Comercial), por mes y en total.</div>
        <div className="tablewrap"><table className="vfix"><colgroup><col style={{ width: '180px' }} />{MESES.map((_, i) => <col key={i} style={{ width: '66px' }} />)}<col style={{ width: '90px' }} /></colgroup>
          <thead><tr><th className="l">Concepto</th>{MESES.map((m) => <th key={m}>{m.toUpperCase()}</th>)}<th>Total</th></tr></thead>
          <tbody>
            <tr><td className="l sub2">Venta neta ($)</td>{MESES.map((_, m) => <td key={m} className="tot">{fmt(ventaMesT(m))}</td>)}<td className="tot">{fmt(MESES.reduce((a, _, m) => a + ventaMesT(m), 0))}</td></tr>
            <tr><td className="l sub2">{rubro.k} ($)</td>{MESES.map((_, m) => <td key={m} className="tot">{fmt(totMes(m))}</td>)}<td className="tot">{fmt(totalGeneral)}</td></tr>
            <tr className="grandrow"><td className="l">% {rubro.k} / venta</td>{MESES.map((_, m) => { const v = ventaMesT(m); return <td key={m} className="tot">{v ? (totMes(m) / v * 100).toFixed(1) + '%' : '—'}</td> })}<td className="tot">{(() => { const vt = MESES.reduce((a, _, m) => a + ventaMesT(m), 0); return vt ? (totalGeneral / vt * 100).toFixed(1) + '%' : '—' })()}</td></tr>
          </tbody>
        </table></div>
      </div>
      <div className="panel">
        <h3>{role.label} · {rubro.k} — {isTotal ? `TOTAL ${sbu}` : marca}{M$} <span className="unit">(USD · {empresa})</span>{isTotal ? <span className="unit" style={{ marginLeft: 8 }}>👁️ solo lectura</span> : <span className="fill-badge">✏️ para llenar</span>}</h3>
        <div className="sub">{isTotal ? 'Solo lectura: suma de todas las marcas de la SBU (según Combinaciones).' : 'Captura por rubro y mes. Los rubros son iguales para todas las marcas.'} Total: <b>${fmt(totalGeneral)}</b></div>
        <div className="tablewrap">
          <table>
            <thead><tr><th className="cod">Cód.</th><th className="l">Rubro</th>{MESES.map((m) => <th key={m}>{m}</th>)}<th>Total</th></tr></thead>
            <tbody>
              {multi && <>
                <tr className="secrow"><td colSpan={15}>RESUMEN POR CATEGORÍA</td></tr>
                <tr className="grandrow"><td className="cod"></td><td className="l">PRESUPUESTO TOTAL</td>{MESES.map((_, mi) => <td key={mi} className="tot">{fmt(totMes(mi))}</td>)}<td className="tot">{fmt(totalGeneral)}</td></tr>
                {grupos.map((gr) => (<tr key={'r' + gr.g} className="catrow"><td className="cod"></td><td className="l">{gr.g}</td>{MESES.map((_, mi) => <td key={mi} className="tot">{fmt(grpMes(gr, mi))}</td>)}<td className="tot">{fmt(grpTot(gr))}</td></tr>))}
                <tr className="sep"><td colSpan={15}></td></tr>
                <tr className="secrow"><td colSpan={15}>DETALLE</td></tr>
              </>}
              {grupos.map((gr) => (
                <Fragment2 key={gr.g}>
                  {multi && <tr className="sburow"><td className="cod"></td><td className="l">{gr.g}</td>{MESES.map((_, mi) => <td key={mi} className="tot">{fmt(grpMes(gr, mi))}</td>)}<td className="tot">{fmt(grpTot(gr))}</td></tr>}
                  {gr.items.map((it) => {
                    const id = idDe(gr.g, it)
                    let tot = 0
                    const celdas = MESES.map((_, mi) => {
                      if (isTotal) { const v = valSbu(id, mi); tot += v; return <td key={mi} className="tot">{fmt(v)}</td> }
                      const k = key(marca, id, mi); const v = data[k] ?? ''; tot += num(v)
                      return <td key={mi} className="cell"><input value={v} onChange={(e) => set(k, e.target.value)} inputMode="decimal" /></td>
                    })
                    return <tr key={id}><td className="cod">{it.c}</td><td className="l sub2">{it.n}</td>{celdas}<td className="tot">{fmt(tot)}</td></tr>
                  })}
                </Fragment2>
              ))}
              {!multi && <tr className="grandrow"><td className="cod"></td><td className="l">TOTAL</td>{MESES.map((_, mi) => <td key={mi} className="tot">{fmt(totMes(mi))}</td>)}<td className="tot">{fmt(totalGeneral)}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

/* ===== CASH FLOW: PSI + Cash Flow, 3 meses 2026 + proyección 2027 ===== */
function CashFlowForm({ role, rubro, usuario, empresa, sbus, fixedMarca }) {
  const marcas = marcasDe(sbus)
  const [marca, setMarca] = useState(fixedMarca || marcas[0].marca)
  useEffect(() => { if (fixedMarca) setMarca(fixedMarca) }, [fixedMarca])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [openCostos, setOpenCostos] = useState(false)
  const [openVentas, setOpenVentas] = useState(false)
  const [vistaCC, setVistaCC] = useState('todo') // Venta/cobro/saldo por cliente: qué mostrar
  const [buscar, setBuscar] = useState('')
  const matchCli = (cli) => !buscar.trim() || upper(cli).indexOf(upper(buscar)) >= 0
  const buscador = <div className="toolbar" style={{ marginBottom: 10 }}><input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="🔍 Buscar cliente…" style={{ border: '1px solid var(--line)', borderRadius: 7, padding: '7px 11px', font: 'inherit', minWidth: 220 }} />{buscar && <button className="btn" onClick={() => setBuscar('')}>✕ limpiar</button>}</div>
  const stKey = `cf_${empresa}`
  const [data, setData] = useState(() => { try { return JSON.parse(localStorage.getItem(stKey) || '{}') } catch { return {} } })
  const [hist, setHist] = useState([])
  const [ventas, setVentas] = useState([])
  const [producto, setProducto] = useState([])
  const [cats, setCats] = useState({})
  const [temp, setTemp] = useState({})
  const [comisData, setComisData] = useState({})
  const [logcost, setLogcost] = useState({}); const [precios, setPrecios] = useState({}) // % logísticos por marca (los llena Logística) + costos por temporada
  const [gadminData, setGadminData] = useState({}); const [gadminCfg, setGadminCfg] = useState(DEFAULT_GADMIN)
  // Cliente NUEVO (sin histórico 2025/2026): lo agregó Ventas. Se marca discretamente para que Finanzas lo sepa.
  const newSet = (() => {
    try {
      const add = JSON.parse(localStorage.getItem('addcli_' + empresa) || '{}')
      const names = new Set(); Object.values(add).forEach((arr) => (arr || []).forEach((c) => { if (c) names.add(upper(c)) }))
      const histAll = new Set(); hist.forEach((r) => { if (upper(r[0]) !== upper(empresa)) return; if (upper(r[3]).indexOf('UNIDAD') < 0) return; const y = String(r[1]); if (y !== '2025' && y !== '2026') return; const cli = String(r[8] || '').trim(); if (cli) histAll.add(upper(cli)) })
      const out = new Set(); names.forEach((n) => { if (!histAll.has(n)) out.add(n) }); return out
    } catch { return new Set() }
  })()
  const esNew = (cli) => newSet.has(upper(cli))
  const [mkRows, setMkRows] = useState([]); const [logRows, setLogRows] = useState([]); const [dirRows, setDirRows] = useState([]) // Marketing / Logística / Director (para espejo de Costos Operativos)
  useEffect(() => { try { setTemp(JSON.parse(localStorage.getItem(`temp_${empresa}`) || '{}')) } catch { } try { setComisData(JSON.parse(localStorage.getItem(`comis_${empresa}`) || '{}')) } catch { } try { setLogcost(JSON.parse(localStorage.getItem(`logcost_${empresa}`) || '{}')) } catch { } try { setPrecios(JSON.parse(localStorage.getItem(`precios_${empresa}`) || '{}')) } catch { } try { setGadminData(JSON.parse(localStorage.getItem(`gadmin_${empresa}`) || '{}')) } catch { } try { const s = JSON.parse(localStorage.getItem(`gadmin_cfg_${empresa}`) || 'null'); if (Array.isArray(s) && s.length) setGadminCfg(s) } catch { } }, [empresa])
  const isTotal = String(marca).startsWith('TOTAL::')
  const sbu = isTotal ? String(marca).slice(7) : sbuDe(sbus, marca)
  const sbuLbl = sbu === '__ALL__' ? 'TODAS' : sbu
  const sbuMarcas = sbu === '__ALL__' ? Object.values(sbus).flat() : (sbus[sbu] || [])
  const soloVer = !!(role && role.id === 'director') // el Director solo ve (lo llena Finanzas)

  useEffect(() => {
    (async () => {
      try { const j = await gHistorico(); if (j && j.ok && j.values) setHist(j.values.slice(1)) } catch { }
      try { const j2 = await gReadTab('Cap_Ventas'); if (j2 && j2.ok && j2.values) setVentas(j2.values.slice(1)) } catch { }
      try { const j3 = await gReadTab('Cap_Producto'); if (j3 && j3.ok && j3.values) setProducto(j3.values.slice(1)) } catch { }
      try { const j4 = await gReadTab('Cap_Categorias'); if (j4 && j4.ok && j4.values) { const out = {}; j4.values.slice(1).forEach((row) => { if (upper(row[0]) !== upper(empresa)) return; const cat = row[1], mar = row[3], peso = num(row[4]); if (!mar || !cat) return; (out[mar] = out[mar] || []).push({ cat, peso }) }); setCats(out) } } catch { }
      try { const j5 = await gReadTab('Cap_Marketing'); if (j5 && j5.ok && j5.values) setMkRows(j5.values.slice(1)) } catch { }
      try { const j6 = await gReadTab('Cap_Logistica'); if (j6 && j6.ok && j6.values) setLogRows(j6.values.slice(1)) } catch { }
      try { const j7 = await gReadTab('Cap_Director'); if (j7 && j7.ok && j7.values) setDirRows(j7.values.slice(1)) } catch { }
    })()
  }, [empresa])
  // Espejo de Costos Operativos: Marketing (equipo Marketing) y Viajes (rubros VIAJES de todas las áreas), por mes.
  const rowMatchCF = (r, mca) => upper(r[0]) === upper(empresa) && upper(r[3]) === upper(mca)
  const esViajeRub = (rub) => String(rub || '').toUpperCase().startsWith('VIAJES')
  const marketingMes = (mca) => MESES.map((_, m) => mkRows.reduce((a, r) => (rowMatchCF(r, mca) && !esViajeRub(r[1])) ? a + num(r[4 + m]) : a, 0))
  const viajesMes = (mca) => MESES.map((_, m) => [ventas, producto, mkRows, logRows, dirRows].reduce((s, rows) => s + rows.reduce((a, r) => (rowMatchCF(r, mca) && esViajeRub(r[1])) ? a + num(r[4 + m]) : a, 0), 0))
  // Costos logísticos (espejo del modelo de % que llena Logística por marca):
  //   venta = % logístico × costo de venta (unid×AUC); muestras = % × compras; mantenimiento = % × valor del saldo.
  const logUnitsVentaMes = (mca) => MESES.map((_, m) => { let s = 0; ventas.forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(mca)) return; if (esViajeRub(r[1])) return; s += num(r[4 + m]) }); return s })
  const logCostoVentaBase = (mca) => { const u = logUnitsVentaMes(mca), c = aucMes(mca); return MESES.map((_, m) => u[m] * c[m]) }
  const logSaldoValBase = (mca) => { try { const inv = inventarioCalc(temp, mca, ventaMarcaMes(ventas, empresa, mca)); return MESES.map((_, m) => SEASONS.reduce((a, s) => a + inv.flujos[s][m].fin * seasonAUCfrom(precios, mca, s), 0)) } catch { return Array(12).fill(0) } }
  const logPct = (mca, k) => num(logcost[`${mca}|${k}`])
  const logVentaMes = (mca) => { const b = logCostoVentaBase(mca), p = logPct(mca, 'PCT_LOGVENTA'); return b.map((v) => v * p / 100) }
  const logMuestrasMes = (mca) => { const b = comprasUsdMes(mca), p = logPct(mca, 'PCT_MUESTRAS'); return b.map((v) => v * p / 100) }
  const logMantMes = (mca) => { const b = logSaldoValBase(mca), p = logPct(mca, 'PCT_MANT'); return b.map((v) => v * p / 100) }
  const logTotalMes = (mca) => { const a = logVentaMes(mca), b = logMuestrasMes(mca), c = logMantMes(mca); return MESES.map((_, m) => a[m] + b[m] + c[m]) }
  const logisticaMes = (mca) => logTotalMes(mca) // el total (venta + muestras + mantenimiento) alimenta la línea Logística de Costos Operativos

  // Clientes de una marca: histórico 2025/2026 + nuevos capturados en Ventas (2028)
  const clientesDe = (mca) => {
    const set = new Set()
    hist.forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[5]) !== upper(mca)) return; const y = String(r[1]); if (y !== '2025' && y !== '2026') return; const cli = String(r[8] || '').trim(); if (cli) set.add(cli) })
    ventas.forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(mca)) return; const cli = String(r[1] || '').trim(); if (cli) set.add(cli) })
    try { const add = JSON.parse(localStorage.getItem('addcli_' + empresa) || '{}'); (add[mca] || []).forEach((c) => { if (c) set.add(c) }) } catch { }
    return [...set].sort((a, b) => a.localeCompare(b))
  }

  const key = (mca, concepto, mi) => `${mca}|${concepto}|${mi}`
  const set = (k, v) => setData((d) => ({ ...d, [k]: v }))
  const val = (mca, concepto, mi) => num(data[key(mca, concepto, mi)])
  // Cash In (Cobros) de Dic-27 = suma del saldo (deuda) cierre 2027 por cliente (calculado, no editable)
  const CASHIN = 'Cash In (Cobros)', DIC27 = 2, CASH_INI = 'Cash Inicial', CASH_FIN = 'Cash Final', CASH_OUT = 'Cash Out (Pagos)'
  // Clientes internos (intercompañía): venta incobrable → no genera Cash In (se marca en Ventas).
  const internoMap = (() => { try { return JSON.parse(localStorage.getItem('interno_' + empresa) || '{}') } catch { return {} } })()
  const esInterno = (mca, cli) => !!internoMap[`${mca}|${cli}`]
  // Incobrable = marcado Interno en Ventas, O con plazo "Intercompañía". No genera Cash In.
  const esIncobrable = (mca, cli) => esInterno(mca, cli) || data[`TERM|${mca}|${cli}`] === 'Intercompañía'
  const saldoTotal = (mca) => clientesDe(mca).reduce((s, cli) => esIncobrable(mca, cli) ? s : s + num(data[`SALDO|${mca}|${cli}`]), 0)
  // ARRASTRE 2027 (venta externa ya vendida, pendiente de cobro): la persona coloca por cliente CUÁNTO entra en cada
  // mes de 2028 (ene..jun cubren hasta 180 días desde el cierre). Directo, sin adivinar plazos. Los internos no cuentan.
  const ARR_N = 3 // ene..mar-28 (arrastre del cierre 2027)
  const arr27Key = (mca, cli, mi) => `COB2027|${mca}|${cli}|${mi}`
  const arr27 = (mca, cli, mi) => esIncobrable(mca, cli) ? 0 : num(data[arr27Key(mca, cli, mi)])
  const arr27Total = (mca, mi) => (mi < ARR_N ? clientesDe(mca).reduce((s, cli) => s + arr27(mca, cli, mi), 0) : 0) // arrastre que entra en el mes mi
  const arr27Cli = (mca, cli) => { let t = 0; for (let mi = 0; mi < ARR_N; mi++) t += arr27(mca, cli, mi); return t }
  const gadminSubtot = MESES.map((_, m) => gadminCfg.reduce((a, it) => a + num(gadminData[`${it.cod}|${m}`]), 0))
  const cellRaw = (concepto, mi) => {
    if (concepto === 'Comisiones') return isTotal ? sbuMarcas.reduce((s, m) => s + comisTotalMes(m)[mi], 0) : comisTotalMes(marca)[mi]
    if (concepto === 'Gastos administrativos') return isTotal ? gadminSubtot[mi] : 0 // gastos admin solo existen a TOTAL SBU
    if (concepto === 'Viajes') return isTotal ? sbuMarcas.reduce((s, m) => s + viajesMes(m)[mi], 0) : viajesMes(marca)[mi]
    if (concepto === 'Marketing') return isTotal ? sbuMarcas.reduce((s, m) => s + marketingMes(m)[mi], 0) : marketingMes(marca)[mi]
    if (concepto === 'Logística') return isTotal ? sbuMarcas.reduce((s, m) => s + logisticaMes(m)[mi], 0) : logisticaMes(marca)[mi]
    return isTotal ? sbuMarcas.reduce((s, m) => s + val(m, concepto, mi), 0) : val(marca, concepto, mi)
  }
  // Comisiones (del Director): venta externa (Unid×AUP) × % + corporativa (compras × $/ud en HOKA/UGG).
  const comisTotalMes = (mca) => comisionCalc(mca, comisData, ventaNetaMes(mca)).total

  // Compras 2028 (de Comercial) → pago según el término de pago de la marca (a proveedor). Parte del Cash Out.
  // Compras: se capturan por fecha XFD; la DISPONIBLE = XFD corrida `tránsito` meses (por marca; default 0).
  const transitOf = (mca) => Math.max(0, Math.round(num(temp[`TR|${mca}`])))
  const comprasUdMes = (mca) => MESES.map((_, m) => SEASONS.reduce((a, s) => a + num(temp[`CP|${mca}|${s}|${m}`]), 0)) // XFD (unidades)
  const comprasUdDisp = (mca) => { const x = comprasUdMes(mca), t = transitOf(mca); return MESES.map((_, m) => (m - t >= 0 ? x[m - t] : 0)) } // disponible (unidades)
  const aucMes = (mca) => { const a = Array(12).fill(0); producto.forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(mca) || upper(r[1]) !== 'AUC') return; for (let j = 0; j < 12; j++) a[j] = num(r[4 + j]) }); return a }
  const comprasUsdMes = (mca) => { const u = comprasUdMes(mca), c = aucMes(mca); return MESES.map((_, m) => u[m] * c[m]) } // XFD ($)
  const comprasUsdDisp = (mca) => { const u = comprasUdDisp(mca), c = aucMes(mca); return MESES.map((_, m) => u[m] * c[m]) } // disponible ($)
  const comprasPagoUsd = (mca) => comprasUsdMes(mca) // el pago al proveedor siempre se calcula sobre la compra por fecha XFD
  const pagosMarca = (mca) => { const compras = comprasPagoUsd(mca); const plazo = CF_PLAZO_MESES[data[`PTERM|${mca}`]] ?? 0; return { compras, pagos: MESES.map((_, m) => (m >= plazo ? compras[m - plazo] : 0)), plazo } }
  const corpPagoMes = (mca) => comisionCorpMes(mca, data, comprasUdMes(mca)) // comisión corporativa (HOKA/UGG): $/ud × compras XFD, es un pago (Cash Out)

  // Escalera de cobros: Ventas Netas 2028 = Unidades 2028 (Cap_Ventas) × AUP (Cap_Producto), cobradas según el plazo del cliente.
  const unidades2028 = (mca) => { const out = {}; ventas.forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(mca)) return; const cli = String(r[1] || '').trim(); if (!cli) return; const arr = out[cli] || (out[cli] = Array(12).fill(0)); for (let j = 0; j < 12; j++) arr[j] += Math.max(0, num(r[4 + j])) }); return out }
  // AUP ponderado por marca = Σ (peso_categoría × AUP_categoría). El AUP se captura por categoría (Producto).
  // AUP promedio de la marca con la mezcla real por categoría (unidades × % por cliente)
  const aupMarca = (mca) => realAupAuc(empresa, mca, ventas, producto, (cats[mca] || []).map((c) => c.cat)).aupW
  const cobros2028 = (mca) => {
    const uni = unidades2028(mca), aup = aupMarca(mca), byCli = {}, total = Array(12).fill(0)
    Object.keys(uni).forEach((cli) => {
      if (esIncobrable(mca, cli)) return // venta interna / Intercompañía: incobrable, no genera cobros
      const p = CF_PLAZO_MESES[data[`TERM|${mca}|${cli}`]] ?? 0
      const row = Array(12).fill(0)
      for (let j = 0; j < 12; j++) { const src = j - p; if (src >= 0) row[j] = (uni[cli][src] || 0) * (aup[src] || 0) }
      byCli[cli] = row; for (let j = 0; j < 12; j++) total[j] += row[j]
    })
    return { total, byCli }
  }
  const _cobCache = {}
  const getCobros = (mca) => _cobCache[mca] || (_cobCache[mca] = cobros2028(mca))
  // Cobros 2028 agrupados por PLAZO del cliente (Cash, 30, 60…), para el mapa de cobros tipo COBROS USD.
  const _cptCache = {}
  const cobrosPorTerm = (mca) => _cptCache[mca] || (_cptCache[mca] = (() => { const { byCli } = getCobros(mca); const out = {}; CF_TERMINOS.forEach((t) => out[t] = Array(12).fill(0)); Object.keys(byCli).forEach((cli) => { let t = data[`TERM|${mca}|${cli}`]; if (!out[t]) t = 'Cash'; for (let m = 0; m < 12; m++) out[t][m] += byCli[cli][m] }); return out })())
  // Venta 2028 por mes de venta (no cobro), separada en externa (cobrable) vs interna (incobrable, intercompañía).
  const ventaSplit2028 = (mca) => { const uni = unidades2028(mca), aup = aupMarca(mca), ext = Array(12).fill(0), int = Array(12).fill(0); Object.keys(uni).forEach((cli) => { const tgt = esIncobrable(mca, cli) ? int : ext; for (let j = 0; j < 12; j++) tgt[j] += (uni[cli][j] || 0) * (aup[j] || 0) }); return { ext, int } }
  const _vsCache = {}
  const ventaSplit = (mca) => _vsCache[mca] || (_vsCache[mca] = ventaSplit2028(mca))
  const ventaSplitMemo = (pick, mi) => isTotal ? sbuMarcas.reduce((s, m) => s + ventaSplit(m)[pick][mi], 0) : ventaSplit(marca)[pick][mi]

  // Venta Neta 2028 = Σ unidades (Ventas) × AUP (Producto), por mes. Ambos salen de Comercial.
  const ventaNetaMes = (mca) => realAupAuc(empresa, mca, ventas, producto, (cats[mca] || []).map((c) => c.cat)).ventaMes
  // Inventario (de Producto): saldo en unidades × AUC. Inicial del mes = saldo del mes anterior.
  const invFinUsd = (mca) => { const { saldoUnits } = inventarioCalc(temp, mca, ventaMarcaMes(ventas, empresa, mca)); const auc = aucMes(mca); return MESES.map((_, m) => saldoUnits[m] * (auc[m] || 0)) }
  const invIniUsd = (mca) => { const { saldoUnits } = inventarioCalc(temp, mca, ventaMarcaMes(ventas, empresa, mca)); const auc = aucMes(mca); const kk = invKeys(mca); const opening = SEASONS.reduce((a, s) => a + num(temp[kk.II(s)]), 0); return MESES.map((_, m) => (m === 0 ? opening : saldoUnits[m - 1]) * (auc[m] || 0)) }
  const VENTAS_NETAS = 'Ventas Netas', COMPRAS_FD = 'Compras (Fecha disponible)', INV_INI = 'Inventario Inicial', INV_FIN = 'Inventario Final'
  const CALC_PSI = { [VENTAS_NETAS]: ventaNetaMes, [COMPRAS_FD]: comprasUsdDisp, [INV_INI]: invIniUsd, [INV_FIN]: invFinUsd }
  const esCalcComercial = (it) => !!CALC_PSI[it]
  const cell = (concepto, mi) => {
    if (concepto === CASH_INI) return cashCalc.ini[mi]
    if (concepto === CASH_FIN) return cashCalc.fin[mi]
    if (concepto === CASHIN) {
      const tail = isTotal ? sbuMarcas.reduce((s, m) => s + arr27Total(m, mi), 0) : arr27Total(marca, mi)  // arrastre 2027 que entra este mes (lo coloca Finanzas por cliente)
      const esc = isTotal ? sbuMarcas.reduce((s, m) => s + getCobros(m).total[mi], 0) : getCobros(marca).total[mi]  // escalera de ventas 2028
      return tail + esc
    }
    if (concepto === CASH_OUT) { return isTotal ? sbuMarcas.reduce((s, m) => s + pagosMarca(m).pagos[mi] + corpPagoMes(m)[mi], 0) : pagosMarca(marca).pagos[mi] + corpPagoMes(marca)[mi] } // pagos a proveedores + comisión corporativa (HOKA/UGG)
    if (CALC_PSI[concepto]) { const fn = CALC_PSI[concepto]; return isTotal ? sbuMarcas.reduce((s, m) => s + fn(m)[mi], 0) : fn(marca)[mi] }
    if (concepto === CF_COSTOS_PARENT) return CF_COSTOS.reduce((a, sub) => a + cellRaw(sub, mi), 0)
    return cellRaw(concepto, mi)
  }
  // Valor de UNA marca (para el desglose del total): misma lógica que cell pero sin sumar SBU.
  const cellMarca = (mca, concepto, mi) => {
    if (concepto === CASH_INI) return cashCalcMarca(mca).ini[mi]
    if (concepto === CASH_FIN) return cashCalcMarca(mca).fin[mi]
    if (concepto === CASHIN) { return arr27Total(mca, mi) + getCobros(mca).total[mi] }
    if (concepto === CASH_OUT) return pagosMarca(mca).pagos[mi] + corpPagoMes(mca)[mi]
    if (CALC_PSI[concepto]) return CALC_PSI[concepto](mca)[mi]
    if (concepto === CF_COSTOS_PARENT) return CF_COSTOS.reduce((a, sub) => a + val(mca, sub, mi), 0)
    return val(mca, concepto, mi)
  }
  // Cash Inicial / Cash Final encadenados: el SALDO EN BANCO al inicio del plan es la semilla
  // (Cash Inicial del primer mes, Oct-27); luego Inicial(mes)=Final(mes anterior) y
  // Final(mes) = Inicial + Cash In − Cash Out − Costos Operativos.
  const bancoIni = (mca) => num(data[key(mca, CASH_INI, 0)]) // saldo en banco al arrancar el plan
  const buildCash = (inFn, outFn, seed) => {
    const ini = Array(CF_MESES.length).fill(0), fin = Array(CF_MESES.length).fill(0)
    for (let mi = 0; mi < CF_MESES.length; mi++) { ini[mi] = mi === 0 ? seed : fin[mi - 1]; fin[mi] = ini[mi] + inFn(mi) - outFn(mi) }
    return { ini, fin }
  }
  const flujoNeto = (mi) => cell(CASHIN, mi) - cell(CASH_OUT, mi) - cell(CF_COSTOS_PARENT, mi)
  const cashCalc = buildCash((mi) => cell(CASHIN, mi), (mi) => cell(CASH_OUT, mi) + cell(CF_COSTOS_PARENT, mi), isTotal ? sbuMarcas.reduce((s, m) => s + bancoIni(m), 0) : bancoIni(marca))
  const cashCalcMarca = (mca) => buildCash((mi) => cellMarca(mca, CASHIN, mi), (mi) => cellMarca(mca, CASH_OUT, mi) + cellMarca(mca, CF_COSTOS_PARENT, mi), bancoIni(mca))
  // Texto "ALTRA: 1,234 · HOKA: 567" para el tooltip del total (solo si el desglose está activo).
  const brk = (concepto, mi) => isTotal ? (sbuMarcas.map((m) => ({ m, v: cellMarca(m, concepto, mi) })).filter((x) => Math.abs(x.v) > 0.5).map((x) => `${x.m}: ${fmt(x.v)}`).join(' · ') || 'Sin datos por marca') : undefined
  const subTot = (sub) => CF_MESES.reduce((a, _, mi) => a + cellRaw(sub, mi), 0)
  const rowTot = (concepto) => CF_MESES.reduce((a, _, mi) => a + cell(concepto, mi), 0)

  function guardar() {
    setSaving(true)
    try { saveEstado(empresa, 'cf', data); setMsg({ t: 'ok', x: 'Guardado en Google Sheet (Cash Flow).' }) }
    catch { setMsg({ t: 'bad', x: 'No se pudo guardar.' }) }
    setSaving(false)
  }
  function exportar() {
    const aoa = [['EMPRESA', 'CONCEPTO', 'SBU', 'MARCA', ...CF_MESES]]
    marcas.forEach(({ sbu: sb, marca: mca }) => CF_GROUPS.forEach((gr) => gr.items.forEach((it) => aoa.push([empresa, it, sb, mca, ...CF_MESES.map((_, mi) => val(mca, it, mi))]))))
    exportXlsx(aoa, `${role.tab}_CASHFLOW.xlsx`)
  }
  function importar(ev) {
    const file = ev.target.files[0]; if (!file) return
    importXlsx(file, (aoa) => {
      const next = { ...data }
      aoa.slice(1).forEach((r) => { const concepto = r[1], mca = r[3]; if (!concepto || !mca) return; for (let mi = 0; mi < CF_MESES.length; mi++) { const v = num(r[4 + mi]); if (v) next[key(mca, concepto, mi)] = v } })
      setData(next); setMsg({ t: 'ok', x: 'Datos importados. Revisa y pulsa Guardar.' })
    })
    ev.target.value = ''
  }

  return (
    <>
      {msg && <div className={'note ' + msg.t}>{msg.x}</div>}
      <div className="toolbar">
        {!fixedMarca && <><label>Marca</label>
        <select value={marca} onChange={(e) => setMarca(e.target.value)}>
          {Object.entries(sbus).map(([s, ms]) => (<optgroup key={s} label={s}>
            <option value={`TOTAL::${s}`}>▣ TOTAL {s}</option>
            {ms.map((m) => <option key={m} value={m}>{m}</option>)}
          </optgroup>))}
        </select></>}
        {isTotal && !fixedMarca && <button className="seg active" onClick={() => setMarca((sbus[sbu] || [])[0])}>Viendo total {sbuLbl}</button>}
        <div className="spacer"></div>
        <button className="btn" onClick={() => { const aoa = [['EMPRESA', 'CONCEPTO', 'SBU', 'MARCA', ...CF_MESES]]; marcas.forEach(({ sbu: sb, marca: mca }) => CF_GROUPS.forEach((gr) => gr.items.forEach((it) => aoa.push([empresa, it, sb, mca, ...CF_MESES.map(() => 0)])))); exportXlsx(aoa, `${role.tab}_CASHFLOW_Plantilla.xlsx`) }}>📄 Plantilla</button>
        {!soloVer && <label className="btnfile">⬆ Importar Excel<input type="file" accept=".xlsx,.xls" onChange={importar} hidden /></label>}
        <button className="btn" onClick={exportar}>⬇ Exportar Excel</button>
        {soloVer ? <span className="note ok" style={{ margin: 0, padding: '6px 12px' }}>👁️ Solo lectura — esto lo llena Finanzas</span> : <button className="btn primary" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : '💾 Guardar'}</button>}
      </div>
      <div className="panel">
        <h3>{role.label} — CASH FLOW{M$} <span className="unit">(USD · {isTotal ? `TOTAL ${sbuLbl}` : marca})</span>{soloVer && ESP('Espejo (solo lectura): estos valores los llena Finanzas en su Cash Flow. Aquí solo se ven.')}</h3>
        <div className="sub">Proyección 2028 (enero a diciembre). <b>Cash Final = Cash Inicial + <span style={{ color: '#15803d' }}>Cobros</span> − <span style={{ color: '#b91c1c' }}>Pagos</span> − <span style={{ color: '#b91c1c' }}>Costos operativos</span></b>. {(isTotal || soloVer) ? <>🪞 Vista de solo lectura (consolidado). El <b>saldo en banco al cierre de 2027</b> lo pone Finanzas al entrar a cada marca.</> : <>Lo único que llenas a mano es el <b>saldo en banco al cierre de 2027</b> (el Cash Inicial de enero-28, la celda amarilla); todo lo demás se calcula.</>} El PSI (inventario, compras, ventas) viene de Comercial/Producto.</div>
        <div className="tablewrap">
          <table className="vfix"><colgroup><col style={{ width: '210px' }} />{CF_MESES.map((_, i) => <col key={i} style={{ width: '66px' }} />)}<col style={{ width: '80px' }} /></colgroup>
            <thead>
              <tr><th className="l">Concepto</th>{CF_M2028.map((m) => <th key={m} className="yb">{m}</th>)}<th>Total</th></tr>
            </thead>
            <tbody>
              {CF_GROUPS.map((gr, gi) => (
                <Fragment2 key={gr.g}>
                  {gi > 0 && <tr className="sep"><td colSpan={14}></td></tr>}
                  <tr className="secrow"><td colSpan={14}>{gr.g}</td></tr>
                  {gr.items.map((it) => {
                    const esCostos = it === CF_COSTOS_PARENT
                    const esVentas = it === VENTAS_NETAS // desplegable: muestra venta externa / interna
                    // Signo y color: entradas (+ verde), salidas (− rojo). El resto neutro.
                    const signo = it === CASHIN ? '+ ' : (it === CASH_OUT || esCostos) ? '− ' : ''
                    const colFila = it === CASHIN ? '#15803d' : (it === CASH_OUT || esCostos) ? '#b91c1c' : undefined
                    const celdas = CF_MESES.map((_, mi) => {
                      const cls = 'yb'
                      // Cash Inicial: enero-28 es la SEMILLA = saldo en banco al cierre de dic-27 (editable); el resto = Cash Final del mes anterior (calc)
                      if (it === CASH_INI) {
                        if (mi === 0 && !isTotal && !soloVer) { const k = key(marca, CASH_INI, 0); return <td key={mi} className={'cell ' + cls}><input value={data[k] ?? ''} onChange={(e) => set(k, e.target.value)} inputMode="decimal" title="Saldo en banco al cierre de 2027 (arranque de enero-28)" /></td> }
                        return <td key={mi} className={'tot ' + cls} style={{ cursor: 'help' }} title={mi === 0 ? 'Saldo en banco al cierre de 2027 (semilla que pone Finanzas)' : 'Cash Inicial = Cash Final del mes anterior'}>{fmt(cell(it, mi))}</td>
                      }
                      // Cash Final: siempre calculado = Cash Inicial + Cash In − Cash Out − Costos Operativos
                      if (it === CASH_FIN) return <td key={mi} className={'tot ' + cls} style={{ cursor: 'help', fontWeight: 700 }} title="Fórmula: Cash Final = Cash Inicial + Cash In − Cash Out − Costos Operativos">{fmt(cell(it, mi))}</td>
                      const cashinCalc = it === CASHIN // Cash In siempre calculado (OCT/NOV/DIC-27 de cuentas por cobrar + escalera 2028)
                      const cashoutCalc = it === CASH_OUT // Cash Out siempre calculado (pagos a proveedores)
                      const comercialCalc = esCalcComercial(it)
                      if (isTotal || esCostos || cashinCalc || cashoutCalc || comercialCalc || soloVer) {
                        const cashinBrk = () => { const a = isTotal ? sbuMarcas.reduce((s, m) => s + arr27Total(m, mi), 0) : arr27Total(marca, mi); const e = isTotal ? sbuMarcas.reduce((s, m) => s + getCobros(m).total[mi], 0) : getCobros(marca).total[mi]; return `Fórmula: Cash In = Saldo pendiente por cobrar 2027 + Ventas 2028 cobradas (por plazo)\nDatos de origen: Saldo pendiente 2027 = ${fmt(a) || '0'} · Ventas 2028 = ${fmt(e) || '0'} · Total = ${fmt(a + e) || '0'}` }
                        const brkNum = brk(it, mi)
                        const tit = it === CASHIN ? cashinBrk() : ((it === CASH_OUT ? 'Fórmula: Cash Out = Compras 2028 × término de pago de la marca' : it === VENTAS_NETAS ? 'Fórmula: Ventas Netas = Unidades × AUP efectivo del mes' : it === COMPRAS_FD ? 'Fórmula: Compras = Unidades compradas × AUC' : (it === INV_INI || it === INV_FIN) ? 'Fórmula: Inventario × AUC' : '') + (brkNum ? (it === CASH_OUT || it === VENTAS_NETAS || it === COMPRAS_FD || it === INV_INI || it === INV_FIN ? '\nDatos de origen: ' : '') + brkNum : '') || undefined)
                        const v = cell(it, mi)
                        return <td key={mi} className={'tot ' + cls} style={{ ...(isTotal ? { cursor: 'help' } : {}), color: colFila }} title={tit}>{Math.abs(v) > 0.5 ? signo : ''}{fmt(v)}</td>
                      }
                      const k = key(marca, it, mi)
                      return <td key={mi} className={'cell ' + cls}><input value={data[k] ?? ''} onChange={(e) => set(k, e.target.value)} inputMode="decimal" /></td>
                    })
                    const ayudaComp = it === CASHIN ? 'Cash In (Cobros): calculado, no se escribe a mano. Suma dos cosas: (1) la COLA de las cuentas por cobrar del cierre 2027 — lo que quedó pendiente de oct/nov/dic-27 entra en su mes según el plazo del cliente (ej: octubre a 90 días → enero-28); y (2) las VENTAS 2028 cobradas por su propia escalera (Cash=mismo mes, 30d=+1, 60=+2…). La venta interna (intercompañía) es incobrable y va aparte, abajo.' : it === CASH_OUT ? 'Cash Out (Pagos): calculado, no se escribe a mano. Es la consecuencia de los pagos a proveedores: la compra 2028 × término de pago de la marca (bloque "Compras y pagos" de abajo).' : it === VENTAS_NETAS ? 'Ventas Netas TOTAL = venta interna + externa (todos los clientes) = Unidades × AUP efectivo del mes. Es la venta CONTABLE (devengada), no el cobro: por eso no coincide con el Cash In, que solo cuenta la venta externa y aplica el plazo de cada cliente.' : it === COMPRAS_FD ? 'Compras = unidades compradas × AUC (Producto). Párate sobre cada mes.' : null
                    const exp = esCostos || esVentas; const abierto = esCostos ? openCostos : openVentas; const toggle = esCostos ? () => setOpenCostos((o) => !o) : () => setOpenVentas((o) => !o)
                    const fila = <tr key={it} className={exp ? 'rowline ' + (abierto ? 'open' : '') : undefined} onClick={exp ? toggle : undefined} style={exp ? { cursor: 'pointer' } : undefined}><td className="l" style={{ color: colFila }}>{exp ? <span className="caret">▶</span> : null} {esVentas ? 'Ventas Netas Total' : it}{ayudaComp && Q(ayudaComp)}{exp ? <span className="unit" style={{ marginLeft: 6, color: 'var(--muted)' }}>({abierto ? 'ocultar' : 'ver'} {esVentas ? 'externa / interna' : 'detalle'})</span> : null}</td>{celdas}<td className="tot" style={{ color: colFila }}>{Math.abs(rowTot(it)) > 0.5 ? signo : ''}{fmt(Math.abs(rowTot(it)))}</td></tr>
                    if (it === CASH_FIN) {
                      const flujoCeldas = CF_MESES.map((_, mi) => { const cls = 'yb'; const v = flujoNeto(mi); const s = v > 0.5 ? '+ ' : v < -0.5 ? '− ' : ''; return <td key={mi} className={'tot ' + cls} style={{ color: v < -0.5 ? '#b91c1c' : v > 0.5 ? '#15803d' : undefined }}>{s}{fmt(Math.abs(v))}</td> })
                      const flujoTot = CF_MESES.reduce((a, _, mi) => a + flujoNeto(mi), 0)
                      const flujoRow = <tr key="flujoneto" className="grandrow"><td className="l">= Flujo neto del mes <span className="unit">(cobros − pagos − costos)</span></td>{flujoCeldas}<td className="tot">{fmt(flujoTot)}</td></tr>
                      return <Fragment2 key={it}>{flujoRow}{fila}</Fragment2>
                    }
                    if (esVentas) {
                      return <Fragment2 key={it}>{fila}{openVentas && [['Venta externa (base de cobros)', '#0b5566', 'ext'], ['Venta interna (incobrable · intercompañía)', '#b45309', 'int']].map(([lbl, color, pick]) => <tr key={pick}><td className="l sub2" style={{ color }}>{lbl}</td>{CF_MESES.map((_, mi) => <td key={mi} className="tot yb" style={{ color }}>{fmt(ventaSplitMemo(pick, mi))}</td>)}<td className="tot" style={{ color }}>{fmt(CF_MESES.reduce((a, _, mi) => a + ventaSplitMemo(pick, mi), 0))}</td></tr>)}</Fragment2>
                    }
                    if (!esCostos) return fila
                    return (
                      <Fragment2 key={it}>
                        {fila}
                        {openCostos && CF_COSTOS.map((sub) => {
                          const fuente = sub === 'Gastos administrativos' ? 'solo TOTAL · lo llena Finanzas en su pestaña' : sub === 'Logística' ? 'suma de los costos logísticos del equipo de Logística' : sub === 'Viajes' ? 'suma de los viajes de todo el equipo' : sub === 'Marketing' ? 'monto del equipo de Marketing' : 'calc del Director (venta externa × %)'
                          const sceldas = CF_MESES.map((_, mi) => { const bn = brk(sub, mi); return <td key={mi} className="tot yb" style={{ cursor: 'help' }} title={'Origen: ' + fuente + (bn ? '\nDatos de origen: ' + bn : '')}>{fmt(cellRaw(sub, mi))}</td> })
                          return <tr key={sub}><td className="l sub2">{sub} {ESP(fuente)}</td>{sceldas}<td className="tot">{fmt(subTot(sub))}</td></tr>
                        })}
                      </Fragment2>
                    )
                  })}
                </Fragment2>
              ))}
            </tbody>
          </table>
        </div>
      </div>


      <div className="panel">
        <h3>{role.label} — Término de cobros a los clientes <span className="unit">({isTotal ? `TOTAL ${sbuLbl}` : marca})</span>{!isTotal && !soloVer && <span className="fill-badge">✏️ para llenar</span>}{(isTotal || soloVer) && ESP('Espejo (solo lectura): lo captura Finanzas por marca. Aquí solo se ve.')}</h3>
        {(isTotal || soloVer)
          ? <div className="note ok" style={{ marginBottom: 12 }}>🪞 <b>Espejo (solo lectura):</b> el saldo pendiente por cobrar del 2027 lo captura <b>Finanzas por cada marca</b>. Aquí solo ves el consolidado.</div>
          : <div className="note ok" style={{ marginBottom: 12 }}>💡 <b>Cómo funciona:</b><div style={{ marginTop: 6, paddingLeft: 16 }}><div><b>1.</b> Selecciona el <b>término de pago</b> de cada cliente (Cash, 30 días, 60 días, 90 días).</div><div style={{ marginTop: 4 }}><b>2.</b> Coloca las <b>cuentas por cobrar del 2027</b> en el mes en que debe efectuarse el cobro (enero a marzo).</div></div></div>}
        {buscador}
        {(() => {
          const arrIdx = [0, 1, 2]; const arrLbl = CF_M2028.slice(0, 3); const DIV = { borderLeft: '3px solid var(--odoo)' }; const STK = { position: 'sticky', top: 0, zIndex: 3, background: '#f7fafb' }; const STK2 = { position: 'sticky', top: 33, zIndex: 3, background: '#f7fafb' }
          if (isTotal) {
            const secciones = sbuMarcas.map((mca) => ({ mca, cls: clientesDe(mca).filter(matchCli) })).filter((s) => s.cls.length > 0)
            const gt = arrIdx.map((mi) => sbuMarcas.reduce((s, mca) => s + arr27Total(mca, mi), 0))
            if (secciones.length === 0) return <div className="note warn">Aún no hay clientes para las marcas de esta SBU.</div>
            return (
              <div className="tablewrap" style={{ maxHeight: '62vh', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr><th className="l" rowSpan={2} style={STK}>Marca / Cliente</th><th rowSpan={2} style={STK}>Plazo (ventas 2028)</th><th colSpan={arrLbl.length + 1} style={{ ...STK, borderLeft: '3px solid var(--odoo)', background: '#faf7f9', color: 'var(--odoo)', textTransform: 'none', letterSpacing: 0 }}>📌 Saldo pendiente por cobrar del 2027 — ¿en qué mes de 2028 entra?</th></tr>
                    <tr>{arrLbl.map((m, i) => <th key={m} style={{ ...STK2, ...(i === 0 ? DIV : {}) }}>{m}</th>)}<th style={STK2}>Total</th></tr>
                  </thead>
                  <tbody>
                    {secciones.map(({ mca, cls }) => (
                      <Fragment2 key={mca}>
                        <tr className="sburow"><td className="l" style={{ color: marcaColor(mca) }}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: marcaColor(mca), marginRight: 7 }}></span>{mca}</td><td></td>{arrIdx.map((mi) => <td key={mi} className="tot" style={mi === 0 ? DIV : undefined}>{fmt(arr27Total(mca, mi))}</td>)}<td className="tot">{fmt(arrIdx.reduce((a, mi) => a + arr27Total(mca, mi), 0))}</td></tr>
                        {cls.map((cli) => { const tk = `TERM|${mca}|${cli}`; const inc = esIncobrable(mca, cli); return <tr key={mca + '|' + cli}><td className="l sub2" style={inc ? { color: '#b91c1c' } : undefined}>{cli}{inc && <span className="unit" style={{ marginLeft: 6, color: '#b91c1c' }}>⛔ incobrable</span>}</td><td>{data[tk] || '—'}</td>{arrIdx.map((mi) => <td key={mi} className="tot" style={{ ...(mi === 0 ? DIV : {}), ...(inc ? { color: '#b91c1c' } : {}) }}>{inc ? '—' : fmt(arr27(mca, cli, mi))}</td>)}<td className="tot" style={inc ? { color: '#b91c1c' } : undefined}>{inc ? '—' : fmt(arr27Cli(mca, cli))}</td></tr> })}
                      </Fragment2>
                    ))}
                    <tr className="grandrow"><td className="l">TOTAL {sbuLbl}</td><td></td>{gt.map((v, mi) => <td key={mi} className="tot" style={mi === 0 ? DIV : undefined}>{fmt(v)}</td>)}<td className="tot">{fmt(gt.reduce((a, b) => a + b, 0))}</td></tr>
                  </tbody>
                </table>
                <div className="sub" style={{ marginTop: 8 }}>🪞 Solo lectura. Entra al <b>Cash In</b> en el mes indicado. Para editar, entra a la marca.</div>
              </div>
            )
          }
          const cls = clientesDe(marca).filter(matchCli)
          return (
            <div className="tablewrap" style={{ maxHeight: '62vh', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr><th className="l" rowSpan={2} style={STK}>Cliente</th><th rowSpan={2} style={STK}>Plazo <span className="unit">(ventas 2028)</span></th><th colSpan={arrLbl.length + 1} style={{ ...STK, borderLeft: '3px solid var(--odoo)', background: '#faf7f9', color: 'var(--odoo)', textTransform: 'none', letterSpacing: 0 }}>📌 Saldo pendiente por cobrar del 2027 — ¿en qué mes de 2028 entra el cobro?</th></tr>
                  <tr>{arrLbl.map((m, i) => <th key={m} style={{ ...STK2, ...(i === 0 ? DIV : {}) }}>{m}</th>)}<th style={STK2}>Total</th></tr>
                </thead>
                <tbody>
                  {cls.length === 0 && <tr><td className="l" colSpan={9}>No hay clientes para {marca}. Carga el Histórico o captura clientes en Ventas.</td></tr>}
                  {cls.map((cli) => {
                    const tk = `TERM|${marca}|${cli}`; const inc = esIncobrable(marca, cli)
                    return (
                      <tr key={cli}>
                        <td className="l" style={inc ? { color: '#b91c1c' } : undefined}>{cli}{inc && <span className="unit" style={{ marginLeft: 6, color: '#b91c1c', fontWeight: 700 }}>⛔ incobrable</span>}</td>
                        <td>{soloVer ? (data[tk] || '—') : <select value={data[tk] ?? ''} onChange={(e) => set(tk, e.target.value)}><option value="">—</option>{CF_TERMINOS.map((t) => <option key={t}>{t}</option>)}</select>}</td>
                        {arrIdx.map((mi) => { const ck = arr27Key(marca, cli, mi); return <td key={mi} className={(soloVer || inc) ? 'tot' : 'cell'} style={{ ...(mi === 0 ? DIV : {}), ...(inc ? { background: '#fdecec' } : {}) }}>{inc ? <span style={{ color: '#d99a9a' }}>—</span> : soloVer ? fmt(num(data[ck])) : <input value={data[ck] ?? ''} onChange={(e) => set(ck, e.target.value)} inputMode="decimal" style={{ width: 64 }} />}</td> })}
                        <td className="tot" style={inc ? { color: '#b91c1c' } : undefined}>{inc ? '—' : fmt(arr27Cli(marca, cli))}</td>
                      </tr>
                    )
                  })}
                  {cls.length > 0 && <tr className="grandrow"><td className="l">TOTAL</td><td></td>{arrIdx.map((mi) => <td key={mi} className="tot" style={mi === 0 ? DIV : undefined}>{fmt(arr27Total(marca, mi))}</td>)}<td className="tot">{fmt(arrIdx.reduce((a, mi) => a + arr27Total(marca, mi), 0))}</td></tr>}
                </tbody>
              </table>
            </div>
          )
        })()}
      </div>

      <div className="panel">
        <h3>{role.label} — Mapa de cobros{M$} <span className="unit">(de dónde sale el Cash In · {isTotal ? `TOTAL ${sbuLbl}` : marca})</span></h3>
        <div className="sub">Cada mes el <b>Cash In</b> sale del <b style={{ color: '#b45309' }}>Saldo pendiente por cobrar del 2027</b> más las <b style={{ color: '#15803d' }}>ventas 2028</b>, y estas últimas <b>desglosadas por plazo</b> (Cash, 30, 60, 90… días) — como tu tabla de COBROS USD.</div>
        <div className="tablewrap">
          <table className="vfix"><colgroup><col style={{ width: '270px' }} />{CF_MESES.map((_, i) => <col key={i} style={{ width: '64px' }} />)}<col style={{ width: '80px' }} /></colgroup>
            <thead><tr><th className="l">Fuente del cobro</th>{CF_M2028.map((m) => <th key={m} className="yb">{m}</th>)}<th>Total</th></tr></thead>
            <tbody>
              {(() => {
                const arrM = (mi) => isTotal ? sbuMarcas.reduce((s, m) => s + arr27Total(m, mi), 0) : arr27Total(marca, mi)
                const termM = (t, mi) => isTotal ? sbuMarcas.reduce((s, m) => { const o = cobrosPorTerm(m)[t]; return s + (o ? o[mi] : 0) }, 0) : (() => { const o = cobrosPorTerm(marca)[t]; return o ? o[mi] : 0 })()
                const escM = (mi) => isTotal ? sbuMarcas.reduce((s, m) => s + getCobros(m).total[mi], 0) : getCobros(marca).total[mi]
                const terminos = CF_TERMINOS.filter((t) => t !== 'Intercompañía')
                const conDatos = terminos.filter((t) => CF_MESES.some((_, mi) => Math.abs(termM(t, mi)) > 0.5))
                return <Fragment2>
                  <tr><td className="l" style={{ color: '#b45309', whiteSpace: 'normal', lineHeight: 1.2 }}>Saldo pendiente por cobrar del 2027</td>{CF_MESES.map((_, mi) => <td key={mi} className="tot yb" style={{ color: '#b45309', cursor: 'help' }} title={`Fórmula: lo que quedó por cobrar del 2027, colocado por Finanzas en el mes que entra\nDatos de origen: saldo 2027 que entra en ${CF_M2028[mi]} = ${fmt(arrM(mi)) || '0'}`}>{fmt(arrM(mi))}</td>)}<td className="tot" style={{ color: '#b45309' }}>{fmt(CF_MESES.reduce((a, _, mi) => a + arrM(mi), 0))}</td></tr>
                  <tr className="secrow"><td colSpan={14}>Ventas 2028 cobradas por plazo</td></tr>
                  {(conDatos.length ? conDatos : ['Cash']).map((t) => { const P = CF_PLAZO_MESES[t] ?? 0; return <tr key={t}><td className="l sub2" style={{ color: '#15803d' }}>{t}</td>{CF_MESES.map((_, mi) => { const src = mi - P; const srcLbl = src >= 0 ? CF_M2028[src] : '—'; const tip = P === 0 ? `Fórmula: término ${t} = la venta externa se cobra el mismo mes\nDatos de origen: venta externa de ${CF_M2028[mi]} (clientes a ${t}) = ${fmt(termM(t, mi)) || '0'}` : `Fórmula: término ${t} = la venta externa de ${srcLbl} se cobra ${P} mes(es) después (en ${CF_M2028[mi]})\nDatos de origen: venta externa de ${srcLbl} (clientes a ${t}) = ${fmt(termM(t, mi)) || '0'}`; return <td key={mi} className="tot yb" style={{ color: '#15803d', cursor: 'help' }} title={tip}>{fmt(termM(t, mi))}</td> })}<td className="tot" style={{ color: '#15803d' }}>{fmt(CF_MESES.reduce((a, _, mi) => a + termM(t, mi), 0))}</td></tr> })}
                  <tr className="grandrow"><td className="l">= Cash In del mes</td>{CF_MESES.map((_, mi) => <td key={mi} className="tot" style={{ cursor: 'help' }} title={`Fórmula: Cash In = Saldo pendiente 2027 + Ventas 2028 cobradas por plazo\nDatos de origen: Saldo 2027 = ${fmt(arrM(mi)) || '0'} · Ventas 2028 = ${fmt(escM(mi)) || '0'} · Total = ${fmt(arrM(mi) + escM(mi)) || '0'}`}>{fmt(arrM(mi) + escM(mi))}</td>)}<td className="tot">{fmt(CF_MESES.reduce((a, _, mi) => a + arrM(mi) + escM(mi), 0))}</td></tr>
                </Fragment2>
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {!isTotal && (() => {
        const cls = clientesDe(marca).filter(matchCli)
        const uni = unidades2028(marca), aup = aupMarca(marca)
        const STKh = { position: 'sticky', top: 0, zIndex: 2, background: '#f7fafb' }
        const filas = cls.map((cli) => {
          const term = data[`TERM|${marca}|${cli}`]; const plazo = CF_PLAZO_MESES[term] ?? 0; const inc = esIncobrable(marca, cli)
          const ventas = MESES.map((_, m) => (uni[cli]?.[m] || 0) * (aup[m] || 0))
          const cobros = MESES.map((_, m) => { const src = m - plazo; return (src >= 0 && !inc) ? ventas[src] : 0 }) // cobro de ventas 2028 (interno no cobra)
          const arr = MESES.map((_, m) => arr27(marca, cli, m)) // arrastre 2027 colocado arriba
          let saldo = 0; const run = MESES.map((_, m) => { saldo = saldo + ventas[m] - cobros[m]; return saldo })
          return { cli, term, inc, ventas, cobros, arr, run }
        }).filter((f) => f.ventas.some((v) => v > 0.5) || f.arr.some((v) => v > 0.5))
        const totCobro = MESES.map((_, m) => filas.reduce((a, f) => a + f.cobros[m] + f.arr[m], 0))
        const showV = vistaCC === 'todo' || vistaCC === 'venta', showC = vistaCC === 'todo' || vistaCC === 'cobro', showS = vistaCC === 'todo' || vistaCC === 'saldo'
        return (
          <div className="panel">
            <h3>{role.label} — Venta, cobro y saldo por cliente 2028{M$} <span className="unit">({marca})</span></h3>
            <div className="sub">Por cada cliente: la <b>Venta</b> (Unid×AUP) en su mes, el <b>Cobro</b> de esas ventas cuando entra según su plazo, el <b style={{ color: '#b45309' }}>Cobro del saldo pendiente del 2027</b> ({soloVer ? 'lo que capturó Finanzas' : 'lo que colocaste arriba'}), y el <b>Saldo por cobrar</b> de 2028 que va quedando.{soloVer ? ' 🪞 Solo lectura.' : ''}</div>
            <div className="toolbar" style={{ margin: '4px 0 10px', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Ver:</span>
              {[['todo', 'Todo'], ['venta', 'Venta'], ['cobro', 'Cobro'], ['saldo', 'Saldo']].map(([k, lbl]) => <button key={k} className={'seg' + (vistaCC === k ? ' active' : '')} onClick={() => setVistaCC(k)}>{lbl}</button>)}
            </div>
            {buscador}
            <div className="tablewrap" style={{ maxHeight: '62vh', overflowY: 'auto' }}>
              <table className="vfix"><colgroup><col style={{ width: '260px' }} />{CF_M2028.map((_, i) => <col key={i} style={{ width: '64px' }} />)}<col style={{ width: '80px' }} /></colgroup>
                <thead><tr><th className="l" style={STKh}>Cliente / concepto</th>{CF_M2028.map((m) => <th key={m} style={STKh}>{m}</th>)}<th style={STKh}>Total</th></tr></thead>
                <tbody>
                  {filas.length === 0 && <tr><td className="l" colSpan={14}>Sin datos aún. Captura unidades (Ventas) y AUP (Producto), o el saldo pendiente 2027 arriba.</td></tr>}
                  {filas.map((f) => (
                    <Fragment2 key={f.cli}>
                      <tr className="secrow"><td className="l" colSpan={14}>{f.cli}{esNew(f.cli) && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: '#0e7490', border: '1px solid #0e7490', borderRadius: 4, padding: '0 4px', verticalAlign: 'middle' }} title="Cliente nuevo: sin histórico 2025/2026 (lo agregó Ventas)">NEW</span>} · {f.term || 'sin plazo'}{f.inc && <span style={{ color: '#b91c1c', marginLeft: 6 }}>⛔ incobrable</span>}</td></tr>
                      {showV && <tr><td className="l sub2">Venta (Unid×AUP)</td>{f.ventas.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(f.ventas.reduce((a, b) => a + b, 0))}</td></tr>}
                      {showC && <tr><td className="l sub2" style={{ color: '#15803d' }}>Cobro ventas 2028</td>{f.cobros.map((v, m) => <td key={m} className="tot" style={{ color: '#15803d' }}>{fmt(v)}</td>)}<td className="tot" style={{ color: '#15803d' }}>{fmt(f.cobros.reduce((a, b) => a + b, 0))}</td></tr>}
                      {showC && <tr><td className="l sub2" style={{ color: '#b45309' }}>Cobro saldo pendiente 2027</td>{f.arr.map((v, m) => <td key={m} className="tot" style={{ color: '#b45309' }}>{fmt(v)}</td>)}<td className="tot" style={{ color: '#b45309' }}>{fmt(f.arr.reduce((a, b) => a + b, 0))}</td></tr>}
                      {showS && <tr className="catrow"><td className="l">= Saldo por cobrar (2028)</td>{f.run.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td></td></tr>}
                    </Fragment2>
                  ))}
                  {filas.length > 0 && <tr className="grandrow"><td className="l">TOTAL COBROS del mes → Cash In</td>{totCobro.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(totCobro.reduce((a, b) => a + b, 0))}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

      {(() => {
        const SP = '#fde8cf' // color "término de la marca (pago a proveedor)"
        const listaM = isTotal ? sbuMarcas : [marca]
        const comprasX = MESES.map((_, m) => listaM.reduce((a, mca) => a + comprasUsdMes(mca)[m], 0)) // XFD
        const comprasD = MESES.map((_, m) => listaM.reduce((a, mca) => a + comprasUsdDisp(mca)[m], 0)) // disponible
        const compras = comprasX
        const pagos = MESES.map((_, m) => listaM.reduce((a, mca) => a + pagosMarca(mca).pagos[m], 0))
        const baseLbl = 'fecha XFD'
        const hayCorp = listaM.some((mca) => esCorpMarca(mca))
        const corpUnid = MESES.map((_, m) => listaM.reduce((a, mca) => a + (esCorpMarca(mca) ? comprasUdMes(mca)[m] : 0), 0))
        const corpPago = MESES.map((_, m) => listaM.reduce((a, mca) => a + corpPagoMes(mca)[m], 0))
        return (
          <div className="panel">
            <h3>{role.label} — Condiciones comerciales con la marca {isTotal ? `· TOTAL ${sbuLbl}` : `· ${marca}`}{M$} <span className="unit">(Cash Out)</span></h3>
            <div className="sub">La <b>compra 2028</b> se coloca por <b>fecha XFD</b>; la <b>disponible</b> = XFD + tránsito (se define en Producto · Paso 2). El <b>pago al proveedor</b> se calcula sobre la base que elijas (<b>XFD por defecto</b>) según el <b>término de pago de la marca</b> (Cash = mismo mes · 30d = +1 · 60 = +2 …). {hayCorp && <>Además, HOKA/UGG pagan una <b>comisión corporativa</b> de <b>$/ud sobre las compras</b>. </>}Todo alimenta el <b>Cash Out</b>.</div>
            {!isTotal && <div className="toolbar" style={{ marginBottom: 8, gap: 14, flexWrap: 'wrap' }}>
              <span><label>Término de pago de {marca} <span className="unit">(a proveedor)</span> </label>
              {soloVer ? <span className="empchip" style={{ background: SP, color: '#7a4a10' }}>{data[`PTERM|${marca}`] || '—'}</span> : <select value={data[`PTERM|${marca}`] ?? ''} onChange={(e) => set(`PTERM|${marca}`, e.target.value)} style={{ background: SP }}><option value="">—</option>{CF_TERMINOS.filter((t) => t !== 'Intercompañía').map((t) => <option key={t}>{t}</option>)}</select>}</span>
              <span className="unit" style={{ alignSelf: 'center' }}>Pago sobre <b>fecha XFD</b> · Tránsito de {marca}: <b>{transitOf(marca)}</b> mes(es) {ESP('El pago al proveedor se calcula siempre sobre la compra por fecha XFD. El tiempo de tránsito se define en Producto · Paso 2 (solo afecta la fecha disponible del inventario).')}</span>
              {esCorpMarca(marca) && <span><label>Comisión corporativa <span className="unit">($/ud sobre compras)</span> </label>{soloVer ? <span className="empchip" style={{ background: '#eef1f4', color: '#475569' }}>{data[`CORP|${marca}`] || '—'} $/ud</span> : <input className="fillin" value={data[`CORP|${marca}`] ?? ''} onChange={(e) => set(`CORP|${marca}`, e.target.value)} inputMode="decimal" placeholder="$/ud" style={{ width: 70 }} />}</span>}
            </div>}
            {isTotal && <div className="tablewrap" style={{ marginBottom: 12, maxWidth: 520 }}>
              <table style={{ width: 'auto' }}>
                <thead><tr><th className="l">Marca</th><th>Término de pago {ESP('Espejo: refleja el término que se capturó al entrar a cada marca. No se edita aquí.')}</th><th>Tránsito</th></tr></thead>
                <tbody>
                  {listaM.map((mca) => <tr key={mca}><td className="l"><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: marcaColor(mca), marginRight: 7 }}></span>{mca}</td><td><span className="empchip" style={{ background: '#eef1f4', color: '#475569', marginLeft: 0, border: '1px solid #dbe1e8' }}>{data[`PTERM|${mca}`] || '—'}</span></td><td className="tot">{transitOf(mca)} mes(es)</td></tr>)}
                </tbody>
              </table>
              <div className="sub" style={{ marginTop: 6 }}>🪞 <b>Espejo</b> (solo lectura): refleja el término que cada marca cargó a su proveedor; define <b>cuándo</b> la compra se convierte en pago (Cash Out). Se edita entrando a cada marca.</div>
            </div>}
            <div className="tablewrap">
              <table className="vfix"><colgroup><col style={{ width: '265px' }} />{MESES.map((_, i) => <col key={i} style={{ width: '64px' }} />)}<col style={{ width: '80px' }} /></colgroup>
                <thead><tr><th className="l">Concepto</th>{MESES.map((m) => <th key={m}>{m.toUpperCase()}</th>)}<th>Total</th></tr></thead>
                <tbody>
                  <tr><td className="l" style={{ whiteSpace: 'normal', lineHeight: 1.2 }}>Compra 2028 ($ · fecha XFD)</td>{comprasX.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(comprasX.reduce((a, b) => a + b, 0))}</td></tr>
                  <tr><td className="l sub2" style={{ whiteSpace: 'normal', lineHeight: 1.2 }}>Compra 2028 ($ · fecha disponible) <span className="unit">(XFD + tránsito)</span></td>{comprasD.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(comprasD.reduce((a, b) => a + b, 0))}</td></tr>
                  <tr className="catrow"><td className="l" style={{ whiteSpace: 'normal', lineHeight: 1.2 }}>Pago a proveedor <span className="unit">(según término · base {baseLbl})</span></td>{pagos.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(pagos.reduce((a, b) => a + b, 0))}</td></tr>
                  {hayCorp && <>
                    <tr><td className="l sub2">Compra en unidades <span className="unit">(HOKA/UGG)</span></td>{corpUnid.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(corpUnid.reduce((a, b) => a + b, 0))}</td></tr>
                    <tr className="catrow"><td className="l">Pago comisión corporativa <span className="unit">($/ud × compras)</span></td>{corpPago.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(corpPago.reduce((a, b) => a + b, 0))}</td></tr>
                  </>}
                  <tr className="grandrow"><td className="l">TOTAL Cash Out (pagos)</td>{MESES.map((_, m) => <td key={m} className="tot">{fmt(pagos[m] + corpPago[m])}</td>)}<td className="tot">{fmt(MESES.reduce((a, _, m) => a + pagos[m] + corpPago[m], 0))}</td></tr>
                </tbody>
              </table>
            </div>
            {compras.every((v) => !v) && <div className="sub" style={{ marginTop: 8 }}>Aún no hay compras. Captúralas en <b>Comercial → Producto → Inventario y compras</b> y el AUC en <b>Producto → AUC</b>.</div>}
          </div>
        )
      })()}
      {rubro.cash && (() => {
        // Espejo (solo lectura) del detalle de costos logísticos que llena Logística por marca (modelo de %).
        const listaL = isTotal ? sbuMarcas : [marca]
        const sMap = (fn) => MESES.map((_, m) => listaL.reduce((a, mca) => a + (fn(mca)[m] || 0), 0))
        const cvBase = sMap(logCostoVentaBase), cLog = sMap(logVentaMes)
        const cmpBase = sMap(comprasUsdMes), cMue = sMap(logMuestrasMes)
        const svBase = sMap(logSaldoValBase), cMant = sMap(logMantMes)
        const paraCF = MESES.map((_, m) => cLog[m] + cMue[m])
        const cTot = MESES.map((_, m) => cLog[m] + cMue[m] + cMant[m])
        const RT = (arr) => arr.reduce((a, b) => a + b, 0)
        const pl = (k) => isTotal ? '' : ` (× ${fmt(logPct(marca, k))}%)`
        return (
          <div className="panel">
            <h3>Costos logísticos — detalle {isTotal ? `· TOTAL ${sbuLbl}` : `· ${marca}`}{M$} <span className="unit">(🪞 espejo · lo llena Logística por marca)</span></h3>
            <div className="sub">Cálculo por <b>%</b> (los define <b>Logística</b> y aprueba Finanzas): <b>costo logístico de la venta</b> = % × costo de venta (unid×AUC); <b>muestras</b> = % × compras; <b>mantenimiento</b> = % × valor del saldo de inventario. El <b>total</b> alimenta la línea <b>Logística</b> de Costos Operativos (arriba).</div>
            {isTotal && <div className="tablewrap" style={{ marginBottom: 12, maxWidth: 560 }}>
              <table style={{ width: 'auto' }}>
                <thead><tr><th className="l">Marca</th><th>% venta</th><th>% muestras</th><th>% mant.</th></tr></thead>
                <tbody>{listaL.map((mca) => <tr key={mca}><td className="l"><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: marcaColor(mca), marginRight: 7 }}></span>{mca}</td><td className="tot">{fmt(logPct(mca, 'PCT_LOGVENTA'))}%</td><td className="tot">{fmt(logPct(mca, 'PCT_MUESTRAS'))}%</td><td className="tot">{fmt(logPct(mca, 'PCT_MANT'))}%</td></tr>)}</tbody>
              </table>
            </div>}
            <div className="tablewrap">
              <table className="vfix"><colgroup><col style={{ width: '285px' }} />{MESES.map((_, i) => <col key={i} style={{ width: '64px' }} />)}<col style={{ width: '80px' }} /></colgroup>
                <thead><tr><th className="l">Concepto</th>{MESES.map((m) => <th key={m}>{m.toUpperCase()}</th>)}<th>Total</th></tr></thead>
                <tbody>
                  <tr><td className="l sub2">Costo de venta ($) <span className="unit">(base)</span></td>{cvBase.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(RT(cvBase))}</td></tr>
                  <tr className="catrow"><td className="l">Costo logístico de la venta<span className="unit">{pl('PCT_LOGVENTA')}</span></td>{cLog.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(RT(cLog))}</td></tr>
                  <tr><td className="l sub2">Compras / movimiento ($) <span className="unit">(base)</span></td>{cmpBase.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(RT(cmpBase))}</td></tr>
                  <tr className="catrow"><td className="l" style={{ whiteSpace: 'normal', lineHeight: 1.2 }}>Costo de movimiento de muestras<span className="unit">{pl('PCT_MUESTRAS')}</span></td>{cMue.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(RT(cMue))}</td></tr>
                  <tr className="grandrow" style={{ background: '#eef6ff' }}><td className="l" style={{ whiteSpace: 'normal', lineHeight: 1.2 }}>Subtotal para Cash Flow <span className="unit">(venta + muestras)</span></td>{paraCF.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(RT(paraCF))}</td></tr>
                  <tr><td className="l sub2">Valor saldo inventario ($) <span className="unit">(base)</span></td>{svBase.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(RT(svBase))}</td></tr>
                  <tr className="catrow"><td className="l">Costo mantenimiento de stock<span className="unit">{pl('PCT_MANT')}</span></td>{cMant.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(RT(cMant))}</td></tr>
                  <tr className="grandrow"><td className="l">= Costo logístico TOTAL</td>{cTot.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(RT(cTot))}</td></tr>
                </tbody>
              </table>
            </div>
            {cTot.every((v) => !v) && <div className="sub" style={{ marginTop: 8 }}>Aún en cero: falta que <b>Logística</b> capture los % de {isTotal ? 'las marcas' : marca} (y que haya ventas/compras). Se aprueban en <b>Finanzas → Aprobaciones</b>.</div>}
          </div>
        )
      })()}
    </>
  )
}

/* Cálculo compartido del inventario por temporada, MENSUAL:
   saldo(mes) = saldo(mes-1) + compras(mes) − salidas(mes); salidas = (saldo previo + compras) × rotación%(mes). */
function invKeys(marca) {
  return { II: (s) => `II|${marca}|${s}`, CP: (s, m) => `CP|${marca}|${s}|${m}`, RT: (s, m) => `RT|${marca}|${s}|${m}` }
}
// Venta (unidades) por mes de una marca, desde las filas de Cap_Ventas (excluye VIAJES).
function ventaMarcaMes(rows, empresa, marca) {
  // Las unidades de venta nunca son negativas: Math.max(0,…) ignora cualquier valor basura.
  return MESES.map((_, m) => { let s = 0; (rows || []).forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(marca)) return; if (String(r[1] || '').toUpperCase().startsWith('VIAJES')) return; s += Math.max(0, num(r[4 + m])) }); return s })
}
// Modelo: el VENDEDOR manda el total del mes; Producto escribe DIRECTO las UNIDADES a rotar de cada temporada (RT).
// Salidas[temporada][mes] = unidades escritas, topadas por lo disponible (nunca se vende más de lo que hay en stock).
// ventaArr queda como parámetro histórico (ya no se usa para el cálculo de salidas).
function inventarioCalc(data, marca, ventaArr) {
  const g = (k) => num(data[k])
  const { II, CP, RT } = invKeys(marca)
  const tr = Math.max(0, Math.round(num(data[`TR|${marca}`]))) // la compra XFD queda disponible `tránsito` meses después
  const flujos = {}
  // Unidades SIEMPRE enteras: no se venden zapatillas partidas.
  // RT(s,m) = UNIDADES a rotar (vender) de esa temporada ese mes (las escribe Producto directo).
  // La salida se limita a lo disponible: nunca se vende más de lo que hay en stock ese mes.
  SEASONS.forEach((s) => { const arr = []; let saldo = Math.round(g(II(s))); for (let m = 0; m < 12; m++) { const ini = saldo; const comp = Math.round(m - tr >= 0 ? g(CP(s, m - tr)) : 0); const disp = ini + comp; const want = Math.max(0, Math.round(g(RT(s, m)))); const sal = Math.max(0, Math.min(disp, want)); const fin = disp - sal; arr.push({ ini, comp, sal, fin }); saldo = fin } flujos[s] = arr })
  const saldoUnits = MESES.map((_, m) => SEASONS.reduce((a, s) => a + flujos[s][m].fin, 0))
  const salidasUnits = MESES.map((_, m) => SEASONS.reduce((a, s) => a + flujos[s][m].sal, 0))
  return { flujos, saldoUnits, salidasUnits }
}

/* AUC de una temporada = lo que costó ese inventario al comprarlo: promedio de las
   categorías de esa temporada ponderado por las unidades disponibles (matriz de Producto). */
function seasonAUCfrom(precios, marca, s) {
  const pre = `INV|${marca}|${s}|`
  let inv = 0, val = 0
  Object.keys(precios || {}).forEach((k) => { if (k.indexOf(pre) !== 0) return; const cat = k.slice(pre.length); const q = num(precios[k]); inv += q; val += q * num(precios[`PAUC|${marca}|${s}|${cat}`]) })
  return inv ? val / inv : 0
}

/* ===== INVENTARIO POR TEMPORADA: captura matriz (Producto) + flujo/rotación (Logística) =====
   Modelo: categoría = nivel de precio/costo · temporada = antigüedad. AUP/AUC por categoría×temporada.
   Rotación = % mensual del saldo. Salidas = saldo × rotación. Saldo = inicial + compras − salidas.
   El AUP/AUC de la marca se mezcla según lo que se va vendiendo (categoría×temporada). */
function TemporadaForm({ empresa, fixedMarca, sbus, mode, tempState, setTempState, sinResumen, iiAuto }) {
  const marca = fixedMarca || marcasDe(sbus)[0]?.marca
  const stKey = `temp_${empresa}`
  const [dataInt, setDataInt] = useState(() => { try { return JSON.parse(localStorage.getItem(stKey) || '{}') } catch { return {} } })
  const data = tempState !== undefined ? tempState : dataInt
  const setData = setTempState || setDataInt
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [ventas, setVentas] = useState([])
  const [precios, setPrecios] = useState({})
  useEffect(() => { (async () => { try { const j = await gReadTab('Cap_Ventas'); if (j && j.ok && j.values) setVentas(j.values.slice(1)) } catch { } })(); try { setPrecios(JSON.parse(localStorage.getItem(`precios_${empresa}`) || '{}')) } catch { } }, [empresa])
  const saucSeason = (s) => seasonAUCfrom(precios, marca, s)
  const K = invKeys(marca)
  const set = (k, v) => setData((d) => ({ ...d, [k]: v }))
  function guardar() { setSaving(true); try { saveEstado(empresa, 'temp', data); setMsg({ t: 'ok', x: 'Guardado en Google Sheet (inventario).' }) } catch { setMsg({ t: 'bad', x: 'No se pudo guardar.' }) } setSaving(false) }
  const rowTot = (arr, key) => arr.reduce((a, x) => a + x[key], 0)
  // Venta proyectada (unidades del vendedor): es el TOTAL a vender del mes. Producto solo reparte de qué temporada sale.
  const ventaProyMes = MESES.map((_, m) => { let s = 0; ventas.forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(marca)) return; if (String(r[1] || '').toUpperCase().startsWith('VIAJES')) return; s += Math.max(0, num(r[4 + m])) }); return s })
  const { flujos, saldoUnits, salidasUnits } = inventarioCalc(data, marca, ventaProyMes)
  // Temporadas ACTIVAS: las temporadas de COMPRA 2028 (SS28/FW28) salen SIEMPRE —son las que se están comprando—
  // más cualquier temporada anterior que tenga saldo inicial o compras. Las de inventario vacías no se muestran.
  const activas = SEASONS.filter((s) => (BUY_SEASONS.includes(s) && s.endsWith('28')) || num(data[K.II(s)]) > 0 || MESES.some((_, m) => num(data[K.CP(s, m)]) > 0))
  const asignMes = salidasUnits // unidades ya asignadas (rotadas) por mes, sumando todas las temporadas (topadas por stock)

  if (mode === 'flow') {
    return (
      <div className="panel">
        <h3>Saldo de inventario por temporada — {marca}{UD} <span className="unit">(unidades · 👁️ del tracking de Producto)</span></h3>
        <div className="sub">Lo que va quedando sin rotar de cada temporada, mes a mes, <b>en unidades</b>. Alimenta el costo de mantenimiento. El valor en dinero está en la tabla de abajo.</div>
        <div className="tablewrap">
          <table className="vfix"><colgroup><col style={{ width: '150px' }} />{MESES.map((_, i) => <col key={i} style={{ width: '64px' }} />)}<col style={{ width: '80px' }} /></colgroup>
            <thead><tr><th className="l">Temporada</th>{MESES.map((m) => <th key={m}>{m.toUpperCase()}</th>)}<th>Fin año</th></tr></thead>
            <tbody>
              {activas.map((s) => <tr key={s}><td className="l">{s}</td>{flujos[s].map((x, i) => <td key={i} className="tot">{fmt(x.fin)}</td>)}<td className="tot">{fmt(flujos[s][11].fin)}</td></tr>)}
              <tr className="grandrow"><td className="l">Saldo total (ud)</td>{saldoUnits.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(saldoUnits[11])}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="sub" style={{ marginTop: 14, marginBottom: 6 }}><b>Valor del saldo</b>{M$} = saldo (ud) × AUC de cada temporada (lo pones en Producto → AUP/AUC).</div>
        <div className="tablewrap">
          <table className="vfix"><colgroup><col style={{ width: '150px' }} />{MESES.map((_, i) => <col key={i} style={{ width: '64px' }} />)}<col style={{ width: '80px' }} /></colgroup>
            <thead><tr><th className="l">Temporada · AUC</th>{MESES.map((m) => <th key={m}>{m.toUpperCase()}</th>)}<th>Fin año</th></tr></thead>
            <tbody>
              {activas.map((s) => { const a = saucSeason(s); return <tr key={s}><td className="l">{s} · ${fmt(a)}</td>{flujos[s].map((x, i) => <td key={i} className="tot">{fmt(x.fin * a)}</td>)}<td className="tot">{fmt(flujos[s][11].fin * a)}</td></tr> })}
              <tr className="grandrow"><td className="l">Valor total ($)</td>{MESES.map((_, m) => <td key={m} className="tot">{fmt(SEASONS.reduce((acc, s) => acc + flujos[s][m].fin * saucSeason(s), 0))}</td>)}<td className="tot">{fmt(SEASONS.reduce((acc, s) => acc + flujos[s][11].fin * saucSeason(s), 0))}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // mode = 'capture' (Producto → INVENTARIO COMPRAS): tracking mensual integrado por temporada
  return (
    <>
      {msg && <div className={'note ' + msg.t}>{msg.x}</div>}
      <div className="toolbar"><span className="empchip" style={{ marginLeft: 0, background: marcaColor(marca) }}>{marca}</span><div className="spacer"></div><button className="btn primary" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : '💾 Guardar'}</button></div>
      {!sinResumen && (() => {
        const res = SEASONS.map((s) => { const f = flujos[s]; const ini = num(data[K.II(s)]); const comp = rowTot(f, 'comp'); const vend = rowTot(f, 'sal'); return { s, ini, comp, disp: ini + comp, vend, queda: f[11].fin } })
        const T = res.reduce((a, r) => ({ ini: a.ini + r.ini, comp: a.comp + r.comp, disp: a.disp + r.disp, vend: a.vend + r.vend, queda: a.queda + r.queda }), { ini: 0, comp: 0, disp: 0, vend: 0, queda: 0 })
        return (
          <div className="panel">
            <h3>Resumen de inventario — {marca} <span className="unit">(👁️ cálculo)</span></h3>
            <div className="sub">De un vistazo: lo que <b>tienes disponible</b> (inicial + compras), lo que <b>vas a vender</b> (salidas) y lo que <b>te queda</b> a fin de año, por temporada y en total.</div>
            <div className="kpis" style={{ marginBottom: 12 }}>
              <div className="kpi"><div className="k">Inventario disponible</div><div className="v">{fmt(T.disp)}</div><div className="s">inicial {fmt(T.ini)} + compras {fmt(T.comp)}</div></div>
              <div className="kpi"><div className="k">Total a vender (salidas)</div><div className="v">{fmt(T.vend)}</div><div className="s">unidades del año</div></div>
              <div className="kpi"><div className="k">Saldo que queda (fin año)</div><div className="v">{fmt(T.queda)}</div><div className="s">sin rotar</div></div>
            </div>
            <div className="tablewrap"><table>
              <thead><tr><th className="l">Temporada</th><th>Inicial</th><th>Compras</th><th>Disponible</th><th>A vender</th><th>Queda (fin año)</th></tr></thead>
              <tbody>
                {res.map((r) => { const buy = BUY_SEASONS.includes(r.s); return <tr key={r.s}><td className="l">{r.s}</td><td className="tot">{fmt(r.ini)}</td>{buy ? <td className="tot">{fmt(r.comp)}</td> : <td className="tot" style={{ background: '#eef1f4', color: '#9aa3ad' }} title="Solo SS28/FW28 (compras 2028) pueden tener compras; las temporadas anteriores son saldo, no se compran">—</td>}<td className="tot">{fmt(r.disp)}</td><td className="tot">{fmt(r.vend)}</td><td className="tot">{fmt(r.queda)}</td></tr> })}
                <tr className="grandrow"><td className="l">TOTAL</td><td className="tot">{fmt(T.ini)}</td><td className="tot">{fmt(T.comp)}</td><td className="tot">{fmt(T.disp)}</td><td className="tot">{fmt(T.vend)}</td><td className="tot">{fmt(T.queda)}</td></tr>
              </tbody>
            </table></div>
          </div>
        )
      })()}
      <div className="panel">
        <h3>Combinación de temporadas — {marca} <span className="fill-badge">✏️ para llenar</span></h3>
        <div className="sub">El <b>vendedor manda el total a vender</b> de cada mes. Aquí Producto decide <b>cuántas unidades de cada temporada</b> cubren ese total: en cada mes escribe las <b>unidades a rotar</b> por temporada (p.ej. 500 de FW25). No puedes poner más de lo que hay en stock. La fila <b>«Por asignar»</b> te dice cuánto falta para llegar a la venta del mes, y <b>«Saldo por asignar»</b> debajo de cada temporada te muestra cuánto stock te queda de esa temporada. {iiAuto ? <>El <b>inventario inicial</b> viene de la matriz de arriba.</> : <>Pon también el <b>inventario inicial</b> y las <b>compras 2028</b>.</>}</div>
        <div className="tablewrap"><table className="vfix"><colgroup><col style={{ width: '300px' }} /><col style={{ width: '70px' }} />{MESES.map((_, i) => <col key={i} style={{ width: '64px' }} />)}<col style={{ width: '80px' }} /></colgroup>
          <thead><tr><th className="l">Temporada / concepto</th><th>Inicial</th>{MESES.map((m) => <th key={m}>{m.toUpperCase()}</th>)}<th>Total</th></tr></thead>
          <tbody>
            <tr className="secrow"><td colSpan={15}>VENTA DEL VENDEDOR vs COMBINACIÓN POR TEMPORADA</td></tr>
            <tr><td className="l sub2" style={{ whiteSpace: 'normal', lineHeight: 1.2 }}>Venta del mes (ud) <span className="unit">(la manda el vendedor)</span></td><td></td>{ventaProyMes.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(ventaProyMes.reduce((a, b) => a + b, 0))}</td></tr>
            <tr className="grandrow"><td className="l">Asignado del mes (ud) <span className="unit" style={{ fontWeight: 400 }}>(suma de las temporadas)</span></td><td></td>{asignMes.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(asignMes.reduce((a, b) => a + b, 0))}</td></tr>
            <tr className="grandrow"><td className="l" style={{ whiteSpace: 'normal', lineHeight: 1.2 }}>Por asignar (ud) <span className="unit" style={{ fontWeight: 400 }}>(venta − asignado; ✓ verde solo si cuadra exacto)</span></td><td></td>{MESES.map((_, m) => { const hay = ventaProyMes[m] > 0.5; const d = ventaProyMes[m] - asignMes[m]; const exacto = Math.abs(d) < 0.5; const sobra = d < -0.5; return <td key={m} className="tot" style={{ fontWeight: 800, color: !hay ? 'var(--muted)' : exacto ? 'var(--ok)' : 'var(--bad)' }} title={!hay ? 'Sin venta este mes' : exacto ? 'La venta del mes está cubierta exacto ✓' : sobra ? `Te pasaste: asignaste ${fmt(-d)} ud MÁS de lo que el vendedor va a vender este mes (${fmt(ventaProyMes[m])}). Baja la rotación.` : `Faltan ${fmt(d)} ud por asignar para cubrir la venta del mes.`}>{!hay ? '—' : fmt(d)}{hay && (exacto ? ' ✓' : ' ⚠')}</td> })}<td className="tot">{fmt(ventaProyMes.reduce((a, b) => a + b, 0) - asignMes.reduce((a, b) => a + b, 0))}</td></tr>
            {activas.length === 0 && <tr><td className="l" colSpan={15} style={{ color: 'var(--muted)' }}>Aún no hay temporadas con inventario. Carga el saldo inicial (Paso 1) o las compras 2028 (Paso 2) y aquí aparecerán las temporadas para repartir la venta.</td></tr>}
            {activas.map((s) => { const f = flujos[s]; const buy = BUY_SEASONS.includes(s); const ini0 = num(data[K.II(s)]); const disponible = ini0 + rowTot(f, 'comp'); const asignado = rowTot(f, 'sal'); const restante = f[11].fin; return (
              <Fragment2 key={s}>
                {buy && !iiAuto && <tr><td className="l sub2"><b style={{ color: '#0e7490' }}>{s}</b> · + Compras 2028</td><td></td>{MESES.map((_, m) => { const k = K.CP(s, m); return <td key={m} className="cell"><input value={data[k] ?? ''} onChange={(e) => set(k, e.target.value)} inputMode="decimal" /></td> })}<td className="tot">{fmt(rowTot(f, 'comp'))}</td></tr>}
                <tr><td className="l" style={{ whiteSpace: 'normal', lineHeight: 1.25 }}><b style={{ color: '#0e7490', fontSize: 12.5 }}>{s}</b> <span className="unit" style={{ fontWeight: 400 }}>· unidades a rotar{buy ? ' (compra 2028)' : ''}</span></td>{iiAuto ? <td className="tot" style={{ color: '#a0522d', fontWeight: 700 }} title="Inventario inicial (de la matriz de arriba)">{fmt(ini0)}</td> : <td className="cell"><input value={data[K.II(s)] ?? ''} onChange={(e) => set(K.II(s), e.target.value)} inputMode="decimal" placeholder={buy ? '0' : 'inicial'} /></td>}{MESES.map((_, m) => { const k = K.RT(s, m); const hay = ventaProyMes[m] > 0.5; const uds = num(data[k]); const dispM = Math.round(f[m].ini + f[m].comp); const otras = Math.max(0, asignMes[m] - f[m].sal); const topeVenta = Math.max(0, Math.round(ventaProyMes[m] - otras)); const tope = Math.min(dispM, topeVenta); const over = hay && uds > tope + 0.5; const porStock = tope >= dispM; return <td key={m} className={hay ? 'cell' : ''} style={hay ? (over ? { background: '#ffe0e0' } : undefined) : { background: '#f1f3f6' }} title={over ? `Escribiste ${fmt(uds)} ud de ${s}, pero el máximo aquí es ${fmt(tope)} (${porStock ? 'todo el stock disponible' : 'con eso ya cubres la venta del mes'}). Se topa a ${fmt(tope)}.` : (hay ? `Unidades de ${s} a vender este mes (máx ${fmt(tope)})` : 'Sin ventas este mes')}>{hay ? <input value={data[k] ?? ''} onChange={(e) => set(k, e.target.value)} onBlur={() => { const dM = Math.round(f[m].ini + f[m].comp); const otr = Math.max(0, asignMes[m] - f[m].sal); const tv = Math.max(0, Math.round(ventaProyMes[m] - otr)); const tp = Math.min(dM, tv); const cur = num(data[k]); if (cur > tp) { set(k, String(tp)); setMsg({ t: 'warn', x: `${s} · ${MESES[m].toUpperCase()}: bajé a ${fmt(tp)} ud — ${tp >= dM ? 'es todo el stock disponible de ' + s : 'con eso ya cubres la venta del mes (' + fmt(ventaProyMes[m]) + ')'}.` }) } }} inputMode="decimal" placeholder="ud" style={over ? { color: 'var(--bad)', fontWeight: 700 } : undefined} /> : <span style={{ display: 'inline-block', width: 64, color: '#aab2bc', textAlign: 'center', userSelect: 'none' }}>—</span>}</td> })}<td className="tot">{fmt(rowTot(f, 'sal'))}</td></tr>
                <tr className="catrow"><td className="l" style={{ whiteSpace: 'normal', lineHeight: 1.2 }}>Saldo por asignar (ud) <span className="unit" style={{ fontWeight: 400 }}>(lo que queda de {s})</span></td><td className="tot" style={{ fontWeight: 800, color: restante <= 0 ? 'var(--bad)' : 'var(--ok)' }} title={`De ${fmt(disponible)} disponibles ya asignaste ${fmt(asignado)}; quedan ${fmt(restante)} por vender`}>{fmt(restante)}</td>{f.map((x, m) => { return <td key={m} className="tot" style={{ color: x.fin <= 0 ? 'var(--bad)' : x.fin < x.ini * 0.15 ? 'var(--warn)' : undefined, fontWeight: x.fin <= 0 ? 800 : undefined }} title={`Disponible ${fmt(x.ini + x.comp)} - vendido ${fmt(x.sal)} = queda ${fmt(x.fin)}`}>{fmt(x.fin)}</td> })}<td className="tot">{fmt(f[11].fin)}</td></tr>
              </Fragment2>) })}
            <tr className="grandrow"><td className="l">Saldo total inventario</td><td></td>{saldoUnits.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(saldoUnits[11])}</td></tr>
          </tbody>
        </table></div>
      </div>
    </>
  )
}

/* ===== COSTOS LOGÍSTICOS: % sobre costo de venta, movimiento de muestras y saldo de inventario ===== */
function CostosLogisticos({ empresa, fixedMarca, sbus }) {
  const marca = fixedMarca || marcasDe(sbus)[0]?.marca
  const [tData, setTData] = useState({})
  const [ventas, setVentas] = useState([])
  const [producto, setProducto] = useState([])
  const [precios, setPrecios] = useState({})
  const stKey = `logcost_${empresa}`
  const [data, setData] = useState(() => { try { return JSON.parse(localStorage.getItem(stKey) || '{}') } catch { return {} } })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  useEffect(() => {
    try { setTData(JSON.parse(localStorage.getItem(`temp_${empresa}`) || '{}')) } catch { }
    try { setPrecios(JSON.parse(localStorage.getItem(`precios_${empresa}`) || '{}')) } catch { }
    ;(async () => {
      try { const j = await gReadTab('Cap_Ventas'); if (j && j.ok && j.values) setVentas(j.values.slice(1)) } catch { }
      try { const j2 = await gReadTab('Cap_Producto'); if (j2 && j2.ok && j2.values) setProducto(j2.values.slice(1)) } catch { }
    })()
  }, [empresa, marca])
  const inv = inventarioCalc(tData, marca, ventaMarcaMes(ventas, empresa, marca))
  const g = (k) => num(data[k]); const set = (k, v) => setData((d) => ({ ...d, [k]: v }))
  const auc = MESES.map((_, m) => { let v = 0; producto.forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(marca) || upper(r[1]) !== 'AUC') return; v = num(r[4 + m]) }); return v })
  const ventaUnits = MESES.map((_, m) => { let s = 0; ventas.forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(marca)) return; if (String(r[1] || '').toUpperCase().startsWith('VIAJES')) return; s += num(r[4 + m]) }); return s })
  const costoVenta = MESES.map((_, m) => ventaUnits[m] * auc[m])
  const comprasUsd = MESES.map((_, m) => SEASONS.reduce((a, s) => a + num(tData[`CP|${marca}|${s}|${m}`]), 0) * auc[m])
  // Valor del saldo = saldo de cada temporada × el AUC de esa temporada (lo que costó al comprarlo)
  const saldoValue = MESES.map((_, m) => SEASONS.reduce((a, s) => a + inv.flujos[s][m].fin * seasonAUCfrom(precios, marca, s), 0))
  const kLog = `${marca}|PCT_LOGVENTA`, kMue = `${marca}|PCT_MUESTRAS`, kMant = `${marca}|PCT_MANT`
  const costoLog = MESES.map((_, m) => costoVenta[m] * g(kLog) / 100)
  const costoMue = MESES.map((_, m) => comprasUsd[m] * g(kMue) / 100)
  const mant = MESES.map((_, m) => saldoValue[m] * g(kMant) / 100)
  const total = MESES.map((_, m) => costoLog[m] + costoMue[m] + mant[m])
  const rowTot = (arr) => arr.reduce((a, b) => a + b, 0)
  function guardar() { setSaving(true); try { saveEstado(empresa, 'logcost', data); setMsg({ t: 'ok', x: 'Guardado en Google Sheet (costos logísticos).' }) } catch { setMsg({ t: 'bad', x: 'No se pudo guardar.' }) } setSaving(false) }
  const aprobLog = (() => { try { return !!JSON.parse(localStorage.getItem(`aprob_${empresa}`) || '{}')[`LOGISTICA|${marca}`] } catch { return false } })()
  const pctInput = (k) => <input className={aprobLog ? '' : 'fillin'} value={data[k] ?? ''} onChange={(e) => set(k, e.target.value)} inputMode="decimal" placeholder="%" style={aprobLog ? { width: 60, textAlign: 'center', background: '#e6f4ea', border: '1px solid #bfe3c9', borderRadius: 6, padding: '6px 8px' } : { width: 60, textAlign: 'center' }} />

  return (
    <div className="panel">
      <div className="toolbar" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <span className="empchip" style={{ marginLeft: 0, background: marcaColor(marca) }}>{marca}</span>
        <label>% logístico venta</label>{pctInput(kLog)}
        <label>% muestras</label>{pctInput(kMue)}
        <label>% mantenimiento</label>{pctInput(kMant)}
        <div className="spacer"></div>
        <button className="btn primary" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : '💾 Guardar'}</button>
      </div>
      {msg && <div className={'note ' + msg.t}>{msg.x}</div>}
      <h3>Costos logísticos — {marca}{M$}{aprobLog ? <span className="empchip" style={{ marginLeft: 8, background: 'var(--ok)', fontSize: 11.5 }}>✓ Aprobado por Finanzas</span> : <span className="fill-badge">✏️ para llenar</span>}</h3>
      <div className="sub">Se calculan por <b>%</b>: costo logístico de venta = % × <b>costo de venta</b> (unidades × AUC); muestras = % × <b>compras</b>; mantenimiento = % × <b>valor del saldo de inventario</b>. Los tres % se ponen arriba.</div>
      <div className="tablewrap"><table className="vfix"><colgroup><col style={{ width: '230px' }} />{MESES.map((_, i) => <col key={i} style={{ width: '64px' }} />)}<col style={{ width: '80px' }} /></colgroup>
        <thead><tr><th className="l">Concepto</th>{MESES.map((m) => <th key={m}>{m.toUpperCase()}</th>)}<th>Total</th></tr></thead>
        <tbody>
          <tr><td className="l sub2">Costo de venta ($) <span className="unit">(base)</span></td>{costoVenta.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(rowTot(costoVenta))}</td></tr>
          <tr className="catrow"><td className="l">Costo logístico de la venta <span className="unit">(× {fmt(g(kLog))}%)</span></td>{costoLog.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(rowTot(costoLog))}</td></tr>
          <tr><td className="l sub2">Compras / movimiento ($) <span className="unit">(base)</span></td>{comprasUsd.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(rowTot(comprasUsd))}</td></tr>
          <tr className="catrow"><td className="l">Costo de muestras <span className="unit">(× {fmt(g(kMue))}%)</span></td>{costoMue.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(rowTot(costoMue))}</td></tr>
          <tr><td className="l sub2">Valor saldo inventario ($) <span className="unit">(base)</span></td>{saldoValue.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(rowTot(saldoValue))}</td></tr>
          <tr className="catrow"><td className="l">Costo mantenimiento de stock <span className="unit">(× {fmt(g(kMant))}%)</span></td>{mant.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(rowTot(mant))}</td></tr>
          <tr className="grandrow"><td className="l">TOTAL costos logísticos</td>{total.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(rowTot(total))}</td></tr>
        </tbody>
      </table></div>
    </div>
  )
}

/* ===== COMISIONES (Director): % por marca; venta externa de Comercial, interna de Retail (pendiente) ===== */
function ComisionesForm({ empresa, fixedMarca, sbus }) {
  const marca = fixedMarca || marcasDe(sbus)[0]?.marca
  const stKey = `comis_${empresa}`
  const [data, setData] = useState(() => { try { return JSON.parse(localStorage.getItem(stKey) || '{}') } catch { return {} } })
  const [ventas, setVentas] = useState([]); const [producto, setProducto] = useState([]); const [catList, setCatList] = useState([]); const [temp, setTemp] = useState({})
  const [saving, setSaving] = useState(false); const [msg, setMsg] = useState(null)
  useEffect(() => {
    try { setTemp(JSON.parse(localStorage.getItem(`temp_${empresa}`) || '{}')) } catch { }
    ;(async () => {
      try { const j = await gReadTab('Cap_Ventas'); if (j && j.ok && j.values) setVentas(j.values.slice(1)) } catch { }
      try { const j2 = await gReadTab('Cap_Producto'); if (j2 && j2.ok && j2.values) setProducto(j2.values.slice(1)) } catch { }
      try { const j3 = await gReadTab('Cap_Categorias'); if (j3 && j3.ok && j3.values) { const o = []; j3.values.slice(1).forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(marca)) return; if (r[1]) o.push({ cat: r[1], peso: num(r[4]) }) }); setCatList(o) } } catch { }
    })()
  }, [empresa, marca])
  const g = (k) => num(data[k]); const set = (k, v) => setData((d) => ({ ...d, [k]: v }))
  const rvc = realAupAuc(empresa, marca, ventas, producto, catList.map((c) => c.cat))
  const ventaExt = rvc.ventaMes
  const comprasUd = MESES.map((_, m) => SEASONS.reduce((a, s) => a + num(temp[`CP|${marca}|${s}|${m}`]), 0))
  const c = comisionCalc(marca, data, ventaExt)
  const rowTot = (arr) => arr.reduce((a, b) => a + b, 0)
  function guardar() { setSaving(true); try { saveEstado(empresa, 'comis', data); setMsg({ t: 'ok', x: 'Guardado en Google Sheet. Las comisiones de venta externa alimentan Comisiones del Cash Flow.' }) } catch { setMsg({ t: 'bad', x: 'No se pudo guardar.' }) } setSaving(false) }
  const pctRow = (kf, ph) => MESES.map((_, m) => { const k = kf(m); return <td key={m} className="cell"><input value={data[k] ?? ''} onChange={(e) => set(k, e.target.value)} inputMode="decimal" placeholder={ph} /></td> })

  return (
    <>
      {msg && <div className={'note ' + msg.t}>{msg.x}</div>}
      <div className="toolbar"><span className="empchip" style={{ marginLeft: 0, background: marcaColor(marca) }}>{marca}</span><div className="spacer"></div><button className="btn primary" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : '💾 Guardar'}</button></div>
      <div className="panel">
        <h3>Cálculo de comisiones — {marca}{M$}<span className="fill-badge">✏️ para llenar</span></h3>
        <div className="sub">El Director pone los <b>% mensuales</b>. La <b>venta externa</b> viene de Comercial (Unid×AUP); la <b>intercompañía</b> viene de Retail (pendiente). El <b>pago de comisión de venta externa</b> alimenta directamente la línea <b>Comisiones</b> del Cash Flow (parte de Costos Operativos).</div>
        <div className="tablewrap"><table className="vfix"><colgroup><col style={{ width: '230px' }} />{MESES.map((_, i) => <col key={i} style={{ width: '64px' }} />)}<col style={{ width: '80px' }} /></colgroup>
          <thead><tr><th className="l">Concepto</th>{MESES.map((m) => <th key={m}>{m.toUpperCase()}</th>)}<th>Total</th></tr></thead>
          <tbody>
            <tr className="secrow"><td colSpan={14}>VENTA EXTERNA</td></tr>
            <tr><td className="l sub2">Venta externa ($) <span className="unit">(Comercial)</span></td>{ventaExt.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(rowTot(ventaExt))}</td></tr>
            <tr><td className="l sub2">% comisión venta externa</td>{pctRow((m) => `PCTEXT|${marca}|${m}`, '%')}<td></td></tr>
            <tr className="catrow"><td className="l">Pago comisión venta externa → Cash Flow</td>{c.pagoExt.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(rowTot(c.pagoExt))}</td></tr>
            <tr className="secrow"><td colSpan={14}>VENTA INTERCOMPAÑÍA (RETAIL)</td></tr>
            <tr><td className="l sub2">Venta intercompañía ($) <span className="unit">(Retail · pendiente)</span></td>{c.ventaInt.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">0</td></tr>
            <tr><td className="l sub2">% comisión venta interna</td>{pctRow((m) => `PCTINT|${marca}|${m}`, '%')}<td></td></tr>
            <tr className="catrow"><td className="l">Pago comisión venta interna</td>{c.pagoInt.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(rowTot(c.pagoInt))}</td></tr>
            {esCorpMarca(marca) && <tr><td className="l" colSpan={14} style={{ color: 'var(--muted)', fontSize: 12 }}>ℹ️ La <b>comisión corporativa $/ud</b> sobre compras (HOKA/UGG) se movió a <b>Finanzas → Compras y pagos</b> y ahora es un <b>pago (Cash Out)</b>, no una comisión.</td></tr>}
            <tr className="grandrow"><td className="l">TOTAL comisiones</td>{c.total.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(rowTot(c.total))}</td></tr>
          </tbody>
        </table></div>
      </div>
    </>
  )
}

/* Resumen de inventario (cálculo) — se muestra al final, como cierre de la historia de Producto. */
function ResumenInventario({ marca, tempState, precios, empresa }) {
  const data = tempState || {}
  const [vista, setVista] = useState('ud') // ud | $ | ambas
  const [catList, setCatList] = useState([]); const [ventas, setVentas] = useState([])
  useEffect(() => { (async () => { try { const j = await gReadTab('Cap_Categorias'); if (j && j.ok && j.values) { const cl = []; j.values.slice(1).forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(marca)) return; if (r[1]) cl.push({ cat: r[1], peso: num(r[4]) }) }); setCatList(cl) } } catch { } try { const jv = await gReadTab('Cap_Ventas'); if (jv && jv.ok && jv.values) setVentas(jv.values.slice(1)) } catch { } })() }, [empresa, marca])
  const { flujos } = inventarioCalc(data, marca, ventaMarcaMes(ventas, empresa, marca))
  const rowTot = (arr, key) => arr.reduce((a, x) => a + x[key], 0)
  const seasonAUC = (s) => { let n = 0, d = 0; catList.forEach(({ cat, peso }) => { const a = num((precios || {})[`PAUC|${marca}|${s}|${cat}`]); const w = (num(peso) || 0) + 0.0001; if (a > 0) { n += a * w; d += w } }); return d ? n / d : 0 }
  const res = SEASONS.map((s) => { const f = flujos[s]; const ini = num(data[`II|${marca}|${s}`]); const comp = rowTot(f, 'comp'); const vend = rowTot(f, 'sal'); return { s, ini, comp, disp: ini + comp, vend, queda: f[11].fin, auc: seasonAUC(s) } })
  const T = res.reduce((a, r) => ({ ini: a.ini + r.ini, comp: a.comp + r.comp, disp: a.disp + r.disp, vend: a.vend + r.vend, queda: a.queda + r.queda, $ini: a.$ini + r.ini * r.auc, $comp: a.$comp + r.comp * r.auc, $disp: a.$disp + r.disp * r.auc, $vend: a.$vend + r.vend * r.auc, $queda: a.$queda + r.queda * r.auc }), { ini: 0, comp: 0, disp: 0, vend: 0, queda: 0, $ini: 0, $comp: 0, $disp: 0, $vend: 0, $queda: 0 })
  const C = (u, $) => vista === 'ud' ? fmt(u) : vista === '$' ? fmt($) : <>{fmt(u)}<div className="unit" style={{ fontSize: 10 }}>${fmt($)}</div></>
  return (
    <div className="panel">
      <div className="toolbar" style={{ marginBottom: 6, alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Resumen de inventario — {marca} <span className="unit">(👁️ cálculo)</span></h3>
        <div className="spacer"></div>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>VER:</span>
        {[['ud', 'Unidades'], ['$', 'Plata'], ['ambas', 'Ambas']].map(([k, lbl]) => <button key={k} className={'seg' + (vista === k ? ' active' : '')} onClick={() => setVista(k)}>{lbl}</button>)}
      </div>
      <div className="sub">De un vistazo: lo que <b>tienes disponible</b> (inicial + compras), lo que <b>vas a vender</b> (salidas) y lo que <b>te queda</b> a fin de año, por temporada y en total. Plata = unidades × AUC de compra de la temporada.</div>
      <div className="kpis" style={{ marginBottom: 12 }}>
        <div className="kpi"><div className="k">Inventario disponible {vista === '$' ? '($)' : vista === 'ambas' ? '(ud · $)' : '(ud)'}</div><div className="v">{vista === '$' ? '$' + fmt(T.$disp) : fmt(T.disp)}</div><div className="s">inicial {fmt(T.ini)} + compras {fmt(T.comp)}</div></div>
        <div className="kpi"><div className="k">Total a vender (salidas)</div><div className="v">{vista === '$' ? '$' + fmt(T.$vend) : fmt(T.vend)}</div><div className="s">unidades del año</div></div>
        <div className="kpi"><div className="k">Saldo que queda (fin año)</div><div className="v">{vista === '$' ? '$' + fmt(T.$queda) : fmt(T.queda)}</div><div className="s">sin rotar</div></div>
      </div>
      <div className="tablewrap"><table>
        <thead><tr><th className="l">Temporada</th><th>Inicial</th><th>Compras</th><th>Disponible</th><th>A vender</th><th>Queda (fin año)</th></tr></thead>
        <tbody>
          {res.map((r) => { const buy = BUY_SEASONS.includes(r.s); return <tr key={r.s}><td className="l">{r.s}</td><td className="tot">{C(r.ini, r.ini * r.auc)}</td>{buy ? <td className="tot">{C(r.comp, r.comp * r.auc)}</td> : <td className="tot" style={{ background: '#eef1f4', color: '#9aa3ad' }} title="Solo SS28/FW28/SS29 (compras 2028) pueden tener compras; las temporadas anteriores son saldo, no se compran">—</td>}<td className="tot">{C(r.disp, r.disp * r.auc)}</td><td className="tot">{C(r.vend, r.vend * r.auc)}</td><td className="tot">{C(r.queda, r.queda * r.auc)}</td></tr> })}
          <tr className="grandrow"><td className="l">TOTAL</td><td className="tot">{C(T.ini, T.$ini)}</td><td className="tot">{C(T.comp, T.$comp)}</td><td className="tot">{C(T.disp, T.$disp)}</td><td className="tot">{C(T.vend, T.$vend)}</td><td className="tot">{C(T.queda, T.$queda)}</td></tr>
        </tbody>
      </table></div>
    </div>
  )
}

/* ===== PRODUCTO (una sola pestaña): Inventario y rotación → Precios por temporada×categoría → Evolución mensual → Resumen.
   Comparten el estado del inventario (temp) para que la evolución reaccione en vivo al editar la rotación. */
function ProductoTab({ empresa, usuario, sbus, fixedMarca }) {
  const marca = fixedMarca || marcasDe(sbus)[0]?.marca
  const [temp, setTemp] = useState(() => { try { return JSON.parse(localStorage.getItem(`temp_${empresa}`) || '{}') } catch { return {} } })
  const [precios, setPrecios] = useState(() => { try { return JSON.parse(localStorage.getItem(`precios_${empresa}`) || '{}') } catch { return {} } })
  useEffect(() => { try { setTemp(JSON.parse(localStorage.getItem(`temp_${empresa}`) || '{}')) } catch { } try { setPrecios(JSON.parse(localStorage.getItem(`precios_${empresa}`) || '{}')) } catch { } }, [empresa])
  // El saldo inicial por temporada (II) se calcula solo = suma de unidades de la matriz (precios). Así no se duplica.
  useEffect(() => {
    setTemp((t) => {
      const next = { ...t }; let changed = false
      SEASONS.forEach((s) => { const pre = `INV|${marca}|${s}|`; let sum = 0; Object.keys(precios).forEach((k) => { if (k.indexOf(pre) === 0) sum += num(precios[k]) }); const key = `II|${marca}|${s}`; if (num(next[key]) !== sum) { next[key] = sum; changed = true } })
      return changed ? next : t
    })
  }, [precios, marca])
  return (
    <>
      <div className="note ok" style={{ marginBottom: 8 }}>Producto en un solo lugar y en orden: <b>1)</b> Inventario + costo + precio por temporada y categoría · <b>2)</b> Compras 2028 y disponibilidad (SS28/FW28) · <b>3)</b> Combinación de temporadas (unidades por mes) — el saldo inicial se toma solo del paso 1 · <b>4)</b> Evolución mensual del AUP/AUC (consecuencia) · <b>5)</b> Resumen. Guarda cada paso con sus botones.</div>
      <div style={{ borderLeft: '4px solid #017e84', paddingLeft: 14, marginBottom: 26 }}>
        <div style={{ fontWeight: 800, color: '#017e84', fontSize: 15, marginBottom: 8 }}>Paso 1 · Inventario, costo y precio por temporada y categoría</div>
        <PreciosMargenForm empresa={empresa} usuario={usuario} sbus={sbus} fixedMarca={fixedMarca} tempState={temp} snapState={precios} setSnapState={setPrecios} render="matriz" />
      </div>
      <div style={{ borderLeft: '4px solid #017e84', paddingLeft: 14, marginBottom: 26 }}>
        <div style={{ fontWeight: 800, color: '#017e84', fontSize: 15, marginBottom: 8 }}>Paso 2 · Compras 2028 y disponibilidad (SS28 / FW28)</div>
        <ComprasXFDStep empresa={empresa} marca={marca} temp={temp} setTemp={setTemp} precios={precios} />
      </div>
      <div style={{ borderLeft: '4px solid #017e84', paddingLeft: 14, marginBottom: 26 }}>
        <div style={{ fontWeight: 800, color: '#017e84', fontSize: 15, marginBottom: 8 }}>Paso 3 · Combinación de temporadas (unidades por mes)</div>
        <TemporadaForm empresa={empresa} sbus={sbus} fixedMarca={fixedMarca} mode="capture" tempState={temp} setTempState={setTemp} sinResumen iiAuto />
      </div>
      <div style={{ borderLeft: '4px solid #017e84', paddingLeft: 14, marginBottom: 26 }}>
        <div style={{ fontWeight: 800, color: '#017e84', fontSize: 15, marginBottom: 8 }}>Paso 4 · Evolución mensual del AUP/AUC (consecuencia)</div>
        <PreciosMargenForm empresa={empresa} usuario={usuario} sbus={sbus} fixedMarca={fixedMarca} tempState={temp} snapState={precios} setSnapState={setPrecios} render="evolucion" />
      </div>
      <div style={{ borderLeft: '4px solid #017e84', paddingLeft: 14 }}>
        <div style={{ fontWeight: 800, color: '#017e84', fontSize: 15, marginBottom: 8 }}>Paso 5 · Resumen de inventario</div>
        <ResumenInventario marca={marca} tempState={temp} precios={precios} empresa={empresa} />
      </div>
    </>
  )
}

/* ===== Paso 4: compras 2028 (Producto captura unidades a comprar por XFD: SS28 ene–jun, FW28 jul–dic)
   → disponible = XFD + tránsito → flujo de inventario 2028 (inicial + compras − ventas = saldo). ===== */
function ComprasXFDStep({ empresa, marca, temp, setTemp, precios }) {
  const [saving, setSaving] = useState(false); const [msg, setMsg] = useState(null)
  const [vista, setVista] = useState('ud') // ud | $ | ambas
  const [ventas, setVentas] = useState([]); const [producto, setProducto] = useState([]); const [catList, setCatList] = useState([])
  useEffect(() => {
    (async () => {
      try { const j = await gReadTab('Cap_Ventas'); if (j && j.ok && j.values) setVentas(j.values.slice(1)) } catch { }
      try { const j2 = await gReadTab('Cap_Producto'); if (j2 && j2.ok && j2.values) setProducto(j2.values.slice(1)) } catch { }
      try { const j3 = await gReadTab('Cap_Categorias'); if (j3 && j3.ok && j3.values) { const cl = []; j3.values.slice(1).forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(marca)) return; if (r[1]) cl.push({ cat: r[1], peso: num(r[4]) }) }); setCatList(cl) } } catch { }
    })()
  }, [empresa, marca])
  const tr = Math.max(0, Math.round(num(temp[`TR|${marca}`])))
  const seasonOf = (m) => m < 6 ? 'SS28' : m < 10 ? 'FW28' : 'SS29' // ene–jun = SS28 · jul–oct = FW28 · nov–dic = SS29
  const cpKey = (m) => `CP|${marca}|${seasonOf(m)}|${m}`
  const setCP = (m, v) => setTemp((t) => ({ ...t, [cpKey(m)]: v }))
  const xfd = MESES.map((_, m) => num(temp[cpKey(m)]))
  const disp = MESES.map((_, m) => (m - tr >= 0 ? xfd[m - tr] : 0))
  // Inventario inicial 2028 = saldo de arranque de TODAS las temporadas anteriores ya cargadas (Otros…FW27).
  const ini2028 = INV_SEASONS.reduce((a, s) => a + num(temp[`II|${marca}|${s}`]), 0)
  const aucEff = MESES.map((_, m) => { let v = 0; producto.forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(marca) || upper(r[1]) !== 'AUC') return; v = num(r[4 + m]) }); return v })
  // AUC de compra por temporada (de la matriz de Producto · Paso 1, ponderado por peso de categoría). Valoriza las compras aunque no haya ventas ese mes.
  const seasonAUCbuy = (s) => { let n = 0, d = 0; catList.forEach(({ cat, peso }) => { const a = num((precios || {})[`PAUC|${marca}|${s}|${cat}`]); const w = (num(peso) || 0) + 0.0001; if (a > 0) { n += a * w; d += w } }); return d ? n / d : 0 }
  const auc = MESES.map((_, m) => seasonAUCbuy(seasonOf(m)) || aucEff[m])
  const ventasU = MESES.map((_, m) => { let s = 0; ventas.forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(marca)) return; if (String(r[1] || '').toUpperCase().startsWith('VIAJES')) return; s += num(r[4 + m]) }); return s })
  const saldoIni = []; const saldoFin = []; { let prev = ini2028; MESES.forEach((_, m) => { const ini = prev; const fin = ini + disp[m] - ventasU[m]; saldoIni.push(ini); saldoFin.push(fin); prev = fin }) }
  // Composición del inventario inicial de enero (por temporada anterior) para el tooltip.
  const iniComp = INV_SEASONS.map((s) => ({ s, v: Math.round(num(temp[`II|${marca}|${s}`])) })).filter((x) => x.v > 0)
  const iniCompStr = iniComp.length ? iniComp.map((x) => `${x.s}: ${fmt(x.v)}`).join(' · ') : 'sin saldo de temporadas anteriores'
  const RT = (arr) => arr.reduce((a, b) => a + b, 0)
  const money = (arr) => arr.map((v, m) => v * auc[m])
  function guardar() { setSaving(true); try { saveEstado(empresa, 'temp', temp); setMsg({ t: 'ok', x: 'Guardado (compras y tránsito).' }) } catch { setMsg({ t: 'bad', x: 'No se pudo guardar.' }) } setSaving(false) }
  // Celda calculada según la vista (unidades / plata / ambas)
  const cCell = (units, m) => { const u = units[m]; const $ = u * auc[m]; if (vista === 'ud') return fmt(u); if (vista === '$') return fmt($); return <>{fmt(u)}<div className="unit" style={{ fontSize: 10 }}>${fmt($)}</div></> }
  const cTot = (units) => { const u = RT(units); const $ = RT(money(units)); if (vista === 'ud') return fmt(u); if (vista === '$') return fmt($); return <>{fmt(u)}<div className="unit" style={{ fontSize: 10 }}>${fmt($)}</div></> }
  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 8, gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label>Tiempo de tránsito de {marca} <span className="unit">(entre XFD y disponible)</span></label>
        <select className="fillin" value={temp[`TR|${marca}`] ?? '0'} onChange={(e) => setTemp((t) => ({ ...t, [`TR|${marca}`]: e.target.value }))} style={{ minWidth: 120, fontWeight: 700 }}><option value="0">Sin tránsito</option><option value="1">30 días</option><option value="2">60 días</option><option value="3">90 días</option></select>
        <span className="fill-badge">✏️</span>
        <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>VER:</span>
        {[['ud', 'Unidades'], ['$', 'Plata'], ['ambas', 'Ambas']].map(([k, lbl]) => <button key={k} className={'seg' + (vista === k ? ' active' : '')} onClick={() => setVista(k)}>{lbl}</button>)}
        <div className="spacer"></div>
        <button className="btn primary" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : '💾 Guardar'}</button>
      </div>
      {msg && <div className={'note ' + msg.t}>{msg.x}</div>}
      <div className="sub">Escribe las <b>unidades a comprar</b> por mes en la fila amarilla (fecha <b>XFD</b>): de <b>ene a jun = SS28</b>, de <b>jul a oct = FW28</b> y de <b>nov a dic = SS29</b> (ya empieza la compra de la próxima temporada). La <b>disponible</b> = XFD + <b>{tr}</b> mes(es) de tránsito. Abajo, cada mes: <b>inventario inicial del mes + compras disponibles − ventas = saldo fin de mes</b>. El inicial de enero es el saldo de todas las temporadas anteriores (Otros…FW27): <b>{fmt(ini2028)} ud</b>. Plata = unidades × AUC.</div>
      <div className="tablewrap"><table className="vfix gridcols"><colgroup><col style={{ width: '250px' }} />{MESES.map((_, i) => <col key={i} style={{ width: '66px' }} />)}<col style={{ width: '84px' }} /></colgroup>
        <thead>
          <tr><th className="l">Concepto</th>{MESES.map((m, i) => <th key={m}>{m.slice(0, 3).toUpperCase()}</th>)}<th>Total</th></tr>
          <tr><th className="l" style={{ fontWeight: 600, color: 'var(--muted)' }}>Temporada de compra</th>{MESES.map((_, i) => { const lbl = i === 0 ? 'SS28' : i === 6 ? 'FW28' : i === 10 ? 'SS29' : ''; return <th key={i} style={{ fontWeight: 800, color: '#b45309' }}>{lbl}</th> })}<th></th></tr>
        </thead>
        <tbody>
          <tr><td className="l">Compras a comprar · <b>XFD</b> <span className="unit">({vista === 'ud' ? 'unidades' : vista === '$' ? 'plata' : 'ud · $'})</span> {vista === 'ud' && <span className="fill-badge" style={{ marginLeft: 4 }}>✏️</span>}</td>{MESES.map((_, m) => vista === 'ud' ? <td key={m} className="cell"><input value={temp[cpKey(m)] ?? ''} onChange={(e) => setCP(m, e.target.value)} inputMode="decimal" style={{ width: '100%' }} /></td> : <td key={m} className="tot">{cCell(xfd, m)}</td>)}<td className="tot">{vista === 'ud' ? fmt(RT(xfd)) : cTot(xfd)}</td></tr>
          <tr className="catrow"><td className="l">Compras · disponible <span className="unit">(XFD + tránsito)</span></td>{MESES.map((_, m) => <td key={m} className="tot">{cCell(disp, m)}</td>)}<td className="tot">{cTot(disp)}</td></tr>
          <tr className="secrow"><td colSpan={14}>Flujo de inventario 2028 (todas las temporadas)</td></tr>
          <tr><td className="l sub2">Inventario inicial del mes</td>{MESES.map((_, m) => <td key={m} className="tot" style={{ cursor: 'help' }} title={m === 0 ? `Inventario inicial de enero = saldo de temporadas anteriores → ${iniCompStr} = ${fmt(ini2028)} ud` : `Saldo fin de ${MESES[m - 1].slice(0, 3).toUpperCase()}: inicial ${fmt(saldoIni[m - 1])} + compras ${fmt(disp[m - 1])} − ventas ${fmt(ventasU[m - 1])} = ${fmt(saldoIni[m])} ud`}>{cCell(saldoIni, m)}</td>)}<td className="tot"></td></tr>
          <tr><td className="l sub2" style={{ color: '#15803d' }}>(+) Compras disponibles</td>{MESES.map((_, m) => <td key={m} className="tot" style={{ color: '#15803d' }}>{cCell(disp, m)}</td>)}<td className="tot" style={{ color: '#15803d' }}>{cTot(disp)}</td></tr>
          <tr><td className="l sub2" style={{ color: '#b91c1c' }}>(−) Ventas 2028</td>{MESES.map((_, m) => <td key={m} className="tot" style={{ color: '#b91c1c' }}>{cCell(ventasU, m)}</td>)}<td className="tot" style={{ color: '#b91c1c' }}>{cTot(ventasU)}</td></tr>
          <tr className="grandrow"><td className="l">= Saldo inventario fin de mes</td>{MESES.map((_, m) => <td key={m} className="tot">{cCell(saldoFin, m)}</td>)}<td className="tot">{vista === '$' ? fmt(saldoFin[11] * (auc[11] || 0)) : fmt(saldoFin[11])}</td></tr>
        </tbody>
      </table></div>
      {RT(xfd) === 0 && <div className="sub" style={{ marginTop: 8 }}>Aún no hay compras. Escribe las unidades a comprar por mes en la fila <b>XFD</b> y pulsa 💾 Guardar.</div>}
    </div>
  )
}

/* ===== AUP / AUC / MARGEN: captura junta + efectivo por temporada (rotación del inventario) ===== */
function PreciosMargenForm({ empresa, usuario, sbus, fixedMarca, tempState, snapState, setSnapState, render = 'all' }) {
  const marca = fixedMarca || marcasDe(sbus)[0]?.marca
  const sbu = sbuDe(sbus, marca) || ''
  const [catList, setCatList] = useState([{ cat: 'General', peso: 0 }])
  const [tempInt, setTempInt] = useState({})
  const temp = tempState !== undefined ? tempState : tempInt
  const [snapInt, setSnapInt] = useState(() => { try { return JSON.parse(localStorage.getItem(`precios_${empresa}`) || '{}') } catch { return {} } })
  const snap = snapState !== undefined ? snapState : snapInt
  const setSnap = setSnapState || setSnapInt
  const showMatriz = render === 'all' || render === 'matriz'
  const showEvol = render === 'all' || render === 'evolucion'
  const [saving, setSaving] = useState(false); const [msg, setMsg] = useState(null)
  const [ventasRows, setVentasRows] = useState([]); const [catBuscar, setCatBuscar] = useState('')
  useEffect(() => {
    try { setTempInt(JSON.parse(localStorage.getItem(`temp_${empresa}`) || '{}')) } catch { }
    ;(async () => {
      let cl = []
      try { const j = await gReadTab('Cap_Categorias'); if (j && j.ok && j.values) j.values.slice(1).forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(marca)) return; if (r[1] && !cl.some((x) => x.cat === r[1])) cl.push({ cat: r[1], peso: num(r[4]) }) }) } catch { }
      setCatList(cl.length ? cl : [{ cat: 'General', peso: 0 }])
      try { const jv = await gReadTab('Cap_Ventas'); if (jv && jv.ok && jv.values) setVentasRows(jv.values.slice(1)) } catch { }
    })()
  }, [empresa, marca])
  const sg = (k) => num(snap[k]); const sset = (k, v) => setSnap((s) => ({ ...s, [k]: v }))
  const cats = catList.map((c) => c.cat)
  // Matriz temporada × categoría: inventario disponible (ud), AUC y AUP por celda
  const kINV = (s, c) => `INV|${marca}|${s}|${c}`, kAUC = (s, c) => `PAUC|${marca}|${s}|${c}`, kAUP = (s, c) => `PAUP|${marca}|${s}|${c}`
  // Compra proyectada 2028 por temporada (viene del Paso 4 · CP por mes) + repartir por categoría (peso del Director)
  const compraSeason = (s) => MESES.reduce((a, _, m) => a + num(temp[`CP|${marca}|${s}|${m}`]), 0)
  // Reparte la compra de la temporada entre categorías por su peso, con redondeo de MAYOR RESTO
  // para que las unidades enteras por categoría sumen EXACTAMENTE la compra (sin perder/ganar 1 por redondeo).
  const compraDist = (s) => {
    const total = Math.round(compraSeason(s))
    const den = catList.reduce((a, o) => a + num(o.peso), 0)
    const rows = catList.map((o) => { const exact = den > 0 ? total * num(o.peso) / den : (catList.length ? total / catList.length : 0); return { cat: o.cat, u: Math.floor(exact), rem: exact - Math.floor(exact) } })
    let left = total - rows.reduce((a, r) => a + r.u, 0)
    ;[...rows].sort((a, b) => b.rem - a.rem).forEach((r) => { if (left > 0) { r.u++; left-- } })
    const map = {}; rows.forEach((r) => { map[r.cat] = r.u }); return map
  }
  const compraCat = (s, c) => compraDist(s)[c] || 0
  // Para SS28/FW28/SS29 las unidades vienen de las compras del Paso 4 (repartidas por peso); para temporadas anteriores, del saldo capturado en la matriz.
  const invSC = (s, c) => BUY_SEASONS.includes(s) ? compraCat(s, c) : sg(kINV(s, c)), aucSC = (s, c) => sg(kAUC(s, c)), aupSC = (s, c) => sg(kAUP(s, c))
  // Ponderado 2028 por categoría (a través de todas las temporadas, ponderado por inventario disponible)
  const invCat = (c) => SEASONS.reduce((a, s) => a + invSC(s, c), 0)
  const aupPondCat = (c) => { const w = invCat(c); return w ? SEASONS.reduce((a, s) => a + invSC(s, c) * aupSC(s, c), 0) / w : 0 }
  const aucPondCat = (c) => { const w = invCat(c); return w ? SEASONS.reduce((a, s) => a + invSC(s, c) * aucSC(s, c), 0) / w : 0 }
  const invTot = cats.reduce((a, c) => a + invCat(c), 0)
  const aupPondMarca = invTot ? cats.reduce((a, c) => a + invCat(c) * aupPondCat(c), 0) / invTot : 0
  const aucPondMarca = invTot ? cats.reduce((a, c) => a + invCat(c) * aucPondCat(c), 0) / invTot : 0
  // Temporada ponderada por categoría (para el efectivo por mes según rotación)
  const invSeason = (s) => cats.reduce((a, c) => a + invSC(s, c), 0)
  const seasonAUP = (s) => { const w = invSeason(s); return w ? cats.reduce((a, c) => a + invSC(s, c) * aupSC(s, c), 0) / w : 0 }
  const seasonAUC = (s) => { const w = invSeason(s); return w ? cats.reduce((a, c) => a + invSC(s, c) * aucSC(s, c), 0) / w : 0 }
  const inv = inventarioCalc(temp, marca, ventaMarcaMes(ventasRows, empresa, marca))
  const salM = (s, m) => inv.flujos[s][m].sal
  const ventaMes = (m) => SEASONS.reduce((a, s) => a + salM(s, m) * seasonAUP(s), 0)
  const costoMes = (m) => SEASONS.reduce((a, s) => a + salM(s, m) * seasonAUC(s), 0)
  const unitsMes = (m) => SEASONS.reduce((a, s) => a + salM(s, m), 0)
  const aupEff = (m) => { const u = unitsMes(m); return u ? ventaMes(m) / u : 0 }
  const aucEff = (m) => { const u = unitsMes(m); return u ? costoMes(m) / u : 0 }
  // Efectivo MENSUAL por categoría: qué temporadas rotan cada mes define el AUP/AUC de ese mes (evolución)
  const splitSC = (s, c) => { const w = invSeason(s); return w ? invSC(s, c) / w : 0 }
  const unitsCatMes = (c, m) => SEASONS.reduce((a, s) => a + salM(s, m) * splitSC(s, c), 0)
  const ventaCatMes = (c, m) => SEASONS.reduce((a, s) => a + salM(s, m) * splitSC(s, c) * aupSC(s, c), 0)
  const costoCatMes = (c, m) => SEASONS.reduce((a, s) => a + salM(s, m) * splitSC(s, c) * aucSC(s, c), 0)
  const aupCatMes = (c, m) => { const u = unitsCatMes(c, m); return u ? ventaCatMes(c, m) / u : 0 }
  const aucCatMes = (c, m) => { const u = unitsCatMes(c, m); return u ? costoCatMes(c, m) / u : 0 }
  const unitsAttr = (m) => cats.reduce((a, c) => a + unitsCatMes(c, m), 0)
  const aupMarcaMes = (m) => { const u = unitsAttr(m); return u ? cats.reduce((a, c) => a + ventaCatMes(c, m), 0) / u : 0 }
  const aucMarcaMes = (m) => { const u = unitsAttr(m); return u ? cats.reduce((a, c) => a + costoCatMes(c, m), 0) / u : 0 }
  // Composición del valor (para el tooltip): de qué temporadas se compone el AUP/AUC efectivo de ese mes
  const compo = (c, m, precio) => {
    const parts = SEASONS.map((s) => { const u = salM(s, m) * splitSC(s, c); const p = precio ? aupSC(s, c) : aucSC(s, c); return u > 0.5 ? `${s}: ${fmt(u)} ud × $${money(p)}` : null }).filter(Boolean)
    if (!parts.length) return 'Sin salidas de ' + c + ' este mes (la rotación no vendió nada).'
    const res = precio ? aupCatMes(c, m) : aucCatMes(c, m)
    return `${precio ? 'AUP' : 'AUC'} efectivo ${c} · ${MESES[m].toUpperCase()} = (venta ÷ unidades). Temporadas que rotan este mes:\n` + parts.join('\n') + `\n= $${money(res)} ponderado`
  }
  async function guardar() {
    setSaving(true); setMsg(null)
    // El AUP/AUC EFECTIVO MENSUAL por categoría (evolución según rotación) alimenta a todo el app vía Cap_Producto
    const rows = []
    cats.forEach((c) => {
      const mAup = MESES.map((_, m) => aupCatMes(c, m)); if (mAup.some((v) => v)) rows.push({ rubro: 'AUP · ' + c, sbu, marca, meses: mAup })
      const mAuc = MESES.map((_, m) => aucCatMes(c, m)); if (mAuc.some((v) => v)) rows.push({ rubro: 'AUC · ' + c, sbu, marca, meses: mAuc })
    })
    const mAucMarca = MESES.map((_, m) => aucMarcaMes(m)); if (mAucMarca.some((v) => v)) rows.push({ rubro: 'AUC', sbu, marca, meses: mAucMarca })
    saveEstado(empresa, 'precios', snap)
    if (rows.length) await postToTab('Cap_Producto', empresa, usuario, 'Producto', rows, setMsg)
    else setMsg({ t: 'ok', x: 'Precios guardados ✓. El AUP/AUC mensual efectivo se calculará cuando definas la rotación en el Paso 2.' })
    setSaving(false)
  }
  const scell = (k, w = 72) => <td key={k} className="cell"><input value={snap[k] ?? ''} onChange={(e) => sset(k, e.target.value)} inputMode="decimal" style={{ width: w }} /></td>
  const money = (v) => v ? v.toFixed(1) : ''
  const mpct = (aup, auc) => aup > 0 ? ((aup - auc) / aup * 100).toFixed(1) + '%' : '' // margen % = (AUP − AUC) / AUP
  const repartir = (s) => {
    const tot = compraSeason(s)
    const pesos = cats.map((c) => { const o = catList.find((x) => x.cat === c); return o ? num(o.peso) : 0 })
    const den = pesos.reduce((a, b) => a + b, 0)
    const next = { ...snap }
    cats.forEach((c, i) => { const share = den > 0 ? pesos[i] / den : (cats.length ? 1 / cats.length : 0); next[kINV(s, c)] = Math.round(tot * share) })
    setSnap(next)
  }

  return (
    <>
      {msg && <div className={'note ' + msg.t}>{msg.x}</div>}
      {showMatriz && <div className="panel">
        <div className="toolbar"><span className="empchip" style={{ marginLeft: 0, background: marcaColor(marca) }}>{marca}</span><div className="spacer"></div><button className="btn primary" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : '💾 Guardar precios'}</button></div>
        <h3>Inventario, costo y precio por temporada y categoría — {marca}{M$}<span className="fill-badge">✏️ para llenar</span></h3>
        <div className="sub" style={{ marginBottom: 6 }}>Por cada <b>temporada</b> (añada) y <b>categoría</b>: cuántas <b>unidades</b>, su <b>AUC</b> (costo) y su <b>AUP</b> (precio). Para las temporadas <b>anteriores</b> las unidades son el <b>saldo on-hand</b> (se escriben aquí); para <b>SS28/FW28/SS29</b> las unidades son <b>solo lectura</b> — vienen de las compras que capturas en el <b>Paso 4</b>, repartidas por el peso de la categoría (aquí solo pones sus precios AUC/AUP). Las categorías vienen de lo que definió el Director.</div>
        <div className="tablewrap"><table style={{ width: 'auto' }}>
          <thead><tr><th className="l">Categoría / Temporada</th><th style={{ whiteSpace: 'normal', lineHeight: 1.15 }}>Unidades<br /><span className="unit" style={{ fontWeight: 400 }}>saldo / compra proy.</span></th><th>AUC ($)</th><th>AUP ($)</th><th>Margen ($)</th><th>Margen %</th></tr></thead>
          <tbody>
            {cats.map((c) => (
              <Fragment2 key={c}>
                <tr className="secrow"><td colSpan={5}>{c} <span className="unit" style={{ fontWeight: 400 }}>· total {fmt(invCat(c))} ud (todas las temporadas)</span></td></tr>
                {SEASONS.map((s) => { const buy = BUY_SEASONS.includes(s); return <tr key={c + '|' + s}><td className="l sub2">{s} <span className="unit" style={{ fontSize: 10 }}>{buy ? '(compra 2028)' : '(saldo anterior)'}</span></td>{buy ? <td className="tot" style={{ background: '#f4f6f8', color: '#64748b' }} title="Estas unidades vienen de las compras que captura Producto en el Paso 4 (repartidas por el peso de la categoría). No se editan aquí; solo se ponen los precios AUC/AUP.">{fmt(invSC(s, c))}</td> : scell(kINV(s, c))}{scell(kAUC(s, c))}{scell(kAUP(s, c))}<td className="tot" style={{ cursor: 'help' }} title={`Fórmula: Margen = AUP − AUC\nDatos de origen: $${money(aupSC(s, c)) || '0'} − $${money(aucSC(s, c)) || '0'} = $${money(aupSC(s, c) - aucSC(s, c)) || '0'}`}>{money(aupSC(s, c) - aucSC(s, c))}</td><td className="tot" style={{ cursor: 'help' }} title={`Fórmula: Margen % = (AUP − AUC) ÷ AUP\nDatos de origen: ($${money(aupSC(s, c)) || '0'} − $${money(aucSC(s, c)) || '0'}) ÷ $${money(aupSC(s, c)) || '0'} = ${mpct(aupSC(s, c), aucSC(s, c)) || '0%'}`}>{mpct(aupSC(s, c), aucSC(s, c))}</td></tr> })}
                <tr className="catrow"><td className="l">Subtotal {c} <span className="unit" style={{ fontWeight: 400 }}>(ponderado)</span></td><td className="tot">{fmt(invCat(c))}</td><td className="tot" style={{ cursor: 'help' }} title={`Fórmula: AUC de ${c} = suma de (unidades × AUC de cada temporada) ÷ total de unidades\nDatos de origen:\n${SEASONS.filter((s) => invSC(s, c) > 0.5).map((s) => `  ${s}: ${fmt(invSC(s, c))} ud × $${money(aucSC(s, c)) || '0'}`).join('\n') || '  (sin unidades)'}\n= $${money(aucPondCat(c)) || '0'}  (sobre ${fmt(invCat(c))} ud)`}>{money(aucPondCat(c))}</td><td className="tot" style={{ cursor: 'help' }} title={`Fórmula: AUP de ${c} = suma de (unidades × AUP de cada temporada) ÷ total de unidades\nDatos de origen:\n${SEASONS.filter((s) => invSC(s, c) > 0.5).map((s) => `  ${s}: ${fmt(invSC(s, c))} ud × $${money(aupSC(s, c)) || '0'}`).join('\n') || '  (sin unidades)'}\n= $${money(aupPondCat(c)) || '0'}  (sobre ${fmt(invCat(c))} ud)`}>{money(aupPondCat(c))}</td><td className="tot" style={{ cursor: 'help' }} title={`Fórmula: Margen = AUP − AUC\nDatos de origen: $${money(aupPondCat(c)) || '0'} − $${money(aucPondCat(c)) || '0'} = $${money(aupPondCat(c) - aucPondCat(c)) || '0'}`}>{money(aupPondCat(c) - aucPondCat(c))}</td><td className="tot" style={{ cursor: 'help' }} title={`Fórmula: Margen % = (AUP − AUC) ÷ AUP\nDatos de origen: ($${money(aupPondCat(c)) || '0'} − $${money(aucPondCat(c)) || '0'}) ÷ $${money(aupPondCat(c)) || '0'} = ${mpct(aupPondCat(c), aucPondCat(c)) || '0%'}`}>{mpct(aupPondCat(c), aucPondCat(c))}</td></tr>
              </Fragment2>
            ))}
          </tbody>
        </table></div>
        <div style={{ fontWeight: 800, color: '#017e84', fontSize: 13.5, margin: '16px 0 6px' }}>Total por temporada <span className="unit" style={{ fontWeight: 400 }}>(suma de todas las categorías · solo lectura)</span></div>
        <div className="tablewrap"><table style={{ width: 'auto' }}>
          <thead><tr><th className="l">Temporada</th><th>Unidades</th><th>AUC ($)</th><th>AUP ($)</th><th>Margen ($)</th><th>Margen %</th></tr></thead>
          <tbody>
            {SEASONS.map((s) => { const buy = BUY_SEASONS.includes(s); const au = seasonAUP(s), ac = seasonAUC(s), u = invSeason(s); return <tr key={s}><td className="l">{s} <span className="unit" style={{ fontSize: 10 }}>{buy ? '(compra 2028)' : '(saldo anterior)'}</span></td><td className="tot" style={{ cursor: 'help' }} title={`Fórmula: unidades de ${s} = suma de las unidades de todas las categorías de esta temporada`}>{fmt(u)}</td><td className="tot" style={{ cursor: 'help' }} title={`Fórmula: AUC de ${s} = promedio ponderado por unidades de sus categorías\nDatos de origen: ${fmt(u)} ud en ${s}, AUC $${money(ac) || '0'}`}>{money(ac)}</td><td className="tot" style={{ cursor: 'help' }} title={`Fórmula: AUP de ${s} = promedio ponderado por unidades de sus categorías\nDatos de origen: ${fmt(u)} ud en ${s}, AUP $${money(au) || '0'}`}>{money(au)}</td><td className="tot" style={{ cursor: 'help' }} title={`Fórmula: Margen = AUP − AUC\nDatos de origen: $${money(au) || '0'} − $${money(ac) || '0'} = $${money(au - ac) || '0'}`}>{money(au - ac)}</td><td className="tot" style={{ cursor: 'help' }} title={`Fórmula: Margen % = (AUP − AUC) ÷ AUP\nDatos de origen: ($${money(au) || '0'} − $${money(ac) || '0'}) ÷ $${money(au) || '0'} = ${mpct(au, ac) || '0%'}`}>{mpct(au, ac)}</td></tr> })}
            <tr className="grandrow"><td className="l">TOTAL {marca}</td><td className="tot" style={{ cursor: 'help' }} title="Fórmula: total de unidades = suma de todas las temporadas y categorías">{fmt(invTot)}</td><td className="tot" style={{ cursor: 'help' }} title={`Fórmula: AUC de la marca = suma de (unidades × AUC de cada temporada) ÷ total de unidades\nDatos de origen:\n${SEASONS.filter((s) => invSeason(s) > 0.5).map((s) => `  ${s}: ${fmt(invSeason(s))} ud × $${money(seasonAUC(s)) || '0'}`).join('\n') || '  (sin unidades)'}\n= $${money(aucPondMarca) || '0'}  (sobre ${fmt(invTot)} ud en total)`}>{money(aucPondMarca)}</td><td className="tot" style={{ cursor: 'help' }} title={`Fórmula: AUP de la marca = suma de (unidades × AUP de cada temporada) ÷ total de unidades\nDatos de origen:\n${SEASONS.filter((s) => invSeason(s) > 0.5).map((s) => `  ${s}: ${fmt(invSeason(s))} ud × $${money(seasonAUP(s)) || '0'}`).join('\n') || '  (sin unidades)'}\n= $${money(aupPondMarca) || '0'}  (sobre ${fmt(invTot)} ud en total)`}>{money(aupPondMarca)}</td><td className="tot" style={{ cursor: 'help' }} title={`Fórmula: Margen = AUP − AUC\nDatos de origen: $${money(aupPondMarca) || '0'} − $${money(aucPondMarca) || '0'} = $${money(aupPondMarca - aucPondMarca) || '0'}`}>{money(aupPondMarca - aucPondMarca)}</td><td className="tot" style={{ cursor: 'help' }} title={`Fórmula: Margen % = (AUP − AUC) ÷ AUP\nDatos de origen: ($${money(aupPondMarca) || '0'} − $${money(aucPondMarca) || '0'}) ÷ $${money(aupPondMarca) || '0'} = ${mpct(aupPondMarca, aucPondMarca) || '0%'}`}>{mpct(aupPondMarca, aucPondMarca)}</td></tr>
          </tbody>
        </table></div>
      </div>}

      {showEvol && <div className="panel">
        <h3>Evolución mensual del AUP / AUC — {marca}{M$} <span className="unit">(consecuencia de la combinación)</span></h3>
        <div className="sub" style={{ marginBottom: 6 }}>Según la <b>combinación de temporadas</b>, cada mes se vende una combinación distinta de temporadas → el AUP y AUC <b>cambian mes a mes</b>. Ej.: si en junio se vende FW26 a AUC $46 y en julio entra SS28 a AUC $60, el AUC del mes sube de $46 a $60; y si un mes se vende mitad de cada una, el AUC efectivo es ~$53. <b>Estos valores mensuales por categoría son los que usa el resto del app</b> (Ventas, Contribución, Cash Flow).</div>
        {!MESES.some((_, m) => unitsMes(m) > 0.5) && <div className="note warn" style={{ marginBottom: 10 }}>Sale <b>vacía</b> porque aún no hay <b>salidas de inventario</b>. Ya pusiste las unidades arriba; ahora falta escribir las <b>unidades a rotar</b> por temporada en el bloque de Combinación de temporadas (Paso 2). Eso define qué se vende cada mes.</div>}
        {cats.length > 1 && <div className="toolbar" style={{ marginBottom: 8 }}><input value={catBuscar} onChange={(e) => setCatBuscar(e.target.value)} placeholder="🔍 Buscar categoría…" style={{ border: '1px solid var(--line)', borderRadius: 7, padding: '7px 11px', font: 'inherit', minWidth: 220 }} />{catBuscar && <button className="btn" onClick={() => setCatBuscar('')}>✕ limpiar</button>}</div>}
        <div className="tablewrap"><table className="vfix"><colgroup><col style={{ width: '210px' }} />{MESES.map((_, i) => <col key={i} style={{ width: '66px' }} />)}<col style={{ width: '80px' }} /></colgroup>
          <thead><tr><th className="l">Efectivo mensual (según combinación)</th>{MESES.map((m) => <th key={m}>{m.toUpperCase()}</th>)}<th>Total / prom.</th></tr></thead>
          <tbody>
            <tr><td className="l sub2">Unidades vendidas</td>{MESES.map((_, m) => <td key={m} className="tot">{fmt(unitsMes(m))}</td>)}<td className="tot">{fmt(MESES.reduce((a, _, m) => a + unitsMes(m), 0))}</td></tr>
            {cats.filter((c) => !catBuscar.trim() || upper(c).indexOf(upper(catBuscar)) >= 0).map((c) => (
              <Fragment2 key={c}>
                <tr className="secrow"><td colSpan={14}>{c}</td></tr>
                <tr className="catrow"><td className="l">AUP efectivo {c} {Q('Párate sobre cada mes para ver de qué temporadas se compone.')}</td>{MESES.map((_, m) => <td key={m} className="tot" title={compo(c, m, true)} style={{ cursor: 'help' }}>{money(aupCatMes(c, m))}</td>)}<td></td></tr>
                <tr className="catrow"><td className="l">AUC efectivo {c} {Q('Párate sobre cada mes para ver de qué temporadas se compone.')}</td>{MESES.map((_, m) => <td key={m} className="tot" title={compo(c, m, false)} style={{ cursor: 'help' }}>{money(aucCatMes(c, m))}</td>)}<td></td></tr>
              </Fragment2>
            ))}
            <tr className="secrow"><td colSpan={14}>TOTAL {marca}</td></tr>
            <tr className="catrow"><td className="l">AUP efectivo marca</td>{MESES.map((_, m) => <td key={m} className="tot">{money(aupMarcaMes(m))}</td>)}<td></td></tr>
            <tr className="catrow"><td className="l">AUC efectivo marca</td>{MESES.map((_, m) => <td key={m} className="tot">{money(aucMarcaMes(m))}</td>)}<td></td></tr>
            <tr><td className="l sub2">Venta ($)</td>{MESES.map((_, m) => <td key={m} className="tot">{fmt(ventaMes(m))}</td>)}<td className="tot">{fmt(MESES.reduce((a, _, m) => a + ventaMes(m), 0))}</td></tr>
            <tr><td className="l sub2">Costo ($)</td>{MESES.map((_, m) => <td key={m} className="tot">{fmt(costoMes(m))}</td>)}<td className="tot">{fmt(MESES.reduce((a, _, m) => a + costoMes(m), 0))}</td></tr>
            <tr className="grandrow"><td className="l">Margen ($)</td>{MESES.map((_, m) => <td key={m} className="tot">{fmt(ventaMes(m) - costoMes(m))}</td>)}<td className="tot">{fmt(MESES.reduce((a, _, m) => a + ventaMes(m) - costoMes(m), 0))}</td></tr>
          </tbody>
        </table></div>
      </div>}
    </>
  )
}

/* ===== APROBACIONES (Finanzas): aprueba por marca los % de Logística ===== */
function AprobacionesForm({ empresa, sbus }) {
  const marcas = marcasDe(sbus)
  const [logd, setLogd] = useState({})
  const [aprob, setAprob] = useState(() => { try { return JSON.parse(localStorage.getItem(`aprob_${empresa}`) || '{}') } catch { return {} } })
  const [msg, setMsg] = useState(null)
  useEffect(() => { try { setLogd(JSON.parse(localStorage.getItem(`logcost_${empresa}`) || '{}')) } catch { } try { setAprob(JSON.parse(localStorage.getItem(`aprob_${empresa}`) || '{}')) } catch { } }, [empresa])
  const g = (k) => num(logd[k])
  const isAprob = (mca) => !!aprob[`LOGISTICA|${mca}`]
  const toggle = (mca) => { const next = { ...aprob, [`LOGISTICA|${mca}`]: !isAprob(mca) }; setAprob(next); saveEstado(empresa, 'aprob', next); setMsg({ t: 'ok', x: (next[`LOGISTICA|${mca}`] ? 'Aprobado' : 'Aprobación quitada') + ' · ' + mca + '. Se refleja en Logística.' }) }
  const nAp = marcas.filter(({ marca: m }) => isAprob(m)).length
  return (
    <div className="panel">
      <h3>Aprobaciones — Logística {M$}<span className="unit"> (Finanzas · por marca)</span></h3>
      <div className="sub">Revisa los <b>% de costos logísticos</b> que capturó cada marca y <b>apruébalos</b>. Mientras <b>no</b> apruebas, en Logística esos campos siguen <b>amarillos</b> (para revisar); al aprobar pasan a <b>verde</b> (confirmados). Aprobadas: <b>{nAp}</b> de {marcas.length}.</div>
      {msg && <div className={'note ' + msg.t}>{msg.x}</div>}
      <div className="tablewrap"><table style={{ width: 'auto' }}>
        <thead><tr><th className="l">Marca</th><th>% Log. venta</th><th>% Muestras</th><th>% Mant.</th><th>Estado</th><th>Acción</th></tr></thead>
        <tbody>
          {marcas.map(({ marca: m }) => { const ap = isAprob(m); return (
            <tr key={m}>
              <td className="l"><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: marcaColor(m), marginRight: 7 }}></span>{m}</td>
              <td className="tot">{fmt(g(`${m}|PCT_LOGVENTA`))}%</td>
              <td className="tot">{fmt(g(`${m}|PCT_MUESTRAS`))}%</td>
              <td className="tot">{fmt(g(`${m}|PCT_MANT`))}%</td>
              <td className="tot" style={{ color: ap ? 'var(--ok)' : 'var(--warn)', fontWeight: 800 }}>{ap ? '✓ Aprobado' : 'Pendiente'}</td>
              <td><button className={'btn' + (ap ? '' : ' primary')} onClick={() => toggle(m)}>{ap ? '↺ Quitar aprobación' : '✓ Aprobar'}</button></td>
            </tr>
          ) })}
        </tbody>
      </table></div>
    </div>
  )
}

/* ===== GASTOS ADMINISTRATIVOS: detalle por centro de costo, compartido por TODAS las SBU ===== */
function GastosAdminForm({ empresa }) {
  const cfgKey = `gadmin_cfg_${empresa}`, stKey = `gadmin_${empresa}`
  const [lista, setLista] = useState(() => { try { const s = JSON.parse(localStorage.getItem(cfgKey) || 'null'); return Array.isArray(s) && s.length ? s : DEFAULT_GADMIN } catch { return DEFAULT_GADMIN } })
  const [data, setData] = useState(() => { try { return JSON.parse(localStorage.getItem(stKey) || '{}') } catch { return {} } })
  const [edit, setEdit] = useState(false)
  const [saving, setSaving] = useState(false); const [msg, setMsg] = useState(null)
  const g = (k) => num(data[k]); const set = (k, v) => setData((d) => ({ ...d, [k]: v }))
  const key = (cod, m) => `${cod}|${m}`
  const subtot = MESES.map((_, m) => lista.reduce((a, it) => a + g(key(it.cod, m)), 0))
  const filaTot = (cod) => MESES.reduce((a, _, m) => a + g(key(cod, m)), 0)
  function guardar() { setSaving(true); try { saveEstado(empresa, 'gadmin_cfg', lista); saveEstado(empresa, 'gadmin', data); setMsg({ t: 'ok', x: 'Guardado en Google Sheet. Los centros de costo aplican a todas las SBU.' }) } catch { setMsg({ t: 'bad', x: 'No se pudo guardar.' }) } setSaving(false) }
  function agregar() { setLista([...lista, { cod: '', sub: '' }]) }
  function quitar(i) { setLista(lista.filter((_, j) => j !== i)) }
  function editar(i, campo, v) { setLista(lista.map((x, j) => j === i ? { ...x, [campo]: v } : x)) }
  function plantilla() { const aoa = [['CÓD', 'SUB RUBRO', ...MESES.map((m) => m.toUpperCase())]]; lista.forEach((it) => aoa.push([it.cod, it.sub, ...MESES.map(() => '')])); exportXlsx(aoa, `Plantilla_Gastos_Admin_${empresa}.xlsx`) }
  function importar(ev) {
    const file = ev.target.files[0]; ev.target.value = ''; if (!file) return
    const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase()
    importXlsx(file, (aoa) => {
      if (!aoa || aoa.length < 2) { setMsg({ t: 'bad', x: 'El Excel no tiene filas para importar.' }); return }
      const hdr = (aoa[0] || []).map(norm)
      const iCod = hdr.findIndex((h) => h.indexOf('COD') >= 0)
      const iSub = hdr.findIndex((h) => h.indexOf('RUBRO') >= 0 || h.indexOf('SUB') >= 0)
      const base = Math.max(iCod, iSub, -1) + 1
      const monthCol = MESES.map((m, mi) => { const mm = norm(m).slice(0, 3); const i = hdr.findIndex((h) => h.indexOf(mm) >= 0); return i >= 0 ? i : base + mi })
      const nueva = lista.map((x) => ({ ...x })); const nd = { ...data }; let filas = 0
      aoa.slice(1).forEach((r) => {
        if (!r || r.every((c) => c === '' || c == null)) return
        let cod = String((iCod >= 0 ? r[iCod] : r[0]) || '').trim(); const sub = String((iSub >= 0 ? r[iSub] : r[1]) || '').trim()
        if (!cod && !sub) return
        if (!cod) cod = sub
        if (!nueva.some((x) => String(x.cod) === cod)) nueva.push({ cod, sub: sub || cod })
        MESES.forEach((_, m) => { const v = r[monthCol[m]]; if (v !== '' && v != null) nd[`${cod}|${m}`] = String(v).replace(/[^0-9.\-]/g, '') })
        filas++
      })
      setLista(nueva); setData(nd)
      setMsg({ t: 'ok', x: `Importados ${filas} rubro(s) desde Excel. Revisa los números y pulsa 💾 Guardar para enviarlo al Google Sheet.` })
    })
  }

  return (
    <>
      {msg && <div className={'note ' + msg.t}>{msg.x}</div>}
      <div className="toolbar" style={{ marginBottom: 8 }}>
        <span className="empchip" style={{ marginLeft: 0, background: 'var(--accent, #0e7490)' }}>Gastos administrativos</span>
        <button className={'seg' + (edit ? ' active' : '')} onClick={() => setEdit((e) => !e)}>{edit ? '✓ Editando centros de costo' : '✏️ Editar centros de costo'}</button>
        {edit && <button className="btn" onClick={agregar}>➕ Agregar rubro</button>}
        <button className="btn" onClick={plantilla}>📄 Descargar plantilla</button>
        <label className="btn" style={{ cursor: 'pointer' }}>📥 Importar Excel<input type="file" accept=".xlsx,.xls,.csv" onChange={importar} style={{ display: 'none' }} /></label>
        <div className="spacer"></div>
        <button className="btn primary" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : '💾 Guardar'}</button>
      </div>
      <div className="panel">
        <h3>Gastos administrativos <span className="unit">(detalle · compartido por todas las SBU)</span>{M$}<span className="fill-badge">✏️ para llenar</span></h3>
        <div className="sub">Captura por centro de costo y mes. Con <b>Editar centros de costo</b> puedes cambiar códigos/nombres o agregar rubros; el cambio <b>aplica a todas las SBU</b>. El SUB-TOTAL alimenta la línea Gastos administrativos del Cash Flow.<br /><b>Importar desde Excel:</b> descarga la plantilla (columnas CÓD · SUB RUBRO · ENE-28…DIC-28), llénala y súbela con <b>📥 Importar Excel</b>. Se cruza por código; los rubros nuevos se agregan solos. Luego pulsa 💾 Guardar.</div>
        <div className="tablewrap"><table className="vfix"><colgroup><col style={{ width: '70px' }} /><col style={{ width: '270px' }} />{MESES.map((_, i) => <col key={i} style={{ width: '66px' }} />)}<col style={{ width: '80px' }} /></colgroup>
          <thead><tr><th>Cód</th><th className="l">Sub rubro</th>{MESES.map((m) => <th key={m}>{m.toUpperCase()}</th>)}<th>Total</th></tr></thead>
          <tbody>
            {lista.map((it, i) => (
              <tr key={i}>
                <td>{edit ? <input value={it.cod} onChange={(e) => editar(i, 'cod', e.target.value)} style={{ width: 52, padding: 4, border: '1px solid var(--line)', borderRadius: 5, textAlign: 'center' }} /> : it.cod}</td>
                <td className="l">{edit ? <span style={{ display: 'flex', gap: 4 }}><input value={it.sub} onChange={(e) => editar(i, 'sub', e.target.value)} style={{ width: '90%', padding: 4, border: '1px solid var(--line)', borderRadius: 5 }} /><button className="btn" onClick={() => quitar(i)} style={{ padding: '2px 8px' }}>✕</button></span> : it.sub}</td>
                {MESES.map((_, m) => { const k = key(it.cod, m); return <td key={m} className="cell"><input value={data[k] ?? ''} onChange={(e) => set(k, e.target.value)} inputMode="decimal" /></td> })}
                <td className="tot">{fmt(filaTot(it.cod))}</td>
              </tr>
            ))}
            <tr className="grandrow"><td className="l" colSpan={2}>SUB-TOTAL gastos administrativos</td>{subtot.map((v, m) => <td key={m} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(subtot.reduce((a, b) => a + b, 0))}</td></tr>
          </tbody>
        </table></div>
      </div>
    </>
  )
}

/* ===== FINANZAS WORKSPACE: panel de marcas (todas las SBU) + Cash Flow por marca ===== */
function FinanzasWorkspace({ empresa, usuario, sbus }) {
  const finRole = ROLES.find((r) => r.id === 'finanzas')
  const firstMarca = (Object.values(sbus)[0] || [])[0]
  const [marca, setMarca] = useState(firstMarca)
  useEffect(() => { if (!marca && firstMarca) setMarca(firstMarca) }, [firstMarca])
  const isTot = String(marca || '').startsWith('TOTAL::')
  const acc = isTot ? sbuColor(String(marca).slice(7)) : marcaColor(marca)
  return (
    <div className="comercial">
      <aside className="cmz-side">
        {Object.entries(sbus).map(([s, ms]) => (
          <div className="cmz-sbu" key={s}>
            <div className="cmz-sbu-h" style={{ color: sbuColor(s), borderLeft: '4px solid ' + sbuColor(s), paddingLeft: 8 }}>{s}</div>
            <button className={'cmz-marca' + (marca === `TOTAL::${s}` ? ' active' : '')} onClick={() => setMarca(`TOTAL::${s}`)} style={marca === `TOTAL::${s}` ? { background: sbuColor(s), color: '#fff' } : {}}>▣ TOTAL {s}</button>
            {ms.map((m) => { const c = marcaColor(m); const on = m === marca; return <button key={m} className={'cmz-marca' + (on ? ' active' : '')} onClick={() => setMarca(m)} style={on ? { background: c, color: '#fff' } : {}}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: c, marginRight: 8, verticalAlign: 'middle' }}></span>{m}</button> })}
          </div>
        ))}
      </aside>
      <div className="cmz-main" style={{ '--accent': acc, borderTop: '5px solid ' + acc, paddingTop: 12, borderRadius: 4 }}>
        {marca && <div className="toolbar" style={{ marginBottom: 8 }}><span className="empchip" style={{ background: acc, marginLeft: 0, fontSize: 14, padding: '5px 14px' }}>{isTot ? `▣ TOTAL ${String(marca).slice(7)}` : `💰 ${marca}`}</span></div>}
        {marca ? <RoleForm key={'fin' + marca} role={finRole} usuario={usuario} empresa={empresa} sbus={sbus} fixedMarca={marca} />
          : <div className="note warn">Selecciona una marca en el panel de la izquierda.</div>}
      </div>
    </div>
  )
}

/* ===== BLOQUE LOGÍSTICA: captura + inventario + costos, con switch Unidades/Plata (solo aquí) ===== */
function LogisticaBlock({ r, empresa, usuario, oneSbu, marca, noHeader }) {
  const [vista, setVista] = useState('ambas') // 'ud' = inventario (unidades) · '$' = costos (plata)
  const acc = marcaColor(marca)
  return (
    <div style={{ marginBottom: noHeader ? 0 : 18 }}>
      {!noHeader && <div style={{ background: r.color, color: '#fff', fontWeight: 800, fontSize: 14, padding: '9px 14px', borderRadius: 9, margin: '4px 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 18 }}>{r.icon}</span> {r.label}</div>}
      <div className="toolbar" style={{ marginBottom: 10, gap: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Ver:</span>
        {[['ud', '🔢 Unidades (inventario)'], ['$', '💲 Plata (costos)'], ['ambas', '🔢💲 Ambas']].map(([m, lbl]) => <button key={m} className={'seg' + (vista === m ? ' active' : '')} onClick={() => setVista(m)} style={vista === m ? { background: acc, borderColor: acc, color: '#fff' } : {}}>{lbl}</button>)}
      </div>
      {vista !== '$' && <TemporadaForm key={'flow' + marca} empresa={empresa} sbus={oneSbu} fixedMarca={marca} mode="flow" />}
      {vista !== 'ud' && <CostosLogisticos key={'cl' + marca} empresa={empresa} sbus={oneSbu} fixedMarca={marca} />}
    </div>
  )
}

/* ===== SBU WORKSPACE: dentro de una SBU salen las secciones (roles) con sus marcas ===== */
/* ===== Panel de equipo: quién participa en la empresa, su avatar, rol, qué llena y qué consulta ===== */
const TEAM_FILL = ['Ventas', 'Producto', 'Marketing', 'Logística', 'Finanzas', 'Director']
function TeamPanel({ empresa, sbuName }) {
  const [open, setOpen] = useState(false)
  const [colabs, setColabs] = useState([])
  const [avatars, setAvatars] = useState({})
  useEffect(() => {
    (async () => {
      try { const j = await gReadTab('Cap_Colaboradores'); if (j && j.ok && j.values) { const out = []; j.values.slice(1).forEach((row) => { if (upper(row[0]) !== upper(empresa)) return; out.push({ nombre: row[1] || '', rol: row[2] || '', email: row[3] || '', acceso: String(row[4] || '').split(';').filter(Boolean), todas: upper(row[5]) === 'TODAS', sbu: row[6] || '' }) }); setColabs(out) } else setColabs([]) } catch { }
      try { const a = await gLoadAvatars(); setAvatars(a || {}) } catch { }
    })()
  }, [empresa])
  // Filtra por la SBU actual: se muestran los de esta SBU + los generales (sin SBU: Finanzas/Gerencia, o marcados "Todas").
  const visibles = colabs.filter((c) => !c.sbu || upper(c.sbu) === 'TODAS' || upper(c.sbu) === upper(sbuName || ''))
  return (
    <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <button className="btn" onClick={() => setOpen((o) => !o)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>👥 Equipo de {sbuName || empresa} <span style={{ fontSize: 11 }}>{open ? '▲' : '▼'}</span></button>
      {open && <div className="panel" style={{ marginTop: 8, width: '100%' }}>
        <div className="sub">Quién participa en <b>{sbuName || empresa}</b>: su avatar, rol, qué <b style={{ color: '#15803d' }}>llena</b> y qué <b style={{ color: '#0e7490' }}>consulta</b>. Se define en Configuración → Colaboradores (con su SBU).</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {visibles.length === 0 && <div className="note warn" style={{ margin: 0 }}>Aún no hay colaboradores asignados a {sbuName || empresa}.</div>}
          {visibles.map((c, i) => {
            const av = (avatars[(c.email || '').toLowerCase()] || {}).avatar || '👤'
            const llena = c.acceso.filter((x) => TEAM_FILL.includes(x))
            const consulta = c.acceso.filter((x) => !TEAM_FILL.includes(x))
            return (
              <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '10px 13px', minWidth: 230, maxWidth: 300, background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ fontSize: 28, lineHeight: 1 }}>{av}</span><div><div style={{ fontWeight: 800 }}>{c.nombre || '(sin nombre)'}</div><div className="unit">{c.rol || '—'}{c.sbu ? ' · ' + c.sbu : ''}{c.todas ? ' · ve todas las empresas' : ''}</div></div></div>
                <div style={{ marginTop: 8, fontSize: 12.5 }}><b style={{ color: '#15803d' }}>Llena:</b> {llena.length ? llena.join(', ') : '—'}</div>
                <div style={{ fontSize: 12.5, marginTop: 2 }}><b style={{ color: '#0e7490' }}>Consulta:</b> {(consulta.length ? consulta.join(', ') + ' · ' : '')}Gerencia (solo lectura)</div>
              </div>
            )
          })}
        </div>
      </div>}
    </div>
  )
}

function SBUWorkspace({ sbuName, empresa, usuario, sbus, puede }) {
  const pu = puede || (() => true)
  // Acceso por rol: solo se ven las áreas asignadas al colaborador.
  const comercialRoles = ['ventas', 'producto', 'logistica'].map((id) => ROLES.find((r) => r.id === id)).filter((r) => pu(r.label))
  const puedeComercial = comercialRoles.length > 0
  const puedeDir = pu('Director')
  const SECS = [
    ...(puedeComercial ? [{ id: 'comercial', icon: '🧭', label: 'Comercial' }] : []),
    ...(pu('Marketing') ? [ROLES.find((r) => r.id === 'marketing')] : []),
    ...(puedeDir ? [ROLES.find((r) => r.id === 'director')] : []),
  ]
  const [secId, setSecId] = useState(SECS[0] ? SECS[0].id : 'comercial')
  const [comSub, setComSub] = useState('all') // sub-selector dentro de Comercial
  const [marca, setMarca] = useState('__TOTAL__')
  const [totTab, setTotTab] = useState('brand')
  const cashRole = { label: 'Cash Flow', tab: 'Cap_Finanzas' }
  const cashRubro = { k: 'CASH FLOW', cash: true }
  const isRetail = String(sbuName).toUpperCase() === 'RETAIL'
  const oneSbu = isRetail ? {} : { [sbuName]: sbus[sbuName] || [] }
  const marcasSBU = isRetail ? [] : (sbus[sbuName] || [])
  const role = SECS.find((r) => r.id === secId)
  const col = sbuColor(sbuName)
  const acc = marca === '__TOTAL__' ? col : marcaColor(marca)
  const totTabEf = (['brand', 'viajes', 'mk', 'ucvm', 'log'].includes(totTab) && !puedeDir) ? 'cash' : (totTab === 'cash' && !pu('Finanzas')) ? 'brand' : totTab

  if (isRetail) {
    return <div className="panel"><h3 style={{ color: sbuColor('Retail') }}>Retail — tiendas propias</h3><div className="note warn">Retail le compra internamente a las SBU (venta intercompañía). Para activarlo necesito el <b>precio de transferencia</b> (margen fijo, % sobre costo o AUP interno). En cuanto lo definamos, aquí verás la captura y el consolidado de Retail. 🏬</div></div>
  }
  return (
    <div className="comercial">
      <aside className="cmz-side">
        <div className="cmz-sbu">
          <div className="cmz-sbu-h" style={{ color: col, borderLeft: '4px solid ' + col, paddingLeft: 8 }}>{sbuName}</div>
          <button className={'cmz-marca' + (marca === '__TOTAL__' ? ' active' : '')} onClick={() => setMarca('__TOTAL__')} style={marca === '__TOTAL__' ? { background: col, color: '#fff' } : {}}>▣ TOTAL SBU</button>
          {marcasSBU.map((m) => { const c = marcaColor(m); const on = m === marca; return <button key={m} className={'cmz-marca' + (on ? ' active' : '')} onClick={() => setMarca(m)} style={on ? { background: c, color: '#fff' } : {}}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: c, marginRight: 8, verticalAlign: 'middle' }}></span>{m}</button> })}
        </div>
      </aside>
      <div className="cmz-main" style={{ '--accent': acc, borderTop: '4px solid ' + acc, paddingTop: 12, borderRadius: 4 }}>
        <TeamPanel empresa={empresa} sbuName={sbuName} />
        {marca === '__TOTAL__'
          ? (<>
            <div style={{ marginBottom: 6 }}>
              <span className="empchip" style={{ background: col, marginLeft: 0, fontSize: 13 }}>▣ TOTAL {sbuName}</span>
            </div>
            <div className="subtabs" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 6, display: 'flex', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              {puedeDir && <button className={'seg' + (totTabEf === 'brand' ? ' active' : '')} onClick={() => setTotTab('brand')} style={totTabEf === 'brand' ? { background: col, borderColor: col, color: '#fff' } : {}}>📊 Contribución de la SBU</button>}
              {pu('Finanzas') && <button className={'seg' + (totTabEf === 'cash' ? ' active' : '')} onClick={() => setTotTab('cash')} style={totTabEf === 'cash' ? { background: col, borderColor: col, color: '#fff' } : {}}>💵 Cash Flow</button>}
              {puedeDir && <button className={'seg' + (totTabEf === 'ucvm' ? ' active' : '')} onClick={() => setTotTab('ucvm')} style={totTabEf === 'ucvm' ? { background: col, borderColor: col, color: '#fff' } : {}}>📦 Unid · Venta · Costo · Margen</button>}
              {puedeDir && <button className={'seg' + (totTabEf === 'log' ? ' active' : '')} onClick={() => setTotTab('log')} style={totTabEf === 'log' ? { background: col, borderColor: col, color: '#fff' } : {}}>🚚 Logística</button>}
              {puedeDir && <button className={'seg' + (totTabEf === 'mk' ? ' active' : '')} onClick={() => setTotTab('mk')} style={totTabEf === 'mk' ? { background: col, borderColor: col, color: '#fff' } : {}}>📣 Marketing</button>}
              {puedeDir && <button className={'seg' + (totTabEf === 'viajes' ? ' active' : '')} onClick={() => setTotTab('viajes')} style={totTabEf === 'viajes' ? { background: col, borderColor: col, color: '#fff' } : {}}>🧳 Viajes</button>}
              {puedeDir && <><div style={{ flex: 1 }}></div><SbuResultDownload empresa={empresa} sbuName={sbuName} marcasSBU={marcasSBU} /></>}
            </div>
            {!puedeDir && !pu('Finanzas')
              ? <div className="note warn">No tienes acceso al consolidado de esta SBU. Entra a tu área (Ventas/Producto/Logística/Marketing) eligiendo una marca en el panel de la izquierda.</div>
              : totTabEf === 'cash'
              ? <CashFlowForm key={'cftot' + sbuName} role={cashRole} rubro={cashRubro} usuario={usuario} empresa={empresa} sbus={oneSbu} fixedMarca={`TOTAL::${sbuName}`} />
              : totTabEf === 'viajes'
              ? <ViajesEquipo empresa={empresa} marca="__TOTAL__" sbuName={sbuName} marcasSBU={marcasSBU} modo="total" />
              : totTabEf === 'mk'
              ? <ResumenMarcas empresa={empresa} sbuName={sbuName} marcasSBU={marcasSBU} vista="mk" />
              : totTabEf === 'ucvm'
              ? <ResumenMarcas empresa={empresa} sbuName={sbuName} marcasSBU={marcasSBU} vista="ucvm" />
              : totTabEf === 'log'
              ? <LogisticaResumen empresa={empresa} sbuName={sbuName} marcasSBU={marcasSBU} />
              : <BrandContribSBU empresa={empresa} sbuName={sbuName} marcasSBU={marcasSBU} />}
          </>)
          : (<>
            <div style={{ marginBottom: 6 }}>
              <span className="empchip" style={{ background: acc, marginLeft: 0, fontSize: 13 }}>{marca}</span>
            </div>
            <div className="subtabs" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 6, display: 'flex', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              {SECS.map((r) => { const on = r.id === secId; return <button key={r.id} className={'seg' + (on ? ' active' : '')} onClick={() => setSecId(r.id)} style={on ? { background: acc, borderColor: acc, color: '#fff' } : {}}>{r.icon} {r.label}</button> })}
              {puedeDir && <button className={'seg' + (secId === 'viajes' ? ' active' : '')} onClick={() => setSecId('viajes')} style={secId === 'viajes' ? { background: acc, borderColor: acc, color: '#fff' } : {}}>🧳 Viajes equipo</button>}
              {puedeDir && <button className={'seg' + (secId === 'brand' ? ' active' : '')} onClick={() => setSecId('brand')} style={secId === 'brand' ? { background: acc, borderColor: acc, color: '#fff' } : {}}>📊 Contribución de la SBU</button>}
            </div>
            {SECS.length === 0 && secId !== 'viajes' && secId !== 'brand' && <div className="note warn">No tienes áreas asignadas en esta SBU. Pídele a un administrador que ajuste tu acceso en Configuración → Colaboradores.</div>}
            {secId === 'brand'
              ? <BrandContribution empresa={empresa} marca={marca} />
              : secId === 'viajes'
              ? <ViajesEquipo empresa={empresa} marca={marca} sbuName={sbuName} marcasSBU={marcasSBU} />
              : secId === 'comercial'
              ? (<>
                {comercialRoles.length > 1 && <div className="toolbar" style={{ marginBottom: 12, gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 800 }}>IR A:</span>
                  <select value={comSub} onChange={(e) => setComSub(e.target.value)} style={{ fontWeight: 700, padding: '8px 12px', borderRadius: 8, border: '1.5px solid ' + acc, color: acc, background: '#fff', minWidth: 200 }}>
                    <option value="all">📋 Todos</option>
                    {comercialRoles.map((r) => <option key={r.id} value={r.id}>{r.icon} {r.label}</option>)}
                  </select>
                </div>}
                {comercialRoles.filter((r) => comSub === 'all' || r.id === comSub).map((r) => (
                  <div key={r.id} className="role-group" style={{ borderLeft: '7px solid ' + r.color, borderRadius: '0 12px 12px 0', paddingLeft: 14, marginBottom: 34, background: 'linear-gradient(90deg, ' + r.color + '11, transparent 60px)' }}>
                    <div style={{ background: r.color, color: '#fff', fontWeight: 800, fontSize: 14, padding: '9px 14px', borderRadius: 9, margin: '4px 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 18 }}>{r.icon}</span> {r.label}</div>
                    {r.id === 'logistica'
                      ? <LogisticaBlock key={sbuName + 'log' + marca} r={r} empresa={empresa} usuario={usuario} oneSbu={oneSbu} marca={marca} noHeader />
                      : <RoleForm key={sbuName + r.id + marca} role={r} usuario={usuario} empresa={empresa} sbus={oneSbu} fixedMarca={marca} />}
                  </div>))}
              </>)
              : <RoleForm key={sbuName + secId + marca} role={role} usuario={usuario} empresa={empresa} sbus={oneSbu} fixedMarca={marca} />}
          </>)}
      </div>
    </div>
  )
}

/* ===== COMERCIAL (legacy, ya no se usa desde el menú) ===== */
function ComercialScreen({ empresa, sbus, usuario }) {
  const sbuNames = Object.keys(sbus)
  const TOPS = [...sbuNames, 'Retail', 'Gerencia']
  const [top, setTop] = useState(sbuNames[0] || 'Gerencia')
  const [marca, setMarca] = useState('__TOTAL__') // por defecto, resumen de la SBU
  const [sec, setSec] = useState('Ventas')
  const [data, setData] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const rProd = ROLES.find((r) => r.id === 'producto')
  const rLog = ROLES.find((r) => r.id === 'logistica')
  const rVen = ROLES.find((r) => r.id === 'ventas')
  const SECS = ['Ventas', 'AUP', 'AUC', 'Inventario', 'Logística']
  const esSBU = sbuNames.includes(top)
  const marcasSBU = esSBU ? (sbus[top] || []) : []
  const acc = marca === '__TOTAL__' ? sbuColor(top) : marcaColor(marca)
  const common = { empresa, sbus, usuario, data, setData, saving, setSaving, setMsg, fixedMarca: marca }

  return (
    <>
      {/* Selector superior de SBU / Retail / Gerencia */}
      <div className="toolbar" style={{ marginBottom: 12, gap: 8 }}>
        {TOPS.map((s) => { const on = s === top; const c = sbuColor(s); return <button key={s} className={'seg' + (on ? ' active' : '')} onClick={() => { setTop(s); setMarca('__TOTAL__'); setMsg(null) }} style={on ? { background: c, borderColor: c, color: '#fff' } : { borderColor: c, color: c }}>{s}</button> })}
      </div>

      {top === 'Gerencia' ? <GerenciaScreen empresa={empresa} sbus={sbus} />
        : top === 'Retail' ? (
          <div className="panel">
            <h3 style={{ color: sbuColor('Retail') }}>Retail — tiendas propias</h3>
            <div className="note warn">Retail le compra internamente a las SBU (venta intercompañía). Para activarlo necesito definir el <b>precio de transferencia</b> (margen fijo, % sobre costo o AUP interno). En cuanto lo definamos, aquí verás la captura y el consolidado de Retail. 🏬</div>
          </div>
        ) : (
          <div className="comercial">
            <aside className="cmz-side">
              <div className="cmz-sbu">
                <div className="cmz-sbu-h" style={{ color: sbuColor(top), borderLeft: '4px solid ' + sbuColor(top), paddingLeft: 8 }}>{top}</div>
                <button className={'cmz-marca' + (marca === '__TOTAL__' ? ' active' : '')} onClick={() => setMarca('__TOTAL__')} style={marca === '__TOTAL__' ? { background: sbuColor(top), color: '#fff' } : {}}>▣ TOTAL SBU</button>
                {marcasSBU.map((m) => { const c = marcaColor(m); const on = m === marca; return <button key={m} className={'cmz-marca' + (on ? ' active' : '')} onClick={() => setMarca(m)} style={on ? { background: c, color: '#fff' } : {}}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: c, marginRight: 8, verticalAlign: 'middle' }}></span>{m}</button> })}
              </div>
            </aside>
            <div className="cmz-main" style={{ '--accent': acc, borderTop: '4px solid ' + acc, paddingTop: 12, borderRadius: 4 }}>
              {marca === '__TOTAL__' ? <GerenciaScreen empresa={empresa} sbus={sbus} soloSBU={top} />
                : (<>
                  <div className="toolbar" style={{ marginBottom: 8 }}>
                    <span className="empchip" style={{ background: acc, marginLeft: 0 }}>{marca}</span>
                    {SECS.map((k) => <button key={k} className={'seg' + (k === sec ? ' active' : '')} onClick={() => { setSec(k); setMsg(null) }} style={k === sec ? { background: acc, borderColor: acc, color: '#fff' } : {}}>{k}</button>)}
                  </div>
                  {sec === 'Ventas' && <ProjectionForm role={rVen} usuario={usuario} empresa={empresa} sbus={sbus} fixedMarca={marca} />}
                  {sec === 'AUP' && <CatCaptureForm role={rProd} rubro={{ k: 'AUP', u: '$', porCat: true }} {...common} />}
                  {sec === 'AUC' && <SimpleForm role={rProd} rubro={{ k: 'AUC', u: '$' }} {...common} />}
                  {sec === 'Inventario' && <SimpleForm role={rProd} rubro={{ k: 'INVENTARIO COMPRAS', u: '$' }} {...common} />}
                  {sec === 'Logística' && <SimpleForm role={rLog} rubro={{ k: 'LOGISTICA', u: '$' }} {...common} />}
                </>)}
            </div>
          </div>
        )}
    </>
  )
}

/* ===== GERENCIA: consolidado de solo lectura por SBU y marca ===== */
function GerenciaScreen({ empresa, sbus, soloSBU }) {
  const [ventas, setVentas] = useState([])
  const [producto, setProducto] = useState([])
  const [cats, setCats] = useState({})
  const [mk, setMk] = useState([]); const [log, setLog] = useState([]); const [dir, setDir] = useState([])
  const [hist, setHist] = useState([]); const [plan, setPlan] = useState({})
  const [cfSbu, setCfSbu] = useState(() => Object.keys(sbus)[0] || '')
  const [cargando, setCargando] = useState(true)
  useEffect(() => {
    (async () => {
      setCargando(true)
      const g = async (t) => { try { const j = await gReadTab(t); return j.ok && j.values ? j.values.slice(1) : [] } catch { return [] } }
      try { const j = await gReadTab('Cap_Ventas'); if (j.ok && j.values) setVentas(j.values.slice(1)) } catch { }
      try { const j = await gReadTab('Cap_Producto'); if (j.ok && j.values) setProducto(j.values.slice(1)) } catch { }
      try { const j = await gReadTab('Cap_Categorias'); if (j.ok && j.values) { const out = {}; j.values.slice(1).forEach((row) => { if (upper(row[0]) !== upper(empresa)) return; const cat = row[1], mar = row[3], peso = num(row[4]); if (!mar || !cat) return; (out[mar] = out[mar] || []).push({ cat, peso }) }); setCats(out) } } catch { }
      setMk(await g('Cap_Marketing')); setLog(await g('Cap_Logistica')); setDir(await g('Cap_Director'))
      try { const j = await gHistorico(); if (j && j.ok && j.values) setHist(j.values.slice(1)) } catch { }
      try { const jp = await gPlan2027(); if (jp && jp.map) setPlan(jp.map) } catch { }
      setCargando(false)
    })()
  }, [empresa])
  // FY (histórico) y ABP2027 (PLAN) para un conjunto de marcas
  const fySet = (ms, year, tipo) => { let s = 0; hist.forEach((r) => { if (String(r[1]) !== String(year)) return; if (!ms.some((m) => upper(m) === upper(r[5]))) return; if (String(r[3] || '').toUpperCase().indexOf(tipo) < 0) return; s += num(r[7]) }); return s }
  const abpSet = (ms, campo) => ms.reduce((a, m) => { const o = plan[upper(m)]; return a + (o ? o[campo] || 0 : 0) }, 0)
  const sumTabG = (rows, mca, filt) => { let s = 0; rows.forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(mca)) return; if (filt && !filt(String(r[1] || ''))) return; for (let j = 0; j < 12; j++) s += num(r[4 + j]) }); return s }
  const esVi = (rub) => rub.toUpperCase().startsWith('VIAJES')
  const fullCalc = (mca) => {
    const catNames = (cats[mca] || []).map((c) => c.cat)
    const r = realAupAuc(empresa, mca, ventas, producto, catNames)
    const unidades = r.totalUnits.reduce((a, b) => a + b, 0), ventaNeta = r.ventaMes.reduce((a, b) => a + b, 0), costo = r.costoMes.reduce((a, b) => a + b, 0)
    const logistica = sumTabG(log, mca), marketing = sumTabG(mk, mca)
    const viajes = [ventas, producto, mk, log, dir].reduce((t, rows) => t + sumTabG(rows, mca, esVi), 0)
    const comisiones = 0, margenBruto = ventaNeta - costo - comisiones - logistica, brand = margenBruto - marketing - viajes
    return { unidades, ventaNeta, costo, comisiones, logistica, marketing, viajes, margenBruto, brand }
  }
  const sbuAgg = (ms) => (ms || []).reduce((a, m) => { const c = fullCalc(m); Object.keys(c).forEach((k) => a[k] = (a[k] || 0) + c[k]); return a }, {})
  const gadminAnual = (() => { try { const d = JSON.parse(localStorage.getItem(`gadmin_${empresa}`) || '{}'); let cfg = DEFAULT_GADMIN; try { const s = JSON.parse(localStorage.getItem(`gadmin_cfg_${empresa}`) || 'null'); if (Array.isArray(s) && s.length) cfg = s } catch { } return cfg.reduce((a, it) => a + MESES.reduce((s, _, m) => s + num(d[`${it.cod}|${m}`]), 0), 0) } catch { return 0 } })()
  const [ppt, setPpt] = useState(false)
  async function descargarPptx() {
    setPpt(true)
    try { await loadPptx() } catch { alert('No se pudo cargar el generador de PowerPoint. Revisa tu conexión.'); setPpt(false); return }
    try {
      const M$f = (v) => '$' + Math.round(v || 0).toLocaleString('en-US')
      const TEAL = '0E7490', DARK = '134E4A'
      const pptx = new window.PptxGenJS(); pptx.defineLayout({ name: 'W', width: 13.33, height: 7.5 }); pptx.layout = 'W'
      let s = pptx.addSlide(); s.background = { color: 'F7FAFB' }
      s.addText('ABP 2028', { x: 0.7, y: 2.3, w: 12, h: 1.1, fontSize: 54, bold: true, color: TEAL })
      s.addText('Annual Business Plan + Cash Flow · ' + empresa, { x: 0.7, y: 3.5, w: 12, h: 0.6, fontSize: 22, color: DARK })
      s.addText(new Date().toLocaleDateString('es'), { x: 0.7, y: 6.7, w: 12, h: 0.4, fontSize: 12, color: '888888' })
      const sbuL = Object.entries(sbus).filter(([sn]) => !soloSBU || sn === soloSBU)
      let granBrand = 0
      sbuL.forEach(([sn, ms]) => {
        if (!ms || !ms.length) return
        const colsP = ms.map((m) => ({ m, v: fullCalc(m) })); const tot = sbuAgg(ms)
        const filasP = [['Unidades', (v) => Math.round(v.unidades || 0).toLocaleString('en-US')], ['Venta Neta', (v) => M$f(v.ventaNeta)], ['(−) Costo', (v) => M$f(v.costo)], ['(−) Logística', (v) => M$f(v.logistica)], ['= Margen Bruto', (v) => M$f(v.margenBruto)], ['(−) Marketing', (v) => M$f(v.marketing)], ['(−) Viajes', (v) => M$f(v.viajes)], ['= Contribución', (v) => M$f(v.brand)]]
        const head = [{ text: 'Concepto', options: { bold: true, color: 'FFFFFF', fill: TEAL } }, ...colsP.map((c) => ({ text: c.m, options: { bold: true, color: 'FFFFFF', fill: TEAL, align: 'right' } })), { text: 'TOTAL', options: { bold: true, color: 'FFFFFF', fill: DARK, align: 'right' } }]
        const rows = [head]; filasP.forEach(([lbl, f]) => { const st = lbl.startsWith('=') || lbl === 'Venta Neta'; rows.push([{ text: lbl, options: { bold: st } }, ...colsP.map((c) => ({ text: f(c.v), options: { align: 'right' } })), { text: f(tot), options: { align: 'right', bold: true } }]) })
        const sl = pptx.addSlide(); sl.addText('Contribución — ' + sn, { x: 0.5, y: 0.3, w: 12.3, h: 0.6, fontSize: 26, bold: true, color: TEAL })
        sl.addTable(rows, { x: 0.5, y: 1.1, w: 12.3, fontSize: 12, border: { type: 'solid', pt: 0.5, color: 'D7DDE3' }, valign: 'middle' })
        granBrand += tot.brand || 0
      })
      const f2 = pptx.addSlide(); f2.addText('Resultado operativo', { x: 0.7, y: 1.4, w: 12, h: 0.8, fontSize: 30, bold: true, color: TEAL })
      const rr = [[{ text: 'Concepto', options: { bold: true, color: 'FFFFFF', fill: TEAL } }, { text: '2028', options: { bold: true, color: 'FFFFFF', fill: TEAL, align: 'right' } }], [{ text: 'Contribución de las BU' }, { text: M$f(granBrand), options: { align: 'right' } }], [{ text: '(−) Gastos administrativos' }, { text: M$f(gadminAnual), options: { align: 'right' } }], [{ text: '= Resultado operativo', options: { bold: true } }, { text: M$f(granBrand - gadminAnual), options: { align: 'right', bold: true } }]]
      f2.addTable(rr, { x: 2.5, y: 2.6, w: 8, fontSize: 16, border: { type: 'solid', pt: 0.5, color: 'D7DDE3' }, valign: 'middle', rowH: 0.5 })
      await pptx.writeFile({ fileName: `ABP_2028_${empresa}.pptx` })
    } catch (e) { alert('No se pudo generar la presentación: ' + e.message) }
    setPpt(false)
  }

  const uni = (mca) => { const arr = Array(12).fill(0); ventas.forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(mca)) return; for (let j = 0; j < 12; j++) arr[j] += num(r[4 + j]) }); return arr }
  const prodRow = (mca, rub) => { const arr = Array(12).fill(0); producto.forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(mca) || upper(r[1]) !== upper(rub)) return; for (let j = 0; j < 12; j++) arr[j] = num(r[4 + j]) }); return arr }
  const aupW = (mca) => { const aupCat = {}; producto.forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(mca)) return; const rub = String(r[1] || ''); if (rub.indexOf('AUP · ') !== 0) return; aupCat[rub.slice(6)] = MESES.map((_, j) => num(r[4 + j])) }); const arr = Array(12).fill(0); (cats[mca] || []).forEach(({ cat, peso }) => { const a = aupCat[cat]; if (!a) return; const w = num(peso) / 100; for (let j = 0; j < 12; j++) arr[j] += w * a[j] }); return arr }
  const metrics = (mca) => {
    const u = uni(mca), ap = aupW(mca), ac = prodRow(mca, 'AUC'), inv = prodRow(mca, 'INVENTARIO COMPRAS')
    let unidades = 0, venta = 0, costo = 0, invc = 0
    for (let j = 0; j < 12; j++) { unidades += u[j]; venta += u[j] * ap[j]; costo += u[j] * ac[j]; invc += inv[j] }
    return { unidades, aup: unidades ? venta / unidades : 0, auc: unidades ? costo / unidades : 0, venta, costo, margen: venta - costo, margenPct: venta ? (venta - costo) / venta * 100 : 0, inv: invc }
  }
  const zero = { unidades: 0, aup: 0, auc: 0, venta: 0, costo: 0, margen: 0, margenPct: 0, inv: 0 }
  const acc = (a, m) => ({ unidades: a.unidades + m.unidades, venta: a.venta + m.venta, costo: a.costo + m.costo, margen: a.margen + m.margen, inv: a.inv + m.inv })
  const fin = (a) => ({ ...a, aup: a.unidades ? a.venta / a.unidades : 0, auc: a.unidades ? a.costo / a.unidades : 0, margenPct: a.venta ? a.margen / a.venta * 100 : 0 })
  const cols = (m) => <><td className="tot">{fmt(m.unidades)}</td><td className="ref">{fmt(m.aup)}</td><td className="ref">{fmt(m.auc)}</td><td className="tot">{fmt(m.venta)}</td><td className="tot">{fmt(m.costo)}</td><td className="tot">{fmt(m.margen)}</td><td className="ref">{(m.margenPct || 0).toFixed(1)}%</td><td className="tot">{fmt(m.inv)}</td></>

  let grand = { ...zero }
  // Consolidado P&L con las SBU lado a lado (Contribución de la SBU → Gastos Admin → Resultado Operativo)
  const sbuList = Object.entries(sbus).filter(([s]) => !soloSBU || s === soloSBU).map(([s, ms]) => ({ s, a: sbuAgg(ms) }))
  // Energy Brands: Retail es una 4ª unidad (tiendas propias · venta intercompañía). Aún sin datos (pendiente), va en cero.
  if (!soloSBU && empresa === 'ENERGY BRANDS') sbuList.push({ s: 'Retail', a: { unidades: 0, ventaNeta: 0, costo: 0, comisiones: 0, logistica: 0, marketing: 0, viajes: 0, margenBruto: 0, brand: 0 }, pend: true })
  const totAgg = sbuList.reduce((acc, { a }) => { Object.keys(a).forEach((k) => acc[k] = (acc[k] || 0) + a[k]); return acc }, {})
  const ventaTot = totAgg.ventaNeta || 0
  const gastosDe = (a) => ventaTot > 0 ? gadminAnual * (a.ventaNeta || 0) / ventaTot : (a === totAgg ? gadminAnual : 0)
  const allM = sbuList.flatMap(({ s }) => sbus[s] || [])
  const filasG = [
    { k: 'Unidades', g: (a) => a.unidades },
    { k: 'Venta Neta', g: (a) => a.ventaNeta, strong: true, fy26: fySet(allM, 2026, 'VENTA'), fy25: fySet(allM, 2025, 'VENTA'), abp27: abpSet(allM, 'venta') },
    { k: '(−) Costo', g: (a) => a.costo, fy26: fySet(allM, 2026, 'COSTO'), fy25: fySet(allM, 2025, 'COSTO'), abp27: abpSet(allM, 'costo') },
    { k: '(−) Comisiones', g: (a) => a.comisiones },
    { k: '(−) Logística', g: (a) => a.logistica },
    { k: '= Margen Bruto', g: (a) => a.margenBruto, strong: true, fy26: fySet(allM, 2026, 'VENTA') - fySet(allM, 2026, 'COSTO'), fy25: fySet(allM, 2025, 'VENTA') - fySet(allM, 2025, 'COSTO'), abp27: abpSet(allM, 'venta') - abpSet(allM, 'costo') },
    { k: '(−) Marketing', g: (a) => a.marketing },
    { k: '(−) Viajes', g: (a) => a.viajes },
    { k: '= Contribución de la SBU', g: (a) => a.brand, strong: true },
    { k: '(−) Gastos administrativos', g: (a) => gastosDe(a) },
    { k: '🎯 = Resultado Operativo', g: (a) => (a.brand || 0) - gastosDe(a), strong: true },
  ]
  const dpctG = (cur, ref) => (ref != null && Math.abs(ref) > 0.5) ? ((cur - ref) / Math.abs(ref) * 100) : null
  const dCellG = (cur, ref, cls) => { const d = dpctG(cur, ref); return <td className={'tot ' + cls + ' ' + (d == null ? '' : d >= 0 ? 'pos' : 'neg')} style={{ fontWeight: 700, cursor: 'help' }} title={d == null ? 'Sin referencia para comparar' : `Variación % = (2028 − referencia) ÷ referencia\n2028 = ${fmt(cur)} vs referencia = ${fmt(ref)} → ${(d >= 0 ? '+' : '') + d.toFixed(0)}% (el 2028 está ${d >= 0 ? 'por encima' : 'por debajo'} de ese año)`}>{d == null ? '—' : (d >= 0 ? '+' : '') + d.toFixed(0) + '%'}</td> }
  // Desglose por marca de un concepto dentro de una SBU (siempre en el tooltip al pasar el mouse)
  const brkSBU = (f, ms) => (ms || []).map((m) => ({ m, v: f.g(fullCalc(m)) })).filter((x) => Math.abs(x.v) > 0.5).map((x) => `${x.m}: ${fmt(x.v)}`).join(' · ') || 'Sin datos'
  const cellStyle = { cursor: 'help' }
  return (
    <>
      {!soloSBU && !cargando && <div className="panel">
        <h3>Gerencia — Resultado Operativo consolidado · {empresa}{M$} <span className="unit">(SBU lado a lado · 2028 · solo lectura)</span></h3>
        <div className="sub">Contribución de la SBU por SBU; luego se restan los <b>Gastos administrativos</b> (repartidos por peso de venta) para llegar al <b>Resultado Operativo</b>. Las columnas <b>FY2026/FY2025/ABP2027</b> comparan el total vs cada uno. Pasa el mouse sobre un total para ver el <b>detalle por marca</b>.</div>
        <div className="toolbar" style={{ marginBottom: 8 }}><div className="spacer"></div><button className="btn primary" disabled={ppt} onClick={descargarPptx} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{ppt ? 'Generando…' : (<><svg width="17" height="17" viewBox="0 0 24 24" fill="none" style={{ flex: '0 0 auto' }}><rect x="2" y="4" width="20" height="14" rx="2" fill="#D24726"/><rect x="6.5" y="8" width="7" height="6" rx="1" fill="#fff"/><path d="M6.5 8h4a2 2 0 0 1 0 4h-4z" fill="#fff"/><path d="M9 20h6" stroke="#D24726" strokeWidth="1.6" strokeLinecap="round"/><path d="M12 18v2" stroke="#D24726" strokeWidth="1.6" strokeLinecap="round"/></svg>Descargar</>)}</button></div>
        <div className="tablewrap"><table className="vfix" style={{ width: 'auto', minWidth: 480 }}>
          <thead><tr><th className="l">Concepto</th>{sbuList.map(({ s, pend }) => <th key={s} style={{ color: sbuColor(s) }}>{s}{pend && Q('Retail (tiendas propias · venta intercompañía). Pendiente de definir el precio de transferencia; por ahora va en cero.')}</th>)}<th>TOTAL {empresa}{Q('Consolidado: cada fila de esta columna es la suma de las SBU (las columnas de la izquierda). Párate sobre cada celda para ver el detalle por SBU.')}</th><th className="ya">FY2025</th><th className="ya">Δ25</th><th className="ya">FY2026</th><th className="ya">Δ26</th><th className="yb">ABP2027</th><th className="yb">Δ27</th></tr></thead>
          <tbody>
            {filasG.map((f) => { const cur = f.g(totAgg); return <tr key={f.k} className={f.strong ? 'grandrow' : undefined}><td className="l">{f.k}</td>{sbuList.map(({ s, a }) => <td key={s} className="tot" style={cellStyle} title={brkSBU(f, sbus[s])}>{fmt(f.g(a))}</td>)}<td className="tot" style={{ cursor: 'help' }} title={'Consolidado = suma de las SBU:\n' + sbuList.map(({ s, a }) => `${s}: ${fmt(f.g(a))}`).join('\n')}>{fmt(cur)}</td>
              <td className="tot ya">{f.fy25 != null ? fmt(f.fy25) : '—'}</td>{f.fy25 != null ? dCellG(cur, f.fy25, 'ya') : <td className="tot ya">—</td>}
              <td className="tot ya">{f.fy26 != null ? fmt(f.fy26) : '—'}</td>{f.fy26 != null ? dCellG(cur, f.fy26, 'ya') : <td className="tot ya">—</td>}
              <td className="tot yb">{f.abp27 != null ? fmt(f.abp27) : '—'}</td>{f.abp27 != null ? dCellG(cur, f.abp27, 'yb') : <td className="tot yb">—</td>}
            </tr> })}
          </tbody>
        </table></div>
      </div>}
      {!soloSBU && !cargando && <div style={{ marginTop: 4 }}>
        <div className="toolbar" style={{ marginBottom: 6 }}>
          <span style={{ fontWeight: 800, fontSize: 15 }}>💵 Cash Flow total</span>
          <label style={{ marginLeft: 10 }}>Ver</label>
          {Object.keys(sbus).map((s) => <button key={s} className={'seg' + (cfSbu === s ? ' active' : '')} onClick={() => setCfSbu(s)} style={cfSbu === s ? { background: sbuColor(s), borderColor: sbuColor(s), color: '#fff' } : {}}>{s}</button>)}
          <button className={'seg' + (cfSbu === '__ALL__' ? ' active' : '')} onClick={() => setCfSbu('__ALL__')} style={cfSbu === '__ALL__' ? { background: '#1f2d3d', borderColor: '#1f2d3d', color: '#fff' } : {}}>▣ TODAS</button>
        </div>
        {cfSbu && <CashFlowForm key={'gcf' + cfSbu} role={{ label: 'Cash Flow', tab: 'Cap_Finanzas' }} rubro={{ k: 'CASH FLOW', cash: true }} usuario="" empresa={empresa} sbus={cfSbu === '__ALL__' ? sbus : { [cfSbu]: sbus[cfSbu] || [] }} fixedMarca={`TOTAL::${cfSbu}`} />}
      </div>}
      {soloSBU && <div className="panel">
        <h3>Resumen {soloSBU} <span className="unit">(solo lectura · 2028)</span></h3>
        <div className="sub">Venta Neta = Unidades × AUP · Costo = Unidades × AUC · Margen = Venta − Costo · Inventario = compras del año. AUP/AUC son promedios ponderados.</div>
        {cargando ? <div className="sub">Cargando…</div> : (
          <div className="tablewrap">
            <table>
              <thead><tr><th className="l">SBU / Marca</th><th>Unidades</th><th>AUP</th><th>AUC</th><th>Venta Neta</th><th>Costo</th><th>Margen</th><th>Margen %</th><th>Inventario</th></tr></thead>
              <tbody>
                {Object.entries(sbus).filter(([s]) => !soloSBU || s === soloSBU).map(([s, ms]) => {
                  let sub = { ...zero }
                  const filas = ms.map((m) => { const mm = metrics(m); sub = acc(sub, mm); return <tr key={m}><td className="l">{m}</td>{cols(mm)}</tr> })
                  const subf = fin(sub); grand = acc(grand, sub)
                  return <Fragment2 key={s}>
                    <tr className="sburow"><td className="l">{s}</td>{cols(subf)}</tr>
                    {filas}
                  </Fragment2>
                })}
                {!soloSBU && <tr className="grandrow"><td className="l">TOTAL {empresa}</td>{cols(fin(grand))}</tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>}
    </>
  )
}

/* ===== TOTAL HOLDING: consolida las 3 empresas con la misma lógica de Gerencia ===== */
function HoldingScreen({ empresas, sbusFor }) {
  const [data, setData] = useState(null)
  const [detEmp, setDetEmp] = useState(empresas[0] || '')
  useEffect(() => {
    (async () => {
      const g = async (t) => { try { const j = await gReadTab(t); return j.ok && j.values ? j.values.slice(1) : [] } catch { return [] } }
      const [ventas, producto, capCat, mk, log, dir] = await Promise.all([g('Cap_Ventas'), g('Cap_Producto'), g('Cap_Categorias'), g('Cap_Marketing'), g('Cap_Logistica'), g('Cap_Director')])
      try { await Promise.all(empresas.map((e) => hydrateEstado(e))) } catch { }
      setData({ ventas, producto, capCat, mk, log, dir })
    })()
  }, [])
  if (!data) return <div className="panel"><div className="banner">⏳ Consolidando las {empresas.length} empresas del holding…</div></div>
  const calcEmp = (emp) => {
    const { ventas, producto, capCat, mk, log, dir } = data
    const cats = {}; capCat.forEach((row) => { if (upper(row[0]) !== upper(emp)) return; const c = row[1], mar = row[3], peso = num(row[4]); if (!mar || !c) return; (cats[mar] = cats[mar] || []).push({ cat: c, peso }) })
    const esVi = (rub) => rub.toUpperCase().startsWith('VIAJES')
    const sumTabG = (rows, mca, filt) => { let s = 0; rows.forEach((r) => { if (upper(r[0]) !== upper(emp) || upper(r[3]) !== upper(mca)) return; if (filt && !filt(String(r[1] || ''))) return; for (let j = 0; j < 12; j++) s += num(r[4 + j]) }); return s }
    const fullCalc = (mca) => {
      const catNames = (cats[mca] || []).map((c) => c.cat)
      const r = realAupAuc(emp, mca, ventas, producto, catNames)
      const unidades = r.totalUnits.reduce((a, b) => a + b, 0), ventaNeta = r.ventaMes.reduce((a, b) => a + b, 0), costo = r.costoMes.reduce((a, b) => a + b, 0)
      const logistica = sumTabG(log, mca), marketing = sumTabG(mk, mca)
      const viajes = [ventas, producto, mk, log, dir].reduce((t, rows) => t + sumTabG(rows, mca, esVi), 0)
      const comisiones = 0, margenBruto = ventaNeta - costo - comisiones - logistica, brand = margenBruto - marketing - viajes
      return { unidades, ventaNeta, costo, comisiones, logistica, marketing, viajes, margenBruto, brand }
    }
    const sbus = sbusFor(emp) || {}
    const allM = Object.values(sbus).flat()
    const tot = allM.reduce((a, m) => { const c = fullCalc(m); Object.keys(c).forEach((k) => a[k] = (a[k] || 0) + c[k]); return a }, {})
    let gadmin = 0
    try { const d = JSON.parse(localStorage.getItem(`gadmin_${emp}`) || '{}'); let cfg = DEFAULT_GADMIN; try { const s = JSON.parse(localStorage.getItem(`gadmin_cfg_${emp}`) || 'null'); if (Array.isArray(s) && s.length) cfg = s } catch { } gadmin = cfg.reduce((a, it) => a + MESES.reduce((s, _, m) => s + num(d[`${it.cod}|${m}`]), 0), 0) } catch { }
    return { ...tot, gadmin, resultado: (tot.brand || 0) - gadmin }
  }
  const byEmp = empresas.map((e) => ({ e, v: calcEmp(e) }))
  const filas = [
    { k: 'Unidades', g: (v) => v.unidades },
    { k: 'Venta Neta', g: (v) => v.ventaNeta, strong: true },
    { k: '(−) Costo', g: (v) => v.costo },
    { k: '(−) Logística', g: (v) => v.logistica },
    { k: '= Margen Bruto', g: (v) => v.margenBruto, strong: true },
    { k: '(−) Marketing', g: (v) => v.marketing },
    { k: '(−) Viajes', g: (v) => v.viajes },
    { k: '= Contribución de las BU', g: (v) => v.brand, strong: true },
    { k: '(−) Gastos administrativos', g: (v) => v.gadmin },
    { k: '🎯 = Resultado Operativo', g: (v) => v.resultado, strong: true },
  ]
  const totHold = (g) => byEmp.reduce((a, { v }) => a + (g(v) || 0), 0)
  return (
    <>
      <div className="panel">
        <h3>🏛️ Total Holding — Resultado Operativo consolidado <span className="unit">(todas las empresas · 2028 · solo lectura)</span></h3>
        <div className="sub">Cada columna es una empresa (misma lógica que Gerencia); la columna <b>TOTAL HOLDING</b> suma las {empresas.length} empresas. Para ver el detalle por SBU y el Cash Flow de una empresa, elígela abajo.</div>
        <div className="tablewrap"><table className="vfix" style={{ width: 'auto', minWidth: 480 }}>
          <thead><tr><th className="l">Concepto</th>{byEmp.map(({ e }) => <th key={e}>{e}</th>)}<th style={{ color: '#7c3aed' }}>TOTAL HOLDING</th></tr></thead>
          <tbody>
            {filas.map((f) => <tr key={f.k} className={f.strong ? 'grandrow' : undefined}>
              <td className="l">{f.k}</td>
              {byEmp.map(({ e, v }) => <td key={e} className="tot">{fmt(f.g(v))}</td>)}
              <td className="tot" style={{ fontWeight: 800, color: '#7c3aed' }}>{fmt(totHold(f.g))}</td>
            </tr>)}
          </tbody>
        </table></div>
      </div>
      <div className="panel">
        <div className="toolbar" style={{ marginBottom: 8 }}>
          <span style={{ fontWeight: 800, fontSize: 15 }}>🔎 Detalle por empresa</span>
          {empresas.map((e) => <button key={e} className={'seg' + (detEmp === e ? ' active' : '')} onClick={() => setDetEmp(e)} style={detEmp === e ? { background: '#7c3aed', borderColor: '#7c3aed', color: '#fff' } : {}}>{e}</button>)}
          <button className={'seg' + (detEmp === '__ALL__' ? ' active' : '')} onClick={() => setDetEmp('__ALL__')} style={detEmp === '__ALL__' ? { background: '#1f2d3d', borderColor: '#1f2d3d', color: '#fff' } : {}}>▣ TODOS</button>
        </div>
        {detEmp === '__ALL__'
          ? empresas.map((e) => <div key={e} style={{ marginBottom: 18 }}><div style={{ fontWeight: 800, fontSize: 15, color: '#7c3aed', margin: '4px 0 8px' }}>🏢 {e}</div><GerenciaScreen key={e} empresa={e} sbus={sbusFor(e)} /></div>)
          : detEmp && <GerenciaScreen key={detEmp} empresa={detEmp} sbus={sbusFor(detEmp)} />}
      </div>
    </>
  )
}

/* ===== CONTRIBUCIÓN DE LA SBU: P&L por marca (estilo Excel HOKA) ===== */
function BrandContribution({ empresa, marca }) {
  const [P, setP] = useState({ ven: [], prod: [], cats: {}, mk: [], log: [], dir: [], hist: [], plan: {} })
  const [load, setLoad] = useState(true)
  useEffect(() => {
    (async () => {
      setLoad(true)
      const g = async (t) => { try { const j = await gReadTab(t); return j.ok && j.values ? j.values.slice(1) : [] } catch { return [] } }
      const [ven, prod, cap, mk, log, dir] = await Promise.all([g('Cap_Ventas'), g('Cap_Producto'), g('Cap_Categorias'), g('Cap_Marketing'), g('Cap_Logistica'), g('Cap_Director')])
      let hist = []; try { const jh = await gHistorico(); if (jh && jh.ok && jh.values) hist = jh.values.slice(1) } catch { }
      let plan = {}; try { const jp = await gPlan2027(); if (jp && jp.map) plan = jp.map } catch { }
      const cats = {}; cap.forEach((row) => { if (upper(row[0]) !== upper(empresa)) return; const c = row[1], mar = row[3], peso = num(row[4]); if (!mar || !c) return; (cats[mar] = cats[mar] || []).push({ cat: c, peso }) })
      setP({ ven, prod, cats, mk, log, dir, hist, plan }); setLoad(false)
    })()
  }, [empresa])

  const inMarca = (r) => upper(r[0]) === upper(empresa) && upper(r[3]) === upper(marca)
  const uniMes = () => { const a = Array(12).fill(0); P.ven.forEach((r) => { if (!inMarca(r)) return; if (String(r[1] || '').toUpperCase().startsWith('VIAJES')) return; for (let j = 0; j < 12; j++) a[j] += num(r[4 + j]) }); return a }
  const aupCat = () => { const o = {}; P.prod.forEach((r) => { if (!inMarca(r)) return; const rub = String(r[1] || ''); if (rub.indexOf('AUP · ') !== 0) return; o[rub.slice(6)] = MESES.map((_, j) => num(r[4 + j])) }); return o }
  const aucMes = () => { const a = Array(12).fill(0); P.prod.forEach((r) => { if (!inMarca(r) || upper(r[1]) !== 'AUC') return; for (let j = 0; j < 12; j++) a[j] = num(r[4 + j]) }); return a }
  const sumTab = (rows, filt) => { let s = 0; rows.forEach((r) => { if (!inMarca(r)) return; if (filt && !filt(String(r[1] || ''))) return; for (let j = 0; j < 12; j++) s += num(r[4 + j]) }); return s }

  const acat = aupCat()
  const catList = P.cats[marca] || []
  const catNames = catList.map((c) => c.cat)
  const R = realAupAuc(empresa, marca, P.ven, P.prod, catNames)
  let unidades = 0, ventaNeta = 0, costo = 0
  for (let j = 0; j < 12; j++) { unidades += R.totalUnits[j]; ventaNeta += R.ventaMes[j]; costo += R.costoMes[j] }
  const comisiones = 0
  const logistica = sumTab(P.log)
  const marketing = sumTab(P.mk)
  const viajes = [P.ven, P.prod, P.mk, P.log, P.dir].reduce((t, rows) => t + sumTab(rows, (rub) => rub.toUpperCase().startsWith('VIAJES')), 0)
  const margenBruto = ventaNeta - costo - comisiones - logistica
  const brand = margenBruto - marketing - viajes
  const pct = (x) => ventaNeta ? (x / ventaNeta * 100).toFixed(1) + '%' : '—'
  // FY histórico (EBP) por marca + ABP2027 (hoja PLAN)
  const fy = (year, tipo) => { let s = 0; P.hist.forEach((r) => { if (String(r[1]) !== String(year)) return; if (upper(r[5]) !== upper(marca)) return; if (String(r[3] || '').toUpperCase().indexOf(tipo) < 0) return; s += num(r[7]) }); return s }
  const fyVenta = (y) => fy(y, 'VENTA'), fyCosto = (y) => fy(y, 'COSTO'), fyMargen = (y) => fyVenta(y) - fyCosto(y)
  const o27 = P.plan[upper(marca)] || {}
  const abpVenta = o27.venta || 0, abpCosto = o27.costo || 0, abpMargen = abpVenta - abpCosto
  const dpct = (cur, ref) => (ref != null && Math.abs(ref) > 0.5) ? ((cur - ref) / Math.abs(ref) * 100) : null
  const dCell = (cur, ref, cls) => { const d = dpct(cur, ref); return <td className={'tot ' + (cls || '') + ' ' + (d == null ? '' : d >= 0 ? 'pos' : 'neg')} style={{ fontWeight: 700, cursor: 'help' }} title={d == null ? 'Sin referencia para comparar' : `Variación % = (2028 − referencia) ÷ referencia\n2028 = ${fmt(cur)} vs referencia = ${fmt(ref)} → ${(d >= 0 ? '+' : '') + d.toFixed(0)}% (el 2028 está ${d >= 0 ? 'por encima' : 'por debajo'} de ese año)`}>{d == null ? '—' : (d >= 0 ? '+' : '') + d.toFixed(0) + '%'}</td> }

  // fyObj = {fy25, fy26, abp27} (o null si esa fila no tiene comparación histórica)
  const fila = (lbl, val, strong, fyObj) => (
    <tr className={strong ? 'grandrow' : undefined}>
      <td className="l">{lbl}</td><td className="tot">{fmt(val)}</td><td className="ref">{pct(val)}</td>
      <td className="tot ya">{fyObj && fyObj.fy25 != null ? fmt(fyObj.fy25) : '—'}</td>{fyObj && fyObj.fy25 != null ? dCell(val, fyObj.fy25, 'ya') : <td className="tot ya">—</td>}
      <td className="tot ya">{fyObj && fyObj.fy26 != null ? fmt(fyObj.fy26) : '—'}</td>{fyObj && fyObj.fy26 != null ? dCell(val, fyObj.fy26, 'ya') : <td className="tot ya">—</td>}
      <td className="tot yb">{fyObj && fyObj.abp27 != null ? fmt(fyObj.abp27) : '—'}</td>{fyObj && fyObj.abp27 != null ? dCell(val, fyObj.abp27, 'yb') : <td className="tot yb">—</td>}
    </tr>
  )

  return (
    <div className="panel">
      <h3 style={{ color: marcaColor(marca) }}>Contribución de la SBU — {marca}{M$} <span className="unit">(2028 · solo lectura)</span></h3>
      <div className="sub">Venta Neta = Unidades × AUP · Costo = Unidades × AUC · Margen Bruto = Venta Neta − Costo − Comisiones − Logística · Contribución = Margen Bruto − Marketing − Viajes. Las columnas <b>FY2025/FY2026</b> (histórico EBP) y <b>ABP 2027</b> (hoja PLAN) traen el valor y la <b>variación %</b> del 2028 vs cada uno (solo Venta, Costo y Margen).</div>
      {load ? <div className="sub">Cargando…</div> : (<>
        <div className="tablewrap">
          <table style={{ width: 'auto' }}>
            <thead><tr><th className="l">Concepto</th><th>Monto</th><th>% VN</th><th className="ya">FY2025</th><th className="ya">Δ vs 25</th><th className="ya">FY2026</th><th className="ya">Δ vs 26</th><th className="yb">ABP 2027</th><th className="yb">Δ vs ABP27</th></tr></thead>
            <tbody>
              <tr><td className="l">Unidades</td><td className="tot">{fmt(unidades)}</td><td className="ref">—</td><td className="ya">—</td><td className="ya">—</td><td className="ya">—</td><td className="ya">—</td><td className="yb">—</td><td className="yb">—</td></tr>
              {fila('Venta Neta', ventaNeta, true, { fy25: fyVenta(2025), fy26: fyVenta(2026), abp27: abpVenta })}
              {fila('(−) Costo', costo, false, { fy25: fyCosto(2025), fy26: fyCosto(2026), abp27: abpCosto })}
              {fila('(−) Comisiones', comisiones)}
              {fila('(−) Logística', logistica)}
              {fila('= Margen Bruto', margenBruto, true, { fy25: fyMargen(2025), fy26: fyMargen(2026), abp27: abpMargen })}
              {fila('(−) Marketing', marketing)}
              {fila('(−) Viajes', viajes)}
              {fila('= CONTRIBUCIÓN DE LA SBU', brand, true)}
            </tbody>
          </table>
        </div>
        {catList.length > 0 && <div className="tablewrap" style={{ marginTop: 14 }}>
          <table>
            <thead><tr><th className="l">Categoría</th><th>Peso pond. %</th><th>Unidades</th><th>Venta Neta</th></tr></thead>
            <tbody>
              {catList.map(({ cat }, i) => { const uc = R.unitsCat[cat] || []; const x = acat[cat] || []; let un = 0, vn = 0; for (let j = 0; j < 12; j++) { un += uc[j] || 0; vn += (uc[j] || 0) * (x[j] || 0) } const pw = unidades > 0 ? (un / unidades * 100) : 0; return <tr key={i}><td className="l">{cat}</td><td className="tot">{pw.toFixed(1)}%</td><td className="tot">{fmt(un)}</td><td className="tot">{fmt(vn)}</td></tr> })}
            </tbody>
          </table>
        </div>}
        {(comisiones === 0) && <div className="sub" style={{ marginTop: 8 }}>Nota: Comisiones y Venta Bruta/Descuentos aún no se capturan por marca; se conectan cuando definamos esos campos.</div>}
      </>)}
    </div>
  )
}

/* ===== Botón de descarga a nivel SBU: presentación con los RESULTADOS de la SBU (no incluye capturas/inputs) ===== */
function SbuResultDownload({ empresa, sbuName, marcasSBU }) {
  const [ppt, setPpt] = useState(false)
  const [P, setP] = useState(null)
  useEffect(() => {
    (async () => {
      const g = async (t) => { try { const j = await gReadTab(t); return j.ok && j.values ? j.values.slice(1) : [] } catch { return [] } }
      const [ven, prod, cap, mk, log, dir] = await Promise.all([g('Cap_Ventas'), g('Cap_Producto'), g('Cap_Categorias'), g('Cap_Marketing'), g('Cap_Logistica'), g('Cap_Director')])
      const cats = {}; cap.forEach((row) => { if (upper(row[0]) !== upper(empresa)) return; const c = row[1], mar = row[3], peso = num(row[4]); if (!mar || !c) return; (cats[mar] = cats[mar] || []).push({ cat: c, peso }) })
      setP({ ven, prod, cats, mk, log, dir })
    })()
  }, [empresa, sbuName])
  const gadminAnual = (() => { try { const d = JSON.parse(localStorage.getItem(`gadmin_${empresa}`) || '{}'); let cfg = DEFAULT_GADMIN; try { const s = JSON.parse(localStorage.getItem(`gadmin_cfg_${empresa}`) || 'null'); if (Array.isArray(s) && s.length) cfg = s } catch { } return cfg.reduce((a, it) => a + MESES.reduce((s, _, m) => s + num(d[`${it.cod}|${m}`]), 0), 0) } catch { return 0 } })()
  const calc = (mca) => {
    if (!P) return { unidades: 0, ventaNeta: 0, costo: 0, logistica: 0, marketing: 0, viajes: 0, margenBruto: 0, brand: 0 }
    const sumTab = (rows, filt) => { let s = 0; rows.forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(mca)) return; if (filt && !filt(String(r[1] || ''))) return; for (let j = 0; j < 12; j++) s += num(r[4 + j]) }); return s }
    const esVi = (rub) => rub.toUpperCase().startsWith('VIAJES')
    const catNames = (P.cats[mca] || []).map((c) => c.cat)
    const r = realAupAuc(empresa, mca, P.ven, P.prod, catNames)
    const unidades = r.totalUnits.reduce((a, b) => a + b, 0), ventaNeta = r.ventaMes.reduce((a, b) => a + b, 0), costo = r.costoMes.reduce((a, b) => a + b, 0)
    const logistica = sumTab(P.log), marketing = sumTab(P.mk)
    const viajes = [P.ven, P.prod, P.mk, P.log, P.dir].reduce((t, rows) => t + sumTab(rows, esVi), 0)
    const margenBruto = ventaNeta - costo - logistica, brand = margenBruto - marketing - viajes
    return { unidades, ventaNeta, costo, logistica, marketing, viajes, margenBruto, brand }
  }
  async function descargar() {
    setPpt(true)
    try { await loadPptx() } catch { alert('No se pudo cargar el generador de PowerPoint. Revisa tu conexión.'); setPpt(false); return }
    try {
      const M$f = (v) => '$' + Math.round(v || 0).toLocaleString('en-US'); const UD = (v) => Math.round(v || 0).toLocaleString('en-US')
      const TEAL = '0E7490', DARK = '134E4A'
      const cols = (marcasSBU || []).map((m) => ({ m, v: calc(m) }))
      const tot = cols.reduce((a, { v }) => { Object.keys(v).forEach((k) => a[k] = (a[k] || 0) + v[k]); return a }, {})
      const pptx = new window.PptxGenJS(); pptx.defineLayout({ name: 'W', width: 13.33, height: 7.5 }); pptx.layout = 'W'
      let s = pptx.addSlide(); s.background = { color: 'F7FAFB' }
      s.addText('ABP 2028', { x: 0.7, y: 2.3, w: 12, h: 1.1, fontSize: 54, bold: true, color: TEAL })
      s.addText('Resultados de la SBU — ' + sbuName + ' · ' + empresa, { x: 0.7, y: 3.5, w: 12, h: 0.6, fontSize: 22, color: DARK })
      s.addText(new Date().toLocaleDateString('es'), { x: 0.7, y: 6.7, w: 12, h: 0.4, fontSize: 12, color: '888888' })
      const filasP = [['Unidades', (v) => UD(v.unidades)], ['Venta Neta', (v) => M$f(v.ventaNeta)], ['(−) Costo', (v) => M$f(v.costo)], ['(−) Logística', (v) => M$f(v.logistica)], ['= Margen Bruto', (v) => M$f(v.margenBruto)], ['(−) Marketing', (v) => M$f(v.marketing)], ['(−) Viajes', (v) => M$f(v.viajes)], ['= Contribución', (v) => M$f(v.brand)]]
      const head = [{ text: 'Concepto', options: { bold: true, color: 'FFFFFF', fill: TEAL } }, ...cols.map((c) => ({ text: c.m, options: { bold: true, color: 'FFFFFF', fill: TEAL, align: 'right' } })), { text: 'TOTAL', options: { bold: true, color: 'FFFFFF', fill: DARK, align: 'right' } }]
      const rows = [head]; filasP.forEach(([lbl, f]) => { const stg = lbl.startsWith('=') || lbl === 'Venta Neta'; rows.push([{ text: lbl, options: { bold: stg } }, ...cols.map((c) => ({ text: f(c.v), options: { align: 'right' } })), { text: f(tot), options: { align: 'right', bold: true } }]) })
      const sl = pptx.addSlide(); sl.addText('Contribución de la SBU — ' + sbuName, { x: 0.5, y: 0.3, w: 12.3, h: 0.6, fontSize: 26, bold: true, color: TEAL })
      sl.addTable(rows, { x: 0.5, y: 1.1, w: 12.3, fontSize: 12, border: { type: 'solid', pt: 0.5, color: 'D7DDE3' }, valign: 'middle' })
      // Unid · Venta · Costo · Margen por marca
      const u2 = pptx.addSlide(); u2.addText('Unidades · Venta · Costo · Margen — ' + sbuName, { x: 0.5, y: 0.3, w: 12.3, h: 0.6, fontSize: 24, bold: true, color: TEAL })
      const uh = [{ text: 'Marca', options: { bold: true, color: 'FFFFFF', fill: TEAL } }, ...['Unidades', 'Venta', 'Costo', 'Margen', 'Margen %'].map((h) => ({ text: h, options: { bold: true, color: 'FFFFFF', fill: TEAL, align: 'right' } }))]
      const ur = [uh]; cols.forEach(({ m, v }) => { const mg = v.ventaNeta - v.costo; ur.push([{ text: m }, { text: UD(v.unidades), options: { align: 'right' } }, { text: M$f(v.ventaNeta), options: { align: 'right' } }, { text: M$f(v.costo), options: { align: 'right' } }, { text: M$f(mg), options: { align: 'right' } }, { text: (v.ventaNeta > 0 ? (mg / v.ventaNeta * 100).toFixed(1) : '0') + '%', options: { align: 'right' } }]) })
      const mgT = tot.ventaNeta - tot.costo; ur.push([{ text: 'TOTAL', options: { bold: true, fill: 'EEF6F8' } }, { text: UD(tot.unidades), options: { align: 'right', bold: true } }, { text: M$f(tot.ventaNeta), options: { align: 'right', bold: true } }, { text: M$f(tot.costo), options: { align: 'right', bold: true } }, { text: M$f(mgT), options: { align: 'right', bold: true } }, { text: (tot.ventaNeta > 0 ? (mgT / tot.ventaNeta * 100).toFixed(1) : '0') + '%', options: { align: 'right', bold: true } }])
      u2.addTable(ur, { x: 0.5, y: 1.1, w: 12.3, fontSize: 12, border: { type: 'solid', pt: 0.5, color: 'D7DDE3' }, valign: 'middle' })
      // Resultado operativo
      const f2 = pptx.addSlide(); f2.addText('Resultado operativo — ' + sbuName, { x: 0.7, y: 1.4, w: 12, h: 0.8, fontSize: 28, bold: true, color: TEAL })
      const rr = [[{ text: 'Concepto', options: { bold: true, color: 'FFFFFF', fill: TEAL } }, { text: '2028', options: { bold: true, color: 'FFFFFF', fill: TEAL, align: 'right' } }], [{ text: 'Contribución de la SBU' }, { text: M$f(tot.brand), options: { align: 'right' } }], [{ text: '(−) Gastos administrativos' }, { text: M$f(gadminAnual), options: { align: 'right' } }], [{ text: '= Resultado operativo', options: { bold: true } }, { text: M$f((tot.brand || 0) - gadminAnual), options: { align: 'right', bold: true } }]]
      f2.addTable(rr, { x: 2.5, y: 2.6, w: 8, fontSize: 16, border: { type: 'solid', pt: 0.5, color: 'D7DDE3' }, valign: 'middle', rowH: 0.5 })
      await pptx.writeFile({ fileName: `ABP_2028_${empresa}_${sbuName}.pptx`.replace(/\s+/g, '_') })
    } catch (e) { alert('No se pudo generar la presentación: ' + e.message) }
    setPpt(false)
  }
  return <button className="btn primary" disabled={ppt || !P} onClick={descargar} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }} title="Descarga los resultados de la SBU (contribución, margen, resultado operativo). No incluye las capturas/insumos.">{ppt ? 'Generando…' : (<><svg width="17" height="17" viewBox="0 0 24 24" fill="none" style={{ flex: '0 0 auto' }}><rect x="2" y="4" width="20" height="14" rx="2" fill="#D24726"/><rect x="6.5" y="8" width="7" height="6" rx="1" fill="#fff"/><path d="M6.5 8h4a2 2 0 0 1 0 4h-4z" fill="#fff"/><path d="M9 20h6" stroke="#D24726" strokeWidth="1.6" strokeLinecap="round"/><path d="M12 18v2" stroke="#D24726" strokeWidth="1.6" strokeLinecap="round"/></svg>Descargar resultados</>)}</button>
}

/* ===== CONTRIBUCIÓN DE LA SBU por SBU: todas las marcas lado a lado + comparación FY2026/FY2025 ===== */
function BrandContribSBU({ empresa, sbuName, marcasSBU }) {
  const [P, setP] = useState(null)
  useEffect(() => {
    (async () => {
      const g = async (t) => { try { const j = await gReadTab(t); return j.ok && j.values ? j.values.slice(1) : [] } catch { return [] } }
      const [ven, prod, cap, mk, log, dir] = await Promise.all([g('Cap_Ventas'), g('Cap_Producto'), g('Cap_Categorias'), g('Cap_Marketing'), g('Cap_Logistica'), g('Cap_Director')])
      let hist = []; try { const j = await gHistorico(); if (j && j.ok && j.values) hist = j.values.slice(1) } catch { }
      let plan = {}; try { const jp = await gPlan2027(); if (jp && jp.map) plan = jp.map } catch { }
      const cats = {}; cap.forEach((row) => { if (upper(row[0]) !== upper(empresa)) return; const c = row[1], mar = row[3], peso = num(row[4]); if (!mar || !c) return; (cats[mar] = cats[mar] || []).push({ cat: c, peso }) })
      setP({ ven, prod, cats, mk, log, dir, hist, plan })
    })()
  }, [empresa])

  if (!P) return <div className="panel"><h3>Contribución de la SBU — {sbuName}</h3><div className="sub">Cargando…</div></div>

  const inM = (r, mca) => upper(r[0]) === upper(empresa) && upper(r[3]) === upper(mca)
  const uniMes = (mca) => { const a = Array(12).fill(0); P.ven.forEach((r) => { if (!inM(r, mca)) return; if (String(r[1] || '').toUpperCase().startsWith('VIAJES')) return; for (let j = 0; j < 12; j++) a[j] += num(r[4 + j]) }); return a }
  const aupCat = (mca) => { const o = {}; P.prod.forEach((r) => { if (!inM(r, mca)) return; const rub = String(r[1] || ''); if (rub.indexOf('AUP · ') !== 0) return; o[rub.slice(6)] = MESES.map((_, j) => num(r[4 + j])) }); return o }
  const aucMes = (mca) => { const a = Array(12).fill(0); P.prod.forEach((r) => { if (!inM(r, mca) || upper(r[1]) !== 'AUC') return; for (let j = 0; j < 12; j++) a[j] = num(r[4 + j]) }); return a }
  const sumTab = (rows, mca, filt) => { let s = 0; rows.forEach((r) => { if (!inM(r, mca)) return; if (filt && !filt(String(r[1] || ''))) return; for (let j = 0; j < 12; j++) s += num(r[4 + j]) }); return s }
  const esViaje = (rub) => rub.toUpperCase().startsWith('VIAJES')

  const calc = (mca) => {
    const catNames = (P.cats[mca] || []).map((c) => c.cat)
    const r = realAupAuc(empresa, mca, P.ven, P.prod, catNames)
    const unidades = r.totalUnits.reduce((a, b) => a + b, 0), ventaNeta = r.ventaMes.reduce((a, b) => a + b, 0), costo = r.costoMes.reduce((a, b) => a + b, 0)
    const comisiones = 0, logistica = sumTab(P.log, mca), marketing = sumTab(P.mk, mca)
    const viajes = [P.ven, P.prod, P.mk, P.log, P.dir].reduce((t, rows) => t + sumTab(rows, mca, esViaje), 0)
    const margenBruto = ventaNeta - costo - comisiones - logistica
    const brand = margenBruto - marketing - viajes
    return { unidades, ventaNeta, costo, comisiones, logistica, margenBruto, marketing, viajes, brand }
  }
  const cols = (marcasSBU || []).map((m) => ({ m, v: calc(m) }))
  const tot = cols.reduce((acc, { v }) => { Object.keys(v).forEach((k) => acc[k] = (acc[k] || 0) + v[k]); return acc }, {})

  // FY histórico (solo Venta/Costo/Margen): suma de las marcas de la SBU por año
  const fy = (year, tipo) => { let s = 0; P.hist.forEach((r) => { if (String(r[1]) !== String(year)) return; if (!(marcasSBU || []).some((m) => upper(m) === upper(r[5]))) return; if (String(r[3] || '').toUpperCase().indexOf(tipo) < 0) return; s += num(r[7]) }); return s }
  const fyVenta = (y) => fy(y, 'VENTA'), fyCosto = (y) => fy(y, 'COSTO'), fyMargen = (y) => fyVenta(y) - fyCosto(y)
  // ABP 2027 (hoja PLAN del EBP): suma por marca de la SBU
  const abp = (campo) => (marcasSBU || []).reduce((s, m) => { const o = P.plan[upper(m)]; return s + (o ? o[campo] || 0 : 0) }, 0)
  const abpVenta = abp('venta'), abpCosto = abp('costo'), abpMargen = abpVenta - abpCosto
  // Gastos administrativos (compartidos por toda la empresa) — total anual
  const gadminAnual = (() => { try { const d = JSON.parse(localStorage.getItem(`gadmin_${empresa}`) || '{}'); let cfg = DEFAULT_GADMIN; try { const s = JSON.parse(localStorage.getItem(`gadmin_cfg_${empresa}`) || 'null'); if (Array.isArray(s) && s.length) cfg = s } catch { } return cfg.reduce((a, it) => a + MESES.reduce((s, _, m) => s + num(d[`${it.cod}|${m}`]), 0), 0) } catch { return 0 } })()

  const filas = [
    { k: 'Unidades', get: (v) => v.unidades },
    { k: 'Venta Neta', get: (v) => v.ventaNeta, strong: true, fy26: fyVenta(2026), fy25: fyVenta(2025), abp27: abpVenta },
    { k: '(−) Costo', get: (v) => v.costo, fy26: fyCosto(2026), fy25: fyCosto(2025), abp27: abpCosto },
    { k: '(−) Comisiones', get: (v) => v.comisiones },
    { k: '(−) Logística', get: (v) => v.logistica },
    { k: '= Margen Bruto', get: (v) => v.margenBruto, strong: true, fy26: fyMargen(2026), fy25: fyMargen(2025), abp27: abpMargen },
    { k: '(−) Marketing', get: (v) => v.marketing },
    { k: '(−) Viajes', get: (v) => v.viajes },
    { k: '= CONTRIBUCIÓN DE LA BU', get: (v) => v.brand, strong: true },
    { k: '(−) Gastos administrativos', get: () => 0, totVal: gadminAnual },
    { k: '🎯 = RESULTADO OPERATIVO', get: () => 0, totVal: (tot.brand || 0) - gadminAnual, strong: true },
  ]
  const dpct = (cur, ref) => (ref != null && Math.abs(ref) > 0.5) ? ((cur - ref) / Math.abs(ref) * 100) : null
  const dCell = (cur, ref, strong) => { const d = dpct(cur, ref); return <td className={'tot ' + (strong ? '' : '') + (d == null ? '' : d >= 0 ? 'pos' : 'neg')} style={{ fontWeight: 700, cursor: 'help' }} title={d == null ? 'Sin referencia para comparar' : `Variación % = (2028 − referencia) ÷ referencia\n2028 = ${fmt(cur)} vs referencia = ${fmt(ref)} → ${(d >= 0 ? '+' : '') + d.toFixed(0)}% (el 2028 está ${d >= 0 ? 'por encima' : 'por debajo'} de ese año)`}>{d == null ? '—' : (d >= 0 ? '+' : '') + d.toFixed(0) + '%'}</td> }

  return (
    <div className="panel">
      <h3 style={{ color: sbuColor(sbuName) }}>Contribución de la SBU — {sbuName}{M$} <span className="unit">(por marca · 2028 · solo lectura)</span></h3>
      <div className="tablewrap">
        <table className="vfix" style={{ width: 'auto', minWidth: 520 }}>
          <thead><tr><th className="l">Concepto</th>{cols.map(({ m }) => <th key={m} style={{ color: marcaColor(m) }}>{m}</th>)}<th>TOTAL 2028{Q('Consolidado: cada fila de esta columna es la suma de las marcas de la SBU (las columnas de la izquierda).')}</th><th className="ya">FY2025</th><th className="ya">Δ vs 25</th><th className="ya">FY2026</th><th className="ya">Δ vs 26</th><th className="yb">ABP 2027</th><th className="yb">Δ vs ABP27</th></tr></thead>
          <tbody>
            {filas.map((f) => { const cur = f.totVal != null ? f.totVal : f.get(tot); return (
              <tr key={f.k} className={f.strong ? 'grandrow' : undefined}>
                <td className="l">{f.k}</td>
                {cols.map(({ m, v }) => <td key={m} className="tot">{f.totVal != null ? '' : fmt(f.get(v))}</td>)}
                <td className="tot">{fmt(cur)}</td>
                <td className="tot ya">{f.fy25 != null ? fmt(f.fy25) : '—'}</td>
                {f.fy25 != null ? dCell(cur, f.fy25) : <td className="tot ya">—</td>}
                <td className="tot ya">{f.fy26 != null ? fmt(f.fy26) : '—'}</td>
                {f.fy26 != null ? dCell(cur, f.fy26) : <td className="tot ya">—</td>}
                <td className="tot yb">{f.abp27 != null ? fmt(f.abp27) : '—'}</td>
                {f.abp27 != null ? dCell(cur, f.abp27) : <td className="tot yb">—</td>}
              </tr>
            ) })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ===== VIAJES DEL EQUIPO: consolidado por rol/marca (vista Director) ===== */
function ViajesEquipo({ empresa, marca, sbuName, marcasSBU, modo = 'marca' }) {
  const rolesV = ROLES.filter((r) => r.rubros.some((rb) => rb.k === 'VIAJES'))
  const [tabs, setTabs] = useState(null)
  const [vref, setVref] = useState(null) // viajes de referencia (EBP): 2025/2026 por marca y SBU
  useEffect(() => {
    let cancel = false
    ;(async () => {
      const out = {}
      await Promise.all(rolesV.map(async (r) => { try { const j = await gReadTab(r.tab); out[r.tab] = (j && j.ok && j.values) ? j.values.slice(1) : [] } catch { out[r.tab] = [] } }))
      if (!cancel) setTabs(out)
      try { const v = await gViajesRef(); if (!cancel) setVref(v) } catch { }
    })()
    return () => { cancel = true }
  }, [empresa])
  const refMar = (mca, y) => (((vref || {}).marca || {})[upper(mca)] || {})[y] || 0
  const refSbu = (sb, y) => (((vref || {}).sbu || {})[upper(sb)] || {})[y] || 0

  const viajesMes = (tab, mca) => {
    const a = Array(12).fill(0)
    ;(tabs[tab] || []).forEach((r) => {
      if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(mca)) return
      if (!String(r[1] || '').toUpperCase().startsWith('VIAJES')) return
      for (let j = 0; j < 12; j++) a[j] += num(r[4 + j])
    })
    return a
  }
  const anual = (tab, mca) => viajesMes(tab, mca).reduce((s, v) => s + v, 0)

  if (!tabs) return <div className="panel"><h3>Viajes del equipo</h3><div className="sub">Cargando…</div></div>

  // Panel: viajes por área (rol × mes) para una marca
  const teamPanel = (mca) => {
    const filas = rolesV.map((r) => ({ r, mes: viajesMes(r.tab, mca), tot: anual(r.tab, mca) }))
    const totMarcaMes = MESES.map((_, mi) => filas.reduce((s, f) => s + f.mes[mi], 0))
    const totMarca = totMarcaMes.reduce((s, v) => s + v, 0)
    return (
      <div className="panel" key={mca}>
        <h3 style={{ color: marcaColor(mca) }}>Viajes del equipo — {mca} <span className="unit">(solo lectura · 2028)</span></h3>
        <div className="sub">Suma de los viajes que cada área captura para esta marca. El Director llena los suyos en la sección <b>Director</b>; aquí ve además los del resto del equipo y el total por marca.</div>
        <div className="tablewrap">
          <table className="vfix">
            <colgroup><col style={{ width: '160px' }} />{MESES.map((_, i) => <col key={i} style={{ width: '64px' }} />)}<col style={{ width: '80px' }} /></colgroup>
            <thead><tr><th className="l">Área</th>{MESES.map((m) => <th key={m}>{m.toUpperCase()}</th>)}<th>Total</th></tr></thead>
            <tbody>
              {filas.map((f) => <tr key={f.r.id}><td className="l">{f.r.icon} {f.r.label}</td>{f.mes.map((v, i) => <td key={i} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(f.tot)}</td></tr>)}
              <tr className="grandrow"><td className="l">Total {mca}</td>{totMarcaMes.map((v, i) => <td key={i} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(totMarca)}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="sub" style={{ marginTop: 6 }}>📎 <b>Referencia (EBP)</b> · Total gastado en viajes de {mca}: <b>2025</b> ${fmt(refMar(mca, 2025))} · <b>2026</b> ${fmt(refMar(mca, 2026))} {vref ? '' : '(cargando…)'}</div>
      </div>
    )
  }

  // Panel resumen: total de viajes por cada marca de la SBU
  const resumenPanel = (
    <div className="panel" key="__res">
      <h3 style={{ color: sbuColor(sbuName) }}>Viajes por marca — {sbuName}</h3>
      <div className="sub">Total de viajes del equipo por cada marca de la SBU, con el total de la SBU al final.</div>
      <div className="tablewrap">
        <table>
          <thead><tr><th className="l">Marca</th>{rolesV.map((r) => <th key={r.id}>{r.label}</th>)}<th>Total marca 2028</th><th className="ya">2025</th><th className="ya">2026</th></tr></thead>
          <tbody>
            {(marcasSBU || []).map((m) => { const cols = rolesV.map((r) => anual(r.tab, m)); const t = cols.reduce((s, v) => s + v, 0); return <tr key={m}><td className="l"><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: marcaColor(m), marginRight: 7 }}></span>{m}</td>{cols.map((v, i) => <td key={i} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(t)}</td><td className="tot ya">{fmt(refMar(m, 2025))}</td><td className="tot ya">{fmt(refMar(m, 2026))}</td></tr> })}
            <tr className="grandrow"><td className="l">Total {sbuName}{Q('Consolidado = suma de los viajes de cada marca:\n' + (marcasSBU || []).map((m) => `${m}: ${fmt(rolesV.reduce((a, r) => a + anual(r.tab, m), 0))}`).join('\n'))}</td>{rolesV.map((r) => <td key={r.id} className="tot">{fmt((marcasSBU || []).reduce((s, m) => s + anual(r.tab, m), 0))}</td>)}<td className="tot">{fmt((marcasSBU || []).reduce((s, m) => s + rolesV.reduce((a, r) => a + anual(r.tab, m), 0), 0))}</td><td className="tot ya">{fmt(refSbu(sbuName, 2025))}</td><td className="tot ya">{fmt(refSbu(sbuName, 2026))}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )

  // Vista TOTAL SBU: resumen por marca + una tabla de equipo por cada marca
  if (modo === 'total') return (<>{resumenPanel}{(marcasSBU || []).map((m) => teamPanel(m))}</>)
  // Vista por marca: solo la tabla de equipo de esa marca
  return teamPanel(marca)
}

/* ===== RESUMEN POR MARCA: Marketing / Unidades·Venta·Costo·Margen (vista TOTAL SBU) ===== */
function ResumenMarcas({ empresa, sbuName, marcasSBU, vista }) {
  const [P, setP] = useState(null)
  const [mkref, setMkref] = useState(null) // marketing de referencia (EBP) 2025/2026
  const [colapsadas, setColapsadas] = useState({}) // marcas con su detalle de categorías oculto
  const toggleCat = (m) => setColapsadas((c) => ({ ...c, [m]: !c[m] }))
  useEffect(() => { let x = false; (async () => { try { const v = await gMkRef(); if (!x) setMkref(v) } catch { } })(); return () => { x = true } }, [empresa])
  const mkRefM = (m, y) => (((mkref || {}).marca || {})[upper(m)] || {})[y] || 0
  const mkRefS = (sb, y) => (((mkref || {}).sbu || {})[upper(sb)] || {})[y] || 0
  useEffect(() => {
    (async () => {
      const g = async (t) => { try { const j = await gReadTab(t); return j.ok && j.values ? j.values.slice(1) : [] } catch { return [] } }
      const [ven, prod, cap, mk] = await Promise.all([g('Cap_Ventas'), g('Cap_Producto'), g('Cap_Categorias'), g('Cap_Marketing')])
      let hist = []; try { const jh = await gHistorico(); if (jh && jh.ok && jh.values) hist = jh.values.slice(1) } catch { }
      const cats = {}; cap.forEach((row) => { if (upper(row[0]) !== upper(empresa)) return; const c = row[1], mar = row[3]; if (!mar || !c) return; (cats[mar] = cats[mar] || []).push(c) })
      setP({ ven, prod, cats, mk, hist })
    })()
  }, [empresa])
  if (!P) return <div className="panel"><h3 style={{ color: sbuColor(sbuName) }}>Resumen — {sbuName}</h3><div className="sub">Cargando…</div></div>
  const inM = (r, mca) => upper(r[0]) === upper(empresa) && upper(r[3]) === upper(mca)
  const esViaje = (rub) => String(rub || '').toUpperCase().startsWith('VIAJES')
  const marcas = marcasSBU || []

  if (vista === 'mk') {
    const mkMes = (mca) => { const a = Array(12).fill(0); P.mk.forEach((r) => { if (!inM(r, mca) || esViaje(r[1])) return; for (let j = 0; j < 12; j++) a[j] += num(r[4 + j]) }); return a }
    const filas = marcas.map((m) => { const mes = mkMes(m); return { m, mes, tot: mes.reduce((s, v) => s + v, 0) } })
    const totMes = MESES.map((_, mi) => filas.reduce((s, f) => s + f.mes[mi], 0))
    const gt = totMes.reduce((s, v) => s + v, 0)
    return (
      <div className="panel">
        <h3 style={{ color: sbuColor(sbuName) }}>Marketing por marca — {sbuName}{M$} <span className="unit">(solo lectura · 2028)</span></h3>
        <div className="sub">Total de marketing que el equipo captura por cada marca de la SBU, mes a mes, con el total de la SBU al final.</div>
        <div className="tablewrap">
          <table className="vfix">
            <colgroup><col style={{ width: '160px' }} />{MESES.map((_, i) => <col key={i} style={{ width: '64px' }} />)}<col style={{ width: '90px' }} /></colgroup>
            <thead><tr><th className="l">Marca</th>{MESES.map((m) => <th key={m}>{m.toUpperCase()}</th>)}<th>Total 2028</th><th className="ya">2025</th><th className="ya">2026</th></tr></thead>
            <tbody>
              {filas.map((f) => <tr key={f.m}><td className="l"><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: marcaColor(f.m), marginRight: 7 }}></span>{f.m}</td>{f.mes.map((v, i) => <td key={i} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(f.tot)}</td><td className="tot ya">{fmt(mkRefM(f.m, 2025))}</td><td className="tot ya">{fmt(mkRefM(f.m, 2026))}</td></tr>)}
              <tr className="grandrow"><td className="l">Total {sbuName}{Q('Consolidado = suma del marketing de cada marca:\n' + filas.map((f) => `${f.m}: ${fmt(f.tot)}`).join('\n'))}</td>{totMes.map((v, i) => <td key={i} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(gt)}</td><td className="tot ya">{fmt(mkRefS(sbuName, 2025))}</td><td className="tot ya">{fmt(mkRefS(sbuName, 2026))}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }
  // vista === 'ucvm'
  const aupCatDe = (mca) => { const o = {}; P.prod.forEach((r) => { if (!inM(r, mca)) return; const rub = String(r[1] || ''); if (rub.indexOf('AUP · ') === 0) o[rub.slice(6)] = MESES.map((_, j) => num(r[4 + j])) }); return o }
  const aucCatDe = (mca) => { const o = {}; P.prod.forEach((r) => { if (!inM(r, mca)) return; const rub = String(r[1] || ''); if (rub.indexOf('AUC · ') === 0) o[rub.slice(6)] = MESES.map((_, j) => num(r[4 + j])); else if (upper(rub) === 'AUC') { const base = MESES.map((_, j) => num(r[4 + j])); (P.cats[mca] || []).forEach((c) => { if (!o[c]) o[c] = base }) } }); return o }
  const calc = (mca) => {
    const catNames = (P.cats[mca] || [])
    const r = realAupAuc(empresa, mca, P.ven, P.prod, catNames)
    const aup = aupCatDe(mca), auc = aucCatDe(mca)
    const catRows = (catNames.length ? catNames : ['General']).map((c) => {
      const uc = r.unitsCat[c] || []
      const unid = uc.reduce((a, b) => a + b, 0)
      const venta = MESES.reduce((a, _, m) => a + (uc[m] || 0) * ((aup[c] || [])[m] || 0), 0)
      const costo = MESES.reduce((a, _, m) => a + (uc[m] || 0) * ((auc[c] || [])[m] || 0), 0)
      return { c, unidades: unid, venta, costo, margen: venta - costo }
    }).filter((x) => x.unidades > 0.5 || x.venta > 0.5)
    const unidades = r.totalUnits.reduce((a, b) => a + b, 0), venta = r.ventaMes.reduce((a, b) => a + b, 0), costo = r.costoMes.reduce((a, b) => a + b, 0)
    return { unidades, venta, costo, margen: venta - costo, catRows }
  }
  const rows = marcas.map((m) => ({ m, v: calc(m) }))
  const tot = rows.reduce((a, { v }) => { a.unidades += v.unidades; a.venta += v.venta; a.costo += v.costo; a.margen += v.margen; return a }, { unidades: 0, venta: 0, costo: 0, margen: 0 })
  const mpct = (v) => v.venta > 0 ? (v.margen / v.venta * 100) : null

  // Por cliente y marca: unidades 2028 (Cap_Ventas) vs 2026 (histórico EBP) + crecimiento; los clientes nuevos también salen
  const uni2028 = (mca) => { const o = {}; P.ven.forEach((r) => { if (!inM(r, mca)) return; const cli = String(r[1] || '').trim(); if (!cli) return; let s = 0; for (let j = 0; j < 12; j++) s += Math.max(0, num(r[4 + j])); o[cli] = (o[cli] || 0) + s }); return o }
  const uni2026 = (mca) => { const o = {}; (P.hist || []).forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[5]) !== upper(mca) || String(r[1]) !== '2026') return; if (upper(r[3]).indexOf('UNIDAD') < 0) return; const cli = String(r[8] || '').trim(); if (!cli) return; o[cli] = (o[cli] || 0) + num(r[7]) }); return o }
  const cliRows = marcas.map((mca) => {
    const u28 = uni2028(mca), u26 = uni2026(mca)
    const clientes = [...new Set([...Object.keys(u28), ...Object.keys(u26)])].sort((a, b) => a.localeCompare(b))
    const filas = clientes.map((cli) => { const a = Math.round(u26[cli] || 0), b = Math.round(u28[cli] || 0); return { cli, u26: a, u28: b, nuevo: a === 0 && b > 0, crec: a > 0 ? (b - a) / a * 100 : null } }).filter((f) => f.u26 > 0 || f.u28 > 0).sort((x, y) => y.u28 - x.u28)
    return { mca, filas, t26: filas.reduce((s, f) => s + f.u26, 0), t28: filas.reduce((s, f) => s + f.u28, 0) }
  }).filter((s) => s.filas.length > 0)
  const crecCell = (f) => f.nuevo ? <td className="tot" style={{ color: 'var(--odoo)', fontWeight: 800 }}>🆕 nuevo</td> : <td className={'tot ' + (f.crec == null ? '' : f.crec >= 0 ? 'pos' : 'neg')}>{f.crec == null ? '—' : (f.crec >= 0 ? '+' : '') + f.crec.toFixed(0) + '%'}</td>

  return (
    <>
      <div className="panel">
        <h3 style={{ color: sbuColor(sbuName) }}>Unidades · Venta · Costo · Margen — {sbuName}{M$} <span className="unit">(por marca y categoría · 2028 · solo lectura)</span></h3>
        <div className="sub">Resumen por marca de la SBU, desglosado por <b>categoría</b>. El <b>margen</b> es Venta Neta − Costo (margen bruto de producto), calculado con la mezcla real de categorías por cliente. <span className="unit">Haz clic en una marca para ocultar o mostrar sus categorías.</span></div>
        <div className="tablewrap">
          <table>
            <thead><tr><th className="l">Marca / Categoría</th><th>Unidades</th><th>Venta Neta</th><th>Costo</th><th>Margen</th><th>Margen %</th></tr></thead>
            <tbody>
              {rows.map(({ m, v }) => { const abierta = !colapsadas[m]; return (
                <Fragment2 key={m}>
                  <tr className="sburow rowline" onClick={() => toggleCat(m)} style={{ cursor: 'pointer' }} title={abierta ? 'Ocultar categorías' : 'Mostrar categorías'}><td className="l" style={{ color: marcaColor(m) }}><span className="caret" style={{ color: marcaColor(m) }}>{v.catRows.length ? (abierta ? '▾' : '▸') : ''}</span> <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: marcaColor(m), marginRight: 7 }}></span>{m}</td><td className="tot">{fmt(v.unidades)}</td><td className="tot">{fmt(v.venta)}</td><td className="tot">{fmt(v.costo)}</td><td className="tot">{fmt(v.margen)}</td><td className="tot">{mpct(v) == null ? '—' : mpct(v).toFixed(0) + '%'}</td></tr>
                  {abierta && v.catRows.map((c) => <tr key={m + '|' + c.c}><td className="l sub2">{c.c}</td><td className="tot">{fmt(c.unidades)}</td><td className="tot">{fmt(c.venta)}</td><td className="tot">{fmt(c.costo)}</td><td className="tot">{fmt(c.margen)}</td><td className="tot">{c.venta > 0 ? (c.margen / c.venta * 100).toFixed(0) + '%' : '—'}</td></tr>)}
                </Fragment2>
              ) })}
              <tr className="grandrow"><td className="l">Total {sbuName}{Q('Consolidado = suma de las marcas de la SBU:\n' + rows.map(({ m, v }) => `${m}: ${fmt(v.unidades)} ud · venta ${fmt(v.venta)} · margen ${fmt(v.margen)}`).join('\n'))}</td><td className="tot">{fmt(tot.unidades)}</td><td className="tot">{fmt(tot.venta)}</td><td className="tot">{fmt(tot.costo)}</td><td className="tot">{fmt(tot.margen)}</td><td className="tot">{tot.venta > 0 ? (tot.margen / tot.venta * 100).toFixed(0) + '%' : '—'}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h3 style={{ color: sbuColor(sbuName) }}>Unidades por cliente y marca — {sbuName} <span className="unit">(2028 vs 2026 · solo lectura)</span></h3>
        <div className="sub">Por cada cliente: unidades <b>2028</b> (capturadas en Ventas) vs <b>2026</b> (histórico del EBP) y su <b>crecimiento</b>. Los clientes <b>nuevos</b> (sin 2026) también aparecen, marcados 🆕.</div>
        <div className="tablewrap">
          <table>
            <thead><tr><th className="l">Marca / Cliente</th><th>Unid. 2026</th><th>Unid. 2028</th><th>Peso 2028 %</th><th>Crecimiento</th></tr></thead>
            <tbody>
              {cliRows.length === 0 && <tr><td className="l" colSpan={5}>Aún no hay clientes con histórico ni capturados en Ventas para las marcas de esta SBU.</td></tr>}
              {cliRows.map(({ mca, filas, t26, t28 }) => (
                <Fragment2 key={mca}>
                  <tr className="sburow"><td className="l" style={{ color: marcaColor(mca) }}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: marcaColor(mca), marginRight: 7 }}></span>{mca}</td><td className="tot">{fmt(t26)}</td><td className="tot">{fmt(t28)}</td><td className="tot">{t28 > 0 ? '100.0%' : '—'}</td><td className="tot">{t26 > 0 ? ((t28 - t26) / t26 * 100 >= 0 ? '+' : '') + ((t28 - t26) / t26 * 100).toFixed(0) + '%' : '—'}</td></tr>
                  {filas.map((f) => <tr key={mca + '|' + f.cli}><td className="l sub2">{f.cli}{f.nuevo && <span className="unit" style={{ marginLeft: 6, color: 'var(--odoo)', fontWeight: 700 }}>🆕</span>}</td><td className="tot">{fmt(f.u26)}</td><td className="tot">{fmt(f.u28)}</td><td className="tot">{t28 > 0 ? (f.u28 / t28 * 100).toFixed(1) + '%' : '—'}</td>{crecCell(f)}</tr>)}
                </Fragment2>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

/* ===== RESUMEN DE LOGÍSTICA POR MARCA (vista TOTAL SBU, solo lectura) ===== */
function LogisticaResumen({ empresa, sbuName, marcasSBU }) {
  const [ventas, setVentas] = useState([]); const [producto, setProducto] = useState([])
  const [tData, setTData] = useState({}); const [logd, setLogd] = useState({}); const [precios, setPrecios] = useState({})
  useEffect(() => {
    try { setTData(JSON.parse(localStorage.getItem(`temp_${empresa}`) || '{}')) } catch { }
    try { setLogd(JSON.parse(localStorage.getItem(`logcost_${empresa}`) || '{}')) } catch { }
    try { setPrecios(JSON.parse(localStorage.getItem(`precios_${empresa}`) || '{}')) } catch { }
    ;(async () => {
      try { const j = await gReadTab('Cap_Ventas'); if (j && j.ok && j.values) setVentas(j.values.slice(1)) } catch { }
      try { const j2 = await gReadTab('Cap_Producto'); if (j2 && j2.ok && j2.values) setProducto(j2.values.slice(1)) } catch { }
    })()
  }, [empresa])
  const marcas = marcasSBU || []
  const calc = (marca) => {
    const inv = inventarioCalc(tData, marca, ventaMarcaMes(ventas, empresa, marca))
    const g = (k) => num(logd[k])
    const auc = MESES.map((_, m) => { let v = 0; producto.forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(marca) || upper(r[1]) !== 'AUC') return; v = num(r[4 + m]) }); return v })
    const ventaUnits = MESES.map((_, m) => { let s = 0; ventas.forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(marca)) return; if (String(r[1] || '').toUpperCase().startsWith('VIAJES')) return; s += num(r[4 + m]) }); return s })
    const costoVenta = MESES.map((_, m) => ventaUnits[m] * auc[m])
    const comprasUsd = MESES.map((_, m) => SEASONS.reduce((a, s) => a + num(tData[`CP|${marca}|${s}|${m}`]), 0) * auc[m])
    const saldoValue = MESES.map((_, m) => SEASONS.reduce((a, s) => a + inv.flujos[s][m].fin * seasonAUCfrom(precios, marca, s), 0))
    const costoLog = MESES.map((_, m) => costoVenta[m] * g(`${marca}|PCT_LOGVENTA`) / 100)
    const costoMue = MESES.map((_, m) => comprasUsd[m] * g(`${marca}|PCT_MUESTRAS`) / 100)
    const mant = MESES.map((_, m) => saldoValue[m] * g(`${marca}|PCT_MANT`) / 100)
    const totalMes = MESES.map((_, m) => costoLog[m] + costoMue[m] + mant[m])
    const sum = (a) => a.reduce((x, y) => x + y, 0)
    return { pctLog: g(`${marca}|PCT_LOGVENTA`), pctMue: g(`${marca}|PCT_MUESTRAS`), pctMant: g(`${marca}|PCT_MANT`), log: sum(costoLog), mue: sum(costoMue), mant: sum(mant), totalMes, total: sum(totalMes) }
  }
  const rows = marcas.map((m) => ({ m, v: calc(m) }))
  const tot = rows.reduce((a, { v }) => { a.log += v.log; a.mue += v.mue; a.mant += v.mant; a.total += v.total; v.totalMes.forEach((x, i) => a.totalMes[i] += x); return a }, { log: 0, mue: 0, mant: 0, total: 0, totalMes: Array(12).fill(0) })
  return (
    <>
      <div className="panel">
        <h3 style={{ color: sbuColor(sbuName) }}>Logística por marca — {sbuName}{M$} <span className="unit">(por marca · 2028 · solo lectura)</span></h3>
        <div className="sub">Costos logísticos por marca: <b>logístico de venta</b> (% × costo de venta), <b>muestras</b> (% × compras) y <b>mantenimiento de stock</b> (% × valor del saldo de inventario). Los % los pone cada área de Logística.</div>
        <div className="tablewrap">
          <table>
            <thead><tr><th className="l">Marca</th><th>% Log. venta</th><th>% Muestras</th><th>% Mant.</th><th>Costo logístico</th><th>Muestras</th><th>Mantenimiento</th><th>TOTAL</th></tr></thead>
            <tbody>
              {rows.map(({ m, v }) => <tr key={m}><td className="l"><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: marcaColor(m), marginRight: 7 }}></span>{m}</td><td className="tot">{fmt(v.pctLog)}%</td><td className="tot">{fmt(v.pctMue)}%</td><td className="tot">{fmt(v.pctMant)}%</td><td className="tot">{fmt(v.log)}</td><td className="tot">{fmt(v.mue)}</td><td className="tot">{fmt(v.mant)}</td><td className="tot">{fmt(v.total)}</td></tr>)}
              <tr className="grandrow"><td className="l">Total {sbuName}{Q('Consolidado = suma de los costos logísticos de cada marca:\n' + rows.map(({ m, v }) => `${m}: ${fmt(v.total)}`).join('\n'))}</td><td></td><td></td><td></td><td className="tot">{fmt(tot.log)}</td><td className="tot">{fmt(tot.mue)}</td><td className="tot">{fmt(tot.mant)}</td><td className="tot">{fmt(tot.total)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel">
        <h3 style={{ color: sbuColor(sbuName) }}>Costo logístico total por marca y mes — {sbuName}{M$} <span className="unit">(solo lectura)</span></h3>
        <div className="sub">Total de costos logísticos (logístico + muestras + mantenimiento) de cada marca, mes a mes, con el total de la SBU al final.</div>
        <div className="tablewrap">
          <table className="vfix">
            <colgroup><col style={{ width: '160px' }} />{MESES.map((_, i) => <col key={i} style={{ width: '64px' }} />)}<col style={{ width: '90px' }} /></colgroup>
            <thead><tr><th className="l">Marca</th>{MESES.map((m) => <th key={m}>{m.toUpperCase()}</th>)}<th>Total</th></tr></thead>
            <tbody>
              {rows.map(({ m, v }) => <tr key={m}><td className="l"><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: marcaColor(m), marginRight: 7 }}></span>{m}</td>{v.totalMes.map((x, i) => <td key={i} className="tot">{fmt(x)}</td>)}<td className="tot">{fmt(v.total)}</td></tr>)}
              <tr className="grandrow"><td className="l">Total {sbuName}{Q('Consolidado = suma del costo logístico total de cada marca:\n' + rows.map(({ m, v }) => `${m}: ${fmt(v.total)}`).join('\n'))}</td>{tot.totalMes.map((x, i) => <td key={i} className="tot">{fmt(x)}</td>)}<td className="tot">{fmt(tot.total)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

/* ===== COMBINACIONES ===== */
function ConfigScreen({ empresas, setEmpresas, combos, setCombos, nuevaEmpresa, abrirHistorico, ebSbus }) {
  const [empresa, setEmpresa] = useState(empresas[0])
  const [asign, setAsign] = useState(() => seedWith(combos[empresa], [...ALL_MARCAS]))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [colabs, setColabs] = useState([])
  const [savingC, setSavingC] = useState(false)
  const [msgC, setMsgC] = useState(null)
  useEffect(() => {
    (async () => { try { const j = await gReadTab('Cap_Colaboradores'); if (j && j.ok && j.values) { const out = []; j.values.slice(1).forEach((row) => { if (upper(row[0]) !== upper(empresa)) return; out.push({ nombre: row[1] || '', rol: row[2] || '', email: row[3] || '', acceso: String(row[4] || '').split(';').filter(Boolean), todas: upper(row[5]) === 'TODAS', sbu: row[6] || '' }) }); setColabs(out) } else setColabs([]) } catch { } })()
  }, [empresa])
  function toggleAcceso(i, op) { setColabs(colabs.map((x, j) => j === i ? { ...x, acceso: (x.acceso || []).includes(op) ? x.acceso.filter((a) => a !== op) : [...(x.acceso || []), op] } : x)) }
  const [adminsTxt, setAdminsTxt] = useState('')
  const [savingA, setSavingA] = useState(false)
  const [msgA, setMsgA] = useState(null)
  useEffect(() => { (async () => { try { const a = await gLoadAdmins(); setAdminsTxt(a.join('\n')) } catch { } })() }, [])
  async function guardarAdmins() {
    setSavingA(true); setMsgA(null)
    try { await gSaveAdmins(adminsTxt.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)); setMsgA({ t: 'ok', x: 'Administradores guardados.' }) } catch (e) { setMsgA({ t: 'bad', x: 'No se pudo: ' + e.message }) }
    setSavingA(false)
  }
  async function guardarColabs() {
    setSavingC(true); setMsgC(null)
    const rows = colabs.filter((c) => String(c.email).trim() || String(c.nombre).trim()).map((c) => ({ rubro: c.nombre, sbu: c.rol, marca: c.email, meses: [(c.acceso || []).join(';'), c.todas ? 'TODAS' : '', c.sbu || ''] }))
    await postToTab('Cap_Colaboradores', empresa, '', 'Config', rows, setMsgC)
    setSavingC(false)
  }

  const [extraMarcas, setExtraMarcas] = useState([])
  useEffect(() => { (async () => { try { const m = await gLoadMarcas(); setExtraMarcas(m); setAsign((prev) => seedWith(combos[empresa], [...ALL_MARCAS, ...m])) } catch { } })() }, [])
  const allMarcas = [...new Set([...ALL_MARCAS, ...extraMarcas, ...(ebSbus ? Object.values(ebSbus).flat() : [])])]
  function cargarDeEBP() {
    if (!ebSbus || !Object.keys(ebSbus).length) { setMsg({ t: 'warn', x: 'Aún no hay datos del EBP para cargar. Entra a una SBU para que cargue el histórico y vuelve.' }); return }
    const m = {}; allMarcas.forEach((mk) => { m[mk] = '' })
    Object.entries(ebSbus).forEach(([s, ms]) => ms.forEach((mk) => { if (SBU_NAMES.includes(s)) m[mk] = s }))
    setAsign(m); setMsg({ t: 'ok', x: 'Cargado desde el EBP. Revisa y pulsa 💾 Guardar combinaciones para dejarlo fijo.' })
  }
  function seedWith(c, lista) { const m = {}; lista.forEach((mk) => { m[mk] = '' }); if (c) { SBU_NAMES.forEach((s) => (c[s] || []).forEach((mk) => { m[mk] = s })); (c['NO VENDE'] || []).forEach((mk) => { m[mk] = 'NO' }) } return m }
  function seed(c) { return seedWith(c, [...ALL_MARCAS, ...extraMarcas]) }
  async function agregarMarca() {
    const n = window.prompt('Nombre de la nueva marca:'); if (!n) return
    const nm = n.trim().toUpperCase()
    if (allMarcas.map((x) => x.toUpperCase()).includes(nm)) { setMsg({ t: 'warn', x: 'Esa marca ya existe.' }); return }
    const next = [...extraMarcas, nm]; setExtraMarcas(next); setAsign({ ...asign, [nm]: '' })
    try { await gSaveMarcas(next); setMsg({ t: 'ok', x: 'Marca agregada: ' + nm + '. Asígnala a una SBU y guarda.' }) } catch (e) { setMsg({ t: 'bad', x: 'No se pudo guardar la marca: ' + e.message }) }
  }
  function cambiarEmpresa(e) { setEmpresa(e); setAsign(seed(combos[e])); setMsg(null) }
  async function borrarEmpresa() {
    if (SEED_EMPRESAS.includes(empresa)) { setMsg({ t: 'warn', x: empresa + ' es una empresa base del sistema y no se puede eliminar.' }); return }
    if (!window.confirm(`¿Eliminar la empresa "${empresa}"?\n\nSe quita de la lista y de las combinaciones de SBU. Los datos ya capturados en las hojas (ventas, cash flow, etc.) NO se borran, pero dejarán de mostrarse. Esta acción no se puede deshacer desde aquí.`)) return
    setSaving(true); setMsg(null)
    try {
      await gDeleteEmpresa(empresa)
      const restantes = empresas.filter((x) => x !== empresa)
      setEmpresas(restantes)
      const nc = { ...combos }; delete nc[empresa]; setCombos(nc)
      const sig = restantes[0] || 'ENERGY BRANDS'
      setEmpresa(sig); setAsign(seed(combos[sig]))
      try { localStorage.setItem('abp_cfg', JSON.stringify({ empresas: restantes.filter((x) => !SEED_EMPRESAS.includes(x)), combos: nc })) } catch { }
      setMsg({ t: 'ok', x: 'Empresa eliminada: ' + empresa + '.' })
    } catch (e) { setMsg({ t: 'bad', x: 'No se pudo eliminar: ' + e.message }) }
    setSaving(false)
  }

  async function guardar() {
    setSaving(true); setMsg(null)
    const cc = { 'SBU 1': [], 'SBU 2': [], 'SBU 3': [], 'NO VENDE': [] }
    Object.entries(asign).forEach(([mk, s]) => { if (s === 'NO') cc['NO VENDE'].push(mk); else if (s) cc[s].push(mk) })
    try {
      const j = await gSaveConfig(empresa, cc)
      if (j.ok) { setCombos({ ...combos, [empresa]: cc }); if (!empresas.includes(empresa)) setEmpresas([...empresas, empresa]); setMsg({ t: 'ok', x: 'Combinaciones guardadas para ' + empresa + '.' }) }
      else setMsg({ t: 'bad', x: 'Error al guardar.' })
    } catch (e) { setMsg({ t: 'bad', x: 'No se pudo guardar: ' + e.message }) }
    setSaving(false)
  }
  const cuenta = (s) => Object.values(asign).filter((v) => v === s).length

  return (
    <>
      <div className="toolbar">
        <label>Empresa</label>
        <select value={empresa} onChange={(e) => cambiarEmpresa(e.target.value)}>{empresas.map((e) => <option key={e}>{e}</option>)}</select>
        <button className="btn" onClick={nuevaEmpresa}>＋ Nueva empresa</button>
        {!SEED_EMPRESAS.includes(empresa) && <button className="btn" onClick={borrarEmpresa} style={{ color: '#b91c1c', borderColor: '#f0c9c9' }}>🗑️ Eliminar empresa</button>}
        <button className="btn" onClick={agregarMarca}>➕ Agregar marca</button>
        {empresa === 'ENERGY BRANDS' && <button className="btn" onClick={cargarDeEBP}>⚡ Cargar de EBP</button>}
        <div className="spacer"></div>
        <button className="btn primary" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : '💾 Guardar combinaciones'}</button>
      </div>
      {msg && <div className={'note ' + msg.t}>{msg.x}</div>}
      <div className="panel">
        <h3>Histórico por empresa</h3>
        <div className="sub">ENERGY BRANDS se alimenta en vivo del EBP. Para <b>TUMAR / TAHO</b> importa su histórico desde un Excel (con la columna EMPRESA correspondiente).</div>
        <button className="btn" onClick={() => abrirHistorico && abrirHistorico()}>📊 Abrir Histórico / Importar Excel</button>
      </div>
      <div className="panel">
        <h3>Combinaciones de SBU — {empresa}<span className="fill-badge">✏️ para llenar</span></h3>
        <div className="sub">Asigna cada marca a una SBU (o "No la vende" para excluirla de esta empresa). ({cuenta('SBU 1')} en SBU 1 · {cuenta('SBU 2')} en SBU 2 · {cuenta('SBU 3')} en SBU 3 · {cuenta('NO')} no la vende)</div>
        <div className="tablewrap">
          <table>
            <thead><tr><th className="l">Marca</th><th>SBU asignada</th></tr></thead>
            <tbody>
              {allMarcas.map((mk) => (
                <tr key={mk}><td className="l">{mk}</td><td>
                  <select value={asign[mk] || ''} onChange={(e) => setAsign({ ...asign, [mk]: e.target.value })}>
                    <option value="">— sin asignar —</option>
                    {SBU_NAMES.map((s) => <option key={s} value={s}>{s}</option>)}
                    <option value="NO">🚫 No la vende</option>
                  </select>
                </td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="toolbar">
        <button className="btn" onClick={() => setColabs([...colabs, { nombre: '', email: '', rol: ROLES[0].label, acceso: [], todas: false }])}>➕ Agregar colaborador</button>
        <div className="spacer"></div>
        <button className="btn primary" disabled={savingC} onClick={guardarColabs}>{savingC ? 'Guardando…' : '💾 Guardar colaboradores'}</button>
      </div>
      {msgC && <div className={'note ' + msgC.t}>{msgC.x}</div>}
      <div className="panel">
        <h3>Colaboradores — {empresa}<span className="fill-badge">✏️ para llenar</span></h3>
        <div className="sub">Quién llena cada parte del ABP en esta empresa. Al entrar, a cada persona le sale <b>{empresa}</b> por defecto. Marca <b>"Ve todas las empresas"</b> para quien deba cambiar entre empresas (los administradores siempre las ven todas).</div>
        <div className="tablewrap">
          <table>
            <thead><tr><th className="l">Nombre del colaborador</th><th className="l">Email</th><th>Rol</th><th>SBU</th><th className="l">Acceso a pestañas</th><th>Ve todas las empresas</th><th></th></tr></thead>
            <tbody>
              {colabs.length === 0 && <tr><td className="l" colSpan={7}>Agrega colaboradores con el botón de arriba.</td></tr>}
              {colabs.map((c, i) => (
                <tr key={i}>
                  <td className="l"><input style={{ width: '95%', padding: '6px' }} value={c.nombre} onChange={(e) => setColabs(colabs.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))} placeholder="Nombre" /></td>
                  <td className="l"><input style={{ width: '95%', padding: '6px' }} value={c.email} onChange={(e) => setColabs(colabs.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} placeholder="correo@empresa.com" /></td>
                  <td><select value={c.rol} onChange={(e) => setColabs(colabs.map((x, j) => j === i ? { ...x, rol: e.target.value } : x))}>{ROLES.map((r) => <option key={r.id}>{r.label}</option>)}</select></td>
                  <td><select value={c.sbu || ''} onChange={(e) => setColabs(colabs.map((x, j) => j === i ? { ...x, sbu: e.target.value } : x))}><option value="">Todas / General</option>{['SBU 1', 'SBU 2', 'SBU 3', 'Retail'].map((s) => <option key={s}>{s}</option>)}</select></td>
                  <td className="l"><div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{ACCESO_OPCIONES.map((op) => { const on = (c.acceso || []).includes(op); return <span key={op} onClick={() => toggleAcceso(i, op)} style={{ cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 12, background: on ? 'var(--odoo)' : '#eceef1', color: on ? '#fff' : '#5a6068' }}>{op}</span> })}</div></td>
                  <td><input type="checkbox" checked={!!c.todas} onChange={(e) => setColabs(colabs.map((x, j) => j === i ? { ...x, todas: e.target.checked } : x))} /></td>
                  <td><button className="btn" onClick={() => setColabs(colabs.filter((_, j) => j !== i))}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="toolbar" style={{ marginTop: 8 }}>
        <button className="btn primary" disabled={savingA} onClick={guardarAdmins}>{savingA ? 'Guardando…' : '💾 Guardar administradores'}</button>
        {msgA && <span className={'note ' + msgA.t} style={{ margin: 0, padding: '6px 10px' }}>{msgA.x}</span>}
      </div>
      <div className="panel">
        <h3>Administradores <span className="unit">(ven Gerencia y Combinaciones)</span><span className="fill-badge">✏️ para llenar</span></h3>
        <div className="sub">Escribe un correo por línea. Estas personas verán el tablero de <b>Gerencia</b> y esta pantalla de configuración. (Tu correo siempre es administrador.)</div>
        <textarea value={adminsTxt} onChange={(e) => setAdminsTxt(e.target.value)} placeholder={'ana@energybrandsgroup.com\njuan@energybrandsgroup.com'} style={{ width: '100%', minHeight: 100, padding: 10, border: '1px solid var(--line)', borderRadius: 8, font: 'inherit' }} />
      </div>
    </>
  )
}

/* ===== HISTÓRICO ===== */
const HIST_HEAD = ['EMPRESA', 'AÑO', 'TIPO', 'RUBRO', 'SBU', 'MARCA', 'MES', 'MONTO', 'CLIENTE', 'PAIS']
function HistoricoScreen() {
  const [values, setValues] = useState([])
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [limite, setLimite] = useState(20)
  const [fAnio, setFAnio] = useState('')
  const [fMarca, setFMarca] = useState('')
  const [vista, setVista] = useState('ambos')
  const [cmpSbu, setCmpSbu] = useState('')
  const [cmpMarca, setCmpMarca] = useState('')
  const [pVista, setPVista] = useState('ambos')
  const [pSbu, setPSbu] = useState('')
  const [pMarca, setPMarca] = useState('')

  useEffect(() => { cargar() }, [])
  async function cargar() {
    try { const j = await gHistorico(); if (j.ok && j.values) setValues(j.values) } catch { }
  }
  function importar(ev) {
    const file = ev.target.files[0]; if (!file) return
    const XLSX = window.XLSX
    if (!XLSX) { alert('Excel aún se está cargando, intenta de nuevo.'); return }
    const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase()
    const reader = new FileReader()
    reader.onload = async (e) => {
      let wb
      try { wb = XLSX.read(e.target.result, { type: 'array', cellDates: true }) } catch (err) { alert('No se pudo leer el Excel: ' + err.message); return }
      const want = HIST_HEAD.map(norm)
      let bestAoa = null, bestScore = -1
      wb.SheetNames.forEach((name) => {
        const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' })
        if (!aoa.length) return
        const hdr = (aoa[0] || []).map(norm)
        const score = want.filter((w) => hdr.includes(w)).length
        if (score > bestScore) { bestScore = score; bestAoa = aoa }
      })
      if (!bestAoa || bestScore < 3) { alert('No encontré una hoja con la estructura esperada (EMPRESA, AÑO, TIPO, RUBRO, SBU, MARCA, MES, MONTO, CLIENTE, PAIS).'); return }
      const hdr = bestAoa[0].map(norm)
      const idx = HIST_HEAD.map((f) => { const F = norm(f); let i = hdr.indexOf(F); if (i < 0) i = hdr.findIndex((h) => h.indexOf(F) >= 0); return i })
      const canon = [HIST_HEAD.slice()]
      bestAoa.slice(1).forEach((r) => {
        if (!r || r.every((c) => c === '' || c == null)) return
        canon.push(HIST_HEAD.map((_, ci) => {
          const i = idx[ci]; let v = i >= 0 ? r[i] : ''
          if (v instanceof Date) v = v.toISOString().slice(0, 10)
          else if (ci === 6 && typeof v === 'number' && XLSX.SSF) v = XLSX.SSF.format('yyyy-mm-dd', v)
          return v == null ? '' : v
        }))
      })
      setBusy(true); setMsg(null)
      try {
        const j = await gSaveHistorico(canon)
        setMsg(j.ok ? { t: 'ok', x: `Histórico importado: ${j.filas} registro(s) en la hoja "Historico".` } : { t: 'bad', x: 'Error al guardar.' })
        cargar()
      } catch (err) { setMsg({ t: 'bad', x: 'No se pudo guardar: ' + err.message }) }
      setBusy(false)
    }
    reader.readAsArrayBuffer(file)
    ev.target.value = ''
  }
  const dcell = (v) => { const s = v == null ? '' : String(v); const m = s.match(/^(\d{4})-(\d{2})-\d{2}/); return m ? m[1] + '-' + m[2] : s }
  async function exportar() {
    try {
      const j = await gHistorico()
      if (j.ok && j.values && j.values.length) { const clean = j.values.map((row) => row.map((c) => dcell(c))); exportXlsx(clean, 'Historico.xlsx') }
      else alert('Aún no hay histórico guardado.')
    } catch (e) { alert('No se pudo: ' + e.message) }
  }
  function plantilla() {
    const XLSX = window.XLSX
    if (!XLSX) { alert('Excel aún se está cargando, intenta de nuevo.'); return }
    const ejemplos = [
      HIST_HEAD.slice(),
      ['ENERGY BRANDS', 2025, 'SIN TAHO', 'UNIDADES', 'SBU 1', 'ALTRA', '2025-06-01', 96, 'AC CORP SA DE CV', 'EL SALVADOR'],
      ['ENERGY BRANDS', 2025, 'SIN TAHO', 'COSTO', 'SBU 1', 'NORDA', '2025-05-01', 3150, 'AC CORP SA DE CV', 'EL SALVADOR'],
    ]
    const instr = [
      ['COLUMNA', 'DESCRIPCIÓN / FORMATO'],
      ['IMPORTANTE', 'Debes subir el histórico de UNIDADES, COSTO y VENTAS NETAS (mínimo estos tres rubros).'],
      ['EMPRESA', 'Nombre de la empresa (texto). Ej: ENERGY BRANDS'],
      ['AÑO', 'Año del registro (número). Ej: 2025'],
      ['TIPO', 'Escenario. Ej: SIN TAHO / CON TAHO'],
      ['RUBRO', 'Rubro. Obligatorios: UNIDADES, COSTO, VENTAS NETAS. Opcionales: MK, LOGISTICA...'],
      ['SBU', 'SBU. Ej: SBU 1 / SBU 2 / SBU 3'],
      ['MARCA', 'Marca. Ej: ALTRA, HOKA, UGG...'],
      ['MES', 'Fecha del mes en formato AAAA-MM-DD. Ej: 2025-06-01'],
      ['MONTO', 'Valor numérico, sin símbolos ni comas. Ej: 96 o 4244.82'],
      ['CLIENTE', 'Nombre del cliente (texto)'],
      ['PAIS', 'País (texto). Ej: EL SALVADOR'],
      ['', 'Usa la hoja "Plantilla" con exactamente este orden de columnas. Una fila por registro. Borra las filas de ejemplo antes de subir.'],
    ]
    const wb = XLSX.utils.book_new()
    const ws1 = XLSX.utils.aoa_to_sheet(ejemplos)
    ws1['!cols'] = HIST_HEAD.map(() => ({ wch: 16 }))
    XLSX.utils.book_append_sheet(wb, ws1, 'Plantilla')
    const ws2 = XLSX.utils.aoa_to_sheet(instr)
    ws2['!cols'] = [{ wch: 12 }, { wch: 72 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Instrucciones')
    XLSX.writeFile(wb, 'Plantilla_Historico.xlsx')
  }

  const filas = Math.max(0, values.length - 1)
  const head = values[0] || HIST_HEAD
  const preview = values.slice(1, 1 + limite)

  // ---- Análisis ----
  const up = (s) => String(s == null ? '' : s).trim().toUpperCase()
  const money = (v) => '$' + Math.round(v).toLocaleString('en-US')
  const money2 = (v) => '$' + (v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const pct1 = (v) => (v || 0).toFixed(1) + '%'
  const anios = [...new Set(values.slice(1).map((r) => String(r[1])).filter(Boolean))].sort()
  const marcasList = [...new Set(values.slice(1).map((r) => String(r[5])).filter(Boolean))].sort()
  const filt = values.slice(1).filter((r) => (!fAnio || String(r[1]) === fAnio) && (!fMarca || String(r[5]) === fMarca))
  const aggM = {}
  filt.forEach((r) => { const rb = up(r[3]), mo = num(r[7]); const k = r[5] + '||' + r[1]; const o = aggM[k] || (aggM[k] = { marca: r[5], anio: r[1], vn: 0, un: 0, co: 0 }); if (rb.indexOf('VENTA') >= 0) o.vn += mo; else if (rb.indexOf('UNIDAD') >= 0) o.un += mo; else if (rb.indexOf('COSTO') >= 0) o.co += mo })
  const resumen = Object.values(aggM).sort((a, b) => b.vn - a.vn)
  const cliMap = {}; let totVN = 0
  filt.forEach((r) => { if (up(r[3]).indexOf('VENTA') >= 0) { const c = r[8] || '(sin cliente)'; const mo = num(r[7]); cliMap[c] = (cliMap[c] || 0) + mo; totVN += mo } })
  const clientes = Object.entries(cliMap).map(([c, v]) => ({ c, v, pct: totVN ? (v / totVN) * 100 : 0 })).sort((a, b) => b.v - a.v)

  // ---- Comparativo AUP/AUC por cliente y marca (por año) ----
  const sbuList = [...new Set(values.slice(1).map((r) => String(r[4])).filter(Boolean))].sort()
  const cmpBase = values.slice(1).filter((r) => (!cmpSbu || String(r[4]) === cmpSbu) && (!cmpMarca || String(r[5]) === cmpMarca))
  const cmYears = [...new Set(cmpBase.map((r) => String(r[1])).filter(Boolean))].sort()
  const yA = cmYears[0], yB = cmYears[cmYears.length - 1]
  const cm = {}, cmpTotVNY = {}
  cmpBase.forEach((r) => {
    const rb = up(r[3]), mo = num(r[7]), cli = r[8] || '(sin cliente)', mar = r[5], an = String(r[1])
    if (!an) return
    const o = cm[cli + '|' + mar] || (cm[cli + '|' + mar] = { cli, mar, y: {} })
    const yo = o.y[an] || (o.y[an] = { vn: 0, un: 0, co: 0 })
    if (rb.indexOf('VENTA') >= 0) { yo.vn += mo; cmpTotVNY[an] = (cmpTotVNY[an] || 0) + mo } else if (rb.indexOf('UNIDAD') >= 0) yo.un += mo; else if (rb.indexOf('COSTO') >= 0) yo.co += mo
  })
  const vnCM = (o, y) => (o.y[y] ? o.y[y].vn : 0)
  const pesoCM = (o, y) => (cmpTotVNY[y] ? vnCM(o, y) / cmpTotVNY[y] * 100 : 0)
  const aupY = (o, y) => { const d = o.y[y]; return d && d.un ? d.vn / d.un : 0 }
  const aucY = (o, y) => { const d = o.y[y]; return d && d.un ? d.co / d.un : 0 }
  const crec = (a, b) => (a ? (b - a) / a * 100 : 0)
  const cmList = Object.values(cm).sort((a, b) => ((b.y[yB] ? b.y[yB].vn : 0) - (a.y[yB] ? a.y[yB].vn : 0)))
  function exportarCmp() {
    const r2 = (v) => Math.round(v * 100) / 100, r1 = (v) => Math.round(v * 10) / 10
    let aoa
    if (vista === 'ambos') {
      aoa = [['CLIENTE', 'MARCA', `AUP ${yA}`, `AUP ${yB}`, `AUC ${yA}`, `AUC ${yB}`, `VN ${yA}`, `VN ${yB}`, 'CREC. VN %', `PESO ${yA} %`, `PESO ${yB} %`]]
      cmList.forEach((o) => { const vA = vnCM(o, yA), vB = vnCM(o, yB); aoa.push([o.cli, o.mar, r2(aupY(o, yA)), r2(aupY(o, yB)), r2(aucY(o, yA)), r2(aucY(o, yB)), Math.round(vA), Math.round(vB), r1(crec(vA, vB)), r1(pesoCM(o, yA)), r1(pesoCM(o, yB))]) })
    } else {
      aoa = [['CLIENTE', 'MARCA', `AUP ${vista}`, `AUC ${vista}`, `VN ${vista}`, `PESO ${vista} %`]]
      cmList.forEach((o) => aoa.push([o.cli, o.mar, r2(aupY(o, vista)), r2(aucY(o, vista)), Math.round(vnCM(o, vista)), r1(pesoCM(o, vista))]))
    }
    exportXlsx(aoa, `Comparativo_AUP_AUC${cmpSbu ? '_' + cmpSbu : ''}${cmpMarca ? '_' + cmpMarca : ''}.xlsx`)
  }

  // ---- Peso por cliente y año ----
  const pBase = values.slice(1).filter((r) => (!pSbu || String(r[4]) === pSbu) && (!pMarca || String(r[5]) === pMarca))
  const pYears = [...new Set(pBase.map((r) => String(r[1])).filter(Boolean))].sort()
  const pYA = pYears[0], pYB = pYears[pYears.length - 1]
  const pcli = {}, totY = {}
  pBase.forEach((r) => { if (up(r[3]).indexOf('VENTA') < 0) return; const an = String(r[1]); if (!an) return; const cli = r[8] || '(sin cliente)', mo = num(r[7]); const o = pcli[cli] || (pcli[cli] = { cli, y: {} }); o.y[an] = (o.y[an] || 0) + mo; totY[an] = (totY[an] || 0) + mo })
  const vnY = (o, y) => o.y[y] || 0
  const pesoY = (o, y) => (totY[y] ? (vnY(o, y) / totY[y]) * 100 : 0)
  const pList = Object.values(pcli).sort((a, b) => (vnY(b, pYB) + vnY(b, pYA)) - (vnY(a, pYB) + vnY(a, pYA)))

  return (
    <>
      <div className="toolbar">
        <label className="btnfile">⬆ Importar Excel<input type="file" accept=".xlsx,.xls" onChange={importar} hidden /></label>
        <button className="btn" onClick={exportar}>⬇ Exportar Excel</button>
        <button className="btn" onClick={plantilla}>📄 Descargar plantilla</button>
        <div className="spacer"></div>
        {busy && <span className="sub">Guardando…</span>}
      </div>
      {msg && <div className={'note ' + msg.t}>{msg.x}</div>}
      <div className="note warn">
        <b>Instrucciones:</b> Descarga la plantilla, llénala y súbela. Debes subir el histórico de <b>Unidades</b>, <b>Costo</b> y <b>Venta Neta</b> (una fila por registro). La fecha (MES) en formato AAAA-MM (año-mes).
        {' '}Al importar, se <b>reemplaza únicamente el histórico de la(s) empresa(s)</b> incluida(s) en el archivo; el de las demás empresas se mantiene.
      </div>
      <div className="panel">
        <h3>Histórico <span className="unit">({filas} registro(s))</span></h3>
        <div className="sub">Base histórica plana para análisis (una fila por registro). Al importar un Excel con esta estructura, se guarda en la hoja <b>Historico</b> de la Google Sheet. Estructura: {HIST_HEAD.join(' · ')}.</div>
        <div className="tablewrap">
          <table>
            <thead><tr>{head.map((h, i) => <th key={i} className={i === 0 ? 'l' : ''}>{String(h)}</th>)}</tr></thead>
            <tbody>
              {preview.length === 0 && <tr><td className="l" colSpan={HIST_HEAD.length}>Aún no hay datos. Importa un Excel con la estructura de la plantilla.</td></tr>}
              {preview.map((r, ri) => (<tr key={ri}>{head.map((_, ci) => <td key={ci} className={ci === 0 ? 'l' : ''}>{dcell(r[ci])}</td>)}</tr>))}
            </tbody>
          </table>
        </div>
        <div className="sub" style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Mostrando {Math.min(limite, filas)} de {filas} registros.</span>
          {limite < filas && <button className="btn" onClick={() => setLimite((l) => l + 100)}>Ver 100 más</button>}
          {limite < filas && <button className="btn" onClick={() => setLimite(filas)}>Ver todos</button>}
          {limite > 20 && <button className="btn" onClick={() => setLimite(20)}>Ver menos</button>}
        </div>
      </div>

      <div className="panel">
        <h3>AUP / AUC por cliente y marca — comparativo por año</h3>
        <div className="sub"><b>VN</b> = Ventas Netas · <b>AUP</b> = Average Unit Price (Ventas Netas / Unidades) · <b>AUC</b> = Average Unit Cost (Costo / Unidades). Elige el año o ambos para comparar el crecimiento.</div>
        <div className="toolbar" style={{ marginTop: 4 }}>
          <label>Vista</label>
          {[yA, yB].filter((y, i, a) => y && a.indexOf(y) === i).map((y) => (
            <button key={y} className={'seg' + (vista === y ? ' active' : '')} onClick={() => setVista(y)}>{y}</button>
          ))}
          {yA !== yB && <button className={'seg' + (vista === 'ambos' ? ' active' : '')} onClick={() => setVista('ambos')}>Ambos</button>}
          <label style={{ marginLeft: 8 }}>SBU</label>
          <select value={cmpSbu} onChange={(e) => setCmpSbu(e.target.value)}><option value="">Todas</option>{sbuList.map((s) => <option key={s}>{s}</option>)}</select>
          <label>Marca</label>
          <select value={cmpMarca} onChange={(e) => setCmpMarca(e.target.value)}><option value="">Todas</option>{marcasList.map((m) => <option key={m}>{m}</option>)}</select>
          <div className="spacer"></div>
          <button className="btn" onClick={exportarCmp}>⬇ Exportar Excel</button>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              {vista === 'ambos'
                ? <tr><th className="l">Cliente</th><th>Marca</th><th className="ya">AUP {yA}</th><th className="yb">AUP {yB}</th><th className="ya">AUC {yA}</th><th className="yb">AUC {yB}</th><th className="ya">VN {yA}</th><th className="yb">VN {yB}</th><th>Crec. VN</th><th className="ya">Peso {yA}</th><th className="yb">Peso {yB}</th></tr>
                : <tr><th className="l">Cliente</th><th>Marca</th><th>AUP {vista}</th><th>AUC {vista}</th><th>VN {vista}</th><th>Peso {vista}</th></tr>}
            </thead>
            <tbody>
              {cmList.length === 0 && <tr><td className="l" colSpan={vista === 'ambos' ? 11 : 6}>Importa el histórico para ver el comparativo.</td></tr>}
              {cmList.slice(0, 100).map((o, i) => {
                if (vista !== 'ambos') return <tr key={i}><td className="l">{o.cli}</td><td>{o.mar}</td><td>{money2(aupY(o, vista))}</td><td>{money2(aucY(o, vista))}</td><td>{money(vnCM(o, vista))}</td><td>{pct1(pesoCM(o, vista))}</td></tr>
                const gv = crec(vnCM(o, yA), vnCM(o, yB))
                return <tr key={i}>
                  <td className="l">{o.cli}</td><td>{o.mar}</td>
                  <td className="ya">{money2(aupY(o, yA))}</td><td className="yb">{money2(aupY(o, yB))}</td>
                  <td className="ya">{money2(aucY(o, yA))}</td><td className="yb">{money2(aucY(o, yB))}</td>
                  <td className="ya">{money(vnCM(o, yA))}</td><td className="yb">{money(vnCM(o, yB))}</td>
                  <td className={gv >= 0 ? 'pos' : 'neg'}>{(gv >= 0 ? '+' : '') + gv.toFixed(1)}%</td>
                  <td className="ya">{pct1(pesoCM(o, yA))}</td><td className="yb">{pct1(pesoCM(o, yB))}</td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
        {cmList.length > 100 && <div className="sub" style={{ marginTop: 8 }}>Mostrando 100 de {cmList.length} combinaciones cliente×marca.</div>}
      </div>
    </>
  )
}

/* ===== DIRECTOR · Categorías por marca (peso %) ===== */
function CategoriasForm({ role, usuario, empresa, sbus, fixedMarca }) {
  const marcas = marcasDe(sbus)
  const [marca, setMarca] = useState(fixedMarca || marcas[0].marca)
  useEffect(() => { if (fixedMarca) setMarca(fixedMarca) }, [fixedMarca])
  const [cats, setCats] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [, setTick] = useState(0)
  const usarCat = (() => { try { const u = JSON.parse(localStorage.getItem('usarcat_' + empresa) || '{}'); return u[marca] !== false } catch { return true } })()
  function setUsarCat(v) { try { const u = JSON.parse(localStorage.getItem('usarcat_' + empresa) || '{}'); u[marca] = v; saveEstado(empresa, 'usarcat', u) } catch { } setTick((t) => t + 1) }
  useEffect(() => {
    (async () => {
      try {
        const j = await gReadTab('Cap_Categorias')
        if (j && j.ok && j.values) { const out = {}; j.values.slice(1).forEach((row) => { if (upper(row[0]) !== upper(empresa)) return; const cat = row[1], mar = row[3], peso = num(row[4]); if (!mar || !cat) return; (out[mar] = out[mar] || []).push({ cat, peso }) }); setCats(out) }
      } catch { }
    })()
  }, [empresa])
  const lista = cats[marca] || []
  const setLista = (arr) => setCats({ ...cats, [marca]: arr })
  const suma = lista.reduce((s, o) => s + num(o.peso), 0)
  // Clientes de la marca (para el % por cliente) + referencia FW26/SS26
  const [hist, setHist] = useState([]); const [ventasR, setVentasR] = useState([])
  useEffect(() => { (async () => { try { const j = await gHistorico(); if (j && j.ok && j.values) setHist(j.values.slice(1)) } catch { } try { const j2 = await gReadTab('Cap_Ventas'); if (j2 && j2.ok && j2.values) setVentasR(j2.values.slice(1)) } catch { } })() }, [empresa])
  const [catPct, setCatPct] = useState(() => { try { return JSON.parse(localStorage.getItem('catpct_' + empresa) || '{}') } catch { return {} } })
  useEffect(() => { try { localStorage.setItem('catpct_' + empresa, JSON.stringify(catPct)) } catch { } }, [catPct, empresa])
  const clientes = (() => { const set = new Set(); hist.forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[5]) !== upper(marca)) return; const y = String(r[1]); if (y !== '2025' && y !== '2026') return; const cli = String(r[8] || '').trim(); if (cli) set.add(cli) }); ventasR.forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(marca)) return; const cli = String(r[1] || '').trim(); if (cli) set.add(cli) }); try { const add = JSON.parse(localStorage.getItem('addcli_' + empresa) || '{}'); (add[marca] || []).forEach((c) => { if (c) set.add(c) }) } catch { } return [...set].sort((a, b) => a.localeCompare(b)) })()
  const pctKey = (cli, cat) => cli + '|' + marca + '|' + cat
  const setPct = (cli, cat, v) => setCatPct({ ...catPct, [pctKey(cli, cat)]: v })
  async function guardar() {
    setSaving(true); setMsg(null)
    const sbu = sbuDe(sbus, marca)
    const rows = lista.filter((o) => String(o.cat).trim()).map((o) => ({ rubro: o.cat, sbu, marca, meses: [num(o.peso), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }))
    await postToTab('Cap_Categorias', empresa, usuario, role.label, rows, setMsg)
    saveEstado(empresa, 'catpct', catPct)
    setSaving(false)
  }
  return (
    <>
      <div className="toolbar">
        {!fixedMarca && <><label>Marca</label>
        <select value={marca} onChange={(e) => setMarca(e.target.value)}>{Object.entries(sbus).map(([s, ms]) => <optgroup key={s} label={s}>{ms.map((m) => <option key={m}>{m}</option>)}</optgroup>)}</select></>}
        <div className="spacer"></div>
        <button className="btn primary" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : '💾 Guardar'}</button>
      </div>
      {msg && <div className={'note ' + msg.t}>{msg.x}</div>}
      <div className="panel">
        <h3>Categorías de {marca}<span className="fill-badge">✏️ para llenar</span></h3>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: '2px 0 10px', fontWeight: 600 }}><input type="checkbox" checked={usarCat} onChange={(e) => setUsarCat(e.target.checked)} /> Usar categorías para {marca} <span className="unit">(si lo desactivas, Ventas solo usa el crecimiento por cliente)</span></label>
        <div className="sub">Define los <b>nombres de las categorías</b> de la marca (ej. ROAD, TRAIL, HIKE). El peso de cada categoría ya <b>no se pone aquí</b>: se define abajo por cliente.</div>
        <div className="tablewrap">
          <table style={{ width: 'auto' }}>
            <thead><tr><th className="l">Categoría</th><th></th></tr></thead>
            <tbody>
              {lista.length === 0 && <tr><td className="l" colSpan={2}>Agrega categorías con el botón de abajo.</td></tr>}
              {lista.map((o, i) => (
                <tr key={i}>
                  <td className="l"><input style={{ width: 280, padding: '6px' }} value={o.cat} onChange={(e) => setLista(lista.map((x, j) => j === i ? { ...x, cat: e.target.value } : x))} placeholder="Ej. ROAD, TRAIL, HIKE…" /></td>
                  <td><button className="btn" onClick={() => setLista(lista.filter((_, j) => j !== i))}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn" style={{ marginTop: 12 }} onClick={() => setLista([...lista, { cat: '', peso: 0 }])}>➕ Agregar categoría</button>
      </div>
      {usarCat && lista.length > 0 && <div className="panel">
        <h3>Categorías por cliente — {marca}<span className="fill-badge">✏️ para llenar</span></h3>
        <div className="sub">Completa el <b>% por cliente y categoría</b> (así se sabe cuánto de cada categoría vende cada cliente). Debajo del campo ves el <b>peso de referencia real</b> (FW26 / SS26) para decidir con números.</div>
        <div className="tablewrap">
          <table style={{ tableLayout: 'fixed', width: 'auto' }}>
            <colgroup><col style={{ width: '260px' }} />{lista.map((c) => <col key={c.cat} style={{ width: '132px' }} />)}<col style={{ width: '90px' }} /></colgroup>
            <thead><tr><th className="l">Cliente</th>{lista.map((c) => <th key={c.cat}>{c.cat}</th>)}<th>Total %</th></tr></thead>
            <tbody>
              {clientes.length === 0 && <tr><td className="l" colSpan={lista.length + 2}>No hay clientes con histórico para {marca}.</td></tr>}
              {clientes.map((cli) => { const tot = lista.reduce((a, c) => a + num(catPct[pctKey(cli, c.cat)]), 0); const ok = Math.round(tot) === 100; const vacio = tot === 0; return <tr key={cli}><td className="l">{cli}</td>{lista.map((c) => { const ref = refCat(marca, cli, c.cat); return (
                <td key={c.cat} style={{ textAlign: 'center' }}>
                  <div className="cell" style={{ display: 'inline-block' }}><input value={catPct[pctKey(cli, c.cat)] ?? ''} onChange={(e) => setPct(cli, c.cat, e.target.value)} inputMode="decimal" placeholder="%" style={{ width: 54 }} /></div>
                  <div className="unit" style={{ fontSize: 10, marginTop: 3, whiteSpace: 'nowrap' }}>{ref ? <>ref FW26 {ref.fw != null ? ref.fw + '%' : '—'} · SS26 {ref.ss != null ? ref.ss + '%' : '—'}</> : 'ref —'}</div>
                </td>) })}<td className="tot" style={{ fontWeight: 800, color: vacio ? 'var(--muted)' : ok ? 'var(--ok)' : 'var(--bad)', background: vacio ? undefined : ok ? '#eef9f0' : '#fdeeee' }}>{vacio ? '—' : tot.toFixed(0) + '%'}{!vacio && (ok ? ' ✓' : ' ✗')}</td></tr> })}
            </tbody>
          </table>
        </div>
      </div>}
    </>
  )
}

/* ===== VENTAS · Proyección de unidades 2028 (histórico 2026 + % crecimiento) ===== */
function ProjectionForm({ role, usuario, empresa, sbus, fixedMarca }) {
  const marcas = marcasDe(sbus)
  const [marca, setMarca] = useState(fixedMarca || marcas[0].marca)
  useEffect(() => { if (fixedMarca) setMarca(fixedMarca) }, [fixedMarca])
  const [hist, setHist] = useState([])
  const [cats, setCats] = useState({})
  const [producto, setProducto] = useState([])
  const [venSheet, setVenSheet] = useState([]) // filas guardadas en Cap_Ventas (respaldo del plan 2028)
  const [growth, setGrowth] = useState(() => { try { return JSON.parse(localStorage.getItem('ventas_growth_' + empresa) || '{}') } catch { return {} } })
  const [catPart, setCatPart] = useState(() => { try { return JSON.parse(localStorage.getItem('catpart_' + empresa) || '{}') } catch { return {} } })
  useEffect(() => { try { localStorage.setItem('catpart_' + empresa, JSON.stringify(catPart)) } catch { } }, [catPart, empresa])
  const [catPct, setCatPct] = useState(() => { try { return JSON.parse(localStorage.getItem('catpct_' + empresa) || '{}') } catch { return {} } })
  useEffect(() => { try { localStorage.setItem('catpct_' + empresa, JSON.stringify(catPct)) } catch { } }, [catPct, empresa])
  // Clientes agregados a mano (por marca) + sus unidades 2028 manuales (clientes sin histórico 2026)
  const [addCli, setAddCli] = useState(() => { try { return JSON.parse(localStorage.getItem('addcli_' + empresa) || '{}') } catch { return {} } })
  const [manual, setManual] = useState(() => { try { return JSON.parse(localStorage.getItem('ventas_manual_' + empresa) || '{}') } catch { return {} } })
  // Limpieza automática: elimina valores basura (negativos o no numéricos) que hayan quedado en el navegador
  // de versiones/pruebas viejas. Solo se conservan unidades > 0 (lo realmente capturado).
  useEffect(() => { setManual((prev) => { const next = {}; let changed = false; Object.keys(prev).forEach((k) => { const n = num(prev[k]); if (n > 0) next[k] = prev[k]; else changed = true }); return changed ? next : prev }) }, [empresa])
  // Stock de temporadas anteriores (referencia para el vendedor): inventario inicial de las temporadas viejas (de Producto).
  const [tempInv, setTempInv] = useState(() => { try { return JSON.parse(localStorage.getItem('temp_' + empresa) || '{}') } catch { return {} } })
  useEffect(() => { try { setTempInv(JSON.parse(localStorage.getItem('temp_' + empresa) || '{}')) } catch { } }, [empresa])
  const stockViejo = (mca) => INV_SEASONS.reduce((a, s) => a + num(tempInv[`II|${mca}|${s}`]), 0)
  // Cliente interno (intercompañía): su venta es incobrable y no genera Cash In.
  const [interno, setInterno] = useState(() => { try { return JSON.parse(localStorage.getItem('interno_' + empresa) || '{}') } catch { return {} } })
  useEffect(() => { try { localStorage.setItem('interno_' + empresa, JSON.stringify(interno)) } catch { } }, [interno, empresa])
  const esInt = (cli) => !!interno[marca + '|' + cli]
  const toggleInt = (cli) => { const next = { ...interno, [marca + '|' + cli]: !esInt(cli) }; setInterno(next); saveEstado(empresa, 'interno', next) }
  const [baseCli, setBaseCli] = useState([]) // catálogo Base_Clientes (copia del EBP)
  const [nuevoCli, setNuevoCli] = useState('')
  const [buscar, setBuscar] = useState('')
  const topScRef = useRef(null), botScRef = useRef(null) // barra de scroll horizontal (arriba) sincronizada con la tabla
  useEffect(() => { (async () => { try { const j = await gLoadClientes(empresa); if (j && j.ok) setBaseCli(j.clientes) } catch { } })() }, [empresa])
  useEffect(() => { try { localStorage.setItem('ventas_manual_' + empresa, JSON.stringify(manual)) } catch { } }, [manual, empresa])
  useEffect(() => { try { localStorage.setItem('addcli_' + empresa, JSON.stringify(addCli)) } catch { } }, [addCli, empresa])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    (async () => {
      try { const j = await gHistorico(); if (j && j.ok && j.values) setHist(j.values.slice(1)) } catch { }
      try { const j2 = await gReadTab('Cap_Categorias'); if (j2 && j2.ok && j2.values) { const out = {}; j2.values.slice(1).forEach((row) => { if (upper(row[0]) !== upper(empresa)) return; const cat = row[1], mar = row[3], peso = num(row[4]); if (!mar || !cat) return; (out[mar] = out[mar] || []).push({ cat, peso }) }); setCats(out) } } catch { }
      try { const j3 = await gReadTab('Cap_Producto'); if (j3 && j3.ok && j3.values) setProducto(j3.values.slice(1)) } catch { }
      // Recupera el plan 2028 guardado en la hoja: rellena SOLO las celdas que estén vacías en el navegador
      // (así lo guardado reaparece tras un refresh y Ventas queda consistente con lo que ve Producto).
      try {
        const jv = await gReadTab('Cap_Ventas')
        if (jv && jv.ok && jv.values) {
          const rows = jv.values.slice(1); setVenSheet(rows)
          setManual((prev) => {
            const next = { ...prev }
            rows.forEach((r) => {
              if (upper(r[0]) !== upper(empresa)) return
              const cli = String(r[1] || '').trim(), mar = r[3]; if (!cli || !mar) return
              for (let mi = 0; mi < 12; mi++) { const k = mar + '|' + cli + '|' + mi; if (next[k] === undefined || next[k] === '') { const v = num(r[4 + mi]); if (v > 0) next[k] = String(v) } }
            })
            return next
          })
        }
      } catch { }
    })()
  }, [empresa])
  // AUP por categoría (Producto): { categoría: [12] }
  const aupPorCat = (mca) => { const out = {}; producto.forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(mca)) return; const rub = String(r[1] || ''); if (rub.indexOf('AUP · ') !== 0) return; out[rub.slice(6)] = MESES.map((_, j) => num(r[4 + j])) }); return out }
  useEffect(() => { try { localStorage.setItem('ventas_growth_' + empresa, JSON.stringify(growth)) } catch { } }, [growth, empresa])

  const u2026 = {}, u2025 = {}, cliByMarca = {}
  hist.forEach((r) => { if (upper(r[3]).indexOf('UNIDAD') < 0) return; if (String(r[1]) !== '2026') return; const mi = mesIdx(r[6]); if (mi < 0) return; const mar = r[5], cli = r[8] || '(sin cliente)', k = cli + '|' + mar; (u2026[k] = u2026[k] || Array(12).fill(0))[mi] += num(r[7]); (cliByMarca[mar] = cliByMarca[mar] || new Set()).add(cli) })
  hist.forEach((r) => { if (upper(r[3]).indexOf('UNIDAD') < 0) return; if (String(r[1]) !== '2025') return; const mi = mesIdx(r[6]); if (mi < 0) return; const mar = r[5], cli = r[8] || '(sin cliente)', k = cli + '|' + mar; (u2025[k] = u2025[k] || Array(12).fill(0))[mi] += num(r[7]) })
  const histClientes = [...(cliByMarca[marca] || [])].sort((a, b) => (u2026[b + '|' + marca] || []).reduce((s, v) => s + v, 0) - (u2026[a + '|' + marca] || []).reduce((s, v) => s + v, 0))
  const histSet = new Set(histClientes.map((c) => upper(c)))
  const addedFor = (addCli[marca] || []).filter((c) => !histSet.has(upper(c)))
  // Clientes que ya tienen plan 2028 guardado en la hoja pero no están en histórico ni agregados: también deben salir.
  const venCli = [...new Set(venSheet.filter((r) => upper(r[0]) === upper(empresa) && upper(r[3]) === upper(marca)).map((r) => String(r[1] || '').trim()).filter(Boolean))]
  const yaEn = new Set([...histClientes, ...addedFor].map((c) => upper(c)))
  const desdeHoja = venCli.filter((c) => !yaEn.has(upper(c)))
  const clientes = [...histClientes, ...addedFor, ...desdeHoja]
  const esNuevo = (cli) => !histSet.has(upper(cli)) // sin histórico 2026 → unidades 2028 manuales
  const g = (cli) => num(growth[cli + '|' + marca])
  const u26 = (cli, mi) => (u2026[cli + '|' + marca] || [])[mi] || 0
  const u25 = (cli, mi) => (u2025[cli + '|' + marca] || [])[mi] || 0
  const mKey = (cli, mi) => marca + '|' + cli + '|' + mi
  // 2028 = el % de crecimiento define el TOTAL objetivo (sobre 2026). Los meses arrancan VACÍOS:
  // el vendedor decide cómo repartir ese total por mes (celdas amarillas). Debe completarlo.
  const u28 = (cli, mi) => { const cur = manual[mKey(cli, mi)]; return (cur === undefined || cur === '') ? 0 : Math.max(0, Math.round(num(cur))) }
  const objetivo28 = (cli) => esNuevo(cli) ? null : Math.round(MESES.reduce((a, _, mi) => a + u26(cli, mi), 0) * (1 + g(cli) / 100))
  const setG = (cli, val) => setGrowth({ ...growth, [cli + '|' + marca]: val })
  const setMan = (cli, mi, val) => setManual({ ...manual, [mKey(cli, mi)]: val })
  const agregarCliente = async (nombre) => {
    const n = String(nombre || '').trim(); if (!n) return
    if (clientes.some((c) => upper(c) === upper(n))) { setMsg({ t: 'warn', x: 'Ese cliente ya está en la lista de ' + marca + '.' }); return }
    const next = { ...addCli, [marca]: [...(addCli[marca] || []), n] }
    setAddCli(next); saveEstado(empresa, 'addcli', next); setNuevoCli('')
    if (!baseCli.some((c) => upper(c) === upper(n))) { setBaseCli([...baseCli, n].sort((a, b) => a.localeCompare(b))); try { await gAddCliente(empresa, n) } catch { } }
    setMsg({ t: 'ok', x: 'Cliente agregado a ' + marca + '. Escribe sus unidades 2028 y guarda. Finanzas ya lo verá.' })
  }
  const quitarCliente = (cli) => { const next = { ...addCli, [marca]: (addCli[marca] || []).filter((c) => upper(c) !== upper(cli)) }; setAddCli(next); saveEstado(empresa, 'addcli', next) }
  const t25 = (cli) => MESES.reduce((a, _, mi) => a + u25(cli, mi), 0)
  const t26 = (cli) => MESES.reduce((a, _, mi) => a + u26(cli, mi), 0)
  const t28 = (cli) => MESES.reduce((a, _, mi) => a + u28(cli, mi), 0)
  const totMarcaSel = clientes.reduce((s, cli) => s + t28(cli), 0)
  const totMarca = {}
  const mesMarca = {}
  Object.keys(u2026).forEach((k) => { const p = k.split('|'), cli = p[0], mar = p[1]; const arr = mesMarca[mar] || (mesMarca[mar] = Array(12).fill(0)); let t = 0; for (let mi = 0; mi < 12; mi++) { const cur = manual[mar + '|' + cli + '|' + mi]; const v = (cur === undefined || cur === '') ? 0 : Math.round(num(cur)); arr[mi] += v; t += v } totMarca[mar] = (totMarca[mar] || 0) + t })
  const mes28 = MESES.map((_, mi) => clientes.reduce((a, cli) => a + u28(cli, mi), 0))
  const mes26 = MESES.map((_, mi) => clientes.reduce((a, cli) => a + u26(cli, mi), 0))
  const mes25 = MESES.map((_, mi) => clientes.reduce((a, cli) => a + u25(cli, mi), 0))
  const tot26Marca = mes26.reduce((a, b) => a + b, 0)
  const tot25Marca = mes25.reduce((a, b) => a + b, 0)
  const crecMarca = tot26Marca ? (totMarcaSel - tot26Marca) / tot26Marca * 100 : 0

  async function guardar() {
    setSaving(true); setMsg(null)
    const sbu = sbuDe(sbus, marca)
    // IMPORTANTE: escribimos TODOS los clientes listados (incluidos los que quedan en 0) para que la hoja
    // Cap_Ventas refleje exactamente el plan del vendedor. Si filtráramos los ceros, un cliente que bajaste
    // a 0 conservaría su valor viejo en la hoja e inflaría el total que ve Producto/Finanzas.
    const rows = clientes.map((cli) => ({ rubro: cli, sbu, marca, meses: MESES.map((_, mi) => u28(cli, mi)) }))
    await postToTab('Cap_Ventas', empresa, usuario, role.label, rows, setMsg)
    saveEstado(empresa, 'ventas_growth', growth); saveEstado(empresa, 'catpart', catPart); saveEstado(empresa, 'catpct', catPct)
    saveEstado(empresa, 'ventas_manual', manual); saveEstado(empresa, 'addcli', addCli); saveEstado(empresa, 'interno', interno)
    setSaving(false)
  }
  const catList = cats[marca] || []
  // ¿El Director activó categorías para esta marca? (lo define en su pestaña; por defecto sí)
  const catsToggle = (() => { try { const u = JSON.parse(localStorage.getItem('usarcat_' + empresa) || '{}'); return u[marca] !== false } catch { return true } })()
  const usarCat = catsToggle && catList.length > 0
  const catMsg = catsToggle ? 'Aún no hay categorías definidas para ' + marca + ' (las define el Director en su pestaña Categorías y guarda). Mientras tanto, solo se ve el total por mes.' : 'Categorías desactivadas por el Director: solo el total por mes.'
  // Participación de categorías por cliente (check). Sin marcar = participa en todas.
  const partOf = (cli) => { const k = cli + '|' + marca; return catPart[k] === undefined ? catList.map((c) => c.cat) : catPart[k] }
  const toggleCat = (cli, cat) => { const cur = partOf(cli); const nx = cur.includes(cat) ? cur.filter((x) => x !== cat) : [...cur, cat]; setCatPart({ ...catPart, [cli + '|' + marca]: nx }) }
  const pesoCat = {}; catList.forEach((c) => { pesoCat[c.cat] = num(c.peso) })
  const pctKey = (cli, cat) => cli + '|' + marca + '|' + cat
  const pctOf = (cli, cat) => { const v = catPct[pctKey(cli, cat)]; return (v === undefined || v === '') ? null : num(v) }
  const setPct = (cli, cat, v) => setCatPct({ ...catPct, [pctKey(cli, cat)]: v })
  const catW = (cli, cat) => {
    // Si el cliente tiene % explícitos, se usan (normalizados); si no, participación + pesos del Director.
    const expl = catList.map((c) => pctOf(cli, c.cat))
    if (expl.some((v) => v !== null)) { const den = expl.reduce((a, v) => a + (v || 0), 0); return den > 0 ? (pctOf(cli, cat) || 0) / den : 0 }
    const part = partOf(cli); if (!part.includes(cat)) return 0; const den = part.reduce((a, c) => a + (pesoCat[c] || 0), 0); return den > 0 ? (pesoCat[cat] || 0) / den : (part.length ? 1 / part.length : 0)
  }
  const uCatMes = (cat, mi) => clientes.reduce((a, cli) => a + u28(cli, mi) * catW(cli, cat), 0)

  return (
    <>
      {!fixedMarca && <div className="panel">
        <h3>Resumen por SBU y marca <span className="unit">(unidades 2028 por mes)</span></h3>
        <div className="sub">Unidades 2028 (= 2026 × (1 + % crecimiento)) por marca y mes. Las SBU muestran el subtotal de sus marcas.</div>
        <div className="tablewrap">
          <table className="vfix">
            <colgroup><col style={{ width: '330px' }} />{MESES.map((_, i) => <col key={i} style={{ width: '64px' }} />)}<col style={{ width: '70px' }} /></colgroup>
            <thead><tr><th className="l">SBU / Marca</th>{MESES.map((m) => <th key={m}>{m.toUpperCase()}</th>)}<th>Total</th></tr></thead>
            <tbody>
              {Object.entries(sbus).map(([s, ms]) => {
                const smes = MESES.map((_, mi) => ms.reduce((a, m) => a + ((mesMarca[m] || [])[mi] || 0), 0))
                const stot = smes.reduce((a, b) => a + b, 0)
                return <Fragment2 key={s}>
                  <tr className="sburow"><td className="l">{s}</td>{smes.map((v, i) => <td key={i} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(stot)}</td></tr>
                  {ms.map((m) => <tr key={m}><td className="l sub2">{m}</td>{MESES.map((_, mi) => <td key={mi} className="tot">{fmt((mesMarca[m] || [])[mi] || 0)}</td>)}<td className="tot">{fmt(totMarca[m] || 0)}</td></tr>)}
                </Fragment2>
              })}
            </tbody>
          </table>
        </div>
      </div>}

      <div className="toolbar">
        {!fixedMarca && <><label>Marca</label>
        <select value={marca} onChange={(e) => setMarca(e.target.value)}>{Object.entries(sbus).map(([s, ms]) => <optgroup key={s} label={s}>{ms.map((m) => <option key={m}>{m}</option>)}</optgroup>)}</select></>}
        <div className="spacer"></div>
        <button className="btn primary" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : '💾 Guardar marca'}</button>
      </div>
      {msg && <div className={'note ' + msg.t}>{msg.x}</div>}
      {usarCat && <div className="note ok" style={{ marginBottom: 14 }}>Las <b>categorías por cliente</b> (y su % + referencia FW26/SS26) ahora las llena el <b>Director</b> en su pestaña <b>Categorías</b>. Aquí solo se usan para repartir las unidades.</div>}

      <div className="panel">
        <h3>Unidades 2028 por categoría y mes — {marca}{UD} <span className="unit">(unidades)</span></h3>
        <div className="sub">{usarCat ? 'Las unidades de cada cliente se reparten por categoría según el % que el Director definió por cliente. El Peso % es ponderado: unidades de la categoría ÷ unidades totales de la marca (no un valor fijo).' : catMsg}</div>
        <div className="tablewrap">
          <table className="vfix">
            <colgroup><col style={{ width: '270px' }} /><col style={{ width: '66px' }} />{MESES.map((_, i) => <col key={i} style={{ width: '64px' }} />)}<col style={{ width: '70px' }} /></colgroup>
            <thead><tr><th className="l">Categoría</th><th style={{ whiteSpace: 'normal', lineHeight: 1.1 }}>Peso<br />pond. %</th>{MESES.map((m) => <th key={m}>{m.toUpperCase()}</th>)}<th>Total</th></tr></thead>
            <tbody>
              <tr className="grandrow"><td className="l">TOTAL {marca}</td><td className="tot" title="La marca siempre suma 100%: es la suma del peso ponderado de todas sus categorías." style={{ cursor: 'help' }}>{totMarcaSel > 0 ? '100.0%' : '—'}</td>{mes28.map((v, i) => <td key={i} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(totMarcaSel)}</td></tr>
              {!usarCat && <tr><td className="l" colSpan={15} style={{ color: 'var(--muted)' }}>{catsToggle ? `Aún no hay categorías definidas para ${marca} (las define el Director).` : `Categorías desactivadas por el Director para ${marca}.`}</td></tr>}
              {usarCat && catList.map((c, i) => { const row = MESES.map((_, mi) => uCatMes(c.cat, mi)); const t = row.reduce((a, b) => a + b, 0); const pw = totMarcaSel > 0 ? (t / totMarcaSel * 100) : 0; return <tr key={i}><td className="l">{c.cat}</td><td className="tot" title={`Peso ponderado = unidades de ${c.cat} (${fmt(t)}) ÷ unidades totales de ${marca} (${fmt(totMarcaSel)}) = ${pw.toFixed(1)}%. Las unidades por categoría salen del % que el Director puso por cliente.`} style={{ cursor: 'help' }}>{pw.toFixed(1)}%</td>{row.map((v, mi) => <td key={mi} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(t)}</td></tr> })}
            </tbody>
          </table>
        </div>
      </div>

      {usarCat && (() => {
        const aup = aupPorCat(marca)
        const vnCat = (cat, mi) => uCatMes(cat, mi) * ((aup[cat] || [])[mi] || 0)
        const vnMes = MESES.map((_, mi) => catList.reduce((a, c) => a + vnCat(c.cat, mi), 0))
        const vnTot = vnMes.reduce((a, b) => a + b, 0)
        return (
          <div className="panel">
            <h3>Venta Neta 2028 por categoría y mes — {marca}{M$} <span className="unit">(dinero $)</span></h3>
            <div className="sub"><b>Venta Neta del mes = unidades del mes × AUP efectivo de ese mes</b> (por categoría). El <b>AUP lo define Producto por categoría y temporada</b> — no depende del cliente (el cliente solo define cuántas unidades y en qué categorías). Como cada mes se vende una <b>mezcla de temporadas</b> (Paso 2), el AUP efectivo del mes es el <b>promedio ponderado</b> de las temporadas que rotan ese mes. El Total del año es la suma de los meses (no un promedio anual único).</div>
            <div className="tablewrap">
              <table className="vfix">
                <colgroup><col style={{ width: '336px' }} />{MESES.map((_, i) => <col key={i} style={{ width: '64px' }} />)}<col style={{ width: '70px' }} /></colgroup>
                <thead><tr><th className="l">Categoría</th>{MESES.map((m) => <th key={m}>{m.toUpperCase()}</th>)}<th>Total</th></tr></thead>
                <tbody>
                  <tr className="grandrow"><td className="l">TOTAL {marca}</td>{vnMes.map((v, i) => <td key={i} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(vnTot)}</td></tr>
                  {catList.map((c, i) => { const row = MESES.map((_, mi) => vnCat(c.cat, mi)); const rt = row.reduce((s, x) => s + x, 0); return <tr key={i}><td className="l">{c.cat}</td>{row.map((v, mi) => <td key={mi} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(rt)}</td></tr> })}
                </tbody>
              </table>
            </div>
            {Object.keys(aup).length === 0 && <div className="sub" style={{ marginTop: 8 }}>Si sale en cero, Producto aún no ha capturado el AUP de las categorías de {marca}.</div>}
          </div>
        )
      })()}

      <div className="panel">
        <div className="toolbar" style={{ marginBottom: 6, alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Ventas · Unidades 2028 — {marca}<span className="fill-badge">✏️ para llenar</span></h3>
          <div className="spacer"></div>
          <button className="btn primary" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : '💾 Guardar'}</button>
        </div>
        <div className="note ok" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>📦</span>
          <div>Stock disponible de temporadas anteriores de <b>{marca}</b>: <b style={{ fontSize: 15 }}>{fmt(stockViejo(marca))} ud</b>. <span className="unit">Tenlo en cuenta al proyectar: tu venta 2028 debería incluir mover este stock viejo; lo que exceda será compra nueva. (Referencia — lo captura Producto.)</span></div>
        </div>
        <div className="sub">Escribe <b>un % de crecimiento por cliente</b>: junto al % verás el <b>🎯 objetivo</b> de unidades 2028 (= total 2026 × (1 + %)) y la <b>Σ</b> de lo que llevas repartido. Luego, en las <b>celdas amarillas de 2028</b> (que arrancan vacías), tú decides <b>en qué meses</b> vender esas unidades. Cuando la Σ cuadra con el objetivo aparece <b style={{ color: '#15803d' }}>✓</b>; si no, sale en <b style={{ color: '#b45309' }}>ámbar ⚠</b> para que ajustes. Las filas grises 2025 y 2026 son el histórico (referencia). Para un <b>cliente nuevo</b> escribe sus unidades 2028 directamente. Total 2028 de {marca}: <b>{fmt(totMarcaSel)} ud</b></div>
        <div style={{ display: 'flex', gap: 28, margin: '4px 0 12px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ order: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="🔍 Buscar cliente…" style={{ border: '1px solid var(--line)', borderRadius: 7, padding: '7px 11px', font: 'inherit', minWidth: 220 }} />
            {buscar && <button className="btn" onClick={() => setBuscar('')}>✕ limpiar</button>}
          </div>
          <div style={{ order: 1, display: 'flex', flexDirection: 'column', gap: 8, flex: '1 1 560px', maxWidth: 620 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ width: 210, flex: '0 0 210px', fontWeight: 700, color: 'var(--muted)', fontSize: 12 }}>AGREGAR CLIENTE EXISTENTE</label>
              <select value="" onChange={(e) => { if (e.target.value) agregarCliente(e.target.value) }} style={{ flex: 1, minWidth: 200 }}>
                <option value="">Elegir de la base…</option>
                {baseCli.filter((c) => !clientes.some((x) => upper(x) === upper(c))).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ width: 210, flex: '0 0 210px', fontWeight: 700, color: 'var(--muted)', fontSize: 12 }}>AGREGAR CLIENTE NUEVO</label>
              <input className="fillin" value={nuevoCli} onChange={(e) => setNuevoCli(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') agregarCliente(nuevoCli) }} placeholder="Escribe el nombre…" style={{ flex: 1, minWidth: 170, background: '#fff' }} />
              <button className="btn primary" onClick={() => agregarCliente(nuevoCli)}>➕ Agregar</button>
            </div>
          </div>
        </div>
        <div ref={topScRef} onScroll={() => { if (botScRef.current) botScRef.current.scrollLeft = topScRef.current.scrollLeft }} className="tablewrap" style={{ maxHeight: 'none', overflowY: 'hidden', border: 'none', borderRadius: 0, marginBottom: 2 }}><div style={{ width: 1228, height: 1 }} /></div>
        <div className="tablewrap" ref={botScRef} onScroll={() => { if (topScRef.current) topScRef.current.scrollLeft = botScRef.current.scrollLeft }}>
          <table className="vfix" style={{ width: 1228 }}>
            <colgroup><col style={{ width: '220px' }} /><col style={{ width: '55px' }} /><col style={{ width: '55px' }} />{MESES.map((_, i) => <col key={i} style={{ width: '64px' }} />)}<col style={{ width: '70px' }} /><col style={{ width: '60px' }} /></colgroup>
            <thead><tr><th className="l">Cliente</th><th>% Crec</th><th>Año</th>{MESES.map((m) => <th key={m}>{m.slice(0, 3).toUpperCase()}</th>)}<th>Total</th><th>% Peso</th></tr></thead>
            <tbody>
              {clientes.length === 0 && <tr><td className="l" colSpan={17}>No hay clientes con histórico 2026 para {marca}. Carga el Histórico, o agrega un cliente con el buscador de arriba.</td></tr>}
              {clientes.filter((cli) => !buscar.trim() || upper(cli).indexOf(upper(buscar)) >= 0).map((cli) => { const nuevo = esNuevo(cli); const obj = objetivo28(cli); const desc = !nuevo && obj != null && t28(cli) !== obj; return (
                <Fragment2 key={cli}>
                  <tr>
                    <td className="l" rowSpan={3}>{cli}{esInt(cli) && <span className="unit" style={{ marginLeft: 6, color: '#b45309', fontWeight: 700 }} title="Venta interna (intercompañía): incobrable, no entra al Cash In">⛔ interno</span>}{nuevo && <span className="unit" style={{ marginLeft: 6, color: 'var(--odoo)', fontWeight: 700 }}>🆕</span>}{nuevo && <button className="btn" title="Quitar cliente agregado" onClick={() => quitarCliente(cli)} style={{ marginLeft: 6, padding: '1px 7px', fontSize: 11 }}>✕</button>}<label style={{ display: 'block', marginTop: 5, fontSize: 11, color: esInt(cli) ? '#b45309' : 'var(--muted)', cursor: 'pointer', fontWeight: 600 }}><input type="checkbox" checked={esInt(cli)} onChange={() => toggleInt(cli)} style={{ marginRight: 5, verticalAlign: 'middle' }} />Interno (intercompañía)</label></td>
                    <td className="cell" rowSpan={3} style={{ verticalAlign: 'top' }}>{nuevo ? <span className="unit">—</span> : <input value={growth[cli + '|' + marca] ?? ''} onChange={(e) => setG(cli, e.target.value)} inputMode="decimal" placeholder="%" />}
                      <div style={{ marginTop: 7, fontSize: 11, lineHeight: 1.45 }}>
                        {!nuevo && <div style={{ color: 'var(--muted)' }} title="Total objetivo = total 2026 × (1 + % crecimiento). Reparte este total en los meses de 2028.">🎯 obj <b>{fmt(obj)}</b></div>}
                        <div style={{ color: desc ? '#b45309' : (t28(cli) > 0 ? '#15803d' : 'var(--muted)'), fontWeight: 700 }} title={nuevo ? 'Total 2028 que llevas repartido por mes.' : (desc ? 'Lo repartido por mes NO cuadra con el objetivo del %. Ajusta los meses.' : 'El reparto por mes cuadra con el objetivo ✓')}>Σ <b>{fmt(t28(cli))}</b>{!nuevo && (desc ? ' ⚠' : (t28(cli) > 0 ? ' ✓' : ''))}</div>
                      </div>
                    </td>
                    <td className="yl">2025</td>
                    {MESES.map((_, mi) => <td key={mi} className="ref">{nuevo ? '—' : fmt(u25(cli, mi))}</td>)}
                    <td className="ref"><b>{nuevo ? '—' : fmt(t25(cli))}</b></td>
                    <td className="ref">{nuevo ? '—' : (tot25Marca ? (t25(cli) / tot25Marca * 100).toFixed(1) + '%' : '—')}</td>
                  </tr>
                  <tr>
                    <td className="yl">2026</td>
                    {MESES.map((_, mi) => <td key={mi} className="ref">{nuevo ? '—' : fmt(u26(cli, mi))}</td>)}
                    <td className="ref"><b>{nuevo ? '—' : fmt(t26(cli))}</b></td>
                    <td className="ref">{nuevo ? '—' : (tot26Marca ? (t26(cli) / tot26Marca * 100).toFixed(1) + '%' : '—')}</td>
                  </tr>
                  <tr className="proy2028">
                    <td className="yl proyl">2028</td>
                    {MESES.map((_, mi) => { const raw = manual[mKey(cli, mi)]; const show = (raw == null || raw === '' || num(raw) < 0) ? '' : raw; return <td key={mi} className="cell"><input value={show} onChange={(e) => setMan(cli, mi, e.target.value)} inputMode="decimal" placeholder="0" /></td> })}
                    <td className="tot" style={desc ? { background: '#fdf1e0', color: '#b45309' } : undefined} title={desc ? `El % de crecimiento da un objetivo de ${fmt(obj)} ud, pero tu reparto por mes suma ${fmt(t28(cli))} (diferencia ${(t28(cli) - obj) >= 0 ? '+' : ''}${fmt(t28(cli) - obj)}). Ajusta los meses para cuadrar.` : `Objetivo por %: ${fmt(obj == null ? t28(cli) : obj)} ud`}>{fmt(t28(cli))}{desc ? ' ⚠' : ''}</td>
                    <td className="tot">{totMarcaSel ? (t28(cli) / totMarcaSel * 100).toFixed(1) + '%' : '—'}</td>
                  </tr>
                </Fragment2>
              ) })}
              {clientes.length > 0 && <>
                <tr className="grandrow"><td className="l" rowSpan={3}>TOTAL {marca}</td><td rowSpan={3}>{tot26Marca ? (crecMarca >= 0 ? '+' : '') + crecMarca.toFixed(1) + '%' : '—'}</td><td>2025</td>{mes25.map((v, i) => <td key={i} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(tot25Marca)}</td><td className="tot">100%</td></tr>
                <tr className="grandrow"><td>2026</td>{mes26.map((v, i) => <td key={i} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(tot26Marca)}</td><td className="tot">100%</td></tr>
                <tr className="grandrow"><td>2028</td>{mes28.map((v, i) => <td key={i} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(totMarcaSel)}</td><td className="tot">100%</td></tr>
              </>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

/* ===== CALENDARIO DE TRABAJO: fechas de entregables del ABP, por empresa ===== */
const CAL_DEFAULT = [
  { hito: 'Cargar histórico y base de clientes (EBP)', area: 'Finanzas', fecha: '', estado: 'Pendiente' },
  { hito: 'Ventas: proyección de unidades por cliente', area: 'Ventas', fecha: '', estado: 'Pendiente' },
  { hito: 'Director: categorías y % por cliente', area: 'Director', fecha: '', estado: 'Pendiente' },
  { hito: 'Producto: inventario, AUP/AUC y rotación', area: 'Producto', fecha: '', estado: 'Pendiente' },
  { hito: 'Logística: costos logísticos', area: 'Logística', fecha: '', estado: 'Pendiente' },
  { hito: 'Marketing y Viajes por marca', area: 'Marketing', fecha: '', estado: 'Pendiente' },
  { hito: 'Finanzas: Cash Flow y términos de pago', area: 'Finanzas', fecha: '', estado: 'Pendiente' },
  { hito: 'Revisión y cierre — Gerencia', area: 'Gerencia', fecha: '', estado: 'Pendiente' },
]
const CAL_ESTADOS = ['Pendiente', 'En proceso', 'Entregado', 'Atrasado']
const CAL_AREAS = ['Finanzas', 'Ventas', 'Producto', 'Logística', 'Marketing', 'Director', 'Gerencia', 'General']
function CalendarioScreen({ empresa, puedeEditar }) {
  const load = () => { try { const s = JSON.parse(localStorage.getItem(`calendario_${empresa}`) || 'null'); return Array.isArray(s) && s.length ? s : CAL_DEFAULT.map((x) => ({ ...x })) } catch { return CAL_DEFAULT.map((x) => ({ ...x })) } }
  const [items, setItems] = useState(load)
  const [saving, setSaving] = useState(false); const [msg, setMsg] = useState(null)
  const upd = (i, k, v) => setItems(items.map((x, j) => j === i ? { ...x, [k]: v } : x))
  const add = () => setItems([...items, { hito: '', area: 'General', fecha: '', estado: 'Pendiente' }])
  const del = (i) => setItems(items.filter((_, j) => j !== i))
  function guardar() { setSaving(true); try { saveEstado(empresa, 'calendario', items); setMsg({ t: 'ok', x: 'Calendario guardado en Google Sheet para ' + empresa + '.' }) } catch { setMsg({ t: 'bad', x: 'No se pudo guardar.' }) } setSaving(false) }
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const diasRestan = (f) => { if (!f) return null; const d = new Date(f + 'T00:00:00'); return Math.round((d - hoy) / 86400000) }
  const estadoColor = (e) => e === 'Entregado' ? 'var(--ok)' : e === 'Atrasado' ? 'var(--bad)' : e === 'En proceso' ? 'var(--warn)' : 'var(--muted)'
  const orden = items.map((x, i) => ({ ...x, _i: i })).sort((a, b) => (a.fecha || '9999-99-99').localeCompare(b.fecha || '9999-99-99'))
  const pend = items.filter((x) => x.estado !== 'Entregado').length
  const prox = orden.filter((x) => x.estado !== 'Entregado' && x.fecha).find((x) => diasRestan(x.fecha) >= 0)
  // Calendario visual — horizonte completo de meses en una sola vista
  const [selDia, setSelDia] = useState(null)
  const byFecha = {}; items.forEach((x, i) => { if (x.fecha) (byFecha[x.fecha] = byFecha[x.fecha] || []).push({ ...x, _i: i }) })
  const MESNOM = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const diaColor = (fecha) => { const its = byFecha[fecha]; if (!its) return null; const overdue = its.some((x) => x.estado !== 'Entregado' && diasRestan(x.fecha) < 0); return overdue ? '#dc2626' : '#16a34a' }
  const hoyF = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
  // Rango de meses: desde este mes (o el entregable más temprano) hasta diciembre de este año (o el entregable más tardío)
  const ymHoy = hoy.getFullYear() * 12 + hoy.getMonth()
  const fechasVal = items.map((x) => x.fecha).filter(Boolean).map((f) => { const [Y, M] = f.split('-').map(Number); return Y * 12 + (M - 1) })
  const ymMin = Math.min(ymHoy, ...(fechasVal.length ? fechasVal : [ymHoy]))
  const ymMax = Math.max(hoy.getFullYear() * 12 + 11, ...(fechasVal.length ? fechasVal : [ymHoy]))
  const meses = []; for (let ym = ymMin; ym <= ymMax; ym++) meses.push({ y: Math.floor(ym / 12), m: ym % 12 })
  const gridDe = (y, m) => { const sw = (new Date(y, m, 1).getDay() + 6) % 7; const dm = new Date(y, m + 1, 0).getDate(); const c = []; for (let i = 0; i < sw; i++) c.push(null); for (let d = 1; d <= dm; d++) c.push(d); while (c.length % 7 !== 0) c.push(null); return c }
  const fechaDe2 = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return (
    <>
      <div className="toolbar">
        <span className="empchip" style={{ marginLeft: 0, background: '#0e7490' }}>📅 {empresa}</span>
        <div className="spacer"></div>
        {puedeEditar && <button className="btn primary" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : '💾 Guardar'}</button>}
      </div>
      {msg && <div className={'note ' + msg.t}>{msg.x}</div>}
      <div className="kpis">
        <div className="kpi"><div className="k">Entregables pendientes</div><div className="v">{pend}</div><div className="s">de {items.length} en total</div></div>
        <div className="kpi"><div className="k">Próxima entrega</div><div className="v" style={{ fontSize: 16 }}>{prox ? prox.hito : '—'}</div><div className="s">{prox && prox.fecha ? `${prox.fecha} · ${diasRestan(prox.fecha) === 0 ? 'hoy' : 'en ' + diasRestan(prox.fecha) + ' días'}` : 'sin fecha próxima'}</div></div>
      </div>
      <div className="panel">
        <h3>Calendario visual — {empresa} <span className="unit">(horizonte completo · haz clic en un día para ver qué toca)</span></h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(232px,1fr))', gap: 16, marginTop: 12 }}>
          {meses.map(({ y, m }) => (
            <div key={y + '-' + m} style={{ border: '1px solid #e8edf1', borderRadius: 12, padding: '10px 10px 12px' }}>
              <div style={{ fontWeight: 800, fontSize: 13.5, textAlign: 'center', color: '#0e7490', marginBottom: 8 }}>{MESNOM[m]} {y}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <div key={i} style={{ textAlign: 'center', fontWeight: 700, fontSize: 10, color: 'var(--muted)', paddingBottom: 2 }}>{d}</div>)}
                {gridDe(y, m).map((d, ci) => {
                  if (d == null) return <div key={ci} />
                  const f = fechaDe2(y, m, d); const its = byFecha[f]; const col = diaColor(f); const esHoy = f === hoyF; const sel = f === selDia
                  return (
                    <div key={ci} onClick={() => its && setSelDia(sel ? null : f)}
                      style={{ position: 'relative', minHeight: 30, borderRadius: 6, border: sel ? '2px solid #0e7490' : esHoy ? '2px solid #94a3b8' : '1px solid #eef1f4', background: col ? (col === '#dc2626' ? '#fdecec' : '#eafaef') : '#fff', cursor: its ? 'pointer' : 'default', padding: '2px 3px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}
                      title={its ? its.map((x) => x.hito).join(', ') : ''}>
                      <span style={{ fontSize: 10.5, fontWeight: esHoy ? 800 : 600, color: esHoy ? '#0e7490' : col ? (col === '#dc2626' ? '#b91c1c' : '#15803d') : '#475569' }}>{d}</span>
                      {its && <span style={{ width: 7, height: 7, borderRadius: '50%', background: col, flex: '0 0 auto', marginTop: 2 }} />}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        {selDia && (
          <div style={{ maxWidth: 700, margin: '14px auto 0', background: '#f7fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontWeight: 800, marginBottom: 8, color: '#0e7490' }}>📌 {selDia}</div>
            {(byFecha[selDia] || []).map((x, i) => { const dr = diasRestan(x.fecha); const done = x.estado === 'Entregado'; return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderTop: i ? '1px solid #e8edf1' : 'none' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: done ? '#16a34a' : dr < 0 ? '#dc2626' : '#16a34a', flex: '0 0 auto' }} />
                <span style={{ flex: 1, fontWeight: 600 }}>{x.hito}</span>
                <span className="empchip" style={{ marginLeft: 0, background: '#64748b', fontSize: 11 }}>{x.area}</span>
                <span style={{ fontWeight: 700, fontSize: 12, color: estadoColor(x.estado) }}>{x.estado}</span>
              </div>
            ) })}
          </div>
        )}
      </div>
      <div className="panel">
        <h3>Calendario de trabajo — {empresa} <span className="unit">(fechas de entregables del ABP)</span></h3>
        <div className="sub">Cada empresa define <b>cuándo</b> debe ir avanzando con cada entregable del proyecto. Se ordena por fecha; los días restantes se calculan solos (rojo si ya pasó, ámbar si faltan ≤7 días). {puedeEditar ? 'Edita, agrega o borra hitos y pulsa Guardar.' : 'Solo lectura — lo configura un administrador.'}</div>
        <div className="tablewrap">
          <table>
            <thead><tr><th className="l">Entregable / Hito</th><th>Área</th><th>Fecha límite</th><th>Días restantes</th><th>Estado</th>{puedeEditar && <th></th>}</tr></thead>
            <tbody>
              {orden.length === 0 && <tr><td className="l" colSpan={puedeEditar ? 6 : 5}>Sin hitos. {puedeEditar ? 'Agrega el primero con el botón de arriba.' : 'Aún no configurado.'}</td></tr>}
              {orden.map((r) => { const dr = diasRestan(r.fecha); const done = r.estado === 'Entregado'; return (
                <tr key={r._i}>
                  <td className="l">{puedeEditar ? <input style={{ width: 320, padding: 6 }} value={r.hito} onChange={(e) => upd(r._i, 'hito', e.target.value)} placeholder="Ej. Ventas: proyección de unidades" /> : r.hito}</td>
                  <td>{puedeEditar ? <select value={r.area} onChange={(e) => upd(r._i, 'area', e.target.value)}>{CAL_AREAS.map((a) => <option key={a}>{a}</option>)}</select> : r.area}</td>
                  <td>{puedeEditar ? <input type="date" value={r.fecha || ''} onChange={(e) => upd(r._i, 'fecha', e.target.value)} /> : (r.fecha || '—')}</td>
                  <td className="tot" style={{ color: done ? 'var(--ok)' : dr == null ? 'var(--muted)' : dr < 0 ? 'var(--bad)' : dr <= 7 ? 'var(--warn)' : 'var(--txt)', fontWeight: 700 }}>{done ? '✓ entregado' : dr == null ? '—' : dr < 0 ? `hace ${-dr} d` : dr === 0 ? 'hoy' : `en ${dr} d`}</td>
                  <td>{puedeEditar ? <select value={r.estado} onChange={(e) => upd(r._i, 'estado', e.target.value)} style={{ color: estadoColor(r.estado), fontWeight: 700 }}>{CAL_ESTADOS.map((s) => <option key={s}>{s}</option>)}</select> : <span style={{ color: estadoColor(r.estado), fontWeight: 700 }}>{r.estado}</span>}</td>
                  {puedeEditar && <td><button className="btn" onClick={() => del(r._i)}>✕</button></td>}
                </tr>
              ) })}
            </tbody>
          </table>
        </div>
        {puedeEditar && <div style={{ marginTop: 12 }}><button className="btn" onClick={add}>➕ Agregar entregable</button></div>}
      </div>
    </>
  )
}

/* ===== BITÁCORA DE CAMBIOS ===== */
function BitacoraScreen({ empresas, empresaSel }) {
  const [rows, setRows] = useState([])
  const [emp, setEmp] = useState(empresaSel || (empresas[0] || 'GENERAL'))
  const [desc, setDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  useEffect(() => { cargar() }, [])
  async function cargar() { try { const j = await gReadTab('Bitacora'); if (j && j.ok && j.values) setRows(j.values.slice(1)) } catch { } }
  async function registrar() {
    if (!desc.trim()) { setMsg({ t: 'warn', x: 'Escribe la descripción del cambio.' }); return }
    setSaving(true); setMsg(null)
    // Fecha en RUBRO (columna 2), descripción en MARCA (columna 4). Cada entrada es única (timestamp) → se agrega sin sobrescribir.
    const rows2 = [{ rubro: new Date().toISOString(), sbu: '', marca: desc.trim(), meses: [] }]
    try {
      const j = await gSaveRows('Bitacora', emp, '', 'Bitácora', rows2)
      if (j.ok) { setDesc(''); setMsg({ t: 'ok', x: 'Cambio registrado en la bitácora.' }); cargar() }
      else setMsg({ t: 'bad', x: 'Error al guardar.' })
    } catch (e) { setMsg({ t: 'bad', x: 'No se pudo guardar: ' + e.message }) }
    setSaving(false)
  }
  const dfmt = (v) => { const d = new Date(v); return isNaN(d.getTime()) ? String(v) : d.toLocaleString('es') }
  const inp = { display: 'block', marginTop: 5, width: '100%', background: '#fff', border: '1px solid var(--line)', borderRadius: 7, padding: '9px 11px', font: 'inherit', color: 'inherit' }
  // Columnas del tab genérico: [EMPRESA, RUBRO=fecha, SBU, MARCA=descripción, ...]
  const lista = rows.map((r) => ({ fecha: r[1], empresa: r[0], desc: r[3] })).reverse()
  return (
    <>
      <div className="panel">
        <h3>Registrar cambio<span className="fill-badge">✏️ para llenar</span></h3>
        <div className="sub">Deja constancia de cada modificación a la herramienta para su trazabilidad (útil una vez esté en vivo).</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Empresa
            <select value={emp} onChange={(e) => setEmp(e.target.value)} style={{ ...inp, minWidth: 180 }}><option>GENERAL</option>{empresas.map((x) => <option key={x}>{x}</option>)}</select>
          </label>
          <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, flex: 1, minWidth: 320 }}>Descripción del cambio
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ej. Se agregó columna % Peso en Ventas" style={inp} />
          </label>
          <button className="btn primary" disabled={saving} onClick={registrar}>{saving ? 'Guardando…' : '💾 Registrar'}</button>
        </div>
        {msg && <div className={'note ' + msg.t} style={{ marginTop: 10 }}>{msg.x}</div>}
      </div>
      <div className="panel">
        <h3>Bitácora de cambios <span className="unit">({lista.length})</span></h3>
        <div className="tablewrap">
          <table>
            <thead><tr><th className="l">Fecha del cambio</th><th className="l">Empresa</th><th className="l">Descripción del cambio</th></tr></thead>
            <tbody>
              {lista.length === 0 && <tr><td className="l" colSpan={3}>Aún no hay cambios registrados.</td></tr>}
              {lista.map((r, i) => <tr key={i}><td className="l">{dfmt(r.fecha)}</td><td className="l">{r.empresa}</td><td className="l">{r.desc}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

/* ===== utilidades ===== */
function Fragment2({ children }) { return <>{children}</> }
async function postToTab(tab, empresa, usuario, rolLabel, rows, setMsg) {
  if (!rows.length) { setMsg({ t: 'warn', x: 'No hay datos para guardar.' }); return }
  try {
    const j = await gSaveRows(tab, empresa, usuario || 'anónimo', rolLabel, rows)
    setMsg(j.ok ? { t: 'ok', x: `Guardado: ${j.filas} fila(s) en ${tab}.` } : { t: 'bad', x: 'Error al guardar.' })
  } catch (e) { setMsg({ t: 'bad', x: 'No se pudo guardar: ' + e.message }) }
}

async function postRows(role, usuario, empresa, rows, setMsg) {
  if (!rows.length) { setMsg({ t: 'warn', x: 'No hay datos para guardar (todo en 0).' }); return }
  try {
    const j = await gSaveRows(role.tab, empresa, usuario || 'anónimo', role.label, rows)
    setMsg(j.ok ? { t: 'ok', x: `Guardado: ${j.filas} fila(s) (${empresa}).` } : { t: 'bad', x: 'Error al guardar.' })
  } catch (e) { setMsg({ t: 'bad', x: 'No se pudo guardar: ' + e.message }) }
}

// Carga PptxGenJS bajo demanda (solo cuando se pide la presentación). Intenta varios CDNs por si uno falla.
function loadPptx() {
  if (window.PptxGenJS) return Promise.resolve()
  const urls = [
    'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',
    'https://unpkg.com/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pptxgenjs/3.12.0/pptxgen.bundle.js',
  ]
  return new Promise((res, rej) => {
    let i = 0
    const tryNext = () => {
      if (window.PptxGenJS) return res()
      if (i >= urls.length) return rej(new Error('cdn'))
      const el = document.createElement('script'); el.src = urls[i++]
      el.onload = () => window.PptxGenJS ? res() : tryNext()
      el.onerror = () => tryNext()
      document.head.appendChild(el)
    }
    tryNext()
  })
}
function exportXlsx(aoa, nombre) {
  const XLSX = window.XLSX
  if (!XLSX) { alert('Excel aún se está cargando, intenta de nuevo en un segundo.'); return }
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Datos')
  XLSX.writeFile(wb, nombre)
}
function importXlsx(file, cb) {
  const XLSX = window.XLSX
  if (!XLSX) { alert('Excel aún se está cargando, intenta de nuevo.'); return }
  const reader = new FileReader()
  reader.onload = (e) => { try { const wb = XLSX.read(e.target.result, { type: 'array' }); const ws = wb.Sheets[wb.SheetNames[0]]; cb(XLSX.utils.sheet_to_json(ws, { header: 1 })) } catch (err) { alert('No se pudo leer el Excel: ' + err.message) } }
  reader.readAsArrayBuffer(file)
}
