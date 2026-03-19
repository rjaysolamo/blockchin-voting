import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  student_id: string | null;
  department: string | null;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: string[];
  loading: boolean;
  signUp: (email: string, password: string, metadata?: Record<string, string>) => Promise<{ error: AuthError | null; user: User | null; session: Session | null; emailConfirmationSent: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

const AUTH_FETCH_TIMEOUT_MS = 8000;

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    setProfile(data as Profile | null);
  }, []);

  const fetchRoles = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    
    setRoles(data?.map(r => r.role) || []);
  }, []);

  const ensureCurrentUserBootstrap = useCallback(async () => {
    try {
      const { error } = await supabase.rpc('ensure_current_user_bootstrap' as never);
      if (error) {
        console.error('Failed to ensure current user bootstrap:', error);
      }
    } catch (error) {
      console.error('Bootstrap RPC failed:', error);
    }
  }, []);

  const hydrateUserContext = useCallback(async (userId: string) => {
    await Promise.allSettled([
      withTimeout(ensureCurrentUserBootstrap(), AUTH_FETCH_TIMEOUT_MS, 'Bootstrap timed out'),
      withTimeout(fetchProfile(userId), AUTH_FETCH_TIMEOUT_MS, 'Profile fetch timed out'),
      withTimeout(fetchRoles(userId), AUTH_FETCH_TIMEOUT_MS, 'Role fetch timed out'),
    ]);
  }, [ensureCurrentUserBootstrap, fetchProfile, fetchRoles]);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          void hydrateUserContext(session.user.id);
        } else {
          setProfile(null);
          setRoles([]);
        }
      })
      .catch((error) => {
        console.error('Failed to initialize auth session:', error);
        setSession(null);
        setUser(null);
        setProfile(null);
        setRoles([]);
      })
      .finally(() => {
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setLoading(true);
        try {
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            await hydrateUserContext(session.user.id);
          } else {
            setProfile(null);
            setRoles([]);
          }
        } catch (error) {
          console.error('Auth state change handling failed:', error);
          setProfile(null);
          setRoles([]);
        } finally {
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [hydrateUserContext]);

  const signUp = async (email: string, password: string, metadata?: Record<string, string>) => {
    const normalizedEmail = email.trim().toLowerCase();
    const emailRedirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/student/login`
      : undefined;

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: metadata,
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
      },
    });
    const session = data.session ?? null;
    const user = data.user ?? session?.user ?? null;
    const emailConfirmationSent = !!user && !session;
    return { error, user, session, emailConfirmationSent };
  };

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const isGmail = normalizedEmail.endsWith('@gmail.com');

    if (!isGmail) {
      return {
        error: new Error('Please connect using your registered Gmail account.'),
      };
    }

    const { data: isRegisteredEmail, error: registrationCheckError } = await supabase.rpc(
      'is_registered_email' as never,
      { p_email: normalizedEmail } as never
    );

    if (!registrationCheckError && isRegisteredEmail === false) {
      return {
        error: new Error('This Gmail account is not registered yet. Please register first.'),
      };
    }

    const { data, error } = await withTimeout(
      supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      }),
      15000,
      'Sign-in request timed out. Please check your network and try again.'
    );

    if (!error && data?.session?.user) {
      setSession(data.session);
      setUser(data.session.user);
      await hydrateUserContext(data.session.user.id);
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  };

  const hasRole = (role: string) => roles.includes(role);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      roles,
      loading,
      signUp,
      signIn,
      signOut,
      hasRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useSupabaseAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider');
  }
  return context;
};
