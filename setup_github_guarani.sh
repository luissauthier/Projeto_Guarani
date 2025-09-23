#!/usr/bin/env bash
set -euo pipefail

# ====== Config dos responsáveis (logins corretos) ======
CARLOS="FREDY-2003"
GABRIEL="GabrielLinkM"
LUIS="luishenrquessauthier"

echo "Usando responsáveis:"
echo "  Carlos  -> $CARLOS"
echo "  Gabriel -> $GABRIEL"
echo "  Luis    -> $LUIS"
echo

# Verifica se está autenticado
if ! gh auth status >/dev/null 2>&1; then
  echo "⚠️  Você não está logado no GitHub CLI. Rode: gh auth login"
  exit 1
fi

# Verifica se estamos dentro de um repo GitHub
if ! gh repo view >/dev/null 2>&1; then
  echo "⚠️  Este diretório não parece estar vinculado a um repositório do GitHub."
  echo "    Entre no diretório do repo (cd seu-repo) ou crie um com:"
  echo "    gh repo create projeto-guarani --public --clone"
  exit 1
fi

# ====== Helpers ======
mklabel () {
  local NAME="$1"
  local COLOR="$2"       # hex sem '#'
  local DESC="$3"

  if gh label create "$NAME" --color "$COLOR" --description "$DESC" >/dev/null 2>&1; then
    echo "✓ Label criada: $NAME"
  else
    # tenta atualizar caso já exista
    gh label edit "$NAME" --color "$COLOR" --description "$DESC" >/dev/null 2>&1 || true
    echo "✓ Label atualizada: $NAME"
  fi
}

mkissue () {
  local TITLE="$1"
  local ASSIGNEES="$2"   # separado por vírgula (sem @)
  local LABELS="$3"      # separado por vírgula
  local BODY="$4"

  gh issue create \
    --title "$TITLE" \
    --assignee "$ASSIGNEES" \
    --label "$LABELS" \
    --body "$BODY" >/dev/null

  echo "✓ Issue criada: $TITLE  →  [$ASSIGNEES]"
}

echo "==> Criando/atualizando labels…"
# prioridade
mklabel "prioridade:alta"  "d73a4a" "Tarefas críticas/MVP"
mklabel "prioridade:média" "fbca04" "Importantes, mas não bloqueiam"

# tipo
mklabel "tipo:feature" "a2eeef" "Nova funcionalidade"
mklabel "tipo:infra"    "cfd3d7" "Infra/DevOps/Build/Config"
mklabel "tipo:ux"       "c5def5" "UX/UI/Acessibilidade"
mklabel "tipo:bug"      "ee0701" "Correção de defeito"

# onboarding
mklabel "boa-primeira-issue" "7057ff" "Boa para começar"

# áreas
for area in auth jogadores treinos docs voluntarios doacoes relatorios app; do
  mklabel "area:${area}" "0e8a16" "Área: ${area}"
done

echo
echo "==> Criando issues…"

# ====== Infra & Base do App ======
mkissue "Configurar README do Projeto (passo a passo para rodar)" "$CARLOS" "tipo:infra,boa-primeira-issue,prioridade:alta,area:app" $'**O que:** Instruções para instalar dependências, configurar `.env`, rodar Expo e conectar ao Supabase.\n**Como validar:** Seguir o passo a passo e rodar o app local.\n**Definição de pronto:** README com Pré-requisitos, Como rodar, Variáveis de ambiente, Scripts NPM.\n**Estimativa:** 2h'

mkissue "Padronizar scripts no package.json (dev, lint, type-check, test)" "$CARLOS" "tipo:infra,boa-primeira-issue,prioridade:média,area:app" $'**O que:** Adicionar scripts `dev`, `lint`, `type-check`, `test`.\n**Como validar:** `npm run dev` inicia o Expo; `npm run lint` e `npm run type-check` funcionam.\n**Definição de pronto:** Scripts documentados no README.\n**Estimativa:** 1h'

mkissue "Arquitetura de pastas no app (React Native + TS)" "$GABRIEL" "tipo:infra,prioridade:alta,area:app" $'**O que:** Criar `src/components|screens|hooks|services|store|types|styles` e alias `@/`.\n**Como validar:** Imports ajustados e build ok.\n**Definição de pronto:** Pastas criadas e usadas por pelo menos 2 telas.\n**Estimativa:** 2h'

