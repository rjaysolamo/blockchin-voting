import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, UserRole, LoginCredentials } from '@/@types';

interface AuthContextType {
  user: User | null;
  login: (role: UserRole, credentials: LoginCredentials) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users for demonstration
const mockUsers: Record<UserRole, User> = {
  admin: {
    id: '1',
    name: 'Admin User',
    email: 'admin@university.edu',
    role: 'admin',
  },
  student: {
    id: '2',
    name: 'John Smith',
    email: 'john.smith@student.edu',
    role: 'student',
    studentId: 'STU2026001',
    hasVoted: false,
  },
  candidate: {
    id: '3',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@student.edu',
    role: 'candidate',
    studentId: 'STU2026002',
  },
  staff: {
    id: '4',
    name: 'Staff Member',
    email: 'staff@university.edu',
    role: 'staff',
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = (role: UserRole, credentials: LoginCredentials) => {
    if (credentials.email && credentials.password) {
      setUser(mockUsers[role]);
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
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
