import { useState, useEffect } from 'react'
import './App.css'

/* ===== CONFIG ===== */
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby1SWtgyQRVlkjnUUXfqCZ9hrStbZ6ffJovh8nYaVXyGuu3Opal55Kg3GmELLpZ6GpJ3A/exec'

const MESES = ['ene-28','feb-28','mar-28','abr-28','may-28','jun-28','jul-28','ago-28','sep-28','oct-28','nov-28','dic-28']

/* Marcas maestras (agrupación por defecto; las combinaciones reales se definen por empresa) */
const DEFAULT_SBUS = {
  'SBU 1': ['ALTRA','FJALLRAVEN','HOKA','INJINJI','NORDA'],
  'SBU 2': ['ARIAT','BIRKENSTOCK','BLUNDSTONE','ECCO','FLOWER MOUNTAIN','UGG'],
  'SBU 3': ['COTOPAXI','FITFLOP','FOAMERS','GOORIN BROS','KEEN','MAMMUT'],
}
const ALL_MARCAS = Object.values(DEFAULT_SBUS).flat()
const SBU_NAMES = ['SBU 1', 'SBU 2', 'SBU 3']

const ROLES = [
  { id: 'ventas',    label: 'Ventas',    icon: '📈', color: '#714B67', tab: 'Cap_Ventas',
    rubros: [{ k: 'UNIDADES', u: 'ud' }, { k: 'VIAJES', u: '$' }] },
  { id: 'producto',  label: 'Producto',  icon: '📦', color: '#017e84', tab: 'Cap_Producto',
    rubros: [{ k: 'AUP', u: '$' }, { k: 'AUC', u: '$' }, { k: 'VIAJES', u: '$' }, { k: 'INVENTARIO COMPRAS', u: '$' }] },
  { id: 'marketing', label: 'Marketing', icon: '🎯', color: '#d9822b', tab: 'Cap_Marketing', marketing: true },
  { id: 'logistica', label: 'Logística', icon: '🚚', color: '#3b6ea5', tab: 'Cap_Logistica',
    rubros: [{ k: 'LOGISTICA', u: '$' }] },
  { id: 'director',  label: 'Director',  icon: '🧑‍💼', color: '#8f4b7e', tab: 'Cap_Director',
    rubros: [{ k: 'VIAJES', u: '$' }, { k: 'CASH FLOW', u: '$' }] },
]

const MK_GROUPS = [
  { g: 'ATL', items: [{ c: '301', n: 'OOH' }, { c: '302', n: 'DOOH' }] },
  { g: 'BTL', items: [{ c: '303', n: 'FEE AGENCIA' }, { c: '304', n: 'EVENTOS / INAUGURACIONES' }, { c: '305', n: 'CARRERAS' }, { c: '306', n: 'OTROS' }] },
  { g: 'TRADE', items: [{ c: '', n: 'TRADE RETAIL' }, { c: '307', n: 'POP' }, { c: '308', n: 'VITRINAS / ESPACIOS BRANDEADOS' }, { c: '309', n: 'ACTIVACIONES EN TIENDA' }, { c: '310', n: 'AGENCIA DE RE-BRANDING' }, { c: '311', n: 'GIFT WITH PURCHASE' }] },
  { g: 'DIGITAL', items: [{ c: '320', n: 'FEE AGENCIA' }, { c: '312', n: 'PAID SOCIAL MEDIA - AWARENESS' }, { c: '313', n: 'PAID SOCIAL MEDIA - PERFORMANCE' }, { c: '314', n: 'E-COMMERCE MARCAS' }, { c: '315', n: 'E-COMMERCE & AGENCIA MUH' }] },
  { g: 'PR', items: [{ c: '330', n: 'FEE AGENCIA' }, { c: '316', n: 'PAGO A INFLUENCERS' }, { c: '317', n: 'CANJE INFLUENCERS' }] },
  { g: 'PRE VENTAS / SALES MEETING', items: [{ c: '340', n: 'ASIGNACION DE PRODUCTO' }, { c: '341', n: 'EVENTOS / REUNIONES' }, { c: '342', n: 'OTROS' }] },
]

/* ===== helpers ===== */
const num = (v) => { const n = parseFloat(String(v).replace(/[^0-9.-]/g, '')); return isNaN(n) ? 0 : n }
const fmt = (v) => (v ? Math.round(v).toLocaleString('en-US') : '')

