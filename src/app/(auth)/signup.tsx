import { View, Text, StyleSheet, Pressable, TextInput, SafeAreaView, ScrollView, Alert, ActivityIndicator } from 'react-native';
import React from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase'; // Certifique-se de que o caminho para o supabase está correto
import { WebView } from 'react-native-webview';

export default function Signup() {
    const [namej, setNamej] = useState('');
    const [date, setDate] = useState('');
    const [namer, setNamer] = useState('');
    const [email, setEmail] = useState('');
    const [telefone, setTelefone] = useState('');
    const [password, setPassword] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(false);

    // Função para lidar com o cadastro do usuário
    async function handleSignUp() {
        // dentro do handleSignUp()
        setLoading(true);

        const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: namer } } // o trigger usa isso
        });

        if (error) {
        Alert.alert('Erro de Cadastro', error.message);
        setLoading(false);
        return;
        }

        // a entrada em public.users já foi criada com type_user = 'coach' (padrão)
        Alert.alert('Sucesso', 'Conta criada! Faça login para entrar.');
        router.replace('/(auth)/signin');
        setLoading(false);
    }


    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollViewContent}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        {/* Botão de voltar aprimorado */}
                        <Pressable style={styles.backButton} onPress={() => router.back()}>
                            <Ionicons name="arrow-back" size={28} color="#FFF" />
                        </Pressable>
                        <Text style={styles.logoText}>
                            Projeto Guarani
                        </Text>
                        <Text style={styles.slogan}>
                            Inscrição do Jogardor
                        </Text>
                    </View>

                    <View style={styles.formContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Nome Completo Jogador"
                            placeholderTextColor="#A0A0A0"
                            keyboardType="default"
                            autoCapitalize="words"
                            value={namej}
                            onChangeText={setNamej}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Data de nascimento Jogador"
                            placeholderTextColor="#A0A0A0"
                            keyboardType="numeric"
                            autoCapitalize="none"
                            value={date}
                            onChangeText={setDate}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Nome Completo Responsável"
                            placeholderTextColor="#A0A0A0"
                            keyboardType="default"
                            autoCapitalize="none"
                            value={namer}
                            onChangeText={setNamer}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor="#A0A0A0"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={email}
                            onChangeText={setEmail}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Telefone"
                            placeholderTextColor="#A0A0A0"
                            keyboardType="numeric"
                            autoCapitalize="none"
                            value={telefone}
                            onChangeText={setTelefone}
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
                            onPress={handleSignUp}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.buttonText}>Enviar Inscrição</Text>
                            )}
                        </Pressable>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#18641c',
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
        marginBottom: 30,
        position: 'relative', // Para posicionar o botão de voltar
    },
    backButton: {
        position: 'absolute',
        top: 0,
        left: 0,
        padding: 10,
        zIndex: 1, // Garante que o botão esteja acima de outros elementos
    },
    logoText: {
        fontSize: 40, // Um pouco menor que o login, mas ainda proeminente
        fontWeight: '800',
        color: '#FFF',
        marginBottom: 8,
        textShadowColor: 'rgba(0, 0, 0, 0.2)',
        textShadowOffset: { width: 2, height: 2 },
        textShadowRadius: 5,
    },
    slogan: {
        fontSize: 22,
        color: '#E0E0E0',
        textAlign: 'center',
        marginBottom: 30,
    },
    formContainer: {
        width: '100%',
    },
    input: {
        height: 55,
        backgroundColor: '#203A4A',
        borderRadius: 12,
        paddingHorizontal: 20,
        marginBottom: 20,
        color: '#FFF',
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#4A6572',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5,
    },
    radioContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        backgroundColor: '#203A4A',
        borderRadius: 12,
        paddingVertical: 15,
        borderWidth: 1,
        borderColor: '#4A6572',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5,
    },
    radioLabel: {
        color: '#FFF',
        fontSize: 16,
        marginRight: 25,
        fontWeight: '600',
    },
    radioButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: '#4A6572',
        marginHorizontal: 8,
        backgroundColor: '#304E60',
    },
    radioButtonSelected: {
        backgroundColor: '#00C2CB', // Azul ciano para a seleção
        borderColor: '#00C2CB',
        shadowColor: '#00C2CB',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    radioText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: 'bold',
    },
    addressContainer: {
        backgroundColor: '#304E60', // Fundo mais claro para o container de endereço
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5,
    },
    addressTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
    },
    addressText: {
        color: '#E0E0E0',
        fontSize: 15,
        marginBottom: 6,
        lineHeight: 22,
    },
    addressLabel: {
        fontWeight: 'bold',
        color: '#FFF',
    },
    mapContainer: {
        height: 250,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#4A6572',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5,
    },
    map: {
        flex: 1,
    },
    button: {
        backgroundColor: '#2aa530',
        paddingVertical: 18,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        shadowColor: '#157419',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
    },
    buttonPressed: {
        backgroundColor: '#2aa530',
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
});
