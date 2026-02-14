import { useAuth } from '@/hooks/useAuth';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { UserRole } from '@/@types';

export function useEffectiveRole() {
  const { user: mvpUser, isAuthenticated } = useAuth();
  const { user: supabaseUser, roles, isLoading } = useSupabaseAuth();

  const effectiveRole = (mvpUser?.role ?? roles[0] ?? null) as UserRole | null;
  const isEffectiveAuthenticated = isAuthenticated || !!supabaseUser;

  return { effectiveRole, isEffectiveAuthenticated, isLoading };
}
