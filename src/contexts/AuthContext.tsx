import { User } from '@supabase/supabase-js';
import React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';

// Estenda a interface User para incluir is_admin
interface AppUser extends User {
  is_admin?: boolean; // Adicionamos a propriedade is_admin
}

interface AuthContextProps {
  user: AppUser | null; // Usamos AppUser aqui
  isAdmin: boolean; // Adicionamos isAdmin para fácil acesso
  setAuth: (authUser: AppUser | null) => void;
}

const AuthContext = createContext({} as AuthContextProps);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchUserAndProfile = async (sessionUser: User) => {
      // Busca o perfil do usuário na sua tabela 'users'
      const { data, error } = await supabase
        .from('users') // Nome da sua tabela de usuários
        .select('is_admin')
        .eq('id', sessionUser.id)
        .single();

      if (error) {
        console.error('Erro ao buscar perfil do usuário:', error.message);
        // Se houver um erro, trate como não admin por segurança
        setUser({ ...sessionUser, is_admin: false });
        setIsAdmin(false);
      } else if (data) {
        const appUser: AppUser = { ...sessionUser, is_admin: data.is_admin };
        setUser(appUser);
        setIsAdmin(data.is_admin || false); // Garante que seja boolean
      } else {
        // Usuário sem entrada na tabela 'users' (ou sem is_admin), trate como não admin
        setUser({ ...sessionUser, is_admin: false });
        setIsAdmin(false);
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        await fetchUserAndProfile(session.user);
        router.replace('/(tabs)/one');
        return;
      }
      setUser(null);
      setIsAdmin(false);
      router.replace('/(auth)/signin');
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const setAuth = (authUser: AppUser | null) => {
    setUser(authUser);
    setIsAdmin(authUser?.is_admin || false);
  };

  return <AuthContext.Provider value={{ user, isAdmin, setAuth }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);