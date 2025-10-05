import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, Alert, ActivityIndicator,
  SafeAreaView, ScrollView, Image, TouchableOpacity
} from 'react-native';
import { router } from 'expo-router';
<<<<<<< HEAD
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
        // dentro do handleSignUp()
        setLoading(true);

        const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } } // o trigger usa isso
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
=======
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { Feather } from '@expo/vector-icons';

type UploadKind = 'foto' | 'doc_frente' | 'doc_verso';

export default function PreInscricao() {
  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState(''); // yyyy-mm-dd (obrigatório)
  const [responsavel, setResponsavel] = useState('');       // obrigatório se < 18
  const [telefone, setTelefone] = useState('');             // obrigatório
  const [email, setEmail] = useState('');                   // opcional

  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [docFrenteUri, setDocFrenteUri] = useState<string | null>(null);
  const [docVersoUri, setDocVersoUri] = useState<string | null>(null);

  const [uploading, setUploading] = useState<UploadKind | null>(null);
  const [saving, setSaving] = useState(false);

  // helpers
  const idade = useMemo(() => {
    if (!dataNascimento) return null;
    const dob = new Date(dataNascimento);
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  }, [dataNascimento]);

  const categoriaAno = useMemo(() => {
    if (!dataNascimento) return null;
    const dob = new Date(dataNascimento);
    if (isNaN(dob.getTime())) return null;
    return dob.getFullYear(); // mesma regra do banco
  }, [dataNascimento]);

  const responsavelObrigatorio = idade !== null && idade < 18;

  async function pick(kind: UploadKind) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return Alert.alert('Permissão necessária', 'Autorize acesso à galeria de imagens.');
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      if (kind === 'foto') setFotoUri(uri);
      if (kind === 'doc_frente') setDocFrenteUri(uri);
      if (kind === 'doc_verso') setDocVersoUri(uri);
    }
  }

  async function uploadToStorage(localUri: string) {
    try {
      // uploading state apenas para mostrar spinner do bloco que chamou
      const res = await fetch(localUri);
      const blob = await res.blob();
      const ext = 'jpg';
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const path = `preinscricao/${filename}`;
      const { error } = await supabase.storage
        .from('jogadores')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if (error) throw error;
      return path as string;
    } finally {
      setUploading(null);
    }
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Erro', 'Erro ao retornar para página de login, tente mais tarde.');
  }

  async function enviar() {
    if (!nome.trim()) return Alert.alert('Atenção', 'Informe o nome do jogador.');
    if (!dataNascimento.trim()) return Alert.alert('Atenção', 'Informe a data de nascimento (AAAA-MM-DD).');
    const dob = new Date(dataNascimento);
    if (isNaN(dob.getTime())) return Alert.alert('Atenção', 'Data de nascimento inválida.');
    if (!telefone.trim()) return Alert.alert('Atenção', 'Informe um número de telefone para contato.');
    if (responsavelObrigatorio && !responsavel.trim()) {
      return Alert.alert('Atenção', 'Responsável é obrigatório para menores de 18 anos.');
    }

    setSaving(true);
    try {
      let foto_path: string | null = null;
      let doc_id_frente_path: string | null = null;
      let doc_id_verso_path: string | null = null;

      if (fotoUri) {
        setUploading('foto');
        foto_path = await uploadToStorage(fotoUri);
      }
      if (docFrenteUri) {
        setUploading('doc_frente');
        doc_id_frente_path = await uploadToStorage(docFrenteUri);
      }
      if (docVersoUri) {
        setUploading('doc_verso');
        doc_id_verso_path = await uploadToStorage(docVersoUri);
      }

      const { error } = await supabase.from('jogadores').insert({
        nome,
        data_nascimento: dataNascimento,
        email: email || null,
        telefone,
        responsavel_nome: responsavelObrigatorio ? responsavel : (responsavel || null),
        foto_path,
        doc_id_frente_path,
        doc_id_verso_path,
        status: 'pre_inscrito',
        termo_assinado_path: null
      });
      if (error) throw error;

      Alert.alert(
        'Pré-inscrição enviada!',
        'Leve o termo para assinatura do responsável. O admin fará o upload do termo assinado e aprovará.'
      );
      router.back();
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Falha ao enviar pré-inscrição.');
    } finally {
      setSaving(false);
      setUploading(null);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1931' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <TouchableOpacity onPress={handleSignOut} style={{ alignSelf: 'flex-end', padding: 8 }}>
          <Feather name="log-out" size={24} color="#00C2CB" />
        </TouchableOpacity>

        <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 12, color: '#fff' }}>
          Pré-inscrição de jogador
        </Text>

        <TextInput
          placeholder="Nome completo do jogador"
          placeholderTextColor="#A0A0A0"
          value={nome}
          onChangeText={setNome}
          style={styles.input}
        />

        <TextInput
          placeholder="Data de nascimento (AAAA-MM-DD)"
          placeholderTextColor="#A0A0A0"
          value={dataNascimento}
          onChangeText={setDataNascimento}
          style={styles.input}
        />
        {(idade !== null || categoriaAno !== null) && (
          <Text style={{ color: '#E0E0E0', marginBottom: 10 }}>
            {idade !== null ? `Idade: ${idade} anos ` : ''}
            {categoriaAno !== null ? `• Categoria (ano): ${categoriaAno}` : ''}
            {responsavelObrigatorio ? ' • (responsável obrigatório)' : ''}
          </Text>
        )}

        <TextInput
          placeholder="Telefone para contato"
          placeholderTextColor="#A0A0A0"
          value={telefone}
          onChangeText={setTelefone}
          keyboardType="phone-pad"
          style={styles.input}
        />

        <TextInput
          placeholder="E-mail (opcional)"
          placeholderTextColor="#A0A0A0"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />

        <TextInput
          placeholder="Nome do responsável (se menor de 18)"
          placeholderTextColor="#A0A0A0"
          value={responsavel}
          onChangeText={setResponsavel}
          style={styles.input}
        />

        {/* Foto do jogador */}
        <View style={styles.uploadBox}>
          <Text style={styles.uploadTitle}>Foto do jogador</Text>
          <Pressable style={styles.pickButton} onPress={() => pick('foto')}>
            <Feather name="image" size={18} color="#FFF" />
            <Text style={styles.pickButtonText}>Selecionar imagem</Text>
          </Pressable>
          {fotoUri ? <Image source={{ uri: fotoUri }} style={styles.preview} /> : null}
          {uploading === 'foto' && <ActivityIndicator color="#00C2CB" />}
        </View>

        {/* Documento identidade (opcional) */}
        <View style={styles.uploadBox}>
          <Text style={styles.uploadTitle}>Documento de identidade (opcional)</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable style={[styles.pickButton, { flex: 1 }]} onPress={() => pick('doc_frente')}>
              <Feather name="file-plus" size={18} color="#FFF" />
              <Text style={styles.pickButtonText}>Frente</Text>
            </Pressable>
            <Pressable style={[styles.pickButton, { flex: 1 }]} onPress={() => pick('doc_verso')}>
              <Feather name="file-plus" size={18} color="#FFF" />
              <Text style={styles.pickButtonText}>Verso</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            {docFrenteUri ? <Image source={{ uri: docFrenteUri }} style={[styles.preview, { flex: 1 }]} /> : null}
            {docVersoUri ? <Image source={{ uri: docVersoUri }} style={[styles.preview, { flex: 1 }]} /> : null}
          </View>
          {(uploading === 'doc_frente' || uploading === 'doc_verso') && <ActivityIndicator color="#00C2CB" style={{ marginTop: 8 }} />}
        </View>

        <Pressable
          style={[styles.submitButton, (saving || uploading !== null) && { opacity: 0.7 }]}
          onPress={enviar}
          disabled={saving || uploading !== null}
        >
          {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Enviar Pré-inscrição</Text>}
        </Pressable>

        <Text style={{ color: '#B0B0B0', marginTop: 12 }}>
          Após a pré-inscrição, o termo será entregue fisicamente. O admin fará upload do termo assinado e aprovará.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = {
  input: {
    height: 55,
    backgroundColor: '#203A4A',
    borderRadius: 12,
    paddingHorizontal: 20,
    marginBottom: 12,
    color: '#FFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#4A6572',
  } as any,
  uploadBox: {
    backgroundColor: '#1E2F47',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#3A506B',
    marginBottom: 12,
  } as any,
  uploadTitle: { color: '#fff', fontWeight: 'bold', marginBottom: 8 } as any,
  pickButton: {
    backgroundColor: '#4A6572',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  } as any,
  pickButtonText: { color: '#fff', fontWeight: 'bold', marginLeft: 8 } as any,
  preview: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#4A6572',
  } as any,
  submitButton: {
    backgroundColor: '#18641c',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  } as any,
  submitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 } as any,
};
>>>>>>> b2b449eff27129e23ae275f253cd6e52e6884563
