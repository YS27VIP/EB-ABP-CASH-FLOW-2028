import { useState } from 'react'

/* Asistente jovial de ayuda (sin servidor): responde dudas frecuentes de la herramienta. */
const FAQ = [
  { q: '¿Cómo lleno mi información?', a: 'Elige tu área en el menú (Ventas, Producto, Marketing…), selecciona la marca arriba y escribe en las celdas de color. Al terminar pulsa 💾 Guardar. ¡Listo!' },
  { q: '¿Qué significa el lápiz ✏️?', a: 'Los bloques con ✏️ "para llenar" son los que TÚ debes capturar. Los que tienen 👁️ o no tienen ícono son solo de lectura (se calculan solos).' },
  { q: '¿Cómo veo el total de una SBU?', a: 'En los bloques por marca, en el selector de marca elige "▣ TOTAL SBU". Verás la suma de todas las marcas de esa SBU (solo lectura).' },
  { q: '¿Cómo funciona la escalera de cobros?', a: 'Cada venta (Unidades × AUP) se cobra según el término de pago del cliente: Cash = mismo mes, 30 días = el mes siguiente, 60 = +2 meses, etc. El total por mes llena solo la línea "Cash In" del cash flow.' },
  { q: 'No veo una sección que necesito', a: 'Tu acceso lo define el administrador en Combinaciones → Colaboradores. Pídele que active la pestaña que necesitas para tu correo.' },
  { q: '¿Se guarda automáticamente?', a: 'Se guarda cuando pulsas 💾 Guardar. Todo va directo al Google Sheet del ABP, así que tu equipo lo ve al instante desde cualquier PC.' },
  { q: '¿Cómo cambio de empresa?', a: 'En el menú principal, usa el selector "Empresa" (TUMAR, ENERGY BRANDS, TAHO…). Cada empresa tiene su propia información.' },
  { q: '¿De dónde sale el histórico?', a: 'El histórico se lee en vivo del libro EBP. Conforme avanzas mes a mes en el EBP, aquí se actualiza solo.' },
]

export default function HelpBot() {
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState(null)
  const S = {
    fab: { position: 'fixed', right: 20, bottom: 20, zIndex: 9999, width: 60, height: 60, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#714B67,#017e84)', color: '#fff', fontSize: 28, boxShadow: '0 6px 20px rgba(0,0,0,.25)' },
    panel: { position: 'fixed', right: 20, bottom: 92, zIndex: 9999, width: 340, maxWidth: 'calc(100vw - 40px)', maxHeight: '70vh', display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, boxShadow: '0 14px 40px rgba(0,0,0,.22)', overflow: 'hidden', fontSize: 14 },
    head: { background: 'linear-gradient(135deg,#714B67,#017e84)', color: '#fff', padding: '14px 16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 },
    body: { padding: 14, overflow: 'auto' },
    q: { display: 'block', width: '100%', textAlign: 'left', background: '#f5f6f8', border: '1px solid #e5e7eb', borderRadius: 10, padding: '9px 11px', marginBottom: 8, cursor: 'pointer', font: 'inherit', color: '#2b2b33', fontWeight: 600 },
    a: { background: '#eef7f7', border: '1px solid #bfe3e5', borderRadius: 10, padding: '11px 13px', margin: '2px 0 12px', lineHeight: 1.5, color: '#204b4d' },
    back: { background: 'transparent', border: 'none', color: '#017e84', fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: 10, font: 'inherit' },
  }
  return (
    <>
      {open && (
        <div style={S.panel}>
          <div style={S.head}><span style={{ fontSize: 22 }}>🤖</span> <div><div>Kai · tu asistente ABP</div><div style={{ fontSize: 11, fontWeight: 500, opacity: .9 }}>¿En qué te ayudo?</div></div></div>
          <div style={S.body}>
            {sel == null ? FAQ.map((f, i) => <button key={i} style={S.q} onClick={() => setSel(i)}>{f.q}</button>)
              : (<>
                <button style={S.back} onClick={() => setSel(null)}>← Volver a las preguntas</button>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{FAQ[sel].q}</div>
                <div style={S.a}>{FAQ[sel].a}</div>
              </>)}
            <div style={{ fontSize: 12, color: '#8a8f99', marginTop: 4 }}>¿Necesitas algo más? Escríbele al administrador del ABP. 😊</div>
          </div>
        </div>
      )}
      <button style={S.fab} onClick={() => setOpen((o) => !o)} title="Ayuda">{open ? '✕' : '🤖'}</button>
    </>
  )
}
