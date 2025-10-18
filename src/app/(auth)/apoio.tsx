import React from 'react';
import {
  SafeAreaView, ScrollView, Text, View,
  Pressable, StyleSheet
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';

export default function ApoioScreen() {
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
        <Text style={styles.cnpjNumber}>XX.XXX.XXX/0001-XX</Text>

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
  }
});