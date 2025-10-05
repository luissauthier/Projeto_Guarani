// app/(seu-caminho)/signup.tsx
import React, { useMemo, useState } from 'react';
import {
  SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, Image,
  ActivityIndicator, Alert, Pressable
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { Feather } from '@expo/vector-icons';

type UploadKind = 'foto' | 'doc_frente' | 'doc_verso';

export default function Signup() {
  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState(''); // yyyy-mm-dd
  const [responsavel, setResponsavel] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');

  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [docFrenteUri, setDocFrenteUri] = useState<string | null>(null);
  const [docVersoUri, setDocVersoUri] = useState<string | null>(null);

  const [uploading, setUploading] = useState<UploadKind | null>(null);
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

  async function pick(kind: UploadKind) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return Alert.alert('Permissão necessária', 'Autorize acesso à galeria de imagens.');
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      if (kind === 'foto') setFotoUri(uri);
      if (kind === 'doc_frente') setDocFrenteUri(uri);
      if (kind === 'doc_verso') setDocVersoUri(uri);
    }
  }

  async function uploadToStorage(localUri: string) {
    try {
      const res = await fetch(localUri);
      const blob = await res.blob();
      const ext = 'jpg';
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const path = `preinscricao/${filename}`;
      const { error } = await supabase.storage
        .from('jogadores')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if (error) throw error;
      return path as string;
    } finally {
      setUploading(null);
    }
  }

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
      let foto_path: string | null = null;
      let doc_id_frente_path: string | null = null;
      let doc_id_verso_path: string | null = null;

      if (fotoUri) {
        setUploading('foto');
        foto_path = await uploadToStorage(fotoUri);
      }
      if (docFrenteUri) {
        setUploading('doc_frente');
        doc_id_frente_path = await uploadToStorage(docFrenteUri);
      }
      if (docVersoUri) {
        setUploading('doc_verso');
        doc_id_verso_path = await uploadToStorage(docVersoUri);
      }

      const { error } = await supabase.from('jogadores').insert({
        nome,
        data_nascimento: dataNascimento,
        email: email || null,
        telefone,
        responsavel_nome: responsavelObrigatorio ? responsavel : (responsavel || null),
        foto_path,
        doc_id_frente_path,
        doc_id_verso_path,
        status: 'pre_inscrito',
        termo_assinado_path: null,
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
      setUploading(null);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1931' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <TouchableOpacity onPress={handleSignOut} style={{ alignSelf: 'flex-end', padding: 8 }}>
          <Feather name="log-out" size={24} color="#00C2CB" />
        </TouchableOpacity>

        <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 12, color: '#fff' }}>
          Pré-inscrição de jogador
        </Text>

        <TextInput placeholder="Nome completo do jogador" placeholderTextColor="#A0A0A0"
          value={nome} onChangeText={setNome} style={styles.input} />

        <TextInput placeholder="Data de nascimento (AAAA-MM-DD)" placeholderTextColor="#A0A0A0"
          value={dataNascimento} onChangeText={setDataNascimento} style={styles.input} />

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

        {/* Foto */}
        <UploadBox
          title="Foto do jogador"
          uri={fotoUri}
          onPick={() => pick('foto')}
          uploading={uploading === 'foto'}
        />

        {/* Documento (opcional) */}
        <Text style={{ color: '#fff', fontWeight: 'bold', marginBottom: 8 }}>Documento de identidade (opcional)</Text>
        <Pressable style={[styles.pickButton, { marginBottom: 8 }]} onPress={() => pick('doc_frente')}>
          <Feather name="file-plus" size={18} color="#FFF" />
          <Text style={styles.pickButtonText}>Frente</Text>
        </Pressable>
        <Pressable style={[styles.pickButton, { marginBottom: 8 }]} onPress={() => pick('doc_verso')}>
          <Feather name="file-plus" size={18} color="#FFF" />
          <Text style={styles.pickButtonText}>Verso</Text>
        </Pressable>
        <RowPreviews frente={docFrenteUri} verso={docVersoUri} />
        {(uploading === 'doc_frente' || uploading === 'doc_verso') && <ActivityIndicator color="#00C2CB" style={{ marginTop: 8 }} />}

        <Pressable
          style={[styles.submitButton, (saving || uploading !== null) && { opacity: 0.7 }]}
          onPress={enviar}
          disabled={saving || uploading !== null}
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

function UploadBox({ title, uri, onPick, uploading }:{
  title: string; uri: string | null; onPick: () => void; uploading: boolean;
}) {
  return (
    <React.Fragment>
      <Text style={styles.uploadTitle}>{title}</Text>
      <Pressable style={styles.pickButton} onPress={onPick}>
        <Feather name="image" size={18} color="#FFF" />
        <Text style={styles.pickButtonText}>Selecionar imagem</Text>
      </Pressable>
      {uri ? <Image source={{ uri }} style={styles.preview} /> : null}
      {uploading && <ActivityIndicator color="#00C2CB" />}
    </React.Fragment>
  );
}

function RowPreviews({ frente, verso }:{ frente: string|null; verso: string|null }) {
  if (!frente && !verso) return null;
  return (
    <React.Fragment>
      <Image source={{ uri: frente ?? undefined }} style={[styles.preview, { display: frente ? 'flex' : 'none' }]} />
      <Image source={{ uri: verso ?? undefined }} style={[styles.preview, { display: verso ? 'flex' : 'none' }]} />
    </React.Fragment>
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