/* SBUs efectivas para una empresa (según combinaciones); marcas sin asignar van a "Sin asignar" */
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

  /* ----- MENÚ ----- */
  if (!role && roleId !== 'config') {
    return (
      <>
        <header><div className="brand"><span className="logo">A</span> ABP <span style={{ opacity: .8, fontWeight: 500 }}>· Presupuesto</span></div><span className="yr">2028</span></header>
        <main>
          <div className="hello">
            <h2>¿Quién eres?</h2>
            <p className="sub">Elige tu área para capturar tu información. Cada rol llena su propia hoja.</p>
            <div className="row2">
              <label className="who">Empresa:
                <span className="inline">
                  <select value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
                    {empresas.map((e) => <option key={e}>{e}</option>)}
                  </select>
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
          </div>
        </main>
      </>
    )
  }

  /* ----- COMBINACIONES ----- */
  if (roleId === 'config') {
    return (
      <>
        <header><div className="brand"><span className="logo">A</span> ABP</div><span className="yr">2028</span><div className="spacer"></div>
          <span className="rolechip" style={{ background: '#5b6470' }}>⚙️ Combinaciones</span>
          <button className="back" onClick={() => setRoleId(null)}>← Volver al menú</button></header>
        <main>
          <ConfigScreen empresas={empresas} setEmpresas={setEmpresas} combos={combos} setCombos={setCombos} nuevaEmpresa={nuevaEmpresa} />
        </main>
      </>
    )
  }

  /* ----- FORMULARIO DE ROL ----- */
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
      <main>
        {role.marketing
          ? <MarketingForm role={role} usuario={usuario} empresa={empresa} sbus={sbus} />
          : <GenericForm role={role} usuario={usuario} empresa={empresa} sbus={sbus} />}
      </main>
    </>
  )
}

