import { User, UserRole, LoginCredentials, ApiResponse } from '@/@types';

// Mock users for demonstration - in production, this would call a real API
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

/**
 * Authenticate user with credentials
 * In production, this would make an API call to the backend
 */
export async function loginUser(
  role: UserRole,
  credentials: LoginCredentials
): Promise<ApiResponse<User>> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  if (credentials.email && credentials.password) {
    return {
      success: true,
      data: mockUsers[role],
    };
  }

  return {
    success: false,
    error: 'Invalid credentials',
  };
}

/**
 * Log out the current user
 */
export async function logoutUser(): Promise<ApiResponse<null>> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 200));

  return {
    success: true,
  };
}

/**
 * Get the current authenticated user
 */
export async function getCurrentUser(): Promise<ApiResponse<User | null>> {
  // In production, this would check the session/token
  return {
    success: true,
    data: null,
  };
}
