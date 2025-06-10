
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
  registerForCargo: (editalId: string, cargoId: string) => Promise<void>;
  unregisterFromCargo: (editalId: string, cargoId: string) => Promise<void>;
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
          registeredCargoIds: parsedUser.registeredCargoIds || [], 
        });
      } else {
        const initialUser = {
            ...mockUser,
            registeredCargoIds: mockUser.registeredCargoIds || [], 
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
          registeredCargoIds: user?.registeredCargoIds || mockUser.registeredCargoIds || [], 
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

  const registerForCargo = async (editalId: string, cargoId: string) => {
    if (user) {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 300)); 
      const compositeId = `${editalId}_${cargoId}`;
      const registeredCargoIds = [...(user.registeredCargoIds || [])];
      if (!registeredCargoIds.includes(compositeId)) {
        registeredCargoIds.push(compositeId);
      }
      const updatedUser = { ...user, registeredCargoIds };
      setUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      setLoading(false);
    }
  };

  const unregisterFromCargo = async (editalId: string, cargoId: string) => {
    if (user) {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 300)); 
      const compositeId = `${editalId}_${cargoId}`;
      const registeredCargoIds = (user.registeredCargoIds || []).filter(id => id !== compositeId);
      const updatedUser = { ...user, registeredCargoIds };
      setUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, registerForCargo, unregisterFromCargo }}>
      {children}
    </AuthContext.Provider>
  );
};
