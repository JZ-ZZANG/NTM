import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './i18n' // i18n 설정 로드

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)