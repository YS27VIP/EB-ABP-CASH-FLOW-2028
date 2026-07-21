import { useState, useEffect, useRef, Fragment } from 'react'
import Chart from 'chart.js/auto'
import './App.css'

/* ===== CONFIG ===== */
const SHEET_ID = '1UdneQ2q8Xdw89PyPp4--1QYvOatFajhSyQ-bWfBe4bU'
const GID = '1712929002'
const EDIT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`

const MESES = ['ene-28','feb-28','mar-28','abr-28','may-28','jun-28','jul-28','ago-28','sep-28','oct-28','nov-28','dic-28']
const SBUS = {
  'SBU 1': ['ALTRA','FJALLRAVEN','HOKA','INJINJI','NORDA'],
  'SBU 2': ['ARIAT','BIRKENSTOCK','BLUNDSTONE','ECCO','FLOWER MOUNTAIN','UGG'],
  'SBU 3': ['COTOPAXI','FITFLOP','FOAMERS','GOORIN BROS','KEEN','MAMMUT'],
}

/* ===== FORMATO ===== */
const money = (v) => '$' + Math.round(v).toLocaleString('en-US')
const intf = (v) => Math.round(v).toLocaleString('en-US')
const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) + '%' : '—')

/* ===== LECTURA gviz ===== */
function parseRows(rows) {
  const DB = {}
  rows.forEach((r) => {
    const c = r.c
    const val = (i) => (c[i] && c[i].v != null ? c[i].v : c[i] && c[i].f != null ? c[i].f : '')
    const tipo = val(0), rubro = val(1), sbu = val(2), marca = val(3)
    if (!tipo || !rubro || !sbu) return
    const meses = []
    for (let i = 4; i < 16; i++) {
      const v = c[i] && c[i].v
      meses.push(typeof v === 'number' ? v : parseFloat(('' + (v || 0)).replace(/[, $]/g, '')) || 0)
    }
    DB[tipo] = DB[tipo] || {}
    DB[tipo][rubro] = DB[tipo][rubro] || {}
    DB[tipo][rubro][sbu] = DB[tipo][rubro][sbu] || {}
    DB[tipo][rubro][sbu][marca || '__SBU__'] = meses
  })
  return DB
}

export default function App() {
  const [db, setDb] = useState({})
  const [conn, setConn] = useState({ on: false, txt: 'Cargando…' })
  const [failed, setFailed] = useState(false)
  const [tipo, setTipo] = useState('SIN TAHO')
  const [view, setView] = useState('marca')
  const [mSbu, setMSbu] = useState('SBU 1')
  const [mMarca, setMMarca] = useState(SBUS['SBU 1'][0])
  const [sSbu, setSSbu] = useState('SBU 1')
  const [expanded, setExpanded] = useState({})

  const chartRef = useRef(null)
  const chartObj = useRef(null)

  /* ---- Carga inicial ---- */
  async function loadData() {
    setConn({ on: false, txt: 'Cargando…' })
    setFailed(false)
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${GID}`
    try {
      const res = await fetch(url)
      const txt = await res.text()
      const json = JSON.parse(txt.substring(txt.indexOf('(') + 1, txt.lastIndexOf(')')))
      setDb(parseRows(json.table.rows))
      setConn({ on: true, txt: 'Conectado' })
    } catch (err) {
      console.warn(err)
      setConn({ on: false, txt: 'Sin acceso a la hoja' })
      setFailed(true)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  /* ===== AGREGACIÓN ===== */
  const tiposActive = () => (tipo === 'AMBOS' ? ['SIN TAHO', 'CON TAHO'] : [tipo])

  const rubroMarcaMes = (rubro, sbu, marca, mi) => {
    let t = 0
    tiposActive().forEach((tp) => {
      const a = db[tp] && db[tp][rubro] && db[tp][rubro][sbu] && db[tp][rubro][sbu][marca]
      if (a) t += a[mi] || 0
    })
    return t
  }
  const rubroMarcaAnual = (rubro, sbu, marca) => {
    let t = 0
    for (let i = 0; i < 12; i++) t += rubroMarcaMes(rubro, sbu, marca, i)
    return t
  }
  const gastosAdmSBU = (sbu) => {
    let t = 0
    for (let i = 0; i < 12; i++) t += rubroMarcaMes('Gastos Administrativos', sbu, '__SBU__', i)
    return t
  }
  const marcaMetrics = (sbu, marca) => {
    const vn = rubroMarcaAnual('VENTAS NETAS', sbu, marca)
    const un = rubroMarcaAnual('UNIDADES', sbu, marca)
    const costo = rubroMarcaAnual('COSTO', sbu, marca)
    const mk = rubroMarcaAnual('MK', sbu, marca)
    const viajes = rubroMarcaAnual('VIAJES', sbu, marca)
    const com = rubroMarcaAnual('COMISIONES', sbu, marca)
    const log = rubroMarcaAnual('LOGISTICA', sbu, marca)
    const margen = vn - costo
    const gastos = mk + viajes + com + log
    const contrib = margen - gastos
    return { vn, un, costo, mk, viajes, com, log, margen, gastos, contrib }
  }
  const sbuMetrics = (sbu) => {
    const t = { vn: 0, un: 0, costo: 0, mk: 0, viajes: 0, com: 0, log: 0, margen: 0, gastos: 0, contrib: 0 }
    SBUS[sbu].forEach((m) => {
      const x = marcaMetrics(sbu, m)
      for (const k in t) if (k in x) t[k] += x[k]
    })
    t.gastosAdm = gastosAdmSBU(sbu)
    t.contrib -= t.gastosAdm
    t.gastos += t.gastosAdm
    return t
  }
  const grupoMetrics = () => {
    const t = { vn: 0, un: 0, costo: 0, mk: 0, viajes: 0, com: 0, log: 0, margen: 0, gastos: 0, contrib: 0, gastosAdm: 0 }
    Object.keys(SBUS).forEach((s) => {
      const x = sbuMetrics(s)
      for (const k in t) t[k] += x[k] || 0
    })
    return t
  }
  const monthSeriesSBU = (sbu) => {
    const out = MESES.map(() => ({ vn: 0, costo: 0, margen: 0, gastos: 0, contrib: 0 }))
    SBUS[sbu].forEach((m) => {
      for (let i = 0; i < 12; i++) {
        const vn = rubroMarcaMes('VENTAS NETAS', sbu, m, i)
        const co = rubroMarcaMes('COSTO', sbu, m, i)
        const g =
          rubroMarcaMes('MK', sbu, m, i) +
          rubroMarcaMes('VIAJES', sbu, m, i) +
          rubroMarcaMes('COMISIONES', sbu, m, i) +
          rubroMarcaMes('LOGISTICA', sbu, m, i)
        out[i].vn += vn
        out[i].costo += co
        out[i].margen += vn - co
        out[i].gastos += g
        out[i].contrib += vn - co - g
      }
    })
    return out
  }
  const monthSeriesGrupo = () => {
    const out = MESES.map(() => ({ vn: 0, margen: 0, contrib: 0 }))
    Object.keys(SBUS).forEach((s) => {
      const ms = monthSeriesSBU(s)
      ms.forEach((m, i) => {
        out[i].vn += m.vn
        out[i].margen += m.margen
        out[i].contrib += m.contrib
      })
    })
    return out
  }

  /* ===== Chart (vista Gerencia) ===== */
  useEffect(() => {
    if (view !== 'gerencia' || !chartRef.current) return
    const s = monthSeriesGrupo()
    if (chartObj.current) chartObj.current.destroy()
    chartObj.current = new Chart(chartRef.current, {
      type: 'bar',
      data: {
        labels: MESES,
        datasets: [
          { label: 'Ventas Netas', data: s.map((m) => Math.round(m.vn)), backgroundColor: '#714B67' },
          { label: 'Margen', data: s.map((m) => Math.round(m.margen)), backgroundColor: '#017e84' },
          {
            type: 'line',
            label: 'Contribución',
            data: s.map((m) => Math.round(m.contrib)),
            borderColor: '#d9822b',
            backgroundColor: '#d9822b',
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { ticks: { callback: (v) => '$' + v / 1000 + 'k' } } },
      },
    })
    return () => {
      if (chartObj.current) {
        chartObj.current.destroy()
        chartObj.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, db, tipo])

  const toggleGroup = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }))

  const banner = (
    <div className="banner">
      No puedo leer la Google Sheet todavía. Para que la página la lea (igual que tu proyecto actual), abre la hoja y ponla en{' '}
      <b>Compartir ▸ Cualquiera con el enlace ▸ Lector</b>. Luego pulsa ⟳ aquí.
    </div>
  )

  /* ===== VISTA POR MARCA ===== */
  function MarcaView() {
    if (failed) return banner
    const x = marcaMetrics(mSbu, mMarca)
    const showR = ['VENTAS NETAS', 'UNIDADES', 'COSTO', 'MK', 'VIAJES', 'COMISIONES', 'LOGISTICA']
    return (
      <>
        <div className="toolbar">
          <label>SBU</label>
          <select
            value={mSbu}
            onChange={(e) => {
              const s = e.target.value
              setMSbu(s)
              setMMarca(SBUS[s][0])
            }}
          >
            {Object.keys(SBUS).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <label>Marca</label>
          <select value={mMarca} onChange={(e) => setMMarca(e.target.value)}>
            {SBUS[mSbu].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="kpis">
          <div className="kpi">
            <div className="k">Ventas Netas</div>
            <div className="v">{money(x.vn)}</div>
            <div className="s">{mMarca} · {mSbu}</div>
          </div>
          <div className="kpi">
            <div className="k">Margen bruto</div>
            <div className="v">{money(x.margen)}</div>
            <div className="s">{pct(x.margen, x.vn)} · costo {money(x.costo)}</div>
          </div>
          <div className="kpi">
            <div className="k">Gastos (MK+Viajes+Com+Log)</div>
            <div className="v">{money(x.gastos)}</div>
            <div className="s">MK {money(x.mk)} · Log {money(x.log)}</div>
          </div>
          <div className="kpi">
            <div className="k">Contribución</div>
            <div className={'v ' + (x.contrib >= 0 ? 'pos' : 'neg')}>{money(x.contrib)}</div>
            <div className="s">{pct(x.contrib, x.vn)} de la venta</div>
          </div>
        </div>
        <div className="panel">
          <h3>{mMarca} — detalle mensual</h3>
          <div className="sub">Escenario: {tipo}. Editable en la Google Sheet.</div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th className="l">Rubro</th>
                  {MESES.map((m) => (
                    <th key={m}>{m}</th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {showR.map((r) => {
                  let tot = 0
                  const cells = []
                  for (let i = 0; i < 12; i++) {
                    const v = rubroMarcaMes(r, mSbu, mMarca, i)
                    tot += v
                    cells.push(<td key={i}>{r === 'UNIDADES' ? intf(v) : money(v)}</td>)
                  }
                  return (
                    <tr key={r}>
                      <td className="l">{r}</td>
                      {cells}
                      <td>
                        <b>{r === 'UNIDADES' ? intf(tot) : money(tot)}</b>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </>
    )
  }

  /* ===== VISTA POR SBU ===== */
  function SbuView() {
    if (failed) return banner
    const t = sbuMetrics(sSbu)
    return (
      <>
        <div className="toolbar">
          <label>SBU</label>
          <select value={sSbu} onChange={(e) => setSSbu(e.target.value)}>
            {Object.keys(SBUS).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="kpis">
          <div className="kpi">
            <div className="k">Ventas Netas</div>
            <div className="v">{money(t.vn)}</div>
            <div className="s">{sSbu}</div>
          </div>
          <div className="kpi">
            <div className="k">Margen bruto</div>
            <div className="v">{money(t.margen)}</div>
            <div className="s">{pct(t.margen, t.vn)}</div>
          </div>
          <div className="kpi">
            <div className="k">Gastos Admin.</div>
            <div className="v">{money(t.gastosAdm)}</div>
            <div className="s">a nivel SBU</div>
          </div>
          <div className="kpi">
            <div className="k">Contribución</div>
            <div className={'v ' + (t.contrib >= 0 ? 'pos' : 'neg')}>{money(t.contrib)}</div>
            <div className="s">{pct(t.contrib, t.vn)}</div>
          </div>
        </div>
        <div className="panel">
          <h3>{sSbu} — por marca</h3>
          <div className="sub">Suma de marcas = total de la SBU.</div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th className="l">Marca</th>
                  <th>Ventas Netas</th>
                  <th>Costo</th>
                  <th>Margen</th>
                  <th>% Mg</th>
                  <th>Gastos</th>
                  <th>Contribución</th>
                </tr>
              </thead>
              <tbody>
                {SBUS[sSbu].map((m) => {
                  const x = marcaMetrics(sSbu, m)
                  return (
                    <tr key={m}>
                      <td className="l">{m}</td>
                      <td>{money(x.vn)}</td>
                      <td>{money(x.costo)}</td>
                      <td>{money(x.margen)}</td>
                      <td>{pct(x.margen, x.vn)}</td>
                      <td>{money(x.gastos)}</td>
                      <td className={x.contrib >= 0 ? 'pos' : 'neg'}>{money(x.contrib)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="l">TOTAL {sSbu}</td>
                  <td>{money(t.vn)}</td>
                  <td>{money(t.costo)}</td>
                  <td>{money(t.margen)}</td>
                  <td>{pct(t.margen, t.vn)}</td>
                  <td>{money(t.gastos)}</td>
                  <td>{money(t.contrib)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </>
    )
  }

  /* ===== VISTA GERENCIA ===== */
  function GerenciaView() {
    if (failed) return banner
    const g = grupoMetrics()
    return (
      <>
        <div className="kpis">
          <div className="kpi">
            <div className="k">Ventas Netas (Grupo)</div>
            <div className="v">{money(g.vn)}</div>
            <div className="s">3 SBU · escenario {tipo}</div>
          </div>
          <div className="kpi">
            <div className="k">Margen bruto</div>
            <div className="v">{money(g.margen)}</div>
            <div className="s">{pct(g.margen, g.vn)}</div>
          </div>
          <div className="kpi">
            <div className="k">Gastos totales</div>
            <div className="v">{money(g.gastos)}</div>
            <div className="s">incl. administrativos</div>
          </div>
          <div className="kpi">
            <div className="k">Contribución</div>
            <div className={'v ' + (g.contrib >= 0 ? 'pos' : 'neg')}>{money(g.contrib)}</div>
            <div className="s">{pct(g.contrib, g.vn)}</div>
          </div>
        </div>
        <div className="panel">
          <h3>Consolidado por SBU y Marca</h3>
          <div className="sub">Clic en una SBU para ver sus marcas.</div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th className="l">SBU / Marca</th>
                  <th>Ventas Netas</th>
                  <th>Costo</th>
                  <th>Margen</th>
                  <th>% Mg</th>
                  <th>Gastos</th>
                  <th>Contribución</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(SBUS).map((sbu) => {
                  const t = sbuMetrics(sbu)
                  const open = !!expanded[sbu]
                  return (
                    <Fragment key={sbu}>
                      <tr className={'rowline' + (open ? ' open' : '')} onClick={() => toggleGroup(sbu)}>
                        <td className="l">
                          <span className="caret">▶</span> <b>{sbu}</b>
                        </td>
                        <td>{money(t.vn)}</td>
                        <td>{money(t.costo)}</td>
                        <td>{money(t.margen)}</td>
                        <td>{pct(t.margen, t.vn)}</td>
                        <td>{money(t.gastos)}</td>
                        <td className={t.contrib >= 0 ? 'pos' : 'neg'}>
                          <b>{money(t.contrib)}</b>
                        </td>
                      </tr>
                      {open &&
                        SBUS[sbu].map((m) => {
                          const x = marcaMetrics(sbu, m)
                          return (
                            <tr key={sbu + '-' + m} className="subrow">
                              <td className="l" style={{ paddingLeft: 28 }}>
                                {m}
                              </td>
                              <td>{money(x.vn)}</td>
                              <td>{money(x.costo)}</td>
                              <td>{money(x.margen)}</td>
                              <td>{pct(x.margen, x.vn)}</td>
                              <td>{money(x.gastos)}</td>
                              <td>{money(x.contrib)}</td>
                            </tr>
                          )
                        })}
                    </Fragment>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="l">TOTAL GRUPO</td>
                  <td>{money(g.vn)}</td>
                  <td>{money(g.costo)}</td>
                  <td>{money(g.margen)}</td>
                  <td>{pct(g.margen, g.vn)}</td>
                  <td>{money(g.gastos)}</td>
                  <td>{money(g.contrib)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        <div className="panel">
          <h3>Evolución mensual 2028</h3>
          <div className="sub">Ventas netas, margen y contribución por mes.</div>
          <div className="chartbox">
            <canvas ref={chartRef}></canvas>
          </div>
        </div>
      </>
    )
  }

  const tabs = [
    { id: 'marca', label: 'Por Marca' },
    { id: 'sbu', label: 'Por SBU' },
    { id: 'gerencia', label: 'Gerencia' },
  ]

  return (
    <>
      <header>
        <div className="brand">
          <span className="logo">A</span> ABP <span style={{ opacity: 0.8, fontWeight: 500 }}>· Presupuesto</span>
        </div>
        <span className="yr">2028</span>
        <div className="spacer"></div>
        <span className={'conn ' + (conn.on ? 'on' : 'off')}>
          <span className="d"></span>
          <span>{conn.txt}</span>
        </span>
        <a className="sheetbtn" target="_blank" rel="noreferrer" href={EDIT_URL}>
          ✏️ Editar datos
        </a>
        <button className="icon" title="Recargar" onClick={loadData}>
          ⟳
        </button>
      </header>

      <nav className="modules">
        {tabs.map((t) => (
          <button key={t.id} className={view === t.id ? 'active' : ''} onClick={() => setView(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        <div className="toolbar">
          <label>Escenario</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="SIN TAHO">SIN TAHO</option>
            <option value="CON TAHO">CON TAHO</option>
            <option value="AMBOS">Ambos (suma)</option>
          </select>
          <div className="spacer"></div>
          <span className="sub" style={{ color: 'var(--muted)', fontSize: 12 }}>
            Los datos se editan en la Google Sheet; aquí se leen y consolidan.
          </span>
        </div>

        {view === 'marca' && <MarcaView />}
        {view === 'sbu' && <SbuView />}
        {view === 'gerencia' && <GerenciaView />}
      </main>
    </>
  )
}
