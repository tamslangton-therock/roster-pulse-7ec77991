// The signed-in leader's permissions, refreshed from the latest User_Access
// data so changes apply without signing out (session copy is the fallback).
import { useMemo } from "react";
import { useAuth } from "./auth";
import { useRoster } from "./store";
import { recordFromTabValues, toSessionUser, type SessionUser } from "./user-access";

export function useLiveUser(): SessionUser | null {
  const user = useAuth((s) => s.user);
  const rows = useRoster((s) => s.userAccess);
  return useMemo(() => {
    if (!user) return null;
    const row = rows.find(
      (r) => (r.username ?? "").trim().toLowerCase() === user.username.trim().toLowerCase(),
    );
    return row ? toSessionUser(recordFromTabValues(row)) : user;
  }, [user, rows]);
}
