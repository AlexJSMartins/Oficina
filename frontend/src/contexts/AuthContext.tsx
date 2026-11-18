import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api'
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('@oficina:token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface User {
  id: string;
  workshopId?: string;
  workshopName?: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'RECEPTIONIST' | 'MECHANIC';
  permissions: string[];
  commissionRate?: number;
}

interface RegisterWorkshopInput {
  workshopName: string;
  document?: string;
  phone?: string;
  adminName: string;
  email: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  registerWorkshop: (payload: RegisterWorkshopInput) => Promise<User>;
  logout: () => void;
  hasPermission: (perm: string) => boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('@oficina:user');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const token = localStorage.getItem('@oficina:token');
    if (token) {
      api.get('/auth/me')
        .then((res) => {
          setUser(res.data);
          localStorage.setItem('@oficina:user', JSON.stringify(res.data));
        })
        .catch(() => logout());
    }
  }, []);

  const registerWorkshop = async (payload: RegisterWorkshopInput) => {
    const { data } = await api.post('/auth/register', payload);
    localStorage.setItem('@oficina:token', data.accessToken);
    localStorage.setItem('@oficina:user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('@oficina:token', data.accessToken);
    localStorage.setItem('@oficina:user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('@oficina:token');
    localStorage.removeItem('@oficina:user');
    setUser(null);
  };

  const hasPermission = (perm: string) => {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    return user.permissions.includes(perm);
  };

  return (
    <AuthContext.Provider value={{ user, login, registerWorkshop, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);