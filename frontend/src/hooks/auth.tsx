import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError } from '../services/api';
import type { User } from '../types';
interface Auth {
  user: User | null;
  loading: boolean;
  error: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}
const Context = createContext<Auth>(null!);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function refresh() {
    setLoading(true);
    setError('');
    try {
      setUser(await api<User>('/auth/me'));
    } catch (e) {
      setUser(null);
      if (!(e instanceof ApiError && e.status === 401))
        setError('Não foi possível acessar o servidor. Verifique a conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    const expire = () => setUser(null);
    window.addEventListener('session-expired', expire);
    return () => window.removeEventListener('session-expired', expire);
  }, []);
  return (
    <Context.Provider
      value={{
        user,
        loading,
        error,
        refresh,
        login: async (email, password) => {
          setUser(
            await api<User>('/auth/login', {
              method: 'POST',
              body: JSON.stringify({ email, password }),
            }),
          );
        },
        logout: async () => {
          try {
            await api('/auth/logout', { method: 'POST', body: '{}' });
          } catch (e) {
            if (!(e instanceof ApiError && e.status === 401)) throw e;
          }
          setUser(null);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
