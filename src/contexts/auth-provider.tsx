
"use client";

import type { User } from '@/types';
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { mockUser } from '@/lib/mock-data';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>; // Simplified login
  logout: () => Promise<void>;
  updateUser: (updatedInfo: Partial<User>) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate checking auth status on mount
    const checkAuth = async () => {
      setLoading(true);
      // Try to get user from localStorage or simulate a delay
      await new Promise(resolve => setTimeout(resolve, 500));
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      } else {
        // For demo purposes, automatically log in the mock user
        // In a real app, this would be null until actual login
        setUser(mockUser); 
        localStorage.setItem('currentUser', JSON.stringify(mockUser));
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    // In a real app, validate credentials and fetch user data
    if (email === mockUser.email && pass === "password") { // Dummy validation
      setUser(mockUser);
      localStorage.setItem('currentUser', JSON.stringify(mockUser));
    } else {
      // Handle login failure
      console.error("Login failed");
      throw new Error("Invalid credentials");
    }
    setLoading(false);
  };

  const logout = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    setUser(null);
    localStorage.removeItem('currentUser');
    setLoading(false);
  };
  
  const updateUser = async (updatedInfo: Partial<User>) => {
    if (user) {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
      const newUser = { ...user, ...updatedInfo };
      setUser(newUser);
      localStorage.setItem('currentUser', JSON.stringify(newUser));
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
