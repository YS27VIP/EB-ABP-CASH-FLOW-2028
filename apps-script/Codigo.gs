/**
 * ABP 2028 — Backend de captura por rol + empresas + combinaciones de SBU.
 * Actualizar: pega este código, guarda, y Implementar -> Administrar implementaciones
 *   -> editar (lápiz) -> Versión: Nueva versión -> Implementar.
 */

const SHEET_ID = '1TtrRjRqwvBbwMic-3Epgwl-KabBjY8nTtwD3iOZN5N0';
const LOG_TAB = 'Registro';
const CFG_COMBOS = 'Config_Combinaciones'; // EMPRESA | SBU | MARCA
const CFG_EMPRESAS = 'Config_Empresas';    // EMPRESA
const MESES = ['ene-28','feb-28','mar-28','abr-28','may-28','jun-28','jul-28','ago-28','sep-28','oct-28','nov-28','dic-28'];
const HEAD = ['EMPRESA', 'RUBRO', 'SBU', 'MARCA'].concat(MESES);

function doPost(e) {
  try {
    var b = JSON.parse(e.postData.contents || '{}');
    var ss = SpreadsheetApp.openById(SHEET_ID);
    if (String(b.action || '') === 'config') return guardarConfig(ss, b);

    var empresa = String(b.empresa || '');
    var rol = String(b.rol || ''), tab = String(b.tab || ''), rows = Array.isArray(b.rows) ? b.rows : [];
    if (!tab || !rows.length) return json({ ok: false, error: 'Faltan tab/rows.' });

    var sh = tabConHeader(ss, tab, HEAD);
    var data = sh.getDataRange().getValues(), idx = {};
    for (var r = 1; r < data.length; r++) idx[k4(data[r][0], data[r][1], data[r][2], data[r][3])] = r + 1;

    var n = 0;
    rows.forEach(function (row) {
      var key = k4(empresa, row.rubro, row.sbu, row.marca);
      var meses = pad12(row.meses || []);
      var fila = idx[key];
      if (!fila) { sh.appendRow([empresa, row.rubro, row.sbu, row.marca].concat(meses)); idx[key] = sh.getLastRow(); }
      else sh.getRange(fila, 5, 1, 12).setValues([meses]);
      n++;
    });
    registrar(ss, b.usuario, rol, tab, empresa, n + ' fila(s)');
    return json({ ok: true, filas: n });
  } catch (err) { return json({ ok: false, error: String(err) }); }
}

function doGet(e) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    if (e.parameter && e.parameter.config) {
      var eSh = ss.getSheetByName(CFG_EMPRESAS), cSh = ss.getSheetByName(CFG_COMBOS);
      var empresas = eSh ? eSh.getDataRange().getValues().slice(1).map(function (r) { return r[0]; }).filter(String) : [];
      var combos = {};
      if (cSh) cSh.getDataRange().getValues().slice(1).forEach(function (r) {
        var em = r[0], sbu = r[1], m = r[2]; if (!em || !sbu || !m) return;
        combos[em] = combos[em] || {}; combos[em][sbu] = combos[em][sbu] || []; combos[em][sbu].push(m);
      });
      return json({ ok: true, empresas: empresas, combos: combos });
    }
    var tab = (e.parameter && e.parameter.tab) || '';
    var sh = ss.getSheetByName(tab);
    if (!sh) return json({ ok: false, error: 'No existe la pestaña: ' + tab });
    return json({ ok: true, tab: tab, values: sh.getDataRange().getValues() });
  } catch (err) { return json({ ok: false, error: String(err) }); }
}

function guardarConfig(ss, b) {
  var empresa = String(b.empresa || ''); var combos = b.combos || {};
  var eSh = tabConHeader(ss, CFG_EMPRESAS, ['EMPRESA']);
  var emps = eSh.getDataRange().getValues().slice(1).map(function (r) { return r[0]; });
  if (empresa && emps.indexOf(empresa) < 0) eSh.appendRow([empresa]);

  var cSh = tabConHeader(ss, CFG_COMBOS, ['EMPRESA', 'SBU', 'MARCA']);
  var vals = cSh.getDataRange().getValues();
  for (var r = vals.length - 1; r >= 1; r--) if (String(vals[r][0]) === empresa) cSh.deleteRow(r + 1);
  Object.keys(combos).forEach(function (sbu) {
    (combos[sbu] || []).forEach(function (m) { cSh.appendRow([empresa, sbu, m]); });
  });
  return json({ ok: true });
}

/* Crea la pestaña si no existe, o corrige el encabezado si cambió (limpia datos viejos incompatibles). */
function tabConHeader(ss, name, head) {
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(head); sh.getRange(1, 1, 1, head.length).setFontWeight('bold'); sh.setFrozenRows(1); return sh; }
  var first = sh.getRange(1, 1).getValue();
  if (String(first) !== head[0]) { sh.clear(); sh.appendRow(head); sh.getRange(1, 1, 1, head.length).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}

function registrar(ss, usuario, rol, tab, empresa, detalle) {
  var log = ss.getSheetByName(LOG_TAB);
  if (!log) { log = ss.insertSheet(LOG_TAB); log.appendRow(['Fecha/Hora', 'Usuario', 'Empresa', 'Rol', 'Pestaña', 'Detalle']); }
  log.appendRow([new Date(), usuario || '', empresa || '', rol, tab, detalle]);
}

function k4(a, b, c, d) { return [a, b, c, d].map(function (x) { return String(x || '').trim().toUpperCase(); }).join('|'); }
function pad12(a) { var o = a.slice(0, 12); while (o.length < 12) o.push(0); return o; }
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
