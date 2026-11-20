/*******************************************************************
 * ABP 2028 · Sincronización Monday → Google Sheet  (SOLO LECTURA de Monday)
 *
 * Qué hace:
 *   - Agrega un menú "ABP · Monday" al abrir el Sheet, con el botón
 *     "🔄 Actualizar Monday".
 *   - Al darle clic, lee las órdenes de Monday (tablero Open Orders) de la
 *     temporada indicada y las escribe en la pestaña "Monday_SS27".
 *   - El token de Monday se guarda en las Propiedades del Script (oculto),
 *     NUNCA en la app pública.
 *   - Este script SOLO LEE de Monday (query GraphQL). No modifica nada en Monday.
 *
 * Instalación (una sola vez): ver instrucciones que te pasó Claude.
 *******************************************************************/

// ====== CONFIGURACIÓN ======
var BOARD_ID = 2270977303;                 // Open Orders 2022
var TAB_NAME = 'Monday_SS27';              // pestaña destino en el Sheet
var SEASON_FILTER = 'SS27';                // se compara contra "Dup. of Season"
var SEASON_COLUMN = 'dup__of_season_mkm28p23';

// IDs de columnas del tablero (no cambiar salvo que Monday las renombre)
var COLS = {
  cliente:   'text1',                 // Customer
  po:        'text',                  // Customer PO#
  clienteSF: 'dropdown_mm63b57k',     // Customer SF
  unidades:  'numbers8',              // Units
  pv:        'numbers2',              // Selling Price
  status:    'status69',              // Status (OPEN/CLOSED/CANCELLED)
  tipo:      'status_18',             // Order Type
  termino:   'status_17',             // Terms (FINANZAS)
  xf:        'date0',                 // XF
  eta:       'date5',                 // ETA
  temporada: 'dup__of_season_mkm28p23'
};
var COL_IDS = ['text1','text','dropdown_mm63b57k','numbers8','numbers2','status69','status_18','status_17','date0','date5','dup__of_season_mkm28p23'];

// ====== MENÚ ======
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ABP · Monday')
    .addItem('🔄 Actualizar Monday', 'actualizarMonday')
    .addSeparator()
    .addItem('🔑 Configurar token de Monday', 'configurarToken')
    .addToUi();
}

function configurarToken() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Token de Monday',
    'Pega aquí tu API token de Monday (Perfil → Developers → My Access Tokens). Se guarda oculto en el script.',
    ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() == ui.Button.OK) {
    var t = (r.getResponseText() || '').trim();
    if (t) { PropertiesService.getScriptProperties().setProperty('MONDAY_TOKEN', t); ui.alert('✅ Token guardado.'); }
    else ui.alert('No se guardó: el token venía vacío.');
  }
}

function getToken_() {
  var t = PropertiesService.getScriptProperties().getProperty('MONDAY_TOKEN');
  if (!t) throw new Error('Falta el token. Usa el menú "ABP · Monday → 🔑 Configurar token de Monday".');
  return t;
}

// ====== LECTURA DE MONDAY (solo query, read-only) ======
function mondayQuery_(query) {
  var res = UrlFetchApp.fetch('https://api.monday.com/v2', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': getToken_(), 'API-Version': '2024-10' },
    payload: JSON.stringify({ query: query }),
    muteHttpExceptions: true
  });
  var body = JSON.parse(res.getContentText() || '{}');
  if (body.errors) throw new Error('Monday: ' + JSON.stringify(body.errors));
  return body.data;
}

function colsFragment_() { return 'column_values(ids: ' + JSON.stringify(COL_IDS) + ') { id text }'; }

function fetchAllItems_() {
  var rules = '{ column_id: "' + SEASON_COLUMN + '", compare_value: ["' + SEASON_FILTER + '"], operator: contains_text }';
  var q1 =
    'query { boards(ids: ' + BOARD_ID + ') { items_page(limit: 300, query_params: { rules: [' + rules + '] }) {' +
    ' cursor items { id name group { title } ' + colsFragment_() + ' } } } }';
  var data = mondayQuery_(q1);
  var page = data.boards[0].items_page;
  var items = page.items || [];
  var cursor = page.cursor;
  var guard = 0;
  while (cursor && guard < 60) {
    guard++;
    var q2 = 'query { next_items_page(limit: 300, cursor: "' + cursor + '") { cursor items { id name group { title } ' + colsFragment_() + ' } } }';
    var d2 = mondayQuery_(q2);
    var p2 = d2.next_items_page;
    items = items.concat(p2.items || []);
    cursor = p2.cursor;
  }
  return items;
}

// ====== ESCRITURA EN EL SHEET ======
function actualizarMonday() {
  var ui = SpreadsheetApp.getUi();
  try {
    var items = fetchAllItems_();
    var val = function (it, colId) {
      var cv = it.column_values || [];
      for (var i = 0; i < cv.length; i++) if (cv[i].id === colId) return cv[i].text || '';
      return '';
    };
    var header = ['MARCA','CLIENTE','PO','CLIENTE_SF','UNIDADES','PV','STATUS','TIPO_ORDEN','TERMINO','XF','ETA','TEMPORADA','ITEM'];
    var rows = [header];
    items.forEach(function (it) {
      rows.push([
        (it.group && it.group.title) || '',
        val(it, COLS.cliente),
        val(it, COLS.po),
        val(it, COLS.clienteSF),
        Number(val(it, COLS.unidades)) || 0,
        Number(val(it, COLS.pv)) || 0,
        val(it, COLS.status),
        val(it, COLS.tipo),
        val(it, COLS.termino),
        val(it, COLS.xf),
        val(it, COLS.eta),
        val(it, COLS.temporada),
        it.name || ''
      ]);
    });
    var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    rows.push([]);
    rows.push(['Actualizado:', stamp, items.length + ' órdenes']);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(TAB_NAME) || ss.insertSheet(TAB_NAME);
    sh.clearContents();
    sh.getRange(1, 1, rows.length, header.length).setValues(
      rows.map(function (r) { while (r.length < header.length) r.push(''); return r; })
    );
    sh.getRange(1, 1, 1, header.length).setFontWeight('bold');
    ui.alert('✅ Monday actualizado: ' + items.length + ' órdenes ' + SEASON_FILTER + ' escritas en "' + TAB_NAME + '".');
  } catch (e) {
    ui.alert('No se pudo actualizar: ' + (e && e.message ? e.message : e));
  }
}
