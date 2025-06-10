
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
  toggleTopicStudyStatus: (compositeTopicId: string) => Promise<void>;
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
          studiedTopicIds: parsedUser.studiedTopicIds || [],
        });
      } else {
        const initialUser = {
            ...mockUser,
            registeredCargoIds: mockUser.registeredCargoIds || [], 
            studiedTopicIds: mockUser.studiedTopicIds || [],
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
    // Simulate login by checking against mockUser details
    // In a real app, this would involve an API call
    if (email === mockUser.email && pass === "password") { // Using mockUser.email for the check
      const loggedInUser = {
          ...mockUser, // Use mockUser as the base for a logged-in session
          // Preserve existing registrations and study progress if any, or use mockUser's defaults
          registeredCargoIds: user?.registeredCargoIds || mockUser.registeredCargoIds || [], 
          studiedTopicIds: user?.studiedTopicIds || mockUser.studiedTopicIds || [],
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
      const newUser = { 
        ...user, 
        ...updatedInfo,
        // Ensure arrays are preserved or initialized
        registeredCargoIds: updatedInfo.registeredCargoIds || user.registeredCargoIds || [],
        studiedTopicIds: updatedInfo.studiedTopicIds || user.studiedTopicIds || [],
      };
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

  const toggleTopicStudyStatus = async (compositeTopicId: string) => {
    if (user) {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 100)); // Shorter delay for quicker UI update
      let studiedTopicIds = [...(user.studiedTopicIds || [])];
      const topicIndex = studiedTopicIds.indexOf(compositeTopicId);

      if (topicIndex > -1) {
        studiedTopicIds.splice(topicIndex, 1); // Unmark as studied
      } else {
        studiedTopicIds.push(compositeTopicId); // Mark as studied
      }
      
      const updatedUser = { ...user, studiedTopicIds };
      setUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, registerForCargo, unregisterFromCargo, toggleTopicStudyStatus }}>
      {children}
    </AuthContext.Provider>
  );
};
