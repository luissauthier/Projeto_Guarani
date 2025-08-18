import { useAuth } from '@/src/contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Image,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    FlatList,
    Modal,
    ActivityIndicator, // Adicionado para indicar carregamento
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

// Renomeando para TabTwoScreen para ser mais claro com a estrutura de abas
export default function TabTwoScreen() {
    const { setAuth, isAdmin } = useAuth(); // Obtenha isAdmin do AuthContext

    // Adicionando o useEffect para controle de acesso
    useEffect(() => {
        if (!isAdmin) {
            // Se o usuário não for admin, exibe um alerta e redireciona para a tela 'one'
            Alert.alert('Acesso Negado', 'Você não tem permissão para acessar esta tela.');
            router.replace('/(tabs)/one');
        }
    }, [isAdmin]); // Monitora a mudança em isAdmin

    // Se o usuário não for admin, não renderize nada e espere o redirecionamento
    if (!isAdmin) {
        return null;
    }

    // Restante do seu código para a tela two.tsx (anteriormente HomeScreen.tsx)
    async function handleSignOut() {
        const { error } = await supabase.auth.signOut();
        setAuth(null);
        if (error) {
            Alert.alert('Erro', 'Erro ao sair da conta, tente mais tarde.');
            return;
        }
    }

    const [modalVisible, setModalVisible] = useState(false);
    const [editingCar, setEditingCar] = useState<Carros | null>(null);
    const [newCar, setNewCar] = useState('');
    const [description, setDescription] = useState('');
    const [dailyPrice, setDailyPrice] = useState('');
    const [selectedImage, setSelectedImage] = useState<string | undefined>(undefined);
    const [uploadingImage, setUploadingImage] = useState(false); // Estado para upload da imagem
    const [fetchingCars, setFetchingCars] = useState(true); // Estado para carregamento inicial dos carros

    // Interface para os dados de Carros
    interface Carros {
        id: number;
        modelo: string;
        descricao: string;
        preco_diaria: number;
        imagem?: string | null;
        user_id?: string | null;
    }
    const [carros, setCarros] = useState<Carros[]>([]);

    // Busca a lista de carros do Supabase
    const fetchCarros = async () => {
        setFetchingCars(true); // Inicia o carregamento
        try {
            const { data, error } = await supabase
                .from('carros')
                .select('*')
                .order('id', { ascending: false });
            if (error) {
                console.error('Erro ao buscar carros:', error);
            } else {
                setCarros(data || []);
            }
        } catch (error) {
            console.error('Erro inesperado ao buscar carros:', error);
        } finally {
            setFetchingCars(false); // Finaliza o carregamento
        }
    };

    // Abre a galeria para selecionar uma imagem
    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permissão necessária', 'Precisamos da sua permissão para acessar a galeria de imagens.');
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8, // Qualidade da imagem reduzida para upload mais rápido
        });

        if (!result.canceled) {
            setSelectedImage(result.assets[0].uri);
        }
    };

    // Faz o upload da imagem para o Supabase Storage
    const uploadImage = async (imageUri: string) => {
        setUploadingImage(true); // Inicia o carregamento do upload
        try {
            const response = await fetch(imageUri);
            const blob = await response.blob();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
            const filePath = `public/${fileName}`;

            const { data, error } = await supabase.storage
                .from('item-images')
                .upload(filePath, blob, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: 'image/jpeg',
                });

            if (error) {
                throw error;
            }

            const { data: publicUrl } = supabase.storage.from('item-images').getPublicUrl(filePath);
            return publicUrl.publicUrl;
        } catch (error: any) {
            console.error('Erro ao fazer upload da imagem:', error.message);
            Alert.alert('Erro no Upload', 'Não foi possível fazer o upload da imagem: ' + error.message);
            return null;
        } finally {
            setUploadingImage(false); // Finaliza o carregamento do upload
        }
    };

    // Reseta os campos do formulário do modal
    const resetForm = () => {
        setNewCar('');
        setDescription('');
        setDailyPrice('');
        setSelectedImage(undefined);
        setEditingCar(null);
    };

    // Lida com a adição ou atualização de um carro
    const handleAddOrUpdateItem = async () => {
        if (!newCar.trim() || !description.trim() || !dailyPrice) {
            Alert.alert('Erro', 'Por favor, preencha todos os campos.');
            return;
        }

        const price = parseFloat(dailyPrice);
        if (isNaN(price) || price <= 0) {
            Alert.alert('Erro', 'Preço diária deve ser um número válido e maior que zero.');
            return;
        }

        if (!selectedImage && !editingCar?.imagem) {
            Alert.alert('Erro', 'Por favor, selecione uma imagem.');
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            Alert.alert('Erro', 'Você precisa estar logado para adicionar um item.');
            return;
        }

        let imageUrl = editingCar?.imagem || null;
        if (selectedImage) {
            imageUrl = await uploadImage(selectedImage);
            if (!imageUrl) return; // Se o upload falhar, para a função
        }

        try {
            const carPayload = {
                modelo: newCar,
                descricao: description,
                preco_diaria: price,
                imagem: imageUrl,
                user_id: user.id, // O usuário que adicionou/editou o carro
            };

            if (editingCar) {
                const { error } = await supabase.from('carros').update(carPayload).eq('id', editingCar.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('carros').insert([carPayload]);
                if (error) throw error;
            }

            Alert.alert('Sucesso', editingCar ? 'Carro atualizado com sucesso!' : 'Carro adicionado com sucesso!');
            resetForm();
            setModalVisible(false);
            fetchCarros(); // Recarrega a lista de carros
        } catch (error: any) {
            console.error('Erro ao salvar item:', error.message);
            Alert.alert('Erro ao Salvar', 'Não foi possível salvar o item: ' + error.message);
        }
    };

    // Lida com a edição de um carro existente
    const handleEdit = (car: Carros) => {
        setEditingCar(car);
        setNewCar(car.modelo);
        setDescription(car.descricao);
        setDailyPrice(car.preco_diaria.toString());
        setSelectedImage(undefined); // Limpa a imagem selecionada ao editar
        setModalVisible(true);
    };

    // Lida com a exclusão de um carro
    const handleDelete = async (id: number) => {
        try {
            const { error } = await supabase.from('carros').delete().eq('id', id);
            if (error) throw error;
            fetchCarros(); // Recarrega a lista de carros
            Alert.alert('Sucesso', 'Carro excluído com sucesso!');
        } catch (error: any) {
            console.error('Erro ao excluir carro:', error.message);
            Alert.alert('Erro ao Excluir', 'Não foi possível excluir o carro: ' + error.message);
        }
    };

    // Efeito para buscar carros quando o componente é montado ou isAdmin muda
    useEffect(() => {
        // Apenas busque os carros se o usuário for um administrador
        if (isAdmin) {
            fetchCarros();
        }
    }, [isAdmin]); // Dependência de isAdmin para recarregar quando a permissão mudar

    // Renderiza cada item da lista de carros
    const renderCarItem = ({ item }: { item: Carros }) => (
        <View style={styles.card}>
            {item.imagem ? (
                <Image source={{ uri: item.imagem }} style={styles.image} resizeMode="cover" />
            ) : (
                <View style={styles.imagePlaceholder}>
                    <Feather name="image" size={40} color="#607D8B" /> {/* Cor do ícone */}
                </View>
            )}
            <View style={styles.info}>
                <Text style={styles.modelo}>{item.modelo}</Text>
                <Text style={styles.descricao}>{item.descricao}</Text>
                <Text style={styles.preco}>R$ {item.preco_diaria.toFixed(2)}/dia</Text>
                <View style={styles.cardButtons}>
                    <TouchableOpacity style={styles.editButton} onPress={() => handleEdit(item)}>
                        <Text style={styles.buttonText}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
                        <Text style={styles.buttonText}>Excluir</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.logoText}>Cartech</Text>
                {/* <TouchableOpacity onPress={handleSignOut} style={styles.logoutButton}>
                    <Feather name="log-out" size={24} color="#00C2CB" />
                </TouchableOpacity> */}
            </View>

            <Text style={styles.sectionTitle}>Gerenciar Frota</Text>

            {fetchingCars ? (
                <ActivityIndicator size="large" color="#007BFF" style={styles.loadingIndicator} />
            ) : (
                <FlatList
                    data={carros}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderCarItem}
                    style={styles.list}
                    contentContainerStyle={styles.listContentContainer}
                    ListEmptyComponent={<Text style={styles.emptyText}>Nenhum carro cadastrado. Adicione um!</Text>}
                />
            )}

            <Modal visible={modalVisible} animationType="slide" onRequestClose={() => { resetForm(); setModalVisible(false); }}>
                <KeyboardAvoidingView
                    style={styles.modalContainer}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                >
                    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1931' }}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.logoText}>Cartech</Text>
                            <TouchableOpacity
                                onPress={() => {
                                    resetForm();
                                    setModalVisible(false);
                                }}
                                style={styles.closeModalButton}
                            >
                                <Feather name="x" size={28} color="#00C2CB" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView contentContainerStyle={styles.modalScrollViewContent}>
                            <Text style={styles.modalTitle}>{editingCar ? 'Editar Carro' : 'Adicionar Novo Carro'}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Modelo do carro (Ex: Honda Civic)"
                                placeholderTextColor="#A0A0A0"
                                onChangeText={setNewCar}
                                value={newCar}
                            />
                            <TextInput
                                placeholder="Descrição (Ex: Sedã médio, 4 portas)"
                                placeholderTextColor="#A0A0A0"
                                onChangeText={setDescription}
                                value={description}
                                multiline
                                numberOfLines={3}
                                style={[styles.input, { height: 100, textAlignVertical: 'top' }]} // Aumenta a altura para descrição
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Preço diária (Ex: 150.00)"
                                placeholderTextColor="#A0A0A0"
                                keyboardType="numeric"
                                onChangeText={setDailyPrice}
                                value={dailyPrice}
                            />
                            <TouchableOpacity style={styles.pickImageButton} onPress={pickImage}>
                                <Feather name="image" size={20} color="#FFF" style={{ marginRight: 10 }} />
                                <Text style={styles.buttonText}>Selecionar Imagem</Text>
                            </TouchableOpacity>
                            {(selectedImage || (editingCar?.imagem && !selectedImage)) && (
                                <>
                                    {uploadingImage ? (
                                        <ActivityIndicator size="large" color="#00C2CB" style={styles.imageUploadLoading} />
                                    ) : (
                                        <Image
                                            source={{ uri: selectedImage || editingCar?.imagem || undefined }}
                                            style={styles.imagePreview}
                                            resizeMode="cover"
                                        />
                                    )}
                                </>
                            )}
                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={handleAddOrUpdateItem}
                                disabled={uploadingImage} // Desabilita o botão enquanto a imagem está sendo enviada
                            >
                                {uploadingImage ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.buttonText}>Salvar Carro</Text>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={() => {
                                    resetForm();
                                    setModalVisible(false);
                                }}
                            >
                                <Text style={styles.buttonText}>Cancelar</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </SafeAreaView>
                </KeyboardAvoidingView>
            </Modal>

            <TouchableOpacity
                style={styles.fab}
                onPress={() => {
                    resetForm();
                    setModalVisible(true);
                }}
            >
                <Feather name="plus" size={28} color="#FFF" />
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A1931',
        paddingHorizontal: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 20,
        marginBottom: 10,
        marginHorizontal: 8,
    },
    logoText: {
        fontSize: 32,
        fontWeight: '800',
        color: '#FFF',
        textShadowColor: 'rgba(0, 0, 0, 0.2)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    logoutButton: {
        padding: 8,
    },
    sectionTitle: {
        fontSize: 26,
        fontWeight: '700',
        color: '#FFF',
        textAlign: 'center',
        marginBottom: 25,
    },
    list: {
        flex: 1,
        width: '100%',
    },
    listContentContainer: {
        paddingBottom: 80,
    },
    card: {
        flexDirection: 'row',
        backgroundColor: '#1E2F47',
        borderRadius: 12,
        marginBottom: 15,
        padding: 15,
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        marginHorizontal: 4,
        borderWidth: 1,
        borderColor: '#3A506B',
    },
    image: {
        width: 100,
        height: 100,
        borderRadius: 10,
        marginRight: 15,
        borderWidth: 1,
        borderColor: '#4A6572',
    },
    imagePlaceholder: {
        width: 100,
        height: 100,
        backgroundColor: '#3A506B',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 10,
        marginRight: 15,
    },
    info: {
        flex: 1,
        justifyContent: 'space-between',
    },
    modelo: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 4,
    },
    descricao: {
        fontSize: 14,
        color: '#B0B0B0',
        marginBottom: 6,
    },
    preco: {
        fontSize: 16,
        color: '#00C2CB',
        fontWeight: '600',
    },
    cardButtons: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 10,
    },
    editButton: {
        backgroundColor: '#007BFF',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 8,
        alignItems: 'center',
        flex: 1,
        shadowColor: '#007BFF',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    deleteButton: {
        backgroundColor: '#FF4C4C',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 8,
        alignItems: 'center',
        flex: 1,
        shadowColor: '#FF4C4C',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    buttonText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#0A1931',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 20,
        paddingHorizontal: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#203A4A',
    },
    closeModalButton: {
        padding: 8,
    },
    modalTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#FFF',
        textAlign: 'center',
        marginBottom: 30,
        paddingHorizontal: 24,
    },
    modalScrollViewContent: {
        paddingHorizontal: 24,
        paddingBottom: 50,
        flexGrow: 1,
        justifyContent: 'center',
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
    pickImageButton: {
        backgroundColor: '#4A6572', // Um tom de azul acinzentado para o botão de selecionar imagem
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        flexDirection: 'row', // Para alinhar ícone e texto
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5,
    },
    imagePreview: {
        width: 250,
        height: 150,
        borderRadius: 12,
        marginBottom: 25,
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: '#4A6572',
    },
    imageUploadLoading: {
        marginVertical: 20,
    },
    primaryButton: {
        backgroundColor: '#007BFF',
        paddingVertical: 18,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 15,
        shadowColor: '#007BFF',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
    },
    secondaryButton: {
        backgroundColor: '#4A6572',
        paddingVertical: 18,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5,
    },
    fab: {
        position: 'absolute',
        right: 25,
        bottom: 25,
        backgroundColor: '#00C2CB',
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#00C2CB',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
    },
    emptyText: {
        color: '#E0E0E0',
        textAlign: 'center',
        marginVertical: 40,
        fontSize: 16,
    },
    loadingIndicator: {
        marginTop: 50,
    }
});
