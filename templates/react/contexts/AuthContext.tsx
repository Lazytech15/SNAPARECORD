// EDIT ME: shape `user`/AuthContextValue to match what your `requests` in
// authDataClient.ts actually return, and adjust login()'s request/response
// shape to match your backend.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "snaparecord";
import { authApi } from "../api/authApi";
import { authGetClient } from "../api/authDataClient";
import { sessionToken } from "../api/sessionToken";

interface AuthContextValue {
  user: Record<string, unknown> | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
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

    if (!sessionToken.get()) {
      setLoading(false);
      return;
    }

    authGetClient
      .getData()
      .then(({ data }) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));

    authGetClient.startPolling();
    return () => authGetClient.stopPolling();
  }, []);

  async function login(email: string, password: string) {
    // EDIT ME: match your backend's actual login response shape
    const res = await authApi.post<{ token: string }>("/login", { email, password });
    sessionToken.set(res.token);

    const { data } = await authGetClient.getData({ force: true });
    setUser(data);
    toast.success("Logged in");
  }

  function logout() {
    sessionToken.clear();
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
