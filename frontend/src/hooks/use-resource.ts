import { useCallback, useEffect, useRef, useState } from "react";
export function useResource<T>(key: string, loader: () => Promise<T>) {
  const latest = useRef(loader);
  useEffect(() => {
    latest.current = loader;
  });
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{
    data?: T;
    loading: boolean;
    error?: string;
  }>({ loading: true });
  useEffect(() => {
    let active = true;
    setState({ loading: true });
    latest
      .current()
      .then((data) => {
        if (active) setState({ data, loading: false });
      })
      .catch((error) => {
        if (active)
          setState({
            loading: false,
            error: error instanceof Error ? error.message : "Đã có lỗi xảy ra.",
          });
      });
    return () => {
      active = false;
    };
  }, [key, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}
