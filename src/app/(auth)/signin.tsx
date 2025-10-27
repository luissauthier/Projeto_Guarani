import { View, Text, StyleSheet, Pressable, TextInput, SafeAreaView, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { router } from 'expo-router';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSignIn() {
    setLoading(true);
    setErrorMsg(null); // Limpa erros antigos

    try {
      // 1. Tenta fazer o login
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      
      if (signInError) {
        // Erro de "Senha inválida" ou "Usuário não existe"
        throw signInError;
      }

      if (signInData.user) {
        // 2. Login OK! Agora verifica se o usuário está ativo na tabela 'users'
        const { data: userDataList, error: userError } = await supabase
          .from('users')
          .select('ativo')
          .eq('id', signInData.user.id); // <-- REMOVIDO o .single()

        if (userError) {
          // Erro na consulta
          await supabase.auth.signOut();
          throw new Error("Não foi possível verificar seu perfil. " + userError.message);
        }

        // Pega o primeiro usuário da lista
        const userData = userDataList ? userDataList[0] : null; 

        if (!userData) {
          // Não achou o perfil? Melhor deslogar por segurança.
          await supabase.auth.signOut();
          throw new Error("Perfil de usuário não encontrado.");
        }
        
        // 3. A VERIFICAÇÃO PRINCIPAL
        if (userData && userData.ativo === false) {
          // Usuário está INATIVO
          await supabase.auth.signOut(); // Desloga imediatamente
          setErrorMsg('Usuário inativo. Entre em contato com um administrador.');
        } else {
          // Usuário está ATIVO, deixa o AuthContext redirecionar
        }
      }

    } catch (e: any) {
      // Pega erros do signInError ou do userError
      console.error('[handleSignIn] Erro:', e.message);
      // Mostra a mensagem de erro na tela
      if (e.message.includes('Invalid login credentials')) {
        setErrorMsg('E-mail ou senha inválidos.');
      } else {
        setErrorMsg(e.message);
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
            {errorMsg && (
              <Text style={styles.errorText}>{errorMsg}</Text>
            )}
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
    errorText: {
        color: '#FF6B6B', // Um tom de vermelho claro
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 15,
        paddingHorizontal: 10,
    },
});