/* ===== COMBINACIONES ===== */
function ConfigScreen({ empresas, setEmpresas, combos, setCombos, nuevaEmpresa }) {
  const [empresa, setEmpresa] = useState(empresas[0])
  const [asign, setAsign] = useState(() => seed(combos[empresa]))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  function seed(c) {
    const m = {}
    ALL_MARCAS.forEach((mk) => { m[mk] = '' })
    if (c) SBU_NAMES.forEach((s) => (c[s] || []).forEach((mk) => { m[mk] = s }))
    return m
  }
  function cambiarEmpresa(e) { setEmpresa(e); setAsign(seed(combos[e])); setMsg(null) }

  async function guardar() {
    setSaving(true); setMsg(null)
    const cc = { 'SBU 1': [], 'SBU 2': [], 'SBU 3': [] }
    Object.entries(asign).forEach(([mk, s]) => { if (s) cc[s].push(mk) })
    try {
      const res = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'config', empresa, combos: cc }) })
      const j = await res.json()
      if (j.ok) {
        setCombos({ ...combos, [empresa]: cc })
        if (!empresas.includes(empresa)) setEmpresas([...empresas, empresa])
        setMsg({ t: 'ok', x: 'Combinaciones guardadas para ' + empresa + '.' })
      } else setMsg({ t: 'bad', x: 'Error: ' + j.error })
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
        <div className="sub">Asigna cada marca a una SBU. Puede ser distinto por empresa. Los totales por SBU se calculan con esto. ({cuenta('SBU 1')} en SBU 1 · {cuenta('SBU 2')} en SBU 2 · {cuenta('SBU 3')} en SBU 3)</div>
        <div className="tablewrap">
          <table>
            <thead><tr><th className="l">Marca</th><th>SBU asignada</th></tr></thead>
            <tbody>
              {ALL_MARCAS.map((mk) => (
                <tr key={mk}>
                  <td className="l">{mk}</td>
                  <td>
                    <select value={asign[mk] || ''} onChange={(e) => setAsign({ ...asign, [mk]: e.target.value })}>
                      <option value="">— sin asignar —</option>
                      {SBU_NAMES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

/* ===== FORMULARIO GENÉRICO ===== */
function GenericForm({ role, usuario, empresa, sbus }) {
  const [data, setData] = useState({})
  const [tab, setTab] = useState(0)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const rb = role.rubros[tab]
  const key = (rubro, sbu, marca, mi) => `${rubro}|${sbu}|${marca}|${mi}`
  const set = (k, v) => setData((d) => ({ ...d, [k]: v }))
  const marcas = marcasDe(sbus)

  async function guardar() {
    setSaving(true); setMsg(null)
    const rows = []
    role.rubros.forEach((r) => marcas.forEach(({ sbu, marca }) => {
      const meses = MESES.map((_, mi) => num(data[key(r.k, sbu, marca, mi)]))
      if (meses.some((v) => v !== 0)) rows.push({ rubro: r.k, sbu, marca, meses })
    }))
    await postRows(role, usuario, empresa, rows, setMsg)
    setSaving(false)
  }
  function exportar() {
    const lines = [['EMPRESA', 'RUBRO', 'SBU', 'MARCA', ...MESES].join(',')]
    role.rubros.forEach((r) => marcas.forEach(({ sbu, marca }) => {
      lines.push([empresa, r.k, sbu, marca, ...MESES.map((_, mi) => num(data[key(r.k, sbu, marca, mi)]))].join(','))
    }))
    descargar(lines.join('\n'), role.tab + '.csv')
  }

  return (
    <>
      <div className="toolbar">
        {role.rubros.map((r, i) => (<button key={r.k} className={'seg' + (i === tab ? ' active' : '')} onClick={() => setTab(i)}>{r.k}</button>))}
        <div className="spacer"></div>
        <button className="btn" onClick={exportar}>⬇ Exportar CSV</button>
        <button className="btn primary" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : '💾 Guardar'}</button>
      </div>
      {msg && <div className={'note ' + msg.t}>{msg.x}</div>}
      <div className="panel">
        <h3>{role.label} — {rb.k} <span className="unit">({rb.u})</span></h3>
        <div className="sub">Empresa <b>{empresa}</b>. Captura por marca y mes. Se guarda en <b>{role.tab}</b>.</div>
        <div className="tablewrap">
          <table>
            <thead><tr><th className="l">Marca</th>{MESES.map((m) => <th key={m}>{m}</th>)}<th>Total</th></tr></thead>
            <tbody>
              {Object.entries(sbus).map(([sbu, ms]) => (
                <Fragment2 key={sbu}>
                  <tr className="sburow"><td className="l" colSpan={14}>{sbu}</td></tr>
                  {ms.map((marca) => {
                    let tot = 0
                    const celdas = MESES.map((_, mi) => {
                      const k = key(rb.k, sbu, marca, mi); const v = data[k] ?? ''; tot += num(v)
                      return <td key={mi} className="cell"><input value={v} onChange={(e) => set(k, e.target.value)} inputMode="decimal" /></td>
                    })
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

/* ===== FORMULARIO DE MARKETING ===== */
function MarketingForm({ role, usuario, empresa, sbus }) {
  const marcas = marcasDe(sbus)
  const [marca, setMarca] = useState(marcas[0].marca)
  const [data, setData] = useState({})
  const [extras, setExtras] = useState(() => { try { return JSON.parse(localStorage.getItem('mk_extras') || '[]') } catch { return [] } })
  const [showSbu, setShowSbu] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const sbu = sbuDe(sbus, marca)

  const grupos = [...MK_GROUPS, { g: 'ADICIONALES', items: extras.map((e) => ({ c: '', n: e })) }]
  const key = (mca, id, mi) => `${mca}|${id}|${mi}`
  const idDe = (g, it) => `${g}|${it.c}|${it.n}`
  const set = (k, v) => setData((d) => ({ ...d, [k]: v }))
  const val = (mca, id, mi) => num(data[key(mca, id, mi)])

  function agregarRubro() {
    const n = window.prompt('Nombre del nuevo rubro (se agrega a TODAS las marcas):')
    if (!n) return
    const next = [...extras, n.trim().toUpperCase()]
    setExtras(next)
    try { localStorage.setItem('mk_extras', JSON.stringify(next)) } catch {}
  }

  const sbuMarcas = sbus[sbu] || []
  const valSbu = (id, mi) => sbuMarcas.reduce((s, m) => s + val(m, id, mi), 0)

  async function guardar() {
    setSaving(true); setMsg(null)
    const rows = []
    marcas.forEach(({ sbu: sb, marca: mca }) => grupos.forEach((gr) => gr.items.forEach((it) => {
      const id = idDe(gr.g, it)
      const meses = MESES.map((_, mi) => val(mca, id, mi))
      if (meses.some((v) => v !== 0)) rows.push({ rubro: `${gr.g} - ${it.n}`, sbu: sb, marca: mca, meses })
    })))
    await postRows(role, usuario, empresa, rows, setMsg)
    setSaving(false)
  }
  function exportar() {
    const lines = [['EMPRESA', 'GRUPO', 'RUBRO', 'SBU', 'MARCA', ...MESES].join(',')]
    marcas.forEach(({ sbu: sb, marca: mca }) => grupos.forEach((gr) => gr.items.forEach((it) => {
      const id = idDe(gr.g, it)
      lines.push([empresa, gr.g, it.n, sb, mca, ...MESES.map((_, mi) => val(mca, id, mi))].join(','))
    })))
    descargar(lines.join('\n'), 'Cap_Marketing.csv')
  }

  const totalGeneral = grupos.reduce((s, gr) => s + gr.items.reduce((ss, it) => {
    const id = idDe(gr.g, it)
    return ss + MESES.reduce((a, _, mi) => a + (showSbu ? valSbu(id, mi) : val(marca, id, mi)), 0)
  }, 0), 0)

  return (
    <>
      <div className="toolbar">
        <label>Marca</label>
        <select value={marca} onChange={(e) => setMarca(e.target.value)}>
          {Object.entries(sbus).map(([s, ms]) => (<optgroup key={s} label={s}>{ms.map((m) => <option key={m} value={m}>{m}</option>)}</optgroup>))}
        </select>
        <button className={'seg' + (showSbu ? ' active' : '')} onClick={() => setShowSbu((v) => !v)}>{showSbu ? `Viendo total ${sbu}` : `Ver total ${sbu}`}</button>
        <div className="spacer"></div>
        <button className="btn" onClick={agregarRubro}>➕ Agregar rubro</button>
        <button className="btn" onClick={exportar}>⬇ Exportar CSV</button>
        <button className="btn primary" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : '💾 Guardar todo'}</button>
      </div>
      {msg && <div className={'note ' + msg.t}>{msg.x}</div>}
      <div className="panel">
        <h3>Marketing — {showSbu ? `TOTAL ${sbu}` : marca} <span className="unit">(USD · {empresa})</span></h3>
        <div className="sub">
          {showSbu ? 'Solo lectura: suma de todas las marcas de la SBU (según Combinaciones).' : <>Captura por rubro y mes. Se guarda en <b>{role.tab}</b>. Los rubros son iguales para todas las marcas.</>}
          {' '}Presupuesto total: <b>${fmt(totalGeneral)}</b>
        </div>
        <div className="tablewrap">
          <table>
            <thead><tr><th className="l">Rubro</th><th className="cod">Cód.</th>{MESES.map((m) => <th key={m}>{m}</th>)}<th>Total</th></tr></thead>
            <tbody>
              {grupos.map((gr) => {
                const subMes = MESES.map((_, mi) => gr.items.reduce((s, it) => s + (showSbu ? valSbu(idDe(gr.g, it), mi) : val(marca, idDe(gr.g, it), mi)), 0))
                const subTot = subMes.reduce((a, b) => a + b, 0)
                return (
                  <Fragment2 key={gr.g}>
                    <tr className="sburow"><td className="l">{gr.g}</td><td></td>{subMes.map((v, i) => <td key={i} className="tot">{fmt(v)}</td>)}<td className="tot">{fmt(subTot)}</td></tr>
                    {gr.items.map((it) => {
                      const id = idDe(gr.g, it)
                      let tot = 0
                      const celdas = MESES.map((_, mi) => {
                        if (showSbu) { const v = valSbu(id, mi); tot += v; return <td key={mi} className="tot">{fmt(v)}</td> }
                        const k = key(marca, id, mi); const v = data[k] ?? ''; tot += num(v)
                        return <td key={mi} className="cell"><input value={v} onChange={(e) => set(k, e.target.value)} inputMode="decimal" /></td>
                      })
                      return <tr key={id}><td className="l sub2">{it.n}</td><td className="cod">{it.c}</td>{celdas}<td className="tot">{fmt(tot)}</td></tr>
                    })}
                  </Fragment2>
                )
              })}
              <tr className="grandrow"><td className="l">PRESUPUESTO TOTAL</td><td></td>
                {MESES.map((_, mi) => {
                  const v = grupos.reduce((s, gr) => s + gr.items.reduce((ss, it) => ss + (showSbu ? valSbu(idDe(gr.g, it), mi) : val(marca, idDe(gr.g, it), mi)), 0), 0)
                  return <td key={mi} className="tot">{fmt(v)}</td>
                })}
                <td className="tot">{fmt(totalGeneral)}</td>
              </tr>
            </tbody>
          </table>
        </div>
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
    setMsg(j.ok ? { t: 'ok', x: `Guardado: ${j.filas} fila(s) en ${role.tab} (${empresa}).` } : { t: 'bad', x: 'Error: ' + j.error })
  } catch (e) { setMsg({ t: 'bad', x: 'No se pudo conectar: ' + e.message }) }
}

function descargar(texto, nombre) {
  const blob = new Blob([texto], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = nombre; a.click()
}
