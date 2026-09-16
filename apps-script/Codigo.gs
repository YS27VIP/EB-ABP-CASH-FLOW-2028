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
const HIST_TAB = 'Historico';
const HIST_HEAD = ['EMPRESA', 'AÑO', 'TIPO', 'RUBRO', 'SBU', 'MARCA', 'MES', 'MONTO', 'CLIENTE', 'PAIS'];

function doPost(e) {
  try {
    var b = JSON.parse(e.postData.contents || '{}');
    var ss = SpreadsheetApp.openById(SHEET_ID);
    if (String(b.action || '') === 'config') return guardarConfig(ss, b);
    if (String(b.action || '') === 'historico') return guardarHistorico(ss, b);
    if (String(b.action || '') === 'bitacora') return guardarBitacora(ss, b);

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
/* Reemplaza la hoja "Historico" con el Excel importado (estructura plana para análisis). */
/* Importa el histórico: reemplaza SOLO las empresas incluidas en el archivo; conserva las demás. */
function guardarHistorico(ss, b) {
  var values = Array.isArray(b.values) ? b.values : [];
  if (!values.length) return json({ ok: false, error: 'Sin datos.' });
  var W = HIST_HEAD.length;
  var hasHeader = String(values[0][0] || '').toUpperCase().indexOf('EMPRESA') >= 0;
  var incoming = [];
  (hasHeader ? values.slice(1) : values).forEach(function (r) {
    var vacia = true, o = [];
    for (var i = 0; i < W; i++) { var v = (r && r[i] !== undefined && r[i] !== null) ? r[i] : ''; if (v !== '') vacia = false; o.push(v); }
    if (!vacia) incoming.push(o);
  });
  var nuevas = {};
  incoming.forEach(function (r) { nuevas[String(r[0]).trim().toUpperCase()] = true; });

  var sh = ss.getSheetByName(HIST_TAB);
  var conservadas = [];
  if (sh) {
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var em = String(data[i][0] || '').trim().toUpperCase();
      if (em && !nuevas[em]) { var o2 = []; for (var j = 0; j < W; j++) o2.push(data[i][j] != null ? data[i][j] : ''); conservadas.push(o2); }
    }
  } else { sh = ss.insertSheet(HIST_TAB); }

  var out = [HIST_HEAD].concat(conservadas).concat(incoming);
  sh.clear();
  sh.getRange(1, 1, out.length, W).setValues(out);
  sh.getRange(1, 1, 1, W).setFontWeight('bold'); sh.setFrozenRows(1);
  return json({ ok: true, filas: incoming.length, total: out.length - 1 });
}

/* Bitácora de cambios: una fila por modificación (Fecha, Empresa, Descripción). */
function guardarBitacora(ss, b) {
  var sh = ss.getSheetByName('Bitacora');
  if (!sh) { sh = ss.insertSheet('Bitacora'); sh.appendRow(['Fecha del cambio', 'Empresa', 'Descripción del cambio']); sh.getRange('A1:C1').setFontWeight('bold'); sh.setFrozenRows(1); }
  sh.appendRow([new Date(), String(b.empresa || ''), String(b.descripcion || '')]);
  return json({ ok: true });
}

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

/**
 * IMPORTADOR: trae el histórico de ventas por cliente del libro EBP a la hoja Historico del ABP.
 * Ejecutar UNA VEZ desde el editor: seleccionar 'importarEBP' y pulsar ▶ Ejecutar (autorizar la primera vez).
 * Es idempotente: reemplaza las filas de ENERGY BRANDS de los años importados y vuelve a cargarlas.
 * Lee por NOMBRE de columna (no por letra), así que aguanta cambios de orden.
 */
var EBP_SHEET_ID = '1OZNU8e2P8D8Dewa0rz9fGL7B-h8RJ6_7XGGuUpro8wc';
var EBP_TABS = [ { name: 'UNIDADES VENTA COSTO', year: 2026 }, { name: 'VENTA REAL 2025', year: 2025 } ];
var MES_NUM = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, sept: 8, oct: 9, nov: 10, dic: 11 };

function importarEBP() {
  var src = SpreadsheetApp.openById(EBP_SHEET_ID);
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var out = [];
  EBP_TABS.forEach(function (t) {
    var sh = src.getSheetByName(t.name); if (!sh) return;
    var vals = sh.getDataRange().getValues();
    var hr = -1;
    for (var i = 0; i < Math.min(vals.length, 15); i++) { if (vals[i].map(String).join('|').toUpperCase().indexOf('CLIENTE ARMONIZADO') >= 0) { hr = i; break; } }
    if (hr < 0) return;
    var H = vals[hr].map(function (x) { return String(x || '').trim().toUpperCase(); });
    function idx(cands, last) { var f = -1; for (var c = 0; c < cands.length; c++) { for (var k = 0; k < H.length; k++) { if (H[k] === cands[c]) { if (last) { f = k; } else { return k; } } } if (f >= 0 && !last) return f; } return f; }
    var iTipo = idx(['TIPO']), iRub = idx(['RUBRO']), iSbu = idx(['SBU']), iMar = idx(['MARCA', 'ARCH']),
        iCli = idx(['CLIENTE ARMONIZADO']), iVal = idx(['VALOR EN DOLARES', 'DOLARES', 'VALOR']),
        iMes = idx(['FECHA ARREGLADA', 'MES']), iPais = idx(['PAIS'], true), iAno = idx(['AÑO', 'ANO', 'AÑO']);
    for (var r = hr + 1; r < vals.length; r++) {
      var row = vals[r];
      var cli = String(row[iCli] || '').trim(); if (!cli) continue;
      var rub = String(row[iRub] || '').trim().toUpperCase();
      if (!(rub.indexOf('UNIDAD') >= 0 || rub.indexOf('COSTO') >= 0 || rub.indexOf('VENTA') >= 0)) continue;
      var mesRaw = String(row[iMes] || '').trim().toLowerCase(); var mm = mesRaw.replace(' ', '-').split('-');
      var mo = MES_NUM[mm[0]]; if (mo == null) continue;
      var yr = (iAno >= 0 && row[iAno]) ? parseInt(row[iAno], 10) : (mm[1] ? 2000 + parseInt(mm[1], 10) : t.year);
      out.push(['ENERGY BRANDS', yr, String(row[iTipo] || ''), String(row[iRub] || ''), String(row[iSbu] || ''),
                String(row[iMar] || ''), new Date(yr, mo, 1), Number(row[iVal]) || 0, cli, String(row[iPais] || '')]);
    }
  });
  var years = {}; EBP_TABS.forEach(function (t) { years[t.year] = true; });
  var hs = ss.getSheetByName(HIST_TAB); if (!hs) { hs = ss.insertSheet(HIST_TAB); hs.appendRow(HIST_HEAD); }
  var data = hs.getDataRange().getValues(); var keep = [HIST_HEAD];
  for (var i = 1; i < data.length; i++) { var em = String(data[i][0] || '').toUpperCase(); var yy = parseInt(data[i][1], 10); if (em === 'ENERGY BRANDS' && years[yy]) continue; keep.push(data[i]); }
  var all = keep.concat(out);
  hs.clear();
  hs.getRange(1, 1, all.length, HIST_HEAD.length).setValues(all);
  hs.getRange(1, 1, 1, HIST_HEAD.length).setFontWeight('bold'); hs.setFrozenRows(1);
  Logger.log('Importadas ' + out.length + ' filas por cliente (2025 y 2026).');
  return out.length;
}
