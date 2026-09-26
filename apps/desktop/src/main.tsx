import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { SpikeApp } from "./spike-app";
import "./spike.css";

const root = document.querySelector<HTMLDivElement>("#root");
if (!root) {
  throw new Error("Missing #root element");
}

createRoot(root).render(
  <StrictMode>
    <SpikeApp />
  </StrictMode>,
);
