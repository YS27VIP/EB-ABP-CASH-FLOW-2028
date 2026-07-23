import { useState } from 'react'
import './App.css'

/* ===== CONFIG ===== */
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby1SWtgyQRVlkjnUUXfqCZ9hrStbZ6ffJovh8nYaVXyGuu3Opal55Kg3GmELLpZ6GpJ3A/exec'

const MESES = ['ene-28','feb-28','mar-28','abr-28','may-28','jun-28','jul-28','ago-28','sep-28','oct-28','nov-28','dic-28']

const SBUS = {
  'SBU 1': ['ALTRA','FJALLRAVEN','HOKA','INJINJI','NORDA'],
  'SBU 2': ['ARIAT','BIRKENSTOCK','BLUNDSTONE','ECCO','FLOWER MOUNTAIN','UGG'],
  'SBU 3': ['COTOPAXI','FITFLOP','FOAMERS','GOORIN BROS','KEEN','MAMMUT'],
}

const ROLES = [
  { id: 'ventas',    label: 'Ventas',    icon: '📈', color: '#714B67', tab: 'Cap_Ventas',
    rubros: [{ k: 'UNIDADES', u: 'ud' }, { k: 'VIAJES', u: '$' }] },
  { id: 'producto',  label: 'Producto',  icon: '📦', color: '#017e84', tab: 'Cap_Producto',
    rubros: [{ k: 'AUP', u: '$' }, { k: 'AUC', u: '$' }, { k: 'VIAJES', u: '$' }, { k: 'INVENTARIO COMPRAS', u: '$' }] },
  { id: 'marketing', label: 'Marketing', icon: '🎯', color: '#d9822b', tab: 'Cap_Marketing', marketing: true },
  { id: 'logistica', label: 'Logística', icon: '🚚', color: '#3b6ea5', tab: 'Cap_Logistica',
    rubros: [{ k: 'LOGISTICA', u: '$' }] },
  { id: 'director',  label: 'Director',  icon: '🧭', color: '#8f4b7e', tab: 'Cap_Director',
    rubros: [{ k: 'VIAJES', u: '$' }, { k: 'CASH FLOW', u: '$' }] },
]

/* Estructura real de Marketing (grupos + sub-rubros con código) */
const MK_GROUPS = [
  { g: 'ATL', items: [{ c: '301', n: 'OOH' }, { c: '302', n: 'DOOH' }] },
  { g: 'BTL', items: [{ c: '303', n: 'FEE AGENCIA' }, { c: '304', n: 'EVENTOS / INAUGURACIONES' }, { c: '305', n: 'CARRERAS' }, { c: '306', n: 'OTROS' }] },
  { g: 'TRADE', items: [{ c: '', n: 'TRADE RETAIL' }, { c: '307', n: 'POP' }, { c: '308', n: 'VITRINAS / ESPACIOS BRANDEADOS' }, { c: '309', n: 'ACTIVACIONES EN TIENDA' }, { c: '310', n: 'AGENCIA DE RE-BRANDING' }, { c: '311', n: 'GIFT WITH PURCHASE' }] },
  { g: 'DIGITAL', items: [{ c: '320', n: 'FEE AGENCIA' }, { c: '312', n: 'PAID SOCIAL MEDIA - AWARENESS' }, { c: '313', n: 'PAID SOCIAL MEDIA - PERFORMANCE' }, { c: '314', n: 'E-COMMERCE MARCAS' }, { c: '315', n: 'E-COMMERCE & AGENCIA MUH' }] },
  { g: 'PR', items: [{ c: '330', n: 'FEE AGENCIA' }, { c: '316', n: 'PAGO A INFLUENCERS' }, { c: '317', n: 'CANJE INFLUENCERS' }] },
  { g: 'PRE VENTAS / SALES MEETING', items: [{ c: '340', n: 'ASIGNACION DE PRODUCTO' }, { c: '341', n: 'EVENTOS / REUNIONES' }, { c: '342', n: 'OTROS' }] },
]

