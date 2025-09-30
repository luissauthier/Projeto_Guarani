import { useAuth } from '@/src/contexts/AuthContext';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '@/src/lib/supabase';
import { Feather } from '@expo/vector-icons';

type Treino = {
  id: string;
  data_hora: string;   // timestamptz
  treinador_id: string;
  local: string | null;
  descricao: string | null;
};

export default function TabOneScreen() {
  const { setAuth, user, isAdmin, isCoach } = useAuth();

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    setAuth(null);
    if (error) Alert.alert('Erro', 'Erro ao sair da conta, tente mais tarde.');
  }

  const [treinos, setTreinos] = useState<Treino[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // mini-form para criar treino
  const [criando, setCriando] = useState(false);
  const [dataHora, setDataHora] = useState(''); // "AAAA-MM-DD HH:MM"
  const [local, setLocal] = useState('');
  const [descricao, setDescricao] = useState('');

  const loadTreinos = useCallback(async () => {
    setLoading(true);
    // RLS já filtra: coach só enxerga os dele; admin enxerga tudo
    const { data, error } = await supabase
      .from('treinos')
      .select('*')
      .gte('data_hora', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // últimos 1 dia + futuros
      .order('data_hora', { ascending: true });

    if (error) {
      Alert.alert('Erro', error.message);
      setTreinos([]);
    } else {
      setTreinos((data ?? []) as Treino[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTreinos();
  }, [loadTreinos]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTreinos();
    setRefreshing(false);
  }, [loadTreinos]);

  async function criarTreino() {
    if (!user?.id) return Alert.alert('Erro', 'Usuário não identificado.');
    if (!dataHora.trim()) return Alert.alert('Atenção', 'Informe data e hora (AAAA-MM-DD HH:MM).');

    try {
      setCriando(true);
      // transforma "YYYY-MM-DD HH:mm" em ISO
      const iso = new Date(dataHora.replace(' ', 'T') + ':00').toISOString();

      const { error } = await supabase.from('treinos').insert({
        data_hora: iso,
        treinador_id: user.id,
        local: local || null,
        descricao: descricao || null,
      });

      if (error) throw error;

      setDataHora('');
      setLocal('');
      setDescricao('');
      await loadTreinos();
      Alert.alert('Sucesso', 'Treino criado.');
    } catch (e: any) {
      Alert.alert('Erro ao criar treino', e.message);
    } finally {
      setCriando(false);
    }
  }

  const renderItem = ({ item }: { item: Treino }) => {
    const dt = new Date(item.data_hora);
    return (
<<<<<<< HEAD
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.logoText}>Projeto Guarani</Text>
                <TouchableOpacity onPress={handleSignOut} style={styles.logoutButton}>
                    <Feather name="log-out" size={24} color="#ffffff" /> {/* Cor do ícone de logout */}
                </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Treinos disponíveis</Text>

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
=======
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Feather name="calendar" size={18} color="#00C2CB" />
          <Text style={[styles.modelo, { marginLeft: 8 }]}>{dt.toLocaleString()}</Text>
        </View>
        {!!item.local && <Text style={styles.descricao}>Local: {item.local}</Text>}
        {!!item.descricao && <Text style={styles.descricao}>{item.descricao}</Text>}
        {/* futuro: botão pra abrir detalhes e marcar presenças */}
      </View>
>>>>>>> 3f345bca55994fa30edf5d4ff3102293773c4061
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logoText}>Projeto Guarani</Text>
        <TouchableOpacity onPress={handleSignOut} style={styles.logoutButton}>
          <Feather name="log-out" size={24} color="#00C2CB" />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Treinos</Text>

      {(isAdmin || isCoach) && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ marginBottom: 16 }}
        >
          <View style={styles.formBox}>
            <Text style={{ color: '#fff', fontWeight: 'bold', marginBottom: 10 }}>Novo treino</Text>
            <TextInput
              style={styles.input}
              placeholder="Data e hora (AAAA-MM-DD HH:MM)"
              placeholderTextColor="#A0A0A0"
              value={dataHora}
              onChangeText={setDataHora}
            />
            <TextInput
              style={styles.input}
              placeholder="Local (opcional)"
              placeholderTextColor="#A0A0A0"
              value={local}
              onChangeText={setLocal}
            />
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Descrição (opcional)"
              placeholderTextColor="#A0A0A0"
              value={descricao}
              onChangeText={setDescricao}
              multiline
            />
            <TouchableOpacity style={styles.primaryButton} onPress={criarTreino} disabled={criando}>
              {criando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Criar treino</Text>}
            </TouchableOpacity>
            <Text style={{ color: '#B0B0B0', fontSize: 12, marginTop: 6 }}>
              {isAdmin ? 'Você é admin: enxerga todos os treinos.' : 'Você é coach: enxerga apenas os seus treinos.'}
            </Text>
          </View>
        </KeyboardAvoidingView>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#007BFF" style={styles.loadingIndicator} />
      ) : (
        <FlatList
          data={treinos}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          style={styles.list}
          contentContainerStyle={styles.listContentContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.emptyText}>Nenhum treino encontrado.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
<<<<<<< HEAD
    container: {
        flex: 1,
        backgroundColor: '#18641c', // Fundo principal
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
        backgroundColor: '#2aa530', // Cor de fundo do cartão
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
        backgroundColor: '#59b95e', // Um toque de azul ciano para o FAB
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000000',
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
=======
  container: { flex: 1, backgroundColor: '#0A1931', paddingHorizontal: 16 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 20, marginBottom: 10, marginHorizontal: 8,
  },
  logoText: {
    fontSize: 32, fontWeight: '800', color: '#FFF',
    textShadowColor: 'rgba(0, 0, 0, 0.2)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3,
  },
  logoutButton: { padding: 8 },
  sectionTitle: { fontSize: 26, fontWeight: '700', color: '#FFF', textAlign: 'center', marginBottom: 16 },
  formBox: {
    backgroundColor: '#1E2F47', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#3A506B',
  },
  input: {
    height: 55, backgroundColor: '#203A4A', borderRadius: 12, paddingHorizontal: 20, marginBottom: 12,
    color: '#FFF', fontSize: 16, borderWidth: 1, borderColor: '#4A6572',
  },
  primaryButton: {
    backgroundColor: '#007BFF', paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    marginTop: 4, shadowColor: '#007BFF', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  buttonText: { color: '#FFF', fontSize: 15, fontWeight: 'bold', textTransform: 'uppercase' },
  list: { flex: 1, width: '100%' },
  listContentContainer: { paddingBottom: 40 },
  card: {
    backgroundColor: '#1E2F47', borderRadius: 12, marginBottom: 12, padding: 15, elevation: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6,
    marginHorizontal: 4, borderWidth: 1, borderColor: '#3A506B',
  },
  modelo: { fontSize: 18, fontWeight: 'bold', color: '#FFF' },
  descricao: { fontSize: 14, color: '#B0B0B0', marginTop: 4 },
  emptyText: { color: '#E0E0E0', textAlign: 'center', marginVertical: 40, fontSize: 16 },
  loadingIndicator: { marginTop: 50 },
});
>>>>>>> 3f345bca55994fa30edf5d4ff3102293773c4061
