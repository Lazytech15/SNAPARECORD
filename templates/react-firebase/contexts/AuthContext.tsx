// EDIT ME: shape `user` to match what your `requests` in authDataClient.ts
// actually return.
//
// Same public interface (`user`, `loading`, `login`, `logout`, `refresh`) as
// the PHP template's AuthContext — only login()/logout() change, since
// those are the only two places that are inherently backend-specific.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "snaparecord";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../api/firebaseClient";
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

    // Firebase resolves the persisted session asynchronously on load —
    // onAuthStateChanged's first call tells us whether one exists.
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        authGetClient.destroy();
        setUser(null);
        setLoading(false);
        return;
      }
      authGetClient
        .getData({ force: true })
        .then(({ data }) => setUser(data))
        .catch(() => setUser(null))
        .finally(() => setLoading(false));

      authGetClient.startPolling();
    });

    return () => {
      authGetClient.stopPolling();
      unsubscribe();
    };
  }, []);

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
    // The onAuthStateChanged listener above will fire and populate `user` —
    // no need to duplicate that logic here. Just confirm success to the UI.
    toast.success("Logged in");
  }

  async function logout() {
    await signOut(auth);
    // onAuthStateChanged above handles destroy()/setUser(null).
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
