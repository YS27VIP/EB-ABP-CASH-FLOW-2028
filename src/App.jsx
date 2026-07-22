import { useState } from 'react'
import './App.css'

/* ===== CONFIG ===== */
// Cuando publiques el Apps Script, pega aquí su URL /exec:
const APPS_SCRIPT_URL = ''

const MESES = ['ene-28','feb-28','mar-28','abr-28','may-28','jun-28','jul-28','ago-28','sep-28','oct-28','nov-28','dic-28']

const SBUS = {
  'SBU 1': ['ALTRA','FJALLRAVEN','HOKA','INJINJI','NORDA'],
  'SBU 2': ['ARIAT','BIRKENSTOCK','BLUNDSTONE','ECCO','FLOWER MOUNTAIN','UGG'],
  'SBU 3': ['COTOPAXI','FITFLOP','FOAMERS','GOORIN BROS','KEEN','MAMMUT'],
}

// Un rol = un mosaico = una pestaña de captura en la Google Sheet.
const ROLES = [
  { id: 'ventas',    label: 'Ventas',    icon: '📈', color: '#714B67', tab: 'Cap_Ventas',
    rubros: [{ k: 'UNIDADES', u: 'ud' }, { k: 'VIAJES', u: '$' }] },
  { id: 'producto',  label: 'Producto',  icon: '📦', color: '#017e84', tab: 'Cap_Producto',
    rubros: [{ k: 'AUP', u: '$' }, { k: 'AUC', u: '$' }, { k: 'VIAJES', u: '$' }, { k: 'INVENTARIO COMPRAS', u: '$' }] },
  { id: 'marketing', label: 'Marketing', icon: '🎯', color: '#d9822b', tab: 'Cap_Marketing',
    rubros: [{ k: 'MK', u: '$' }, { k: 'VIAJES', u: '$' }] },
  { id: 'logistica', label: 'Logística', icon: '🚚', color: '#3b6ea5', tab: 'Cap_Logistica',
    rubros: [{ k: 'LOGISTICA', u: '$' }] },
  { id: 'director',  label: 'Director',  icon: '🧭', color: '#8f4b7e', tab: 'Cap_Director',
    rubros: [{ k: 'VIAJES', u: '$' }, { k: 'CASH FLOW', u: '$' }] },
]

/* ===== helpers ===== */
const allMarcas = () => Object.entries(SBUS).flatMap(([sbu, ms]) => ms.map((m) => ({ sbu, marca: m })))
const cellKey = (rubro, sbu, marca, mi) => `${rubro}|${sbu}|${marca}|${mi}`
const num = (v) => { const n = parseFloat(String(v).replace(/[^0-9.-]/g, '')); return isNaN(n) ? 0 : n }
const fmt = (v) => (v ? Math.round(v).toLocaleString('en-US') : '')

