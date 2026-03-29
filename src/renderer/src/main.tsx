import React from "react";
import ReactDOM from "react-dom/client";

import { SideAssistantApp } from "@renderer/app/SideAssistantApp";

import "@renderer/styles/tokens.css";
import "@renderer/styles/app.css";
import "@renderer/styles/overlay-bubble.css";
import "@renderer/styles/agent-panel.css";
import "@renderer/styles/feature-panels.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SideAssistantApp />
  </React.StrictMode>,
);
