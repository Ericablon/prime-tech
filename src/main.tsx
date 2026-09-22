import React from 'react';
import ReactDOM from 'react-dom/client';

import { BrowserRouter } from 'react-router-dom';

import App from './App';

import { AuthProvider } from './contexts/AuthContext';
import { PrimeTechProvider } from './contexts/PrimeTechContext';

import './styles.css';
import './premium.css';
import './login-v2.css';

const routerBase = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

try {
  const redirectedPath = sessionStorage.getItem('cronos:pages-redirect');
  if (redirectedPath && redirectedPath.startsWith(`${routerBase}/`)) {
    sessionStorage.removeItem('cronos:pages-redirect');
    window.history.replaceState(null, '', redirectedPath);
  }
} catch {
  // A aplicação continua normalmente se o navegador bloquear sessionStorage.
}

ReactDOM.createRoot(
  document.getElementById('root')!,
).render(
  <React.StrictMode>
    <BrowserRouter basename={routerBase}>
      <AuthProvider>
        <PrimeTechProvider>
          <App />
        </PrimeTechProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

if (
  'serviceWorker' in navigator &&
  import.meta.env.PROD
) {
  window.addEventListener(
    'load',
    () => {
      void navigator.serviceWorker.register(
        `${import.meta.env.BASE_URL}sw.js`,
      );
    },
  );
}
