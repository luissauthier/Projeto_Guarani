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

  // banner de debug
  const [debugMsg, setDebugMsg] = useState<string | null>(null);

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    setAuth(null);
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
    } else {
      setTreinos((data ?? []) as Treino[]);
    }
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
    const q = supabase.from('jogadores')
      .select('id, nome, categoria, status')
      .eq('status', 'ativo')
      .order('categoria', { ascending: false });

    const { data, error } = await q;
    console.log('[loadJogadoresAtivos] error:', error, 'rows:', data?.length);
    if (error) {
      Alert.alert('Erro', error.message);
      setJogadores([]);
    } else {
      setJogadores((data ?? []) as any);
    }
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
    // CORRIGIDO: formata para horário local (evita "+3")
    setDataHora(formatLocalForInput(t.data_hora));
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
    if (yf) list = list.filter(j => j.categoria && j.categoria >= yf);
    if (yt) list = list.filter(j => j.categoria && j.categoria <= yt);
    const q = searchJog.trim().toLowerCase();
    if (q) list = list.filter(j => j.nome.toLowerCase().includes(q) || String(j.categoria ?? '').includes(q));
    return list;
  }, [jogadores, yearFrom, yearTo, searchJog]);

  function toggleSel(id: string) {
    setSel(s => ({ ...s, [id]: !s[id] }));
  }

  // Aceita "AAAA-MM-DD" | "AAAA-MM-DD HH:MM" | "AAAA-MM-DD HH:MM:SS"
  // Retorna "AAAA-MM-DDTHH:MM:SS±HH:MM"
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

  async function save() {
    if (saving) return;
    if (!user?.id) {
      Alert.alert('Erro', 'Usuário não identificado.');
      return;
    }
    if (!dataHora.trim()) {
      Alert.alert('Atenção', 'Informe data e hora (AAAA-MM-DD ou AAAA-MM-DD HH:MM).');
      return;
    }

    const ts = toPgTimestamptzWithOffset(dataHora);
    if (!ts) {
      Alert.alert('Atenção', 'Formato inválido. Use AAAA-MM-DD ou AAAA-MM-DD HH:MM.');
      return;
    }

    try {
      setSaving(true);

      if (editTreino) {
        // ===== UPDATE =====
        console.log('[treinos.update] ts->', ts, 'editTreino.id->', editTreino!.id);

        const { data: rows, error: upErr } = await supabase
          .from('treinos')
          .update({
            data_hora: ts,
            local: local || null,
            descricao: descricao || null,
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', editTreino.id)
          .select('*'); // sem .single()

        if (upErr) throw upErr;
        if (!rows || rows.length === 0) {
          Alert.alert('Sem permissão', 'Não foi possível atualizar este treino (RLS).');
          return;
        }

        const atualizado = rows[0];
        setModal(false);
        setTreinos(prev =>
          prev
            .map(t => (t.id === atualizado.id ? { ...t, ...atualizado } : t))
            .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())
        );
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
          })
          .select('*')
          .single();

        if (error) throw error;

        setModal(false);
        setTreinos(prev =>
          [...prev, novo!].sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())
        );

        // presenças apenas na criação
        const selecionados = Object.keys(sel).filter((id) => sel[id]);
        if (selecionados.length > 0) {
          const rows = selecionados.map((jid) => ({
            treino_id: novo!.id,
            jogador_id: jid,
            status: 'presente',
          }));
          const { error: errPres } = await supabase.from('presenca').insert(rows);
          if (errPres) throw errPres;
        }

        await loadTreinos();
        Alert.alert('Sucesso', 'Treino criado.');
      }
    } catch (e: any) {
      console.log('[save] erro:', e);
      Alert.alert('Erro', e?.message ?? 'Falha ao salvar treino.');
    } finally {
      setSaving(false);
    }
  }

  async function deletarTreino(id: string) {
    console.log('[UI] deletarTreino start', id);
    await debugLogSession();
    try {
      // 1) apaga presenças do treino
      const delPres = await supabase.from('presenca').delete().eq('treino_id', id).select('id');
      if (delPres.error) {
        const msg = debugSbError('delete presenca(treino)', delPres.error);
        setDebugMsg(msg);
        return;
      }
      console.log('[DEL presenca count]', delPres.data?.length ?? 0);

      // 2) apaga o treino
      const delTre = await supabase.from('treinos').delete().eq('id', id).select('id');
      if (delTre.error) {
        const msg = debugSbError('delete treino', delTre.error);
        setDebugMsg(msg);
        return;
      }
      console.log('[DEL treinos count]', delTre.data?.length ?? 0);

      // 3) recarrega lista
      await loadTreinos();
      setDebugMsg('✅ Treino excluído com sucesso.');
    } catch (e: any) {
      const msg = debugSbError('delete treino catch', e);
      setDebugMsg(msg);
    }
  }

  function renderItem({ item }: { item: Treino }) {
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
        <Text style={styles.title}>{dt.toLocaleString()}</Text>
        {!!item.local && <Text style={styles.line}>Local: {item.local}</Text>}
        {!!item.descricao && <Text style={styles.line}>{item.descricao}</Text>}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => openEdit(item)}>
            <Text style={styles.btnText}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnDanger}
            onPress={() => {
              console.log('[UI] TAP Excluir Treino');
              deletarTreino(item.id);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.btnText}>Excluir</Text>
          </TouchableOpacity>
        </View>
      </View>
>>>>>>> 3f345bca55994fa30edf5d4ff3102293773c4061
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>Projeto Guarani</Text>
        <TouchableOpacity onPress={handleSignOut}><Feather name="log-out" size={24} color="#00C2CB" /></TouchableOpacity>
      </View>

      {/* Banner de debug */}
      {debugMsg ? (
        <View style={{ backgroundColor: '#FFCF66', padding: 8, borderRadius: 8, marginBottom: 8 }}>
          <Text style={{ color: '#000' }}>{debugMsg}</Text>
        </View>
      ) : null}

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
          extraData={treinos}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={<Text style={styles.empty}>Nenhum treino.</Text>}
        />
      )}

      {/* MODAL CRIAR/EDITAR */}
      <Modal visible={modal} animationType="slide" onRequestClose={() => setModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1931' }}>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
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

            {/* SELEÇÃO DE JOGADORES */}
            <View style={styles.box}>
              <Text style={{ color: '#fff', fontWeight: 'bold', marginBottom: 8 }}>Selecionar jogadores (ativos)</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Ano de (ex: 2008)"
                  placeholderTextColor="#A0A0A0"
                  value={yearFrom}
                  onChangeText={setYearFrom}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Ano até (ex: 2015)"
                  placeholderTextColor="#A0A0A0"
                  value={yearTo}
                  onChangeText={setYearTo}
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

              {jogadoresFiltrados.map(j => (
                <View key={j.id} style={styles.rowSel}>
                  <Text style={{ color: '#fff', flex: 1 }}>{j.nome} {j.categoria ? `(${j.categoria})` : ''}</Text>
                  <Switch value={!!sel[j.id]} onValueChange={() => toggleSel(j.id)} />
                </View>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity style={[styles.btnPrimary, { flex: 1 }]} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Salvar</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnNeutral, { flex: 1 }]} onPress={() => setModal(false)}>
                <Text style={styles.btnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

/* ================= Styles ================= */

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
    borderRadius: 10, flexDirection: 'row', alignItems: 'center'
  },
  btnDanger: { backgroundColor: '#FF4C4C', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  btnNeutral: { backgroundColor: '#4A6572', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: 'bold' },

  box: {
    backgroundColor: '#1E2F47', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#3A506B', marginBottom: 12
  },
  rowSel: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#203A4A'
  },
});
>>>>>>> 3f345bca55994fa30edf5d4ff3102293773c4061