/* ===== helpers ===== */
const allMarcas = () => Object.entries(SBUS).flatMap(([sbu, ms]) => ms.map((m) => ({ sbu, marca: m })))
const sbuDe = (marca) => allMarcas().find((x) => x.marca === marca)?.sbu || ''
const num = (v) => { const n = parseFloat(String(v).replace(/[^0-9.-]/g, '')); return isNaN(n) ? 0 : n }
const fmt = (v) => (v ? Math.round(v).toLocaleString('en-US') : '')

/* ===== APP ===== */
export default function App() {
  const [usuario, setUsuario] = useState('')
  const [roleId, setRoleId] = useState(null)
  const role = ROLES.find((r) => r.id === roleId)

  if (!role) {
    return (
      <>
        <header><div className="brand"><span className="logo">A</span> ABP <span style={{ opacity: .8, fontWeight: 500 }}>· Presupuesto</span></div><span className="yr">2028</span></header>
        <main>
          <div className="hello">
            <h2>¿Quién eres?</h2>
            <p className="sub">Elige tu área para capturar tu información. Cada rol llena su propia hoja.</p>
            <label className="who">Tu nombre (para el registro):
              <input value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="Ej. Ana Pérez" />
            </label>
          </div>
          <div className="apps">
            {ROLES.map((r) => (
              <button key={r.id} className="app" onClick={() => setRoleId(r.id)}>
                <span className="appicon" style={{ background: r.color }}>{r.icon}</span>
                <span className="applabel">{r.label}</span>
              </button>
            ))}
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <header>
        <div className="brand"><span className="logo">A</span> ABP</div>
        <span className="yr">2028</span>
        <div className="spacer"></div>
        <span className="rolechip" style={{ background: role.color }}>{role.icon} {role.label}</span>
        <button className="back" onClick={() => setRoleId(null)}>← Volver al menú</button>
      </header>
      <main>
        {role.marketing ? <MarketingForm role={role} usuario={usuario} /> : <GenericForm role={role} usuario={usuario} />}
      </main>
    </>
  )
}

/* ===== FORMULARIO GENÉRICO (Ventas, Producto, Logística, Director) ===== */
function GenericForm({ role, usuario }) {
  const [data, setData] = useState({})
  const [tab, setTab] = useState(0)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const rb = role.rubros[tab]
  const key = (rubro, sbu, marca, mi) => `${rubro}|${sbu}|${marca}|${mi}`
  const set = (k, v) => setData((d) => ({ ...d, [k]: v }))

  async function guardar() {
    setSaving(true); setMsg(null)
    const rows = []
    role.rubros.forEach((r) => allMarcas().forEach(({ sbu, marca }) => {
      const meses = MESES.map((_, mi) => num(data[key(r.k, sbu, marca, mi)]))
      if (meses.some((v) => v !== 0)) rows.push({ rubro: r.k, sbu, marca, meses })
    }))
    await postRows(role, usuario, rows, setMsg)
    setSaving(false)
  }
  function exportar() {
    const lines = [['RUBRO', 'SBU', 'MARCA', ...MESES].join(',')]
    role.rubros.forEach((r) => allMarcas().forEach(({ sbu, marca }) => {
      lines.push([r.k, sbu, marca, ...MESES.map((_, mi) => num(data[key(r.k, sbu, marca, mi)]))].join(','))
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
        <div className="sub">Captura por marca y mes. Se guarda en la pestaña <b>{role.tab}</b>.</div>
        <div className="tablewrap">
          <table>
            <thead><tr><th className="l">Marca</th>{MESES.map((m) => <th key={m}>{m}</th>)}<th>Total</th></tr></thead>
            <tbody>
              {Object.entries(SBUS).map(([sbu, marcas]) => (
                <Fragment2 key={sbu}>
                  <tr className="sburow"><td className="l" colSpan={14}>{sbu}</td></tr>
                  {marcas.map((marca) => {
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

/* ===== FORMULARIO DE MARKETING (detalle real por marca) ===== */
function MarketingForm({ role, usuario }) {
  const marcas = allMarcas()
  const [marca, setMarca] = useState(marcas[0].marca)
  const [data, setData] = useState({})           // key: marca|itemId|mi
  const [extras, setExtras] = useState(() => { try { return JSON.parse(localStorage.getItem('mk_extras') || '[]') } catch { return [] } })
  const [showSbu, setShowSbu] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const sbu = sbuDe(marca)

  const grupos = [
    ...MK_GROUPS,
    { g: 'ADICIONALES', items: extras.map((e, i) => ({ c: '', n: e, x: i })) },
  ]
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

  // suma de todas las marcas de la SBU actual, por item/mes
  const sbuMarcas = SBUS[sbu]
  const valSbu = (id, mi) => sbuMarcas.reduce((s, m) => s + val(m, id, mi), 0)

  async function guardar() {
    setSaving(true); setMsg(null)
    const rows = []
    marcas.forEach(({ sbu, marca: mca }) => grupos.forEach((gr) => gr.items.forEach((it) => {
      const id = idDe(gr.g, it)
      const meses = MESES.map((_, mi) => val(mca, id, mi))
      if (meses.some((v) => v !== 0)) rows.push({ rubro: `${gr.g} - ${it.n}`, sbu, marca: mca, meses })
    })))
    await postRows(role, usuario, rows, setMsg)
    setSaving(false)
  }
  function exportar() {
    const lines = [['GRUPO', 'RUBRO', 'SBU', 'MARCA', ...MESES].join(',')]
    marcas.forEach(({ sbu, marca: mca }) => grupos.forEach((gr) => gr.items.forEach((it) => {
      const id = idDe(gr.g, it)
      lines.push([gr.g, it.n, sbu, mca, ...MESES.map((_, mi) => val(mca, id, mi))].join(','))
    })))
    descargar(lines.join('\n'), 'Cap_Marketing.csv')
  }

  // total general de la marca (o SBU)
  const totalGeneral = grupos.reduce((s, gr) => s + gr.items.reduce((ss, it) => {
    const id = idDe(gr.g, it)
    return ss + MESES.reduce((a, _, mi) => a + (showSbu ? valSbu(id, mi) : val(marca, id, mi)), 0)
  }, 0), 0)

  return (
    <>
      <div className="toolbar">
        <label>Marca</label>
        <select value={marca} onChange={(e) => setMarca(e.target.value)}>
          {Object.entries(SBUS).map(([s, ms]) => (
            <optgroup key={s} label={s}>{ms.map((m) => <option key={m} value={m}>{m}</option>)}</optgroup>
          ))}
        </select>
        <button className={'seg' + (showSbu ? ' active' : '')} onClick={() => setShowSbu((v) => !v)}>{showSbu ? `Viendo total ${sbu}` : `Ver total ${sbu}`}</button>
        <div className="spacer"></div>
        <button className="btn" onClick={agregarRubro}>➕ Agregar rubro</button>
        <button className="btn" onClick={exportar}>⬇ Exportar CSV</button>
        <button className="btn primary" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : '💾 Guardar todo'}</button>
      </div>
      {msg && <div className={'note ' + msg.t}>{msg.x}</div>}
      <div className="panel">
        <h3>Marketing — {showSbu ? `TOTAL ${sbu} (suma de marcas)` : marca} <span className="unit">(USD)</span></h3>
        <div className="sub">
          {showSbu ? 'Vista de solo lectura: suma de todas las marcas de la SBU.' : <>Captura por rubro y mes. Se guarda en <b>{role.tab}</b>. Los rubros son iguales para todas las marcas.</>}
          {' '}Presupuesto total {showSbu ? sbu : marca}: <b>${fmt(totalGeneral)}</b>
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

/* ===== utilidades compartidas ===== */
function Fragment2({ children }) { return <>{children}</> }

async function postRows(role, usuario, rows, setMsg) {
  if (!APPS_SCRIPT_URL) { setMsg({ t: 'warn', x: 'Falta conectar el Apps Script.' }); return }
  if (!rows.length) { setMsg({ t: 'warn', x: 'No hay datos para guardar (todo en 0).' }); return }
  try {
    const res = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ usuario: usuario || 'anónimo', rol: role.label, tab: role.tab, rows }) })
    const j = await res.json()
    setMsg(j.ok ? { t: 'ok', x: `Guardado: ${j.filas} fila(s) en ${role.tab}.` } : { t: 'bad', x: 'Error: ' + j.error })
  } catch (e) { setMsg({ t: 'bad', x: 'No se pudo conectar: ' + e.message }) }
}

function descargar(texto, nombre) {
  const blob = new Blob([texto], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = nombre; a.click()
}
