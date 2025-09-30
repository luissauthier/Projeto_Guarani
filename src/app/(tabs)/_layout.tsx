import { Tabs } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import React from 'react';

export default function TabsLayout() {
  const { isAdmin } = useAuth();

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="treinos"
        options={{ title: 'Treinos' }}
      />
      {isAdmin && (
        <Tabs.Screen
          name="admin"
          options={{ title: 'Administrativo' }}
        />
      )}
    </Tabs>
  );
}
