// app/(auth)/nova-senha.tsx

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase'; // Ajuste o caminho se necessário
import { router } from 'expo-router';

export default function NovaSenhaScreen() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Esta função só funcionará se o usuário
  // já estiver em uma sessão de "recuperação de senha"
  const handleUpdatePassword = async () => {
    if (loading) return;
    if (!password) {
      Alert.alert('Atenção', 'Por favor, digite uma nova senha.');
      return;
    }

    setLoading(true);
    
    // 1. Atualiza a senha do usuário logado (em modo de recuperação)
    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      Alert.alert('Erro', error.message);
      setLoading(false);
      return;
    }
    
    // 2. Desloga o usuário da sessão de recuperação
    await supabase.auth.signOut();

    setLoading(false);
    Alert.alert(
      'Sucesso!', 
      'Sua senha foi alterada. Por favor, faça o login com sua nova senha.'
    );
    router.replace('/(auth)/signin'); // Manda de volta para o login
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Crie uma Nova Senha</Text>
        <TextInput
          style={styles.input}
          placeholder="Digite sua nova senha"
          placeholderTextColor="#A0A0A0"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
        />
        <Pressable style={styles.button} onPress={handleUpdatePassword} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.buttonText}>Salvar Nova Senha</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// Estilos baseados na sua tela de signin.tsx
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A1931',
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 40,
  },
  input: {
    width: '100%',
    height: 55,
    backgroundColor: '#1E2F47',
    borderRadius: 12,
    paddingHorizontal: 20,
    color: '#FFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#3c7997',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#ffffff',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  }
});