import { useAuth } from '@/hooks/useAuth';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { UserRole } from '@/@types';

export function useEffectiveRole() {
  const { user: mvpUser, isAuthenticated } = useAuth();
  const { user: supabaseUser, roles, isLoading } = useSupabaseAuth();

  // Fallback to `student` for Supabase-authenticated users when role rows are missing.
  // This prevents newly confirmed users from being blocked by strict role-table setup.
  const inferredRole = supabaseUser && roles.length === 0 ? 'student' : null;
  const effectiveRole = (mvpUser?.role ?? roles[0] ?? inferredRole ?? null) as UserRole | null;
  const isEffectiveAuthenticated = isAuthenticated || !!supabaseUser;

  return { effectiveRole, isEffectiveAuthenticated, isLoading };
}
