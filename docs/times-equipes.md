# Copa — Times/Equipes

Implementação isolada em `codex/copa-times-equipes`, origin/main de base fbc042f314663903196347da48881be870ac78e4. Não publicada.

## Escopo

- Nova modalidade premium em Copas e modelos, sem alterar as modalidades existentes.
- Trio de 3 atletas, composição livre; Squad com exatamente 2 homens e 2 mulheres.
- Uma pessoa capitã por equipe, incluída no total. Nome inicial Time A, Time B etc., editável.
- Formação fixa ou dois sorteios separados: capitães e integrantes. Capitães podem ser previamente indicados. Equilíbrio por nível opcional, considerando os capitães e respeitando a composição do Squad.
- De 4 ou 6 a 32 equipes, conforme limites da base. Cinco não permite somente grupos de 3/4. Prioridade para grupos de 3.
- Dois classificados por grupo; chave principal usa os planos atuais do Modelo Torneio 360, incluindo BYEs e terceiro lugar quando o plano da base prevê.
- Consolation opcional: exclusivamente os eliminados da fase de grupos. Nunca recebe perdedores da chave principal.
- Melhor de três partidas; terceiro jogo somente em 1 a 1. Trio sequencial. Squad: masculina e feminina podem ocorrer em quadras diferentes; desempate misto. A plataforma não controla substituições.
- Games de 4 ou 6 conforme regra existente, com a mesma regra nas três partidas.
- Classificação confirmada: vitórias de confrontos, saldo de games, total de games, confronto direto e sorteio. Soma dos games das partidas concluídas de confrontos finalizados, incluindo o desempate. Campanhas entre grupos usam métricas proporcionais, como a base.
- Card horizontal: equipe, três placares, total de partidas vencidas. Cada coluna seleciona sua quadra, chamada e cronômetro.

## Persistência e proteção

Usa o JSON e o fluxo existente de rascunho local/salvamento/reconciliação. Cada partida tem placar, quadra, cronômetro e identidade próprios. A normalização preserva todos os integrantes, capitães e níveis.

Conflitos de sincronização, mudança de adversário com placar registrado e terceiro jogo incompatível não apagam dados silenciosamente. Gerar eliminatórias protege os placares dos grupos. Novos sorteios ficam bloqueados após gerar jogos.

Não há migração SQL, execução no Supabase, carga de teste no oficial, edição de perfil, Pix, diretório público ou transporte da homologação. A visão pública da nova modalidade é somente leitura.

## Verificações

- `pnpm test`: smoke existente + testes específicos em `scripts/team-cup-check.mjs`.
- 56 torneios completos simulados (Trio/Squad, todas as quantidades), formação, BYEs, ranking, desempates, Consolation, preservação e concorrência.
- Compilação: `node node_modules/vite/bin/vite.js build`.
- Prévia local usa a tela real do organizador, com persistência simulada em navegador; não inicializa um cliente Supabase.
- Testes no navegador: sorteios separados, Squad simultâneo em duas quadras, placar 2 a 0 / 2 a 1, geração das finais, recarga preservando placares e público sem campos editáveis.
- Larguras 320, 390, 768 e 1280 px; temas claro/escuro; placares dentro de suas células.

Para reproduzir: iniciar Vite em localhost e abrir `/scripts/team-cup-preview.html`. Esse arquivo não é entrada da compilação de produção.

Publicar somente após autorização específica e revisão final da branch; nenhuma publicação faz parte desta implementação.
