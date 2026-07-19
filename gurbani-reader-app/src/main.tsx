import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "material-symbols/outlined.css";
import "./styles.css";
import "./tggsp.css";
import "./v012.css";
import "./v014.css";
import "./v016.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
