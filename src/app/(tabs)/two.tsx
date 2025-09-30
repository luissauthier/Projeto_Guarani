import { useAuth } from '@/src/contexts/AuthContext';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { supabase } from '@/src/lib/supabase';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

type Jogador = {
  id: string;
  nome: string;
  categoria: string | null;
  created_at: string;
  status: 'pre_inscrito' | 'ativo' | 'inativo';
};

export default function TabTwoScreen() {
  const { isAdmin } = useAuth();

  useEffect(() => {
    if (!isAdmin) {
      Alert.alert('Acesso Negado', 'Você não tem permissão para acessar esta tela.');
      router.replace('/(tabs)/one');
    }
  }, [isAdmin]);

  if (!isAdmin) return null;

  const [items, setItems] = useState<Jogador[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [aprovando, setAprovando] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('jogadores')
      .select('id, nome, categoria, created_at, status')
      .eq('status', 'pre_inscrito')
      .order('created_at', { ascending: true });

    if (error) {
      Alert.alert('Erro', error.message);
      setItems([]);
    } else {
      setItems((data ?? []) as Jogador[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  async function aprovar(id: string) {
    try {
      setAprovando(id);
      const { error } = await supabase
        .from('jogadores')
        .update({ status: 'ativo', atualizado_em: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      await load();
      Alert.alert('Sucesso', 'Jogador aprovado e marcado como ativo.');
    } catch (e: any) {
      Alert.alert('Erro ao aprovar', e.message);
    } finally {
      setAprovando(null);
    }
  }

  const renderItem = ({ item }: { item: Jogador }) => {
    const dt = new Date(item.created_at);
    return (
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Feather name="user-plus" size={18} color="#00C2CB" />
          <Text style={[styles.modelo, { marginLeft: 8 }]}>{item.nome}</Text>
        </View>
        <Text style={styles.descricao}>Categoria: {item.categoria || '-'}</Text>
        <Text style={styles.descricao}>Pré-inscrito em {dt.toLocaleString()}</Text>

        <TouchableOpacity
          onPress={() => aprovar(item.id)}
          disabled={aprovando === item.id}
          style={styles.primaryButton}
        >
          {aprovando === item.id ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Aprovar</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logoText}>Projeto Guarani</Text>
      </View>

      <Text style={styles.sectionTitle}>Administrativo</Text>
      <Text style={{ color: '#B0B0B0', textAlign: 'center', marginBottom: 12 }}>
        Pré-inscrições pendentes
      </Text>

      {loading ? (
        <ActivityIndicator size="large" color="#007BFF" style={styles.loadingIndicator} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          style={styles.list}
          contentContainerStyle={styles.listContentContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.emptyText}>Sem pré-inscrições no momento.</Text>}
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
  sectionTitle: { fontSize: 26, fontWeight: '700', color: '#FFF', textAlign: 'center', marginBottom: 10 },
  list: { flex: 1, width: '100%' },
  listContentContainer: { paddingBottom: 40 },
  card: {
    backgroundColor: '#1E2F47', borderRadius: 12, marginBottom: 12, padding: 15, elevation: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6,
    marginHorizontal: 4, borderWidth: 1, borderColor: '#3A506B',
  },
  modelo: { fontSize: 18, fontWeight: 'bold', color: '#FFF' },
  descricao: { fontSize: 14, color: '#B0B0B0', marginTop: 4 },
  primaryButton: {
    backgroundColor: '#18641c', paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    justifyContent: 'center', marginTop: 12,
  },
  buttonText: { color: '#FFF', fontSize: 15, fontWeight: 'bold', textTransform: 'uppercase' },
  emptyText: { color: '#E0E0E0', textAlign: 'center', marginVertical: 40, fontSize: 16 },
  loadingIndicator: { marginTop: 50 },
});
