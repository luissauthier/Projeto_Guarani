import { User } from '@supabase/supabase-js';
import React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';

type Role = 'admin' | 'coach' | 'viewer';

interface AppUser extends User {
  type_user?: Role;
}

interface AuthContextProps {
  user: AppUser | null;
  isAdmin: boolean;
  setAuth: (authUser: AppUser | null) => void;
}

const AuthContext = createContext({} as AuthContextProps);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  async function fetchProfile(sessionUser: User) {
    const { data, error } = await supabase
      .from('users')
      .select('type_user')
      .eq('id', sessionUser.id)
      .single();

    if (error || !data) {
      // fallback seguro
      const appUser: AppUser = { ...sessionUser, type_user: 'viewer' };
      setUser(appUser);
      setIsAdmin(false);
      return;
    }

    const appUser: AppUser = { ...sessionUser, type_user: data.type_user as Role };
    setUser(appUser);
    setIsAdmin(data.type_user === 'admin');
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await fetchProfile(session.user);
        router.replace('/(tabs)/one');
      } else {
        setUser(null);
        setIsAdmin(false);
        router.replace('/(auth)/signin');
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const setAuth = (authUser: AppUser | null) => {
    setUser(authUser);
    setIsAdmin(authUser?.type_user === 'admin');
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, setAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
