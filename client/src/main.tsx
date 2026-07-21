import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { CoupleOrderProvider } from "./invitation/CoupleOrderContext";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <CoupleOrderProvider>
      <App />
    </CoupleOrderProvider>
  </React.StrictMode>
);
