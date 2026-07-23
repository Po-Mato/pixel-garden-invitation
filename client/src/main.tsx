import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ViewPreferencesProvider } from "./accessibility/ViewPreferencesContext";
import { CoupleOrderProvider } from "./invitation/CoupleOrderContext";
import { PublishedInvitationContentProvider } from "./invitation/PublishedInvitationContentContext";
import { GameFeedbackProvider } from "./feedback/GameFeedbackContext";
import { startInvitationAnalytics } from "./analytics/invitationAnalytics";
import "./styles.css";
import "./feedback.css";

const initialSearch = new URLSearchParams(window.location.search);
if (!initialSearch.has("admin")) {
  startInvitationAnalytics(initialSearch.get("view") === "invitation" ? "simple" : "entry");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ViewPreferencesProvider>
      <GameFeedbackProvider>
        <PublishedInvitationContentProvider>
          <CoupleOrderProvider>
            <App />
          </CoupleOrderProvider>
        </PublishedInvitationContentProvider>
      </GameFeedbackProvider>
    </ViewPreferencesProvider>
  </React.StrictMode>
);
