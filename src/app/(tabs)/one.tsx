import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, SafeAreaView, StyleSheet, Text, View, FlatList, ActivityIndicator,
  TouchableOpacity, TextInput, Modal, ScrollView, Switch
} from 'react-native';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { Feather } from '@expo/vector-icons';

type Treino = {
  id: string;
  data_hora: string;
  treinador_id: string;
  local: string | null;
  descricao: string | null;
  created_at: string;
};

type Jogador = {
  id: string;
  nome: string;
  categoria: number | null;
  status: 'pre_inscrito' | 'ativo' | 'inativo';
};

export default function TreinosScreen() {
  const { setAuth, user, isAdmin, isCoach } = useAuth();

//   async function handleSignOut() {
//     const { error } = await supabase.auth.signOut();
//     setAuth(null);
//     if (error) Alert.alert('Erro', 'Erro ao sair da conta, tente mais tarde.');
//   }

  async function handleSignOut() {
          const { error } = await supabase.auth.signOut();
          if (error) Alert.alert('Erro', 'Erro ao retornar para página de login, tente mais tarde.');
        }

  const [treinos, setTreinos] = useState<Treino[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTreinos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('treinos')
      .select('*')
      .order('data_hora', { ascending: true });
    if (error) {
      Alert.alert('Erro', error.message);
      setTreinos([]);
    } else setTreinos((data ?? []) as Treino[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadTreinos(); }, [loadTreinos]);

  // ====== CRIAR / EDITAR ======
  const [modal, setModal] = useState(false);
  const [editTreino, setEditTreino] = useState<Treino | null>(null);

  const [dataHora, setDataHora] = useState('');
  const [local, setLocal] = useState('');
  const [descricao, setDescricao] = useState('');
  const [saving, setSaving] = useState(false);

  // seleção de jogadores
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [sel, setSel] = useState<Record<string, boolean>>({});

  const [yearFrom, setYearFrom] = useState<string>(''); // ex 2008
  const [yearTo, setYearTo] = useState<string>('');     // ex 2015
  const [searchJog, setSearchJog] = useState('');

  async function loadJogadoresAtivos() {
    const { data, error } = await supabase
      .from('jogadores')
      .select('id, nome, categoria, status')
      .eq('status', 'ativo')
      .order('categoria', { ascending: false });
    if (error) {
      Alert.alert('Erro', error.message);
      setJogadores([]);
    } else setJogadores((data ?? []) as any);
  }

  function openCreate() {
    setEditTreino(null);
    setDataHora('');
    setLocal('');
    setDescricao('');
    setSel({});
    setModal(true);
    loadJogadoresAtivos();
  }

  function openEdit(t: Treino) {
    setEditTreino(t);
    setDataHora(t.data_hora.replace('T', ' ').slice(0,16)); // pré-formata
    setLocal(t.local ?? '');
    setDescricao(t.descricao ?? '');
    setSel({});
    setModal(true);
    loadJogadoresAtivos();
  }

  const jogadoresFiltrados = useMemo(() => {
    let list = jogadores;
    const yf = yearFrom ? Number(yearFrom) : null;
    const yt = yearTo ? Number(yearTo) : null;
    if (yf) list = list.filter(j => !j.categoria || j.categoria >= yf);
    if (yt) list = list.filter(j => !j.categoria || j.categoria <= yt);
    const q = searchJog.trim().toLowerCase();
    if (q) list = list.filter(j => j.nome.toLowerCase().includes(q) || String(j.categoria??'').includes(q));
    return list;
  }, [jogadores, yearFrom, yearTo, searchJog]);

  function toggleSel(id: string) {
    setSel(s => ({ ...s, [id]: !s[id] }));
  }

  async function save() {
    if (!user?.id) return Alert.alert('Erro', 'Usuário não identificado.');
    if (!dataHora.trim()) return Alert.alert('Atenção', 'Informe data e hora (AAAA-MM-DD HH:MM).');

    try {
      setSaving(true);
      const iso = new Date(dataHora.replace(' ', 'T') + ':00').toISOString();

      let treinoId = editTreino?.id;
      if (editTreino) {
        // editar
        const { error } = await supabase.from('treinos').update({
          data_hora: iso,
          local: local || null,
          descricao: descricao || null,
          atualizado_em: new Date().toISOString(),
        }).eq('id', editTreino.id);
        if (error) throw error;
      } else {
        // criar
        const { data, error } = await supabase.from('treinos').insert({
          data_hora: iso,
          treinador_id: user.id,
          local: local || null,
          descricao: descricao || null,
        }).select('id').single();
        if (error) throw error;
        treinoId = data.id;
      }

      // presenças (só criamos para selecionados)
      const selecionados = Object.keys(sel).filter(id => sel[id]);
      if (!editTreino && selecionados.length > 0 && treinoId) {
        const rows = selecionados.map(jid => ({
          treino_id: treinoId,
          jogador_id: jid,
          status: 'presente'
        }));
        const { error } = await supabase.from('presenca').insert(rows);
        if (error) throw error;
      }

      setModal(false);
      await loadTreinos();
      Alert.alert('Sucesso', editTreino ? 'Treino atualizado.' : 'Treino criado.');
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function deletarTreino(id: string) {
    Alert.alert('Confirmar', 'Excluir treino?', [
      { text:'Cancelar', style:'cancel' },
      { text:'Excluir', style:'destructive', onPress: async ()=>{
        const { error } = await supabase.from('treinos').delete().eq('id', id);
        if (error) return Alert.alert('Erro', error.message);
        await loadTreinos();
      }}
    ]);
  }

  function renderItem({ item }: { item: Treino }) {
    const dt = new Date(item.data_hora);
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{dt.toLocaleString()}</Text>
        {!!item.local && <Text style={styles.line}>Local: {item.local}</Text>}
        {!!item.descricao && <Text style={styles.line}>{item.descricao}</Text>}
        <View style={{ flexDirection:'row', gap:10, marginTop:8 }}>
          <TouchableOpacity style={styles.btnPrimary} onPress={()=>openEdit(item)}>
            <Text style={styles.btnText}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnDanger} onPress={()=>deletarTreino(item.id)}>
            <Text style={styles.btnText}>Excluir</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>Projeto Guarani</Text>
        <TouchableOpacity onPress={handleSignOut}><Feather name="log-out" size={24} color="#00C2CB" /></TouchableOpacity>
      </View>
      <Text style={styles.h1}>Treinos</Text>

      {(isAdmin || isCoach) && (
        <View style={{ marginBottom:12, alignItems:'flex-end' }}>
          <TouchableOpacity style={styles.btnPrimary} onPress={openCreate}>
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.btnText}>  Novo treino</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color="#007BFF" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={treinos}
          keyExtractor={(t)=>t.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={<Text style={styles.empty}>Nenhum treino.</Text>}
        />
      )}

      {/* MODAL CRIAR/EDITAR */}
      <Modal visible={modal} animationType="slide" onRequestClose={()=>setModal(false)}>
        <SafeAreaView style={{ flex:1, backgroundColor:'#0A1931' }}>
          <ScrollView contentContainerStyle={{ padding:16 }}>
            <Text style={styles.h1}>{editTreino ? 'Editar treino' : 'Novo treino'}</Text>

            <TextInput style={styles.input} placeholder="Data e hora (AAAA-MM-DD HH:MM)" placeholderTextColor="#A0A0A0"
              value={dataHora} onChangeText={setDataHora} />
            <TextInput style={styles.input} placeholder="Local (opcional)" placeholderTextColor="#A0A0A0"
              value={local} onChangeText={setLocal} />
            <TextInput style={[styles.input, { height: 90, textAlignVertical:'top' }]} multiline numberOfLines={4}
              placeholder="Descrição/atividades" placeholderTextColor="#A0A0A0"
              value={descricao} onChangeText={setDescricao} />

            {/* SELEÇÃO DE JOGADORES (só na criação) */}
            {!editTreino && (
              <View style={styles.box}>
                <Text style={{ color:'#fff', fontWeight:'bold', marginBottom:8 }}>Selecionar jogadores (ativos)</Text>
                <View style={{ flexDirection:'row', gap:10 }}>
                  <TextInput style={[styles.input, { flex:1 }]} placeholder="Ano de (ex: 2008)" placeholderTextColor="#A0A0A0"
                    value={yearFrom} onChangeText={setYearFrom} keyboardType="numeric" />
                  <TextInput style={[styles.input, { flex:1 }]} placeholder="Ano até (ex: 2015)" placeholderTextColor="#A0A0A0"
                    value={yearTo} onChangeText={setYearTo} keyboardType="numeric" />
                </View>
                <TextInput style={styles.input} placeholder="Pesquisar nome/ano" placeholderTextColor="#A0A0A0"
                  value={searchJog} onChangeText={setSearchJog} />

                {jogadoresFiltrados.map(j => (
                  <View key={j.id} style={styles.rowSel}>
                    <Text style={{ color:'#fff', flex:1 }}>{j.nome} {j.categoria ? `(${j.categoria})` : ''}</Text>
                    <Switch
                      value={!!sel[j.id]}
                      onValueChange={()=>toggleSel(j.id)}
                    />
                  </View>
                ))}
              </View>
            )}

            <View style={{ flexDirection:'row', gap:10, marginTop:8 }}>
              <TouchableOpacity style={[styles.btnPrimary, { flex:1 }]} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Salvar</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnNeutral, { flex:1 }]} onPress={()=>setModal(false)}>
                <Text style={styles.btnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#0A1931', paddingHorizontal:16 },
  header: { flexDirection:'row', justifyContent:'space-between', alignItems:'center',
    paddingVertical:20, marginBottom:6, marginHorizontal:8 },
  logo: { fontSize:32, fontWeight:'800', color:'#FFF' },
  h1: { color:'#FFF', fontWeight:'700', fontSize:22, marginBottom:12, textAlign:'center' },

  input: { height:50, backgroundColor:'#203A4A', borderRadius:10, paddingHorizontal:12,
    color:'#FFF', borderWidth:1, borderColor:'#4A6572', marginBottom:10 },

  card: { backgroundColor:'#1E2F47', borderRadius:12, padding:12, marginBottom:12, borderWidth:1, borderColor:'#3A506B' },
  title: { color:'#FFF', fontWeight:'bold', fontSize:16, marginBottom:4 },
  line: { color:'#B0B0B0', marginTop:2 },
  empty: { color:'#E0E0E0', textAlign:'center', marginVertical:30, fontSize:16 },

  btnPrimary: { backgroundColor:'#18641c', paddingVertical:10, paddingHorizontal:14, borderRadius:10, flexDirection:'row', alignItems:'center' },
  btnDanger: { backgroundColor:'#FF4C4C', paddingVertical:10, paddingHorizontal:14, borderRadius:10 },
  btnNeutral: { backgroundColor:'#4A6572', paddingVertical:10, paddingHorizontal:14, borderRadius:10 },
  btnText: { color:'#fff', fontWeight:'bold' },

  box: { backgroundColor:'#1E2F47', borderRadius:12, padding:12, borderWidth:1, borderColor:'#3A506B', marginBottom:12 },
  rowSel: { flexDirection:'row', alignItems:'center', gap:10, paddingVertical:8, borderBottomWidth:1, borderBottomColor:'#203A4A' },
});
