import { useState, useEffect } from 'react'
import './App.css'
import { initAuth, signIn, isSignedIn, getEmail, getName, onAuth, gReadTab, gLoadConfig, gSaveConfig, gSaveRows, gSaveHistorico, gHistorico, gLoadAdmins, gSaveAdmins, gLoadMarcas, gSaveMarcas } from './google'

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
const MARCA_PALETTE = ['#0891b2', '#0d9488', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#ca8a04', '#16a34a', '#dc2626', '#4f46e5', '#0ea5e9', '#059669', '#9333ea', '#e11d48', '#f59e0b', '#14b8a6', '#6366f1', '#c026d3']
const marcaColor = (marca) => { let h = 0; const s = String(marca || ''); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return MARCA_PALETTE[h % MARCA_PALETTE.length] }

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
  { id: 'ventas',    label: 'Ventas',    icon: '📈', color: '#0891b2', tab: 'Cap_Ventas',    rubros: [{ k: 'UNIDADES', u: 'ud', proyeccion: true }, VJ] },
  { id: 'producto',  label: 'Producto',  icon: '📦', color: '#017e84', tab: 'Cap_Producto',  rubros: [{ k: 'AUP', u: '$', porCat: true }, { k: 'AUC', u: '$' }, VJ, { k: 'INVENTARIO COMPRAS', u: '$' }] },
  { id: 'marketing', label: 'Marketing', icon: '📣', color: '#d9822b', tab: 'Cap_Marketing', rubros: [{ k: 'MARKETING', u: '$', detalle: MK_GROUPS, extrasKey: 'mk_extras' }, VJ] },
  { id: 'logistica', label: 'Logística', icon: '🚚', color: '#3b6ea5', tab: 'Cap_Logistica', rubros: [{ k: 'LOGISTICA', u: '$' }] },
  { id: 'finanzas',  label: 'Finanzas',  icon: '💰', color: '#2e7d32', tab: 'Cap_Finanzas',  rubros: [VJ, { k: 'CASH FLOW', u: '$', cash: true }] },
  { id: 'director',  label: 'Director',  icon: '🧑‍💼', color: '#0d9488', tab: 'Cap_Director',  rubros: [VJ, { k: 'CASH FLOW', u: '$', cash: true }, { k: 'CATEGORIAS', cat: true }] },
]
const ACCESO_OPCIONES = ['Ventas', 'Producto', 'Marketing', 'Logística', 'Finanzas', 'Director', 'Histórico', 'Combinaciones', 'Bitácora']

/* Cash Flow: últimos 3 meses de 2027 + proyección completa 2028 */
const CF_M2027 = ['oct-27', 'nov-27', 'dic-27']
const CF_M2028 = ['ene-28', 'feb-28', 'mar-28', 'abr-28', 'may-28', 'jun-28', 'jul-28', 'ago-28', 'sep-28', 'oct-28', 'nov-28', 'dic-28']
const CF_MESES = [...CF_M2027, ...CF_M2028]
const CF_GROUPS = [
  { g: 'PSI · Purchases-Sales-Inventory', items: ['Inventario Inicial', 'Inventario Final', 'Compras (Fecha disponible)', 'Ventas Netas'] },
  { g: 'CASH FLOW', items: ['Cash Inicial', 'Cash In (Cobros)', 'Cash Out (Pagos)', 'Costos Operativos', 'Cash Final'] },
]
const CF_TERMINOS = ['Cash', '30 días', '60 días', '90 días', '120 días', '150 días', '180 días', 'Intercompañía']
/* Meses de desfase para la escalera de cobros según el término de pago */
const CF_PLAZO_MESES = { 'Cash': 0, '30 días': 1, '60 días': 2, '90 días': 3, '120 días': 4, '150 días': 5, '180 días': 6, 'Intercompañía': 0 }
/* Costos Operativos = suma de estos 4 sub-rubros (el usuario los llena; el total es calculado) */
const CF_COSTOS_PARENT = 'Costos Operativos'
const CF_COSTOS = ['Gastos administrativos', 'Viajes', 'Marketing', 'Comisiones']

/* ===== helpers ===== */
const num = (v) => { const n = parseFloat(String(v).replace(/[^0-9.-]/g, '')); return isNaN(n) ? 0 : n }
const fmt = (v) => (v ? Math.round(v).toLocaleString('en-US') : '')
const upper = (s) => String(s == null ? '' : s).trim().toUpperCase()
const mesIdx = (v) => { const d = new Date(v); return isNaN(d.getTime()) ? -1 : d.getUTCMonth() }

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

