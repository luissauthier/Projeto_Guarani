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

export default function AdminScreen() {
  const { isAdmin } = useAuth();
  useEffect(() => {
    if (!isAdmin) {
      Alert.alert('Acesso Negado', 'Você não tem permissão para acessar esta tela.');
      router.replace('/(tabs)/one');
    }
  }, [isAdmin]);
  if (!isAdmin) return null;

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
    // CHANGED: seleção explícita garante que 'categoria' venha
    const { data: jog, error: ej } = await supabase
      .from('jogadores')
      .select('id,nome,data_nascimento,categoria,telefone,email,responsavel_nome,foto_path,doc_id_frente_path,doc_id_verso_path,termo_assinado_path,status,created_at,atualizado_em')
      .order('created_at', { ascending: false });
    if (ej) {
      console.log('DEL jogadores err:', ej);
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
      if (filtroCategoria !== 'todos' && j.categoria !== filtroCategoria) return false;
      if (!q) return true;
      const blob = [
        j.nome, j.email, j.telefone,
        j.categoria?.toString() ?? '', j.status,
        j.responsavel_nome ?? ''
      ].join(' ').toLowerCase();
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

  // CHANGED: Estados para uploads (foto/doc/termo) + preview
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [docFrenteUri, setDocFrenteUri] = useState<string | null>(null);
  const [docVersoUri, setDocVersoUri] = useState<string | null>(null);
  const [termoUri, setTermoUri] = useState<string | null>(null);

  const [uploading, setUploading] = useState<'foto'|'doc_frente'|'doc_verso'|'termo'|null>(null);
  const [savingJog, setSavingJog] = useState(false);

  function openEditJog(j?: Jogador) {
    if (j) {
      setEditJog(j);
      setFormJog(j);
    } else {
      setEditJog(null);
      setFormJog({ status: 'pre_inscrito' as StatusJog });
    }
    // reset uploads
    setFotoUri(null);
    setDocFrenteUri(null);
    setDocVersoUri(null);
    setTermoUri(null);
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

  async function uploadIfNeeded(localUri: string | null, defaultPath: string | null) {
    if (!localUri) return defaultPath ?? null;
    setUploading('foto'); // será trocado pelo chamador
    try {
      const res = await fetch(localUri);
      const blob = await res.blob();
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      // CHANGED: decide subpasta por quem chamou
      // o chamador muda 'uploading' antes de chamar
      let folder = 'preinscricao';
      if (uploading === 'termo') folder = 'termos';
      const path = `${folder}/${filename}`;
      const { error } = await supabase.storage.from('jogadores').upload(path, blob, {
        contentType: 'image/jpeg', upsert: false
      });
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

      // uploads conforme necessário
      if (fotoUri) setUploading('foto');
      const foto_path = await uploadIfNeeded(fotoUri, formJog.foto_path ?? null);

      if (docFrenteUri) setUploading('doc_frente');
      const doc_id_frente_path = await uploadIfNeeded(docFrenteUri, formJog.doc_id_frente_path ?? null);

      if (docVersoUri) setUploading('doc_verso');
      const doc_id_verso_path = await uploadIfNeeded(docVersoUri, formJog.doc_id_verso_path ?? null);

      if (termoUri) setUploading('termo');
      const termo_assinado_path = await uploadIfNeeded(termoUri, formJog.termo_assinado_path ?? null);

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

  async function deletarJog(id: string) {
    Alert.alert('Confirmar', 'Excluir este jogador?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('jogadores').delete().eq('id', id);
        if (error) {
          console.log('delete jogador err:', error);
          return Alert.alert('Erro', error.message);
        }
        await load();
      }}
    ]);
  }

  // ====== VOLUNTÁRIOS (sem mudanças de lógica de upload) ======
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

  async function deletarVol(id: string) {
    Alert.alert('Confirmar', 'Excluir este voluntário?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('voluntarios').delete().eq('id', id);
        if (error) {
          console.log('delete voluntario err:', error);
          return Alert.alert('Erro', error.message);
        }
        await load();
      }}
    ]);
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
              <Picker
                selectedValue={filtroStatus}
                onValueChange={(v)=>setFiltroStatus(v as any)}
                style={styles.picker}
              >
                <Picker.Item label="Todos" value="todos" />
                {STATUS_OPTIONS.map(s => <Picker.Item key={s} label={s} value={s} />)}
              </Picker>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Categoria (ano)</Text>
              <Picker
                selectedValue={filtroCategoria === 'todos' ? 'todos' : String(filtroCategoria)}
                onValueChange={(v)=> setFiltroCategoria(v === 'todos' ? 'todos' : Number(v))}
                style={styles.picker}
              >
                <Picker.Item label="Todas" value="todos" />
                {anosDisponiveis.map(ano => <Picker.Item key={ano} label={String(ano)} value={String(ano)} />)}
              </Picker>
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
                {VOL_TIPOS.map(t => <Picker.Item key={t} label={t} value={t} />)}
              </Picker>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Status</Text>
              <Picker
                selectedValue={filtroAtivo}
                onValueChange={(v)=>setFiltroAtivo(v as any)}
                style={styles.picker}
              >
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

      {/* LISTAS */}
      {loading ? (
        <ActivityIndicator color="#007BFF" style={{ marginTop: 40 }} />
      ) : tab==='jogadores' ? (
        <FlatList
          data={jogadoresFiltrados}
          keyExtractor={(i)=>i.id}
          renderItem={({item})=>(
            <View style={styles.card}>
              <Text style={styles.title}>{item.nome}</Text>
              <Text style={styles.line}>Nasc.: {item.data_nascimento ? new Date(item.data_nascimento).toLocaleDateString() : '-'}</Text>
              <Text style={styles.line}>Categoria (ano): {item.categoria ?? (item.data_nascimento ? new Date(item.data_nascimento).getFullYear() : '-')}</Text>
              <Text style={styles.line}>Status: {item.status}</Text>
              {!!item.telefone && <Text style={styles.line}>Tel: {item.telefone}</Text>}
              <View style={styles.rowButtons}>
                <TouchableOpacity style={styles.btnPrimary} onPress={() => openEditJog(item)}>
                  <Text style={styles.btnText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnDanger} onPress={() => deletarJog(item.id)}>
                  <Text style={styles.btnText}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={<Text style={styles.empty}>Nenhum jogador encontrado.</Text>}
        />
      ) : (
        <FlatList
          data={voluntariosFiltrados}
          keyExtractor={(i)=>i.id}
          renderItem={({item})=>(
            <View style={styles.card}>
              <Text style={styles.title}>{item.nome}</Text>
              <Text style={styles.line}>Tipo: {item.tipo}</Text>
              <Text style={styles.line}>Status: {item.ativo ? 'ativo' : 'inativo'}</Text>
              {!!item.telefone && <Text style={styles.line}>Tel: {item.telefone}</Text>}
              <View style={styles.rowButtons}>
                <TouchableOpacity style={styles.btnPrimary} onPress={() => openEditVol(item)}>
                  <Text style={styles.btnText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnDanger} onPress={() => deletarVol(item.id)}>
                  <Text style={styles.btnText}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={<Text style={styles.empty}>Nenhum voluntário encontrado.</Text>}
        />
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

            {/* categoria apenas exibida */}
            <Text style={{ color:'#B0B0B0', marginBottom:10 }}>
              Categoria (ano): {formJog.data_nascimento ? new Date(formJog.data_nascimento).getFullYear() : (editJog?.categoria ?? '-')}
            </Text>

            <TextInput style={styles.input} placeholder="Telefone" placeholderTextColor="#A0A0A0"
              value={formJog.telefone ?? ''} onChangeText={(t)=>setFormJog(s=>({...s, telefone:t}))} keyboardType="phone-pad" />
            <TextInput style={styles.input} placeholder="E-mail (opcional)" placeholderTextColor="#A0A0A0"
              value={formJog.email ?? ''} onChangeText={(t)=>setFormJog(s=>({...s, email:t}))} keyboardType="email-address" />
            <TextInput style={styles.input} placeholder="Responsável (se menor de 18)" placeholderTextColor="#A0A0A0"
              value={formJog.responsavel_nome ?? ''} onChangeText={(t)=>setFormJog(s=>({...s, responsavel_nome:t}))} />

            {/* CHANGED: Foto do jogador */}
            <View style={styles.box}>
              <Text style={{ color:'#fff', fontWeight:'bold', marginBottom:8 }}>Foto do jogador</Text>
              <TouchableOpacity style={styles.btnNeutral} onPress={()=>pick('foto')}>
                <Feather name="image" size={18} color="#fff" />
                <Text style={styles.btnText}>  Selecionar imagem</Text>
              </TouchableOpacity>
              {/* preview: novo upload OU existente do banco */}
              {fotoUri
                ? <Image source={{ uri: fotoUri }} style={styles.preview} />
                : (formJog.foto_path ? <Image source={{ uri: supabase.storage.from('jogadores').getPublicUrl(formJog.foto_path).data.publicUrl }} style={styles.preview} /> : null)
              }
              {uploading==='foto' && <ActivityIndicator color="#00C2CB" />}
            </View>

            {/* CHANGED: Documento identidade (frente/verso) */}
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

            {/* Termo assinado */}
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

            {/* STATUS via Picker */}
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

      {/* MODAL VOLUNTÁRIO (sem mudanças relevantes) */}
      {/* ... mantém o que você já tem (com Pickers para tipo/status) ... */}
    </SafeAreaView>
  );
}

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
