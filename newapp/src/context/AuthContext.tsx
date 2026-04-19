import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authMe, login as apiLogin, logout as apiLogout } from "../lib/api";
import type { AppUser } from "../types";

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  refreshUser: async () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const result = await authMe();
      setUser(result.authenticated && result.user ? result.user : null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser().catch(() => {
      setUser(null);
      setLoading(false);
    });
  }, []);

  const login = async (username: string, password: string) => {
    const nextUser = await apiLogin(username, password);
    setUser(nextUser);
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
  };

  const value = useMemo(() => ({
    user,
    loading,
    login,
    logout,
    refreshUser
  }), [user, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
