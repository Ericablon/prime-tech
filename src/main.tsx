import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { PrimeTechProvider } from "./contexts/PrimeTechContext";
import "./styles.css";
import "./styles/print.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <PrimeTechProvider>
          <App />
        </PrimeTechProvider>
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
);
