import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, SafeAreaView, StyleSheet, Text, View, TextInput,
  TouchableOpacity, FlatList, ActivityIndicator, Platform, Modal, ScrollView, Image
} from 'react-native';
import { useAuth } from '@/src/contexts/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { router, Redirect } from 'expo-router';
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

function WebModal({
  visible,
  children,
  onRequestClose,
}: {
  visible: boolean;
  children: React.ReactNode;
  onRequestClose?: () => void;
}) {
  if (Platform.OS !== 'web') {
    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onRequestClose}>
        {children}
      </Modal>
    );
  }
  if (!visible) return null;
  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>{children}</View>
    </View>
  );
}

function yearFromDateOnly(iso?: string | null): number | null {
  if (!iso) return null;
  // espera "YYYY-MM-DD" ou "YYYY-M-D" — pega os 4 primeiros dígitos
  const m = /^(\d{4})/.exec(iso);
  return m ? Number(m[1]) : null;
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
type TipoVol = 'viewer' | 'coach' | 'admin';

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

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  telefone: string | null;
  ativo: boolean;
  observacoes: string | null;
  type_user: TipoVol | null;   // <- era "tipo"
  created_at: string;
  updated_at: string | null;
};

const STATUS_OPTIONS: StatusJog[] = ['pre_inscrito','ativo','inativo'];
const VOL_TIPOS: TipoVol[] = ['viewer', 'coach', 'admin'];
const getCategoriaAno = (j: Jogador) =>
  j.categoria ?? (j.data_nascimento ? new Date(j.data_nascimento).getFullYear() : null);

const VOL_LABEL: Record<TipoVol, string> = {
  viewer: 'viewer',
  coach: 'coach',
  admin: 'admin',
};

