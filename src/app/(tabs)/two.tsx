import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, SafeAreaView, StyleSheet, Text, View, TextInput,
  TouchableOpacity, FlatList, ActivityIndicator, Platform, 
  Modal, ScrollView, Image, Linking,
  Switch
} from 'react-native';
import { useAuth } from '@/src/contexts/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { router, Redirect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import DateTimePicker from '@react-native-community/datetimepicker';
import { TextInputMask } from 'react-native-masked-text';

const AppSafeArea = Platform.OS === 'web' ? View : SafeAreaView;
const ModalSafeArea = Platform.OS === 'web' ? View : SafeAreaView;

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

function todayYmd() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}


// Escapa ; converte undefined/null -> ''
function csvEscape(v: any) {
  const s = v === null || v === undefined ? '' : String(v);
  // Se contém aspas, vírgula, ; ou quebras de linha, envolve em aspas e duplica aspas internas
  const needsQuote = /[";\n,\r]/.test(s);
  if (!needsQuote) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

// Gera CSV a partir de headers e rows (obj)
function toCsv(
  rows: any[],
  headers: { key: string; label: string; map?: (row: any) => any }[],
  delimiter = ';' // ; fica melhor para abrir no Excel pt-BR
) {
  const head = headers.map(h => csvEscape(h.label)).join(delimiter);
  const body = rows
    .map(row =>
      headers
        .map(h => csvEscape(h.map ? h.map(row) : row[h.key]))
        .join(delimiter)
    )
    .join('\n');
  return head + '\n' + body + '\n';
}

// Baixa/Compartilha arquivo
async function downloadCsv(filename: string, csv: string) {
  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory!;
    const path = dir + filename;
    await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(path, {
      mimeType: 'text/csv',
      dialogTitle: 'Exportar CSV',
      UTI: 'public.comma-separated-values-text',
    });
  }
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

// Mantém só dígitos
function onlyDigits(v: string) { return (v || '').replace(/\D/g, ''); }

// Formata CPF: 000.000.000-00
function formatCpf(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  const p1 = d.slice(0, 3);
  const p2 = d.slice(3, 6);
  const p3 = d.slice(6, 9);
  const p4 = d.slice(9, 11);
  if (d.length <= 3) return p1;
  if (d.length <= 6) return `${p1}.${p2}`;
  if (d.length <= 9) return `${p1}.${p2}.${p3}`;
  return `${p1}.${p2}.${p3}-${p4}`;
}

// Formata CNPJ: 00.000.000/0000-00
function formatCnpj(v: string) {
  const d = onlyDigits(v).slice(0, 14);
  const p1 = d.slice(0, 2);
  const p2 = d.slice(2, 5);
  const p3 = d.slice(5, 8);
  const p4 = d.slice(8, 12);
  const p5 = d.slice(12, 14);
  if (d.length <= 2) return p1;
  if (d.length <= 5) return `${p1}.${p2}`;
  if (d.length <= 8) return `${p1}.${p2}.${p3}`;
  if (d.length <= 12) return `${p1}.${p2}.${p3}/${p4}`;
  return `${p1}.${p2}.${p3}/${p4}-${p5}`;
}

// Decide formatação com base no tipo
function formatCpfCnpj(v: string, tipo: 'pf' | 'pj') {
  return tipo === 'pf' ? formatCpf(v) : formatCnpj(v);
}

// Limita o valor bruto conforme o tipo
function clampCpfCnpjDigits(v: string, tipo: 'pf' | 'pj') {
  const d = onlyDigits(v);
  return d.slice(0, tipo === 'pf' ? 11 : 14);
}

function isCpfLenOk(digits?: string | null) { return !!digits && digits.length === 11; }
function isCnpjLenOk(digits?: string | null) { return !!digits && digits.length === 14; }

/* ============== Tipos ============== */
type StatusJog = 'pre_inscrito' | 'ativo' | 'inativo';
type TipoCol = 'viewer' | 'coach' | 'admin';

type Jogador = {
  id: string;
  nome: string;
  data_nascimento: string | null;
  categoria: number | null;
  telefone: string | null;
  email: string | null;
  responsavel_nome: string | null;
  // NOVOS
  is_jogador_guarani: boolean;
  termo_entregue: boolean;
  observacao: string | null;

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
  type_user: TipoCol | null;   // <- era "tipo"
  created_at: string;
  updated_at: string | null;
};

const STATUS_OPTIONS: StatusJog[] = ['pre_inscrito','ativo','inativo'];
const COL_TIPOS: TipoCol[] = ['viewer', 'coach', 'admin'];
const getCategoriaAno = (j: Jogador) =>
  j.categoria ?? (j.data_nascimento ? new Date(j.data_nascimento).getFullYear() : null);

const COL_LABEL: Record<TipoCol, string> = {
  viewer: 'viewer',
  coach: 'coach',
  admin: 'admin',
};

type TipoPessoa = 'pf' | 'pj';
type TipoDoador = 'mensal' | 'anual' | 'unico'; // Adicionei 'unico' como opção
type StatusParceiro = 'ativo' | 'inativo';

type Parceiro = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  tipo_pessoa: TipoPessoa;
  cpf_cnpj: string | null;
  tipo_doador: TipoDoador;
  termo_assinado: boolean;
  status: StatusParceiro;
  observacao: string | null;
  created_at: string; // Para "Apoiador desde"
};

const TIPO_PESSOA_OPTIONS: TipoPessoa[] = ['pf', 'pj'];
const TIPO_DOADOR_OPTIONS: TipoDoador[] = ['mensal', 'anual', 'unico'];
const STATUS_PARCEIRO_OPTIONS: StatusParceiro[] = ['ativo', 'inativo'];

const formatPgDateOnly = (s?: string | null) => {
  if (!s) return '-';
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d.padStart(2,'0')}/${m.padStart(2,'0')}/${y}`;
};

const SwitchField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: boolean | null;
  onChange: (next: boolean) => void;
}) => {
  const v = !!value;
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.switchRow}>
        <Text style={{ color: '#fff' }}>{v ? 'Sim' : 'Não'}</Text>
        <Switch value={v} onValueChange={onChange} />
      </View>
    </>
  );
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

  const DRIVE_URL = 'https://drive.google.com/drive/folders/SEU_ID_AQUI'; // ⬅️ ajuste aqui

  const [tab, setTab] = useState<'jogadores' | 'colaboradores' | 'parceiros'>('jogadores');

  // BUSCA + FILTROS
  const [search, setSearch] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusJog | 'todos'>('todos');
  const [filtroStatusParceiro, setFiltroStatusParceiro] = useState<StatusParceiro | 'todos'>('todos');
  const [filtroTipoDoador, setFiltroTipoDoador] = useState<TipoDoador | 'todos'>('todos');

  // novos filtros por ano (de/até)
  const [yearFrom, setYearFrom] = useState<string>('');
  const [yearTo, setYearTo] = useState<string>('');
  
function formatLocalForInput(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}
  function onlyDigits(v: string) { return v.replace(/\D/g, ''); }
  function handleYearFrom(v: string) { setYearFrom(onlyDigits(v)); }
  function handleYearTo(v: string) { setYearTo(onlyDigits(v)); }
  const [filtroTipoCol, setFiltroTipoCol] = useState<TipoCol | 'todos'>('todos');
  const [filtroAtivo, setFiltroAtivo] = useState<'todos' | 'ativos' | 'inativos'>('todos');
  const [filtroGuarani, setFiltroGuarani] = useState<'todos'|'sim'|'nao'>('todos');
  const [filtroTermo, setFiltroTermo] = useState<'todos'|'sim'|'nao'>('todos');

  // DATA
  const [loading, setLoading] = useState(true);
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [colaboradores, setcolaboradores] = useState<UserRow[]>([]);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);

  const anosDisponiveis = useMemo(() => {
    const anos = new Set<number>();
    jogadores.forEach(j => { if (j.categoria) anos.add(j.categoria); });
    return Array.from(anos).sort((a,b)=>b-a);
  }, [jogadores]);

  const notify = React.useCallback((title: string, msg: string) => {
    if (Platform.OS === 'web') {
      // Usa seu banner amarelo de debug
      setDebugMsg(`${title}: ${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);

    const { data: jog, error: ej } = await supabase
      .from('jogadores')
      .select('id,nome,data_nascimento,categoria,telefone,email,responsavel_nome,is_jogador_guarani,termo_entregue,observacao,status,created_at,atualizado_em')
      .order('nome', { ascending: true }); // ✅ ordenar por nome
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
    setcolaboradores((users ?? []) as any);

    const { data: par, error: ep } = await supabase
      .from('parceiros') // <<< Presume que a tabela se chama 'parceiros'
      .select('*')
      .order('created_at', { ascending: false });
    
    if (ep) {
      console.log('parceiros err:', ep);
      Alert.alert('Erro ao buscar parceiros', ep.message);
      setParceiros([]);
    } else {
      setParceiros((par ?? []) as any);
    }

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // FILTROS
  const jogadoresFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();

    // Só filtra quando tiver exatamente 4 dígitos
    const yf = yearFrom.length === 4 ? Number(yearFrom) : null; // DE (>=)
    const yt = yearTo.length === 4 ? Number(yearTo) : null;     // ATÉ (<=)

    return jogadores.filter(j => {
      if (filtroStatus !== 'todos' && j.status !== filtroStatus) return false;

      // ✅ novos filtros booleanos
      if (filtroGuarani !== 'todos') {
        const want = (filtroGuarani === 'sim');
        if ((j.is_jogador_guarani ?? false) !== want) return false;
      }
      if (filtroTermo !== 'todos') {
        const want = (filtroTermo === 'sim');
        if ((j.termo_entregue ?? false) !== want) return false;
      }

      const cat = getCategoriaAno(j);
      if (yf !== null && !(cat != null && cat >= yf)) return false;
      if (yt !== null && !(cat != null && cat <= yt)) return false;

      if (!q) return true;
      const catStr = cat?.toString() ?? '';
      const blob = [
        j.nome, j.email ?? '', j.telefone ?? '', catStr, j.status, j.responsavel_nome ?? '',
        j.observacao ?? ''
      ].join(' ').toLowerCase();
      return blob.includes(q);
    });
  }, [jogadores, search, filtroStatus, yearFrom, yearTo, filtroGuarani, filtroTermo]);

  const colaboradoresFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return colaboradores.filter(v => {
      if (filtroTipoCol !== 'todos' && v.type_user !== filtroTipoCol) return false; // <- type_user
      if (filtroAtivo === 'ativos' && !v.ativo) return false;
      if (filtroAtivo === 'inativos' && v.ativo) return false;
      if (!q) return true;
      const blob = [
        v.full_name ?? '',
        v.email ?? '',
        v.telefone ?? '',
        v.type_user ?? '',
        v.ativo ? 'ativo' : 'inativo',
        v.observacoes ?? '',   // ✅ incluir observações no blob
      ].join(' ').toLowerCase();
      return blob.includes(q);
    });
  }, [colaboradores, search, filtroTipoCol, filtroAtivo]);

  const parceirosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return parceiros.filter(p => {
      if (filtroStatusParceiro !== 'todos' && p.status !== filtroStatusParceiro) return false;
      if (filtroTipoDoador !== 'todos' && p.tipo_doador !== filtroTipoDoador) return false;
      if (!q) return true;
      const blob = [p.nome, p.email ?? '', p.telefone ?? '', p.cpf_cnpj ?? '', p.endereco ?? '']
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [parceiros, search, filtroStatusParceiro, filtroTipoDoador]);

  async function exportJogadoresCsv() {
    if (!jogadoresFiltrados.length) {
      Alert.alert('Exportar', 'Nenhum jogador para exportar.');
      return;
    }
    const headers = [
      { key: 'nome', label: 'Nome' },
      { key: 'data_nascimento', label: 'Nascimento' },
      { key: 'categoria', label: 'Categoria', map: (j: Jogador) => getCategoriaAno(j) ?? '' },
      { key: 'status', label: 'Status' },
      { key: 'telefone', label: 'Telefone' },
      { key: 'email', label: 'E-mail' },
      { key: 'responsavel_nome', label: 'Responsável' },
      { key: 'created_at', label: 'Criado em' },
      { key: 'id', label: 'ID' },
    ];
    const csv = toCsv(jogadoresFiltrados, headers);
    await downloadCsv(`jogadores_${new Date().toISOString().slice(0,10)}.csv`, csv);
  }

  async function exportcolaboradoresCsv() {
    if (!colaboradoresFiltrados.length) {
      Alert.alert('Exportar', 'Nenhum Colaborador para exportar.');
      return;
    }
    const headers = [
      { key: 'full_name', label: 'Nome' },
      { key: 'email', label: 'E-mail' },
      { key: 'telefone', label: 'Telefone' },
      { key: 'type_user', label: 'Tipo' },
      { key: 'ativo', label: 'Status', map: (v: UserRow) => (v.ativo ? 'ativo' : 'inativo') },
      { key: 'created_at', label: 'Criado em' },
      { key: 'id', label: 'ID' },
    ];
    const csv = toCsv(colaboradoresFiltrados, headers);
    await downloadCsv(`colaboradores_${new Date().toISOString().slice(0,10)}.csv`, csv);
  }

  // ====== MODAIS JOGADOR ======
  const [modalJog, setModalJog] = useState(false);
  const [editJog, setEditJog] = useState<Jogador | null>(null);
  const [formJog, setFormJog] = useState<Partial<Jogador>>({});
  const [jogTelefoneMasked, setJogTelefoneMasked] = useState('');
  
  // ===== Jogador: foco/scroll/erro do RESPONSÁVEL =====
  const jogScrollRef = React.useRef<ScrollView>(null);
  const responsavelRef = React.useRef<TextInput>(null);
  const [jogRespY, setJogRespY] = React.useState<number>(0);
const [jogErrors, setJogErrors] = useState<Record<string, string>>({});


  // === Feedback abaixo do nascimento (igual ao Signup) ===
  const idade = useMemo(() => {
    const s = formJog.data_nascimento;
    if (!s) return null;
    const dob = new Date(s);
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  }, [formJog.data_nascimento]);

  const categoriaAno = useMemo(() => {
    // mesma regra do banco: ano da data de nascimento
    const s = formJog.data_nascimento;
    const y = s ? Number(s.slice(0, 4)) : null;
    if (!y || Number.isNaN(y)) {
      // mantém o valor atual do jogador se estiver editando
      return editJog?.categoria ?? null;
    }
    return y;
  }, [formJog.data_nascimento, editJog?.categoria]);

  const responsavelObrigatorio = idade !== null && idade < 18;

  const [savingJog, setSavingJog] = useState(false);

  function openEditJog(j?: Jogador) {
    if (j) { 
      setEditJog(j); 
      setFormJog(j); 
      setJogTelefoneMasked(j.telefone ?? '');
    } else { 
      setEditJog(null); 
      setFormJog({ status: 'pre_inscrito' as StatusJog, data_nascimento: todayYmd() }); // 👈 default = hoje
      setJogTelefoneMasked('');
    }
    setModalJog(true);
  }

  async function saveJogador() {
    // 1. Limpa erros anteriores
    setJogErrors({});
    const errors: Record<string, string> = {};

    // 2. Validação do NOME
    const nomeValido = (formJog.nome ?? '').trim();
    if (!nomeValido) {
      errors.nome = 'Nome é obrigatório.';
    }

    // 3. Validação do TELEFONE
    const telefoneValido = (formJog.telefone ?? '').trim();
    if (!telefoneValido) {
      errors.telefone = 'Telefone é obrigatório.';
    }

    // 4. Validação do RESPONSÁVEL (Usando a lógica segura que já criamos)
    if (responsavelObrigatorio) {
      const nomeResp = (formJog.responsavel_nome ?? '').trim();
      if (!nomeResp) {
        errors.responsavel = 'Responsável é obrigatório para menores de 18 anos.';
      }
    }

    // 5. SE HOUVER ERROS, PARA TUDO E MOSTRA NA TELA
    if (Object.keys(errors).length > 0) {
      setJogErrors(errors);
      setSavingJog(false);
      return; // <--- Interrompe aqui, não salva
    }
    if (!formJog?.nome?.trim()) return Alert.alert('Atenção', 'Informe o nome.');
    if (!formJog?.telefone?.trim()) return Alert.alert('Atenção', 'Informe o telefone.');
    // responsável obrigatório para menor de 18
    if (!responsavelObrigatorio && !(formJog.responsavel_nome ?? '').trim()) {
      setSavingJog(false);
      setJogErrors(e => ({ ...e, responsavel: 'Responsável é obrigatório para menores de 18 anos.' }));
      requestAnimationFrame(() => {
        responsavelRef.current?.focus();
        jogScrollRef.current?.scrollTo({ y: Math.max(jogRespY - 16, 0), animated: true });
      });
      if (Platform.OS === 'web') {
        setDebugMsg('Atenção: Responsável é obrigatório para menores de 18 anos.');
      } else {
        Alert.alert('Atenção', 'Responsável é obrigatório para menores de 18 anos.');
      }
      return;
    }
    try {
      setSavingJog(true);

      // calcula categoria (ano)
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

        // NOVOS
        is_jogador_guarani: !!formJog.is_jogador_guarani,
        termo_entregue: !!formJog.termo_entregue,
        observacao: formJog.observacao ?? null,

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
    } catch (e:any) {
      console.log('[saveJogador] erro:', e);
      Alert.alert('Erro ao Salvar Jogador', debugSbError('salvar jogador', e));
    } finally {
      setSavingJog(false);
    }
  }  

  // Data "Apoiador desde" (usa o mesmo padrão do Jogador)
  const [parSince, setParSince] = useState<string>(todayYmd());

  const createdAtIso = new Date(parSince + 'T00:00:00').toISOString();

  function openEditPar(p?: Parceiro) {
    if (p) {
      setEditPar(p);
      setFormPar(p);
      setParTelefoneMasked(p.telefone ?? '');
      // pega YYYY-MM-DD da coluna created_at (ou mantém hoje se não vier)
      const iso = p.created_at ?? '';
      const ymd = iso ? iso.slice(0, 10) : todayYmd();
      setParSince(ymd);
    } else {
      setEditPar(null);
      setFormPar({
        status: 'ativo',
        tipo_pessoa: 'pf',
        tipo_doador: 'unico',
        termo_assinado: false,
      });
      setParTelefoneMasked('');
      setParSince(todayYmd()); // default = hoje
    }
    setModalPar(true);
  }

  // ===== Parceiro: foco/scroll/erro do CPF/CNPJ =====
  const parScrollRef = React.useRef<ScrollView>(null);
  const cpfCnpjRef = React.useRef<TextInput>(null);
  const [parFieldY, setParFieldY] = React.useState<number>(0);
const [parErrors, setParErrors] = React.useState<Record<string, string>>({});
  const [parTelefoneMasked, setParTelefoneMasked] = useState('');

  // ====== MODAL DE EXCLUSÃO (Genérico) ======
  const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, nome?: string, full_name?: string | null } | null>(null);
  const [deleteEntityType, setDeleteEntityType] = useState<'jogador' | 'colaborador'| 'parceiro' | null>(null);

  function openDeleteConfirm(item: { id: string, nome?: string, full_name?: string | null }, type: 'jogador' | 'colaborador' | 'parceiro') {
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
    else if (deleteEntityType === 'colaborador') await deletarCol(itemToDelete.id);
    else if (deleteEntityType === 'parceiro') {
      // VVV CRIE UMA NOVA FUNÇÃO 'deletarParceiro' VVV
      await deletarParceiro(itemToDelete.id);
    }
    closeDeleteConfirm();
  }

  async function saveParceiro() {
    if (!formPar?.nome?.trim()) {
      notify('Atenção', 'Informe o nome do parceiro.');
      return;
    }

    try {
      setSavingPar(true);

      const tipo = formPar.tipo_pessoa ?? 'pf';
      if (tipo === 'pf' && formPar.cpf_cnpj && !isCpfLenOk(formPar.cpf_cnpj)) {
        setSavingPar(false);
        setParErrors(e => ({ ...e, cpf_cnpj: 'CPF inválido. Confira os 11 dígitos.' }));
        // foca e rola
        requestAnimationFrame(() => {
          cpfCnpjRef.current?.focus();
          parScrollRef.current?.scrollTo({ y: Math.max(parFieldY - 16, 0), animated: true });
        });
        notify('Atenção', 'CPF inválido. Confira os 11 dígitos.');
        return;
      }
      if (tipo === 'pj' && formPar.cpf_cnpj && !isCnpjLenOk(formPar.cpf_cnpj)) {
        setSavingPar(false);
        setParErrors(e => ({ ...e, cpf_cnpj: 'CNPJ inválido. Confira os 14 dígitos.' }));
        requestAnimationFrame(() => {
          cpfCnpjRef.current?.focus();
          parScrollRef.current?.scrollTo({ y: Math.max(parFieldY - 16, 0), animated: true });
        });
        notify('Atenção', 'CNPJ inválido. Confira os 14 dígitos.');
        return;
      }

      const payload: Omit<Parceiro, 'id' | 'created_at'> = {
        nome: formPar.nome!,
        telefone: formPar.telefone ?? null,
        email: formPar.email ?? null,
        endereco: formPar.endereco ?? null,
        tipo_pessoa: formPar.tipo_pessoa ?? 'pf',
        cpf_cnpj: formPar.cpf_cnpj ?? null,
        tipo_doador: formPar.tipo_doador ?? 'unico',
        termo_assinado: formPar.termo_assinado ?? false,
        status: formPar.status ?? 'ativo',
        observacao: formPar.observacao ?? null,
      };

      let err;
      if (editPar) {
        // UPDATE
        const { error } = await supabase
          .from('parceiros')
          .update({ ...payload, created_at: createdAtIso }) // <- atualiza "Apoiador desde"
          .eq('id', editPar.id);
        err = error;
      } else {
        // INSERT
        const { error } = await supabase
          .from('parceiros')
          .insert({ ...payload, created_at: createdAtIso } as any); // <- define no create
        err = error;
      }

      if (err) throw err;

      setModalPar(false);
      await load();
      setDebugMsg('✅ Dados do parceiro salvos.');
    } catch (e: any) {
      console.log('[saveParceiro] erro:', e);
      const errorMsg = debugSbError('salvar parceiro', e);
      notify('Erro ao Salvar Parceiro', errorMsg);
    } finally {
      setSavingPar(false);
    }
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

  // ====== Colaborador (users) ======
  const [modalCol, setModalCol] = useState(false);
  const [editCol, setEditCol] = useState<UserRow | null>(null);
  const [formCol, setFormCol] = useState<Partial<UserRow>>({});
  const [savingCol, setSavingCol] = useState(false);
  const [newPassword, setNewPassword] = useState<string>('');
  const [modalPar, setModalPar] = useState(false);
  const [editPar, setEditPar] = useState<Parceiro | null>(null);
  const [formPar, setFormPar] = useState<Partial<Parceiro>>({});
  const [savingPar, setSavingPar] = useState(false);
  const [colErrors, setColErrors] = useState<Record<string, string>>({});
  const [colTelefoneMasked, setColTelefoneMasked] = useState('');

  function openeditCol(v?: UserRow) {
    if (v) {
      setEditCol(v);
      setFormCol(v);
      setColTelefoneMasked(v.telefone ?? '');
    } else {
      // ✅ defina um default válido do DB — escolha o que faz sentido (viewer é comum)
      setEditCol(null);
      setFormCol({ ativo: true, type_user: 'viewer' as TipoCol });
      setColTelefoneMasked('');
    }
    setModalCol(true);
  }

  async function saveCol() {
    // 1. Inicia o salvamento e limpa erros
    setSavingCol(true);
    setColErrors({}); 
    const errors: Record<string, string> = {};

    // 2. Validação de NOME
    const nomeValido = (formCol.full_name ?? '').trim();
    if (!nomeValido) {
      errors.full_name = 'Nome é obrigatório.';
    }

    // 3. Validação de E-MAIL
    const emailValido = (formCol.email ?? '').trim();
    if (!emailValido) {
      errors.email = 'E-mail é obrigatório.';
    }

    // 4. Validação de SENHA (Apenas se for um NOVO cadastro)
    // Se editCol for nulo, é um cadastro novo.
    if (!editCol) {
      if (!newPassword || newPassword.trim().length < 6) {
        errors.password = 'Senha é obrigatória (mínimo 6 caracteres).';
      }
    }

    // 5. SE HOUVER ERROS, PARA TUDO
    if (Object.keys(errors).length > 0) {
      setColErrors(errors);
      setSavingCol(false);
      return; // <--- Interrompe aqui
    }
    if (!formCol?.full_name?.trim()) return Alert.alert('Atenção', 'Informe o nome do Colaborador.');
    if (!formCol?.email?.trim()) return Alert.alert('Atenção', 'Informe o e-mail.');

    try {
      setSavingCol(true);

      if (editCol) {
        // ====== E D I T A R  ======
        const { error } = await supabase
          .from('users')
          .update({
            full_name: formCol.full_name ?? null,
            telefone: formCol.telefone ?? null,
            email: formCol.email ?? null,
            type_user: formCol.type_user ?? null,
            ativo: formCol.ativo ?? true,
            observacoes: formCol.observacoes ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editCol.id);

        // 1) primeiro garante que o update deu certo
        if (error) throw error;

        // 2) só então, se tiver nova senha, chama a Edge Function
        if (newPassword && newPassword.trim().length > 0) {
          const { data: sess } = await supabase.auth.getSession();
          const { error: pwErr } = await supabase.functions.invoke('admin-update-password', {
            headers: { Authorization: `Bearer ${sess?.session?.access_token ?? ''}` },
            body: { user_id: editCol.id, new_password: newPassword.trim() },
          });
          if (pwErr) throw pwErr;
        }

        // 3) fecha modal, limpa estado, recarrega e avisa
        setModalCol(false);
        setEditCol(null);
        setFormCol({});
        setNewPassword('');

        await load();
        setDebugMsg('✅ Dados do Colaborador salvos.');
        Alert.alert('Sucesso', 'Dados do Colaborador salvos.');
        return;
      }

      // ====== C R I A R  ======
      if (!newPassword?.trim()) return Alert.alert('Atenção', 'Defina uma senha para o Colaborador.');

      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess?.session?.access_token ?? '';

      const payload = {
        email: formCol.email,
        password: newPassword,
        full_name: formCol.full_name,
        telefone: formCol.telefone,
        type_user: formCol.type_user as 'viewer' | 'coach' | 'admin',
        observacoes: formCol.observacoes ?? null,
      };

      const { data, error } = await supabase.functions.invoke('create-colaborator', {
        body: payload,
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error) {
        try {
          const res = (error as any).context as Response;
          const txt = await res.text();
          let msg = txt;
          try { msg = JSON.parse(txt)?.error ?? txt; } catch {}
          Alert.alert('Erro ao criar Colaborador', msg);
        } catch {
          Alert.alert('Erro ao criar Colaborador', (error as any)?.message ?? 'Falha desconhecida');
        }
        return;
      }

      setModalCol(false);
      setEditCol(null);
      setFormCol({});
      setNewPassword('');

      await load();
      setDebugMsg('✅ Colaborador criado com sucesso.');
      Alert.alert('Sucesso', 'Colaborador criado com senha.');
    } catch (e: any) {
      console.log('[saveCol] erro:', e);
      Alert.alert('Erro ao Salvar Colaborador', debugSbError('salvar Colaborador', e));
    } finally {
      setSavingCol(false);
    }
  }

  /* ================= "Excluir" Colaborador ================= */
  async function deletarCol(id: string) {
    console.log('[UI] deletarCol start', id);
    await debugLogSession();

    try {
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess?.session?.access_token ?? '';

      const { error } = await supabase.functions.invoke('delete-colaborator', {
        body: { user_id: id },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error) {
        const msg = debugSbError('delete-colaborator edge fn', error);
        setDebugMsg(msg);
        return;
      }

      await load();
      setDebugMsg('✅ Colaborador excluído definitivamente.');
    } catch (e: any) {
      const msg = debugSbError('delete Colaborador catch', e);
      setDebugMsg(msg);
    }
  }
 /* ================= "Excluir" PARCEIRO ================= */
  async function deletarParceiro(id: string) {
    console.log('[UI] deletarParceiro start', id);
    try {
      const delPar = await supabase.from('parceiros').delete().eq('id', id).select('id');
      if (delPar.error) {
        const msg = debugSbError('delete parceiro', delPar.error);
        setDebugMsg(msg);
        return;
      }
      await load();
      setDebugMsg('✅ Parceiro excluído com sucesso.');
    } catch (e: any) {
      const msg = debugSbError('delete parceiro catch', e);
      setDebugMsg(msg);
    }
  }

  return (
    <AppSafeArea style={styles.container}>
      {/* <View style={styles.header}>
        <Text style={styles.logo}>Projeto Guarani</Text>
        <TouchableOpacity onPress={handleSignOut}>
          <Feather name="log-out" size={24} color="#00C2CB" />
        </TouchableOpacity>
      </View> */}

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
        <TouchableOpacity onPress={() => { setTab('jogadores'); setSearch(''); }} style={[styles.segmentBtn, tab==='jogadores' && styles.segmentBtnActive]}>
          <Text style={[styles.segmentTxt, tab==='jogadores' && styles.segmentTxtActive]}>Jogadores</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setTab('colaboradores'); setSearch(''); }} style={[styles.segmentBtn, tab==='colaboradores' && styles.segmentBtnActive]}>
          <Text style={[styles.segmentTxt, tab==='colaboradores' && styles.segmentTxtActive]}>Colaboradores</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setTab('parceiros'); setSearch(''); }} style={[styles.segmentBtn, tab==='parceiros' && styles.segmentBtnActive]}>
          <Text style={[styles.segmentTxt, tab==='parceiros' && styles.segmentTxtActive]}>Parceiros</Text>
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

        {/* VVV LÓGICA DE FILTRO CORRIGIDA VVV */}

        {/* Filtros de Jogadores (só aparece na aba 'jogadores') */}
        {tab === 'jogadores' && (
          <View style={styles.rowWrap}>
            {/* Categoria (ano) — flexível */}
            <View style={styles.colCategory}>
              <Text style={styles.label}>Categoria (ano)</Text>
              <View style={{ flexDirection: 'row', columnGap: 10 }}>
                <TextInput
                  style={[styles.input, styles.shrink, { flex: 1 }]}
                  placeholder="Ano de (ex: 2008)"
                  placeholderTextColor="#A0A0A0"
                  keyboardType="numeric"
                  value={yearFrom}
                  onChangeText={handleYearFrom}
                />
                <TextInput
                  style={[styles.input, styles.shrink, { flex: 1 }]}
                  placeholder="Ano até (ex: 2012)"
                  placeholderTextColor="#A0A0A0"
                  keyboardType="numeric"
                  value={yearTo}
                  onChangeText={handleYearTo}
                />
              </View>
            </View>

            {/* Status — compacto, vem por último */}
            <View style={styles.colStatus}>
              <Text style={styles.label}>Status</Text>
              <Picker
                selectedValue={filtroStatus}
                onValueChange={(v)=>setFiltroStatus(v as any)}
                style={[styles.picker, styles.shrink]}
              >
                <Picker.Item label="Todos" value="todos" />
                {STATUS_OPTIONS.map(s => <Picker.Item key={s} label={s} value={s} />)}
              </Picker>
            </View>
            <View style={styles.colStatus}>
              <Text style={styles.label}>Jogador do Guarani</Text>
              <Picker
                selectedValue={filtroGuarani}
                onValueChange={(v)=>setFiltroGuarani(v as any)}
                style={[styles.picker, styles.shrink]}
              >
                <Picker.Item label="Todos" value="todos" />
                <Picker.Item label="Sim" value="sim" />
                <Picker.Item label="Não" value="nao" />
              </Picker>
            </View>
            <View style={styles.colStatus}>
              <Text style={styles.label}>Termo assinado</Text>
              <Picker
                selectedValue={filtroTermo}
                onValueChange={(v)=>setFiltroTermo(v as any)}
                style={[styles.picker, styles.shrink]}
              >
                <Picker.Item label="Todos" value="todos" />
                <Picker.Item label="Sim" value="sim" />
                <Picker.Item label="Não" value="nao" />
              </Picker>
            </View>
          </View>
        )}

        {/* Filtros de Colaborador (só aparece na aba 'colaboradores') */}
        {tab === 'colaboradores' && (
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Tipo</Text>
              <Picker
                selectedValue={filtroTipoCol}
                onValueChange={(v)=>setFiltroTipoCol(v as any)}
                style={styles.picker}
              >
                <Picker.Item label="Todos" value="todos" />
                {COL_TIPOS.map(t => (
                  <Picker.Item key={t} label={COL_LABEL[t]} value={t} />
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

        {/* Filtros de Parceiros (só aparece na aba 'parceiros') */}
        {tab === 'parceiros' && (
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Status</Text>
              <Picker selectedValue={filtroStatusParceiro} onValueChange={(v)=>setFiltroStatusParceiro(v as any)} style={styles.picker}>
                <Picker.Item label="Todos" value="todos" />
                {STATUS_PARCEIRO_OPTIONS.map(s => <Picker.Item key={s} label={s.charAt(0).toUpperCase() + s.slice(1)} value={s} />)}
              </Picker>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Tipo Doador</Text>
              <Picker selectedValue={filtroTipoDoador} onValueChange={(v)=>setFiltroTipoDoador(v as any)} style={styles.picker}>
                <Picker.Item label="Todos" value="todos" />
                {TIPO_DOADOR_OPTIONS.map(t => <Picker.Item key={t} label={t.charAt(0).toUpperCase() + t.slice(1)} value={t} />)}
              </Picker>
            </View>
          </View>
        )}
        
        {/* ^^^ FIM DA LÓGICA DE FILTRO CORRIGIDA ^^^ */}

      </View>

      {/* AÇÕES */}
      <View style={{ flexDirection:'row', justifyContent:'flex-end', gap: 10, marginBottom: 12 }}>
        <TouchableOpacity style={styles.btnNeutral} onPress={() => Linking.openURL(DRIVE_URL)}>
          <Feather name="external-link" size={16} color="#fff" />
          <Text style={styles.btnText}>  Abrir Drive</Text>
        </TouchableOpacity>

        {tab === 'jogadores' ? (
          <TouchableOpacity style={styles.btnPrimary} onPress={() => openEditJog()}>
            <Feather name="user-plus" size={16} color="#fff" />
            <Text style={styles.btnText}>  Cadastrar Jogador</Text>
          </TouchableOpacity>
        ) : tab === 'colaboradores' ? (
          <TouchableOpacity style={styles.btnPrimary} onPress={() => openeditCol()}>
            <Feather name="user-plus" size={16} color="#fff" />
            <Text style={styles.btnText}>  Cadastrar Colaborador</Text>
          </TouchableOpacity>
        ) : (
          // VVV ADICIONE ESTE BLOCO VVV
          <TouchableOpacity style={styles.btnPrimary} onPress={() => openEditPar()}>
            <Feather name="user-plus" size={16} color="#fff" />
            <Text style={styles.btnText}>  Cadastrar Parceiro</Text>
          </TouchableOpacity>
          // ^^^ FIM DO BLOCO ^^^
        )}
      </View>

      {/* LISTAS EM TABELA */}
      {loading && (
        <ActivityIndicator color="#007BFF" style={{ marginTop: 40 }} />
      )}

      {!loading && tab === 'jogadores' && (
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
                      onPress={() => openDeleteConfirm(item, 'jogador')}
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
      )}

      {!loading && tab === 'colaboradores' && (
        <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginBottom: 12 }}>
          <View style={{ width: 220 + 160 + 120 + 160 + 260 + 180 }}>
            <FlatList
              data={colaboradoresFiltrados}
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
                  <Text style={[tableStyles.cell, { width: 220 }]} numberOfLines={1}>{item.full_name}</Text>
                  <Text style={[tableStyles.cell, { width: 160 }]}>{COL_LABEL[item.type_user!]}</Text>
                  <Text style={[tableStyles.cell, { width: 120 }]}>{item.ativo ? 'ativo' : 'inativo'}</Text>
                  <Text style={[tableStyles.cell, { width: 160 }]} numberOfLines={1}>{item.telefone ?? '-'}</Text>
                  <Text style={[tableStyles.cell, { width: 260 }]} numberOfLines={1}>{item.email ?? '-'}</Text>
                  <View style={[tableStyles.cell, { width: 180, flexDirection: 'row', gap: 8 }]}>
                    <TouchableOpacity style={styles.btnPrimary} onPress={() => openeditCol(item)}>
                      <Text style={styles.btnText}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnDanger}
                      onPress={() => openDeleteConfirm(item, 'colaborador')}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={styles.btnText}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.empty}>Nenhum Colaborador encontrado.</Text>}
            />
          </View>
        </ScrollView>
      )}

      {!loading && tab === 'parceiros' && (
        <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginBottom: 12 }}>
          <View style={{ width: 180 + 120 + 150 + 100 + 100 + 180 }}>
            <FlatList
              data={parceirosFiltrados}
              keyExtractor={(i) => i.id}
              ListHeaderComponent={
                <View style={tableStyles.headerRow}>
                  <Text style={[tableStyles.cell, tableStyles.headerCell, { width: 180 }]}>Nome</Text>
                  <Text style={[tableStyles.cell, tableStyles.headerCell, { width: 120 }]}>Telefone</Text>
                  <Text style={[tableStyles.cell, tableStyles.headerCell, { width: 150 }]}>Doador</Text>
                  <Text style={[tableStyles.cell, tableStyles.headerCell, { width: 100 }]}>Termo</Text>
                  <Text style={[tableStyles.cell, tableStyles.headerCell, { width: 100 }]}>Status</Text>
                  <Text style={[tableStyles.cell, tableStyles.headerCell, { width: 180 }]}>Ações</Text>
                </View>
              }
              renderItem={({ item, index }) => (
                <View style={[tableStyles.bodyRow, index % 2 === 1 && { backgroundColor: '#223653' }]}>
                  <Text style={[tableStyles.cell, { width: 180 }]} numberOfLines={1}>{item.nome}</Text>
                  <Text style={[tableStyles.cell, { width: 120 }]}>{item.telefone ?? '-'}</Text>
                  <Text style={[tableStyles.cell, { width: 150 }]}>{item.tipo_doador.charAt(0).toUpperCase() + item.tipo_doador.slice(1)}</Text>
                  <Text style={[tableStyles.cell, { width: 100 }]}>{item.termo_assinado ? 'Sim' : 'Não'}</Text>
                  <Text style={[tableStyles.cell, { width: 100 }]}>{item.status.charAt(0).toUpperCase() + item.status.slice(1)}</Text>
                  <View style={[tableStyles.cell, { width: 180, flexDirection: 'row', gap: 8 }]}>
                    <TouchableOpacity style={styles.btnPrimary} onPress={() => openEditPar(item)}>
                      <Text style={styles.btnText}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnDanger}
                      onPress={() => openDeleteConfirm(item, 'parceiro')}
                    >
                      <Text style={styles.btnText}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.empty}>Nenhum parceiro encontrado.</Text>}
            />
          </View>
        </ScrollView>
      )}

  {/* MODAL JOGADOR */}
  <Modal visible={modalJog} animationType="slide" onRequestClose={() => setModalJog(false)}>
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1931' }}>
      <ScrollView ref={jogScrollRef} contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.h1}>{editJog ? 'Editar Jogador' : 'Cadastrar Jogador'}</Text>

        <TextInput
          // 1. MUDANÇA NO ESTILO: Se tiver erro, aplica a borda vermelha
          style={[styles.input, jogErrors.nome && styles.inputError]}
          
          placeholder="Nome completo"
          placeholderTextColor="#A0A0A0"
          value={formJog.nome ?? ''}
          
          // 2. MUDANÇA NO ONCHANGE: Limpa o erro ao digitar
          onChangeText={(t) => {
            setFormJog((s) => ({ ...s, nome: t }));
            // Se existir um erro de nome, limpa ele imediatamente
            if (jogErrors.nome) {
              setJogErrors((prev) => ({ ...prev, nome: '' }));
            }
          }}
        />
        
        {/* 3. MUDANÇA: Exibe o texto de erro embaixo do input */}
        {jogErrors.nome && (
          <Text style={styles.inputErrorText}>{jogErrors.nome}</Text>
        )}

        <Text style={styles.label}>Data de nascimento</Text>
        {Platform.OS === 'web' ? (
          <input
            type="date"
            value={(formJog.data_nascimento ?? todayYmd())}
            onChange={(e) => setFormJog(s => ({ ...s, data_nascimento: e.currentTarget.value }))}
            style={{
              padding: 10,
              border: '1px solid #4A6572',
              backgroundColor: '#203A4A',
              color: '#FFF',
              borderRadius: 10,
              height: 50,
              marginBottom: 10,
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
        ) : (
          <DateTimePicker
            mode="date"
            value={
              formJog.data_nascimento
                ? new Date(formJog.data_nascimento + 'T00:00:00')
                : new Date()
            }
            onChange={(_, d) => {
              if (d) {
                const pad = (n: number) => String(n).padStart(2, '0');
                const v = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
                setFormJog(s => ({ ...s, data_nascimento: v }));
              }
            }}
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
          />
        )}

        {(idade !== null || categoriaAno !== null) && (
          <Text style={{ color: '#E0E0E0', marginBottom: 10 }}>
            {idade !== null ? `Idade: ${idade} anos ` : ''}
            {categoriaAno !== null ? `• Categoria (ano): ${categoriaAno}` : ''}
            {responsavelObrigatorio ? ' • (responsável obrigatório)' : ''}
          </Text>
        )}

        <TextInputMask
              type={'cel-phone'}
              options={{ maskType: 'BRL', withDDD: true, dddMask: '(99) ' }}
              
              // Adicione a condicional de estilo aqui também:
              style={[styles.input, jogErrors.telefone && styles.inputError]} 
              
              placeholder="Telefone (com DDD)"
              placeholderTextColor="#A0A0A0"
              keyboardType="phone-pad"
              value={Platform.OS === 'web' ? jogTelefoneMasked : (formJog.telefone ?? '')}
              onChangeText={(maskedText, rawText) => {
                // 1. GARANTIA: Limpamos manualmente para não depender da biblioteca
                // Pega "(11) 99999-9999" e transforma em "11999999999"
                const numeroLimpo = maskedText.replace(/\D/g, ''); 
                
                setFormJog((s) => ({ ...s, telefone: numeroLimpo }));
                
                // 2. Atualiza o visual
                setJogTelefoneMasked(maskedText ?? '');

                // 3. Limpa o erro visual se existir
                if (jogErrors.telefone) {
                   setJogErrors(e => ({ ...e, telefone: '' }));
                }
              }}
            />
        {/* Mensagem de erro do telefone */}
        {jogErrors.telefone && <Text style={styles.inputErrorText}>{jogErrors.telefone}</Text>}
        <TextInput
          style={styles.input}
          placeholder="E-mail (opcional)"
          placeholderTextColor="#A0A0A0"
          value={formJog.email ?? ''}
          onChangeText={(t) => setFormJog((s) => ({ ...s, email: t }))}
          keyboardType="email-address"
        />
        <TextInput
          ref={responsavelRef}
          // ... suas props de layout ...
          style={[styles.input, jogErrors.responsavel && styles.inputError]} // Estilo de erro
          placeholder="Responsável (se menor de 18)"
          // ...
          onChangeText={(t) => {
             setFormJog((s) => ({ ...s, responsavel_nome: t }));
             // Limpa erro ao digitar
             if (jogErrors.responsavel) setJogErrors((e) => ({ ...e, responsavel: '' }));
          }}
        />
        {jogErrors.responsavel && <Text style={styles.inputErrorText}>{jogErrors.responsavel}</Text>}
        {/* === NOVOS CAMPOS === */}
        <SwitchField
          label="Jogador Guarani"
          value={formJog.is_jogador_guarani}
          onChange={(v) => setFormJog(s => ({ ...s, is_jogador_guarani: v }))}
        />

        <SwitchField
          label="Termo entregue"
          value={formJog.termo_entregue}
          onChange={(v) => setFormJog(s => ({ ...s, termo_entregue: v }))}
        />

        <TextInput
          style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
          multiline
          numberOfLines={4}
          placeholder="Observação do jogador"
          placeholderTextColor="#A0A0A0"
          value={formJog.observacao ?? ''}
          onChangeText={(t) => setFormJog((s) => ({ ...s, observacao: t }))}
        />

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
            disabled={savingJog}
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
          
  {/* MODAL Colaborador (USERS) */}
  <Modal visible={modalCol} animationType="slide" onRequestClose={() => setModalCol(false)}>
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1931' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.h1}>{editCol ? 'Editar Colaborador' : 'Cadastrar Colaborador'}</Text>

        <Text style={styles.label}>Nome Completo</Text>
        <TextInput
              style={[styles.input, colErrors.full_name && styles.inputError]} // Estilo condicional
              placeholder="Nome"
              placeholderTextColor="#A0A0A0"
              value={formCol.full_name ?? ''}
              onChangeText={(t) => {
                setFormCol(s => ({ ...s, full_name: t }));
                // Limpa o erro ao digitar
                if (colErrors.full_name) setColErrors(e => ({ ...e, full_name: '' }));
              }}
            />
            {/* Mensagem de erro */}
            {colErrors.full_name && <Text style={styles.inputErrorText}>{colErrors.full_name}</Text>}

        <Text style={styles.label}>Telefone</Text>
            <TextInputMask
              type={'cel-phone'}
              options={{
                maskType: 'BRL',
                withDDD: true,
                dddMask: '(99) ',
              }}
              // Estilo com borda vermelha se tiver erro
              style={[styles.input, colErrors.telefone && styles.inputError]}
              placeholder="Telefone (com DDD)"
              placeholderTextColor="#A0A0A0"
              keyboardType="phone-pad"
              
              // Lógica Web vs Mobile
              value={Platform.OS === 'web' ? colTelefoneMasked : (formCol.telefone ?? '')}
              
              onChangeText={(maskedText, rawText) => {
                // 1. Salva o valor PURO no formulário (remove tudo que não é dígito)
                const numeroLimpo = maskedText.replace(/\D/g, '');
                setFormCol((s) => ({ ...s, telefone: numeroLimpo }));
                
                // 2. Salva o valor MASCARADO no estado auxiliar (para Web)
                setColTelefoneMasked(maskedText ?? '');

                // 3. Limpa o erro ao digitar
                if (colErrors.telefone) setColErrors(e => ({ ...e, telefone: '' }));
              }}
            />
            {/* Mensagem de erro */}
            {colErrors.telefone && <Text style={styles.inputErrorText}>{colErrors.telefone}</Text>}
            
        <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={[styles.input, colErrors.email && styles.inputError]} // Estilo condicional
              placeholder="email@exemplo.com"
              placeholderTextColor="#A0A0A0"
              keyboardType="email-address"
              autoCapitalize="none"
              value={formCol.email ?? ''}
              onChangeText={(t) => {
                setFormCol(s => ({ ...s, email: t }));
                // Limpa o erro ao digitar
                if (colErrors.email) setColErrors(e => ({ ...e, email: '' }));
              }}
            />
            {colErrors.email && <Text style={styles.inputErrorText}>{colErrors.email}</Text>}
        <Text style={styles.label}>
              {editCol ? 'Nova Senha (deixe em branco para manter)' : 'Senha'}
            </Text>
            <TextInput
              style={[styles.input, colErrors.password && styles.inputError]} // Estilo condicional
              placeholder="******"
              placeholderTextColor="#A0A0A0"
              secureTextEntry
              value={newPassword}
              onChangeText={(t) => {
                setNewPassword(t);
                // Limpa o erro ao digitar
                if (colErrors.password) setColErrors(e => ({ ...e, password: '' }));
              }}
            />
            {colErrors.password && <Text style={styles.inputErrorText}>{colErrors.password}</Text>}

        <Text style={styles.label}>Tipo</Text>
        <Picker
          selectedValue={(formCol.type_user as TipoCol) ?? 'viewer'}
          onValueChange={(v) => setFormCol(s => ({ ...s, type_user: v as TipoCol }))}
          style={styles.picker}
        >
          {COL_TIPOS.map(t => (
            <Picker.Item key={t} label={COL_LABEL[t]} value={t} />
          ))}
        </Picker>

        <Text style={styles.label}>Status</Text>
        <Picker
          selectedValue={formCol.ativo ?? true ? 'ativo' : 'inativo'}
          onValueChange={(v) => setFormCol((s) => ({ ...s, ativo: v === 'ativo' }))}
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
          value={formCol.observacoes ?? ''}
          onChangeText={(t) => setFormCol((s) => ({ ...s, observacoes: t }))}
        />

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
          <TouchableOpacity style={[styles.btnPrimary, { flex: 1 }]} onPress={saveCol} disabled={savingCol}>
            {savingCol ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Salvar</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnNeutral, { flex: 1 }]} onPress={() => setModalCol(false)}>
            <Text style={styles.btnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  </Modal>

  <Modal visible={modalPar} onRequestClose={() => setModalPar(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1931' }}>
          <ScrollView ref={parScrollRef} contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.h1}>{editPar ? 'Editar Parceiro' : 'Cadastrar Parceiro'}</Text>

            <Text style={styles.label}>Nome</Text>
            <TextInput
              style={styles.input}
              placeholder="Nome completo"
              placeholderTextColor="#A0A0A0"
              value={formPar.nome ?? ''}
              onChangeText={(t) => setFormPar((s) => ({ ...s, nome: t }))}
            />
            
            <Text style={styles.label}>Telefone</Text>
            <TextInputMask
              type={'cel-phone'}
              options={{
                maskType: 'BRL',
                withDDD: true,
                dddMask: '(99) ',
              }}
              // Estilo: Aplica borda vermelha se houver erro em 'parErrors'
              style={[styles.input, parErrors.telefone && styles.inputError]}
              placeholder="Telefone (com DDD)"
              placeholderTextColor="#A0A0A0"
              keyboardType="phone-pad"
              
              // Lógica Web vs Mobile usando as variáveis de Parceiro
              value={Platform.OS === 'web' ? parTelefoneMasked : (formPar.telefone ?? '')}
              
              onChangeText={(maskedText, rawText) => {
                // 1. Limpa o número (remove formatação) para salvar no banco
                const numeroLimpo = maskedText.replace(/\D/g, '');
                
                setFormPar((s) => ({ ...s, telefone: numeroLimpo }));
                
                // 2. Atualiza o estado visual da Web
                setParTelefoneMasked(maskedText ?? '');

                // 3. Limpa o erro se o usuário começar a digitar
                if (parErrors.telefone) {
                  setParErrors((e) => ({ ...e, telefone: '' }));
                }
              }}
            />
            {/* Mensagem de erro abaixo do campo */}
            {parErrors.telefone && <Text style={styles.inputErrorText}>{parErrors.telefone}</Text>}

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="E-mail"
              placeholderTextColor="#A0A0A0"
              keyboardType="email-address"
              autoCapitalize="none"
              value={formPar.email ?? ''}
              onChangeText={(t) => setFormPar((s) => ({ ...s, email: t }))}
            />

            <Text style={styles.label}>Endereço</Text>
            <TextInput
              style={styles.input}
              placeholder="Endereço"
              placeholderTextColor="#A0A0A0"
              value={formPar.endereco ?? ''}
              onChangeText={(t) => setFormPar((s) => ({ ...s, endereco: t }))}
            />
            
            <Text style={styles.label}>Tipo de Pessoa</Text>
            <Picker
              selectedValue={formPar.tipo_pessoa ?? 'pf'}
              onValueChange={(v) => setFormPar((s) => ({ ...s, tipo_pessoa: v as TipoPessoa }))}
              style={styles.picker}
            >
              {TIPO_PESSOA_OPTIONS.map((t) => (
                <Picker.Item key={t} label={t.toUpperCase()} value={t} />
              ))}
            </Picker>

            <Text style={styles.label}>{formPar.tipo_pessoa === 'pf' ? 'CPF' : 'CNPJ'}</Text>
            <TextInput
              ref={cpfCnpjRef}
              onLayout={(e) => setParFieldY(e.nativeEvent.layout.y)} // salva a posição Y do campo
              style={[styles.input, parErrors.cpf_cnpj && styles.inputError]} // destaca em erro
              placeholder={formPar.tipo_pessoa === 'pf' ? '000.000.000-00' : '00.000.000/0000-00'}
              placeholderTextColor="#A0A0A0"
              keyboardType="numeric"
              value={formatCpfCnpj(formPar.cpf_cnpj ?? '', formPar.tipo_pessoa ?? 'pf')}
              onChangeText={(t) => {
                const tipo = formPar.tipo_pessoa ?? 'pf';
                const digits = clampCpfCnpjDigits(t, tipo);
                setFormPar(s => ({ ...s, cpf_cnpj: digits }));
                // limpa erro ao digitar
              }}
            />
            {!!parErrors.cpf_cnpj && (
              <Text style={styles.inputErrorText}>{parErrors.cpf_cnpj}</Text>
            )}

            <Text style={styles.label}>Tipo de Doador</Text>
            <Picker
              selectedValue={formPar.tipo_doador ?? 'unico'}
              onValueChange={(v) => setFormPar((s) => ({ ...s, tipo_doador: v as TipoDoador }))}
              style={styles.picker}
            >
              {TIPO_DOADOR_OPTIONS.map((t) => (
                <Picker.Item key={t} label={t.charAt(0).toUpperCase() + t.slice(1)} value={t} />
              ))}
            </Picker>

            <SwitchField
              label="Termo Assinado"
              value={formPar.termo_assinado}
              onChange={(v) => setFormPar(s => ({ ...s, termo_assinado: v }))}
            />

            <Text style={styles.label}>Status</Text>
            <Picker
              selectedValue={formPar.status ?? 'ativo'}
              onValueChange={(v) => setFormPar((s) => ({ ...s, status: v as StatusParceiro }))}
              style={styles.picker}
            >
              {STATUS_PARCEIRO_OPTIONS.map((s) => (
                <Picker.Item key={s} label={s.charAt(0).toUpperCase() + s.slice(1)} value={s} />
              ))}
            </Picker>

            <Text style={styles.label}>Observação</Text>
            <TextInput
              style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
              multiline
              numberOfLines={4}
              placeholder="Observações"
              placeholderTextColor="#A0A0A0"
              value={formPar.observacao ?? ''}
              onChangeText={(t) => setFormPar((s) => ({ ...s, observacao: t }))}
            />

            <Text style={styles.label}>Apoiador desde</Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={parSince}
                onChange={(e) => setParSince(e.currentTarget.value)} // YYYY-MM-DD
                style={{
                  padding: 10,
                  border: '1px solid #4A6572',
                  backgroundColor: '#203A4A',
                  color: '#FFF',
                  borderRadius: 10,
                  height: 50,
                  marginBottom: 10,
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              />
            ) : (
              <DateTimePicker
                mode="date"
                value={new Date(parSince + 'T00:00:00')}
                onChange={(_, d) => {
                  if (d) {
                    const pad = (n: number) => String(n).padStart(2, '0');
                    const v = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
                    setParSince(v);
                  }
                }}
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
              />
            )}

            {/* dentro do conteúdo do Modal de Parceiro, logo após o título */}
            {!!debugMsg && (
              <View style={styles.debugBanner}>
                <Text style={styles.debugBannerText}>{debugMsg}</Text>
                <TouchableOpacity onPress={() => setDebugMsg(null)} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
                  <Feather name="x" size={20} color="#000" />
                </TouchableOpacity>
              </View>
            )}
            
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.btnPrimary, { flex: 1 }]}
                onPress={saveParceiro}
                disabled={savingPar}
              >
                {savingPar ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Salvar</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnNeutral, { flex: 1 }]} onPress={() => setModalPar(false)}>
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
            Você tem certeza que deseja excluir o {deleteEntityType === 'jogador' ? 'jogador' : (deleteEntityType === 'colaborador' ? 'Colaborador' : 'parceiro')}{' '}
            <Text style={{ fontWeight: 'bold' }}>{itemToDelete.nome || itemToDelete.full_name}</Text>?
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
    </AppSafeArea>
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
  h1: { color:'#FFF', fontWeight:'700', fontSize:22, marginTop: 12, marginBottom:12, textAlign:'center' },

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

  picker: { height:50, backgroundColor:'#203A4A', borderRadius:10, color:'#fff', marginBottom:10, borderWidth:1, borderColor:'#4A6572' },

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
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 10,
    rowGap: 10,
    alignItems: 'flex-end',
  },

  // permite que inputs/picker encolham no web (senão quebram cedo)
  shrink: { minWidth: 0 },

  // Categoria ocupa o restante da linha, encolhe quando preciso
  colCategory: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 300,     // mantém dois inputs confortáveis; ajuste se quiser
  },

  // Status com largura fixa (compacto). Fica na mesma linha enquanto houver espaço.
  colStatus: {
    width: 220,        // 200–240 é um bom range
    flexGrow: 0,
    flexShrink: 0,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 50,
    backgroundColor: '#203A4A',
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#4A6572',
    marginBottom: 10
  },
  labelInfo: {
    fontSize: 14,
    color: '#B0B0B0',
    marginBottom: 10,
  },
  inputError: {
    borderColor: '#FF6B6B',
    backgroundColor: '#2A1F1F',
  },
  inputErrorText: {
    color: '#FF6B6B',
    marginTop: -6,
    marginBottom: 10,
    fontSize: 12,
  },
});
