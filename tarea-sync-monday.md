# Tarea programada: Sync Monday → Sheet (SS27)

**Cómo crearla:** barra lateral → sección **Scheduled** → nueva tarea.
- **Título:** 🔄 Sync Monday → Sheet (SS27)
- **Frecuencia:** diaria, 6:00 AM (cron: `0 6 * * *`)
- **Instrucciones (pegar tal cual):**

---

Sincroniza las órdenes de Monday a la pestaña "Monday_SS27" del Google Sheet de la herramienta ABP 2028. Esta tarea es de SOLO LECTURA sobre Monday: NUNCA crees, edites, muevas ni borres nada en Monday. Solo lee de Monday y solo escribes en el Google Sheet.

DATOS:
- Tablero de Monday (connector monday.com): board id 2270977303 ("Open Orders 2022").
- Google Sheet destino (connector Google Sheets): spreadsheetId 1TtrRjRqwvBbwMic-3Epgwl-KabBjY8nTtwD3iOZN5N0, pestaña "Monday_SS27".
- Columnas del tablero a leer por cada orden: group.title (marca), text1 = Cliente, text = PO (Customer PO#), numbers8 = Unidades, numbers2 = PV (Selling Price), status69 = Status, status_17 = Terms (término de pago).

PASOS:
1. Lee del board 2270977303 TODAS las órdenes cuya columna "Dup. of Season" (column id dup__of_season_mkm28p23) CONTENGA el texto "SS27". Usa get_board_items_page con includeColumns true y columnIds ["text1","text","numbers8","numbers2","status69","status_17"], filtrando por dup__of_season_mkm28p23 contains_text "SS27". Pagina con el cursor (pasando de nuevo includeColumns true y los mismos columnIds en cada página) hasta que has_more sea false, para traer las ~176+ órdenes completas. Si una página viene demasiado grande, baja el limit (por ejemplo 80) y pagina más veces.
2. Arma una matriz con encabezado: ["MARCA","CLIENTE","PO","UNIDADES","PV","STATUS","TERMINO","TEMPORADA"]. Una fila por orden: marca = group.title; CLIENTE = text1; PO = text; UNIDADES = numbers8 (número); PV = numbers2 (número); STATUS = status69; TERMINO = status_17; TEMPORADA = "SS27". Usa los valores de texto (campo text) de cada columna; para UNIDADES y PV conviértelos a número.
3. Escribe esa matriz en la pestaña "Monday_SS27" del spreadsheet, REEMPLAZANDO el contenido anterior (limpia la pestaña primero o sobrescribe desde A1; si la pestaña no existe, créala). Pon el encabezado en negrita si puedes. Al final, deja una fila en blanco y luego una fila ["Actualizado:", fecha y hora actual, N órdenes].
4. No escribas en ninguna otra pestaña. No modifiques el resto del Sheet. No toques Monday.

OBJETIVO: que la app ABP 2028 (solo Energy Brands) pueda comparar el plan (Master) contra la realidad de Monday por cliente. Al terminar, reporta en una línea cuántas órdenes se escribieron.
