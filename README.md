# ABP 2028 · Presupuesto por SBU y Marca (React + Vite)

Tablero de presupuesto 2028 estilo Odoo, construido con **React + Vite**. Los datos se
editan en una **Google Sheet** y la app los lee y consolida en vivo vía `gviz`.

## Vistas

- **Por Marca** — detalle mensual de una marca (ventas, costo, gastos, contribución).
- **Por SBU** — resumen de todas las marcas de una SBU, con total.
- **Gerencia** — consolidado del grupo (3 SBU) con desglose expandible y gráfico mensual.

Escenarios: `SIN TAHO`, `CON TAHO` o `Ambos (suma)`.

## Datos

- Google Sheet (compartida "cualquiera con el enlace: lector").
- Se lee la pestaña por `gid` mediante el endpoint `gviz/tq`.
- Estructura plana por fila: `TIPO`, `RUBRO`, `SBU`, `MARCA` y 12 meses.

La configuración (`SHEET_ID`, `GID`) está al inicio de `src/App.jsx`.

## Cómo correrlo

```bash
npm install      # solo la primera vez
npm run dev      # servidor de desarrollo (http://localhost:5173)
npm run build    # build de producción en dist/
npm run preview  # previsualizar el build
```

## Estructura

```
├─ index.html
├─ package.json
├─ vite.config.js
├─ public/
│  └─ vite.svg
└─ src/
   ├─ main.jsx
   ├─ App.jsx      ← toda la lógica y las vistas
   ├─ index.css    ← estilos globales
   └─ App.css
```
