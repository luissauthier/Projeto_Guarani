import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, SafeAreaView, StyleSheet, Text, View, TextInput,
  TouchableOpacity, FlatList, ActivityIndicator, Modal, ScrollView, Image
} from 'react-native';
import { useAuth } from '@/src/contexts/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

/* ============== Helpers (fora do componente, não usam hooks) ============== */
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

/* ============== Tipos ============== */
type StatusJog = 'pre_inscrito' | 'ativo' | 'inativo';
type TipoVol = 'assistente' | 'preparador' | 'coord' | 'outro';

type Jogador = {
  id: string;
  nome: string;
  data_nascimento: string | null;
  categoria: number | null; // ano
  telefone: string | null;
  email: string | null;
  responsavel_nome: string | null;
  foto_path: string | null;
  doc_id_frente_path: string | null;
  doc_id_verso_path: string | null;
  termo_assinado_path: string | null;
  status: StatusJog;
  created_at: string;
  atualizado_em?: string | null;
};

type Voluntario = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  tipo: TipoVol;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string | null;
};

const STATUS_OPTIONS: StatusJog[] = ['pre_inscrito','ativo','inativo'];
const VOL_TIPOS: TipoVol[] = ['assistente','preparador','coord','outro'];
const getCategoriaAno = (j: Jogador) =>
  j.categoria ?? (j.data_nascimento ? new Date(j.data_nascimento).getFullYear() : null);

