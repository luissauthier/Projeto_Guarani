import React from 'react';
import { Tabs } from 'expo-router';
import { FontAwesome, Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#18641c', // A cor ativa (verde) terá bom contraste no branco
        tabBarInactiveTintColor: 'gray',   // A cor inativa (cinza) também funciona bem
        tabBarStyle: {
          backgroundColor: '#FFFFFF', // <-- COR DE FUNDO ALTERADA PARA BRANCO
          borderTopColor: '#E0E0E0',   // Cor da borda superior para um cinza claro, mais suave
        },
      }}
    >
      <Tabs.Screen
        // Aponta para o arquivo one.tsx
        name="one"
        options={{
          title: 'Treinos',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="football" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        // Aponta para o arquivo two.tsx
        name="two"
        options={{
          title: 'Administrativo',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <FontAwesome name="users" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}