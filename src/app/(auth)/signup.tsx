import React, { useMemo, useState } from 'react';
import {
  SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, Alert,
  Pressable, ActivityIndicator, Platform
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

function todayYmd() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

export default function Signup() {
  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState(todayYmd()); // yyyy-mm-dd
  const [responsavel, setResponsavel] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');

  const [saving, setSaving] = useState(false);

  const idade = useMemo(() => {
    if (!dataNascimento) return null;
    const dob = new Date(dataNascimento);
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  }, [dataNascimento]);

  const categoriaAno = useMemo(() => {
    if (!dataNascimento) return null;
    const dob = new Date(dataNascimento);
    if (isNaN(dob.getTime())) return null;
    return dob.getFullYear(); // mesma regra do banco
  }, [dataNascimento]);

  const responsavelObrigatorio = idade !== null && idade < 18;

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Erro', 'Erro ao retornar para página de login, tente mais tarde.');
  }

  async function enviar() {
    if (!nome.trim()) return Alert.alert('Atenção', 'Informe o nome do jogador.');
    if (!dataNascimento.trim()) return Alert.alert('Atenção', 'Informe a data de nascimento (AAAA-MM-DD).');
    const dob = new Date(dataNascimento);
    if (isNaN(dob.getTime())) return Alert.alert('Atenção', 'Data de nascimento inválida.');
    if (!telefone.trim()) return Alert.alert('Atenção', 'Informe um número de telefone para contato.');
    if (responsavelObrigatorio && !responsavel.trim()) {
      return Alert.alert('Atenção', 'Responsável é obrigatório para menores de 18 anos.');
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('jogadores').insert({
        nome,
        data_nascimento: dataNascimento || null,
        email: email || null,
        telefone,
        responsavel_nome: responsavelObrigatorio ? responsavel : (responsavel || null),
        status: 'pre_inscrito',
        categoria: dataNascimento ? new Date(dataNascimento).getFullYear() : null,
        termo_entregue: false,
        is_jogador_guarani: false,
        observacao: null,
      });
      if (error) throw error;

      Alert.alert(
        'Pré-inscrição enviada!',
        'Leve o termo para assinatura do responsável. O admin fará o upload do termo assinado e aprovará.'
      );
      router.back();
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Falha ao enviar pré-inscrição.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1931' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <TouchableOpacity onPress={handleSignOut} style={{ alignSelf: 'flex-end', padding: 8 }}>
          <Feather name="home" size={24} color="#00C2CB" />
        </TouchableOpacity>

        <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 12, color: '#fff' }}>
          Pré-inscrição de jogador
        </Text>

        <TextInput placeholder="Nome completo do jogador" placeholderTextColor="#A0A0A0"
          value={nome} onChangeText={setNome} style={styles.input} />

        <Text style={{ color: '#E0E0E0', marginBottom: 6 }}>Data de nascimento</Text>

        {Platform.OS === 'web' ? (
          <input
            type="date"
            value={dataNascimento || todayYmd()}
            onChange={(e) => setDataNascimento(e.currentTarget.value)}
            max={todayYmd()} // evita datas futuras no web
            style={{
              padding: 16,
              border: '1px solid #4A6572',
              backgroundColor: '#203A4A',
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
          <DateTimePicker
            mode="date"
            value={dataNascimento ? new Date(dataNascimento + 'T00:00:00') : new Date()}
            onChange={(_, d) => {
              if (d) {
                const pad = (n: number) => String(n).padStart(2, '0');
                const v = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
                setDataNascimento(v);
              }
            }}
            maximumDate={new Date()} // evita datas futuras no mobile
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

        <TextInput placeholder="Telefone para contato" placeholderTextColor="#A0A0A0"
          value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" style={styles.input} />

        <TextInput placeholder="E-mail (opcional)" placeholderTextColor="#A0A0A0"
          value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={styles.input} />

        <TextInput placeholder="Nome do responsável (se menor de 18)" placeholderTextColor="#A0A0A0"
          value={responsavel} onChangeText={setResponsavel} style={styles.input} />

        <Pressable
          style={[styles.submitButton, saving && { opacity: 0.7 }]}
          onPress={enviar}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Enviar Pré-inscrição</Text>}
        </Pressable>

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