// formata DATE do Postgres ("YYYY-MM-DD") sem aplicar fuso
const formatPgDateOnly = (s?: string | null) => {
  if (!s) return '-';
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d.padStart(2,'0')}/${m.padStart(2,'0')}/${y}`;
};

/* ============== Componente ============== */
export default function AdminScreen() {
  const { isAdmin } = useAuth();
  useEffect(() => {
    if (!isAdmin) {
      Alert.alert('Acesso Negado', 'Você não tem permissão para acessar esta tela.');
      router.replace('/(tabs)/one');
    }
  }, [isAdmin]);
  if (!isAdmin) return null;

  const [debugMsg, setDebugMsg] = useState<string | null>(null);

  const [tab, setTab] = useState<'jogadores' | 'voluntarios'>('jogadores');

  // BUSCA + FILTROS
  const [search, setSearch] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusJog | 'todos'>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState<number | 'todos'>('todos');
  const [filtroTipoVol, setFiltroTipoVol] = useState<TipoVol | 'todos'>('todos');
  const [filtroAtivo, setFiltroAtivo] = useState<'todos' | 'ativos' | 'inativos'>('todos');

  // DATA
  const [loading, setLoading] = useState(true);
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [voluntarios, setVoluntarios] = useState<Voluntario[]>([]);

  const anosDisponiveis = useMemo(() => {
    const anos = new Set<number>();
    jogadores.forEach(j => { if (j.categoria) anos.add(j.categoria); });
    return Array.from(anos).sort((a,b)=>b-a);
  }, [jogadores]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: jog, error: ej } = await supabase
      .from('jogadores')
      .select('id,nome,data_nascimento,categoria,telefone,email,responsavel_nome,foto_path,doc_id_frente_path,doc_id_verso_path,termo_assinado_path,status,created_at,atualizado_em')
      .order('created_at', { ascending: false });
    if (ej) {
      console.log('jogadores err:', ej);
      Alert.alert('Erro', ej.message);
      setJogadores([]);
    } else {
      setJogadores((jog ?? []) as any);
    }

    const { data: vol, error: ev } = await supabase
      .from('voluntarios')
      .select('*')
      .order('created_at', { ascending: false });
    if (ev) console.log('voluntarios err:', ev);
    setVoluntarios((vol ?? []) as any);

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // FILTROS in-memory
  const jogadoresFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jogadores.filter(j => {
      if (filtroStatus !== 'todos' && j.status !== filtroStatus) return false;
      if (filtroCategoria !== 'todos') {
        const cat = getCategoriaAno(j);
        if (cat !== filtroCategoria) return false;
      }
      if (!q) return true;
      const catStr = getCategoriaAno(j)?.toString() ?? '';
      const blob = [j.nome, j.email ?? '', j.telefone ?? '', catStr, j.status, j.responsavel_nome ?? '']
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [jogadores, search, filtroStatus, filtroCategoria]);

  const voluntariosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return voluntarios.filter(v => {
      if (filtroTipoVol !== 'todos' && v.tipo !== filtroTipoVol) return false;
      if (filtroAtivo === 'ativos' && !v.ativo) return false;
      if (filtroAtivo === 'inativos' && v.ativo) return false;
      if (!q) return true;
      const blob = [v.nome, v.email ?? '', v.telefone ?? '', v.tipo, v.ativo ? 'ativo':'inativo']
        .join(' ').toLowerCase();
      return blob.includes(q);
    });
  }, [voluntarios, search, filtroTipoVol, filtroAtivo]);

  // ====== MODAIS JOGADOR ======
  const [modalJog, setModalJog] = useState(false);
  const [editJog, setEditJog] = useState<Jogador | null>(null);
  const [formJog, setFormJog] = useState<Partial<Jogador>>({});

  // Uploads (foto/doc/termo)
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [docFrenteUri, setDocFrenteUri] = useState<string | null>(null);
  const [docVersoUri, setDocVersoUri] = useState<string | null>(null);
  const [termoUri, setTermoUri] = useState<string | null>(null);

  const [uploading, setUploading] = useState<'foto'|'doc_frente'|'doc_verso'|'termo'|null>(null);
  const [savingJog, setSavingJog] = useState(false);

  function openEditJog(j?: Jogador) {
    if (j) { setEditJog(j); setFormJog(j); }
    else { setEditJog(null); setFormJog({ status: 'pre_inscrito' as StatusJog }); }
    setFotoUri(null); setDocFrenteUri(null); setDocVersoUri(null); setTermoUri(null);
    setModalJog(true);
  }

  async function pick(kind: 'foto'|'doc_frente'|'doc_verso'|'termo') {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permissão', 'Autorize acesso à galeria.');
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8
    });
    if (r.canceled) return;
    const uri = r.assets[0].uri;
    if (kind === 'foto') setFotoUri(uri);
    if (kind === 'doc_frente') setDocFrenteUri(uri);
    if (kind === 'doc_verso') setDocVersoUri(uri);
    if (kind === 'termo') setTermoUri(uri);
  }

  async function uploadIfNeeded(localUri: string | null, defaultPath: string | null, kind: 'foto'|'doc_frente'|'doc_verso'|'termo') {
    if (!localUri) return defaultPath ?? null;
    setUploading(kind);
    try {
      const res = await fetch(localUri);
      const blob = await res.blob();
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const folder = kind === 'termo' ? 'termos' : 'preinscricao';
      const path = `${folder}/${filename}`;
      const { error } = await supabase.storage.from('jogadores').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if (error) throw error;
      return path;
    } finally {
      setUploading(null);
    }
  }

  async function saveJogador() {
    if (!formJog?.nome?.trim()) return Alert.alert('Atenção', 'Informe o nome.');
    if (!formJog?.telefone?.trim()) return Alert.alert('Atenção', 'Informe o telefone.');
    try {
      setSavingJog(true);

      const foto_path = await uploadIfNeeded(fotoUri, formJog.foto_path ?? null, 'foto');
      const doc_id_frente_path = await uploadIfNeeded(docFrenteUri, formJog.doc_id_frente_path ?? null, 'doc_frente');
      const doc_id_verso_path = await uploadIfNeeded(docVersoUri, formJog.doc_id_verso_path ?? null, 'doc_verso');
      const termo_assinado_path = await uploadIfNeeded(termoUri, formJog.termo_assinado_path ?? null, 'termo');

      const payload: Partial<Jogador> = {
        nome: formJog.nome,
        data_nascimento: formJog.data_nascimento ?? null,
        telefone: formJog.telefone ?? null,
        email: formJog.email ?? null,
        responsavel_nome: formJog.responsavel_nome ?? null,
        foto_path,
        doc_id_frente_path,
        doc_id_verso_path,
        termo_assinado_path,
        status: (formJog.status as StatusJog) ?? 'pre_inscrito',
        atualizado_em: new Date().toISOString(),
      };

      let err;
      if (editJog) {
        const { error } = await supabase.from('jogadores').update(payload).eq('id', editJog.id);
        err = error;
      } else {
        const { error } = await supabase.from('jogadores').insert(payload as any);
        err = error;
      }
      if (err) {
        console.log('saveJogador err:', err);
        throw err;
      }

      setModalJog(false);
      await load();
      Alert.alert('Sucesso', 'Dados do jogador salvos.');
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Falha ao salvar.');
    } finally {
      setSavingJog(false);
      setUploading(null);
    }
  }

  /* ================= Excluir JOGADOR (direto com logs) ================= */
  async function deletarJog(id: string) {
  console.log('[UI] deletarJog start', id);
  await debugLogSession();

  try {
    // 1. Buscar o nome do jogador para confirmar a exclusão
    const { data: jogador, error: jogadorError } = await supabase
      .from('jogadores')
      .select('nome') // Altere 'nome' se o nome da sua coluna for diferente
      .eq('id', id)
      .single(); // .single() para obter um único objeto, não um array

    if (jogadorError || !jogador) {
      const msg = debugSbError('buscar jogador para deletar', jogadorError || new Error('Jogador não encontrado.'));
      setDebugMsg(msg);
      return;
    }

    // 2. Criar a mensagem de confirmação e exibir a caixa de diálogo
    const mensagemConfirmacao = `Você tem certeza que deseja excluir o jogador "${jogador.nome}"? Esta ação não pode ser desfeita.`;
    const confirmado = window.confirm(mensagemConfirmacao);

    // 3. Se o usuário não confirmar, interromper a execução da função
    if (!confirmado) {
      console.log('[UI] Exclusão cancelada pelo usuário.');
      setDebugMsg('ℹ️ Exclusão cancelada.');
      return;
    }

    // --- A lógica de exclusão original continua aqui dentro, se confirmado ---
    
    const delPres = await supabase.from('presenca').delete().eq('jogador_id', id).select('id');
    if (delPres.error) {
      const msg = debugSbError('delete presenca(jogador)', delPres.error);
      setDebugMsg(msg);
      return;
    }
    console.log('[DEL presenca count]', delPres.data?.length ?? 0);

    const delJog = await supabase.from('jogadores').delete().eq('id', id).select('id');
    if (delJog.error) {
      const msg = debugSbError('delete jogador', delJog.error);
      setDebugMsg(msg);
      return;
    }
    console.log('[DEL jogadores count]', delJog.data?.length ?? 0);

    await load();
    setDebugMsg('✅ Jogador excluído com sucesso.');

  } catch (e: any) {
    const msg = debugSbError('delete jogador catch', e);
    setDebugMsg(msg);
  }
}

  // ====== VOLUNTÁRIOS ======
  const [modalVol, setModalVol] = useState(false);
  const [editVol, setEditVol] = useState<Voluntario | null>(null);
  const [formVol, setFormVol] = useState<Partial<Voluntario>>({});
  const [savingVol, setSavingVol] = useState(false);

  function openEditVol(v?: Voluntario) {
    if (v) { setEditVol(v); setFormVol(v); }
    else { setEditVol(null); setFormVol({ ativo: true, tipo: 'outro' as TipoVol }); }
    setModalVol(true);
  }

  async function saveVol() {
    if (!formVol?.nome?.trim()) return Alert.alert('Atenção', 'Informe o nome do voluntário.');
    try {
      setSavingVol(true);
      const payload: any = {
        nome: formVol.nome,
        telefone: formVol.telefone ?? null,
        email: formVol.email ?? null,
        tipo: (formVol.tipo as TipoVol) ?? 'outro',
        ativo: formVol.ativo ?? true,
        observacoes: formVol.observacoes ?? null,
        updated_at: new Date().toISOString(),
      };
      let err;
      if (editVol) {
        const { error } = await supabase.from('voluntarios').update(payload).eq('id', editVol.id);
        err = error;
      } else {
        const { error } = await supabase.from('voluntarios').insert(payload);
        err = error;
      }
      if (err) throw err;
      setModalVol(false);
      await load();
      Alert.alert('Sucesso', 'Dados do voluntário salvos.');
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setSavingVol(false);
    }
  }

  /* ================= Excluir VOLUNTÁRIO (direto com logs) ================= */
  async function deletarVol(id: string) {
    console.log('[UI] deletarVol start', id);
    await debugLogSession();
    try {
      const delVol = await supabase.from('voluntarios').delete().eq('id', id).select('id');
      if (delVol.error) {
        const msg = debugSbError('delete voluntario', delVol.error);
        setDebugMsg(msg);
        return;
      }
      console.log('[DEL voluntarios count]', delVol.data?.length ?? 0);

      await load();
      setDebugMsg('✅ Voluntário excluído com sucesso.');
    } catch (e: any) {
      const msg = debugSbError('delete voluntario catch', e);
      setDebugMsg(msg);
    }
  }

  // UI helpers
  const StatusPicker = ({ value, onChange }: { value: StatusJog, onChange: (v: StatusJog)=>void }) => (
    <Picker selectedValue={value} onValueChange={v=>onChange(v as StatusJog)} style={styles.picker}>
      {STATUS_OPTIONS.map(op => <Picker.Item key={op} label={op} value={op} />)}
    </Picker>
  );

  const VolTipoPicker = ({ value, onChange }: { value: TipoVol, onChange: (v: TipoVol)=>void }) => (
    <Picker selectedValue={value} onValueChange={v=>onChange(v as TipoVol)} style={styles.picker}>
      {VOL_TIPOS.map(op => <Picker.Item key={op} label={op} value={op} />)}
    </Picker>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}><Text style={styles.logo}>Projeto Guarani</Text></View>

      {/* Banner de debug */}
      {debugMsg ? (
        <View style={{ backgroundColor: '#FFCF66', padding: 8, borderRadius: 8, marginBottom: 8 }}>
          <Text style={{ color: '#000' }}>{debugMsg}</Text>
        </View>
      ) : null}

      <Text style={styles.h1}>Administrativo</Text>

      {/* SEGMENT */}
      <View style={styles.segment}>
        <TouchableOpacity onPress={()=>setTab('jogadores')} style={[styles.segmentBtn, tab==='jogadores' && styles.segmentBtnActive]}>
          <Text style={[styles.segmentTxt, tab==='jogadores' && styles.segmentTxtActive]}>Jogadores</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=>setTab('voluntarios')} style={[styles.segmentBtn, tab==='voluntarios' && styles.segmentBtnActive]}>
          <Text style={[styles.segmentTxt, tab==='voluntarios' && styles.segmentTxtActive]}>Voluntários</Text>
        </TouchableOpacity>
      </View>

      {/* SEARCH + FILTERS */}
      <View style={styles.filtersBox}>
        <TextInput
          placeholder="Buscar por nome, telefone, email, etc."
          placeholderTextColor="#A0A0A0"
          style={styles.input}
          value={search}
          onChangeText={setSearch}
        />

        {tab==='jogadores' ? (
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Status</Text>
              <Picker selectedValue={filtroStatus} onValueChange={(v)=>setFiltroStatus(v as any)} style={styles.picker}>
                <Picker.Item label="Todos" value="todos" />
                {STATUS_OPTIONS.map(s => <Picker.Item key={s} label={s} value={s} />)}
              </Picker>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Categoria (ano)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex.: 2010"
                placeholderTextColor="#A0A0A0"
                keyboardType="numeric"
                value={filtroCategoria === 'todos' ? '' : String(filtroCategoria)}
                onChangeText={(v) => {
                  const n = Number(v);
                  setFiltroCategoria(!v ? 'todos' : isNaN(n) ? 'todos' : n);
                }}
              />
            </View>
          </View>
        ) : (
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Tipo</Text>
              <Picker selectedValue={filtroTipoVol} onValueChange={(v)=>setFiltroTipoVol(v as any)} style={styles.picker}>
                <Picker.Item label="Todos" value="todos" />
                {VOL_TIPOS.map(t => <Picker.Item key={t} label={t} value={t} />)}
              </Picker>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Status</Text>
              <Picker selectedValue={filtroAtivo} onValueChange={(v)=>setFiltroAtivo(v as any)} style={styles.picker}>
                <Picker.Item label="Todos" value="todos" />
                <Picker.Item label="Ativos" value="ativos" />
                <Picker.Item label="Inativos" value="inativos" />
              </Picker>
            </View>
          </View>
        )}
      </View>

      {/* AÇÕES */}
      <View style={{ flexDirection:'row', justifyContent:'flex-end', marginBottom: 12 }}>
        {tab==='jogadores' ? (
          <TouchableOpacity style={styles.btnPrimary} onPress={()=>openEditJog()}>
            <Feather name="user-plus" size={16} color="#fff" />
            <Text style={styles.btnText}>  Cadastrar Jogador</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.btnPrimary} onPress={()=>openEditVol()}>
            <Feather name="user-plus" size={16} color="#fff" />
            <Text style={styles.btnText}>  Cadastrar Voluntário</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* LISTAS EM TABELA */}
      {loading ? (
        <ActivityIndicator color="#007BFF" style={{ marginTop: 40 }} />
      ) : tab === 'jogadores' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginBottom: 12 }}>
          <View style={{ width: 180 + 120 + 120 + 140 + 160 + 240 + 220 + 180 }}>
            <FlatList
              data={jogadoresFiltrados}
              keyExtractor={(i) => i.id}
              contentContainerStyle={{ paddingBottom: 40 }}
              ListHeaderComponent={
                <View style={tableStyles.headerRow}>
                  <Text style={[tableStyles.cell, tableStyles.headerCell, { width: 180 }]}>Nome</Text>
                  <Text style={[tableStyles.cell, tableStyles.headerCell, { width: 120 }]}>Nasc.</Text>
                  <Text style={[tableStyles.cell, tableStyles.headerCell, { width: 120 }]}>Categoria</Text>
                  <Text style={[tableStyles.cell, tableStyles.headerCell, { width: 140 }]}>Status</Text>
                  <Text style={[tableStyles.cell, tableStyles.headerCell, { width: 160 }]}>Telefone</Text>
                  <Text style={[tableStyles.cell, tableStyles.headerCell, { width: 240 }]}>E-mail</Text>
                  <Text style={[tableStyles.cell, tableStyles.headerCell, { width: 220 }]}>Responsável</Text>
                  <Text style={[tableStyles.cell, tableStyles.headerCell, { width: 180 }]}>Ações</Text>
                </View>
              }
              renderItem={({ item, index }) => (
                <View style={[tableStyles.bodyRow, index % 2 === 1 && { backgroundColor: '#223653' }]}>
                  <Text style={[tableStyles.cell, { width: 180 }]} numberOfLines={1}>{item.nome}</Text>
                  <Text style={[tableStyles.cell, { width: 120 }]}>
                    {formatPgDateOnly(item.data_nascimento)}
                  </Text>
                  <Text style={[tableStyles.cell, { width: 120 }]}>{getCategoriaAno(item) ?? '-'}</Text>
                  <Text style={[tableStyles.cell, { width: 140 }]}>{item.status}</Text>
                  <Text style={[tableStyles.cell, { width: 160 }]} numberOfLines={1}>{item.telefone ?? '-'}</Text>
                  <Text style={[tableStyles.cell, { width: 240 }]} numberOfLines={1}>{item.email ?? '-'}</Text>
                  <Text style={[tableStyles.cell, { width: 220 }]} numberOfLines={1}>{item.responsavel_nome ?? '-'}</Text>
                  <View style={[tableStyles.cell, { width: 180, flexDirection: 'row', gap: 8 }]}>
                    <TouchableOpacity style={styles.btnPrimary} onPress={() => openEditJog(item)}>
                      <Text style={styles.btnText}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnDanger}
                      onPress={() => deletarJog(item.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={styles.btnText}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.empty}>Nenhum jogador encontrado.</Text>}
            />
          </View>
        </ScrollView>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginBottom: 12 }}>
          <View style={{ width: 220 + 160 + 120 + 160 + 260 + 180 }}>
            <FlatList
              data={voluntariosFiltrados}
              keyExtractor={(i) => i.id}
              contentContainerStyle={{ paddingBottom: 40 }}
              ListHeaderComponent={
                <View style={tableStyles.headerRow}>
                  <Text style={[tableStyles.cell, tableStyles.headerCell, { width: 220 }]}>Nome</Text>
                  <Text style={[tableStyles.cell, tableStyles.headerCell, { width: 160 }]}>Tipo</Text>
                  <Text style={[tableStyles.cell, tableStyles.headerCell, { width: 120 }]}>Status</Text>
                  <Text style={[tableStyles.cell, tableStyles.headerCell, { width: 160 }]}>Telefone</Text>
                  <Text style={[tableStyles.cell, tableStyles.headerCell, { width: 260 }]}>E-mail</Text>
                  <Text style={[tableStyles.cell, tableStyles.headerCell, { width: 180 }]}>Ações</Text>
                </View>
              }
              renderItem={({ item, index }) => (
                <View style={[tableStyles.bodyRow, index % 2 === 1 && { backgroundColor: '#223653' }]}>
                  <Text style={[tableStyles.cell, { width: 220 }]} numberOfLines={1}>{item.nome}</Text>
                  <Text style={[tableStyles.cell, { width: 160 }]}>{item.tipo}</Text>
                  <Text style={[tableStyles.cell, { width: 120 }]}>{item.ativo ? 'ativo' : 'inativo'}</Text>
                  <Text style={[tableStyles.cell, { width: 160 }]} numberOfLines={1}>{item.telefone ?? '-'}</Text>
                  <Text style={[tableStyles.cell, { width: 260 }]} numberOfLines={1}>{item.email ?? '-'}</Text>
                  <View style={[tableStyles.cell, { width: 180, flexDirection: 'row', gap: 8 }]}>
                    <TouchableOpacity style={styles.btnPrimary} onPress={() => openEditVol(item)}>
                      <Text style={styles.btnText}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnDanger}
                      onPress={() => deletarVol(item.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={styles.btnText}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.empty}>Nenhum voluntário encontrado.</Text>}
            />
          </View>
        </ScrollView>
      )}

      {/* MODAL JOGADOR */}
      <Modal visible={modalJog} animationType="slide" onRequestClose={()=>setModalJog(false)}>
        <SafeAreaView style={{ flex:1, backgroundColor:'#0A1931' }}>
          <ScrollView contentContainerStyle={{ padding:16 }}>
            <Text style={styles.h1}>{editJog ? 'Editar Jogador' : 'Cadastrar Jogador'}</Text>

            <TextInput style={styles.input} placeholder="Nome completo" placeholderTextColor="#A0A0A0"
              value={formJog.nome ?? ''} onChangeText={(t)=>setFormJog(s=>({...s, nome:t}))} />
            <TextInput style={styles.input} placeholder="Data nasc. (AAAA-MM-DD)" placeholderTextColor="#A0A0A0"
              value={formJog.data_nascimento ?? ''} onChangeText={(t)=>setFormJog(s=>({...s, data_nascimento:t}))} />

            <Text style={{ color:'#B0B0B0', marginBottom:10 }}>
              Categoria (ano): {formJog.data_nascimento ? new Date(formJog.data_nascimento).getFullYear() : (editJog?.categoria ?? '-')}
            </Text>

            <TextInput style={styles.input} placeholder="Telefone" placeholderTextColor="#A0A0A0"
              value={formJog.telefone ?? ''} onChangeText={(t)=>setFormJog(s=>({...s, telefone:t}))} keyboardType="phone-pad" />
            <TextInput style={styles.input} placeholder="E-mail (opcional)" placeholderTextColor="#A0A0A0"
              value={formJog.email ?? ''} onChangeText={(t)=>setFormJog(s=>({...s, email:t}))} keyboardType="email-address" />
            <TextInput style={styles.input} placeholder="Responsável (se menor de 18)" placeholderTextColor="#A0A0A0"
              value={formJog.responsavel_nome ?? ''} onChangeText={(t)=>setFormJog(s=>({...s, responsavel_nome:t}))} />

            <View style={styles.box}>
              <Text style={{ color:'#fff', fontWeight:'bold', marginBottom:8 }}>Foto do jogador</Text>
              <TouchableOpacity style={styles.btnNeutral} onPress={()=>pick('foto')}>
                <Feather name="image" size={18} color="#fff" />
                <Text style={styles.btnText}>  Selecionar imagem</Text>
              </TouchableOpacity>
              {fotoUri
                ? <Image source={{ uri: fotoUri }} style={styles.preview} />
                : (formJog.foto_path ? <Image source={{ uri: supabase.storage.from('jogadores').getPublicUrl(formJog.foto_path).data.publicUrl }} style={styles.preview} /> : null)
              }
              {uploading==='foto' && <ActivityIndicator color="#00C2CB" />}
            </View>

            <View style={styles.box}>
              <Text style={{ color:'#fff', fontWeight:'bold', marginBottom:8 }}>Documento de identidade</Text>
              <View style={{ flexDirection:'row', gap:10 }}>
                <TouchableOpacity style={[styles.btnNeutral, { flex:1 }]} onPress={()=>pick('doc_frente')}>
                  <Feather name="file-plus" size={18} color="#fff" />
                  <Text style={styles.btnText}>  Frente</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnNeutral, { flex:1 }]} onPress={()=>pick('doc_verso')}>
                  <Feather name="file-plus" size={18} color="#fff" />
                  <Text style={styles.btnText}>  Verso</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection:'row', gap:10, marginTop:10 }}>
                {docFrenteUri
                  ? <Image source={{ uri: docFrenteUri }} style={[styles.preview, { flex:1 }]} />
                  : (formJog.doc_id_frente_path ? <Image source={{ uri: supabase.storage.from('jogadores').getPublicUrl(formJog.doc_id_frente_path).data.publicUrl }} style={[styles.preview, { flex:1 }]} /> : null)
                }
                {docVersoUri
                  ? <Image source={{ uri: docVersoUri }} style={[styles.preview, { flex:1 }]} />
                  : (formJog.doc_id_verso_path ? <Image source={{ uri: supabase.storage.from('jogadores').getPublicUrl(formJog.doc_id_verso_path).data.publicUrl }} style={[styles.preview, { flex:1 }]} /> : null)
                }
              </View>

              {(uploading==='doc_frente' || uploading==='doc_verso') && <ActivityIndicator color="#00C2CB" style={{ marginTop: 8 }} />}
            </View>

            <View style={styles.box}>
              <Text style={{ color:'#fff', fontWeight:'bold', marginBottom:8 }}>Termo assinado</Text>
              <TouchableOpacity style={styles.btnNeutral} onPress={()=>pick('termo')}>
                <Feather name="file-plus" size={18} color="#fff" />
                <Text style={styles.btnText}>  Selecionar imagem</Text>
              </TouchableOpacity>
              {termoUri
                ? <Image source={{ uri: termoUri }} style={styles.preview} />
                : (formJog.termo_assinado_path ? <Image source={{ uri: supabase.storage.from('jogadores').getPublicUrl(formJog.termo_assinado_path).data.publicUrl }} style={styles.preview} /> : null)
              }
              {uploading==='termo' && <ActivityIndicator color="#00C2CB" />}
            </View>

            <Text style={styles.label}>Status</Text>
            <Picker
              selectedValue={(formJog.status as StatusJog) ?? 'pre_inscrito'}
              onValueChange={(v)=>setFormJog(s=>({...s, status: v as StatusJog}))}
              style={styles.picker}
            >
              {STATUS_OPTIONS.map(s => <Picker.Item key={s} label={s} value={s} />)}
            </Picker>

            <View style={{ flexDirection:'row', gap:10, marginTop:8 }}>
              <TouchableOpacity style={[styles.btnPrimary, { flex:1 }]} onPress={saveJogador} disabled={savingJog || uploading !== null}>
                {savingJog ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Salvar</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnNeutral, { flex:1 }]} onPress={()=>setModalJog(false)}>
                <Text style={styles.btnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={modalVol} animationType="slide" onRequestClose={() => setModalVol(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1931' }}>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.h1}>{editVol ? 'Editar Voluntário' : 'Cadastrar Voluntário'}</Text>

            <TextInput
              style={styles.input}
              placeholder="Nome completo"
              placeholderTextColor="#A0A0A0"
              value={formVol.nome ?? ''}
              onChangeText={(t) => setFormVol((s) => ({ ...s, nome: t }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Telefone"
              placeholderTextColor="#A0A0A0"
              keyboardType="phone-pad"
              value={formVol.telefone ?? ''}
              onChangeText={(t) => setFormVol((s) => ({ ...s, telefone: t }))}
            />
            <TextInput
              style={styles.input}
              placeholder="E-mail"
              placeholderTextColor="#A0A0A0"
              keyboardType="email-address"
              autoCapitalize="none"
              value={formVol.email ?? ''}
              onChangeText={(t) => setFormVol((s) => ({ ...s, email: t }))}
            />

            <Text style={styles.label}>Tipo</Text>
            <Picker
              selectedValue={(formVol.tipo as TipoVol) ?? 'outro'}
              onValueChange={(v) => setFormVol((s) => ({ ...s, tipo: v as TipoVol }))}
              style={styles.picker}
            >
              {VOL_TIPOS.map((t) => (
                <Picker.Item key={t} label={t} value={t} />
              ))}
            </Picker>

            <Text style={styles.label}>Status</Text>
            <Picker
              selectedValue={formVol.ativo ?? true ? 'ativo' : 'inativo'}
              onValueChange={(v) => setFormVol((s) => ({ ...s, ativo: v === 'ativo' }))}
              style={styles.picker}
            >
              <Picker.Item label="Ativo" value="ativo" />
              <Picker.Item label="Inativo" value="inativo" />
            </Picker>

            <TextInput
              style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
              multiline
              numberOfLines={4}
              placeholder="Observações"
              placeholderTextColor="#A0A0A0"
              value={formVol.observacoes ?? ''}
              onChangeText={(t) => setFormVol((s) => ({ ...s, observacoes: t }))}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.btnPrimary, { flex: 1 }]}
                onPress={saveVol}
                disabled={savingVol}
              >
                {savingVol ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Salvar</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnNeutral, { flex: 1 }]} onPress={() => setModalVol(false)}>
                <Text style={styles.btnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const tableStyles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#203A4A',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderColor: '#3A506B',
    borderWidth: 1,
  },
  bodyRow: {
    flexDirection: 'row',
    backgroundColor: '#1E2F47',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#3A506B',
  },
  cell: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: '#E0E0E0',
  },
  headerCell: {
    fontWeight: '700',
    color: '#FFF',
  },
});

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#0A1931', paddingHorizontal:16 },
  header: { flexDirection:'row', justifyContent:'space-between', alignItems:'center',
    paddingVertical:20, marginBottom:6, marginHorizontal:8 },
  logo: { fontSize:32, fontWeight:'800', color:'#FFF' },
  h1: { color:'#FFF', fontWeight:'700', fontSize:22, marginBottom:12, textAlign:'center' },

  segment: { flexDirection:'row', gap:8, marginBottom:12, justifyContent:'center' },
  segmentBtn: { paddingVertical:8, paddingHorizontal:12, borderRadius:20, backgroundColor:'#203A4A' },
  segmentBtnActive: { backgroundColor:'#18641c' },
  segmentTxt: { color:'#B0B0B0', fontWeight:'600' },
  segmentTxtActive: { color:'#fff' },

  filtersBox: { backgroundColor:'#1E2F47', borderRadius:12, padding:12, borderWidth:1, borderColor:'#3A506B', marginBottom:12 },
  input: { height:50, backgroundColor:'#203A4A', borderRadius:10, paddingHorizontal:12, color:'#FFF', borderWidth:1, borderColor:'#4A6572', marginBottom:10 },

  row: { flexDirection:'row', gap:10 },
  col: { flex:1 },
  label: { color:'#E0E0E0', marginBottom:6 },

  picker: { backgroundColor:'#203A4A', borderRadius:10, color:'#fff', marginBottom:10, borderWidth:1, borderColor:'#4A6572' },

  card: { backgroundColor:'#1E2F47', borderRadius:12, padding:12, marginBottom:12, borderWidth:1, borderColor:'#3A506B' },
  title: { color:'#FFF', fontWeight:'bold', fontSize:16, marginBottom:4 },
  line: { color:'#B0B0B0', marginTop:2 },

  rowButtons: { flexDirection:'row', gap:10, marginTop:10 },
  btnPrimary: { backgroundColor:'#18641c', paddingVertical:10, paddingHorizontal:14, borderRadius:10, flexDirection:'row', alignItems:'center' },
  btnDanger: { backgroundColor:'#FF4C4C', paddingVertical:10, paddingHorizontal:14, borderRadius:10 },
  btnNeutral: { backgroundColor:'#4A6572', paddingVertical:10, paddingHorizontal:14, borderRadius:10, flexDirection:'row', alignItems:'center' },
  btnText: { color:'#fff', fontWeight:'bold' },

  box: { backgroundColor:'#1E2F47', borderRadius:12, padding:12, borderWidth:1, borderColor:'#3A506B', marginBottom:12 },
  preview: { width:'100%', height:160, borderRadius:10, marginTop:10, borderWidth:1, borderColor:'#4A6572' },

  empty: { color:'#E0E0E0', textAlign:'center', marginVertical:30, fontSize:16 },
});
