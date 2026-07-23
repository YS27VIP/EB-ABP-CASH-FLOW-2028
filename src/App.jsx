import { useState, useEffect } from 'react'
import './App.css'

/* ===== CONFIG ===== */
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby1SWtgyQRVlkjnUUXfqCZ9hrStbZ6ffJovh8nYaVXyGuu3Opal55Kg3GmELLpZ6GpJ3A/exec'

const MESES = ['ene-28','feb-28','mar-28','abr-28','may-28','jun-28','jul-28','ago-28','sep-28','oct-28','nov-28','dic-28']

const DEFAULT_SBUS = {
  'SBU 1': ['ALTRA','FJALLRAVEN','HOKA','INJINJI','NORDA'],
  'SBU 2': ['ARIAT','BIRKENSTOCK','BLUNDSTONE','ECCO','FLOWER MOUNTAIN','UGG'],
  'SBU 3': ['COTOPAXI','FITFLOP','FOAMERS','GOORIN BROS','KEEN','MAMMUT'],
}
const ALL_MARCAS = Object.values(DEFAULT_SBUS).flat()
const SBU_NAMES = ['SBU 1', 'SBU 2', 'SBU 3']

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
  { id: 'ventas',    label: 'Ventas',    icon: '📈', color: '#714B67', tab: 'Cap_Ventas',    rubros: [{ k: 'UNIDADES', u: 'ud' }, VJ] },
  { id: 'producto',  label: 'Producto',  icon: '📦', color: '#017e84', tab: 'Cap_Producto',  rubros: [{ k: 'AUP', u: '$' }, { k: 'AUC', u: '$' }, VJ, { k: 'INVENTARIO COMPRAS', u: '$' }] },
  { id: 'marketing', label: 'Marketing', icon: '🎯', color: '#d9822b', tab: 'Cap_Marketing', rubros: [{ k: 'MARKETING', u: '$', detalle: MK_GROUPS, extrasKey: 'mk_extras' }, VJ] },
  { id: 'logistica', label: 'Logística', icon: '🚚', color: '#3b6ea5', tab: 'Cap_Logistica', rubros: [{ k: 'LOGISTICA', u: '$' }] },
  { id: 'finanzas',  label: 'Finanzas',  icon: '💰', color: '#2e7d32', tab: 'Cap_Finanzas',  rubros: [VJ, { k: 'CASH FLOW', u: '$' }] },
  { id: 'director',  label: 'Director',  icon: '🧑‍💼', color: '#8f4b7e', tab: 'Cap_Director',  rubros: [VJ, { k: 'CASH FLOW', u: '$' }] },
]

/* ===== helpers ===== */
const num = (v) => { const n = parseFloat(String(v).replace(/[^0-9.-]/g, '')); return isNaN(n) ? 0 : n }
const fmt = (v) => (v ? Math.round(v).toLocaleString('en-US') : '')

function effSBUS(empresa, combos) {
  const c = combos[empresa]
  if (!c || !SBU_NAMES.some((s) => (c[s] || []).length)) return DEFAULT_SBUS
  const out = {}, asignadas = new Set()
  SBU_NAMES.forEach((s) => { out[s] = (c[s] || []).slice(); out[s].forEach((m) => asignadas.add(m)) })
  const rest = ALL_MARCAS.filter((m) => !asignadas.has(m))
  if (rest.length) out['Sin asignar'] = rest
  return out
}
const marcasDe = (sbus) => Object.entries(sbus).flatMap(([sbu, ms]) => ms.map((m) => ({ sbu, marca: m })))
const sbuDe = (sbus, marca) => marcasDe(sbus).find((x) => x.marca === marca)?.sbu || ''

