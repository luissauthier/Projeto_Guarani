# Projeto Guarani

Aplicativo desenvolvido em **Reaxct Native (Expo)** com integração ao **Supabase**

---

## Pré-requisitos

Antes de rodar o projeto, você precisa ter instalado:

 - [Node.js](https://nodejs.org/) (versão LTS recomendada)
 - [npm](https://www.npmjs.com/) ou [yarn] (https://yarnpkg.com/)
 - Uma conta no [Supabase] (https://supabase.com/)

 ## Variáveis de ambiente

 Crie um arquivo '.env' na raiz do projeto com as seguintes variáveis:

 '''env

 EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
 EXPO_PUBLIC_SUPABASE_ANON_KEY=chave_anon_publica_aqui

 ## Como rodar

 1) npm install - Instalar as dependências.
 2) Configure o .env conforme descrito acima.
 3) Inicie o app em modo desenvolvimento - npm run dev.
 4) Abra o aplicativo no celular usando o app Expo Go ou rode no emulador Android/iOS.

 Scripts NPM:
 - npm run dev -> inicia o Expo.
 - npm run lint -> roda o linter (ESLint)
 - npm run type-check -> Verifica os tipos TypeScript
 - npm run test -> executa os testes (placeholder por enquanto) 