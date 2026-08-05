import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

type OAuthDetails = {
  client?: { name?: string } | null;
  redirect_url?: string;
  redirect_to?: string;
  scope?: string;
};

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthDetails | null; error: Error | null }>;
  approveAuthorization: (id: string) => Promise<{ data: OAuthDetails | null; error: Error | null }>;
  denyAuthorization: (id: string) => Promise<{ data: OAuthDetails | null; error: Error | null }>;
};

function oauthApi(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Browser-only: the session lives in localStorage, absent during SSR.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s["authorization_id"] === "string" ? s["authorization_id"] : "",
  }),
  component: Consent,
  errorComponent: ({ error }) => (
    <Shell>
      <p className="text-sm text-muted-foreground">
        Could not load this authorization request: {String((error as Error)?.message ?? error)}
      </p>
    </Shell>
  ),
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">{children}</div>
    </main>
  );
}

function Consent() {
  const { authorization_id } = Route.useSearch();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [details, setDetails] = useState<OAuthDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        setSignedIn(false);
        return;
      }
      setSignedIn(true);
      setEmail(data.session.user.email ?? null);
      if (!authorization_id) {
        setError("Missing authorization_id.");
        return;
      }
      const res = await oauthApi().getAuthorizationDetails(authorization_id);
      if (cancelled) return;
      if (res.error) {
        setError(res.error.message);
        return;
      }
      const immediate = res.data?.redirect_url ?? res.data?.redirect_to;
      if (immediate && !res.data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [authorization_id]);

  async function signIn() {
    setBusy(true);
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.href,
    });
    if (result.error) {
      setBusy(false);
      setError(result.error.message);
      return;
    }
    if (!("redirected" in result && result.redirected)) window.location.reload();
  }

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error: err } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  if (signedIn === null) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Shell>
    );
  }

  if (!signedIn) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold tracking-tight">Sign in to continue</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to your Roster Pulse account to approve this connection.
        </p>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <button
          onClick={() => void signIn()}
          disabled={busy}
          className="mt-6 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          Continue with Google
        </button>
      </Shell>
    );
  }

  const clientName = details?.client?.name ?? "an app";

  return (
    <Shell>
      <h1 className="text-xl font-semibold tracking-tight">
        Connect {clientName} to Roster Pulse
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This lets {clientName} read your roster, volunteers and serving history as you. It cannot
        change anything.
      </p>
      {email && (
        <p className="mt-4 text-xs text-muted-foreground">Signed in as {email}</p>
      )}
      {details?.scope && (
        <p className="mt-1 text-xs text-muted-foreground">Requested: {details.scope}</p>
      )}
      {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
      <div className="mt-6 flex gap-2">
        <button
          disabled={busy}
          onClick={() => void decide(true)}
          className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          Approve
        </button>
        <button
          disabled={busy}
          onClick={() => void decide(false)}
          className="flex-1 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-60"
        >
          Cancel connection
        </button>
      </div>
    </Shell>
  );
}
