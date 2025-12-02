import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function AppHeader() {
  const router = useRouter();
  const { user, setAuth } = useAuth();
  const insets = useSafeAreaInsets();

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    setAuth(null);
    if (!error) router.replace('/(auth)/signin');
  }

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + 8, // joga abaixo do notch/statusbar
        },
      ]}
    >
      <Text style={styles.logo}>Projeto Guarani</Text>

      {user ? (
        <TouchableOpacity style={styles.actionBtn} onPress={handleSignOut}>
          <Feather name="log-out" size={18} color="#fff" />
          <Text style={styles.actionTxt}>Sair</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent:'space-between',
    alignItems:'center',
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor:'#0A1931',
    borderBottomWidth: 1,
    borderBottomColor: '#203A4A',
  },
  logo: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  actionBtn: {
    backgroundColor:'#18641c',
    paddingVertical:8,
    paddingHorizontal:12,
    borderRadius:10,
    flexDirection:'row',
    alignItems:'center'
  },
  actionTxt: { color:'#fff', marginLeft:6, fontWeight:'600' },
});
