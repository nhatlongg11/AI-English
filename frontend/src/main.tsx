import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MotionConfig } from "motion/react";
import { AuthProvider } from "./features/auth/Auth";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/sonner";
import { App } from "./App";
import "./styles.css";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <MotionConfig reducedMotion="user">
          <TooltipProvider>
            <App />
            <Toaster richColors position="top-right" theme="light" />
          </TooltipProvider>
        </MotionConfig>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
