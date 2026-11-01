import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AuthContext,type AuthState,type AuthValue } from './context';
import { ApiClient, ApiError } from "../../services/api";
import { demoSession } from "../../services/demo";
const storageKey = "tenselab-session-v1";
function restored(): AuthState {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    return saved &&
      typeof saved.token === "string" &&
      ["student", "teacher", "admin"].includes(saved.session?.role) &&
      typeof saved.session?.actorId === "string"
      ? saved
      : { session: null, token: "" };
  } catch {
    return { session: null, token: "" };
  }
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(restored);
  const save = (next: AuthState) => {
    sessionStorage.setItem(storageKey, JSON.stringify(next));
    setState(next);
  };
  const api = useMemo(
    () => new ApiClient(state.token, Boolean(state.session?.demo)),
    [state.token, state.session?.demo],
  );
  useEffect(() => {
    if (!state.token || state.session?.demo) return;
    let active = true;
    new ApiClient(state.token)
      .session()
      .then((session) => {
        if (active) setState((current) => ({ ...current, session }));
      })
      .catch((error) => {
        if (active && error instanceof ApiError && error.status === 401) {
          sessionStorage.removeItem(storageKey);
          setState({ session: null, token: "" });
        }
      });
    return () => {
      active = false;
    };
  }, [state.token, state.session?.demo]);
  const value: AuthValue = {
    ...state,
    api,
    login: async (token) => {
      const session = await new ApiClient(token).session();
      save({ session, token });
      return session;
    },
    demo: (role) => save({ session: demoSession(role), token: "" }),
    logout: () => {
      sessionStorage.removeItem(storageKey);
      sessionStorage.removeItem("tenselab-last-result");
      setState({ session: null, token: "" });
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