export default function App() {
  const [usuario, setUsuario] = useState('')
  const [roleId, setRoleId] = useState(null)      // null = menú principal
  const [data, setData] = useState({})            // { cellKey: value }
  const [rubroTab, setRubroTab] = useState(0)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const role = ROLES.find((r) => r.id === roleId)
  const set = (key, val) => setData((d) => ({ ...d, [key]: val }))

  /* ---- Guardar en la Google Sheet (vía Apps Script) ---- */
  async function guardar() {
    if (!APPS_SCRIPT_URL) {
      setMsg({ t: 'warn', x: 'Aún no está conectado el guardado. Publica el Apps Script y pásame la URL para activarlo. Por ahora puedes Exportar.' })
      return
    }
    setSaving(true); setMsg(null)
    const rows = []
    role.rubros.forEach((rb) => {
      allMarcas().forEach(({ sbu, marca }) => {
        const meses = MESES.map((_, mi) => num(data[cellKey(rb.k, sbu, marca, mi)]))
        if (meses.some((v) => v !== 0)) rows.push({ rubro: rb.k, sbu, marca, meses })
      })
    })
    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ usuario: usuario || 'anónimo', rol: role.label, tab: role.tab, rows }),
      })
      const j = await res.json()
      setMsg(j.ok ? { t: 'ok', x: `Guardado: ${j.filas} fila(s) en ${role.tab}.` } : { t: 'bad', x: 'Error: ' + j.error })
    } catch (e) {
      setMsg({ t: 'bad', x: 'No se pudo conectar: ' + e.message })
    }
    setSaving(false)
  }

  /* ---- Exportar CSV del rol ---- */
  function exportar() {
    const head = ['RUBRO', 'SBU', 'MARCA', ...MESES]
    const lines = [head.join(',')]
    role.rubros.forEach((rb) => allMarcas().forEach(({ sbu, marca }) => {
      const meses = MESES.map((_, mi) => num(data[cellKey(rb.k, sbu, marca, mi)]))
      lines.push([rb.k, sbu, marca, ...meses].join(','))
    }))
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${role.tab}.csv`
    a.click()
  }

  /* ---- Importar CSV ---- */
  function importar(ev) {
    const file = ev.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const rowsTxt = String(reader.result).split(/\r?\n/).filter(Boolean)
      const next = { ...data }
      rowsTxt.slice(1).forEach((line) => {
        const c = line.split(',')
        const [rubro, sbu, marca] = c
        for (let mi = 0; mi < 12; mi++) {
          const v = num(c[3 + mi])
          if (v) next[cellKey((rubro || '').trim(), (sbu || '').trim(), (marca || '').trim(), mi)] = v
        }
      })
      setData(next)
      setMsg({ t: 'ok', x: 'Datos importados del archivo. Revisa y pulsa Guardar.' })
    }
    reader.readAsText(file)
    ev.target.value = ''
  }

  /* ===== MENÚ PRINCIPAL (estilo Odoo) ===== */
  if (!role) {
    return (
      <>
        <header><div className="brand"><span className="logo">A</span> ABP <span style={{opacity:.8,fontWeight:500}}>· Presupuesto</span></div><span className="yr">2028</span></header>
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
              <button key={r.id} className="app" onClick={() => { setRoleId(r.id); setRubroTab(0); setMsg(null) }}>
                <span className="appicon" style={{ background: r.color }}>{r.icon}</span>
                <span className="applabel">{r.label}</span>
              </button>
            ))}
          </div>
        </main>
      </>
    )
  }

  /* ===== FORMULARIO DE UN ROL ===== */
  const rb = role.rubros[rubroTab]
  return (
    <>
      <header>
        <div className="brand"><span className="logo">A</span> ABP</div>
        <span className="yr">2028</span>
        <div className="spacer"></div>
        <span className="rolechip" style={{ background: role.color }}>{role.icon} {role.label}</span>
        <button className="icon" title="Volver al menú" onClick={() => { setRoleId(null); setMsg(null) }}>⌂</button>
      </header>

      <main>
        <div className="toolbar">
          {role.rubros.map((r, i) => (
            <button key={r.k} className={'seg' + (i === rubroTab ? ' active' : '')} onClick={() => setRubroTab(i)}>{r.k}</button>
          ))}
          <div className="spacer"></div>
          <label className="btnfile">⬆ Importar CSV<input type="file" accept=".csv" onChange={importar} hidden /></label>
          <button className="btn" onClick={exportar}>⬇ Exportar CSV</button>
          <button className="btn primary" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : '💾 Guardar'}</button>
        </div>

        {msg && <div className={'note ' + msg.t}>{msg.x}</div>}

        <div className="panel">
          <h3>{role.label} — {rb.k} <span className="unit">({rb.u})</span></h3>
          <div className="sub">Captura por marca y mes. Se guarda en la pestaña <b>{role.tab}</b> de la Google Sheet.</div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr><th className="l">Marca</th>{MESES.map((m) => <th key={m}>{m}</th>)}<th>Total</th></tr>
              </thead>
              <tbody>
                {Object.entries(SBUS).map(([sbu, marcas]) => (
                  <FragmentRows key={sbu} sbu={sbu} marcas={marcas} rb={rb} data={data} set={set} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  )
}

function FragmentRows({ sbu, marcas, rb, data, set }) {
  return (
    <>
      <tr className="sburow"><td className="l" colSpan={14}>{sbu}</td></tr>
      {marcas.map((marca) => {
        let tot = 0
        const celdas = MESES.map((_, mi) => {
          const k = cellKey(rb.k, sbu, marca, mi)
          const v = data[k] ?? ''
          tot += num(v)
          return (
            <td key={mi} className="cell">
              <input value={v} onChange={(e) => set(k, e.target.value)} inputMode="decimal" />
            </td>
          )
        })
        return (
          <tr key={marca}>
            <td className="l">{marca}</td>
            {celdas}
            <td className="tot">{fmt(tot)}</td>
          </tr>
        )
      })}
    </>
  )
}
