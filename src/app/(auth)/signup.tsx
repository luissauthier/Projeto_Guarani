import React, { useMemo, useState } from 'react';
import {
  SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, Alert,
  Pressable, ActivityIndicator, Platform,
  View
} from 'react-native';
import { TextInputMask } from "react-native-masked-text"; // <-- NOME CORRIGIDO
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';


function todayYmd() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function parseYmd(ymd: string) {
  if (!ymd) return null;
  const d = new Date(ymd + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

function calcAgeFromYmd(ymd: string) {
  const dob = parseYmd(ymd);
  if (!dob) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function brToYmd(br: string) {
  // br: dd/mm/yyyy
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return '';
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function ymdToBr(ymd: string) {
  // ymd: yyyy-mm-dd
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

  // garante que não "normalizou" (ex: 31/02 vira 02/03)
  const [y, mo, da] = ymd.split('-').map(Number);
  return d.getFullYear() === y && (d.getMonth()+1) === mo && d.getDate() === da;
}

export default function Signup() {
  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState(todayYmd()); // yyyy-mm-dd
  const [dataNascimentoBr, setDataNascimentoBr] = useState(ymdToBr(todayYmd()));
  const [responsavel, setResponsavel] = useState('');
  const [telefone, setTelefone] = useState('');
  const [telefoneMasked, setTelefoneMasked] = useState('');
  const [email, setEmail] = useState('');

  const [saving, setSaving] = useState(false);

  const idade = useMemo(() => calcAgeFromYmd(dataNascimento), [dataNascimento]);

  const categoriaAno = useMemo(() => {
    const dob = parseYmd(dataNascimento);
    return dob ? dob.getFullYear() : null;
  }, [dataNascimento]);

  // refs + posições Y para focar/rolar até o campo com erro
  const scrollRef = React.useRef<ScrollView>(null);

  const nomeRef = React.useRef<TextInput>(null);
  const telRef = React.useRef<TextInput>(null);
  const responsavelRef = React.useRef<TextInput>(null);

  const [nomeY, setNomeY] = React.useState(0);
  const [telY, setTelY] = React.useState(0);
  const [respY, setRespY] = React.useState(0);
  const [dateY, setDateY] = React.useState(0); // usamos uma View ao redor do date p/ medir

  // em cima do componente ou no mesmo arquivo
  type AnyFocusable = { focus?: () => void } | null | undefined;
  type AnyRef = React.RefObject<AnyFocusable> | null | undefined;

  function focusAndScroll(ref?: AnyRef, y?: number) {
    requestAnimationFrame(() => {
      // tenta focar se existir e tiver método focus
      if (ref?.current && typeof ref.current.focus === 'function') {
        ref.current.focus();
      }
      // rola se recebeu Y
      if (typeof y === 'number') {
        scrollRef.current?.scrollTo({ y: Math.max(y - 16, 0), animated: true });
      }
    });
  }

  // erros por campo
  const [errors, setErrors] = React.useState<{
    nome?: string;
    data_nascimento?: string;
    telefone?: string;
    responsavel?: string;
  }>({});

  // feedback visual pós-envio
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false); // desabilita formulário/botão após sucesso

  const responsavelObrigatorio = idade !== null && idade < 18;

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Erro', 'Erro ao retornar para página de login, tente mais tarde.');
  }

  async function enviar() {
    console.log("== enviar() iniciou ==");

    setErrors({});

    if (!nome.trim()) {
      console.log("ERRO: nome vazio");
      setErrors(e => ({ ...e, nome: 'Informe o nome do jogador.' }));
      focusAndScroll(nomeRef, nomeY);
      return;
    }

    console.log("nome OK:", nome);

    if (!dataNascimento.trim()) {
      console.log("ERRO: dataNascimento vazio");
      setErrors(e => ({ ...e, data_nascimento: 'Informe a data de nascimento (DD/MM/AAAA).' }));
      focusAndScroll(null, dateY);
      return;
    }

    if (!isValidYmd(dataNascimento)) {
      console.log("ERRO: dataNascimento inválida:", dataNascimento);
      setErrors(e => ({ ...e, data_nascimento: 'Data de nascimento inválida.' }));
      focusAndScroll(null, dateY);
      return;
    }

    console.log("data OK:", dataNascimento);

    const ageNow = calcAgeFromYmd(dataNascimento);
    const respObrigatorioNow = ageNow !== null && ageNow < 18;

    console.log("idade calculada:", ageNow, "respObrigatorioNow:", respObrigatorioNow);

    if (respObrigatorioNow && !responsavel.trim()) {
      console.log("ERRO: responsável obrigatório e vazio");
      setErrors(e => ({ ...e, responsavel: 'Responsável é obrigatório para menores de 18 anos.' }));
      focusAndScroll(responsavelRef, respY);
      return;
    }

    console.log("responsável OK:", responsavel);

    const telefoneDigits = (telefone ?? '').replace(/\D/g, '');
    if (telefoneDigits.length < 10) { // 10 = fixo com DDD, 11 pra celular completo
      setErrors(e => ({ ...e, telefone: 'Informe um número de telefone para contato.' }));
      focusAndScroll(telRef, telY);
      return;
    }
    console.log("telefone OK:", telefone);

    setSaving(true);
    try {
      console.log("vai inserir no supabase...");

      const categoria = parseYmd(dataNascimento)?.getFullYear() ?? null;

      const { error } = await supabase.from('jogadores').insert({
        nome,
        data_nascimento: dataNascimento || null,
        email: email || null,
        telefone: telefoneDigits,
        responsavel_nome: respObrigatorioNow ? responsavel : (responsavel || null),
        status: 'pre_inscrito',
        categoria,
        termo_entregue: false,
        is_jogador_guarani: false,
        observacao: null,
      });

      if (error) {
        console.log("SUPABASE INSERT ERROR:", error);
        Alert.alert('Erro ao enviar', error.message);
        return;
      }

      console.log("INSERT OK ✅");

      setSuccessMsg('Pré-inscrição enviada! Você será redirecionado em instantes.');
      setJustSent(true);

      setNome('');
      setTelefone('');
      setEmail('');
      setResponsavel('');
      setDataNascimento(todayYmd());
      setDataNascimentoBr(ymdToBr(todayYmd()));

      setTimeout(() => {
        setSuccessMsg(null);
        router.back();
      }, 5000);

    } catch (e: any) {
      console.log("CATCH ERROR:", e);
      Alert.alert('Erro', e?.message ?? 'Falha ao enviar pré-inscrição.');
    } finally {
      setSaving(false);
      console.log("== enviar() terminou ==");
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1931' }}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16 }}>
        <TouchableOpacity onPress={handleSignOut} style={{ alignSelf: 'flex-end', padding: 8 }}>
          <Feather name="home" size={24} color="#00C2CB" />
        </TouchableOpacity>

        <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 12, color: '#fff' }}>
          Pré-inscrição de jogador
        </Text>

        {successMsg && (
          <Pressable
            onPress={() => setSuccessMsg(null)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#2E7D32', // verde
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 8,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: '#1B5E20',
              gap: 8,
            }}
          >
            <Feather name="check-circle" size={20} color="#fff" />
            <Text style={{ color: '#fff', flex: 1 }}>
              {successMsg}
            </Text>
            <Feather name="x" size={18} color="#fff" />
          </Pressable>
        )}

        <TextInput
          ref={nomeRef}
          onLayout={(e) => setNomeY(e.nativeEvent.layout.y)}
          style={[
            styles.input,
            errors.nome && { borderColor: '#FF6B6B', backgroundColor: '#2A1F1F' },
          ]}
          placeholder="Nome completo do jogador"
          placeholderTextColor="#A0A0A0"
          value={nome}
          onChangeText={(t) => { setNome(t); if (errors.nome) setErrors(s => ({ ...s, nome: undefined })); }}
        />
        {!!errors.nome && (
          <Text style={{ color: '#FF6B6B', marginTop: -6, marginBottom: 10, fontSize: 12 }}>
            {errors.nome}
          </Text>
        )}

        <View onLayout={(e) => setDateY(e.nativeEvent.layout.y)}>
          <Text style={{ color: '#E0E0E0', marginBottom: 6 }}>Data de nascimento</Text>

          {Platform.OS === 'web' ? (
            <input
              type="date"
              value={dataNascimento || todayYmd()}
              onChange={(e) => {
                const v = e.currentTarget.value; // yyyy-mm-dd
                setDataNascimento(v);
                setDataNascimentoBr(ymdToBr(v));
                if (errors.data_nascimento) setErrors(s => ({ ...s, data_nascimento: undefined }));
              }}
              max={todayYmd()}
              style={{
                padding: 16,
                border: `1px solid ${errors.data_nascimento ? '#FF6B6B' : '#4A6572'}`,
                backgroundColor: errors.data_nascimento ? '#2A1F1F' : '#203A4A',
                color: '#FFF',
                borderRadius: 12,
                height: 55,
                marginBottom: 12,
                width: '100%',
                boxSizing: 'border-box',
                fontSize: 16,
              }}
            />
          ) : (
            <TextInputMask
              type={'datetime'}
              options={{ format: 'DD/MM/YYYY' }}
              value={dataNascimentoBr ?? ''}  // <-- garante string
              onChangeText={(text) => {
                const t = text ?? '';
                setDataNascimentoBr(t);

                if (t.length === 10) {
                  const ymd = brToYmd(t);
                  setDataNascimento(ymd);
                  if (errors.data_nascimento)
                    setErrors(s => ({ ...s, data_nascimento: undefined }));
                }
              }}
              placeholder="DD/MM/AAAA"
              placeholderTextColor="#A0A0A0"
              keyboardType="number-pad"
              style={[
                styles.input,
                errors.data_nascimento && { borderColor: '#FF6B6B', backgroundColor: '#2A1F1F' },
              ]}
            />
          )}

          {!!errors.data_nascimento && (
            <Text style={{ color: '#FF6B6B', marginTop: -6, marginBottom: 10, fontSize: 12 }}>
              {errors.data_nascimento}
            </Text>
          )}
        </View>

        {(idade !== null || categoriaAno !== null) && (
          <Text style={{ color: '#E0E0E0', marginBottom: 10 }}>
            {idade !== null ? `Idade: ${idade} anos ` : ''}
            {categoriaAno !== null ? `• Categoria (ano): ${categoriaAno}` : ''}
            {responsavelObrigatorio ? ' • (responsável obrigatório)' : ''}
          </Text>
        )}

        <TextInputMask
          type={'cel-phone'}
          options={{
            maskType: 'BRL',
            withDDD: true,
            dddMask: '(99) ',
          }}
          style={[
            styles.input,
            errors.telefone && { borderColor: '#FF6B6B', backgroundColor: '#2A1F1F' },
          ]}
          placeholder="Telefone do Responsável (com DDD)"
          placeholderTextColor="#A0A0A0"
          keyboardType="phone-pad"
          value={telefoneMasked} // ✅ sempre o que aparece na tela
          onChangeText={(maskedText) => {
            const masked = maskedText ?? '';
            setTelefoneMasked(masked);

            // salva digits também (opcional, mas útil)
            setTelefone(masked.replace(/\D/g, ''));

            if (errors.telefone) setErrors(e => ({ ...e, telefone: undefined }));
          }}
        />

        {!!errors.telefone && (
          <Text style={{ color: '#FF6B6B', marginTop: -6, marginBottom: 10, fontSize: 12 }}>
            {errors.telefone}
          </Text>
        )}

        <TextInput placeholder="E-mail (opcional)" placeholderTextColor="#A0A0A0"
          value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={styles.input} />

        <TextInput
          ref={responsavelRef}
          onLayout={(e) => setRespY(e.nativeEvent.layout.y)}
          style={[
            styles.input,
            errors.responsavel && { borderColor: '#FF6B6B', backgroundColor: '#2A1F1F' },
          ]}
          placeholder="Nome do responsável (se menor de 18)"
          placeholderTextColor="#A0A0A0"
          value={responsavel}
          onChangeText={(t) => {
            setResponsavel(t);
            if (errors.responsavel) setErrors((e) => ({ ...e, responsavel: undefined }));
          }}
        />
        {!!errors.responsavel && (
          <Text style={{ color: '#FF6B6B', marginTop: -6, marginBottom: 10, fontSize: 12 }}>
            {errors.responsavel}
          </Text>
        )}

        <TouchableOpacity
          activeOpacity={0.7} // Garante a animação visual ao clicar
          style={[styles.submitButton, saving && { opacity: 0.5 }]}
          onPress={() => {
            console.log('Botão clicado!'); // Debug para ver no terminal
            enviar();
          }}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitText}>
              {justSent ? 'Enviado!' : 'Enviar Pré-inscrição'}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={{ color: '#B0B0B0', marginTop: 12 }}>
          Após a pré-inscrição, o termo será entregue fisicamente. O admin fará upload do termo assinado e aprovará.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = {
  input: {
    height: 55, backgroundColor: '#203A4A', borderRadius: 12, paddingHorizontal: 20, marginBottom: 12,
    color: '#FFF', fontSize: 16, borderWidth: 1, borderColor: '#4A6572',
  } as any,
  uploadTitle: { color: '#fff', fontWeight: 'bold', marginBottom: 8 } as any,
  pickButton: {
    backgroundColor: '#4A6572', paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    justifyContent: 'center', flexDirection: 'row', gap: 8,
  } as any,
  pickButtonText: { color: '#fff', fontWeight: 'bold', marginLeft: 8 } as any,
  preview: {
    width: '100%', height: 160, borderRadius: 10, marginTop: 10, borderWidth: 1, borderColor: '#4A6572',
  } as any,
  submitButton: {
    backgroundColor: '#18641c', paddingVertical: 16, borderRadius: 12, alignItems: 'center',
    justifyContent: 'center', marginTop: 8,
  } as any,
  submitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 } as any,
};

