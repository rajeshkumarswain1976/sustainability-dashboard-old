import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './journey.css'
const App = lazy(() => import('./App.jsx'))
const CampusCare = lazy(() => import('./pages/CampusCare.jsx'))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Suspense fallback={<div role="status" style={{padding:40}}>Loading campus services…</div>}>
      {window.location.pathname.startsWith('/campus-care') ? <CampusCare /> : <App />}
    </Suspense>
  </StrictMode>,
)
