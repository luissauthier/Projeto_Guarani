import { View, Text, StyleSheet, Pressable, TextInput, SafeAreaView, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000); // 5 segundos

      // Limpa o timer se o componente for desmontado ou a notificação mudar
      return () => clearTimeout(timer);
    }
  }, [notification]);

  async function handleSignIn() {
    setLoading(true);
    setNotification(null); // Limpa notificações antigas

    if (!email.trim() || !password.trim()) {
      setNotification('E-mail ou senha inválidos.');
      setLoading(false);
      return; // Interrompe a função aqui
    }

    try {
      // 1. Tenta fazer o login
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      
      if (signInError) {
        // Se houver um erro, ele será capturado aqui
        throw signInError;
      }

      // Se NÃO houver erro, o login foi um sucesso E o usuário está ativo.
      // O AuthContext vai assumir e redirecionar (não precisamos fazer mais nada).

    } catch (e: any) {
      console.error('[handleSignIn] Erro:', e.message);
      
      // 2. Verifica o erro genérico (que sabemos ser o "usuário inativo")
      if (e.message.includes('Database error granting user')) { // <-- MUDANÇA AQUI
        setNotification('Usuário inativo. Entre em contato com um administrador.');
      
      // 3. Verifica erros de login normais
      } else if (e.message.includes('Invalid login credentials')) {
        setNotification('E-mail ou senha inválidos.');
      
      // 4. Outros erros
      } else {
        // Se for outro erro, mostramos a mensagem que vier
        setNotification(e.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.logoText}>Projeto Guarani</Text>

            <Link href="/(auth)/signup" asChild>
              <Pressable style={styles.inscricaoButton}>
                <Text style={styles.inscricaoButtonText}>Inscrição</Text>
              </Pressable>
            </Link>
          </View>
          {notification && (
            <View style={styles.notificationBanner}>
              <Text style={styles.notificationText}>{notification}</Text>
              <Pressable onPress={() => setNotification(null)} style={{ padding: 5 }}>
                <Feather name="x" size={20} color="#8B0000" />
              </Pressable>
            </View>
          )}

          <View style={styles.formContainer}>
            <TextInput
              style={styles.input}
              placeholder="Seu email"
              placeholderTextColor="#A0A0A0"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Sua senha"
              placeholderTextColor="#A0A0A0"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              onPress={handleSignIn}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>Acessar</Text>}
            </Pressable>
          </View>
          <Link href="/recuperar-senha" asChild>
            <Pressable style={styles.forgotPasswordLink}>
              <Text style={styles.forgotPasswordText}>Esqueceu a senha?</Text>
            </Pressable>
          </Link>

          <Link href="/apoio" asChild>
            <Pressable style={styles.apoioButton}>
              <Text style={styles.apoioButtonText}>Apoiar este projeto</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#18641c', // Cor de fundo principal: Verde escuro
    },
    scrollViewContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingVertical: 40,
    },
    container: {
        flex: 1,
        paddingHorizontal: 24,
    },
    header: {
        flexDirection: 'row', // Para alinhar lado a lado
        justifyContent: 'space-between', // Logo na esquerda, botão na direita
        alignItems: 'center', // Alinhados verticalmente
        marginBottom: 40,
        paddingHorizontal: 10,
        width: '100%', // Garante que o header ocupe toda a largura
    },
    logoText: {
        fontSize: 36, // Diminuído de 48 para caber melhor
        fontWeight: 'bold',
        color: '#ffffff',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10,
    },
    inscricaoButton: {
        backgroundColor: '#ffffff', // Usando o verde principal do app
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 10,
        elevation: 3, // Sombra (Android)
        shadowColor: '#000', // Sombra (iOS)
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
    },
    inscricaoButtonText: {
        color: '#000000',
        fontWeight: '600',
        fontSize: 16,
    },
    slogan: {
        fontSize: 20, // Tamanho da fonte ajustado
        color: '#000000', // Cinza claro para o slogan
        textAlign: 'center',
        maxWidth: 300,
        lineHeight: 28, // Altura da linha para melhor leitura
    },
    formContainer: {
        width: '100%',
    },
    input: {
        height: 55, // Um pouco maior
        backgroundColor: '#ffffff', // Fundo dos inputs em um tom de azul escuro diferente
        borderRadius: 12, // Cantos mais arredondados
        paddingHorizontal: 20,
        marginBottom: 20,
        color: '#000000', // Texto digitado em branco
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#3c7997', // Borda sutil
        shadowColor: '#000', // Sombra para os inputs
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5,
    },
    button: {
        backgroundColor: '#ffffff', // Azul vibrante para o botão principal
        paddingVertical: 18, // Mais padding
        borderRadius: 12, // Cantos arredondados
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        shadowColor: '#000000', // Sombra com cor do botão
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
    },
    buttonPressed: {
        backgroundColor: '#0056b3', // Cor mais escura ao pressionar
        shadowOpacity: 0.2, // Sombra mais sutil ao pressionar
        shadowRadius: 4,
        elevation: 4,
    },
    buttonText: {
        color: '#000000',
        fontSize: 18, // Tamanho da fonte maior
        fontWeight: 'bold',
        textTransform: 'uppercase', // Texto em maiúsculas
        letterSpacing: 0.8, // Espaçamento entre letras
    },
    link: {
        marginTop: 25,
        alignSelf: 'center', // Centraliza o link
    },
    linkText: {
        color: '#00f2ff', // Um tom de ciano para o link, criando contraste
        fontSize: 15,
        fontWeight: '600',
        textDecorationLine: 'underline', // Sublinhado para indicar que é um link
    },
    apoioButton: {
        backgroundColor: '#ffffff', // Mesmo estilo do botão "Entrar"
        paddingVertical: 18,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 40, // Espaço para separar do formulário
        width: '90%', // Mesma largura do formContainer
        alignSelf: 'center', // Para centralizar
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
    },
    apoioButtonText: {
        color: '#000000', // Mesmo estilo do texto "Entrar"
        fontSize: 18,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    forgotPasswordLink: {
        padding: 10,
        alignSelf: 'center',
        marginTop: 15,
    },
    forgotPasswordText: {
        color: '#ffffff',
        fontSize: 16,
        textDecorationLine: 'underline',
    },
    notificationBanner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: '#FFCDD2', // Fundo vermelho claro (tema de erro)
      paddingVertical: 12,
      paddingHorizontal: 15,
      borderRadius: 10,
      width: '100%',
      marginBottom: 20, // Espaço antes do formulário
      borderWidth: 1,
      borderColor: '#E57373', // Borda vermelha mais escura
    },
    notificationText: {
      color: '#8B0000', // Texto vermelho escuro
      fontWeight: '500',
      fontSize: 15,
      flex: 1, // Permite que o texto quebre a linha
      marginRight: 10,
    },
});
