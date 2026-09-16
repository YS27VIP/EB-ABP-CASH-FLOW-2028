import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import HelpBot from './HelpBot.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <HelpBot />
  </React.StrictMode>,
)
