import { useState, useRef, useEffect } from 'react'
import kai from './kai_head.png' // mascota de la empresa (fondo transparente)

/* Kai: asistente jovial tipo chat (sin servidor). Busca por palabras clave y explica de dónde sale / cómo se calcula cada dato. */
const KB = [
  { k: ['venta neta', 'ventas', 'como se calcula la venta', 'venta'], a: '💰 La Venta Neta = Unidades 2028 × AUP. Las unidades las captura Ventas; el AUP lo captura Producto (por categoría). Lo ves consolidado en Gerencia y en Ventas.' },
  { k: ['costo', 'auc'], a: '📦 El Costo = Unidades × AUC. El AUC (costo promedio por unidad) lo captura Producto. En Gerencia lo ves por marca y SBU.' },
  { k: ['margen', 'utilidad', 'ganancia'], a: '📊 El Margen = Venta Neta − Costo. El Margen % = Margen ÷ Venta. Todo se arma solo en el tablero de Gerencia.' },
  { k: ['aup', 'precio'], a: '🏷️ El AUP es el precio promedio por unidad, y se captura por categoría en Producto. El AUP ponderado usa los pesos de categoría que define el Director.' },
  { k: ['unidades', 'proyeccion', 'crecimiento', 'como proyecto'], a: '📈 Las Unidades 2028 salen del histórico por cliente × (1 + % de crecimiento) que pones en Ventas. Un solo % por cliente y se aplica a todos los meses.' },
  { k: ['categoria', 'categorias', 'peso', 'director'], a: '🗂️ El Director define las categorías de cada marca y su peso %. En Ventas marcas en cuáles categorías participa cada cliente; con eso se reparten las unidades y la venta por categoría.' },
  { k: ['escalera', 'cobro', 'cobros', 'cash in', 'termino de pago', 'terminos'], a: '🪜 La escalera de cobros: cada venta se cobra según el término del cliente (Cash = mismo mes, 30 días = +1 mes, 60 = +2, etc.). El total por mes llena solo la línea Cash In del cash flow.' },
  { k: ['historico', 'ebp', 'septiembre', 'de donde sale el historico'], a: '🕒 El histórico se lee EN VIVO del libro EBP. Conforme avanzas mes a mes en el EBP, aquí se actualiza solo (hasta ~1 min de diferencia).' },
  { k: ['inventario', 'compras', 'stock'], a: '📥 El Inventario/Compras lo captura Producto por marca y mes. En Gerencia se muestra como el inventario del año.' },
  { k: ['cash flow', 'flujo', 'saldo', 'saldo 2027'], a: '💵 En Finanzas → Cash Flow capturas por concepto y mes. El saldo (deuda) cierre 2027 por cliente alimenta el Cash In de Dic-27, y las ventas 2028 alimentan los cobros por la escalera.' },
  { k: ['lleno', 'como lleno', 'capturar', 'donde escribo'], a: '✏️ Elige tu área en el menú, selecciona la marca arriba, y escribe en las celdas de color (las que tienen ✏️ "para llenar"). Al terminar pulsa 💾 Guardar.' },
  { k: ['no veo', 'acceso', 'permiso', 'seccion', 'falta'], a: '🔒 Lo que ves depende de tu acceso, que define el administrador en Combinaciones → Colaboradores. Si te falta una sección, pídesela.' },
  { k: ['total sbu', 'todas las marcas', 'total'], a: '▣ En los bloques por marca, elige "TOTAL SBU" en el selector para ver la suma de todas las marcas de esa SBU (solo lectura).' },
  { k: ['guardar', 'se guarda', 'guarda solo'], a: '💾 Se guarda cuando pulsas Guardar. Todo va directo al Google Sheet, así tu equipo lo ve al instante desde cualquier PC.' },
  { k: ['empresa', 'cambiar empresa', 'tumar', 'taho'], a: '🏢 Cambia de empresa con el selector "Empresa" en el menú (TUMAR, ENERGY BRANDS, TAHO…). Cada una tiene su propia información.' },
  { k: ['color', 'colores', 'marca color'], a: '🎨 Cada SBU y cada marca tienen su color. Al elegir una marca, la vista se pinta con ese color para que ubiques rápido en qué estás trabajando.' },
  { k: ['quien llena', 'quien hace', 'quien captura', 'quien pone', 'responsable', 'quien llena que', 'llena cada', 'quien hace que', 'roles', 'quien es responsable'], a: '👥 Quién llena qué:\n• 🧭 Ventas: unidades 2028 por cliente (% de crecimiento) y agrega clientes.\n• 📦 Producto: inventario por temporada, AUP/AUC (precio y costo), rotación, compras (fecha XFD) y tiempo de tránsito.\n• 📣 Marketing: el gasto de marketing por marca y mes.\n• 🚚 Logística: los % de costos logísticos (venta, muestras, mantenimiento).\n• 🧑‍💼 Director: categorías y su peso, % de comisiones, y ve los viajes del equipo.\n• 💰 Finanzas: Cash Flow (saldo inicial, condiciones comerciales/compras, gastos administrativos), el saldo pendiente por cobrar del 2027, y aprueba los % de Logística.\n• 📈 Gerencia / 🏛️ Total Holding: solo leen el consolidado (no llenan nada).' },
  { k: ['mapa', 'mapa del app', 'mapa de la app', 'estructura', 'secciones', 'flujo', 'como se conecta', 'overview', 'mapa del abp', 'como funciona todo', 'panorama'], a: '🗺️ Mapa del ABP (cómo se conecta todo):\n1) 🧭 Ventas pone las UNIDADES por cliente.\n2) 📦 Producto pone AUP/AUC y las COMPRAS → con eso se arma Venta Neta, Costo y Margen.\n3) 📣 Marketing, 🚚 Logística, 🧳 Viajes y 💵 Comisiones son costos que bajan hasta la CONTRIBUCIÓN de cada SBU.\n4) 💰 Finanzas arma el CASH FLOW: Cash In (cobros por escalera de plazos + saldo pendiente 2027) − Cash Out (pagos a proveedores) − Costos Operativos = Cash Final.\n5) 📈 Gerencia consolida por SBU y 🏛️ Total Holding suma todas las empresas.\nTip: lo que cada área guarda alimenta a las demás; usa 🔄 Actualizar para ver lo último del equipo.' },
]
const GREET = '¡Hola! 👋 Soy Kai, tu asistente del ABP. Pregúntame lo que quieras: cómo llenar algo, de dónde sale un dato o cómo se calcula. También puedes tocar una pregunta rápida 👇'
const CHIPS = ['¿Quién llena qué?', '🗺️ Mapa del ABP', '¿Cómo se calcula la venta neta?', '¿Cómo funciona la escalera de cobros?']