mkissue "Configurar NativeWind e tema básico + componente Button" "$CARLOS" "tipo:ux,prioridade:média,area:app" $'**O que:** Instalar NativeWind, configurar tema básico e criar `Button` reutilizável.\n**Como validar:** `Button` usado em 2 telas; classes utilitárias ok no Android/iOS.\n**Definição de pronto:** Tema base e docs no README.\n**Estimativa:** 3h'

# ====== Autenticação & Perfis ======
mkissue "Tela de Login (email/senha) + Logout com Supabase" "$GABRIEL" "tipo:feature,prioridade:alta,area:auth" $'**O que:** Tela de login usando Supabase Auth; manter sessão e botão Sair.\n**Como validar:** Login e Logout funcionando; erros exibem toast simples.\n**Definição de pronto:** Fluxo completo com loading/erro.\n**Estimativa:** 1 dia'

mkissue "RLS inicial e tabela usuarios (perfil gestor/treinador)" "$LUIS" "tipo:infra,prioridade:alta,area:auth" $'**O que:** Criar tabela `usuarios` (perfil) e policies mínimas para ler o próprio usuário.\n**Como validar:** Testar policies no Supabase (console/SQL) com 2 perfis.\n**Definição de pronto:** Policies criadas e documentadas.\n**Estimativa:** 1 dia'

mkissue "Guarda de rotas por perfil (gestor x treinador)" "$GABRIEL" "tipo:feature,prioridade:média,area:auth" $'**O que:** Proteger telas conforme `perfil` do usuário.\n**Como validar:** Treinador não vê ações de gestor.\n**Definição de pronto:** Middleware/Hook aplicado nas rotas.\n**Estimativa:** 4h'

# ====== Pré-inscrição & Aprovação ======
mkissue "Tela de Pré-inscrição (pública) de jogadores" "$CARLOS" "tipo:feature,prioridade:alta,area:jogadores" $'**O que:** Form com nome, data de nascimento, categoria; salvar com `status=pendente`.\n**Como validar:** Campos obrigatórios; sucesso mostra confirmação.\n**Definição de pronto:** Registro aparece na listagem.\n**Estimativa:** 1 dia'

mkissue "Upload de documento assinado e Aprovação de inscrição (gestor)" "$LUIS" "tipo:feature,prioridade:alta,area:jogadores" $'**O que:** Upload para Storage e mudar `status=aprovado` na inscrição.\n**Como validar:** Link do arquivo disponível; status reflete na listagem.\n**Definição de pronto:** Operação auditável (log simples).\n**Estimativa:** 1 dia'

# ====== Gestão de Jogadores ======
mkissue "Listagem de jogadores com filtros (status, categoria) e busca" "$GABRIEL" "tipo:feature,prioridade:alta,area:jogadores" $'**O que:** Lista com filtros e busca por nome; paginação simples.\n**Como validar:** Filtros funcionam e combinam entre si.\n**Definição de pronto:** Performance ok em lista com 200+ itens.\n**Estimativa:** 1,5 dias'

mkissue "Exportar CSV de jogadores (respeitando filtros)" "$CARLOS" "tipo:feature,prioridade:média,area:relatorios" $'**O que:** Botão Exportar CSV da lista filtrada.\n**Como validar:** CSV abre no Excel/Sheets com cabeçalhos corretos.\n**Definição de pronto:** Arquivo baixado e validado com 10+ registros.\n**Estimativa:** 3h'

# ====== Voluntários ======
mkissue "CRUD de Voluntários (gestor)" "$LUIS" "tipo:feature,prioridade:média,area:voluntarios" $'**O que:** Cadastrar/editar/remover voluntários (link com `usuarios/voluntarios`).\n**Como validar:** Lista atualiza em tempo real; validação de email.\n**Definição de pronto:** Ações protegidas por perfil.\n**Estimativa:** 1 dia'

# ====== Treinos & Presenças ======
mkissue "Criar Treino (treinador)" "$GABRIEL" "tipo:feature,prioridade:alta,area:treinos" $'**O que:** Form com data e descrição; salvar em `treinos`.\n**Como validar:** Treino aparece para treinador e gestor.\n**Definição de pronto:** Feedback de sucesso e navegação.\n**Estimativa:** 1 dia'

mkissue "Marcar Presenças e Observações por jogador" "$LUIS" "tipo:feature,prioridade:alta,area:treinos" $'**O que:** Registrar presença (status) e observação por jogador em cada treino.\n**Como validar:** Grava em `presencas`; UI rápida de selecionar.\n**Definição de pronto:** Idealmente com cache simples offline-first.\n**Estimativa:** 1,5 dias'

