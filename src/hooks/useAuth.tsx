import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, UserRole, LoginCredentials } from '@/@types';
import { loginUser, logoutUser, getCurrentUser } from '@/api/auth';

interface AuthContextType {
  user: User | null;
  login: (role: UserRole, credentials: LoginCredentials) => Promise<boolean>;
  loginWithWallet: (role: UserRole, walletAddress: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = async (role: UserRole, credentials: LoginCredentials): Promise<boolean> => {
    try {
      const result = await loginUser(role, credentials);
      if (result.success && result.data) {
        setUser(result.data);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const loginWithWallet = async (role: UserRole, walletAddress: string): Promise<boolean> => {
    const normalizedAddress = walletAddress.trim().toLowerCase();
    if (!normalizedAddress) return false;

    setUser({
      id: normalizedAddress,
      email: `${normalizedAddress}@wallet.local`,
      name: 'Contract Admin',
      role,
    });

    return true;
  };

  const logout = async (): Promise<void> => {
    try {
      await logoutUser();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, loginWithWallet, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
