import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { MotionPreference } from "./components/MotionPreference";
import "./index.css";
import "./brand.css";
import "./student.css";
import "./professor.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MotionPreference><App /></MotionPreference>
  </React.StrictMode>
);
