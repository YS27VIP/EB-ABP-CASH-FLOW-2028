import { useState, useRef, useEffect } from 'react'
import kai from './kai_head.png' // mascota de la empresa (fondo transparente)
import { gLogKai, getEmail, getName } from './google'

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
  { k: ['p&l', 'pyl', 'p y l', 'pl retail', 'p&l retail', 'estado de resultados', 'resultado operativo', 'resultado', 'contribucion'], a: '📊 El P&L (Resultado Operativo) se arma solo en 📈 Gerencia (por SBU y total de la empresa) y en 🏛️ Total Holding (todas las empresas). El P&L de Retail está en ENERGY BRANDS → Retail → pestaña P&L, en tres bloques: TOTAL, Retail EB y SINERGY & DYNAMICS. La contribución por marca está en "📊 Contribución de la marca".' },
  { k: ['retail', 'tiendas', 'tienda', 'sales factory', 'wholesale a retail', 'ecommerce'], a: '🏬 Retail (tiendas propias) está en ENERGY BRANDS, como una unidad más junto a las SBU. Ahí capturas Compras por tienda, Ventas por tienda, el mapa de abastecimiento, los gastos EB/Sinergy, el inventario por tienda y su P&L + Cash Flow.' },
  { k: ['intercompania', 'intercompañia', 'intercompañía', 'inter', 'incobrable'], a: '🔄 La venta intercompañía (lo que EB le vende a su propia Retail) es incobrable: suma a las unidades y venta de la marca, pero NO genera Cash In (para no contar la plata dos veces). El cobro real entra en el Cash Flow de Retail cuando vende al cliente final. En el Cash Flow de la marca aparece como línea informativa 🔄 debajo de Cash In.' },
  { k: ['saldo inicial', 'saldos iniciales', 'inventario inicial', 'master', 'xfd', 'importar excel', 'master ss27', 'master fw27'], a: '🧮 En 📦 Producto → Paso 6 "Saldos iniciales 2028" importas el Master por temporada (SS27/FW27) y sale el inventario inicial = Inv. disponible − (proyección − venta real) + compras por llegar (según su XFD).' },
  { k: ['cuentas por cobrar', 'cartera', 'deuda', 'saldo al corte', 'cobrar por cliente'], a: '🏦 En 💰 Finanzas → "🏦 Saldo inicial" están las Cuentas por cobrar por cliente: saldo al corte + proyección; según el término se calcula la deuda al cierre con la escalera de cobros. Haz clic en un cliente para ver su escalera mes a mes.' },
  { k: ['viajes', 'viaje', 'viajes equipo'], a: '🧳 Los viajes se capturan en la pestaña "🧳 Viajes equipo" de cada SBU (Producto, Director, Marketing, Controler). Los viajes de Finanzas se llenan en Finanzas → 🧳 Viajes. En SINERGY, "Director SINERGY" y "Otros" alimentan el P&L SINERGY.' },
  { k: ['sinergy', 'dynamics', 'sinergy & dynamics'], a: '🤝 SINERGY & DYNAMICS sale del bloque SINERGY del Retail (tienda SINERGY + sus capturas). Su P&L va a la columna SINERGY del Holding, no a Energy Brands. No tiene pantallas propias: se edita desde Retail.' },
  { k: ['holding', 'consolidado', 'todas las empresas', 'total holding'], a: '🏛️ El Total Holding suma todas las empresas. Entra con el selector "🏛️ TOTAL HOLDING". Ahí ves el P&L por empresa + total, el Cash Flow consolidado, el detalle por empresa y los botones 📄 Reporte Ejecutivo, ⬇ Exportar Excel y 🗄 Respaldar en Sheet.' },
  { k: ['reporte', 'pdf', 'exportar', 'excel', 'descargar', 'respaldo', 'respaldar', 'reporte ejecutivo'], a: '📄 En 🏛️ Total Holding: "📄 Reporte Ejecutivo (PDF)" (KPIs + P&L y Cash Flow por empresa), "⬇ Exportar Excel" (una hoja por empresa) y "🗄 Respaldar en Sheet" (guarda los reportes en el Google Sheet). El reporte espejo completo por departamento está en Gerencia / SBU.' },
  { k: ['gastos admin', 'gastos administrativos', 'centros de costo', 'gadmin', 'administrativos'], a: '💰 Los Gastos Administrativos se llenan en 💰 Finanzas → 💰 Gastos Admin (directos por SBU + indirectos prorrateados). En Energy Brands incluye lo aprobado a las áreas (105/106/107) y el espejo de Retail EB.' },
  { k: ['area comercial', 'área comercial', 'sin sbu', 'tumar', 'gubrands', 'otros'], a: '🧩 TUMAR, GUBRANDS, TAHO y las TUMAR-like (AR, CL, PY, JORS URU, MILHO URU) no usan SBU 1/2/3: tienen un solo botón "ÁREA COMERCIAL" con todas sus marcas. Energy Brands sí mantiene sus SBU.' },
  { k: ['2027', 'abp 2027', 'referencia 2027', 'ref_2027'], a: '📅 En Ventas, Producto, Marketing y Logística hay un ícono 📅 2027 que abre la info del ABP 2027 por mes, marca y categoría (Venta, Unidades, Costo, Logística, Marketing, Viajes). Sale de la hoja Ref_2027 del Google Sheet.' },
  // ---- Principiante / primera vez ----
  { k: ['empezar', 'empiezo', 'por donde empiezo', 'primera vez', 'nuevo', 'soy nuevo', 'no se usar', 'no se que hacer', 'como empiezo', 'inicio', 'arrancar'], a: '👋 ¡Bienvenido! Para empezar:\n1) Entra con tu cuenta @energybrandsgroup.com.\n2) En el menú elige tu área (Ventas, Producto, etc.) — solo verás lo que te toca.\n3) Arriba elige la MARCA.\n4) Escribe en las celdas de color amarillo (las que dicen ✏️ "para llenar").\n5) Pulsa 💾 Guardar.\nSi algo no cuadra, el banner "¡Tu turno!" te dice qué falta. ¡Pregúntame lo que sea!' },
  { k: ['que es esto', 'que es el abp', 'para que sirve', 'que es la herramienta', 'de que se trata', 'que hace esta app'], a: '📘 Esto es el ABP 2028: la herramienta donde todo el equipo arma el Presupuesto Anual del grupo. Cada área llena su parte (ventas, costos, gastos, cash flow) y la app consolida solo el P&L y el flujo de caja por marca, SBU, empresa y el holding completo. Todo se guarda en un Google Sheet compartido.' },
  { k: ['login', 'entrar', 'iniciar sesion', 'no puedo entrar', 'acceso bloqueado', 'contraseña', 'sign in', 'cuenta'], a: '🔑 Entra con tu correo @energybrandsgroup.com (botón de Google). Si te sale "acceso bloqueado", es que entraste con otra cuenta de Google: usa "Elegir / cambiar cuenta" y elige la de energybrandsgroup. Si aún no te deja, pídele acceso al administrador.' },
  { k: ['celdas amarillas', 'celdas de color', 'que lleno', 'que escribo', 'para llenar', 'donde escribo', 'cuales lleno'], a: '✏️ Solo escribes en las celdas de color (amarillas, con el ✏️ "para llenar"). Las demás (grises/blancas) son cálculos o referencias y no se tocan. Al terminar, 💾 Guardar.' },
  { k: ['turno', 'tu turno', 'banner amarillo', 'que falta'], a: '🟡 El banner "¡Tu turno! Completa las celdas amarillas" te recuerda qué te toca llenar. Cuando un dato no cuadra verás ⚠ ámbar; cuando sí, ✓ verde.' },
  { k: ['agregar cliente', 'nuevo cliente', 'cliente no aparece', 'añadir cliente', 'falta un cliente', 'cliente nuevo'], a: '➕ En 🧭 Ventas puedes agregar clientes: usa "Agregar cliente existente" (de la base) o "Agregar cliente nuevo" (escribes el nombre). Para un cliente nuevo escribes sus unidades 2028 directamente (sin %).' },
  { k: ['guardar', 'se guarda', 'guarda solo', 'se perdio', 'no guarde', 'perdi lo que puse'], a: '💾 Nada se guarda solo: pulsa 💾 Guardar en cada pantalla. Ahí va directo al Google Sheet y tu equipo lo ve al instante. Si cambiaste algo y no guardaste, se pierde al salir.' },
  { k: ['me equivoque', 'error', 'deshacer', 'borrar', 'corregir', 'arreglar un dato', 'cambiar un dato'], a: '🩹 Si te equivocaste, solo vuelve a escribir el dato correcto en la celda y 💾 Guardar — lo nuevo reemplaza lo viejo. No hay nada que se "rompa".' },
  { k: ['bombillo', 'bombilla', 'de donde sale el dato', 'origen del dato', 'por que ese numero', 'como se calculo'], a: '💡 Pasa el cursor por encima de cualquier número (verás el 💡): te explica de dónde sale y cómo se calculó ese dato.' },
  { k: ['ayuda', 'ayudas', 'info', 'comentarios', 'instrucciones', 'ocultar ayudas'], a: 'ℹ️ Los comentarios/instrucciones están ocultos para ganar espacio: aparecen como un chip "ℹ️ Ayuda" que al tocarlo se despliega en una tarjeta. Con el botón flotante "ℹ️ Ver ayudas" los muestras u ocultas todos.' },
  { k: ['actualizar', 'refrescar', 'no veo lo que guardo', 'no aparece lo que guarde', 'no se actualiza', 'ver lo ultimo'], a: '🔄 Si guardaste algo (tú o un compañero) y no lo ves, pulsa 🔄 Actualizar. Los datos del equipo pueden tardar ~1 min en reflejarse.' },
  { k: ['quien ve', 'privado', 'comparten', 'otros ven', 'es compartido'], a: '👀 Todo se guarda en un Google Sheet compartido del grupo, así que lo que guardas lo ve tu equipo al instante desde cualquier PC. Cada quien edita solo las áreas que le asignó el administrador.' },
  { k: ['avatar', 'foto', 'cambiar foto', 'mi foto', 'cambiar avatar'], a: '🙂 Tu avatar/nombre aparece arriba. Para cambiarlo usa "cambiar avatar" junto a tu sesión. Se guarda por persona (por tu correo).' },
  { k: ['temporada', 'ss27', 'fw27', 'que es temporada', 'estacion'], a: '🗓️ Las temporadas son SS (primavera-verano) y FW (otoño-invierno). El año se arma con SS27 + FW27. En Saldos iniciales importas el Master de cada temporada por separado y se suman.' },
  { k: ['termino', 'terminos', 'plazo', 'plazo de pago', 'dias de pago', 'condiciones de pago'], a: '📆 El término es el plazo de pago del cliente (Cash = de contado, 30/60/90… días). Define cuándo se cobra una venta: Cash el mismo mes, 60 días dos meses después, etc. Alimenta el Cash In por la escalera de cobros.' },
  { k: ['menu', 'volver', 'regresar', 'salir de aqui', 'navegar', 'moverme'], a: '🧭 Con "← Volver al menú" (arriba a la izquierda) regresas a las secciones. Desde el menú entras a tu área, a Finanzas, a Retail, o al Total Holding.' },
  { k: ['no entiendo', 'estoy perdido', 'ayuda humana', 'hablar con alguien', 'a quien pregunto', 'soporte'], a: '🤝 Si te atoras, pregúntame aquí (prueba palabras como P&L, retail, cobros, saldos, guardar…), o escríbele al administrador del ABP. También puedes tocar "🗺️ Mapa del ABP" para ver cómo se conecta todo.' },
]
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
// Guía por rol: qué le toca llenar a cada quien (según Colaboradores).
const ROLE_GUIDE = {
  ventas: '🧭 Como Ventas, te toca: las UNIDADES 2028 por cliente (pones un % de crecimiento por cliente) y agregar clientes. Entra a tu SBU → Comercial → Ventas, elige la marca y escribe en las celdas amarillas por mes. 💾 Guarda.',
  producto: '📦 Como Producto, te toca: inventario por temporada, AUP (precio) y AUC (costo) por categoría, la rotación (combinación de temporadas), las compras 2028 por XFD, el tiempo de tránsito y los saldos iniciales 2028 (Paso 6). Comercial → Producto, por marca.',
  marketing: '📣 Como Marketing, te toca: el gasto de marketing por marca y mes (pestaña 📣 Marketing).',
  logistica: '🚚 Como Logística, te toca: los % de costos logísticos (venta, muestras, mantenimiento) por marca, y proponer los rubros 105/106/107. Comercial → Logística.',
  director: '🧑‍💼 Como Director, te toca: definir las categorías de cada marca y su peso %, los % de comisiones, y revisar los viajes del equipo. Comercial → Director (1º del flujo).',
  finanzas: '💰 Como Finanzas, te toca: el Cash Flow (saldo inicial, condiciones de cobro/compra, costos financieros, otros ingresos/gastos), los Gastos Admin, el saldo inicial / cuentas por cobrar (🏦 Saldo inicial) y aprobar los 105/106/107.',
  gerencia: '📈 Como Gerencia, solo lees el consolidado (P&L y Cash Flow por SBU/empresa y el Total Holding). No llenas celdas.',
}
const ROLE_Q = ['que me toca', 'que lleno', 'que debo llenar', 'que lleno yo', 'mi parte', 'mi rol', 'que hago yo', 'guiame', 'guia', 'que tengo que hacer', 'mi tarea', 'que me corresponde']
function miPerfil() { try { return JSON.parse(localStorage.getItem('abp_mirol') || 'null') || null } catch { return null } }
function miEmp() { try { return localStorage.getItem('abp_nav_emp') || '' } catch { return '' } }
// Empresas sin SBU: una sola unidad "ÁREA COMERCIAL".
const COM_UNICA = ['TUMAR', 'TUMAR AR', 'TUMAR CL', 'TUMAR PY', 'JORS URU', 'MILHO URU', 'TAHO', 'GUBRANDS', 'OTROS']
const esComUnica = (e) => COM_UNICA.includes((e || '').trim().toUpperCase())
function guiaMiRol() {
  const p = miPerfil(); const r = norm(p && p.rol); const emp = miEmp(); const unica = esComUnica(emp)
  const key = Object.keys(ROLE_GUIDE).find((k) => r && (r.includes(k) || k.includes(r)))
  if (!key) return '🙋 No tengo tu rol registrado. Dime cuál eres (Ventas, Producto, Marketing, Logística, Director o Finanzas) y te guío, o toca "¿Quién llena qué?". Si eres colaborador, entra a tu área en el menú y verás solo lo tuyo.'
  let g = ROLE_GUIDE[key].replace('tu SBU', 'ÁREA COMERCIAL')
  if (unica) g += `\n\n🏷️ En ${emp} no hay SBU 1/2/3: todas las marcas están en un solo botón "ÁREA COMERCIAL". Además la logística es por marca, los viajes van en una sola línea, y las categorías no vienen por defecto (actívalas con "Trabajar con categorías" si las necesitas).`
  const head = (p.sbu && norm(p.sbu) !== 'todas' && !unica) ? `Según tu acceso eres ${p.rol} de ${p.sbu}.\n` : (emp ? `Estás en ${emp}${unica ? ' (ÁREA COMERCIAL)' : ''}.\n` : '')
  return head + g
}
const GREET = () => { const p = miPerfil(); const base = '¡Hola! 👋 Soy Kai, tu asistente del ABP. '; return (p && p.rol) ? base + `Veo que eres ${p.rol}${p.sbu && norm(p.sbu) !== 'todas' ? ' de ' + p.sbu : ''}. Toca "✅ ¿Qué me toca llenar?" para tu guía, o pregúntame lo que sea 👇` : base + 'Pregúntame lo que quieras: cómo llenar algo, de dónde sale un dato o cómo se calcula 👇' }
const CHIPS = ['✅ ¿Qué me toca llenar?', '👋 ¿Por dónde empiezo?', '🗺️ Mapa del ABP', '¿Qué celdas lleno?', '¿Cómo se calcula la venta neta?']

