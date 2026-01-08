// Polyfills
if (typeof (window as any).global === 'undefined') { (window as any).global = window; }
if (typeof (window as any).process === 'undefined') {
  (window as any).process = {
    nextTick: (fn: any) => setTimeout(fn, 0),
    env: { NODE_ENV: 'development' },
    browser: true
  };
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
