/**
 * ABP 2028 — Backend de captura por rol para la app web (GitHub Pages).
 *
 * Crea una pestaña por rol y guarda ahí lo que cada equipo llena,
 * dejando un registro de quién y cuándo.
 *
 * Publicar (una sola vez):
 *  1. https://script.google.com -> Nuevo proyecto -> pega este código.
 *  2. Ejecuta la función  setup  una vez (menú ▶) para crear las pestañas.
 *  3. Implementar -> Nueva implementación -> "Aplicación web"
 *       Ejecutar como: Yo   |   Acceso: Cualquier persona
 *  4. Copia la URL /exec y pásamela para conectarla a la web.
 */

const SHEET_ID = '1TtrRjRqwvBbwMic-3Epgwl-KabBjY8nTtwD3iOZN5N0'; // ABP_2028_Modelo
const LOG_TAB  = 'Registro';
const MESES = ['ene-28','feb-28','mar-28','abr-28','may-28','jun-28','jul-28','ago-28','sep-28','oct-28','nov-28','dic-28'];

// Pestañas de captura por rol (no tocan las pestañas de cálculo del modelo).
const ROLE_TABS = ['Cap_Ventas','Cap_Producto','Cap_Marketing','Cap_Logistica','Cap_Director'];

/** Ejecutar UNA vez: crea las pestañas de captura con su encabezado. */
function setup() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  ROLE_TABS.forEach((name) => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(['RUBRO', 'SBU', 'MARCA'].concat(MESES));
      sh.getRange(1, 1, 1, 3 + MESES.length).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  });
  if (!ss.getSheetByName(LOG_TAB)) {
    const log = ss.insertSheet(LOG_TAB);
    log.appendRow(['Fecha/Hora', 'Usuario', 'Rol', 'Pestaña', 'Fila', 'Detalle']);
    log.getRange('A1:F1').setFontWeight('bold');
  }
}

/** Guardado desde la web. Body: { usuario, rol, tab, rows:[{rubro,sbu,marca,meses:[12]}] } */
function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents || '{}');
    const usuario = String(b.usuario || 'desconocido');
    const rol = String(b.rol || '');
    const tab = String(b.tab || '');
    const rows = Array.isArray(b.rows) ? b.rows : [];
    if (!tab || !rows.length) return json({ ok: false, error: 'Faltan "tab" o "rows".' });

    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sh = ss.getSheetByName(tab);
    if (!sh) { sh = ss.insertSheet(tab); sh.appendRow(['RUBRO','SBU','MARCA'].concat(MESES)); sh.setFrozenRows(1); }

    const data = sh.getDataRange().getValues(); // incluye encabezado
    const index = {};
    for (let r = 1; r < data.length; r++) index[key(data[r][0], data[r][1], data[r][2])] = r + 1; // fila 1-based

    let escritas = 0;
    rows.forEach((row) => {
      const k = key(row.rubro, row.sbu, row.marca);
      const meses = (row.meses || []).slice(0, 12);
      let fila = index[k];
      if (!fila) { sh.appendRow([row.rubro, row.sbu, row.marca].concat(meses)); fila = sh.getLastRow(); index[k] = fila; }
      else sh.getRange(fila, 4, 1, 12).setValues([pad12(meses)]);
      escritas++;
    });

    registrar(ss, usuario, rol, tab, escritas + ' fila(s)');
    return json({ ok: true, filas: escritas });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/** Lectura opcional: ?tab=Cap_Ventas -> matriz JSON. */
function doGet(e) {
  try {
    const tab = (e.parameter && e.parameter.tab) || '';
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sh = ss.getSheetByName(tab);
    if (!sh) return json({ ok: false, error: 'No existe la pestaña: ' + tab });
    return json({ ok: true, tab: tab, values: sh.getDataRange().getValues() });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function registrar(ss, usuario, rol, tab, detalle) {
  let log = ss.getSheetByName(LOG_TAB);
  if (!log) { log = ss.insertSheet(LOG_TAB); log.appendRow(['Fecha/Hora','Usuario','Rol','Pestaña','Fila','Detalle']); }
  log.appendRow([new Date(), usuario, rol, tab, '', detalle]);
}

function key(a, b, c) { return [a, b, c].map((x) => String(x || '').trim().toUpperCase()).join('|'); }
function pad12(a) { const o = a.slice(0, 12); while (o.length < 12) o.push(0); return o; }
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
