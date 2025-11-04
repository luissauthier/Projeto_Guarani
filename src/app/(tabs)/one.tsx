import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, SafeAreaView, StyleSheet, Text, View, FlatList, ActivityIndicator,
  TouchableOpacity, TextInput, Modal, ScrollView, Switch, Platform
} from 'react-native';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import DateTimePicker from '@react-native-community/datetimepicker';


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

  // filtros por string (web-friendly)
  const [inicioStr, setInicioStr] = useState<string>('');   // "", "2025", "2025-11", "2025-11-03"
  const [fimStr, setFimStr] = useState<string>('');         // idem

  // --- contagem de presenças por treino ---
  const [presCount, setPresCount] = useState<Record<string, { presente: number; faltou: number; justificou: number }>>({});

  function yyyyMm(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  const [dataInicio, setDataInicio] = useState<Date | null>(null);
  const [dataFim, setDataFim] = useState<Date | null>(null);

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

  // const loadPresencasCount = useCallback(async () => {
  //   const { data, error } = await supabase
  //     .from('presenca')
  //     .select('treino_id, status');

  //   if (error) {
  //     console.log('[presenca][count] erro:', error);
  //     setPresCount({});
  //     return;
  //   }

  //   const map: Record<string, { presente: number; faltou: number; justificou: number }> = {};
  //   (data ?? []).forEach((row: any) => {
  //     const id = row.treino_id as string;
  //     const st = row.status as 'presente' | 'faltou' | 'justificou';
  //     if (!map[id]) map[id] = { presente: 0, faltou: 0, justificou: 0 };
  //     map[id][st] = (map[id][st] ?? 0) + 1;
  //   });

  //   setPresCount(map);
  // }, []);

  // antiga loadPresencasCount → vire um helper genérico por lista de treinos
  async function loadPresencasCountFor(treinoIds: string[]) {
    if (!treinoIds.length) { setPresCount({}); return; }

    const { data, error } = await supabase
      .from('presenca')
      .select('treino_id, status')
      .in('treino_id', treinoIds);

    if (error) {
      console.log('[presenca][count] erro:', error);
      setPresCount({});
      return;
    }

    const map: Record<string, { presente: number; faltou: number; justificou: number }> = {};
    (data ?? []).forEach((row: any) => {
      const id = row.treino_id as string;
      const st = row.status as 'presente' | 'faltou' | 'justificou';
      if (!map[id]) map[id] = { presente: 0, faltou: 0, justificou: 0 };
      map[id][st] = (map[id][st] ?? 0) + 1;
    });

    setPresCount(map);
  }

  function isValidYYYYMM(s: string) {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
  }

  function monthRangeISO(yyyyMm: string) {
    if (!isValidYYYYMM(yyyyMm)) return null;
    // Usa 01 do mês como início e o "add 1 mês" como fim (half-open interval)
    const start = new Date(`${yyyyMm}-01T00:00:00`);
    if (isNaN(start.getTime())) return null;
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    return { startISO: start.toISOString(), endISO: end.toISOString() };
  }

  function buildRange() {
    if (dataInicio && !dataFim) {
      // só início → aquele dia/mes/ano isolado
      const y = dataInicio.getFullYear();
      const m = dataInicio.getMonth();
      const d = dataInicio.getDate();

      // se o usuário só selecionar o ano (via UI)
      if (dataInicio.getDate() === 1 && dataInicio.getMonth() === 0 && !dataFim) {
        const start = new Date(y, 0, 1);
        const end = new Date(y + 1, 0, 1);
        return { startISO: start.toISOString(), endISO: end.toISOString() };
      }

      // se selecionou mês (ex: “nov 2025”)
      if (dataInicio.getDate() === 1 && !dataFim) {
        const start = new Date(y, m, 1);
        const end = new Date(y, m + 1, 1);
        return { startISO: start.toISOString(), endISO: end.toISOString() };
      }

      // se selecionou um dia completo
      const start = new Date(y, m, d, 0, 0, 0);
      const end = new Date(y, m, d + 1, 0, 0, 0);
      return { startISO: start.toISOString(), endISO: end.toISOString() };
    }

    if (dataInicio && dataFim) {
      // intervalo entre as duas datas
      const start = new Date(dataInicio);
      const end = new Date(dataFim);
      end.setDate(end.getDate() + 1); // inclui o dia final
      return { startISO: start.toISOString(), endISO: end.toISOString() };
    }

    // nenhum filtro
    return null;
  }

  // Aceita "", "YYYY", "YYYY-MM", "YYYY-MM-DD"
  function sanitizeYmdInput(s: string) {
    let v = s.replace(/[^\d-]/g, '');
    if (v.length > 10) v = v.slice(0, 10);
    // força hífen após ano
    if (v.length === 5 && v[4] !== '-') v = v.slice(0, 4) + '-' + v.slice(4);
    // força segundo hífen após mês
    if (v.length === 8 && v[7] !== '-') v = v.slice(0, 7) + '-' + v.slice(7);
    return v;
  }

  function detectGranularity(s: string): 'year'|'month'|'day'|null {
    if (/^\d{4}$/.test(s)) return 'year';
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) return 'month';
    if (/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s)) return 'day';
    return null;
  }

  function rangeFromYmd(s: string) {
    const g = detectGranularity(s);
    if (!g) return null;
    if (g === 'year') {
      const y = Number(s.slice(0,4));
      const start = new Date(y,0,1,0,0,0);
      const end   = new Date(y+1,0,1,0,0,0);
      return { startISO: start.toISOString(), endISO: end.toISOString() };
    }
    if (g === 'month') {
      const [y,m] = s.split('-').map(Number);
      const start = new Date(y, m-1, 1, 0,0,0);
      const end   = new Date(y, m,   1, 0,0,0);
      return { startISO: start.toISOString(), endISO: end.toISOString() };
    }
    // day
    const [y,m,d] = s.split('-').map(Number);
    const start = new Date(y, m-1, d, 0,0,0);
    const end   = new Date(y, m-1, d+1, 0,0,0); // intervalo half-open => inclui o dia
    return { startISO: start.toISOString(), endISO: end.toISOString() };
  }

  // Constrói range final a partir de início/fim (strings)
  // Regra: se só início -> usa seu próprio range; se início + fim -> usa inicio.start .. fim.end
  function buildRangeFromInputs(inicio: string, fim: string) {
    const ri = inicio ? rangeFromYmd(inicio) : null;
    const rf = fim    ? rangeFromYmd(fim)    : null;

    if (ri && !rf) return ri;            // só início
    if (!ri && !rf) return null;         // nenhum -> todos
    if (!ri && rf)  return rf;           // só fim (tratamos como o período do fim)

    // ambos válidos: start = do início, end = do fim
    const startISO = ri!.startISO;
    const endISO   = rf!.endISO;
    return { startISO, endISO };
  }

  const loadTreinos = useCallback(async () => {
    setLoading(true);
    try {
      const range = buildRangeFromInputs(inicioStr, fimStr);

      let query = supabase
        .from('treinos')
        .select('*')
        .order('data_hora', { ascending: true });

      if (range) {
        query = query.gte('data_hora', range.startISO).lt('data_hora', range.endISO);
      }

      const { data, error } = await query;
      if (error) throw error;

      setTreinos((data ?? []) as Treino[]);
      const ids = (data ?? []).map((t: any) => t.id);
      await loadPresencasCountFor(ids); // você já tem essa função
    } catch (e: any) {
      console.log('[loadTreinos] erro:', e?.message ?? e);
      Alert.alert('Erro', e?.message ?? 'Falha ao carregar treinos.');
      setTreinos([]);
      setPresCount({});
    } finally {
      setLoading(false);
    }
  }, [inicioStr, fimStr]);

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
    // 1) remove tudo do treino (mantém unicidade limpa)
    const { error: deleteError } = await supabase
      .from('presenca')
      .delete()
      .eq('treino_id', treinoId);

    if (deleteError) {
      throw new Error(`Erro ao apagar presenças antigas: ${deleteError.message}`);
    }

    // 2) quem está marcado => presente
    const selecionados = Object.keys(sel).filter((id) => sel[id]);

    // 3) quem é ativo mas NÃO está marcado => falta
    const ativosTodos = jogadores.map(j => j.id);
    const naoSelecionados = ativosTodos.filter((id) => !sel[id]);

    const rows = [
      ...selecionados.map((jid) => ({
        treino_id: treinoId,
        jogador_id: jid,
        status: 'presente' as const,
      })),
      ...naoSelecionados.map((jid) => ({
        treino_id: treinoId,
        jogador_id: jid,
        status: 'faltou' as const,
      })),
    ];

    if (rows.length === 0) return;

    const { error: insertError } = await supabase.from('presenca').insert(rows);
    if (insertError) {
      throw new Error(`Erro ao inserir presenças/faltas: ${insertError.message}`);
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
  
  const [showInicio, setShowInicio] = useState(false);
  const [showFim, setShowFim] = useState(false);

  function renderItem({ item }: { item: Treino }) {
    const dt = new Date(item.data_hora);
    const resumo = presCount[item.id] ?? { presente: 0, faltou: 0, justificou: 0 };

    return (
      <View style={styles.card}>
        <Text style={styles.title}>{dt.toLocaleString()}</Text>
        {!!item.local && <Text style={styles.line}>Local: {item.local}</Text>}
        {!!item.descricao && <Text style={styles.line}>{item.descricao}</Text>}
        <Text style={[styles.line, { fontWeight: '600' }]}>
          Presenças: {resumo.presente}
        </Text>
        <Text style={styles.line}>Faltas: {resumo.faltou}</Text>
        {resumo.justificou ? <Text style={styles.line}>Justificadas: {resumo.justificou}</Text> : null}
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

      <View style={{ marginBottom: 12 }}>
        <Text style={{ color: '#E0E0E0', marginBottom: 6 }}>Filtrar treinos por data</Text>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Início: AAAA | AAAA-MM | AAAA-MM-DD"
            placeholderTextColor="#A0A0A0"
            value={inicioStr}
            onChangeText={(t) => setInicioStr(sanitizeYmdInput(t))}
            inputMode="numeric"
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Fim (opcional): AAAA | AAAA-MM | AAAA-MM-DD"
            placeholderTextColor="#A0A0A0"
            value={fimStr}
            onChangeText={(t) => setFimStr(sanitizeYmdInput(t))}
            inputMode="numeric"
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
          <TouchableOpacity
            style={styles.btnNeutral}
            onPress={() => {
              const d = new Date();
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, '0');
              setInicioStr(`${y}-${m}`);  // este mês
              setFimStr('');
            }}
          >
            <Text style={styles.btnText}>Este mês</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnNeutral}
            onPress={() => {
              const y = new Date().getFullYear();
              setInicioStr(String(y));    // este ano
              setFimStr('');
            }}
          >
            <Text style={styles.btnText}>Este ano</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnNeutral}
            onPress={() => { setInicioStr(''); setFimStr(''); }}
          >
            <Text style={styles.btnText}>Todos</Text>
          </TouchableOpacity>
        </View>

        {/* (opcional) feedback de granularidade */}
        <Text style={{ color: '#B0B0B0', fontSize: 12, marginTop: 6 }}>
          Dicas: use "2025" para o ano, "2025-11" para o mês, ou "2025-11-03" para o dia. Preencha os dois para intervalo.
        </Text>
      </View>

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
