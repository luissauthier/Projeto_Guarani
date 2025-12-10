import React, { useState } from 'react';
import {
  SafeAreaView, ScrollView, Text, View,
  Pressable, StyleSheet, Platform, ToastAndroid,
  Linking 
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

export default function ApoioScreen() {
  const cnpj = '20.921.598/0001-69';

  const instaUrl = 'https://www.instagram.com/projetoguarani_oficial';
  
  function openInstagram() {
    Linking.openURL(instaUrl);
  }

  const [copied, setCopied] = useState(false);

  async function copyCnpj() {
    await Clipboard.setStringAsync(cnpj);
    if (Platform.OS === 'android') {
      ToastAndroid.show('Chave PIX copiada com sucesso', ToastAndroid.SHORT);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        
        {/* Botão de Voltar (igual ao do signup) */}
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="chevron-left" size={24} color="#FFF" />
          <Text style={styles.backButtonText}>Voltar</Text>
        </Pressable>

        <Text style={styles.title}>Apoie o Projeto</Text>

        {/* Bloco do QR Code */}
        <View style={styles.qrContainer}>
          
          {/* =================================================
            VVV   MARCAÇÃO PARA O FUTURO QR CODE   VVV
            
            Substitua o <View style={styles.qrPlaceholder} /> 
            pela sua tag <Image ... /> quando tiver o QR Code.
            =================================================
          */}
          <View style={styles.qrPlaceholder} />

        </View>

        <Text style={styles.cnpjText}>CNPJ para apoio:</Text>
        <View style={styles.cnpjRow}>
          <Text style={styles.cnpjNumber}>{cnpj}</Text>
          <Pressable onPress={copyCnpj} style={styles.copyButton}>
            <Feather name="copy" size={18} color="#0A1931" />
          </Pressable>
        </View>
        {copied && <Text style={styles.copiedText}>Chave PIX copiada com sucesso</Text>}

        <View style={styles.saibaMaisBox}>
          <Text style={styles.saibaMaisText}>Conheça mais sobre esse projeto:</Text>

          <Pressable onPress={openInstagram} style={styles.instagramBtn}>
            <Feather name="instagram" size={18} color="#0A1931" />
            <Text style={styles.instagramBtnText}>Projeto Guarani</Text>
          </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// Estilos baseados nos seus outros arquivos de (auth)
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A1931',
  },
  container: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 40,
    alignItems: 'center', // Centraliza o conteúdo
  },
  backButton: {
    position: 'absolute',
    top: 50, // Ajuste para safe area
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 16,
    marginLeft: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 40,
    marginTop: 60, // Espaço abaixo do botão "Voltar"
    textAlign: 'center',
  },
  qrContainer: {
    padding: 20,
    backgroundColor: '#FFFFFF', // Fundo branco para o QR
    borderRadius: 16,
    marginBottom: 20,
  },
  qrPlaceholder: {
    width: 250,
    height: 250,
    backgroundColor: '#E0E0E0', // Um cinza claro como placeholder
    borderRadius: 8,
  },
  cnpjText: {
    fontSize: 18,
    color: '#B0B0B0', // Um cinza mais claro
    marginTop: 20,
  },
  cnpjNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
  },
  cnpjRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  copyButton: {
    marginLeft: 12,
    backgroundColor: '#FFF',
    padding: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copiedText: {
    marginLeft: 10,
    color: '#AEEA00',
    fontWeight: '600',
  },
  saibaMaisBox: {
    marginTop: 30,
    alignItems: 'center',
  },
  saibaMaisText: {
    fontSize: 16,
    color: '#B0B0B0',
    marginBottom: 10,
    textAlign: 'center',
  },
  instagramBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 8,
  },
  instagramBtnText: {
    color: '#0A1931',
    fontWeight: '700',
    fontSize: 15,
  },
});