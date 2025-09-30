// contexts/AuthContext.tsx
import { User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';

type Role = 'admin' | 'coach' | 'viewer';

interface AppUser extends User {
  type_user?: Role;
}

interface AuthContextProps {
  user: AppUser | null;
  role: Role;
  isAdmin: boolean;
  isCoach: boolean;
  setAuth: (authUser: AppUser | null) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext({} as AuthContextProps);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [role, setRole] = useState<Role>('viewer');

  async function fetchProfile(sessionUser: User) {
    const { data } = await supabase
      .from('users')
      .select('type_user')
      .eq('id', sessionUser.id)
      .single();

    const r = (data?.type_user as Role) ?? 'viewer';
    const appUser: AppUser = { ...sessionUser, type_user: r };
    setUser(appUser);
    setRole(r);

    // redirecionamento centralizado aqui
    router.replace('/(tabs)/one'); // admin e coach caem na aba de treinos por padrão
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await fetchProfile(session.user);
      } else {
        setUser(null);
        setRole('viewer');
        router.replace('/(auth)/signin');
      }
    });
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
    // o onAuthStateChange já redireciona para /signin
  }

  return (
    <AuthContext.Provider value={{ user, role, isAdmin, isCoach, setAuth, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
