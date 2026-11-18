import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import RootApp from "./RootApp";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootApp />
  </StrictMode>
);
