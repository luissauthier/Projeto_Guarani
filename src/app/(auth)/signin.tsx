import { View, Text, StyleSheet, Pressable, TextInput, SafeAreaView, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import React from 'react';
import { useState } from 'react';
import { supabase } from '../../lib/supabase'; // Certifique-se de que o caminho para o supabase está correto
import { router } from 'expo-router';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSignIn() {
        setLoading(true);

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            Alert.alert('Erro de Login', error.message);
            setLoading(false);
            return;
        }

        setLoading(false);
        router.replace('/(tabs)/one'); // Redireciona para a tela principal após o login
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollViewContent}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        {/* Novo estilo para o logotipo "Cartech" */}
                        <Text style={styles.logoText}>
                            Projeto Guarani
                        </Text>
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
                            secureTextEntry={true}
                            value={password}
                            onChangeText={setPassword}
                        />
                        <Pressable
                            style={({ pressed }) => [
                                styles.button,
                                pressed && styles.buttonPressed,
                            ]}
                            onPress={handleSignIn}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.buttonText}>Acessar</Text>
                            )}
                        </Pressable>
                        <Link href='/(auth)/signup' style={styles.link}>
                            <Text style={styles.linkText}>Não tem uma conta? Cadastre-se</Text>
                        </Link>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#18641c', // Cor de fundo principal: Azul escuro profundo
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
        alignItems: 'center',
        marginBottom: 50, // Mais espaço para o cabeçalho
    },
    logoText: {
        fontSize: 48, // Tamanho maior para o logo
        fontWeight: '800', // Mais encorpado
        color: '#FFF', // Branco puro
        marginBottom: 10,
        textShadowColor: 'rgba(0, 0, 0, 0.2)', // Sombra sutil para profundidade
        textShadowOffset: { width: 2, height: 2 },
        textShadowRadius: 5,
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
});
