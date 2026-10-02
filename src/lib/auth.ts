// Signed-in session for The Rock Church. `master` = full admin (access code);
// `user` = a team leader with per-area permissions.
import { create } from "zustand";
import { loginTeamUser } from "./auth.functions";
import type { SessionUser } from "./user-access";

const SESSION_KEY = "roster-pulse-session";

interface AuthState {
  master: boolean;
  user: SessionUser | null;
  /** Session read from sessionStorage is done (client only). */
  hydrated: boolean;

  hydrate: () => void;
  loginMaster: (code: string, masterPasscode: string) => boolean;
  loginUser: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  lock: () => void;
}

function persist(master: boolean, user: SessionUser | null) {
  if (typeof window === "undefined") return;
  if (!master && !user) window.sessionStorage.removeItem(SESSION_KEY);
  else window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ master, user }));
}

export const useAuth = create<AuthState>()((set) => ({
  master: false,
  user: null,
  hydrated: false,

  hydrate: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { master?: boolean; user?: SessionUser | null };
        set({ master: !!parsed.master, user: parsed.user ?? null, hydrated: true });
        return;
      }
    } catch {
      // corrupted session — ignore
    }
    set({ hydrated: true });
  },

  loginMaster: (code, masterPasscode) => {
    if (code !== masterPasscode) return false;
    set({ master: true, user: null });
    persist(true, null);
    return true;
  },

  loginUser: async (username, password) => {
    const res = await loginTeamUser({ data: { username, password } });
    if (!res.ok) return { ok: false, error: res.error };
    set({ master: false, user: res.user });
    persist(false, res.user);
    return { ok: true };
  },

  lock: () => {
    set({ master: false, user: null });
    persist(false, null);
  },
}));