/* ===== APP ===== */
export default function App() {
  const [usuario, setUsuario] = useState('')
  const [empresas, setEmpresas] = useState(['EMPRESA 1'])
  const [empresa, setEmpresa] = useState('EMPRESA 1')
  const [combos, setCombos] = useState({})
  const [roleId, setRoleId] = useState(null)

  useEffect(() => {
    fetch(APPS_SCRIPT_URL + '?config=1').then((r) => r.json()).then((j) => {
      if (j && j.ok) {
        if (j.empresas && j.empresas.length) { setEmpresas(j.empresas); setEmpresa(j.empresas[0]) }
        if (j.combos) setCombos(j.combos)
      }
    }).catch(() => {})
  }, [])

  const role = ROLES.find((r) => r.id === roleId)
  const sbus = effSBUS(empresa, combos)

  function nuevaEmpresa() {
    const n = window.prompt('Nombre de la nueva empresa:')
    if (!n) return
    const nm = n.trim().toUpperCase()
    if (!empresas.includes(nm)) setEmpresas([...empresas, nm])
    setEmpresa(nm)
  }

  if (!role && roleId !== 'config') {
    return (
      <>
        <header><div className="brand"><span className="logo">A</span> ABP <span style={{ opacity: .8, fontWeight: 500 }}>· Presupuesto</span></div><span className="yr">2028</span></header>
        <main className="menu">
          <div className="hero">
            <div className="hero-tag">ABP · Annual Business Plan + Cash Flow</div>
            <h1>Construyamos juntos el plan 2028</h1>
            <p>Cada área aporta su parte —ventas, producto, marketing, logística y dirección— para proyectar el negocio y el <b>flujo de caja</b> del año. Lo que capturas aquí se convierte en el plan de todos. 🚀</p>
          </div>
          <div className="hello">
            <h2>¿Quién eres?</h2>
            <p className="sub">Elige tu área para capturar tu información. Cada rol llena su propia hoja.</p>
            <div className="row2">
              <label className="who">Empresa:
                <span className="inline">
                  <select value={empresa} onChange={(e) => setEmpresa(e.target.value)}>{empresas.map((e) => <option key={e}>{e}</option>)}</select>
                  <button className="btn" onClick={nuevaEmpresa}>＋ Nueva</button>
                </span>
              </label>
              <label className="who">Tu nombre (para el registro):
                <input value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="Ej. Ana Pérez" />
              </label>
            </div>
          </div>
          <div className="apps">
            {ROLES.map((r) => (
              <button key={r.id} className="app" onClick={() => setRoleId(r.id)}>
                <span className="appicon" style={{ background: r.color }}>{r.icon}</span>
                <span className="applabel">{r.label}</span>
              </button>
            ))}
            <button className="app" onClick={() => setRoleId('config')}>
              <span className="appicon" style={{ background: '#5b6470' }}>⚙️</span>
              <span className="applabel">Combinaciones</span>
            </button>
            <button className="app" onClick={() => setRoleId('historico')}>
              <span className="appicon" style={{ background: '#b0473b' }}>📊</span>
              <span className="applabel">Histórico</span>
            </button>
          </div>
        </main>
      </>
    )
  }

  if (roleId === 'config') {
    return (
      <>
        <header><div className="brand"><span className="logo">A</span> ABP</div><span className="yr">2028</span><div className="spacer"></div>
          <span className="rolechip" style={{ background: '#5b6470' }}>⚙️ Combinaciones</span>
          <button className="back" onClick={() => setRoleId(null)}>← Volver al menú</button></header>
        <main><ConfigScreen empresas={empresas} setEmpresas={setEmpresas} combos={combos} setCombos={setCombos} nuevaEmpresa={nuevaEmpresa} /></main>
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
function RoleForm({ role, usuario, empresa, sbus }) {
  const [tab, setTab] = useState(0)
  const [data, setData] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const rb = role.rubros[tab]
  const common = { role, rubro: rb, usuario, empresa, sbus, data, setData, saving, setSaving, msg, setMsg }

  return (
    <>
      <div className="toolbar">
        {role.rubros.map((r, i) => (<button key={r.k} className={'seg' + (i === tab ? ' active' : '')} onClick={() => { setTab(i); setMsg(null) }}>{r.k}</button>))}
      </div>
      {msg && <div className={'note ' + msg.t}>{msg.x}</div>}
      {rb.detalle ? <DetalleForm key={rb.k} {...common} groups={rb.detalle} extrasKey={rb.extrasKey} /> : <SimpleForm key={rb.k} {...common} />}
    </>
  )
}

/* ===== SimpleForm: un rubro, grid marca × mes ===== */
function SimpleForm({ role, rubro, usuario, empresa, sbus, data, setData, saving, setSaving, setMsg }) {
  const key = (sbu, marca, mi) => `${rubro.k}|${sbu}|${marca}|${mi}`
  const set = (k, v) => setData((d) => ({ ...d, [k]: v }))
  const marcas = marcasDe(sbus)

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
        <label className="btnfile">⬆ Importar Excel<input type="file" accept=".xlsx,.xls" onChange={importar} hidden /></label>
        <button className="btn" onClick={exportar}>⬇ Exportar Excel</button>
        <button className="btn primary" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : '💾 Guardar'}</button>
      </div>
      <div className="panel">
        <h3>{role.label} — {rubro.k} <span className="unit">({rubro.u})</span></h3>
        <div className="sub">Empresa <b>{empresa}</b>. Captura por marca y mes.</div>
        <div className="tablewrap">
          <table>
            <thead><tr><th className="l">Marca</th>{MESES.map((m) => <th key={m}>{m}</th>)}<th>Total</th></tr></thead>
            <tbody>
              {Object.entries(sbus).map(([sbu, ms]) => (
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

/* ===== DetalleForm: sub-rubros por marca (Marketing y Viajes) ===== */
function DetalleForm({ role, rubro, usuario, empresa, sbus, groups, extrasKey, data, setData, saving, setSaving, setMsg }) {
  const marcas = marcasDe(sbus)
  const [marca, setMarca] = useState(marcas[0].marca)
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
        <label>Marca</label>
        <select value={marca} onChange={(e) => setMarca(e.target.value)}>
          {Object.entries(sbus).map(([s, ms]) => (<optgroup key={s} label={s}>
            <option value={`TOTAL::${s}`}>▣ TOTAL {s}</option>
            {ms.map((m) => <option key={m} value={m}>{m}</option>)}
          </optgroup>))}
        </select>
        {isTotal && <button className="seg active" onClick={() => setMarca((sbus[sbu] || [])[0])}>Viendo total {sbu}</button>}
        <div className="spacer"></div>
        <button className="btn" onClick={agregarRubro}>➕ Agregar rubro</button>
        <label className="btnfile">⬆ Importar Excel<input type="file" accept=".xlsx,.xls" onChange={importar} hidden /></label>
        <button className="btn" onClick={exportar}>⬇ Exportar Excel</button>
        <button className="btn primary" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : '💾 Guardar todo'}</button>
      </div>
      <div className="panel">
        <h3>{role.label} · {rubro.k} — {isTotal ? `TOTAL ${sbu}` : marca} <span className="unit">(USD · {empresa})</span></h3>
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

/* ===== COMBINACIONES ===== */
function ConfigScreen({ empresas, setEmpresas, combos, setCombos, nuevaEmpresa }) {
  const [empresa, setEmpresa] = useState(empresas[0])
  const [asign, setAsign] = useState(() => seed(combos[empresa]))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  function seed(c) { const m = {}; ALL_MARCAS.forEach((mk) => { m[mk] = '' }); if (c) SBU_NAMES.forEach((s) => (c[s] || []).forEach((mk) => { m[mk] = s })); return m }
  function cambiarEmpresa(e) { setEmpresa(e); setAsign(seed(combos[e])); setMsg(null) }

  async function guardar() {
    setSaving(true); setMsg(null)
    const cc = { 'SBU 1': [], 'SBU 2': [], 'SBU 3': [] }
    Object.entries(asign).forEach(([mk, s]) => { if (s) cc[s].push(mk) })
    try {
      const res = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'config', empresa, combos: cc }) })
      const j = await res.json()
      if (j.ok) { setCombos({ ...combos, [empresa]: cc }); if (!empresas.includes(empresa)) setEmpresas([...empresas, empresa]); setMsg({ t: 'ok', x: 'Combinaciones guardadas para ' + empresa + '.' }) }
      else setMsg({ t: 'bad', x: 'Error: ' + j.error })
    } catch (e) { setMsg({ t: 'bad', x: 'No se pudo conectar: ' + e.message }) }
    setSaving(false)
  }
  const cuenta = (s) => Object.values(asign).filter((v) => v === s).length

  return (
    <>
      <div className="toolbar">
        <label>Empresa</label>
        <select value={empresa} onChange={(e) => cambiarEmpresa(e.target.value)}>{empresas.map((e) => <option key={e}>{e}</option>)}</select>
        <button className="btn" onClick={nuevaEmpresa}>＋ Nueva empresa</button>
        <div className="spacer"></div>
        <button className="btn primary" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : '💾 Guardar combinaciones'}</button>
      </div>
      {msg && <div className={'note ' + msg.t}>{msg.x}</div>}
      <div className="panel">
        <h3>Combinaciones de SBU — {empresa}</h3>
        <div className="sub">Asigna cada marca a una SBU. Puede ser distinto por empresa. ({cuenta('SBU 1')} en SBU 1 · {cuenta('SBU 2')} en SBU 2 · {cuenta('SBU 3')} en SBU 3)</div>
        <div className="tablewrap">
          <table>
            <thead><tr><th className="l">Marca</th><th>SBU asignada</th></tr></thead>
            <tbody>
              {ALL_MARCAS.map((mk) => (
                <tr key={mk}><td className="l">{mk}</td><td>
                  <select value={asign[mk] || ''} onChange={(e) => setAsign({ ...asign, [mk]: e.target.value })}>
                    <option value="">— sin asignar —</option>
                    {SBU_NAMES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td></tr>
              ))}
            </tbody>
          </table>
        </div>
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

  useEffect(() => { cargar() }, [])
  async function cargar() {
    try { const r = await fetch(APPS_SCRIPT_URL + '?tab=Historico'); const j = await r.json(); if (j.ok && j.values) setValues(j.values) } catch { }
  }
  function importar(ev) {
    const file = ev.target.files[0]; if (!file) return
    importXlsx(file, async (aoa) => {
      setBusy(true); setMsg(null)
      try {
        const r = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'historico', values: aoa }) })
        const j = await r.json()
        setMsg(j.ok ? { t: 'ok', x: `Histórico importado: ${j.filas} registro(s) guardados en la hoja "Historico".` } : { t: 'bad', x: 'Error: ' + j.error })
        cargar()
      } catch (e) { setMsg({ t: 'bad', x: 'No se pudo conectar: ' + e.message }) }
      setBusy(false)
    })
    ev.target.value = ''
  }
  async function exportar() {
    try { const r = await fetch(APPS_SCRIPT_URL + '?tab=Historico'); const j = await r.json(); if (j.ok && j.values && j.values.length) exportXlsx(j.values, 'Historico.xlsx'); else alert('Aún no hay histórico guardado.') }
    catch (e) { alert('No se pudo: ' + e.message) }
  }
  function plantilla() { exportXlsx([HIST_HEAD], 'Plantilla_Historico.xlsx') }

  const filas = Math.max(0, values.length - 1)
  const head = values[0] || HIST_HEAD
  const preview = values.slice(1, 21)

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
      <div className="panel">
        <h3>Histórico <span className="unit">({filas} registro(s))</span></h3>
        <div className="sub">Base histórica plana para análisis (una fila por registro). Al importar un Excel con esta estructura, se guarda en la hoja <b>Historico</b> de la Google Sheet. Estructura: {HIST_HEAD.join(' · ')}.</div>
        <div className="tablewrap">
          <table>
            <thead><tr>{head.map((h, i) => <th key={i} className={i === 0 ? 'l' : ''}>{String(h)}</th>)}</tr></thead>
            <tbody>
              {preview.length === 0 && <tr><td className="l" colSpan={HIST_HEAD.length}>Aún no hay datos. Importa un Excel con la estructura de la plantilla.</td></tr>}
              {preview.map((r, ri) => (<tr key={ri}>{head.map((_, ci) => <td key={ci} className={ci === 0 ? 'l' : ''}>{r[ci] != null ? String(r[ci]) : ''}</td>)}</tr>))}
            </tbody>
          </table>
        </div>
        {filas > 20 && <div className="sub" style={{ marginTop: 8 }}>Mostrando 20 de {filas} registros.</div>}
      </div>
    </>
  )
}

/* ===== utilidades ===== */
function Fragment2({ children }) { return <>{children}</> }

async function postRows(role, usuario, empresa, rows, setMsg) {
  if (!rows.length) { setMsg({ t: 'warn', x: 'No hay datos para guardar (todo en 0).' }); return }
  try {
    const res = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ empresa, usuario: usuario || 'anónimo', rol: role.label, tab: role.tab, rows }) })
    const j = await res.json()
    setMsg(j.ok ? { t: 'ok', x: `Guardado: ${j.filas} fila(s) (${empresa}).` } : { t: 'bad', x: 'Error: ' + j.error })
  } catch (e) { setMsg({ t: 'bad', x: 'No se pudo conectar: ' + e.message }) }
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
