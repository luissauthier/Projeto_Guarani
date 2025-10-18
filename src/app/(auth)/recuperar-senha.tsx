import React, { useState } from 'react';
import {
  SafeAreaView, ScrollView, Text, View,
  Pressable, StyleSheet, TextInput, Alert, ActivityIndicator
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase'; // Verifique se o caminho do supabase está correto

export default function RecuperarSenhaScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function handlePasswordReset() {
    if (loading) return;
    if (!email) {
      Alert.alert('Atenção', 'Por favor, digite seu e-mail.');
      return;
    }
    
    setLoading(true);
    try {
      // Esta é a função do Supabase
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        // Opcional: Redireciona o usuário de volta para o app após redefinir
        // redirectTo: 'exp://... seu-link-de-app' 
      });

      if (error) throw error;

      Alert.alert(
        'Verifique seu e-mail',
        'Se uma conta com este e-mail existir, um link para redefinição de senha foi enviado.'
      );
      router.back(); // Volta para a tela de login

    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="chevron-left" size={24} color="#FFF" />
          <Text style={styles.backButtonText}>Voltar</Text>
        </Pressable>

        <Text style={styles.title}>Recuperar Senha</Text>
        <Text style={styles.subtitle}>Digite seu e-mail para enviarmos um link de redefinição.</Text>

        <TextInput
          style={styles.input}
          placeholder="Seu e-mail"
          placeholderTextColor="#A0A0A0"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Pressable
          style={styles.button}
          onPress={handlePasswordReset}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.buttonText}>Enviar link</Text>
          )}
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

// Estilos baseados nos seus outros arquivos de (auth)
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A1931',
  },
  container: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 40,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 16,
    marginLeft: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 10,
    marginTop: 60,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 10,
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
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  }
});