import { createRoot } from 'react-dom/client'
import { App } from './app.js'
import { StrictMode } from 'react'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
