import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, Tabs } from 'expo-router';
import { Pressable } from 'react-native';

import Colors from "../../../constants/Colors";
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useAuth } from '@/src/contexts/AuthContext';
import { constants } from 'buffer';

function TabBarIcon(props: {
 name: React.ComponentProps<typeof FontAwesome>['name'];
 color: string;
}) {
 return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
 const colorScheme = useColorScheme();
 const { isAdmin } = useAuth();

 return (
  <Tabs
     screenOptions={{
         tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        // Remova ou defina headerShown para false aqui para todas as telas
         headerShown: false, // <-- Adicione/modifique esta linha
        // Adicione estas opções para controlar a visibilidade da tab bar para a rota 'two'
         tabBarStyle: isAdmin ? undefined : { display: 'none' },
    }}>
        <Tabs.Screen
            name="one"
            options={{
            title: 'Aluguéis',
            tabBarIcon: ({ color }) => <TabBarIcon name="info" color={color} />,
            // Remova headerRight se você não quer o botão de info-circle na tela 'one'
             headerRight: () => (
             <Link href="/modal" asChild>
             <Pressable>
                 {({ pressed }) => (
                    <FontAwesome
                    name="info-circle"
                    size={25}
                    color={Colors[colorScheme ?? 'light'].text}
                    style={{ marginRight: 15, opacity: pressed ? 0.5 : 1 }}
                 />
                 )}
             </Pressable>
             </Link>
             ),
         }}
        />
     <Tabs.Screen
        name="two"
        options={{
        title: 'Carros',
        tabBarIcon: ({ color }) => <TabBarIcon name="car" color={color} />,
        href: isAdmin ? '/(tabs)/two' : null,
        }}
    />
    </Tabs>
 );
}