
"use client";

import type { User } from '@/types';
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { mockUser } from '@/lib/mock-data';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updatedInfo: Partial<User>) => Promise<void>;
  registerForEdital: (editalId: string) => Promise<void>;
  unregisterFromEdital: (editalId: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser({
          ...parsedUser,
          registeredEditalIds: parsedUser.registeredEditalIds || [], // Ensure array exists
        });
      } else {
        // For demo, auto-login mock user with initial registered edital
        const initialUser = {
            ...mockUser,
            registeredEditalIds: mockUser.registeredEditalIds || ['edital1'], 
        };
        setUser(initialUser); 
        localStorage.setItem('currentUser', JSON.stringify(initialUser));
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (email === mockUser.email && pass === "password") {
      const loggedInUser = {
          ...mockUser,
          // Preserve registrations if any, or use default from mockUser
          registeredEditalIds: user?.registeredEditalIds || mockUser.registeredEditalIds || [], 
      };
      setUser(loggedInUser);
      localStorage.setItem('currentUser', JSON.stringify(loggedInUser));
    } else {
      console.error("Login failed");
      throw new Error("Invalid credentials");
    }
    setLoading(false);
  };

  const logout = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setUser(null);
    localStorage.removeItem('currentUser');
    setLoading(false);
  };
  
  const updateUser = async (updatedInfo: Partial<User>) => {
    if (user) {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 500)); 
      const newUser = { ...user, ...updatedInfo };
      setUser(newUser);
      localStorage.setItem('currentUser', JSON.stringify(newUser));
      setLoading(false);
    }
  };

  const registerForEdital = async (editalId: string) => {
    if (user) {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 300)); // Simulate API call
      const registeredEditalIds = [...(user.registeredEditalIds || [])];
      if (!registeredEditalIds.includes(editalId)) {
        registeredEditalIds.push(editalId);
      }
      const updatedUser = { ...user, registeredEditalIds };
      setUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      setLoading(false);
    }
  };

  const unregisterFromEdital = async (editalId: string) => {
    if (user) {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 300)); // Simulate API call
      const registeredEditalIds = (user.registeredEditalIds || []).filter(id => id !== editalId);
      const updatedUser = { ...user, registeredEditalIds };
      setUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, registerForEdital, unregisterFromEdital }}>
      {children}
    </AuthContext.Provider>
  );
};
