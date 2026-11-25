import "./mocks/insights";

import React from "react";
import { createRoot } from "react-dom/client";

import { AppShell } from "./AppShell";

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<AppShell />);
}
