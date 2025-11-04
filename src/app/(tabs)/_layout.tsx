import React from 'react';
import { Tabs } from 'expo-router';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/contexts/AuthContext';
import { AppHeader } from '@/components/AppHeader';

export default function TabLayout() {
  const { authReady, isAdmin } = useAuth();

  if (!authReady) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        header: () => <AppHeader />,
        tabBarActiveTintColor: '#18641c',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E0E0E0',
        },
      }}
    >
      <Tabs.Screen
        name="one"
        options={{
          title: 'Treinos',
          tabBarIcon: ({ color }) => <Ionicons name="football" size={28} color={color} />,
        }}
      />

      {/* Mantém registrada, mas esconde para não-admin */}
      <Tabs.Screen
        name="two"
        options={{
          title: 'Administrativo',
          // quando não for admin, remove da Tab bar e do deep-linking
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color }) => <FontAwesome name="users" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
