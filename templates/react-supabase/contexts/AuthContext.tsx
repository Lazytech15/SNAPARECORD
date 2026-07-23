// EDIT ME: shape `user` to match what your `requests` in authDataClient.ts
// actually return.
//
// Same public interface (`user`, `loading`, `login`, `logout`, `refresh`) as
// the PHP template's AuthContext — only login()/logout() change, since
// those are the only two places that are inherently backend-specific.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "snaparecord";
import { supabase } from "../api/supabaseClient";
import { authGetClient } from "../api/authDataClient";

interface AuthContextValue {
  user: Record<string, unknown> | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // guards React StrictMode's double-invoke in dev
    started.current = true;

    // Supabase persists its own session, so on a page refresh there may
    // already be one — getSession() (not getUser()) resolves from local
    // storage without a network round-trip.
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setLoading(false);
        return;
      }
      authGetClient
        .getData()
        .then(({ data }) => setUser(data))
        .catch(() => setUser(null))
        .finally(() => setLoading(false));

      authGetClient.startPolling();
    });

    // Keep `user` in sync with Supabase's own auth events too — covers
    // sign-out from another tab, or a session expiring mid-session.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        authGetClient.destroy();
        setUser(null);
      }
    });

    return () => {
      authGetClient.stopPolling();
      sub.subscription.unsubscribe();
    };
  }, []);

  async function login(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const { data } = await authGetClient.getData({ force: true });
    setUser(data);
    authGetClient.startPolling();
    toast.success("Logged in");
  }

  async function logout() {
    await supabase.auth.signOut();
    authGetClient.destroy(); // stops polling + clears the signed cache
    setUser(null);
  }

  async function refresh() {
    const { data } = await authGetClient.getData({ force: true });
    setUser(data);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
