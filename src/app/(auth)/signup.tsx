import { View, Text, TextInput, Pressable, Alert, ActivityIndicator, SafeAreaView, ScrollView } from 'react-native';
import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { router } from 'expo-router';

export default function PreInscricao() {
  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState(''); // yyyy-mm-dd
  const [categoria, setCategoria] = useState('');
  const [loading, setLoading] = useState(false);

  async function enviar() {
    if (!nome) return Alert.alert('Atenção', 'Informe o nome.');
    try {
      setLoading(true);
      const { error } = await supabase.from('jogadores').insert({
        nome,
        data_nascimento: dataNascimento || null,
        categoria: categoria || null,
        status: 'pre_inscrito',
      });
      if (error) throw error;
      Alert.alert('Sucesso', 'Pré-inscrição enviada! Aguarde contato do clube.');
      router.back();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 12 }}>Pré-inscrição de jogador</Text>
        <TextInput placeholder="Nome completo" value={nome} onChangeText={setNome}
          style={{ backgroundColor:'#fff', borderRadius:8, padding:12, marginBottom:12 }} />
        <TextInput placeholder="Data de nascimento (AAAA-MM-DD)" value={dataNascimento} onChangeText={setDataNascimento}
          style={{ backgroundColor:'#fff', borderRadius:8, padding:12, marginBottom:12 }} />
        <TextInput placeholder="Categoria (ex.: Sub-11)" value={categoria} onChangeText={setCategoria}
          style={{ backgroundColor:'#fff', borderRadius:8, padding:12, marginBottom:12 }} />
        <Pressable onPress={enviar} style={{ backgroundColor:'#18641c', padding:16, borderRadius:10, alignItems:'center' }}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color:'#fff', fontWeight:'bold' }}>Enviar</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}