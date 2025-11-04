import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, SafeAreaView, StyleSheet, Text, View, FlatList, ActivityIndicator,
  TouchableOpacity, TextInput, Modal, ScrollView, Switch
} from 'react-native';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { Feather } from '@expo/vector-icons';

/* ================= Helpers (fora do componente, não usam hooks) ================= */

function debugSbError(ctx: string, error: any) {
  const msg = [
    `⛔ ${ctx}`,
    error?.message && `message: ${error.message}`,
    error?.code && `code: ${error.code}`,
    error?.details && `details: ${error.details}`,
    error?.hint && `hint: ${error.hint}`,
  ].filter(Boolean).join('\n');
  console.log('[SUPABASE ERROR]', ctx, error);
  return msg;
}

async function debugLogSession() {
  try {
    const { data } = await supabase.auth.getSession();
    console.log('[SESSION]', {
      hasSession: !!data?.session,
      uid: data?.session?.user?.id,
      email: data?.session?.user?.email,
    });
  } catch (e) {
    console.log('[SESSION][ERR]', e);
  }
}

function formatLocalForInput(iso: string) {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

/* ================= Types ================= */

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

/* ================= Component ================= */

export default function TreinosScreen() {
  const { setAuth, user, isAdmin, isCoach } = useAuth();
  const [debugMsg, setDebugMsg] = useState<string | null>(null);

  useEffect(() => {
    if (debugMsg) {
      const timer = setTimeout(() => {
        setDebugMsg(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [debugMsg]);

  const [treinos, setTreinos] = useState<Treino[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);
  const [treinoToDelete, setTreinoToDelete] = useState<Treino | null>(null);
  
  const [modal, setModal] = useState(false);
  const [editTreino, setEditTreino] = useState<Treino | null>(null);
  
  const [dataHora, setDataHora] = useState('');
  const [local, setLocal] = useState('');
  const [descricao, setDescricao] = useState('');
  const [saving, setSaving] = useState(false);
  
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  
  const [yearFrom, setYearFrom] = useState<string>('');
  const [yearTo, setYearTo] = useState<string>('');
  const [searchJog, setSearchJog] = useState('');

  // --- contagem de presenças por treino ---
  const [presCount, setPresCount] = useState<Record<string, number>>({});

  // Sanitiza input pra só dígitos (0–9) e handlers dos anos
  function onlyDigits(v: string) {
    return v.replace(/\D/g, '');
  }
  function handleYearFrom(v: string) {
    setYearFrom(onlyDigits(v));
  }
  function handleYearTo(v: string) {
    setYearTo(onlyDigits(v));
  }

  const loadPresencasCount = useCallback(async () => {
    const { data, error } = await supabase
      .from('presenca')
      .select('treino_id');

    if (error) {
      console.log('[presenca][count] erro:', error);
      setPresCount({});
      return;
    }

    const map: Record<string, number> = {};
    (data ?? []).forEach((row: any) => {
      const id = row.treino_id as string;
      map[id] = (map[id] ?? 0) + 1;
    });
    setPresCount(map);
  }, []);

  const loadTreinos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('treinos')
      .select('*')
      .order('data_hora', { ascending: true });
    if (error) {
      Alert.alert('Erro', error.message);
      setTreinos([]);
    } else {
      setTreinos((data ?? []) as Treino[]);
    }

    await loadPresencasCount(); // atualiza contagem junto
    setLoading(false);
  }, [loadPresencasCount]);

  useEffect(() => { loadTreinos(); }, [loadTreinos]);

  async function loadJogadoresAtivos() {
    const { data, error } = await supabase
      .from('jogadores')
      .select('id, nome, categoria, status')
      .eq('status', 'ativo')
      .order('nome', { ascending: true }); 

    if (error) {
      Alert.alert('Erro ao carregar jogadores', error.message);
      setJogadores([]);
    } else {
      setJogadores((data ?? []) as any);
    }
  }

  // --- CORREÇÃO: Função para buscar presenças existentes ---
  async function loadExistingPresences(treinoId: string) {
    const { data, error } = await supabase
      .from('presenca')
      .select('jogador_id')
      .eq('treino_id', treinoId);

    if (error) {
      console.error("Erro ao buscar presenças:", error);
      return {};
    }

    const presencesMap = (data ?? []).reduce((acc, item) => {
      acc[item.jogador_id] = true;
      return acc;
    }, {} as Record<string, boolean>);

    setSel(presencesMap);
  }

  function openCreate() {
    setEditTreino(null);
    setDataHora('');
    setLocal('');
    setDescricao('');
    setSel({}); // Limpa seleções antigas
    setModal(true);
    loadJogadoresAtivos();
  }

  // --- CORREÇÃO: Chama a busca de presenças ao editar ---
  async function openEdit(t: Treino) {
    setEditTreino(t);
    setDataHora(formatLocalForInput(t.data_hora));
    setLocal(t.local ?? '');
    setDescricao(t.descricao ?? '');
    setModal(true);
    await loadJogadoresAtivos();
    await loadExistingPresences(t.id); // Busca presenças existentes
  }
  
  function openDeleteConfirm(treino: Treino) {
    setTreinoToDelete(treino);
    setDeleteModalVisible(true);
  }

  function closeDeleteConfirm() {
    setTreinoToDelete(null);
    setDeleteModalVisible(false);
  }

  async function handleConfirmDelete() {
    if (!treinoToDelete) return;
    await deletarTreino(treinoToDelete.id);
    closeDeleteConfirm();
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    setAuth(null);
    if (error) Alert.alert('Erro', 'Erro ao retornar para página de login, tente mais tarde.');
  }

  const jogadoresFiltrados = useMemo(() => {
    let list = jogadores;

    // só considera o filtro quando tiver exatamente 4 dígitos
    const yf = yearFrom.length === 4 ? Number(yearFrom) : null; // DE (>=)
    const yt = yearTo.length === 4 ? Number(yearTo) : null;     // ATÉ (<=)

    // aplica limites de forma independente, sem inverter automaticamente
    if (yf !== null) list = list.filter(j => j.categoria != null && j.categoria >= yf);
    if (yt !== null) list = list.filter(j => j.categoria != null && j.categoria <= yt);

    const q = searchJog.trim().toLowerCase();
    if (q) {
      list = list.filter(j =>
        j.nome.toLowerCase().includes(q) ||
        String(j.categoria ?? '').includes(q)
      );
    }
    return list;
  }, [jogadores, yearFrom, yearTo, searchJog]);

  function toggleSel(id: string) {
    setSel(s => ({ ...s, [id]: !s[id] }));
  }

  function toPgTimestamptzWithOffset(input: string) {
    const raw = input.trim();
    if (!raw) return null;

    let base = raw.replace(' ', 'T');
    if (/^\d{4}-\d{2}-\d{2}$/.test(base)) base += 'T00:00:00';
    else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(base)) base += ':00';
    else if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(base)) return null;

    const d = new Date(base);
    if (isNaN(d.getTime())) return null;
    const offMin = -d.getTimezoneOffset();
    const sign = offMin >= 0 ? '+' : '-';
    const hh = String(Math.floor(Math.abs(offMin) / 60)).padStart(2, '0');
    const mm = String(Math.abs(offMin) % 60).padStart(2, '0');

    return `${base}${sign}${hh}:${mm}`;
  }

  // --- CORREÇÃO: Função para salvar/atualizar presenças ---
  async function updatePresencas(treinoId: string) {
    const { error: deleteError } = await supabase
      .from('presenca')
      .delete()
      .eq('treino_id', treinoId);

    if (deleteError) {
      throw new Error(`Erro ao apagar presenças antigas: ${deleteError.message}`);
    }

    const selecionados = Object.keys(sel).filter((id) => sel[id]);
    if (selecionados.length === 0) {
      return;
    }

    const rows = selecionados.map((jid) => ({
      treino_id: treinoId,
      jogador_id: jid,
      status: 'presente',
    }));

    const { error: insertError } = await supabase.from('presenca').insert(rows);
    if (insertError) {
      throw new Error(`Erro ao inserir novas presenças: ${insertError.message}`);
    }
  }

  // --- CORREÇÃO: Lógica de `save` ajustada ---
  async function save() {
    if (saving) return;
    if (!user?.id) {
      Alert.alert('Erro', 'Usuário não identificado.');
      return;
    }
    const ts = toPgTimestamptzWithOffset(dataHora);
    if (!ts) {
      Alert.alert('Atenção', 'Formato de data inválido. Use AAAA-MM-DD ou AAAA-MM-DD HH:MM.');
      return;
    }

    setSaving(true);
    try {
      if (editTreino) {
        // ===== UPDATE =====
        const { data: updatedTreino, error: updateError } = await supabase
          .from('treinos')
          .update({
            data_hora: ts,
            local: local || null,
            descricao: descricao || null,
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', editTreino.id)
          .select()
          .single();

        if (updateError) throw updateError;
        if (!updatedTreino) {
            throw new Error("Não foi possível encontrar o treino para atualizar.");
        }

        await updatePresencas(updatedTreino.id);
        
        setModal(false);
        await loadTreinos();
        Alert.alert('Sucesso', 'Treino atualizado.');

      } else {
        // ===== INSERT =====
        const { data: novo, error } = await supabase
          .from('treinos')
          .insert({
            data_hora: ts,
            local: local || null,
            descricao: descricao || null,
            treinador_id: user.id,
          })
          .select('*')
          .single();

        if (error) throw error;
        if (!novo) throw new Error("Falha ao criar o treino.");

        await updatePresencas(novo.id);
        
        setModal(false);
        await loadTreinos();
        Alert.alert('Sucesso', 'Treino criado.');
      }
    } catch (e: any) {
      console.log('[save] erro:', e);
      const errorMsg = debugSbError('salvar treino', e);
      Alert.alert('Erro', e?.message ?? 'Falha ao salvar treino.');
      Alert.alert('Erro ao Salvar Treino', errorMsg);
    } finally {
      setSaving(false);
    }
  }

  async function deletarTreino(id: string) {
    await debugLogSession();
    try {
      const delPres = await supabase.from('presenca').delete().eq('treino_id', id);
      if (delPres.error) throw delPres.error;
      
      const delTre = await supabase.from('treinos').delete().eq('id', id);
      if (delTre.error) throw delTre.error;

      await loadTreinos();
      setDebugMsg('✅ Treino excluído com sucesso.');
    } catch (e: any) {
      const msg = debugSbError('delete treino catch', e);
      setDebugMsg(msg);
    }
  }

  function renderItem({ item }: { item: Treino }) {
    const dt = new Date(item.data_hora);
    const presentes = presCount[item.id] ?? 0;

    return (
      <View style={styles.card}>
        <Text style={styles.title}>{dt.toLocaleString()}</Text>
        {!!item.local && <Text style={styles.line}>Local: {item.local}</Text>}
        {!!item.descricao && <Text style={styles.line}>{item.descricao}</Text>}
        <Text style={[styles.line, { fontWeight: '600' }]}>
          Presenças: {presentes}
        </Text>
        {(isAdmin || isCoach) && (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <TouchableOpacity style={styles.btnPrimary} onPress={() => openEdit(item)}>
              <Text style={styles.btnText}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnDanger}
              onPress={() => openDeleteConfirm(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.btnText}>Excluir</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* <View style={styles.header}>
        <Text style={styles.logo}>Projeto Guarani</Text>
        <TouchableOpacity onPress={handleSignOut}><Feather name="log-out" size={24} color="#00C2CB" /></TouchableOpacity>
      </View> */}

      {debugMsg && (
        <View style={styles.debugBanner}>
          <Text style={styles.debugBannerText}>{debugMsg}</Text>
          <TouchableOpacity onPress={() => setDebugMsg(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={20} color="#000" />
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.h1}>Treinos</Text>

      {(isAdmin || isCoach) && (
        <View style={{ marginBottom: 12, alignItems: 'flex-end' }}>
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
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={<Text style={styles.empty}>Nenhum treino.</Text>}
        />
      )}
      
      <Modal visible={modal} animationType="slide" onRequestClose={() => setModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1931' }}>
          <View style={{ flex: 1, padding: 16 }}>
            <Text style={styles.h1}>{editTreino ? 'Editar treino' : 'Novo treino'}</Text>
            
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
              style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
              multiline
              numberOfLines={4}
              placeholder="Descrição/atividades"
              placeholderTextColor="#A0A0A0"
              value={descricao}
              onChangeText={setDescricao}
            />

            <View style={[styles.box, { flex: 1 }]}>
              <Text style={{ color: '#fff', fontWeight: 'bold', marginBottom: 8 }}>Selecionar jogadores (ativos)</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Ano de (ex: 2008)"
                  placeholderTextColor="#A0A0A0"
                  value={yearFrom}
                  onChangeText={handleYearFrom}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Ano até (ex: 2012)"
                  placeholderTextColor="#A0A0A0"
                  value={yearTo}
                  onChangeText={handleYearTo}
                  keyboardType="numeric"
                />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Pesquisar nome/ano"
                placeholderTextColor="#A0A0A0"
                value={searchJog}
                onChangeText={setSearchJog}
              />
              <FlatList
                data={jogadoresFiltrados}
                keyExtractor={(j) => j.id}
                renderItem={({ item }) => (
                  <View style={styles.rowSel}>
                    <Text style={{ color: '#fff', flex: 1 }}>{item.nome} {item.categoria ? `(${item.categoria})` : ''}</Text>
                    <Switch value={!!sel[item.id]} onValueChange={() => toggleSel(item.id)} />
                  </View>
                )}
                ListEmptyComponent={<Text style={styles.empty}>Nenhum jogador ativo encontrado.</Text>}
              />
            </View>
            
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity style={[styles.btnPrimary, { flex: 1 }]} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Salvar</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnNeutral, { flex: 1 }]} onPress={() => setModal(false)}>
                <Text style={styles.btnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={isDeleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeDeleteConfirm}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirmar Exclusão</Text>
            {treinoToDelete && (
              <Text style={styles.modalText}>
                Você tem certeza que deseja excluir o treino do dia{' '}
                <Text style={{ fontWeight: 'bold' }}>
                  {new Date(treinoToDelete.data_hora).toLocaleString()}
                </Text>
                ? Essa ação não pode ser desfeita.
              </Text>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.btnNeutral, { flex: 1 }]} 
                onPress={closeDeleteConfirm}
              >
                <Text style={styles.btnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.btnDanger, { flex: 1 }]} 
                onPress={handleConfirmDelete}
              >
                <Text style={styles.btnText}>Excluir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1931', paddingHorizontal: 16 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 20, marginBottom: 6, marginHorizontal: 8
  },
  logo: { fontSize: 32, fontWeight: '800', color: '#FFF' },
  h1: { color: '#FFF', fontWeight: '700', fontSize: 22, marginBottom: 12, textAlign: 'center' },
  input: {
    height: 50, backgroundColor: '#203A4A', borderRadius: 10, paddingHorizontal: 12,
    color: '#FFF', borderWidth: 1, borderColor: '#4A6572', marginBottom: 10
  },
  card: {
    backgroundColor: '#1E2F47', borderRadius: 12, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: '#3A506B'
  },
  title: { color: '#FFF', fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  line: { color: '#B0B0B0', marginTop: 2 },
  empty: { color: '#E0E0E0', textAlign: 'center', marginVertical: 30, fontSize: 16 },
  btnPrimary: {
    backgroundColor: '#18641c', paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center'
  },
  btnDanger: { 
    backgroundColor: '#FF4C4C', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, 
    alignItems: 'center', justifyContent: 'center' 
  },
  btnNeutral: { 
    backgroundColor: '#4A6572', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center'
  },
  btnText: { color: '#fff', fontWeight: 'bold' },
  box: {
    backgroundColor: '#1E2F47', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#3A506B', marginBottom: 12
  },
  rowSel: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#203A4A'
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    backgroundColor: '#1E2F47',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    width: '90%',
    borderWidth: 1,
    borderColor: '#3A506B',
    alignItems: 'center',
  },
  modalTitle: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 20,
    marginBottom: 12,
  },
  modalText: {
    color: '#B0A0B0',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  debugBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFCF66',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  debugBannerText: {
    color: '#000',
    flex: 1,
    marginRight: 8,
  },
});