function responder(txt) {
  const t = (txt || '').toLowerCase()
  let best = null, score = 0
  KB.forEach((e) => { let s = 0; e.k.forEach((kw) => { if (t.includes(kw)) s += kw.length }); if (s > score) { score = s; best = e } })
  return best ? best.a : 'Mmm, no estoy seguro de esa 🤔. Prueba con otras palabras (venta, costo, margen, AUP, unidades, categorías, cobros, histórico, inventario) o pregúntale al administrador del ABP.'
}

export default function HelpBot() {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState([{ from: 'bot', text: GREET }])
  const [inp, setInp] = useState('')
  const endRef = useRef(null)
  useEffect(() => { if (open && endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' }) }, [msgs, open])
  const send = (text) => {
    const q = (text != null ? text : inp).trim(); if (!q) return
    setInp('')
    setMsgs((m) => [...m, { from: 'user', text: q }])
    setTimeout(() => setMsgs((m) => [...m, { from: 'bot', text: responder(q) }]), 350)
  }
  const G = 'linear-gradient(135deg,#0891b2,#10b981)'
  const S = {
    fab: { position: 'fixed', right: 20, bottom: 20, zIndex: 9999, width: 62, height: 62, borderRadius: '50%', border: 'none', cursor: 'pointer', background: G, color: '#fff', fontSize: 28, boxShadow: '0 6px 20px rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, overflow: 'hidden' },
    panel: { position: 'fixed', right: 20, bottom: 94, zIndex: 9999, width: 360, maxWidth: 'calc(100vw - 40px)', height: '70vh', maxHeight: 560, display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 18, boxShadow: '0 16px 44px rgba(0,0,0,.24)', overflow: 'hidden', fontSize: 14 },
    head: { background: G, color: '#fff', padding: '13px 16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 },
    body: { flex: 1, overflow: 'auto', padding: 14, background: '#f7fafb' },
    bot: { background: '#e6f6f6', color: '#134e4a', borderRadius: '12px 12px 12px 3px', padding: '10px 12px', margin: '6px 0', maxWidth: '85%', lineHeight: 1.5, whiteSpace: 'pre-line' },
    user: { background: '#0891b2', color: '#fff', borderRadius: '12px 12px 3px 12px', padding: '10px 12px', margin: '6px 0 6px auto', maxWidth: '85%', lineHeight: 1.5, whiteSpace: 'pre-line' },
    chips: { padding: '0 14px 8px', display: 'flex', flexWrap: 'wrap', gap: 6, background: '#f7fafb' },
    chip: { background: '#fff', border: '1px solid #bfe3e5', color: '#0e7490', borderRadius: 14, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
    foot: { display: 'flex', gap: 6, padding: 10, borderTop: '1px solid #eee', background: '#fff' },
    input: { flex: 1, border: '1px solid #d7dde3', borderRadius: 20, padding: '9px 13px', font: 'inherit', outline: 'none' },
    snd: { background: G, color: '#fff', border: 'none', borderRadius: 20, padding: '0 16px', fontWeight: 700, cursor: 'pointer' },
  }
  return (
    <>
      <style>{`@keyframes kaiFloat{0%,100%{transform:translateY(0) rotate(0deg)}25%{transform:translateY(-7px) rotate(-3deg)}75%{transform:translateY(-3px) rotate(3deg)}}@keyframes kaiPulse{0%,100%{box-shadow:0 6px 20px rgba(0,0,0,.25)}50%{box-shadow:0 10px 26px rgba(8,145,178,.45)}}`}</style>
      {open && (
        <div style={S.panel}>
          <div style={S.head}><img src={kai} alt="Kai" style={{ width: 34, height: 34, objectFit: 'contain', background: '#fff', borderRadius: '50%', padding: 1 }} /><div style={{ flex: 1 }}><div>Kai · asistente ABP</div><div style={{ fontSize: 11, fontWeight: 500, opacity: .9 }}>en línea · te ayuda al instante</div></div><span onClick={() => setOpen(false)} style={{ cursor: 'pointer', fontSize: 18 }}>✕</span></div>
          <div style={S.body}>
            {msgs.map((m, i) => <div key={i} style={m.from === 'bot' ? S.bot : S.user}>{m.text}</div>)}
            <div ref={endRef} />
          </div>
          {msgs.length <= 1 && <div style={S.chips}>{CHIPS.map((c) => <span key={c} style={S.chip} onClick={() => send(c)}>{c}</span>)}</div>}
          <div style={S.foot}>
            <input style={S.input} value={inp} onChange={(e) => setInp(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send() }} placeholder="Escríbeme tu pregunta…" />
            <button style={S.snd} onClick={() => send()}>➤</button>
          </div>
        </div>
      )}
      <button style={{ ...S.fab, animation: open ? 'none' : 'kaiPulse 2.8s ease-in-out infinite' }} onClick={() => setOpen((o) => !o)} title="Ayuda de Kai">{open ? '✕' : <img src={kai} alt="Kai" style={{ width: 50, height: 50, objectFit: 'contain', display: 'block', animation: 'kaiFloat 3s ease-in-out infinite' }} />}</button>
    </>
  )
}