mkissue "Editar/Excluir Treino (gestor edita todos)" "$GABRIEL" "tipo:feature,prioridade:média,area:treinos" $'**O que:** Permitir editar/excluir treino conforme permissão.\n**Como validar:** Regras de permissão testadas.\n**Definição de pronto:** Logs mínimos de erro.\n**Estimativa:** 4h'

# ====== Documentos Internos ======
mkissue "Aba de Documentos Internos (upload/download de PDFs)" "$CARLOS" "tipo:feature,prioridade:média,area:docs" $'**O que:** CRUD simples em `documentos` e Storage do Supabase.\n**Como validar:** Upload e download funcionando; títulos e datas exibidos.\n**Definição de pronto:** Lista ordenada por `criado_em`.\n**Estimativa:** 1 dia'

# ====== Doações (Pix) ======
mkissue "Botão Doar (modal Pix) na tela inicial" "$CARLOS" "tipo:feature,boa-primeira-issue,prioridade:média,area:doacoes" $'**O que:** Modal com chave Pix e botão de copiar.\n**Como validar:** Modal abre/fecha e copia chave.\n**Definição de pronto:** Texto com nome do projeto e instruções.\n**Estimativa:** 3h'

# ====== UX & Qualidade ======
mkissue "Estados vazios e mensagens de erro amigáveis" "$CARLOS" "tipo:ux,prioridade:média,area:app" $'**O que:** Mensagens claras em listas vazias e erros de rede.\n**Como validar:** Pelo menos 3 telas com estados vazios e tratamento de erro.\n**Definição de pronto:** Mensagens padronizadas.\n**Estimativa:** 4h'

mkissue "Loading/Skeletons nas telas críticas" "$CARLOS" "tipo:ux,prioridade:média,area:app" $'**O que:** Adicionar loading/skeleton em Login, Lista de Jogadores e Treinos.\n**Como validar:** Skeleton visível durante fetch; UI não trava.\n**Definição de pronto:** Padrão de loading documentado.\n**Estimativa:** 3h'

# ====== Segurança & RLS (Juntos) ======
mkissue "Policies RLS por tabela (pacote) — FAZER JUNTOS" "$GABRIEL,$LUIS" "tipo:infra,prioridade:alta,area:auth" $'**O que:** Especificar e aplicar RLS para `jogadores`, `inscricoes`, `treinos`, `presencas`, `documentos`.\n**Como validar:** Testar com 3 usuários (público, treinador, gestor).\n**Definição de pronto:** Check-list de leitura/escrita por tabela.\n**Estimativa:** 1,5 dias'

# ====== Relatórios & Extras ======
mkissue "Relatório de presença por treino (CSV)" "$CARLOS" "tipo:feature,prioridade:média,area:relatorios" $'**O que:** Exportar presenças de um treino para CSV.\n**Como validar:** Abrir CSV no Excel/Sheets com cabeçalhos corretos.\n**Definição de pronto:** Download acionado pela tela do treino.\n**Estimativa:** 3h'

mkissue "Filtro de data nos treinos + paginação" "$GABRIEL" "tipo:feature,prioridade:média,area:treinos" $'**O que:** Filtrar treinos por período e paginar resultados.\n**Como validar:** Mantém estado ao navegar; funciona em conjunto com busca.\n**Definição de pronto:** UX consistente com a listagem de jogadores.\n**Estimativa:** 4h'

# ====== Testes & Entrega ======
mkissue "Teste manual guiado (Roteiro de validação do MVP)" "$CARLOS" "tipo:infra,boa-primeira-issue,prioridade:alta,area:app" $'**O que:** Escrever `docs/roteiro-validacao.md` com passos para validar: login, pré-inscrição, aprovação, criar treino e marcar presença.\n**Como validar:** Seguir roteiro do zero e checar prints/passos.\n**Definição de pronto:** Documento versionado e citado no README.\n**Estimativa:** 2h'

mkissue "Build de release Android (Expo)" "$LUIS" "tipo:infra,prioridade:média,area:app" $'**O que:** Gerar build `apk/aab` para testes internos.\n**Como validar:** Instalar em 1–2 dispositivos.\n**Definição de pronto:** Artefato + instruções de instalação no README.\n**Estimativa:** 1 dia'

echo
echo "✅ Labels criados/atualizados e issues abertas com sucesso!"