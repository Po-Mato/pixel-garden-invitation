import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ViewPreferencesProvider } from "./accessibility/ViewPreferencesContext";
import { CoupleOrderProvider } from "./invitation/CoupleOrderContext";
import { PublishedInvitationContentProvider } from "./invitation/PublishedInvitationContentContext";
import { startInvitationAnalytics } from "./analytics/invitationAnalytics";
import "./styles.css";

const initialSearch = new URLSearchParams(window.location.search);
if (!initialSearch.has("admin")) {
  startInvitationAnalytics(initialSearch.get("view") === "invitation" ? "simple" : "entry");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ViewPreferencesProvider>
      <PublishedInvitationContentProvider>
        <CoupleOrderProvider>
          <App />
        </CoupleOrderProvider>
      </PublishedInvitationContentProvider>
    </ViewPreferencesProvider>
  </React.StrictMode>
);
