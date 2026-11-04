import React from "react";
import { createRoot } from "react-dom/client";
import { setCurrentLang } from "../../src/i18n";
import App from "./App";
import "./styles.css";

setCurrentLang("ja");

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
