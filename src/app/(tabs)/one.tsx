import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, SafeAreaView, StyleSheet, Text, View, FlatList, ActivityIndicator,
  TouchableOpacity, TextInput, Modal, ScrollView, Switch, Platform,
  Dimensions, TouchableWithoutFeedback, useWindowDimensions
} from 'react-native';
import { Document as DocxDocument, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } from 'docx'
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import DateTimePicker from '@react-native-community/datetimepicker';
import { TextInputMask } from "react-native-masked-text";

const AppSafeArea = Platform.OS === 'web' ? View : SafeAreaView;


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

function roundNowTo15min(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() - (d.getMinutes() % 15), 0, 0);
  return d;
}

function formatLocalForInputWeb(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

function brToYmd(br: string) {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return '';
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function ymdToBr(ymd: string) {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const [, yyyy, mm, dd] = m;
  return `${dd}/${mm}/${yyyy}`;
}

function isValidYmd(ymd: string) {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const d = new Date(ymd + "T00:00:00");
  if (isNaN(d.getTime())) return false;

  const [y, mo, da] = ymd.split('-').map(Number);
  return d.getFullYear() === y && (d.getMonth()+1) === mo && d.getDate() === da;
}

// HH:MM válido
function isValidHm(hm: string) {
  const m = hm.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return !!m;
}

function dateToYmd(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function dateToHm(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// --- helper: busca linhas do detalhe (nome, categoria, status) ---
async function getDetalheTreinoRows(treinoId: string) {
  const { data: pres, error: e1 } = await supabase
    .from('presenca')
    .select('jogador_id, status')
    .eq('treino_id', treinoId);

  if (e1) throw e1;

  const ids = Array.from(new Set((pres ?? []).map(p => p.jogador_id))).filter(Boolean);
  let nomes: Record<string, { nome: string; categoria: number | null }> = {};
  if (ids.length) {
    const { data: jogs, error: e2 } = await supabase
      .from('jogadores')
      .select('id, nome, categoria')
      .in('id', ids);
    if (e2) throw e2;
    (jogs ?? []).forEach(j => {
      nomes[j.id] = { nome: j.nome, categoria: j.categoria ?? null };
    });
  }

  const rows = (pres ?? [])
    .map(p => ({
      nome: nomes[p.jogador_id]?.nome ?? '',
      categoria: nomes[p.jogador_id]?.categoria ?? '',
      status: p.status ?? '',
      jogador_id: p.jogador_id ?? '',
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  return rows;
}

function FiltersModal({ visible, onClose, children }: any) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Backdrop clicável */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.filtersOverlay}>
          {/* Conteúdo centralizado */}
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.filtersPanel}>
              {children}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// --- DOCX do detalhe ---
async function exportDetalheTreinoDocx(treino: Treino) {
  const rows = await getDetalheTreinoRows(treino.id);
  const presentes = rows.filter(r => r.status === 'presente');
  const faltas    = rows.filter(r => r.status === 'faltou');
  const justific  = rows.filter(r => r.status === 'justificou');

  const children: any[] = [
    new Paragraph({ text: 'Detalhe do treino', heading: HeadingLevel.HEADING_1 }),
    kv('Data', new Date(treino.data_hora).toLocaleString()),
    kv('Local', treino.local ?? ''),
    kv('Descrição', treino.descricao ?? ''),
    kv('Presenças', String(presentes.length)),
    kv('Faltas', String(faltas.length)),
    ...(justific.length ? [kv('Justificadas', String(justific.length))] : []),
    hr(),
    new Paragraph({ text: 'Presentes', heading: HeadingLevel.HEADING_2 }),
    ...(presentes.length ? presentes.map(p =>
      new Paragraph(`• ${p.nome}${p.categoria ? ` (${p.categoria})` : ''}`)
    ) : [new Paragraph('—')]),
    hr(),
    new Paragraph({ text: 'Faltas', heading: HeadingLevel.HEADING_2 }),
    ...(faltas.length ? faltas.map(p =>
      new Paragraph(`• ${p.nome}${p.categoria ? ` (${p.categoria})` : ''}`)
    ) : [new Paragraph('—')]),
    ...(justific.length ? [
      hr(),
      new Paragraph({ text: 'Justificadas', heading: HeadingLevel.HEADING_2 }),
      ...justific.map(p => new Paragraph(`• ${p.nome}${p.categoria ? ` (${p.categoria})` : ''}`)),
    ] : []),
  ];

  const doc = new DocxDocument({ sections: [{ children }] });
  const filename = `treino_${treino.id}_detalhe.docx`;

  if (Platform.OS === 'web') {
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  } else {
    const base64 = await Packer.toBase64String(doc);
    const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory!;
    const path = dir + filename;
    await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
    await Sharing.shareAsync(path, {
      mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      dialogTitle:'Exportar DOCX',
      UTI:'org.openxmlformats.wordprocessingml.document',
    });
  }
}

function hr() {
  return new Paragraph({
    border: { top: { color: 'CCCCCC', size: 6, space: 4, style: BorderStyle.SINGLE } },
    spacing: { before: 160, after: 160 },
  });
}
function kv(label: string, value: string) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun({ text: value }),
    ],
  });
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

  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isNarrowWeb = isWeb && width < 720; // breakpoint pro web mobile
  const isVeryNarrowWeb = isWeb && width < 480;

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

  const COLOR_OK = '#2ecc71';
  const COLOR_WARN = '#f1c40f';
  const COLOR_ERR = '#e74c3c';

  const [treinos, setTreinos] = useState<Treino[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);
  const [treinoToDelete, setTreinoToDelete] = useState<Treino | null>(null);
  
  const [modal, setModal] = useState(false);
  const [editTreino, setEditTreino] = useState<Treino | null>(null);
  
  const [dataHora, setDataHora] = useState<Date>(roundNowTo15min());
  const [local, setLocal] = useState('');
  const [descricao, setDescricao] = useState('');
  const [saving, setSaving] = useState(false);

  const [dataHoraBr, setDataHoraBr] = useState<string>(ymdToBr(dateToYmd(dataHora)));
  const [horaBr, setHoraBr] = useState<string>(dateToHm(dataHora));
  
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [statusMap, setStatusMap] = useState<Record<string, 'presente'|'faltou'|'justificou'|undefined>>({});
  
  const [yearFrom, setYearFrom] = useState<string>('');
  const [yearTo, setYearTo] = useState<string>('');
  const [searchJog, setSearchJog] = useState('');

  // depois dos outros useState do modal:
  const [readOnly, setReadOnly] = useState(false);

  const [buscaTreino, setBuscaTreino] = useState<string>(''); // barra de pesquisa

  const [filtersOpen, setFiltersOpen] = useState(false);

  // filtros por string (web-friendly)
  const [inicioStr, setInicioStr] = useState<string>('');   // "", "2025", "2025-11", "2025-11-03"
  const [fimStr, setFimStr] = useState<string>('');         // idem

  // estados "rascunho" usados pelos inputs de data
  const [inicioDraft, setInicioDraft] = useState<string>('');
  const [fimDraft, setFimDraft] = useState<string>('');

  useEffect(() => {
    setInicioDraft(inicioStr);
  }, [inicioStr]);

  useEffect(() => {
    setFimDraft(fimStr);
  }, [fimStr]);

  function handleChangeInicioDraft(v: string) {
    setInicioDraft(v);
    if (Platform.OS !== 'web') {
      // no mobile, aplica imediatamente
      setInicioStr(v);
    }
  }

  function handleChangeFimDraft(v: string) {
    setFimDraft(v);
    if (Platform.OS !== 'web') {
      // no mobile, aplica imediatamente
      setFimStr(v);
    }
  }

  function aplicarFiltroDatas() {
    setInicioStr(inicioDraft);
    setFimStr(fimDraft);
  }

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

  // dados de resumo que já usamos no CSV, reaproveitados no PDF/DOCX
  function getResumoRows() {
    return treinosFiltrados.map(t => {
      const r = presCount[t.id] ?? { presente: 0, faltou: 0, justificou: 0 };
      return {
        data: new Date(t.data_hora).toLocaleString(),
        presentes: r.presente,
        faltas: r.faltou,
        justificadas: r.justificou,
        local: t.local ?? '',
        descricao: t.descricao ?? '',
        id: t.id,
      };
    });
  }

  function csvEscape(v: any) {
    const s = v === null || v === undefined ? '' : String(v);
    const needsQuote = /[";\n,\r]/.test(s);
    if (!needsQuote) return s;
    return `"${s.replace(/"/g, '""')}"`;
  }

  function toCsv(
    rows: any[],
    headers: { key: string; label: string; map?: (row: any) => any }[],
    delimiter = ';'
  ) {
    const head = headers.map(h => csvEscape(h.label)).join(delimiter);
    const body = rows
      .map(row => headers.map(h => csvEscape(h.map ? h.map(row) : row[h.key])).join(delimiter))
      .join('\n');
    return head + '\n' + body + '\n';
  }

  async function downloadCsv(filename: string, csv: string) {
    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
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

  function escapeHtml(s = '') {
    return s.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m] as string));
  }

  function rangeLabelFromInputs(inicio: string, fim: string) {
    const label = (s: string) => s || 'todos';
    // se você já tem inicioStr/fimStr dos inputs de data:
    if (typeof inicioStr === 'string' && typeof fimStr === 'string') {
      if (inicioStr && fimStr) return `${inicioStr}_a_${fimStr}`;
      if (inicioStr) return inicioStr;
      if (fimStr) return fimStr;
    }
    return 'filtro_atual';
  }

  async function exportResumoDocx() {
    const label = typeof inicioStr === 'string' ? rangeLabelFromInputs(inicioStr, fimStr) : 'filtro_atual';

    const children: any[] = [
      new Paragraph({ text: `Treinos — Resumo (${label})`, heading: HeadingLevel.HEADING_1 }),
    ];

    treinosFiltrados.forEach((t, i) => {
      const r = presCount[t.id] ?? { presente: 0, faltou: 0, justificou: 0 };
      if (i > 0) children.push(hr());
      children.push(
        new Paragraph({ text: new Date(t.data_hora).toLocaleString(), heading: HeadingLevel.HEADING_2 }),
        kv('Local', t.local ?? ''),
        kv('Descrição', t.descricao ?? ''),
        kv('Presenças', String(r.presente)),
        kv('Faltas', String(r.faltou)),
        ...(r.justificou ? [kv('Justificadas', String(r.justificou))] : [])
      );
    });

    const doc = new DocxDocument({ sections: [{ children }] });
    const filename = `treinos_resumo_${label}.docx`;

    if (Platform.OS === 'web') {
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
    } else {
      const base64 = await Packer.toBase64String(doc);
      const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory!;
      const path = dir + filename;
      await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(path, {
        mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        dialogTitle:'Exportar DOCX',
        UTI:'org.openxmlformats.wordprocessingml.document',
      });
    }
  }

  async function exportResumoCsv() {
    const rows = treinosFiltrados.map(t => {
      const r = presCount[t.id] ?? { presente: 0, faltou: 0, justificou: 0 };
      return {
        data: new Date(t.data_hora).toLocaleString(),
        presentes: r.presente,
        faltas: r.faltou,
        justificadas: r.justificou,
        local: t.local ?? '',
        descricao: t.descricao ?? '',
        id: t.id,
      };
    });

    const headers = [
      { key: 'data', label: 'Data/Hora' },
      { key: 'presentes', label: 'Presentes' },
      { key: 'faltas', label: 'Faltas' },
      { key: 'justificadas', label: 'Justificadas' },
      { key: 'local', label: 'Local' },
      { key: 'descricao', label: 'Descrição' },
      { key: 'id', label: 'Treino ID' },
    ];

    const csv = toCsv(rows, headers);
    const label = typeof inicioStr === 'string' ? rangeLabelFromInputs(inicioStr, fimStr) : 'filtro_atual';
    await downloadCsv(`treinos_resumo_${label}.csv`, csv);
  }

  async function exportDetalheTreinoCsv(treinoId: string) {
    const { data: pres, error: e1 } = await supabase
      .from('presenca')
      .select('jogador_id, status')
      .eq('treino_id', treinoId);

    if (e1) {
      Alert.alert('Erro', e1.message);
      return;
    }

    const ids = Array.from(new Set((pres ?? []).map(p => p.jogador_id))).filter(Boolean);
    let nomes: Record<string, { nome: string; categoria: number | null }> = {};

    if (ids.length) {
      const { data: jogs, error: e2 } = await supabase
        .from('jogadores')
        .select('id, nome, categoria')
        .in('id', ids);

      if (e2) {
        Alert.alert('Erro', e2.message);
        return;
      }
      (jogs ?? []).forEach(j => {
        nomes[j.id] = { nome: j.nome, categoria: j.categoria ?? null };
      });
    }

    const rows = (pres ?? [])
      .map(p => ({
        nome: nomes[p.jogador_id]?.nome ?? '',
        categoria: nomes[p.jogador_id]?.categoria ?? '',
        status: p.status ?? '',
        jogador_id: p.jogador_id ?? '',
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));

    const headers = [
      { key: 'nome', label: 'Nome' },
      { key: 'categoria', label: 'Categoria' },
      { key: 'status', label: 'Status' },
      { key: 'jogador_id', label: 'Jogador ID' },
    ];

    const csv = toCsv(rows, headers);
    await downloadCsv(`treino_${treinoId}_detalhe.csv`, csv);
  }

  function ExportMenu({
    onCsv,
    onDocx,
    compact = false,
  }: {
    onCsv: () => void;
    onDocx: () => void;
    compact?: boolean;
  }) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
    const btnRef = React.useRef<View>(null);

    function openMenu() {
      // mede posição do botão na tela e abre o modal
      btnRef.current?.measureInWindow?.((x, y, w, h) => {
        setPos({ x, y, w, h });
        setOpen(true);
      });
    }

    const MENU_WIDTH = 180;

    // fallback: ancora no canto direito se a medida falhar
    const top = pos ? pos.y + (compact ? pos.h : pos.h) + 4 : 60;
    const left = pos ? Math.max(8, pos.x + pos.w - MENU_WIDTH) : undefined;
    const right = pos ? undefined : 8; // fallback

    return (
      <>
        <View ref={btnRef} collapsable={false}>
          <TouchableOpacity style={styles.btnNeutral} onPress={openMenu}>
            <Feather name="download" size={16} color="#fff" />
            <Text style={styles.btnText}>  Exportar ▾</Text>
          </TouchableOpacity>
        </View>

        <Modal
          visible={open}
          transparent
          animationType="fade"
          onRequestClose={() => setOpen(false)}
        >
          {/* overlay para fechar */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setOpen(false)}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
            }}
          >
            {/* o menu em si (não usar zIndex aqui; Modal já está no topo) */}
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                top,
                left,
                right,
              }}
            >
              <View
                style={{
                  width: MENU_WIDTH,
                  alignSelf: left !== undefined ? 'flex-start' : 'flex-end',
                  backgroundColor: '#1E2F47',
                  borderWidth: 1,
                  borderColor: '#3A506B',
                  borderRadius: 10,
                  paddingVertical: 6,
                  elevation: 24,
                  shadowColor: '#000',
                  shadowOpacity: 0.25,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                }}
              >
                <TouchableOpacity style={{ padding: 10 }} onPress={() => { setOpen(false); onCsv(); }}>
                  <Text style={{ color: '#fff' }}>CSV</Text>
                </TouchableOpacity>
                <View style={{ height: 1, backgroundColor: '#3A506B' }} />
                <TouchableOpacity style={{ padding: 10 }} onPress={() => { setOpen(false); onDocx(); }}>
                  <Text style={{ color: '#fff' }}>DOCX</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      </>
    );
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

  // function detectGranularity(s: string): 'year'|'month'|'day'|null {
  //   if (/^\d{4}$/.test(s)) return 'year';
  //   if (/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) return 'month';
  //   if (/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s)) return 'day';
  //   return null;
  // }

  function rangeFromYmd(s: string) {
    const g = detectGranularity(s);
    if (!g) return null;

    if (g === 'year') {
      const y = Number(s.slice(0, 4));
      const start = new Date(y, 0, 1, 0, 0, 0);
      const end   = new Date(y + 1, 0, 1, 0, 0, 0);
      return { startISO: start.toISOString(), endISO: end.toISOString() };
    }

    if (g === 'month') {
      const [y, m] = s.split('-').map(Number);
      const start = new Date(y, m - 1, 1, 0, 0, 0);
      const end   = new Date(y, m,     1, 0, 0, 0);
      return { startISO: start.toISOString(), endISO: end.toISOString() };
    }

    // day
    const [y, m, d] = s.split('-').map(Number);
    const start = new Date(y, m - 1, d, 0, 0, 0);
    const end   = new Date(y, m - 1, d + 1, 0, 0, 0); // half-open => inclui o dia
    return { startISO: start.toISOString(), endISO: end.toISOString() };
  }

  // Constrói range final a partir de início/fim (strings)
  // - só início  -> de início em diante (sem fim)
  // - só fim     -> até o fim do período de fim (sem início)
  // - início+fim -> entre os dois
  function buildRangeFromInputs(inicio: string, fim: string) {
    const ri = inicio ? rangeFromYmd(inicio) : null;
    const rf = fim    ? rangeFromYmd(fim)    : null;

    // nenhum filtro
    if (!ri && !rf) return null;

    // só INÍCIO: de início em diante
    if (ri && !rf) {
      return { startISO: ri.startISO, endISO: null as string | null };
    }

    // só FIM: tudo até o fim do período
    if (!ri && rf) {
      return { startISO: null as string | null, endISO: rf.endISO };
    }

    // INÍCIO + FIM: intervalo entre eles
    return { startISO: ri!.startISO, endISO: rf!.endISO };
  }

  const loadTreinos = useCallback(async () => {
    setLoading(true);
    try {
      const range = buildRangeFromInputs(inicioStr, fimStr);

      let query = supabase
        .from('treinos')
        .select('*')
        .order('data_hora', { ascending: false });

      if (range?.startISO) {
        query = query.gte('data_hora', range.startISO);
      }
      if (range?.endISO) {
        query = query.lt('data_hora', range.endISO);
      }

      const { data, error } = await query;
      if (error) throw error;

      setTreinos((data ?? []) as Treino[]);
      const ids = (data ?? []).map((t: any) => t.id);
      await loadPresencasCountFor(ids);
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

  // Carrega do banco e liga o switch APENAS para quem está "presente"
  async function loadExistingPresences(treinoId: string) {
    const { data, error } = await supabase
      .from('presenca')
      .select('jogador_id, status')
      .eq('treino_id', treinoId);

    if (error) {
      console.error('Erro ao buscar presenças:', error);
      setSel({});
      setStatusMap({});
      return;
    }

    const selMap: Record<string, boolean> = {};
    const stMap: Record<string, 'presente'|'faltou'|'justificou'> = {};

    (data ?? []).forEach((row) => {
      stMap[row.jogador_id] = row.status;                 // para relatório
      selMap[row.jogador_id] = row.status === 'presente'; // para switches
    });

    setSel(selMap);
    setStatusMap(stMap);
  }

  function openCreate() {
    setReadOnly(false);
    setEditTreino(null);
    setLocal('');
    setDescricao('');
    setSel({});
    setStatusMap({});
    setDataHora(roundNowTo15min()); // ✅ agora é Date 
    const d = roundNowTo15min();
    setDataHoraBr(ymdToBr(dateToYmd(d)));
    setHoraBr(dateToHm(d));
    setModal(true);
    loadJogadoresAtivos();
  }

  // --- CORREÇÃO: Chama a busca de presenças ao editar ---
  async function openEdit(t: Treino) {
    setReadOnly(false);              
    setEditTreino(t);
    const d = new Date(t.data_hora);
    setDataHora(d);
    setDataHoraBr(ymdToBr(dateToYmd(d)));
    setHoraBr(dateToHm(d));
    setLocal(t.local ?? '');
    setDescricao(t.descricao ?? '');
    setSel({}); // limpa antes de recarregar
    setStatusMap({});
    await loadJogadoresAtivos();
    await loadExistingPresences(t.id);
    setModal(true); // abre depois que os dados chegaram
  }

  async function openView(t: Treino) {
    setReadOnly(true);                    // <- leitura
    setEditTreino(t);
    const d = new Date(t.data_hora);
    setDataHora(d);
    setDataHoraBr(ymdToBr(dateToYmd(d)));
    setHoraBr(dateToHm(d));
    setLocal(t.local ?? '');
    setDescricao(t.descricao ?? '');
    setSel({});
    setStatusMap({});
    await loadJogadoresAtivos();
    await loadExistingPresences(t.id);
    setModal(true);
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

  function pad2(n: number | string) {
    return String(n).padStart(2, '0');
  }

  // Decide o modo inicial a partir do valor atual
  function detectGranularity(s: string): 'year'|'month'|'day' {
    if (/^\d{4}$/.test(s)) return 'year';
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) return 'month';
    if (/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s)) return 'day';
    return 'year';
  }

  const [showPicker, setShowPicker] = React.useState(false);

  type GranularDateInputProps = {
    label: string;
    value: string;                 // "", "YYYY", "YYYY-MM" ou "YYYY-MM-DD"
    onChange: (v: string) => void; // devolve nesse formato
  };

  function GranularDateInput({ label, value, onChange }: GranularDateInputProps) {
    const [mode, setMode] = React.useState<'year' | 'month' | 'day'>(detectGranularity(value));
    const [local, setLocal] = React.useState(value);

    // drafts auxiliares só pro modo month (mobile)
    const [draftYear, setDraftYear] = React.useState('');
    const [draftMonth, setDraftMonth] = React.useState('');

    React.useEffect(() => {
      setLocal(value);
      if (detectGranularity(value) === 'month') {
        setDraftYear(value.slice(0,4) || '');
        setDraftMonth(value.slice(5,7) || '');
      }
      if (detectGranularity(value) === 'year') {
        setDraftYear(value.slice(0,4) || '');
        setDraftMonth('');
      }
      if (detectGranularity(value) === 'day') {
        setDraftYear(value.slice(0,4) || '');
        setDraftMonth(value.slice(5,7) || '');
      }
    }, [value]);

    function commit(v: string) {
      if (!v) return onChange('');
      const isYear  = /^\d{4}$/.test(v);
      const isMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
      const isDay   = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v);

      if (
        (mode === 'year'  && isYear) ||
        (mode === 'month' && isMonth) ||
        (mode === 'day'   && isDay)
      ) onChange(v);
      else onChange('');
    }

    function switchMode(next: 'year' | 'month' | 'day') {
      setMode(next);
      // não aplica nada automaticamente; só muda UI
    }

    return (
      <View style={{ marginBottom: 10 }}>
        <Text style={{ color: '#E0E0E0', marginBottom: 6 }}>{label}</Text>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          {(['year','month','day'] as const).map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => switchMode(t)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 8,
                backgroundColor: mode === t ? '#18641c' : '#4A6572',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>
                {t === 'year' ? 'Ano' : t === 'month' ? 'Mês/Ano' : 'Dia'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ANO */}
        {mode === 'year' && (
          <TextInput
            style={styles.input}
            placeholder="AAAA"
            placeholderTextColor="#A0A0A0"
            keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'}
            value={local.slice(0, 4)}
            onChangeText={(txt) => {
              const only = txt.replace(/\D/g, '').slice(0, 4);
              setLocal(only);
              if (only.length === 4) commit(only);
            }}
            onBlur={() => {
              const y = local.replace(/\D/g, '').slice(0, 4);
              if (y.length === 4) commit(y);
              else commit('');
            }}
            maxLength={4}
          />
        )}

        {/* MÊS/ANO */}
        {mode === 'month' && (
          <>
            {Platform.OS === 'web' ? (
              <input
                type="month"
                value={local.length >= 7 ? local.slice(0, 7) : ''}
                onChange={(e) => {
                  const v = e.currentTarget.value; // YYYY-MM
                  setLocal(v);
                  commit(v);
                }}
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
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="MM"
                  placeholderTextColor="#A0A0A0"
                  keyboardType="numeric"
                  value={draftMonth}
                  onChangeText={(txt) => {
                    const only = txt.replace(/\D/g, '').slice(0, 2);
                    let mm = only;
                    if (mm.length === 1) mm = mm; // deixa digitar
                    if (mm.length === 2) {
                      const n = Number(mm);
                      if (n < 1 || n > 12) mm = '';
                    }
                    setDraftMonth(mm);

                    // se já tiver ano completo e mês completo, aplica
                    if (draftYear.length === 4 && mm.length === 2) {
                      const v = `${draftYear}-${mm}`;
                      setLocal(v);
                      commit(v);
                    } else {
                      setLocal(draftYear); // rascunho
                    }
                  }}
                  onBlur={() => {
                    if (draftYear.length === 4 && draftMonth.length === 2) {
                      commit(`${draftYear}-${draftMonth}`);
                    } else commit('');
                  }}
                  maxLength={2}
                />
                <TextInput
                  style={[styles.input, { flex: 2 }]}
                  placeholder="AAAA"
                  placeholderTextColor="#A0A0A0"
                  keyboardType="numeric"
                  value={draftYear}
                  onChangeText={(txt) => {
                    const only = txt.replace(/\D/g, '').slice(0, 4);
                    setDraftYear(only);

                    if (only.length === 4 && draftMonth.length === 2) {
                      const v = `${only}-${draftMonth}`;
                      setLocal(v);
                      commit(v);
                    } else {
                      setLocal(only);
                    }
                  }}
                  onBlur={() => {
                    if (draftYear.length === 4 && draftMonth.length === 2) {
                      commit(`${draftYear}-${draftMonth}`);
                    } else commit('');
                  }}
                  maxLength={4}
                />
              </View>
            )}
          </>
        )}

        {/* DIA */}
        {mode === 'day' && (
          <>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={local.length === 10 ? local : ''}
                onChange={(e) => setLocal(e.currentTarget.value)}
                onBlur={(e) => commit(e.currentTarget.value || '')}
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
              <TextInputMask
                type={'datetime'}
                options={{ format: 'DD/MM/YYYY' }}
                value={local ? ymdToBr(local) : ''}
                onChangeText={(txt) => {
                  const t = txt ?? '';
                  if (!t) { setLocal(''); commit(''); return; }
                  if (t.length === 10) {
                    const ymd = brToYmd(t);
                    if (isValidYmd(ymd)) { setLocal(ymd); commit(ymd); }
                    else { setLocal(''); commit(''); }
                  }
                }}
                placeholder="DD/MM/AAAA"
                placeholderTextColor="#A0A0A0"
                keyboardType="number-pad"
                style={styles.input}
              />
            )}
          </>
        )}
      </View>
    );
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

  const treinosFiltrados = useMemo(() => {
    const q = buscaTreino.trim().toLowerCase();
    if (!q) return treinos;

    return treinos.filter(t => {
      const blob = [
        t.local ?? '',
        t.descricao ?? '',
        new Date(t.data_hora).toLocaleString(), // permite buscar por data “12/11/2025”
      ].join(' ').toLowerCase();
      return blob.includes(q);
    });
  }, [treinos, buscaTreino]);

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
    if (!(dataHora instanceof Date) || isNaN(dataHora.getTime())) {
      Alert.alert('Atenção', 'Escolha uma data e hora válidas.');
      return;
    }

    const ts = dataHora.toISOString(); // ✅ use timestamptz no Postgres

    setSaving(true);
    try {
      if (editTreino) {
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
        if (!updatedTreino) throw new Error("Não foi possível encontrar o treino para atualizar.");

        await updatePresencas(updatedTreino.id);

        setModal(false);
        await loadTreinos();
        Alert.alert('Sucesso', 'Treino atualizado.');
      } else {
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

    // ===== WEB DESKTOP =====
    if (isWeb && !isNarrowWeb) {
      return (
        <View style={styles.webRow}>
          {/* infos */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.webRowTitle} numberOfLines={1}>
              {dt.toLocaleString()}
            </Text>

            <Text style={styles.webRowSub} numberOfLines={1}>
              {item.local ? `Local: ${item.local} • ` : ''}
              Pres.: {resumo.presente} • Faltas: {resumo.faltou}
              {resumo.justificou ? ` • Just.: ${resumo.justificou}` : ''}
            </Text>

            {!!item.descricao && (
              <Text style={styles.webRowSub} numberOfLines={1}>
                {item.descricao}
              </Text>
            )}
          </View>

          {/* ações */}
          <View style={styles.webRowActions}>
            <TouchableOpacity style={styles.btnNeutralSmall} onPress={() => openView(item)}>
              <Text style={styles.btnText}>Ver</Text>
            </TouchableOpacity>

            {(isAdmin || isCoach) && (
              <>
                <TouchableOpacity style={styles.btnPrimarySmall} onPress={() => openEdit(item)}>
                  <Text style={styles.btnText}>Editar</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.btnDangerSmall} onPress={() => openDeleteConfirm(item)}>
                  <Text style={styles.btnText}>Excluir</Text>
                </TouchableOpacity>

                <ExportMenu
                  compact
                  onCsv={() => exportDetalheTreinoCsv(item.id)}
                  onDocx={() => exportDetalheTreinoDocx(item)}
                />
              </>
            )}
          </View>
        </View>
      );
    }

    // ===== WEB MOBILE (layout tipo app) =====
    if (isWeb && isNarrowWeb) {
      return (
        <View style={styles.webMobileCard}>
          <View style={styles.mobileInfoRow}>
            <Text style={styles.mobileTitle} numberOfLines={1}>
              {dt.toLocaleString()}
            </Text>

            <Text style={styles.mobileSub} numberOfLines={2}>
              {item.local ? `Local: ${item.local} • ` : ''}
              Pres.: {resumo.presente} • Faltas: {resumo.faltou}
              {resumo.justificou ? ` • Just.: ${resumo.justificou}` : ''}
            </Text>

            {!!item.descricao && (
              <Text style={styles.mobileSub} numberOfLines={2}>
                {item.descricao}
              </Text>
            )}
          </View>

          <View style={styles.webMobileActionsRow}>
            <TouchableOpacity style={styles.btnNeutralSmall} onPress={() => openView(item)}>
              <Text style={styles.btnText}>Ver</Text>
            </TouchableOpacity>

            {(isAdmin || isCoach) && (
              <>
                <TouchableOpacity style={styles.btnPrimarySmall} onPress={() => openEdit(item)}>
                  <Text style={styles.btnText}>Editar</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.btnDangerSmall} onPress={() => openDeleteConfirm(item)}>
                  <Text style={styles.btnText}>Excluir</Text>
                </TouchableOpacity>

                <ExportMenu
                  compact
                  onCsv={() => exportDetalheTreinoCsv(item.id)}
                  onDocx={() => exportDetalheTreinoDocx(item)}
                />
              </>
            )}
          </View>
        </View>
      );
    }

    // ===== MOBILE APP =====
    return (
      <View style={styles.mobileCard}>
        <View style={styles.mobileInfoRow}>
          <Text style={styles.mobileTitle} numberOfLines={1}>
            {dt.toLocaleString()}
          </Text>
          <Text style={styles.mobileSub} numberOfLines={1}>
            {item.local ? `Local: ${item.local} • ` : ''}
            Pres.: {resumo.presente} • Faltas: {resumo.faltou}
            {resumo.justificou ? ` • Just.: ${resumo.justificou}` : ''}
          </Text>
          {!!item.descricao && (
            <Text style={styles.mobileSub} numberOfLines={1}>
              {item.descricao}
            </Text>
          )}
        </View>

        <View style={styles.mobileActionsRow}>
          <TouchableOpacity style={styles.btnNeutralSmall} onPress={() => openView(item)}>
            <Text style={styles.btnText}>Ver</Text>
          </TouchableOpacity>
          {(isAdmin || isCoach) && (
            <>
              <TouchableOpacity style={styles.btnPrimarySmall} onPress={() => openEdit(item)}>
                <Text style={styles.btnText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnDangerSmall} onPress={() => openDeleteConfirm(item)}>
                <Text style={styles.btnText}>Excluir</Text>
              </TouchableOpacity>
              <ExportMenu compact onCsv={() => exportDetalheTreinoCsv(item.id)} onDocx={() => exportDetalheTreinoDocx(item)} />
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <AppSafeArea style={styles.container}>
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

      {/* SEARCH + FILTER (igual admin) */}
      <View style={styles.filtersBox}>
        <View style={styles.searchRow}>
          <TextInput
            placeholder="Buscar por local, descrição ou data"
            placeholderTextColor="#A0A0A0"
            style={[styles.input, styles.searchInput]}
            value={buscaTreino}
            onChangeText={setBuscaTreino}
          />

          <TouchableOpacity
            style={[styles.btnNeutral, styles.filterBtnInline]}
            onPress={() => setFiltersOpen(true)}
          >
            <Feather name="filter" size={16} color="#fff" />
            <Text style={styles.btnText}>  Filtrar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* AÇÕES (AGORA AQUI EMBAIXO) */}
      {(isAdmin || isCoach) && (
        <View style={{ flexDirection:'row', justifyContent:'flex-end', gap: 10, marginBottom: 12, flexWrap:'wrap' }}>
          <TouchableOpacity style={styles.btnPrimary} onPress={openCreate}>
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.btnText}>  Novo treino</Text>
          </TouchableOpacity>

          <ExportMenu onCsv={exportResumoCsv} onDocx={exportResumoDocx} />
        </View>
      )}

      {loading ? (
        <ActivityIndicator color="#007BFF" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={treinosFiltrados}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={<Text style={styles.empty}>Nenhum treino.</Text>}
        />
      )}
      
      <Modal visible={modal} animationType="slide" onRequestClose={() => setModal(false)}>
        <AppSafeArea style={{ flex: 1, backgroundColor: '#0A1931' }}>
          {/* Conteúdo com padding e rodapé fora para fixar no fundo */}
          <View style={{ flex: 1, padding: 16 }}>
            <Text style={styles.h1}>
              {readOnly ? 'Detalhes do treino' : (editTreino ? 'Editar treino' : 'Novo treino')}
            </Text>

            {readOnly && (
              <View style={{ alignItems: 'flex-end', marginBottom: 8 }}>
                <ExportMenu
                  onCsv={() => exportDetalheTreinoCsv(editTreino!.id)}
                  onDocx={() => exportDetalheTreinoDocx(editTreino!)}
                />
              </View>
            )}

            {readOnly ? (
              // ==== MODO RELATÓRIO (sem maxHeight) ====
              <View style={{ flex: 1 }}>
                {/* Caixa com infos gerais (altura automática) */}

                <View style={[styles.box, styles.infoBoxLimited]}>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    <InfoRow label="Data" value={dataHora.toLocaleString()} />
                    <InfoRow label="Local" value={local} />
                    <InfoRow label="Descrição" value={descricao} />
                  </ScrollView>
                </View>

                {/* Caixa de alunos ocupa o espaço restante e scrolla */}
                <View style={[styles.box, { flex: 1 }]}>
                  <Text style={{ color:'#fff', fontWeight:'bold', marginBottom: 8 }}>Alunos</Text>

                  <FlatList
                    style={{ flex: 1 }}                 // <- garante que a lista use o espaço restante
                    contentContainerStyle={{ paddingBottom: 4 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    data={jogadoresFiltrados}
                    keyExtractor={(j) => j.id}
                    renderItem={({ item }) => {
                      const st = statusMap[item.id] || 'faltou';
                      const icon = st === 'presente' ? 'check-circle' : (st === 'justificou' ? 'minus-circle' : 'x-circle');
                      const color = st === 'presente' ? '#2ecc71' : (st === 'justificou' ? '#f1c40f' : '#e74c3c');
                      return (
                        <View style={styles.rowSel}>
                          <Text style={{ color:'#fff', flex:1 }}>
                            {item.nome} {item.categoria ? `(${item.categoria})` : ''}
                          </Text>
                          <Feather name={icon as any} size={20} color={color} />
                        </View>
                      );
                    }}
                  />
                </View>
              </View>
            ) : (
              // ==== MODO EDIÇÃO (sem mudanças) ====
              <>
                {Platform.OS === 'web' ? (
                  <input
                    type="datetime-local"
                    value={formatLocalForInputWeb(dataHora)}
                    onChange={(e) => setDataHora(new Date(e.currentTarget.value))}
                    step={900}
                    style={{
                      padding: 10, border: '1px solid #4A6572', backgroundColor: '#203A4A',
                      color: '#FFF', borderRadius: 10, height: 50, marginBottom: 10, width: '100%', boxSizing: 'border-box',
                    }}
                  />
                ) : (
                  <>
                    <Text style={{ color: '#E0E0E0', marginBottom: 6 }}>Data do treino</Text>
                    <TextInputMask
                      type={'datetime'}
                      options={{ format: 'DD/MM/YYYY' }}
                      value={dataHoraBr}
                      onChangeText={(txt) => {
                        const t = txt ?? '';
                        setDataHoraBr(t);

                        if (t.length === 10) {
                          const ymd = brToYmd(t);
                          if (isValidYmd(ymd) && isValidHm(horaBr)) {
                            const composed = new Date(`${ymd}T${horaBr}:00`);
                            if (!isNaN(composed.getTime())) setDataHora(composed);
                          }
                        }
                      }}
                      placeholder="DD/MM/AAAA"
                      placeholderTextColor="#A0A0A0"
                      keyboardType="number-pad"
                      style={styles.input}
                    />

                    <Text style={{ color: '#E0E0E0', marginBottom: 6 }}>Hora do treino</Text>
                    <TextInputMask
                      type={'datetime'}
                      options={{ format: 'HH:mm' }}
                      value={horaBr}
                      onChangeText={(txt) => {
                        const t = txt ?? '';
                        setHoraBr(t);

                        const ymd = brToYmd(dataHoraBr);
                        if (isValidYmd(ymd) && isValidHm(t)) {
                          const composed = new Date(`${ymd}T${t}:00`);
                          if (!isNaN(composed.getTime())) setDataHora(composed);
                        }
                      }}
                      placeholder="HH:MM"
                      placeholderTextColor="#A0A0A0"
                      keyboardType="number-pad"
                      style={styles.input}
                    />

                    <Text style={{ color: '#B0B0B0', marginBottom: 10, fontSize: 12 }}>
                      Ex.: 05/12/2025 e 18:30
                    </Text>
                  </>
                )}

                <TextInput
                  style={styles.input}
                  placeholder="Local (opcional)"
                  placeholderTextColor="#A0A0A0"
                  value={local}
                  onChangeText={setLocal}
                />

                <TextInput
                  style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
                  multiline numberOfLines={4}
                  placeholder="Descrição/atividades"
                  placeholderTextColor="#A0A0A0"
                  value={descricao}
                  onChangeText={setDescricao}
                />

                <View style={[styles.box, { flex: 1 }]}>
                  <Text style={{ color: '#fff', fontWeight: 'bold', marginBottom: 8 }}>
                    Selecionar jogadores (ativos)
                  </Text>

                  {/* Filtro por categoria (ano) */}
                  <View
                    style={{
                      flexDirection: isVeryNarrowWeb ? 'column' : 'row',
                      gap: isVeryNarrowWeb ? 0 : 10,
                      width: '100%',
                    }}
                  >
                    <TextInput
                      style={[
                        styles.input,
                        {
                          flex: isVeryNarrowWeb ? undefined : 1,
                          width: '100%',
                          minWidth: 0, // <-- essencial no web mobile
                        },
                      ]}
                      placeholder="Ano de (ex: 2008)"
                      placeholderTextColor="#A0A0A0"
                      keyboardType="numeric"
                      value={yearFrom}
                      onChangeText={handleYearFrom}
                    />
                    <TextInput
                      style={[
                        styles.input,
                        {
                          flex: isVeryNarrowWeb ? undefined : 1,
                          width: '100%',
                          minWidth: 0, // <-- essencial no web mobile
                        },
                      ]}
                      placeholder="Ano até (ex: 2012)"
                      placeholderTextColor="#A0A0A0"
                      keyboardType="numeric"
                      value={yearTo}
                      onChangeText={handleYearTo}
                    />
                  </View>

                  {/* Busca por nome/ano */}
                  <TextInput
                    style={styles.input}
                    placeholder="Pesquisar nome/ano"
                    placeholderTextColor="#A0A0A0"
                    value={searchJog}
                    onChangeText={setSearchJog}
                  />

                  <FlatList
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: 4 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    data={jogadoresFiltrados}
                    keyExtractor={(j) => j.id}
                    renderItem={({ item }) => (
                      <View style={styles.rowSel}>
                        <Text style={{ color: '#fff', flex: 1 }}>
                          {item.nome} {item.categoria ? `(${item.categoria})` : ''}
                        </Text>
                        <Switch value={!!sel[item.id]} onValueChange={() => toggleSel(item.id)} />
                      </View>
                    )}
                    ListEmptyComponent={<Text style={styles.empty}>Nenhum jogador ativo encontrado.</Text>}
                  />
                </View>
              </>
            )}

            {/* RODAPÉ FIXO */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              {readOnly ? (
                <TouchableOpacity style={[styles.btnNeutral, { flex: 1 }]} onPress={() => setModal(false)}>
                  <Text style={styles.btnText}>Fechar</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity style={[styles.btnPrimary, { flex: 1 }]} onPress={save} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Salvar</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btnNeutral, { flex: 1 }]} onPress={() => setModal(false)}>
                    <Text style={styles.btnText}>Cancelar</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </AppSafeArea >
      </Modal>

      <FiltersModal visible={filtersOpen} onClose={() => setFiltersOpen(false)}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.h1}>Filtros</Text>

          {/* Início em linha separada */}
          <GranularDateInput
            label="Início"
            value={inicioDraft}
            onChange={handleChangeInicioDraft}
          />

          {/* Fim em linha separada */}
          <GranularDateInput
            label="Fim (opcional)"
            value={fimDraft}
            onChange={handleChangeFimDraft}
          />

          {/* Botões rápidos */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, flexWrap:'wrap' }}>
            <TouchableOpacity
              style={styles.btnNeutral}
              onPress={() => {
                const d = new Date();
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                setInicioDraft(`${y}-${m}`);
                setFimDraft('');
              }}
            >
              <Text style={styles.btnText}>Este mês</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnNeutral}
              onPress={() => {
                const y = new Date().getFullYear();
                setInicioDraft(String(y));
                setFimDraft('');
              }}
            >
              <Text style={styles.btnText}>Este ano</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnNeutral}
              onPress={() => {
                setInicioDraft('');
                setFimDraft('');
              }}
            >
              <Text style={styles.btnText}>Todos</Text>
            </TouchableOpacity>
          </View>

          {/* Ações do modal */}
          <View style={{ flexDirection:'row', gap:10, marginTop: 12 }}>
            <TouchableOpacity
              style={[styles.btnPrimary, { flex:1 }]}
              onPress={() => {
                // aplica drafts
                setInicioStr(inicioDraft);
                setFimStr(fimDraft);
                setFiltersOpen(false);
              }}
            >
              <Text style={styles.btnText}>Aplicar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnNeutral, { flex:1 }]}
              onPress={() => {
                // cancela e volta drafts pro que estava aplicado
                setInicioDraft(inicioStr);
                setFimDraft(fimStr);
                setFiltersOpen(false);
              }}
            >
              <Text style={styles.btnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btnDanger, { marginTop: 10 }]}
            onPress={() => {
              setInicioDraft('');
              setFimDraft('');
              setInicioStr('');
              setFimStr('');
              setFiltersOpen(false);
            }}
          >
            <Text style={styles.btnText}>Limpar filtros</Text>
          </TouchableOpacity>
        </ScrollView>
      </FiltersModal>

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
    </AppSafeArea>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1931', paddingHorizontal: 16 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 20, marginBottom: 6, marginHorizontal: 8
  },
  logo: { fontSize: 32, fontWeight: '800', color: '#FFF' },
  h1: { color: '#FFF', fontWeight: '700', fontSize: 22, marginTop: 12, marginBottom: 12, textAlign: 'center' },
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
    flexDirection: 'row', backgroundColor: '#4A6572', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center'
  },
  btnText: { color: '#fff', fontWeight: 'bold' },
  btnApplyFilter: {
    backgroundColor: '#18641c',
    height: 50,
    width: 50,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  infoLabel: {
    color: '#A8BCD0',
    width: 90,
    fontWeight: '600',
  },
  infoValue: {
    color: '#FFF',
    flex: 1,
    flexShrink: 1,     // ✅ permite encolher pra caber na linha
    flexWrap: 'wrap',  // ✅ quebra linha
    width: 0,          // ✅ importante em row com label fixa
    lineHeight: 20,
  },
  filtersBox: {
    backgroundColor:'#1E2F47',
    borderRadius:12,
    padding:12,
    borderWidth:1,
    borderColor:'#3A506B',
    marginBottom:12
  },
  searchRow: {
    flexDirection:'row',
    alignItems:'center',
    gap:10,
  },
  searchInput: {
    flex:1,
    marginBottom:0,
  },
  filterBtnInline: {
    height:50,
    paddingHorizontal:14,
    justifyContent:'center',
  },

  // cards mobile tipo admin
  mobileRow: {
    flexDirection:'row',
    alignItems:'center',
    backgroundColor:'#1E2F47',
    borderRadius:10,
    padding:12,
    marginBottom:10,
    borderWidth:1,
    borderColor:'#3A506B',
  },
  mobileTitle: {
    color:'#FFF',
    fontWeight:'700',
    fontSize:15,
  },
  mobileSub: {
    color:'#B0B0B0',
    marginTop:4,
    fontSize:12,
  },
  mobileActions: {
    flexDirection:'row',
    gap:6,
    marginLeft:10,
    flexWrap:'wrap',
  },
  mobileCard: {
    backgroundColor:'#1E2F47',
    borderRadius:12,
    padding:12,
    marginBottom:12,
    borderWidth:1,
    borderColor:'#3A506B',
  },
  mobileInfoRow: {
    gap: 4,
  },
  mobileActionsRow: {
    flexDirection:'row',
    gap: 8,
    marginTop: 10,
    flexWrap:'wrap',
  },

  btnPrimarySmall: {
    backgroundColor:'#18641c',
    paddingVertical:8,
    paddingHorizontal:12,
    borderRadius:8,
    alignItems:'center',
    justifyContent:'center',
  },
  btnNeutralSmall: {
    backgroundColor:'#4A6572',
    paddingVertical:8,
    paddingHorizontal:12,
    borderRadius:8,
    alignItems:'center',
    justifyContent:'center',
  },
  btnDangerSmall: {
    backgroundColor:'#FF4C4C',
    paddingVertical:8,
    paddingHorizontal:12,
    borderRadius:8,
    alignItems:'center',
    justifyContent:'center',
  },
  filtersOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',   // ✅ centraliza no mobile e no web
    alignItems: 'center',
    padding: 20,
  },
  filtersPanel: {
    backgroundColor: '#1E2F47', // ✅ mesmo tom da admin
    width: '100%',
    maxWidth: 520,              // ✅ web não ocupa tela toda
    borderRadius: 12,
    padding: 0,                 // o ScrollView interno já tem padding
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#3A506B',
    overflow: 'hidden',
  },
  webCard: {
    backgroundColor:'#1E2F47',
    borderRadius:12,
    padding:14,
    marginBottom:12,
    borderWidth:1,
    borderColor:'#3A506B',
  },
  webActionsRow: {
    flexDirection:'row',
    gap: 8,
    marginTop: 12,
    justifyContent:'flex-end',
    flexWrap:'wrap',
  },
  webCardRow: {
    backgroundColor:'#1E2F47',
    borderRadius:12,
    padding:14,
    marginBottom:12,
    borderWidth:1,
    borderColor:'#3A506B',
    flexDirection:'row',
    alignItems:'center',
  },

  webActionsInline: {
    flexDirection:'row',
    gap: 8,
    alignItems:'center',
    flexWrap:'nowrap',     // ✅ força ficar na mesma linha
  },

  webTitle: {
    color:'#FFF',
    fontWeight:'700',
    fontSize:17,
  },
  webSub: {
    color:'#B0B0B0',
    fontSize:13,
  },
  webBadge: {
    color:'#E0E0E0',
    fontSize:12,
    fontWeight:'600',
  },
  webRow: {
    backgroundColor:'#1E2F47',
    borderRadius:12,
    padding:12,
    marginBottom:12,
    borderWidth:1,
    borderColor:'#3A506B',
    flexDirection:'row',
    alignItems:'center',
    gap: 12,
  },

  webRowTitle: {
    color:'#FFF',
    fontWeight:'700',
    fontSize:16,
  },

  webRowSub: {
    color:'#B0B0B0',
    fontSize:12,
    marginTop: 2,
  },

  webRowActions: {
    flexDirection:'row',
    gap: 8,
    alignItems:'center',
    flexWrap:'nowrap',
  },
  webMobileCard: {
    backgroundColor:'#1E2F47',
    borderRadius:12,
    padding:12,
    marginBottom:12,
    borderWidth:1,
    borderColor:'#3A506B',
  },
  webMobileActionsRow: {
    flexDirection:'row',
    flexWrap:'wrap',  // quebra linha quando apertar
    gap: 8,
    marginTop: 10,
  },
  infoBoxLimited: {
    maxHeight: Platform.OS === 'web' ? 220 : 160,
  },
});

