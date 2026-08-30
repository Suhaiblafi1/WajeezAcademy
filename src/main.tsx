import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import './styles/light.css'
import App from './App.tsx'

/* بلغت الحزمةُ المتصفّح: تُمسح علامة الحارس في index.html، فلا تمنع
   إعادةَ تحميلٍ يحتاجها نشرٌ لاحق. */
declare global { interface Window { __wajeezBooted?: () => void } }
window.__wajeezBooted?.()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