const formatPgDateOnly = (s?: string | null) => {
  if (!s) return '-';
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d.padStart(2,'0')}/${m.padStart(2,'0')}/${y}`;
};

/* ============== Componente ============== */
export default function AdminScreen() {
  // ► agora também uso role/user/refreshProfile para debug
  const { isAdmin, authReady, role, user, refreshProfile, setAuth } = useAuth();

  // --- DIAGNÓSTICO: loga sempre que o guard mudar de estado
  useEffect(() => {
    console.log('[ADMIN] authReady:', authReady, 'isAdmin:', isAdmin, 'role:', role, 'uid:', user?.id);
  }, [authReady, isAdmin, role, user?.id]);

  // --- Inspeção direta da linha em public.users (útil p/ ver RLS/perfil ausente)
  const [inspectedRole, setInspectedRole] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('users')
        .select('id, type_user')
        .eq('id', user.id)
        .maybeSingle();
      if (error) console.log('[ADMIN] check users row error:', error);
      console.log('[ADMIN] users row for me:', data);
      setInspectedRole(data?.type_user ?? null);
    })();
  }, [user?.id]);

  // Gate: só decide depois do perfil carregar
  useEffect(() => {
    if (authReady && !isAdmin) {
      console.log('[ADMIN] not admin, redirecting…');
      router.replace('/(tabs)/one');
    }
  }, [authReady, isAdmin]);

  if (!authReady) return null; // ainda carregando o perfil
  if (!isAdmin) return <Redirect href="/(tabs)/one" />; 

  const [debugMsg, setDebugMsg] = useState<string | null>(null);

  useEffect(() => {
    if (debugMsg) {
      const timer = setTimeout(() => setDebugMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [debugMsg]);

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    setAuth(null);
    if (error) Alert.alert('Erro', 'Erro ao retornar para página de login, tente mais tarde.');
  }

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
  const [voluntarios, setVoluntarios] = useState<UserRow[]>([]);

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

    const { data: users, error: eu } = await supabase
    .from('users')
    .select('id, full_name, email, telefone, ativo, observacoes, type_user, created_at, updated_at') // <- type_user
    .order('created_at', { ascending: false });
    if (eu) console.log('users err:', eu);
    setVoluntarios((users ?? []) as any);

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // FILTROS
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
      if (filtroTipoVol !== 'todos' && v.type_user !== filtroTipoVol) return false; // <- type_user
      if (filtroAtivo === 'ativos' && !v.ativo) return false;
      if (filtroAtivo === 'inativos' && v.ativo) return false;
      if (!q) return true;
      const blob = [
        v.full_name ?? '',
        v.email ?? '',
        v.telefone ?? '',
        v.type_user ?? '',            // <- type_user
        v.ativo ? 'ativo' : 'inativo'
      ].join(' ').toLowerCase();
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

      // calcula a categoria (ano) de forma segura
      const categoriaAno: number | null =
        (formJog.categoria as number | null) ??
        yearFromDateOnly(formJog.data_nascimento) ??
        null;

      const payload: Partial<Jogador> = {
        nome: formJog.nome,
        data_nascimento: formJog.data_nascimento ?? null,
        categoria: categoriaAno, 
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
      if (err) throw err;

      setModalJog(false);
      await load();
      Alert.alert('Sucesso', 'Dados do jogador salvos.');
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Falha ao salvar.');
      console.log('[saveJogador] erro:', e);
      // Usando sua função helper para formatar a mensagem de erro completa
      const errorMsg = debugSbError('salvar jogador', e);
      Alert.alert('Erro ao Salvar Jogador', errorMsg);
    } finally {
      setSavingJog(false);
      setUploading(null);
    }
  }

  // ====== MODAL DE EXCLUSÃO (Genérico) ======
  const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, nome: string } | null>(null);
  const [deleteEntityType, setDeleteEntityType] = useState<'jogador' | 'voluntario' | null>(null);

  function openDeleteConfirm(item: { id: string, nome: string }, type: 'jogador' | 'voluntario') {
    setItemToDelete(item);
    setDeleteEntityType(type);
    setDeleteModalVisible(true);
  }
  function closeDeleteConfirm() {
    setItemToDelete(null);
    setDeleteEntityType(null);
    setDeleteModalVisible(false);
  }
  async function handleConfirmDelete() {
    if (!itemToDelete || !deleteEntityType) return;
    if (deleteEntityType === 'jogador') await deletarJog(itemToDelete.id);
    else if (deleteEntityType === 'voluntario') await deletarVol(itemToDelete.id);
    closeDeleteConfirm();
  }

  /* ================= Excluir JOGADOR ================= */
  async function deletarJog(id: string) {
    console.log('[UI] deletarJog start', id);
    await debugLogSession();
    try {
      const delPres = await supabase.from('presenca').delete().eq('jogador_id', id).select('id');
      if (delPres.error) {
        const msg = debugSbError('delete presenca(jogador)', delPres.error);
        setDebugMsg(msg);
        return;
      }
      const delJog = await supabase.from('jogadores').delete().eq('id', id).select('id');
      if (delJog.error) {
        const msg = debugSbError('delete jogador', delJog.error);
        setDebugMsg(msg);
        return;
      }
      await load();
      setDebugMsg('✅ Jogador excluído com sucesso.');
    } catch (e: any) {
      const msg = debugSbError('delete jogador catch', e);
      setDebugMsg(msg);
    }
  }

  // ====== VOLUNTÁRIOS (users) ======
  const [modalVol, setModalVol] = useState(false);
  const [editVol, setEditVol] = useState<UserRow | null>(null);
  const [formVol, setFormVol] = useState<Partial<UserRow>>({});
  const [savingVol, setSavingVol] = useState(false);
  const [newPassword, setNewPassword] = useState<string>('');

  function openEditVol(v?: UserRow) {
    if (v) {
      setEditVol(v);
      setFormVol(v);
    } else {
      // ✅ defina um default válido do DB — escolha o que faz sentido (viewer é comum)
      setEditVol(null);
      setFormVol({ ativo: true, type_user: 'viewer' as TipoVol });
    }
    setModalVol(true);
  }

async function saveVol() {
  if (!formVol?.full_name?.trim()) return Alert.alert('Atenção', 'Informe o nome do voluntário.');
  if (!formVol?.email?.trim()) return Alert.alert('Atenção', 'Informe o e-mail.');

  try {
    setSavingVol(true);

    if (editVol) {
      // edição
      const { error } = await supabase
        .from('users')
        .update({
          full_name: formVol.full_name ?? null,
          telefone: formVol.telefone ?? null,
          email: formVol.email ?? null,
          type_user: formVol.type_user ?? null,  // <- type_user
          ativo: formVol.ativo ?? true,
          observacoes: formVol.observacoes ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editVol.id);
      if (error) throw error;

      // FECHA PRIMEIRO, limpa estado, depois alerta
      setModalVol(false);
      setEditVol(null);
      setFormVol({});
      setNewPassword('');
      await new Promise(r => setTimeout(r, 0));
      await load();
      setDebugMsg('✅ Dados do voluntário salvos.');

      // dá um tick para o RN aplicar o setState antes do Alert
      await new Promise((r) => setTimeout(r, 0));

      await load();
      Alert.alert('Sucesso', 'Dados do voluntário salvos.');
      return;
    }

    // criação com senha via edge function
    if (!newPassword?.trim()) return Alert.alert('Atenção', 'Defina uma senha para o voluntário.');

    const { data: sess } = await supabase.auth.getSession();
    const accessToken = sess?.session?.access_token ?? '';

    const payload = {
      email: formVol.email,
      password: newPassword,
      full_name: formVol.full_name,
      telefone: formVol.telefone,
      type_user: formVol.type_user as 'viewer'|'coach'|'admin',
      observacoes: formVol.observacoes ?? null,
    };

    console.log('[create-volunteer][front] payload', payload);

    const { data, error } = await supabase.functions.invoke('create-volunteer', {
      body: payload,
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    console.log('[create-volunteer][front] resp', { data, error });

    if (error) {
      // Mostra a mensagem vinda da Edge
      try {
        const res = (error as any).context as Response;
        const txt = await res.text();
        let msg = txt;
        try { msg = JSON.parse(txt)?.error ?? txt; } catch {}
        Alert.alert('Erro ao criar voluntário', msg);
      } catch {
        Alert.alert('Erro ao criar voluntário', (error as any)?.message ?? 'Falha desconhecida');
      }
      return;
    }

    // FECHA PRIMEIRO e limpa estado
    setModalVol(false);
    setEditVol(null);
    setFormVol({});
    setNewPassword('');

    // dá um tick pro React aplicar o close antes de qualquer UI bloqueante
    await new Promise(r => setTimeout(r, 0));

    // recarrega lista e mostra banner de sucesso (em vez de Alert no Web)
    await load();
    setDebugMsg('✅ Voluntário criado com sucesso.');

    await load();
    Alert.alert('Sucesso', 'Voluntário criado com senha.');
  } catch (e: any) {
    console.log('[saveVol] erro:', e);
      // Usando sua função helper para formatar a mensagem de erro completa
      const errorMsg = debugSbError('salvar voluntário', e);
      Alert.alert('Erro ao Salvar Voluntário', errorMsg);
  } finally {
    setSavingVol(false);
  }
}

  /* ================= "Excluir" VOLUNTÁRIO ================= */
  async function deletarVol(id: string) {
    console.log('[UI] deletarVol start', id);
    await debugLogSession();

    try {
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess?.session?.access_token ?? '';

      const { error } = await supabase.functions.invoke('delete-volunteer', {
        body: { user_id: id },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error) {
        const msg = debugSbError('delete-volunteer edge fn', error);
        setDebugMsg(msg);
        return;
      }

      await load();
      setDebugMsg('✅ Voluntário excluído definitivamente.');
    } catch (e: any) {
      const msg = debugSbError('delete voluntário catch', e);
      setDebugMsg(msg);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>Projeto Guarani</Text>
        <TouchableOpacity onPress={handleSignOut}>
          <Feather name="log-out" size={24} color="#00C2CB" />
        </TouchableOpacity>
      </View>

      {/* --- Banner de diagnóstico (remova quando não precisar) --- */}
      <View style={{ backgroundColor:'#FFCF66', padding:8, borderRadius:6, marginBottom:8 }}>
        <Text>authReady: {String(authReady)} | isAdmin: {String(isAdmin)} | role: {role}</Text>
        <Text>uid: {user?.id}</Text>
        <Text>users.type_user (DB): {inspectedRole ?? '(sem linha)'}</Text>
        <TouchableOpacity onPress={refreshProfile}><Text style={{ textDecorationLine:'underline' }}>Recarregar perfil</Text></TouchableOpacity>
      </View>

      {/* Banner de debug com timer e botão de fechar (erros/ações) */}
      {debugMsg ? (
        <View style={styles.debugBanner}>
          <Text style={styles.debugBannerText}>{debugMsg}</Text>
          <TouchableOpacity onPress={() => setDebugMsg(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={20} color="#000" />
          </TouchableOpacity>
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
          <Picker
            selectedValue={filtroTipoVol}
            onValueChange={(v)=>setFiltroTipoVol(v as any)}
            style={styles.picker}
          >
            <Picker.Item label="Todos" value="todos" />
            {VOL_TIPOS.map(t => (
              <Picker.Item key={t} label={VOL_LABEL[t]} value={t} />
            ))}
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
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => { console.log('[UI] abrir modal voluntario'); openEditVol(); }}
          >
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
                  <Text style={[tableStyles.cell, { width: 120 }]}>{formatPgDateOnly(item.data_nascimento)}</Text>
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
                      onPress={() => openDeleteConfirm({ id: item.id, nome: item.nome }, 'jogador')}
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
                  <Text style={[tableStyles.cell, { width: 220 }]} numberOfLines={1}>{item.full_name ?? '-'}</Text>
                  <Text style={[tableStyles.cell, { width: 160 }]}>
                    {item.type_user ? VOL_LABEL[item.type_user as TipoVol] : '-'}
                  </Text>
                  <Text style={[tableStyles.cell, { width: 120 }]}>{item.ativo ? 'ativo' : 'inativo'}</Text>
                  <Text style={[tableStyles.cell, { width: 160 }]} numberOfLines={1}>{item.telefone ?? '-'}</Text>
                  <Text style={[tableStyles.cell, { width: 260 }]} numberOfLines={1}>{item.email ?? '-'}</Text>
                  <View style={[tableStyles.cell, { width: 180, flexDirection: 'row', gap: 8 }]}>
                    <TouchableOpacity style={styles.btnPrimary} onPress={() => openEditVol(item)}>
                      <Text style={styles.btnText}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnDanger}
                      onPress={() => openDeleteConfirm({ id: item.id, nome: item.full_name ?? '' }, 'voluntario')}
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
  <Modal visible={modalJog} animationType="slide" onRequestClose={() => setModalJog(false)}>
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1931' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.h1}>{editJog ? 'Editar Jogador' : 'Cadastrar Jogador'}</Text>

        <TextInput
          style={styles.input}
          placeholder="Nome completo"
          placeholderTextColor="#A0A0A0"
          value={formJog.nome ?? ''}
          onChangeText={(t) => setFormJog((s) => ({ ...s, nome: t }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Data nasc. (AAAA-MM-DD)"
          placeholderTextColor="#A0A0A0"
          value={formJog.data_nascimento ?? ''}
          onChangeText={(t) => setFormJog((s) => ({ ...s, data_nascimento: t }))}
        />

        <Text style={{ color: '#B0B0B0', marginBottom: 10 }}>
          Categoria (ano): {yearFromDateOnly(formJog.data_nascimento) ?? (editJog?.categoria ?? '-')}
        </Text>


        <TextInput
          style={styles.input}
          placeholder="Telefone"
          placeholderTextColor="#A0A0A0"
          value={formJog.telefone ?? ''}
          onChangeText={(t) => setFormJog((s) => ({ ...s, telefone: t }))}
          keyboardType="phone-pad"
        />
        <TextInput
          style={styles.input}
          placeholder="E-mail (opcional)"
          placeholderTextColor="#A0A0A0"
          value={formJog.email ?? ''}
          onChangeText={(t) => setFormJog((s) => ({ ...s, email: t }))}
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Responsável (se menor de 18)"
          placeholderTextColor="#A0A0A0"
          value={formJog.responsavel_nome ?? ''}
          onChangeText={(t) => setFormJog((s) => ({ ...s, responsavel_nome: t }))}
        />

        <View style={styles.box}>
          <Text style={{ color: '#fff', fontWeight: 'bold', marginBottom: 8 }}>Foto do jogador</Text>
          <TouchableOpacity style={styles.btnNeutral} onPress={() => pick('foto')}>
            <Feather name="image" size={18} color="#fff" />
            <Text style={styles.btnText}>  Selecionar imagem</Text>
          </TouchableOpacity>
          {fotoUri ? (
            <Image source={{ uri: fotoUri }} style={styles.preview} />
          ) : formJog.foto_path ? (
            <Image
              source={{ uri: supabase.storage.from('jogadores').getPublicUrl(formJog.foto_path).data.publicUrl }}
              style={styles.preview}
            />
          ) : null}
          {uploading === 'foto' && <ActivityIndicator color="#00C2CB" />}
        </View>

        <View style={styles.box}>
          <Text style={{ color: '#fff', fontWeight: 'bold', marginBottom: 8 }}>Documento de identidade</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={[styles.btnNeutral, { flex: 1 }]} onPress={() => pick('doc_frente')}>
              <Feather name="file-plus" size={18} color="#fff" />
              <Text style={styles.btnText}>  Frente</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnNeutral, { flex: 1 }]} onPress={() => pick('doc_verso')}>
              <Feather name="file-plus" size={18} color="#fff" />
              <Text style={styles.btnText}>  Verso</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            {docFrenteUri ? (
              <Image source={{ uri: docFrenteUri }} style={[styles.preview, { flex: 1 }]} />
            ) : formJog.doc_id_frente_path ? (
              <Image
                source={{ uri: supabase.storage.from('jogadores').getPublicUrl(formJog.doc_id_frente_path).data.publicUrl }}
                style={[styles.preview, { flex: 1 }]}
              />
            ) : null}

            {docVersoUri ? (
              <Image source={{ uri: docVersoUri }} style={[styles.preview, { flex: 1 }]} />
            ) : formJog.doc_id_verso_path ? (
              <Image
                source={{ uri: supabase.storage.from('jogadores').getPublicUrl(formJog.doc_id_verso_path).data.publicUrl }}
                style={[styles.preview, { flex: 1 }]}
              />
            ) : null}
          </View>

          {(uploading === 'doc_frente' || uploading === 'doc_verso') && (
            <ActivityIndicator color="#00C2CB" style={{ marginTop: 8 }} />
          )}
        </View>

        <View style={styles.box}>
          <Text style={{ color: '#fff', fontWeight: 'bold', marginBottom: 8 }}>Termo assinado</Text>
          <TouchableOpacity style={styles.btnNeutral} onPress={() => pick('termo')}>
            <Feather name="file-plus" size={18} color="#fff" />
            <Text style={styles.btnText}>  Selecionar imagem</Text>
          </TouchableOpacity>
          {termoUri ? (
            <Image source={{ uri: termoUri }} style={styles.preview} />
          ) : formJog.termo_assinado_path ? (
            <Image
              source={{ uri: supabase.storage.from('jogadores').getPublicUrl(formJog.termo_assinado_path).data.publicUrl }}
              style={styles.preview}
            />
          ) : null}
          {uploading === 'termo' && <ActivityIndicator color="#00C2CB" />}
        </View>

        <Text style={styles.label}>Status</Text>
        <Picker
          selectedValue={(formJog.status as StatusJog) ?? 'pre_inscrito'}
          onValueChange={(v) => setFormJog((s) => ({ ...s, status: v as StatusJog }))}
          style={styles.picker}
        >
          {STATUS_OPTIONS.map((s) => (
            <Picker.Item key={s} label={s} value={s} />
          ))}
        </Picker>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
          <TouchableOpacity
            style={[styles.btnPrimary, { flex: 1 }]}
            onPress={saveJogador}
            disabled={savingJog || uploading !== null}
          >
            {savingJog ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Salvar</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnNeutral, { flex: 1 }]} onPress={() => setModalJog(false)}>
            <Text style={styles.btnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  </Modal>
          
  {/* MODAL VOLUNTÁRIO (USERS) */}
  <Modal visible={modalVol} animationType="slide" onRequestClose={() => setModalVol(false)}>
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1931' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.h1}>{editVol ? 'Editar Voluntário' : 'Cadastrar Voluntário'}</Text>

        <TextInput
          style={styles.input}
          placeholder="Nome completo"
          placeholderTextColor="#A0A0A0"
          value={formVol.full_name ?? ''}
          onChangeText={(t) => setFormVol((s) => ({ ...s, full_name: t }))}
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

        {!editVol && (
          <TextInput
            style={styles.input}
            placeholder="Senha do voluntário"
            placeholderTextColor="#A0A0A0"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
        )}

        <Text style={styles.label}>Tipo</Text>
        <Picker
          selectedValue={(formVol.type_user as TipoVol) ?? 'viewer'}
          onValueChange={(v) => setFormVol(s => ({ ...s, type_user: v as TipoVol }))}
          style={styles.picker}
        >
          {VOL_TIPOS.map(t => (
            <Picker.Item key={t} label={VOL_LABEL[t]} value={t} />
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
          <TouchableOpacity style={[styles.btnPrimary, { flex: 1 }]} onPress={saveVol} disabled={savingVol}>
            {savingVol ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Salvar</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnNeutral, { flex: 1 }]} onPress={() => setModalVol(false)}>
            <Text style={styles.btnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  </Modal>

  {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
  <Modal
    visible={isDeleteModalVisible}
    transparent={true}
    animationType="fade"
    onRequestClose={closeDeleteConfirm}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Confirmar Exclusão</Text>
        {itemToDelete && (
          <Text style={styles.modalText}>
            Você tem certeza que deseja excluir o {deleteEntityType === 'jogador' ? 'jogador' : 'voluntário'}{' '}
            <Text style={{ fontWeight: 'bold' }}>{itemToDelete.nome}</Text>?
            Essa ação não pode ser desfeita.
          </Text>
        )}
        <View style={styles.modalActions}>
          <TouchableOpacity style={[styles.btnNeutral, { flex: 1 }]} onPress={closeDeleteConfirm}>
            <Text style={styles.btnText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnDanger, { flex: 1 }]} onPress={handleConfirmDelete}>
            <Text style={styles.btnText}>Excluir</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
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
  
  // --- ESTILOS PARA MODAL DE EXCLUSÃO ---
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
    color: '#B0B0B0',
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

  // --- NOVOS ESTILOS PARA O BANNER DE DEBUG ---
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
