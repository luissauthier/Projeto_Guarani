import { useAuth } from '@/src/contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker'; // Importação não utilizada nesta tela, pode ser removida se não for usada em outro lugar
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
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator // Adicionado para indicar carregamento no modal
} from 'react-native';
import { supabase } from '@/src/lib/supabase';
import { Feather } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

export default function TabOneScreen() {
    const { setAuth, user, isAdmin } = useAuth(); // Obtenha isAdmin e user do AuthContext

    // Função para lidar com o logout do usuário
    async function handleSignOut() {
        const { error } = await supabase.auth.signOut();
        setAuth(null);
        if (error) {
            Alert.alert('Erro', 'Erro ao sair da conta, tente mais tarde.');
        }
    }

    const [modalVisible, setModalVisible] = useState(false);
    const [editingPedido, setEditingPedido] = useState<Pedidos | null>(null);
    const [selectedCarId, setSelectedCarId] = useState<number | null>(null);
    const [days, setDays] = useState('');
    const [cars, setCars] = useState<Carros[]>([]);
    const [pedidos, setPedidos] = useState<Pedidos[]>([]);
    const [totalValue, setTotalValue] = useState('0.00');
    const [fetchingData, setFetchingData] = useState(true); // Novo estado para controlar o carregamento inicial

    // Interface para os dados de Carros
    interface Carros {
        id: number;
        modelo: string;
        descricao: string;
        preco_diaria: number;
        imagem: string | null;
    }

    // Interface para os dados de Pedidos
    interface Pedidos {
        id: number;
        carro_id: number;
        user_id: string;
        dias: number;
        preco_total: number;
        users?: { name: string | null };
        user_display_name?: string;
    }

    // Busca a lista de carros do Supabase
    const fetchCars = async () => {
        try {
            const { data, error } = await supabase.from('carros').select('*');
            if (error) {
                console.error('Erro ao buscar carros:', error.message);
            } else {
                setCars(data || []);
                // Define o carro selecionado padrão se não houver um ou se o atual não existir
                if (data.length > 0 && (selectedCarId === null || !data.some(car => car.id === selectedCarId))) {
                    setSelectedCarId(data[0].id);
                }
            }
        } catch (error) {
            console.error('Erro inesperado ao buscar carros:', error);
        }
    };

    // Busca a lista de pedidos do Supabase
    const fetchPedidos = async () => {
        if (!user) { // Certifique-se de que o usuário está carregado
            console.warn('Usuário não autenticado. Não é possível buscar pedidos.');
            setPedidos([]);
            setFetchingData(false); // Conclui o carregamento mesmo sem usuário
            return;
        }

        setFetchingData(true); // Inicia o carregamento
        try {
            let query = supabase.from('pedidos').select('*, users(name)');

            if (!isAdmin) {
                // Se não for admin, filtre por user_id
                query = query.eq('user_id', user.id);
            }

            const { data, error } = await query.order('id', { ascending: false });

            if (error) {
                console.error('Erro ao buscar pedidos:', error.message);
                Alert.alert('Erro', `Erro ao buscar pedidos: ${error.message}`);
                setPedidos([]);
                return;
            }

            if (!data) {
                setPedidos([]);
                return;
            }

            // Mapeia os pedidos para incluir o nome do usuário (para admins)
            const pedidosWithUserNames = data.map(pedido => {
                const userDisplayName = pedido.users?.name || 'Usuário Desconhecido';
                return {
                    ...pedido,
                    user_display_name: userDisplayName,
                };
            });

            setPedidos(pedidosWithUserNames);
        } catch (error: any) {
            console.error('Erro inesperado ao buscar pedidos:', error.message);
            Alert.alert('Erro', `Erro inesperado: ${error.message}`);
        } finally {
            setFetchingData(false); // Finaliza o carregamento
        }
    };

    // Reseta os campos do formulário do modal
    const resetForm = () => {
        setSelectedCarId(null);
        setDays('');
        setEditingPedido(null);
        setTotalValue('0.00');
    };

    // Atualiza o valor total do pedido com base nos dias e preço diária
    const updateTotalValue = () => {
        const daysNum = parseInt(days, 10) || 0;
        const selectedCar = cars.find(c => c.id === selectedCarId);
        const newTotal = selectedCar ? (daysNum * selectedCar.preco_diaria).toFixed(2) : '0.00';
        setTotalValue(newTotal);
    };

    // Lida com a adição ou atualização de um pedido
    const handleAddOrUpdatePedido = async () => {
        if (!selectedCarId || !days.trim()) {
            Alert.alert('Erro', 'Por favor, selecione um carro e insira o número de dias.');
            return;
        }

        const daysNum = parseInt(days, 10);
        if (isNaN(daysNum) || daysNum <= 0) {
            Alert.alert('Erro', 'Dias deve ser um número válido e maior que zero.');
            return;
        }

        const selectedCar = cars.find(car => car.id === selectedCarId);
        if (!selectedCar) {
            Alert.alert('Erro', 'Carro não encontrado.');
            return;
        }

        const preco_total = daysNum * selectedCar.preco_diaria;

        if (!user) {
            Alert.alert('Erro', 'Você precisa estar logado para fazer um pedido.');
            return;
        }

        try {
            const pedidoPayload = {
                carro_id: selectedCarId,
                user_id: user.id, // Garante que o user_id é o do usuário logado
                dias: daysNum,
                preco_total,
            };

            if (editingPedido) {
                // Permite edição apenas se for admin OU o pedido pertencer ao usuário logado
                if (!isAdmin && editingPedido.user_id !== user.id) {
                    Alert.alert('Permissão Negada', 'Você só pode editar seus próprios pedidos.');
                    return;
                }
                const { error } = await supabase.from('pedidos').update(pedidoPayload).eq('id', editingPedido.id);
                if (error) {
                    console.error('Erro ao atualizar pedido:', error.message);
                    throw error;
                }
            } else {
                const { error } = await supabase.from('pedidos').insert([pedidoPayload]);
                if (error) {
                    console.error('Erro ao inserir pedido:', error.message);
                    throw error;
                }
            }

            Alert.alert('Sucesso', editingPedido ? 'Pedido atualizado!' : 'Pedido adicionado!');
            resetForm();
            setModalVisible(false);
            fetchPedidos(); // Recarrega a lista de pedidos
        } catch (error: any) {
            console.error('Erro ao salvar pedido:', error.message);
            Alert.alert('Erro', 'Não foi possível salvar o pedido: ' + error.message);
        }
    };

    // Lida com a edição de um pedido existente
    const handleEdit = (pedido: Pedidos) => {
        // Permite editar apenas se for admin OU o pedido pertencer ao usuário logado
        if (!isAdmin && pedido.user_id !== user?.id) {
            Alert.alert('Permissão Negada', 'Você só pode editar seus próprios pedidos.');
            return;
        }
        setEditingPedido(pedido);
        setSelectedCarId(pedido.carro_id);
        setDays(pedido.dias.toString());
        setTotalValue(pedido.preco_total.toFixed(2));
        setModalVisible(true);
    };

    // Lida com a exclusão de um pedido
    const handleDelete = async (id: number, pedidoUserId: string) => {
        // Permite excluir apenas se for admin OU o pedido pertencer ao usuário logado
        if (!isAdmin && pedidoUserId !== user?.id) {
            Alert.alert('Permissão Negada', 'Você só pode excluir seus próprios pedidos.');
            return;
        }

        try {
            const { error } = await supabase.from('pedidos').delete().eq('id', id);
            if (error) throw error;
            fetchPedidos(); // Recarrega a lista de pedidos
            Alert.alert('Sucesso', 'Pedido excluído!');
        } catch (error: any) {
            console.error('Erro ao excluir pedido:', error.message);
            Alert.alert('Erro', 'Não foi possível excluir o pedido: ' + error.message);
        }
    };

    // Efeito para buscar carros quando o componente é montado
    useEffect(() => {
        fetchCars();
    }, []);

    // Efeito para buscar pedidos quando o usuário ou isAdmin mudam
    useEffect(() => {
        // Só tenta buscar pedidos se o usuário estiver carregado
        if (user) {
            fetchPedidos();
        }
    }, [user, isAdmin]); // Recarrega pedidos quando user ou isAdmin mudam

    // Efeito para atualizar o valor total quando dias, carro selecionado ou lista de carros mudam
    useEffect(() => {
        if (cars.length > 0) {
            if (selectedCarId === null || !cars.some(car => car.id === selectedCarId)) {
                setSelectedCarId(cars[0].id); // Seleciona o primeiro carro se nada estiver selecionado ou o carro não existir
            }
        } else {
            setSelectedCarId(null);
        }
        updateTotalValue();
    }, [days, selectedCarId, cars]);

    // Renderiza cada item da lista de pedidos
    const renderPedidoItem = ({ item }: { item: Pedidos }) => {
        const car = cars.find(c => c.id === item.carro_id);
        // Determine se o usuário logado tem permissão para editar/excluir este pedido
        const canModify = isAdmin || (user && item.user_id === user.id);

        return (
            <View style={styles.card}>
                {car?.imagem ? (
                    <Image source={{ uri: car.imagem }} style={styles.image} resizeMode="cover" onError={(e) => console.log('Image load error:', e.nativeEvent.error)} />
                ) : (
                    <View style={styles.imagePlaceholder}>
                        <Feather name="image" size={40} color="#607D8B" /> {/* Cor do ícone */}
                    </View>
                )}
                <View style={styles.info}>
                    <Text style={styles.modelo}>{car?.modelo || 'Modelo Desconhecido'}</Text>
                    <Text style={styles.descricao}>{car?.descricao || 'Sem descrição'}</Text>
                    <Text style={styles.preco}>R$ {car?.preco_diaria ? car.preco_diaria.toFixed(2) : '0.00'}/dia</Text>
                    <Text style={styles.totalValue}>Total: R$ {item.preco_total.toFixed(2)} ({item.dias} dias)</Text>
                    {isAdmin && ( // Mostra o solicitante apenas para admins
                        <Text style={styles.user}>Solicitante: {item.user_display_name || 'Usuário Desconhecido'}</Text>
                    )}
                    {canModify && ( // Mostra botões apenas se o usuário tiver permissão
                        <View style={styles.cardButtons}>
                            <TouchableOpacity style={styles.editButton} onPress={() => handleEdit(item)}>
                                <Text style={styles.buttonText}>Editar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id, item.user_id)}>
                                <Text style={styles.buttonText}>Excluir</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    const selectedCar = selectedCarId ? cars.find(c => c.id === selectedCarId) : null;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.logoText}>Cartech</Text>
                <TouchableOpacity onPress={handleSignOut} style={styles.logoutButton}>
                    <Feather name="log-out" size={24} color="#00C2CB" /> {/* Cor do ícone de logout */}
                </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Seus Pedidos de Veículos</Text>

            {fetchingData ? (
                <ActivityIndicator size="large" color="#007BFF" style={styles.loadingIndicator} />
            ) : (
                <FlatList
                    data={pedidos}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderPedidoItem}
                    style={styles.list}
                    contentContainerStyle={styles.listContentContainer}
                    ListEmptyComponent={<Text style={styles.emptyText}>Nenhum pedido encontrado. Faça seu primeiro aluguel!</Text>}
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
                            <TouchableOpacity onPress={() => { resetForm(); setModalVisible(false); }} style={styles.closeModalButton}>
                                <Feather name="x" size={28} color="#00C2CB" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView contentContainerStyle={styles.modalScrollViewContent}>
                            <Text style={styles.modalTitle}>{editingPedido ? 'Editar Pedido' : 'Novo Pedido'}</Text>

                            {selectedCar?.imagem && (
                                <Image
                                    source={{ uri: selectedCar.imagem }}
                                    style={styles.imagePreview}
                                    resizeMode="cover"
                                    onError={(e) => console.log('Image load error:', e.nativeEvent.error)}
                                />
                            )}
                            {Platform.OS === 'web' ? (
                                <select
                                    value={selectedCarId || ''}
                                    onChange={(e) => setSelectedCarId(e.target.value ? parseInt(e.target.value, 10) : null)}
                                    style={styles.webPicker}
                                >
                                    <option value="">Selecione um carro</option>
                                    {cars.map(car => (
                                        <option key={car.id} value={car.id}>
                                            {car.modelo} - R$ {car.preco_diaria.toFixed(2)}/dia
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <View style={styles.pickerContainer}>
                                    <Picker
                                        selectedValue={selectedCarId}
                                        onValueChange={(itemValue: number | null) => setSelectedCarId(itemValue)}
                                        style={styles.nativePicker}
                                        itemStyle={styles.pickerItem} // Estilo para os itens do Picker
                                        enabled={cars.length > 0}
                                        dropdownIconColor="#00C2CB" // Cor do ícone do dropdown (Android)
                                    >
                                        <Picker.Item label="Selecione um carro" value={null} style={{ color: '#A0A0A0' }} />
                                        {cars.map(car => (
                                            <Picker.Item key={car.id} label={`${car.modelo} - R$ ${car.preco_diaria.toFixed(2)}/dia`} value={car.id} style={{ color: '#FFF' }} />
                                        ))}
                                    </Picker>
                                </View>
                            )}

                            {selectedCar && (
                                <>
                                    <Text style={styles.staticFieldLabel}>Descrição:</Text>
                                    <Text style={styles.staticField}>{selectedCar.descricao}</Text>
                                    <Text style={styles.staticFieldLabel}>Preço Diária:</Text>
                                    <Text style={styles.staticField}>R$ {selectedCar.preco_diaria.toFixed(2)}/dia</Text>
                                </>
                            )}
                            <TextInput
                                style={styles.input}
                                placeholder="Número de dias"
                                placeholderTextColor="#A0A0A0"
                                keyboardType="numeric"
                                onChangeText={setDays}
                                value={days}
                            />
                            <Text style={styles.staticFieldLabel}>Valor Total do Aluguel:</Text>
                            <Text style={styles.totalValueDisplay}>R$ {totalValue}</Text>

                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={handleAddOrUpdatePedido}
                            >
                                <Text style={styles.buttonText}>Salvar Pedido</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={() => { resetForm(); setModalVisible(false); }}
                            >
                                <Text style={styles.buttonText}>Cancelar</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </SafeAreaView>
                </KeyboardAvoidingView>
            </Modal>

            <TouchableOpacity
                style={styles.fab}
                onPress={() => { resetForm(); setModalVisible(true); }}
            >
                <Feather name="plus" size={28} color="#FFF" />
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A1931', // Fundo principal
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
        fontSize: 32, // Tamanho do logo ajustado para telas internas
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
        paddingBottom: 80, // Espaço extra para o FAB
    },
    card: {
        flexDirection: 'row',
        backgroundColor: '#1E2F47', // Cor de fundo do cartão
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
        backgroundColor: '#3A506B', // Fundo do placeholder
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
        color: '#B0B0B0', // Cinza claro para descrição
        marginBottom: 6,
    },
    preco: {
        fontSize: 16,
        color: '#00C2CB', // Azul ciano para o preço diário
        fontWeight: '600',
        marginBottom: 4,
    },
    totalValue: {
        fontSize: 16,
        color: '#007BFF', // Azul vibrante para o valor total
        fontWeight: '700',
        marginBottom: 8,
    },
    user: {
        fontSize: 14,
        color: '#E0E0E0',
        fontStyle: 'italic',
        marginTop: 4,
    },
    cardButtons: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 10,
    },
    editButton: {
        backgroundColor: '#007BFF', // Azul vibrante para editar
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
        backgroundColor: '#FF4C4C', // Vermelho para excluir
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
    imagePreview: {
        width: 250,
        height: 150,
        borderRadius: 12,
        marginBottom: 25,
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: '#4A6572',
    },
    pickerContainer: {
        backgroundColor: '#203A4A', // Fundo do picker container
        borderRadius: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#4A6572',
        overflow: 'hidden', // Para garantir que o borderRadius funcione bem
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5,
    },
    nativePicker: {
        color: '#FFF', // Cor do texto selecionado no Picker (iOS/Android)
        backgroundColor: 'transparent', // Fundo transparente para o Picker nativo
        height: 55, // Altura do picker
    },
    pickerItem: {
        color: '#FFF', // Cor do texto dos itens (iOS)
        fontSize: 16,
    },
    webPicker: {
        height: 55,
        width: '100%',
        paddingHorizontal: 20,
        borderRadius: 12,
        marginBottom: 20,
        backgroundColor: '#203A4A',
        color: '#FFF',
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#4A6572',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5,
        backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23ffffff%22%20d%3D%22M287%2069.4L146.2%20209.2%205.4%2069.4c-1.6-1.6-3.6-2.4-5.6-2.4h-3.4c-2%200-4%200.8-5.6%202.4-3.2%203.2-3.2%208.2%200%2011.4l150%20150c1.6%201.6%203.6%202.4%205.6%202.4s4-0.8%205.6-2.4l150-150c3.2-3.2%203.2-8.2%200-11.4-1.6-1.6-3.6-2.4-5.6-2.4h-3.4c-2%200-4%200.8-5.6%202.4z%22%2F%3E%3C%2Fsvg%3E")', // Seta personalizada para o select
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 15px top 50%',
        backgroundSize: '12px auto',
    },
    staticFieldLabel: {
        fontSize: 14,
        color: '#E0E0E0',
        marginBottom: 5,
        paddingLeft: 5,
        fontWeight: '600',
    },
    staticField: {
        backgroundColor: '#203A4A',
        padding: 15,
        borderRadius: 12,
        marginBottom: 20,
        color: '#FFF',
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#4A6572',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    totalValueDisplay: {
        backgroundColor: '#203A4A',
        padding: 15,
        borderRadius: 12,
        marginBottom: 30,
        color: '#00C2CB', // Cor de destaque para o valor total
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
        borderWidth: 1,
        borderColor: '#00C2CB',
        shadowColor: '#00C2CB',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
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
        backgroundColor: '#4A6572', // Tom de azul acinzentado para o botão cancelar
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
        backgroundColor: '#00C2CB', // Um toque de azul ciano para o FAB
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
