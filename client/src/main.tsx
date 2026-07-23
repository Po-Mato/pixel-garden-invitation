import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ViewPreferencesProvider } from "./accessibility/ViewPreferencesContext";
import { CoupleOrderProvider } from "./invitation/CoupleOrderContext";
import { PublishedInvitationContentProvider } from "./invitation/PublishedInvitationContentContext";
import { GameFeedbackProvider } from "./feedback/GameFeedbackContext";
import { startInvitationAnalytics } from "./analytics/invitationAnalytics";
import { DevicePerformanceProvider } from "./performance/DevicePerformanceContext";
import "./styles.css";
import "./feedback.css";
import "./pwa.css";
import "./network-performance.css";
import "./device-performance.css";

const initialSearch = new URLSearchParams(window.location.search);
if (!initialSearch.has("admin")) {
  startInvitationAnalytics(initialSearch.get("view") === "invitation" ? "simple" : "entry");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ViewPreferencesProvider>
      <DevicePerformanceProvider>
        <GameFeedbackProvider>
          <PublishedInvitationContentProvider>
            <CoupleOrderProvider>
              <App />
            </CoupleOrderProvider>
          </PublishedInvitationContentProvider>
        </GameFeedbackProvider>
      </DevicePerformanceProvider>
    </ViewPreferencesProvider>
  </React.StrictMode>
);
