import { View, Text, StyleSheet, Pressable, TextInput, SafeAreaView, ScrollView, Alert, ActivityIndicator } from 'react-native';
import React from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase'; // Certifique-se de que o caminho para o supabase está correto
import { WebView } from 'react-native-webview';

export default function Signup() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [cep, setCep] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [street, setStreet] = useState('');
    const [neighborhood, setNeighborhood] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [mapHtml, setMapHtml] = useState('');
    const [loading, setLoading] = useState(false);
    const [addressLoading, setAddressLoading] = useState(false);

    // Função para buscar o endereço com base no CEP
    const fetchAddressFromCEP = useCallback(async (currentCep: string) => {
        if (currentCep.length === 8) {
            setAddressLoading(true);
            try {
                const response = await fetch(`https://viacep.com.br/ws/${currentCep}/json/`);
                const data = await response.json();

                if (data.erro) {
                    Alert.alert('Erro', 'CEP não encontrado ou inválido.');
                    setStreet('');
                    setNeighborhood('');
                    setCity('');
                    setState('');
                    setMapHtml('');
                } else {
                    setStreet(data.logradouro || '');
                    setNeighborhood(data.bairro || '');
                    setCity(data.localidade || '');
                    setState(data.uf || '');
                }
            } catch (error: any) {
                Alert.alert('Erro', `Erro ao buscar CEP: ${error.message}`);
                console.error("Erro ao buscar CEP:", error);
            } finally {
                setAddressLoading(false);
            }
        } else if (currentCep.length < 8) {
            setStreet('');
            setNeighborhood('');
            setCity('');
            setState('');
            setMapHtml('');
        }
    }, []);

    // Efeito para chamar a função de busca de CEP com um debounce
    useEffect(() => {
        const handler = setTimeout(() => {
            fetchAddressFromCEP(cep);
        }, 500); // Debounce de 500ms

        return () => {
            clearTimeout(handler);
        };
    }, [cep, fetchAddressFromCEP]);

    // Efeito para gerar o HTML do mapa quando os dados de endereço mudam
    useEffect(() => {
        if (city && state) {
            const fullAddress = street ? `${street}, ${city}, ${state}, Brasil` : `${city}, ${state}, Brasil`;
            const encodedAddress = encodeURIComponent(fullAddress);
            // Substitua 'YOUR_GOOGLE_MAPS_API_KEY' pela sua chave real do Google Maps
            const googleMapsApiKey = 'AIzaSyBGL4L3AZvlJgSJv_RNNDCBCG9HJwwpCWI';

            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        html, body {
                            margin: 0;
                            padding: 0;
                            width: 100%;
                            height: 100%;
                            overflow: hidden;
                        }
                        iframe {
                            width: 100%;
                            height: 100%;
                            border: none;
                            display: block;
                        }
                    </style>
                </head>
                <body>
                    <iframe
                        src="https://www.google.com/maps/embed/v1/place?key=${googleMapsApiKey}&q=${encodedAddress}"
                        allowfullscreen
                        loading="lazy"
                        referrerpolicy="no-referrer-when-downgrade">
                    </iframe>
                </body>
                </html>
            `;
            setMapHtml(htmlContent);
        } else {
            setMapHtml('');
        }
    }, [street, city, state]);

    // Função para lidar com o cadastro do usuário
    async function handleSignUp() {
        setLoading(true);

        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    name: name,
                    is_admin: isAdmin
                }
            }
        });

        if (error) {
            Alert.alert('Erro de Cadastro', error.message);
            setLoading(false);
            return;
        }

        if (data.user) {
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([
                    {
                        id: data.user.id,
                        name: name,
                        is_admin: isAdmin,
                        address_cep: cep,
                        address_street: street,
                        address_neighborhood: neighborhood,
                        address_city: city,
                        address_state: state,
                        created_at: new Date().toISOString()
                    }
                ]);

            if (profileError) {
                Alert.alert('Erro', `Erro ao salvar perfil: ${profileError.message}`);
                console.error("Erro ao salvar perfil Supabase:", profileError);
            } else {
                Alert.alert('Sucesso', 'Conta criada e perfil salvo com sucesso!');
                router.replace('/(auth)/signin'); // Redireciona para a tela de login após o cadastro
            }
        } else {
            Alert.alert('Erro', 'Usuário não retornado após o cadastro.');
        }

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
                            Cartech
                        </Text>
                        <Text style={styles.slogan}>
                            Crie sua conta
                        </Text>
                    </View>

                    <View style={styles.formContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Nome Completo"
                            placeholderTextColor="#A0A0A0"
                            keyboardType="default"
                            autoCapitalize="words"
                            value={name}
                            onChangeText={setName}
                        />
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

                        {/* Rádios estilizados */}
                        <View style={styles.radioContainer}>
                            <Text style={styles.radioLabel}>Tipo de Usuário:</Text>
                            <Pressable
                                style={[styles.radioButton, !isAdmin && styles.radioButtonSelected]}
                                onPress={() => setIsAdmin(false)}
                            >
                                <Text style={styles.radioText}>Normal</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.radioButton, isAdmin && styles.radioButtonSelected]}
                                onPress={() => setIsAdmin(true)}
                            >
                                <Text style={styles.radioText}>Administrador</Text>
                            </Pressable>
                        </View>

                        <TextInput
                            style={styles.input}
                            placeholder="Seu CEP (apenas números)"
                            placeholderTextColor="#A0A0A0"
                            keyboardType="numeric"
                            value={cep}
                            onChangeText={(text) => setCep(text.replace(/\D/g, '').substring(0, 8))}
                            maxLength={8}
                        />

                        {addressLoading && (
                            <ActivityIndicator size="small" color="#00C2CB" style={{ marginBottom: 16 }} />
                        )}

                        {(street || neighborhood || city || state) ? (
                            <View style={styles.addressContainer}>
                                <Text style={styles.addressTitle}>Endereço Encontrado:</Text>
                                <Text style={styles.addressText}><Text style={styles.addressLabel}>Rua:</Text> {street || 'N/A'}</Text>
                                <Text style={styles.addressText}><Text style={styles.addressLabel}>Bairro:</Text> {neighborhood || 'N/A'}</Text>
                                <Text style={styles.addressText}><Text style={styles.addressLabel}>Cidade:</Text> {city || 'N/A'}</Text>
                                <Text style={styles.addressText}><Text style={styles.addressLabel}>Estado:</Text> {state || 'N/A'}</Text>
                            </View>
                        ) : null}

                        {mapHtml ? (
                            <View style={styles.mapContainer}>
                                <WebView
                                    style={styles.map}
                                    originWhitelist={['*']}
                                    source={{ html: mapHtml }}
                                    javaScriptEnabled={true}
                                    domStorageEnabled={true}
                                    startInLoadingState={true}
                                    renderLoading={() => <ActivityIndicator size="large" color="#00C2CB" />}
                                />
                            </View>
                        ) : null}

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
                                <Text style={styles.buttonText}>Cadastrar</Text>
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
        backgroundColor: '#0A1931',
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
        borderColor: '#4A6572',
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
        backgroundColor: '#007BFF',
        paddingVertical: 18,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        shadowColor: '#007BFF',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
    },
    buttonPressed: {
        backgroundColor: '#0056b3',
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    buttonText: {
        color: '#000',
        fontSize: 18,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
});
