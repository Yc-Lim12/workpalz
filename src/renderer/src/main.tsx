import React from "react";
import ReactDOM from "react-dom/client";
import IslandApp from "./island/IslandApp";
import HrDashboard from "./hr/HrDashboard";
import "./index.css";

// One bundle, two windows: #island (floating) and #hr (dashboard)
const view = window.location.hash.replace("#", "") || "island";
if (view === "hr") {
  document.documentElement.classList.add("hr");
  document.title = "WorkPalz · HR Dashboard";
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{view === "hr" ? <HrDashboard /> : <IslandApp />}</React.StrictMode>
);
