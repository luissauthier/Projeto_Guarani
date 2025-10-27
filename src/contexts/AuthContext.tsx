// contexts/AuthContext.tsx
import { User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';
import { Alert } from 'react-native';
type Role = 'admin' | 'coach' | 'viewer';

interface AppUser extends User { type_user?: Role; }

interface AuthContextProps {
  user: AppUser | null;
  role: Role;
  isAdmin: boolean;
  isCoach: boolean;
  authReady: boolean;
  setAuth: (authUser: AppUser | null) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;  // <<< novo
}

const AuthContext = createContext({} as AuthContextProps);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser]   = useState<AppUser | null>(null);
  const [role, setRole]   = useState<Role>('viewer');
  const [authReady, setAuthReady] = useState(false);

  async function fetchProfile(sessionUser: User) {
    console.log('[Auth] fetchProfile for uid:', sessionUser.id, 'email:', sessionUser.email);
    const { data, error } = await supabase
      .from('users')
      .select('type_user, ativo')
      .eq('id', sessionUser.id)
      .maybeSingle();

    if (error) console.log('[Auth] fetchProfile error:', error);
    console.log('[Auth] users row:', data);

    const r = (data?.type_user as Role) ?? 'viewer';
    console.log('[Auth] resolved role:', r);

    const appUser: AppUser = { ...sessionUser, type_user: r };
    setUser(appUser);
    setRole(r);

    // destino padrão (se já não estiver nele)
    try { router.replace('/(tabs)/one'); } catch {}
  }

  // exposto pra gente forçar um reload
  async function refreshProfile() {
    const { data } = await supabase.auth.getSession();
    const sUser = data.session?.user;
    if (sUser) await fetchProfile(sUser);
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (ev, session) => {
      console.log('[Auth] onAuthStateChange:', ev, 'uid:', session?.user?.id);
      if (session?.user) {
        await fetchProfile(session.user);
        setAuthReady(true);
      } else {
        setUser(null);
        setRole('viewer');
        setAuthReady(true);
        router.replace('/(auth)/signin');
      }
    });

    // bootstrap em refresh
    (async () => {
      const { data } = await supabase.auth.getSession();
      const sUser = data.session?.user;
      if (sUser) await fetchProfile(sUser);
      setAuthReady(true);
    })();

    return () => sub.subscription.unsubscribe();
  }, []);

  const setAuth = (authUser: AppUser | null) => {
    setUser(authUser);
    setRole(authUser?.type_user ?? 'viewer');
  };

  const isAdmin = role === 'admin';
  const isCoach = role === 'coach';

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{ user, role, isAdmin, isCoach, authReady, setAuth, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
