import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';

export function AppHeader() {
  const router = useRouter();
  const { user, setAuth } = useAuth();

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    setAuth(null);
    if (!error) router.replace('/(auth)/signin');
  }

  return (
    <View style={styles.header}>
      <Text style={styles.logo}>Projeto Guarani</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {user ? (
          <>
            <TouchableOpacity style={styles.actionBtn} onPress={handleSignOut}>
              <Feather name="log-out" size={18} color="#fff" />
              <Text style={styles.actionTxt}>Sair</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection:'row', justifyContent:'space-between', alignItems:'center',
    paddingVertical: 16, paddingHorizontal: 16, backgroundColor:'#0A1931',
    borderBottomWidth: 1, borderBottomColor: '#203A4A'
  },
  logo: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  actionBtn: { backgroundColor:'#18641c', paddingVertical:8, paddingHorizontal:12, borderRadius:10, flexDirection:'row', alignItems:'center' },
  actionTxt: { color:'#fff', marginLeft:6, fontWeight:'600' },
});