/* ===== APP ===== */
export default function App() {
  const [usuario, setUsuario] = useState('')
  const [empresas, setEmpresas] = useState(SEED_EMPRESAS)
  const [empresa, setEmpresa] = useState('ENERGY BRANDS')
  const [combos, setCombos] = useState({})
  const [roleId, setRoleId] = useState(null)
  const [connError, setConnError] = useState(false)
  const [authed, setAuthed] = useState(isSignedIn())
  const [avatar, setAvatar] = useState(() => { try { return localStorage.getItem('abp_avatar') || '' } catch { return '' } })
  useEffect(() => { try { document.documentElement.style.setProperty('--avatar', avatar ? '"' + avatar + ' "' : '') } catch { } }, [avatar])
  const elegirAvatar = (a) => { setAvatar(a); try { localStorage.setItem('abp_avatar', a) } catch { } }

  useEffect(() => {
    initAuth()
    const off = onAuth(({ name, email }) => { setAuthed(true); if (name || email) setUsuario((u) => u || name || email) })
    return off
  }, [])

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
  // EB: si hay una combinación guardada en Configuración, esa manda (editable); si no, se usa la del EBP en vivo.
  const ebGuardada = combos['ENERGY BRANDS'] && SBU_NAMES.some((s) => (combos['ENERGY BRANDS'][s] || []).length)
  const sbus = empresa === 'ENERGY BRANDS'
    ? (ebGuardada ? effSBUS(empresa, combos) : (ebSbus || effSBUS(empresa, combos)))
    : effSBUS(empresa, combos)

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

  if (!role && !String(roleId || '').startsWith('sbu:') && roleId !== 'config' && roleId !== 'historico' && roleId !== 'bitacora' && roleId !== 'comercial' && roleId !== 'gerencia') {
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
            <p className="sub">Elige tu área para capturar tu información. {getEmail() ? <span className="who" style={{ display: 'inline', marginLeft: 0 }}>Sesión: {getEmail()}</span> : null} · <span style={{ cursor: 'pointer', color: 'var(--odoo)', fontWeight: 600 }} onClick={() => { setAvatar(''); try { localStorage.removeItem('abp_avatar') } catch { } }}>cambiar avatar</span></p>
            <div className="row2">
              <label className="who">Empresa:
                <span className="inline">
                  {veTodasEff
                    ? <><select value={empresa} onChange={(e) => setEmpresa(e.target.value)}>{empresas.map((e) => <option key={e}>{e}</option>)}</select>
                        {esAdmin && <button className="btn" onClick={nuevaEmpresa}>＋ Nueva</button>}</>
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

  if (roleId === 'comercial') {
    return (
      <>
        <header><div className="brand"><span className="logo">A</span> ABP</div><span className="yr">2028</span><span className="empchip">{empresa}</span><div className="spacer"></div>
          <span className="rolechip" style={{ background: '#0891b2' }}>🧭 Comercial</span>
          <button className="back" onClick={() => setRoleId(null)}>← Volver al menú</button></header>
        <main><ComercialScreen empresa={empresa} sbus={sbus} usuario={usuario} /></main>
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
        <main><SBUWorkspace sbuName={sbuName} empresa={empresa} usuario={usuario} sbus={sbus} /></main>
      </>
    )
  }

  if (roleId === 'gerencia') {
    return (
      <>
        <header><div className="brand"><span className="logo">A</span> ABP</div><span className="yr">2028</span><span className="empchip">{empresa}</span><div className="spacer"></div>
          <span className="rolechip" style={{ background: '#1f2d3d' }}>📈 Gerencia</span>
          <button className="back" onClick={() => setRoleId(null)}>← Volver al menú</button></header>
        <main><GerenciaScreen empresa={empresa} sbus={sbus} /></main>
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
function RoleForm({ role, usuario, empresa, sbus, fixedMarca }) {
  const [tab, setTab] = useState(0)
  const [data, setData] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const rb = role.rubros[tab]
  const common = { role, rubro: rb, usuario, empresa, sbus, data, setData, saving, setSaving, msg, setMsg, fixedMarca }

  return (
    <>
      <div className="toolbar">
        {role.rubros.map((r, i) => (<button key={r.k} className={'seg' + (i === tab ? ' active' : '')} onClick={() => { setTab(i); setMsg(null) }}>{r.k}</button>))}
      </div>
      {msg && <div className={'note ' + msg.t}>{msg.x}</div>}
      {rb.proyeccion ? <ProjectionForm key={rb.k} role={role} rubro={rb} usuario={usuario} empresa={empresa} sbus={sbus} fixedMarca={fixedMarca} />
        : rb.cash ? <CashFlowForm key={rb.k} role={role} rubro={rb} usuario={usuario} empresa={empresa} sbus={sbus} fixedMarca={fixedMarca} />
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
        <h3>{role.label} · {rubro.k} — {isTotal ? `TOTAL ${sbu}` : marca} <span className="unit">(USD · {empresa})</span>{isTotal ? <span className="unit" style={{ marginLeft: 8 }}>👁️ solo lectura</span> : <span className="fill-badge">✏️ para llenar</span>}</h3>
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
  const stKey = `cf_${empresa}`
  const [data, setData] = useState(() => { try { return JSON.parse(localStorage.getItem(stKey) || '{}') } catch { return {} } })
  const [hist, setHist] = useState([])
  const [ventas, setVentas] = useState([])
  const [producto, setProducto] = useState([])
  const [cats, setCats] = useState({})
  const isTotal = String(marca).startsWith('TOTAL::')
  const sbu = isTotal ? String(marca).slice(7) : sbuDe(sbus, marca)
  const sbuMarcas = sbus[sbu] || []

  useEffect(() => {
    (async () => {
      try { const j = await gHistorico(); if (j && j.ok && j.values) setHist(j.values.slice(1)) } catch { }
      try { const j2 = await gReadTab('Cap_Ventas'); if (j2 && j2.ok && j2.values) setVentas(j2.values.slice(1)) } catch { }
      try { const j3 = await gReadTab('Cap_Producto'); if (j3 && j3.ok && j3.values) setProducto(j3.values.slice(1)) } catch { }
      try { const j4 = await gReadTab('Cap_Categorias'); if (j4 && j4.ok && j4.values) { const out = {}; j4.values.slice(1).forEach((row) => { if (upper(row[0]) !== upper(empresa)) return; const cat = row[1], mar = row[3], peso = num(row[4]); if (!mar || !cat) return; (out[mar] = out[mar] || []).push({ cat, peso }) }); setCats(out) } } catch { }
    })()
  }, [empresa])

  // Clientes de una marca: histórico 2025/2026 + nuevos capturados en Ventas (2028)
  const clientesDe = (mca) => {
    const set = new Set()
    hist.forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[5]) !== upper(mca)) return; const y = String(r[1]); if (y !== '2025' && y !== '2026') return; const cli = String(r[8] || '').trim(); if (cli) set.add(cli) })
    ventas.forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(mca)) return; const cli = String(r[1] || '').trim(); if (cli) set.add(cli) })
    return [...set].sort((a, b) => a.localeCompare(b))
  }

  const key = (mca, concepto, mi) => `${mca}|${concepto}|${mi}`
  const set = (k, v) => setData((d) => ({ ...d, [k]: v }))
  const val = (mca, concepto, mi) => num(data[key(mca, concepto, mi)])
  // Cash In (Cobros) de Dic-27 = suma del saldo (deuda) cierre 2027 por cliente (calculado, no editable)
  const CASHIN = 'Cash In (Cobros)', DIC27 = 2
  const saldoTotal = (mca) => clientesDe(mca).reduce((s, cli) => s + num(data[`SALDO|${mca}|${cli}`]), 0)
  const cellRaw = (concepto, mi) => isTotal ? sbuMarcas.reduce((s, m) => s + val(m, concepto, mi), 0) : val(marca, concepto, mi)

  // Escalera de cobros: Ventas Netas 2028 = Unidades 2028 (Cap_Ventas) × AUP (Cap_Producto), cobradas según el plazo del cliente.
  const unidades2028 = (mca) => { const out = {}; ventas.forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(mca)) return; const cli = String(r[1] || '').trim(); if (!cli) return; const arr = out[cli] || (out[cli] = Array(12).fill(0)); for (let j = 0; j < 12; j++) arr[j] += num(r[4 + j]) }); return out }
  // AUP ponderado por marca = Σ (peso_categoría × AUP_categoría). El AUP se captura por categoría (Producto).
  const aupMarca = (mca) => {
    const aupCat = {}
    producto.forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(mca)) return; const rub = String(r[1] || ''); if (rub.indexOf('AUP · ') !== 0) return; const cat = rub.slice(6); aupCat[cat] = MESES.map((_, j) => num(r[4 + j])) })
    const arr = Array(12).fill(0)
    ;(cats[mca] || []).forEach(({ cat, peso }) => { const a = aupCat[cat]; if (!a) return; const w = num(peso) / 100; for (let j = 0; j < 12; j++) arr[j] += w * a[j] })
    return arr
  }
  const cobros2028 = (mca) => {
    const uni = unidades2028(mca), aup = aupMarca(mca), byCli = {}, total = Array(12).fill(0)
    Object.keys(uni).forEach((cli) => {
      const p = CF_PLAZO_MESES[data[`TERM|${mca}|${cli}`]] ?? 0
      const row = Array(12).fill(0)
      for (let j = 0; j < 12; j++) { const src = j - p; if (src >= 0) row[j] = (uni[cli][src] || 0) * (aup[src] || 0) }
      byCli[cli] = row; for (let j = 0; j < 12; j++) total[j] += row[j]
    })
    return { total, byCli }
  }
  const _cobCache = {}
  const getCobros = (mca) => _cobCache[mca] || (_cobCache[mca] = cobros2028(mca))

  const cell = (concepto, mi) => {
    if (concepto === CASHIN) {
      if (mi === DIC27) return isTotal ? sbuMarcas.reduce((s, m) => s + saldoTotal(m), 0) : saldoTotal(marca)   // Dic-27 = saldo cierre 2027
      if (mi >= 3) { const j = mi - 3; return isTotal ? sbuMarcas.reduce((s, m) => s + getCobros(m).total[j], 0) : getCobros(marca).total[j] } // 2028 = escalera
      return cellRaw(concepto, mi)
    }
    if (concepto === CF_COSTOS_PARENT) return CF_COSTOS.reduce((a, sub) => a + cellRaw(sub, mi), 0)
    return cellRaw(concepto, mi)
  }
  const subTot = (sub) => CF_MESES.reduce((a, _, mi) => a + cellRaw(sub, mi), 0)
  const rowTot = (concepto) => CF_MESES.reduce((a, _, mi) => a + cell(concepto, mi), 0)

  function guardar() {
    setSaving(true)
    try { localStorage.setItem(stKey, JSON.stringify(data)); setMsg({ t: 'ok', x: 'Guardado en este equipo. La escritura al Google Sheet y las fórmulas se conectan cuando definas la construcción.' }) }
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
        {isTotal && !fixedMarca && <button className="seg active" onClick={() => setMarca((sbus[sbu] || [])[0])}>Viendo total {sbu}</button>}
        <div className="spacer"></div>
        <button className="btn" onClick={() => { const aoa = [['EMPRESA', 'CONCEPTO', 'SBU', 'MARCA', ...CF_MESES]]; marcas.forEach(({ sbu: sb, marca: mca }) => CF_GROUPS.forEach((gr) => gr.items.forEach((it) => aoa.push([empresa, it, sb, mca, ...CF_MESES.map(() => 0)])))); exportXlsx(aoa, `${role.tab}_CASHFLOW_Plantilla.xlsx`) }}>📄 Plantilla</button>
        <label className="btnfile">⬆ Importar Excel<input type="file" accept=".xlsx,.xls" onChange={importar} hidden /></label>
        <button className="btn" onClick={exportar}>⬇ Exportar Excel</button>
        <button className="btn primary" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : '💾 Guardar'}</button>
      </div>
      <div className="panel">
        <h3>{role.label} — CASH FLOW <span className="unit">(USD · {isTotal ? `TOTAL ${sbu}` : marca})</span>{isTotal ? <span className="unit" style={{ marginLeft: 8 }}>👁️ solo lectura</span> : <span className="fill-badge">✏️ para llenar</span>}</h3>
        <div className="sub">Últimos 3 meses de 2027 + proyección 2028. {isTotal ? 'Suma de las marcas de la SBU.' : 'Captura por concepto y mes.'}</div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr><th className="l" rowSpan={2}>Concepto</th><th className="ya" colSpan={3}>2027</th><th className="yb" colSpan={12}>2028</th><th rowSpan={2}>Total</th></tr>
              <tr>{CF_M2027.map((m) => <th key={m} className="ya">{m}</th>)}{CF_M2028.map((m) => <th key={m} className="yb">{m}</th>)}</tr>
            </thead>
            <tbody>
              {CF_GROUPS.map((gr) => (
                <Fragment2 key={gr.g}>
                  <tr className="secrow"><td colSpan={17}>{gr.g}</td></tr>
                  {gr.items.map((it) => {
                    const esCostos = it === CF_COSTOS_PARENT
                    const celdas = CF_MESES.map((_, mi) => {
                      const cls = mi < 3 ? 'ya' : 'yb'
                      const cashinCalc = it === CASHIN && mi >= 2
                      if (isTotal || esCostos || cashinCalc) {
                        const tit = it === CASHIN ? (mi === DIC27 ? 'Saldo (deuda) cierre 2027' : 'Cobros según escalera (ventas × plazo)') : undefined
                        return <td key={mi} className={'tot ' + cls} title={tit}>{fmt(cell(it, mi))}</td>
                      }
                      const k = key(marca, it, mi)
                      return <td key={mi} className={'cell ' + cls}><input value={data[k] ?? ''} onChange={(e) => set(k, e.target.value)} inputMode="decimal" /></td>
                    })
                    const fila = <tr key={it} className={esCostos ? 'catrow rowline ' + (openCostos ? 'open' : '') : undefined} onClick={esCostos ? () => setOpenCostos((o) => !o) : undefined} style={esCostos ? { cursor: 'pointer' } : undefined}><td className="l">{esCostos ? <span className="caret">▶</span> : null} {it}{esCostos ? <span className="unit" style={{ marginLeft: 6 }}>({openCostos ? 'ocultar' : 'ver'} detalle: {CF_COSTOS.join(' + ')})</span> : null}</td>{celdas}<td className="tot">{fmt(rowTot(it))}</td></tr>
                    if (!esCostos) return fila
                    return (
                      <Fragment2 key={it}>
                        {fila}
                        {openCostos && CF_COSTOS.map((sub) => {
                          const sceldas = CF_MESES.map((_, mi) => {
                            const cls = mi < 3 ? 'ya' : 'yb'
                            if (isTotal) return <td key={mi} className={'tot ' + cls}>{fmt(cellRaw(sub, mi))}</td>
                            const k = key(marca, sub, mi)
                            return <td key={mi} className={'cell ' + cls}><input value={data[k] ?? ''} onChange={(e) => set(k, e.target.value)} inputMode="decimal" /></td>
                          })
                          return <tr key={sub}><td className="l sub2">{sub}</td>{sceldas}<td className="tot">{fmt(subTot(sub))}</td></tr>
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
        <h3>{role.label} — Términos de pago y saldo por cliente <span className="unit">({isTotal ? `TOTAL ${sbu}` : marca})</span>{!isTotal && <span className="fill-badge">✏️ para llenar</span>}</h3>
        <div className="sub">Clientes con histórico 2025/2026 y nuevos clientes 2028 (capturados en Ventas). Elige el <b>término de pago</b> y el <b>saldo (deuda) estimado</b> con que cierra 2027 cada cliente.</div>
        {isTotal ? <div className="note warn">Selecciona una marca específica (arriba) para editar los términos de pago por cliente.</div> : (() => {
          const cls = clientesDe(marca)
          return (
            <div className="tablewrap">
              <table>
                <thead><tr><th className="l">Cliente</th><th>Término de pagos</th><th>Saldo (deuda) estimado cierre 2027</th></tr></thead>
                <tbody>
                  {cls.length === 0 && <tr><td className="l" colSpan={3}>No hay clientes para {marca}. Carga el Histórico (2025/2026) o captura clientes en Ventas.</td></tr>}
                  {cls.map((cli) => {
                    const tk = `TERM|${marca}|${cli}`, sk = `SALDO|${marca}|${cli}`
                    return (
                      <tr key={cli}>
                        <td className="l">{cli}</td>
                        <td><select value={data[tk] ?? ''} onChange={(e) => set(tk, e.target.value)}><option value="">—</option>{CF_TERMINOS.map((t) => <option key={t}>{t}</option>)}</select></td>
                        <td className="cell"><input value={data[sk] ?? ''} onChange={(e) => set(sk, e.target.value)} inputMode="decimal" style={{ width: 130 }} /></td>
                      </tr>
                    )
                  })}
                  {cls.length > 0 && <tr className="grandrow"><td className="l">TOTAL</td><td></td><td className="tot">{fmt(saldoTotal(marca))}</td></tr>}
                </tbody>
              </table>
              <div className="sub" style={{ marginTop: 8 }}>Este total alimenta automáticamente <b>Cash In (Cobros) · Dic-27</b> del bloque de arriba.</div>
            </div>
          )
        })()}
      </div>

      {!isTotal && (() => {
        const cob = cobros2028(marca)
        const clientesCob = Object.keys(cob.byCli).sort((a, b) => a.localeCompare(b))
        const totAnual = cob.total.reduce((a, b) => a + b, 0)
        return (
          <div className="panel">
            <h3>{role.label} — Cobros 2028 · escalera <span className="unit">({marca})</span></h3>
            <div className="sub">Calculado: cada venta (<b>Unidades 2028 × AUP</b>) se cobra según el término del cliente. Cash = mismo mes · 30 días = +1 · 60 = +2 · 90 = +3 · 120 = +4 · 150 = +5 · 180 = +6. El <b>TOTAL por mes</b> alimenta <b>Cash In (Cobros)</b> de 2028 arriba.</div>
            <div className="tablewrap">
              <table>
                <thead><tr><th className="l">Cliente</th><th>Plazo</th>{CF_M2028.map((m) => <th key={m}>{m}</th>)}<th>Total</th></tr></thead>
                <tbody>
                  {clientesCob.length === 0 && <tr><td className="l" colSpan={15}>Sin cobros aún. Revisa que Ventas haya guardado unidades 2028 y Producto el AUP de {marca}.</td></tr>}
                  {clientesCob.map((cli) => { const row = cob.byCli[cli]; const t = row.reduce((a, b) => a + b, 0); if (t === 0) return null; return <tr key={cli}><td className="l">{cli}</td><td>{data[`TERM|${marca}|${cli}`] || '—'}</td>{row.map((v, i) => <td key={i} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(t)}</td></tr> })}
                  <tr className="grandrow"><td className="l">TOTAL COBROS → Cash In</td><td></td>{cob.total.map((v, i) => <td key={i} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(totAnual)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}
    </>
  )
}

/* ===== SBU WORKSPACE: dentro de una SBU salen las secciones (roles) con sus marcas ===== */
function SBUWorkspace({ sbuName, empresa, usuario, sbus }) {
  const SECS = ROLES.filter((r) => ['ventas', 'producto', 'marketing', 'logistica', 'director'].includes(r.id))
  const [secId, setSecId] = useState('ventas')
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
        {marca === '__TOTAL__'
          ? (<>
            <div className="toolbar" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
              <span className="empchip" style={{ background: col, marginLeft: 0 }}>▣ TOTAL {sbuName}</span>
              <button className={'seg' + (totTab === 'brand' ? ' active' : '')} onClick={() => setTotTab('brand')} style={totTab === 'brand' ? { background: col, borderColor: col, color: '#fff' } : {}}>📊 Brand Contribution</button>
              <button className={'seg' + (totTab === 'cash' ? ' active' : '')} onClick={() => setTotTab('cash')} style={totTab === 'cash' ? { background: col, borderColor: col, color: '#fff' } : {}}>💵 Cash Flow</button>
              <button className={'seg' + (totTab === 'resumen' ? ' active' : '')} onClick={() => setTotTab('resumen')} style={totTab === 'resumen' ? { background: col, borderColor: col, color: '#fff' } : {}}>📋 Resumen</button>
            </div>
            {totTab === 'brand'
              ? <BrandContribSBU empresa={empresa} sbuName={sbuName} marcasSBU={marcasSBU} />
              : totTab === 'cash'
              ? <CashFlowForm key={'cftot' + sbuName} role={cashRole} rubro={cashRubro} usuario={usuario} empresa={empresa} sbus={oneSbu} fixedMarca={`TOTAL::${sbuName}`} />
              : <GerenciaScreen empresa={empresa} sbus={sbus} soloSBU={sbuName} />}
          </>)
          : (<>
            <div className="toolbar" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
              <span className="empchip" style={{ background: acc, marginLeft: 0 }}>{marca}</span>
              {SECS.map((r) => { const on = r.id === secId; return <button key={r.id} className={'seg' + (on ? ' active' : '')} onClick={() => setSecId(r.id)} style={on ? { background: acc, borderColor: acc, color: '#fff' } : {}}>{r.icon} {r.label}</button> })}
              <button className={'seg' + (secId === 'cash' ? ' active' : '')} onClick={() => setSecId('cash')} style={secId === 'cash' ? { background: acc, borderColor: acc, color: '#fff' } : {}}>💵 Cash Flow</button>
              <button className={'seg' + (secId === 'viajes' ? ' active' : '')} onClick={() => setSecId('viajes')} style={secId === 'viajes' ? { background: acc, borderColor: acc, color: '#fff' } : {}}>🧳 Viajes equipo</button>
              <button className={'seg' + (secId === 'brand' ? ' active' : '')} onClick={() => setSecId('brand')} style={secId === 'brand' ? { background: acc, borderColor: acc, color: '#fff' } : {}}>📊 Brand Contribution</button>
            </div>
            {secId === 'brand'
              ? <BrandContribution empresa={empresa} marca={marca} />
              : secId === 'cash'
              ? <CashFlowForm key={'cf' + sbuName + marca} role={cashRole} rubro={cashRubro} usuario={usuario} empresa={empresa} sbus={oneSbu} fixedMarca={marca} />
              : secId === 'viajes'
              ? <ViajesEquipo empresa={empresa} marca={marca} sbuName={sbuName} marcasSBU={marcasSBU} />
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
  const [cargando, setCargando] = useState(true)
  useEffect(() => {
    (async () => {
      setCargando(true)
      try { const j = await gReadTab('Cap_Ventas'); if (j.ok && j.values) setVentas(j.values.slice(1)) } catch { }
      try { const j = await gReadTab('Cap_Producto'); if (j.ok && j.values) setProducto(j.values.slice(1)) } catch { }
      try { const j = await gReadTab('Cap_Categorias'); if (j.ok && j.values) { const out = {}; j.values.slice(1).forEach((row) => { if (upper(row[0]) !== upper(empresa)) return; const cat = row[1], mar = row[3], peso = num(row[4]); if (!mar || !cat) return; (out[mar] = out[mar] || []).push({ cat, peso }) }); setCats(out) } } catch { }
      setCargando(false)
    })()
  }, [empresa])

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
  return (
    <>
      <div className="panel">
        <h3>{soloSBU ? `Resumen ${soloSBU}` : 'Gerencia — consolidado ' + empresa} <span className="unit">(solo lectura · 2028)</span></h3>
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
      </div>
    </>
  )
}

/* ===== BRAND CONTRIBUTION: P&L por marca (estilo Excel HOKA) ===== */
function BrandContribution({ empresa, marca }) {
  const [P, setP] = useState({ ven: [], prod: [], cats: {}, mk: [], log: [], dir: [] })
  const [load, setLoad] = useState(true)
  useEffect(() => {
    (async () => {
      setLoad(true)
      const g = async (t) => { try { const j = await gReadTab(t); return j.ok && j.values ? j.values.slice(1) : [] } catch { return [] } }
      const [ven, prod, cap, mk, log, dir] = await Promise.all([g('Cap_Ventas'), g('Cap_Producto'), g('Cap_Categorias'), g('Cap_Marketing'), g('Cap_Logistica'), g('Cap_Director')])
      const cats = {}; cap.forEach((row) => { if (upper(row[0]) !== upper(empresa)) return; const c = row[1], mar = row[3], peso = num(row[4]); if (!mar || !c) return; (cats[mar] = cats[mar] || []).push({ cat: c, peso }) })
      setP({ ven, prod, cats, mk, log, dir }); setLoad(false)
    })()
  }, [empresa])

  const inMarca = (r) => upper(r[0]) === upper(empresa) && upper(r[3]) === upper(marca)
  const uniMes = () => { const a = Array(12).fill(0); P.ven.forEach((r) => { if (!inMarca(r)) return; if (String(r[1] || '').toUpperCase().startsWith('VIAJES')) return; for (let j = 0; j < 12; j++) a[j] += num(r[4 + j]) }); return a }
  const aupCat = () => { const o = {}; P.prod.forEach((r) => { if (!inMarca(r)) return; const rub = String(r[1] || ''); if (rub.indexOf('AUP · ') !== 0) return; o[rub.slice(6)] = MESES.map((_, j) => num(r[4 + j])) }); return o }
  const aucMes = () => { const a = Array(12).fill(0); P.prod.forEach((r) => { if (!inMarca(r) || upper(r[1]) !== 'AUC') return; for (let j = 0; j < 12; j++) a[j] = num(r[4 + j]) }); return a }
  const sumTab = (rows, filt) => { let s = 0; rows.forEach((r) => { if (!inMarca(r)) return; if (filt && !filt(String(r[1] || ''))) return; for (let j = 0; j < 12; j++) s += num(r[4 + j]) }); return s }

  const u = uniMes(), ac = aucMes(), acat = aupCat()
  const catList = P.cats[marca] || []
  const aupMes = () => { const a = Array(12).fill(0); catList.forEach(({ cat, peso }) => { const x = acat[cat]; if (!x) return; const w = num(peso) / 100; for (let j = 0; j < 12; j++) a[j] += w * x[j] }); return a }
  const ap = aupMes()
  let unidades = 0, ventaNeta = 0, costo = 0
  for (let j = 0; j < 12; j++) { unidades += u[j]; ventaNeta += u[j] * ap[j]; costo += u[j] * ac[j] }
  const comisiones = 0
  const logistica = sumTab(P.log)
  const marketing = sumTab(P.mk)
  const viajes = [P.ven, P.prod, P.mk, P.log, P.dir].reduce((t, rows) => t + sumTab(rows, (rub) => rub.toUpperCase().startsWith('VIAJES')), 0)
  const margenBruto = ventaNeta - costo - comisiones - logistica
  const brand = margenBruto - marketing - viajes
  const pct = (x) => ventaNeta ? (x / ventaNeta * 100).toFixed(1) + '%' : '—'

  const fila = (lbl, val, strong) => <tr className={strong ? 'grandrow' : undefined}><td className="l">{lbl}</td><td className="tot">{fmt(val)}</td><td className="ref">{pct(val)}</td></tr>

  return (
    <div className="panel">
      <h3 style={{ color: marcaColor(marca) }}>Brand Contribution — {marca} <span className="unit">(2028 · solo lectura)</span></h3>
      <div className="sub">Venta Neta = Unidades × AUP · Costo = Unidades × AUC · Margen Bruto = Venta Neta − Costo − Comisiones − Logística · Brand Contribution = Margen Bruto − Marketing − Viajes.</div>
      {load ? <div className="sub">Cargando…</div> : (<>
        <div className="tablewrap" style={{ maxWidth: 560 }}>
          <table>
            <thead><tr><th className="l">Concepto</th><th>Monto</th><th>% VN</th></tr></thead>
            <tbody>
              <tr><td className="l">Unidades</td><td className="tot">{fmt(unidades)}</td><td className="ref">—</td></tr>
              {fila('Venta Neta', ventaNeta, true)}
              {fila('(−) Costo', costo)}
              {fila('(−) Comisiones', comisiones)}
              {fila('(−) Logística', logistica)}
              {fila('= Margen Bruto', margenBruto, true)}
              {fila('(−) Marketing', marketing)}
              {fila('(−) Viajes', viajes)}
              {fila('= BRAND CONTRIBUTION', brand, true)}
            </tbody>
          </table>
        </div>
        {catList.length > 0 && <div className="tablewrap" style={{ marginTop: 14 }}>
          <table>
            <thead><tr><th className="l">Categoría</th><th>Peso %</th><th>Unidades</th><th>Venta Neta</th></tr></thead>
            <tbody>
              {catList.map(({ cat, peso }, i) => { const w = num(peso) / 100; const x = acat[cat] || []; let un = 0, vn = 0; for (let j = 0; j < 12; j++) { un += u[j] * w; vn += u[j] * w * (x[j] || 0) } return <tr key={i}><td className="l">{cat}</td><td>{num(peso).toFixed(1)}%</td><td className="tot">{fmt(un)}</td><td className="tot">{fmt(vn)}</td></tr> })}
            </tbody>
          </table>
        </div>}
        {(comisiones === 0) && <div className="sub" style={{ marginTop: 8 }}>Nota: Comisiones y Venta Bruta/Descuentos aún no se capturan por marca; se conectan cuando definamos esos campos.</div>}
      </>)}
    </div>
  )
}

/* ===== BRAND CONTRIBUTION por SBU: todas las marcas lado a lado + comparación FY2026/FY2025 ===== */
function BrandContribSBU({ empresa, sbuName, marcasSBU }) {
  const [P, setP] = useState(null)
  useEffect(() => {
    (async () => {
      const g = async (t) => { try { const j = await gReadTab(t); return j.ok && j.values ? j.values.slice(1) : [] } catch { return [] } }
      const [ven, prod, cap, mk, log, dir] = await Promise.all([g('Cap_Ventas'), g('Cap_Producto'), g('Cap_Categorias'), g('Cap_Marketing'), g('Cap_Logistica'), g('Cap_Director')])
      let hist = []; try { const j = await gHistorico(); if (j && j.ok && j.values) hist = j.values.slice(1) } catch { }
      const cats = {}; cap.forEach((row) => { if (upper(row[0]) !== upper(empresa)) return; const c = row[1], mar = row[3], peso = num(row[4]); if (!mar || !c) return; (cats[mar] = cats[mar] || []).push({ cat: c, peso }) })
      setP({ ven, prod, cats, mk, log, dir, hist })
    })()
  }, [empresa])

  if (!P) return <div className="panel"><h3>Brand Contribution — {sbuName}</h3><div className="sub">Cargando…</div></div>

  const inM = (r, mca) => upper(r[0]) === upper(empresa) && upper(r[3]) === upper(mca)
  const uniMes = (mca) => { const a = Array(12).fill(0); P.ven.forEach((r) => { if (!inM(r, mca)) return; if (String(r[1] || '').toUpperCase().startsWith('VIAJES')) return; for (let j = 0; j < 12; j++) a[j] += num(r[4 + j]) }); return a }
  const aupCat = (mca) => { const o = {}; P.prod.forEach((r) => { if (!inM(r, mca)) return; const rub = String(r[1] || ''); if (rub.indexOf('AUP · ') !== 0) return; o[rub.slice(6)] = MESES.map((_, j) => num(r[4 + j])) }); return o }
  const aucMes = (mca) => { const a = Array(12).fill(0); P.prod.forEach((r) => { if (!inM(r, mca) || upper(r[1]) !== 'AUC') return; for (let j = 0; j < 12; j++) a[j] = num(r[4 + j]) }); return a }
  const sumTab = (rows, mca, filt) => { let s = 0; rows.forEach((r) => { if (!inM(r, mca)) return; if (filt && !filt(String(r[1] || ''))) return; for (let j = 0; j < 12; j++) s += num(r[4 + j]) }); return s }
  const esViaje = (rub) => rub.toUpperCase().startsWith('VIAJES')

  const calc = (mca) => {
    const u = uniMes(mca), ac = aucMes(mca), acat = aupCat(mca), catL = P.cats[mca] || []
    const ap = Array(12).fill(0); catL.forEach(({ cat, peso }) => { const x = acat[cat]; if (!x) return; const w = num(peso) / 100; for (let j = 0; j < 12; j++) ap[j] += w * x[j] })
    let unidades = 0, ventaNeta = 0, costo = 0; for (let j = 0; j < 12; j++) { unidades += u[j]; ventaNeta += u[j] * ap[j]; costo += u[j] * ac[j] }
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

  const filas = [
    { k: 'Unidades', get: (v) => v.unidades },
    { k: 'Venta Neta', get: (v) => v.ventaNeta, strong: true, fy26: fyVenta(2026), fy25: fyVenta(2025) },
    { k: '(−) Costo', get: (v) => v.costo, fy26: fyCosto(2026), fy25: fyCosto(2025) },
    { k: '(−) Comisiones', get: (v) => v.comisiones },
    { k: '(−) Logística', get: (v) => v.logistica },
    { k: '= Margen Bruto', get: (v) => v.margenBruto, strong: true, fy26: fyMargen(2026), fy25: fyMargen(2025) },
    { k: '(−) Marketing', get: (v) => v.marketing },
    { k: '(−) Viajes', get: (v) => v.viajes },
    { k: '= BRAND CONTRIBUTION', get: (v) => v.brand, strong: true },
  ]

  return (
    <div className="panel">
      <h3 style={{ color: sbuColor(sbuName) }}>Brand Contribution — {sbuName} <span className="unit">(por marca · 2028 · solo lectura)</span></h3>
      <div className="sub">P&amp;L de cada marca lado a lado. Las columnas <b>FY2026</b> y <b>FY2025</b> comparan el total de la SBU en Venta Neta, Costo y Margen (lo que existe en el histórico del EBP).</div>
      <div className="tablewrap">
        <table className="vfix" style={{ width: 'auto', minWidth: 520 }}>
          <thead><tr><th className="l">Concepto</th>{cols.map(({ m }) => <th key={m} style={{ color: marcaColor(m) }}>{m}</th>)}<th>TOTAL SBU</th><th className="ya">FY2026</th><th className="ya">FY2025</th></tr></thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.k} className={f.strong ? 'grandrow' : undefined}>
                <td className="l">{f.k}</td>
                {cols.map(({ m, v }) => <td key={m} className="tot">{fmt(f.get(v))}</td>)}
                <td className="tot">{fmt(f.get(tot))}</td>
                <td className="tot ya">{f.fy26 != null ? fmt(f.fy26) : '—'}</td>
                <td className="tot ya">{f.fy25 != null ? fmt(f.fy25) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sub" style={{ marginTop: 8 }}>Nota: Comisiones y Venta Bruta/Descuentos aún no se capturan por marca; Marketing y Viajes no tienen histórico, por eso FY solo compara Venta, Costo y Margen.</div>
    </div>
  )
}

/* ===== VIAJES DEL EQUIPO: consolidado por rol/marca (vista Director) ===== */
function ViajesEquipo({ empresa, marca, sbuName, marcasSBU }) {
  const rolesV = ROLES.filter((r) => r.rubros.some((rb) => rb.k === 'VIAJES'))
  const [tabs, setTabs] = useState(null)
  useEffect(() => {
    let cancel = false
    ;(async () => {
      const out = {}
      await Promise.all(rolesV.map(async (r) => { try { const j = await gReadTab(r.tab); out[r.tab] = (j && j.ok && j.values) ? j.values.slice(1) : [] } catch { out[r.tab] = [] } }))
      if (!cancel) setTabs(out)
    })()
    return () => { cancel = true }
  }, [empresa])

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

  // Tabla principal: rol × mes para la marca seleccionada
  const filas = rolesV.map((r) => ({ r, mes: viajesMes(r.tab, marca), tot: anual(r.tab, marca) }))
  const totMarcaMes = MESES.map((_, mi) => filas.reduce((s, f) => s + f.mes[mi], 0))
  const totMarca = totMarcaMes.reduce((s, v) => s + v, 0)

  return (
    <>
      <div className="panel">
        <h3 style={{ color: marcaColor(marca) }}>Viajes del equipo — {marca} <span className="unit">(solo lectura · 2028)</span></h3>
        <div className="sub">Suma de los viajes que cada área captura para esta marca. El Director llena los suyos en la sección <b>Director</b>; aquí ve además los del resto del equipo, el total por marca y el total de la SBU.</div>
        <div className="tablewrap">
          <table className="vfix">
            <colgroup><col style={{ width: '160px' }} />{MESES.map((_, i) => <col key={i} style={{ width: '64px' }} />)}<col style={{ width: '80px' }} /></colgroup>
            <thead><tr><th className="l">Área</th>{MESES.map((m) => <th key={m}>{m.replace('-28', '')}</th>)}<th>Total</th></tr></thead>
            <tbody>
              {filas.map((f) => <tr key={f.r.id}><td className="l">{f.r.icon} {f.r.label}</td>{f.mes.map((v, i) => <td key={i} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(f.tot)}</td></tr>)}
              <tr className="grandrow"><td className="l">Total {marca}</td>{totMarcaMes.map((v, i) => <td key={i} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(totMarca)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel">
        <h3>Viajes por marca — {sbuName}</h3>
        <div className="sub">Total de viajes del equipo por cada marca de la SBU, con el total de la SBU al final.</div>
        <div className="tablewrap">
          <table>
            <thead><tr><th className="l">Marca</th>{rolesV.map((r) => <th key={r.id}>{r.label}</th>)}<th>Total marca</th></tr></thead>
            <tbody>
              {(marcasSBU || []).map((m) => { const cols = rolesV.map((r) => anual(r.tab, m)); const t = cols.reduce((s, v) => s + v, 0); return <tr key={m}><td className="l"><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: marcaColor(m), marginRight: 7 }}></span>{m}</td>{cols.map((v, i) => <td key={i} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(t)}</td></tr> })}
              <tr className="grandrow"><td className="l">Total {sbuName}</td>{rolesV.map((r) => <td key={r.id} className="tot">{fmt((marcasSBU || []).reduce((s, m) => s + anual(r.tab, m), 0))}</td>)}<td className="tot">{fmt((marcasSBU || []).reduce((s, m) => s + rolesV.reduce((a, r) => a + anual(r.tab, m), 0), 0))}</td></tr>
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
  const [asign, setAsign] = useState(() => seed(combos[empresa]))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [colabs, setColabs] = useState([])
  const [savingC, setSavingC] = useState(false)
  const [msgC, setMsgC] = useState(null)
  useEffect(() => {
    (async () => { try { const j = await gReadTab('Cap_Colaboradores'); if (j && j.ok && j.values) { const out = []; j.values.slice(1).forEach((row) => { if (upper(row[0]) !== upper(empresa)) return; out.push({ nombre: row[1] || '', rol: row[2] || '', email: row[3] || '', acceso: String(row[4] || '').split(';').filter(Boolean), todas: upper(row[5]) === 'TODAS' }) }); setColabs(out) } else setColabs([]) } catch { } })()
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
    const rows = colabs.filter((c) => String(c.email).trim() || String(c.nombre).trim()).map((c) => ({ rubro: c.nombre, sbu: c.rol, marca: c.email, meses: [(c.acceso || []).join(';'), c.todas ? 'TODAS' : ''] }))
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
            <thead><tr><th className="l">Nombre del colaborador</th><th className="l">Email</th><th>Rol</th><th className="l">Acceso a pestañas</th><th>Ve todas las empresas</th><th></th></tr></thead>
            <tbody>
              {colabs.length === 0 && <tr><td className="l" colSpan={6}>Agrega colaboradores con el botón de arriba.</td></tr>}
              {colabs.map((c, i) => (
                <tr key={i}>
                  <td className="l"><input style={{ width: '95%', padding: '6px' }} value={c.nombre} onChange={(e) => setColabs(colabs.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))} placeholder="Nombre" /></td>
                  <td className="l"><input style={{ width: '95%', padding: '6px' }} value={c.email} onChange={(e) => setColabs(colabs.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} placeholder="correo@empresa.com" /></td>
                  <td><select value={c.rol} onChange={(e) => setColabs(colabs.map((x, j) => j === i ? { ...x, rol: e.target.value } : x))}>{ROLES.map((r) => <option key={r.id}>{r.label}</option>)}</select></td>
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
  function setUsarCat(v) { try { const u = JSON.parse(localStorage.getItem('usarcat_' + empresa) || '{}'); u[marca] = v; localStorage.setItem('usarcat_' + empresa, JSON.stringify(u)) } catch { } setTick((t) => t + 1) }
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
  async function guardar() {
    setSaving(true); setMsg(null)
    const sbu = sbuDe(sbus, marca)
    const rows = lista.filter((o) => String(o.cat).trim()).map((o) => ({ rubro: o.cat, sbu, marca, meses: [num(o.peso), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }))
    await postToTab('Cap_Categorias', empresa, usuario, role.label, rows, setMsg)
    setSaving(false)
  }
  return (
    <>
      <div className="toolbar">
        {!fixedMarca && <><label>Marca</label>
        <select value={marca} onChange={(e) => setMarca(e.target.value)}>{Object.entries(sbus).map(([s, ms]) => <optgroup key={s} label={s}>{ms.map((m) => <option key={m}>{m}</option>)}</optgroup>)}</select></>}
        <div className="spacer"></div>
        <button className="btn" onClick={() => setLista([...lista, { cat: '', peso: 0 }])}>➕ Agregar categoría</button>
        <button className="btn primary" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : '💾 Guardar'}</button>
      </div>
      {msg && <div className={'note ' + msg.t}>{msg.x}</div>}
      <div className="panel">
        <h3>Categorías de {marca} <span className="unit">(peso %)</span><span className="fill-badge">✏️ para llenar</span></h3>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: '2px 0 10px', fontWeight: 600 }}><input type="checkbox" checked={usarCat} onChange={(e) => setUsarCat(e.target.checked)} /> Usar categorías para {marca} <span className="unit">(si lo desactivas, Ventas solo usa el crecimiento por cliente)</span></label>
        <div className="sub">Define las categorías de la marca y cuánto pesa cada una (debería sumar 100%). Suma actual: <b className={Math.round(suma) === 100 ? 'pos' : 'neg'}>{suma.toFixed(1)}%</b>. Las usa Ventas para repartir las unidades.</div>
        <div className="tablewrap">
          <table>
            <thead><tr><th className="l">Categoría</th><th>Peso %</th><th></th></tr></thead>
            <tbody>
              {lista.length === 0 && <tr><td className="l" colSpan={3}>Agrega categorías con el botón de arriba.</td></tr>}
              {lista.map((o, i) => (
                <tr key={i}>
                  <td className="l"><input style={{ width: '90%', padding: '6px' }} value={o.cat} onChange={(e) => setLista(lista.map((x, j) => j === i ? { ...x, cat: e.target.value } : x))} placeholder="Ej. ROAD, TRAIL, HIKE…" /></td>
                  <td className="cell"><input value={o.peso} onChange={(e) => setLista(lista.map((x, j) => j === i ? { ...x, peso: e.target.value } : x))} inputMode="decimal" /></td>
                  <td><button className="btn" onClick={() => setLista(lista.filter((_, j) => j !== i))}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
  const [growth, setGrowth] = useState(() => { try { return JSON.parse(localStorage.getItem('ventas_growth_' + empresa) || '{}') } catch { return {} } })
  const [catPart, setCatPart] = useState(() => { try { return JSON.parse(localStorage.getItem('catpart_' + empresa) || '{}') } catch { return {} } })
  useEffect(() => { try { localStorage.setItem('catpart_' + empresa, JSON.stringify(catPart)) } catch { } }, [catPart, empresa])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    (async () => {
      try { const j = await gHistorico(); if (j && j.ok && j.values) setHist(j.values.slice(1)) } catch { }
      try { const j2 = await gReadTab('Cap_Categorias'); if (j2 && j2.ok && j2.values) { const out = {}; j2.values.slice(1).forEach((row) => { if (upper(row[0]) !== upper(empresa)) return; const cat = row[1], mar = row[3], peso = num(row[4]); if (!mar || !cat) return; (out[mar] = out[mar] || []).push({ cat, peso }) }); setCats(out) } } catch { }
      try { const j3 = await gReadTab('Cap_Producto'); if (j3 && j3.ok && j3.values) setProducto(j3.values.slice(1)) } catch { }
    })()
  }, [empresa])
  // AUP por categoría (Producto): { categoría: [12] }
  const aupPorCat = (mca) => { const out = {}; producto.forEach((r) => { if (upper(r[0]) !== upper(empresa) || upper(r[3]) !== upper(mca)) return; const rub = String(r[1] || ''); if (rub.indexOf('AUP · ') !== 0) return; out[rub.slice(6)] = MESES.map((_, j) => num(r[4 + j])) }); return out }
  useEffect(() => { try { localStorage.setItem('ventas_growth_' + empresa, JSON.stringify(growth)) } catch { } }, [growth, empresa])

  const u2026 = {}, cliByMarca = {}
  hist.forEach((r) => { if (upper(r[3]).indexOf('UNIDAD') < 0) return; if (String(r[1]) !== '2026') return; const mi = mesIdx(r[6]); if (mi < 0) return; const mar = r[5], cli = r[8] || '(sin cliente)', k = cli + '|' + mar; (u2026[k] = u2026[k] || Array(12).fill(0))[mi] += num(r[7]); (cliByMarca[mar] = cliByMarca[mar] || new Set()).add(cli) })
  const clientes = [...(cliByMarca[marca] || [])].sort((a, b) => (u2026[b + '|' + marca] || []).reduce((s, v) => s + v, 0) - (u2026[a + '|' + marca] || []).reduce((s, v) => s + v, 0))
  const g = (cli) => num(growth[cli + '|' + marca])
  const u26 = (cli, mi) => (u2026[cli + '|' + marca] || [])[mi] || 0
  const u28 = (cli, mi) => Math.round(u26(cli, mi) * (1 + g(cli) / 100))
  const setG = (cli, val) => setGrowth({ ...growth, [cli + '|' + marca]: val })
  const t26 = (cli) => MESES.reduce((a, _, mi) => a + u26(cli, mi), 0)
  const t28 = (cli) => MESES.reduce((a, _, mi) => a + u28(cli, mi), 0)
  const totMarcaSel = clientes.reduce((s, cli) => s + t28(cli), 0)
  const totMarca = {}
  const mesMarca = {}
  Object.keys(u2026).forEach((k) => { const p = k.split('|'), cli = p[0], mar = p[1], gg = num(growth[cli + '|' + mar]); const arr = mesMarca[mar] || (mesMarca[mar] = Array(12).fill(0)); let t = 0; for (let mi = 0; mi < 12; mi++) { const v = Math.round((u2026[k][mi] || 0) * (1 + gg / 100)); arr[mi] += v; t += v } totMarca[mar] = (totMarca[mar] || 0) + t })
  const mes28 = MESES.map((_, mi) => clientes.reduce((a, cli) => a + u28(cli, mi), 0))
  const mes26 = MESES.map((_, mi) => clientes.reduce((a, cli) => a + u26(cli, mi), 0))
  const tot26Marca = mes26.reduce((a, b) => a + b, 0)
  const crecMarca = tot26Marca ? (totMarcaSel - tot26Marca) / tot26Marca * 100 : 0

  async function guardar() {
    setSaving(true); setMsg(null)
    const sbu = sbuDe(sbus, marca)
    const rows = clientes.map((cli) => ({ rubro: cli, sbu, marca, meses: MESES.map((_, mi) => u28(cli, mi)) })).filter((r) => r.meses.some((v) => v !== 0))
    await postToTab('Cap_Ventas', empresa, usuario, role.label, rows, setMsg)
    setSaving(false)
  }
  const catList = cats[marca] || []
  // ¿El Director activó categorías para esta marca? (lo define en su pestaña; por defecto sí si hay categorías)
  const usarCat = (() => { try { const u = JSON.parse(localStorage.getItem('usarcat_' + empresa) || '{}'); return u[marca] !== false } catch { return true } })() && catList.length > 0
  // Participación de categorías por cliente (check). Sin marcar = participa en todas.
  const partOf = (cli) => { const k = cli + '|' + marca; return catPart[k] === undefined ? catList.map((c) => c.cat) : catPart[k] }
  const toggleCat = (cli, cat) => { const cur = partOf(cli); const nx = cur.includes(cat) ? cur.filter((x) => x !== cat) : [...cur, cat]; setCatPart({ ...catPart, [cli + '|' + marca]: nx }) }
  const pesoCat = {}; catList.forEach((c) => { pesoCat[c.cat] = num(c.peso) })
  const catW = (cli, cat) => { const part = partOf(cli); if (!part.includes(cat)) return 0; const den = part.reduce((a, c) => a + (pesoCat[c] || 0), 0); return den > 0 ? (pesoCat[cat] || 0) / den : (part.length ? 1 / part.length : 0) }
  const uCatMes = (cat, mi) => clientes.reduce((a, cli) => a + u28(cli, mi) * catW(cli, cat), 0)

  return (
    <>
      {!fixedMarca && <div className="panel">
        <h3>Resumen por SBU y marca <span className="unit">(unidades 2028 por mes)</span></h3>
        <div className="sub">Unidades 2028 (= 2026 × (1 + % crecimiento)) por marca y mes. Las SBU muestran el subtotal de sus marcas.</div>
        <div className="tablewrap">
          <table className="vfix">
            <colgroup><col style={{ width: '330px' }} />{MESES.map((_, i) => <col key={i} style={{ width: '64px' }} />)}<col style={{ width: '70px' }} /></colgroup>
            <thead><tr><th className="l">SBU / Marca</th>{MESES.map((m) => <th key={m}>{m.replace('-28', '')}</th>)}<th>Total</th></tr></thead>
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
      {usarCat && <div className="panel">
        <h3>Categorías por cliente — {marca}<span className="fill-badge">✏️ para llenar</span></h3>
        <div className="sub">Marca en cuáles categorías participa cada cliente. Con una sola categoría toma el 100% (sin ponderar); con varias, se reparte con los pesos del Director.</div>
        <div className="tablewrap">
          <table>
            <thead><tr><th className="l">Cliente</th>{catList.map((c) => <th key={c.cat}>{c.cat} <span className="unit">{num(c.peso).toFixed(0)}%</span></th>)}</tr></thead>
            <tbody>
              {clientes.length === 0 && <tr><td className="l" colSpan={catList.length + 1}>No hay clientes con histórico para {marca}.</td></tr>}
              {clientes.map((cli) => <tr key={cli}><td className="l">{cli}</td>{catList.map((c) => { const on = partOf(cli).includes(c.cat); return <td key={c.cat}><input type="checkbox" checked={on} onChange={() => toggleCat(cli, c.cat)} /></td> })}</tr>)}
            </tbody>
          </table>
        </div>
      </div>}

      <div className="panel">
        <h3>Unidades 2028 por categoría y mes — {marca}</h3>
        <div className="sub">{usarCat ? 'Las unidades de cada cliente se reparten por categoría según su participación y los pesos del Director.' : 'Categorías desactivadas por el Director: solo el total por mes.'}</div>
        <div className="tablewrap">
          <table className="vfix">
            <colgroup><col style={{ width: '270px' }} /><col style={{ width: '60px' }} />{MESES.map((_, i) => <col key={i} style={{ width: '64px' }} />)}<col style={{ width: '70px' }} /></colgroup>
            <thead><tr><th className="l">Categoría</th><th>Peso %</th>{MESES.map((m) => <th key={m}>{m.replace('-28', '')}</th>)}<th>Total</th></tr></thead>
            <tbody>
              <tr className="grandrow"><td className="l">TOTAL {marca}</td><td></td>{mes28.map((v, i) => <td key={i} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(totMarcaSel)}</td></tr>
              {!usarCat && <tr><td className="l" colSpan={15}>Categorías desactivadas para {marca}.</td></tr>}
              {usarCat && catList.map((c, i) => { const row = MESES.map((_, mi) => uCatMes(c.cat, mi)); const t = row.reduce((a, b) => a + b, 0); return <tr key={i}><td className="l">{c.cat}</td><td>{num(c.peso).toFixed(1)}%</td>{row.map((v, mi) => <td key={mi} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(t)}</td></tr> })}
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
            <h3>Venta Neta 2028 por categoría y mes — {marca} <span className="unit">($)</span></h3>
            <div className="sub">Venta Neta = Unidades 2028 (por categoría) × AUP. El AUP lo captura Producto.</div>
            <div className="tablewrap">
              <table className="vfix">
                <colgroup><col style={{ width: '270px' }} /><col style={{ width: '60px' }} />{MESES.map((_, i) => <col key={i} style={{ width: '64px' }} />)}<col style={{ width: '70px' }} /></colgroup>
                <thead><tr><th className="l">Categoría</th><th>AUP</th>{MESES.map((m) => <th key={m}>{m.replace('-28', '')}</th>)}<th>Total</th></tr></thead>
                <tbody>
                  <tr className="grandrow"><td className="l">TOTAL {marca}</td><td></td>{vnMes.map((v, i) => <td key={i} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(vnTot)}</td></tr>
                  {catList.map((c, i) => { const a = aup[c.cat] || []; const row = MESES.map((_, mi) => vnCat(c.cat, mi)); const rt = row.reduce((s, x) => s + x, 0); const aupProm = (() => { const nz = a.filter((x) => x !== 0); return nz.length ? nz.reduce((s, x) => s + x, 0) / nz.length : 0 })(); return <tr key={i}><td className="l">{c.cat}</td><td className="ref">{fmt(aupProm)}</td>{row.map((v, mi) => <td key={mi} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(rt)}</td></tr> })}
                </tbody>
              </table>
            </div>
            {Object.keys(aup).length === 0 && <div className="sub" style={{ marginTop: 8 }}>Si sale en cero, Producto aún no ha capturado el AUP de las categorías de {marca}.</div>}
          </div>
        )
      })()}

      <div className="panel">
        <h3>Ventas · Unidades 2028 — {marca}<span className="fill-badge">✏️ para llenar</span></h3>
        <div className="sub">Escribe <b>un % de crecimiento por cliente</b>: se aplica a todos los meses de 2026 para proyectar 2028. La fila gris es el histórico 2026 (referencia). Total 2028 de {marca}: <b>{fmt(totMarcaSel)} ud</b></div>
        <div className="tablewrap">
          <table className="vfix" style={{ width: 1228 }}>
            <colgroup><col style={{ width: '220px' }} /><col style={{ width: '55px' }} /><col style={{ width: '55px' }} />{MESES.map((_, i) => <col key={i} style={{ width: '64px' }} />)}<col style={{ width: '70px' }} /><col style={{ width: '60px' }} /></colgroup>
            <thead><tr><th className="l">Cliente</th><th>% Crec</th><th>Año</th>{MESES.map((m) => <th key={m}>{m.replace('-28', '')}</th>)}<th>Total</th><th>% Peso</th></tr></thead>
            <tbody>
              {clientes.length === 0 && <tr><td className="l" colSpan={17}>No hay clientes con histórico 2026 para {marca}. Carga el Histórico primero (unidades 2026).</td></tr>}
              {clientes.map((cli) => (
                <Fragment2 key={cli}>
                  <tr>
                    <td className="l" rowSpan={2}>{cli}</td>
                    <td className="cell" rowSpan={2}><input value={growth[cli + '|' + marca] ?? ''} onChange={(e) => setG(cli, e.target.value)} inputMode="decimal" placeholder="%" /></td>
                    <td className="yl">2026</td>
                    {MESES.map((_, mi) => <td key={mi} className="ref">{fmt(u26(cli, mi))}</td>)}
                    <td className="ref"><b>{fmt(t26(cli))}</b></td>
                    <td className="ref">{tot26Marca ? (t26(cli) / tot26Marca * 100).toFixed(1) + '%' : '—'}</td>
                  </tr>
                  <tr className="proy2028">
                    <td className="yl proyl">2028</td>
                    {MESES.map((_, mi) => <td key={mi} className="tot">{fmt(u28(cli, mi))}</td>)}
                    <td className="tot">{fmt(t28(cli))}</td>
                    <td className="tot">{totMarcaSel ? (t28(cli) / totMarcaSel * 100).toFixed(1) + '%' : '—'}</td>
                  </tr>
                </Fragment2>
              ))}
              {clientes.length > 0 && <>
                <tr className="grandrow"><td className="l" rowSpan={2}>TOTAL {marca}</td><td rowSpan={2}>{tot26Marca ? (crecMarca >= 0 ? '+' : '') + crecMarca.toFixed(1) + '%' : '—'}</td><td>2026</td>{mes26.map((v, i) => <td key={i} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(tot26Marca)}</td><td className="tot">100%</td></tr>
                <tr className="grandrow"><td>2028</td>{mes28.map((v, i) => <td key={i} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(totMarcaSel)}</td><td className="tot">100%</td></tr>
              </>}
            </tbody>
          </table>
        </div>
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
