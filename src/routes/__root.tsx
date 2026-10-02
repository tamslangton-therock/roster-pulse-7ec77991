import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useState, useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { HydrateStore } from "@/components/hydrate-store";
import { SaveBar } from "@/components/save-bar";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/lib/auth";

// CHANGE YOUR ADMIN ACCESS CODE HERE
const MASTER_PASSCODE = "1234";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

function LoginGate({ children }: { children: ReactNode }) {
  const master = useAuth((s) => s.master);
  const user = useAuth((s) => s.user);
  const hydrateAuth = useAuth((s) => s.hydrate);
  const loginMasterFn = useAuth((s) => s.loginMaster);
  const loginUserFn = useAuth((s) => s.loginUser);
  const lock = useAuth((s) => s.lock);

  const [mode, setMode] = useState<"leader" | "admin">("leader");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  const authenticated = master || !!user;

  const handleLeaderLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await loginUserFn(username, password);
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Sign-in failed. Try again.");
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginMasterFn(code, MASTER_PASSCODE)) {
      setError("");
    } else {
      setError("Incorrect access code.");
    }
  };

  const handleLock = () => {
    lock();
    setUsername("");
    setPassword("");
    setCode("");
    setError("");
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100 px-4">
        <div className="w-full max-w-sm p-8 bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 text-center">
          <div className="w-12 h-12 bg-primary/20 text-primary rounded-full flex items-center justify-center mx-auto mb-4 text-xl">
            🔒
          </div>
          <h2 className="text-2xl font-bold mb-1 tracking-tight text-white">The Rock Church</h2>
          <p className="text-xs text-slate-400 mb-6">
            {mode === "leader"
              ? "Team leader sign-in"
              : "Enter the admin access code"}
          </p>

          <div className="flex rounded-lg bg-slate-900 p-1 mb-6 text-xs font-medium">
            <button
              type="button"
              onClick={() => { setMode("leader"); setError(""); }}
              className={`flex-1 py-2 rounded-md transition-colors ${
                mode === "leader" ? "bg-primary text-primary-foreground" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Team leader
            </button>
            <button
              type="button"
              onClick={() => { setMode("admin"); setError(""); }}
              className={`flex-1 py-2 rounded-md transition-colors ${
                mode === "admin" ? "bg-primary text-primary-foreground" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Admin
            </button>
          </div>

          {mode === "leader" ? (
            <form onSubmit={handleLeaderLogin} className="space-y-4">
              <input
                type="text"
                placeholder="Your name"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(""); }}
                autoComplete="username"
                className={`w-full px-4 py-3 bg-slate-900 border rounded-lg text-sm text-white focus:outline-none focus:ring-2 ${
                  error ? "border-red-500 focus:ring-red-500" : "border-slate-700 focus:ring-primary focus:border-transparent"
                }`}
                autoFocus
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                autoComplete="current-password"
                className={`w-full px-4 py-3 bg-slate-900 border rounded-lg text-sm text-white focus:outline-none focus:ring-2 ${
                  error ? "border-red-500 focus:ring-red-500" : "border-slate-700 focus:ring-primary focus:border-transparent"
                }`}
              />
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors duration-200 text-sm shadow-md disabled:opacity-60"
              >
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <input
                type="password"
                placeholder="Enter passcode"
                value={code}
                onChange={(e) => { setCode(e.target.value); setError(""); }}
                className={`w-full px-4 py-3 bg-slate-900 border rounded-lg text-center text-lg tracking-widest text-white focus:outline-none focus:ring-2 ${
                  error ? "border-red-500 focus:ring-red-500" : "border-slate-700 focus:ring-primary focus:border-transparent"
                }`}
                autoFocus
              />
              {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
              <button
                type="submit"
                className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors duration-200 text-sm shadow-md"
              >
                Unlock Access
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const whoami = master ? "Admin" : user?.displayName || user?.username || "";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b bg-background/80 backdrop-blur px-4 sticky top-0 z-30">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <div className="text-sm font-medium tracking-tight">The Rock Church</div>
            </div>
            <div className="flex items-center gap-2">
              {whoami && (
                <span className="text-xs text-muted-foreground">
                  Signed in: <span className="font-medium text-foreground">{whoami}</span>
                </span>
              )}
              <button
                onClick={handleLock}
                className="text-xs font-medium px-3 py-1.5 rounded-md border border-input bg-background hover:bg-accent text-muted-foreground transition-colors flex items-center gap-1.5"
              >
                🔒 Lock App
              </button>
            </div>
          </header>
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#f7eace" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "The Rock" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { title: "The Rock Church — Church Roster Management" },
      {
        name: "description",
        content:
          "The Rock Church is a clean, intuitive church roster manager with clash detection, fatigue tracking, and smart swaps.",
      },
      { name: "author", content: "The Rock Church" },
      { property: "og:title", content: "The Rock Church — Church Roster Management" },
      {
        property: "og:description",
        content: "Plan Sundays with clash detection, fatigue insights, and one-click smart swaps.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      {/* Browser extensions (e.g. Grammarly) inject attributes on <body> before React loads. */}
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <HydrateStore>
        <LoginGate>
          <Outlet />
          <SaveBar />
        </LoginGate>
        <Toaster position="top-right" />
      </HydrateStore>
    </QueryClientProvider>
  );
}
