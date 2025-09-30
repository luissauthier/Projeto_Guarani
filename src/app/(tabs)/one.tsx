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
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Feather name="calendar" size={18} color="#00C2CB" />
          <Text style={[styles.modelo, { marginLeft: 8 }]}>{dt.toLocaleString()}</Text>
        </View>
        {!!item.local && <Text style={styles.descricao}>Local: {item.local}</Text>}
        {!!item.descricao && <Text style={styles.descricao}>{item.descricao}</Text>}
        {/* futuro: botão pra abrir detalhes e marcar presenças */}
      </View>
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