function responder(txt) {
  const t = norm(txt)
  if (ROLE_Q.some((q) => t.includes(norm(q)))) return guiaMiRol()
  let best = null, score = 0
  KB.forEach((e) => { let s = 0; e.k.forEach((kw) => { if (t.includes(norm(kw))) s += kw.length }); if (s > score) { score = s; best = e } })
  return best ? best.a : 'Mmm, no tengo esa respuesta exacta 🤔. Prueba con otras palabras (P&L, retail, cuentas por cobrar, saldos, viajes, holding, reporte, gastos admin, venta, costo, margen, AUP, unidades, categorías, cobros, inventario) o pregúntale al administrador del ABP.'
}

export default function HelpBot() {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState([{ from: 'bot', text: GREET() }])
  const [inp, setInp] = useState('')
  const endRef = useRef(null)
  useEffect(() => { if (open && endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' }) }, [msgs, open])
  const send = (text) => {
    const q = (text != null ? text : inp).trim(); if (!q) return
    setInp('')
    setMsgs((m) => [...m, { from: 'user', text: q }])
    const ans = responder(q)
    const resuelta = !ans.startsWith('Mmm, no tengo')
    const p = miPerfil()
    try { gLogKai(getEmail(), getName(), miEmp(), p && p.rol, q, resuelta) } catch { }
    setTimeout(() => setMsgs((m) => [...m, { from: 'bot', text: ans }]), 350)
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
          <div style={S.head}><img src={kai} alt="Kai" style={{ width: 34, height: 34, objectFit: 'contain', background: '#fff', borderRadius: '50%', padding: 1 }} /><div style={{ flex: 1 }}><div>Kai · asistente ABP</div><div style={{ fontSize: 11, fontWeight: 500, opacity: .9 }}>en línea · te ayuda al instante</div></div><span onClick={() => { setMsgs([{ from: 'bot', text: GREET() }]); setInp('') }} title="Volver a las preguntas rápidas" style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 700, marginRight: 12, whiteSpace: 'nowrap' }}>↺ Menú</span><span onClick={() => setOpen(false)} style={{ cursor: 'pointer', fontSize: 18 }}>✕</span></div>
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
