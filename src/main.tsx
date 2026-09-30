import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/app/AppShell";
import { applyTheme, readStoredTheme } from "@/hooks/use-theme";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const CommandCenter = lazy(() => import("./pages/Dashboard.tsx"));
const Ideas = lazy(() => import("./pages/Ideas.tsx"));
const Scripts = lazy(() => import("./pages/Scripts.tsx"));
const ScriptStudio = lazy(() => import("./pages/ScriptStudio.tsx"));
const PublishKit = lazy(() => import("./pages/PublishKit.tsx"));
const Projects = lazy(() => import("./pages/Projects.tsx"));
const StyleProfile = lazy(() => import("./pages/StyleProfile.tsx"));
const SettingsPage = lazy(() => import("./pages/SettingsPage.tsx"));
const Tools = lazy(() => import("./pages/Tools.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// Resolve the creator's theme before the first paint so the workstation never
// flashes the wrong palette.
applyTheme(readStoredTheme());

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in the browser runtime). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/**
 * Clears a caught error whenever the route changes.
 *
 * A boundary that latches is the worst possible behaviour in a multi-screen
 * app: one bad screen leaves the error on screen forever, and every later
 * navigation looks broken too. It has to sit inside the router (to read the
 * location) while the boundary itself sits above it, so the reset travels
 * upwards through a module-level subscriber.
 */
let clearBoundaryError: (() => void) | null = null;

class ResettableRootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[Preview] Root crash:", err);
  }
  componentDidMount() {
    clearBoundaryError = () => {
      this.setState({ hasError: false, message: "", stack: "" });
    };
  }
  componentWillUnmount() {
    clearBoundaryError = null;
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">This screen hit an error</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Only this screen is affected — the rest of the workspace is fine.
            </p>
            <p className="mt-3 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
            <div className="mt-4 flex justify-center">
              <a
                href="/dashboard"
                className="rounded-md border border-border bg-muted/60 px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                Back to the Command Center
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

/**
 * React gets a container of its own instead of mounting straight into #root.
 *
 * The preview runtime injects its own elements into #root. When React owned
 * that element it deleted "its" children blindly and hit a node that had been
 * moved by the injected overlay:
 *   NotFoundError: removeChild — the node to be removed is not a child of this node
 * Mounting into a dedicated child div means React only ever removes nodes it
 * created itself, so injected siblings can no longer desync the commit phase.
 */
const appHost = document.getElementById("root");
if (!appHost) throw new Error("Missing #root element.");
const reactContainer = document.createElement("div");
reactContainer.id = "abdo-app";
appHost.appendChild(reactContainer);



function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    // One bad screen must not make every later screen look broken.
    clearBoundaryError?.();
  }, [location.pathname]);
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type !== "navigate") return;
      // history.back() with nothing behind this frame throws the creator out of
      // the app entirely — into whatever page the host had before. Inside the
      // app, "back" always means the app's own Command Center.
      const insideApp = window.location.pathname.startsWith("/dashboard");
      if (event.data.direction === "back") {
        if (insideApp && window.history.length > 1) {
          window.history.back();
        } else {
          window.location.replace("/dashboard");
        }
      }
      if (event.data.direction === "forward") {
        window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}


createRoot(reactContainer).render(
  <StrictMode>
    <ResettableRootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <RouteSyncer />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route
                path="/auth"
                element={<AuthPage redirectAfterAuth="/dashboard" />}
              />
              <Route
                path="/dashboard"
                element={
                  <RequireAuth
                    title="Sign in to open your workspace"
                    description="Your projects, ideas, scripts and agent runs live here."
                  >
                    <AppShell />
                  </RequireAuth>
                }
              >
                <Route index element={<CommandCenter />} />
                <Route path="ideas" element={<Ideas />} />
                <Route path="scripts" element={<Scripts />} />
                <Route path="scripts/:scriptId" element={<ScriptStudio />} />
                <Route
                  path="scripts/:scriptId/publish"
                  element={<PublishKit />}
                />
                <Route path="projects" element={<Projects />} />
                <Route path="style" element={<StyleProfile />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="tools" element={<Tools />} />
                {/* An unknown screen inside the workspace stays in the
                    workspace: the shell, the sidebar and a way forward are
                    still there, instead of a bare page outside it. */}
                <Route path="*" element={<NotFound />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
      </ConvexAuthProvider>
    </ResettableRootErrorBoundary>
  </StrictMode>,
);
