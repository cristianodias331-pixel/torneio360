# Refatoração modular do Torneio360

## Objetivo

Reduzir gradualmente a concentração de responsabilidades em `src/main.jsx` sem alterar regras de torneios, dados persistidos, banco, autenticação ou aparência.

## Regras de segurança

- Fazer uma extração pequena por vez.
- Preservar os nomes e os formatos dos campos já persistidos.
- Não misturar refatoração com mudança visual ou nova funcionalidade.
- Executar `pnpm test` e `pnpm build` depois de cada etapa.
- Conferir o diff antes de qualquer commit ou publicação.
- Manter funções de domínio sem dependência de React, navegador ou Supabase sempre que possível.

## Estrutura iniciada

```text
src/
  features/
    appShell/
      AccessStatusViews.jsx # preparação, bloqueio e teste grátis recebendo decisões e ações por propriedades
      AppUpdateNotice.jsx # aviso não intrusivo de nova versão do aplicativo instalado
      EntryPresentation.jsx # planos, explicações, logotipo e contatos sem autenticação ou persistência
    brackets/
      CupBracketView.jsx # árvore visual, rodadas e cartões das chaves eliminatórias
      PublicBracketView.jsx # rodadas e chaves públicas em modo somente leitura
    circuitManagement/
      CircuitExtraPointsPanel.jsx # inclusão manual, bônus e confirmações recebendo o salvamento por callback
      CircuitRankingSettings.jsx # formato das etapas, pontos e desempates sem cálculo ou persistência
      TournamentCircuitManager.jsx # atalho e diálogo para associar torneios usando callbacks da aplicação
    dialogs/
      ConfirmationDialogs.jsx # avisos e confirmações visuais; ações reais continuam recebidas por callback
    courtCenter/
      CourtCenterModal.jsx # capacidade, situação e preferências visuais da Central de Quadras
    media/
      canvasTools.mjs # logotipos, imagens e desenho em canvas reutilizados pelos compartilhamentos
      ShuffleVideoModal.jsx # geração visual e download do vídeo recebendo as operações por callback
    matchOperations/
      MatchControls.jsx # quadra, repetição, ocupação e chamada por voz sem lógica de persistência
      MatchSchedule.jsx # cartão universal das partidas e composição visual das rodadas
      TournamentSummaryViews.jsx # resumos visuais de cronômetro e situação dos jogos
    modalityPicker/
      ModalityPicker.jsx # busca, categorias e seleção responsiva das modalidades
    participantManagement/
      ParticipantManagement.jsx # importação em massa, prévia, presença e campos de participantes
    publicArena/
      PublicArenaPresentation.jsx # página inicial, diretório, perfil completo, cabeçalho e cartões públicos recebendo dados e ações por propriedades
    ranking/
      CupPodiumView.jsx # apresentação e compartilhamento do pódio com dados previamente calculados
      RankingTables.jsx # tabelas masculina, feminina e geral com ações de compartilhamento e circuito
      TieBreakPanels.jsx # sorteios de desempate e classificação visual dos grupos
    rankingShare/
      RankingShareButton.jsx # estado e modal visual da exportação de rankings
      rankingShareExport.mjs # geração, cópia, impressão, download e compartilhamento dos arquivos
    tournamentWorkspace/
      TournamentErrorBoundary.jsx # proteção visual ao abrir dados incompatíveis sem alterar os torneios
      TournamentWorkspaceTabs.jsx # abas abertas, busca, seletor móvel e confirmação de fechamento
    tournamentConfig/
      FormatExplanationButton.jsx # diálogo genérico de ajuda e explicação do formato Simples
      TournamentFormatPanels.jsx # quantidades e nomes das chaves sem geração ou persistência
      TournamentFormatHelp.jsx # explicações dinâmicas e escolhas visuais das disputas paralelas
  domain/
    bracketBasics.mjs # tamanhos, sementes e emparelhamentos básicos das chaves
    bracketConstruction.mjs # cartões, BYEs e rodadas eliminatórias genéricas
    bracketProgression.mjs # vencedor, perdedor e avanço entre partidas eliminatórias
    campaignRanking.mjs # comparação proporcional das campanhas entre grupos
    cearenseQualification.mjs # seleção preservada da principal e da paralela
    cearenseThirdParallel.mjs # origens e cruzamentos da 3ª disputa paralela
    circuitRankingAggregation.mjs # reunião e ordenação final dos rankings dos circuitos
    circuitPlacement.mjs # classificação final e pontos por fase dos circuitos
    circuitDirectory.mjs # campos leves, normalização e consultas da listagem de circuitos
    circuitRankingSettings.mjs # pontos, desempates e inclusões manuais dos circuitos
    courtNumbers.mjs  # numeração e apresentação lógica das quadras
    cupBracketConstruction.mjs # planos fixos, preliminares e BYEs visuais das Copas
    cupGroups.mjs # nomes de equipes, formação dos grupos e seus confrontos internos
    cupFormat.mjs # identificação dos formatos e das disputas paralelas habilitadas
    cupGroupRanking.mjs # cálculo completo das tabelas da fase de grupos
    cupGroupSchedule.mjs # geração preservada das partidas da fase de grupos
    cupQualification.mjs # classificados das Copas atuais e compatibilidade das antigas
    gameParticipants.mjs # identidade interna dos participantes nos jogos
    groupRankingRules.mjs # desempates dentro dos grupos e ordens persistidas de sorteio
    matchTimer.mjs    # estado e duração dos cronômetros das partidas
    modalityCatalog.mjs # nomes, descrições e agrupamentos do seletor de modalidades
    modalityClassification.mjs # identificação dos tipos de modalidade
    modalitySettings.mjs # leitura das quantidades escolhidas de participantes e quadras
    participantAttendance.mjs # normalização e leitura da presença já salva
    participantNames.mjs # formatação compatível dos nomes dos participantes
    playRankingBracket.mjs # entrada dos melhores eliminados na disputa paralela
    rankingCalculation.mjs # soma e ordenação da tabela dos jogos comuns
    rankingCriteria.mjs # opções e apresentação dos critérios de ranking
    rankingPagination.mjs # divisão dos rankings entre imagens e páginas
    scheduleGeneration.mjs # todos contra todos, sorteio de listas e equilíbrio das quadras lógicas
    scheduleTemplates.mjs # tabelas fixas existentes de confrontos por modalidade
    scoreRules.mjs    # validação de placares e identificação do vencedor
    sunsetBracket.mjs # paralelas e confronto final entre campeões da Copa Sunset
    tournamentRanking.mjs # cálculo do ranking diário e acumulado por torneio
  services/
    latestEntitySignalProcessor.mjs # reúne sinais repetidos da mesma entidade antes da reconciliação
    userAppStateCloudQueue.mjs # controla deduplicação e frequência do estado de navegação na nuvem
  main.jsx            # composição atual da aplicação, reduzida por etapas
```

Os módulos em `domain/` podem ser testados diretamente, sem extrair trechos de texto de `main.jsx`. A pasta `features/` começou a receber componentes e utilitários visuais que mantêm a mesma interface utilizada pela aplicação.

## Próximas fronteiras seguras

1. Compartilhamento de rankings separado em componente, geração/entrega de arquivos e ferramentas comuns de canvas.
2. Central visual dos torneios abertos separada com suas versões para computador e celular.
3. Interface da Central de Quadras separada, mantendo normalização e persistência fornecidas pela aplicação.
4. Seletor visual das modalidades separado, ainda consumindo o catálogo único de domínio.
5. Gestão visual dos participantes separada, preservando os mesmos dados e ações recebidos da tela do torneio.
6. Demais normalizações de participantes; a formatação compatível dos nomes já foi separada.
7. Controles visuais das partidas separados; os cálculos e callbacks operacionais continuam na tela do torneio.
8. Cartão universal e composição visual das rodadas separados, ainda recebendo as ações operacionais da tela.
9. Tabelas visuais de ranking separadas, mantendo cálculo, critérios e ordenação nos módulos de domínio.
10. Painéis de desempate e classificação visual dos grupos separados, sem mover a definição das regras.
11. Apresentação interna e pública das chaves eliminatórias separada, mantendo geração, progressão, placares e persistência na tela e no domínio atuais.
12. Painéis visuais de configuração dos formatos separados; configurações matemáticas, catálogo e classificadores continuam no domínio e na composição principal.
13. Geração de rodadas e confrontos.
14. Demais cálculos dos circuitos; painéis visuais, configurações de domínio, colocações e agregação final já foram separados.
15. Outros componentes visuais reutilizáveis; entrada, marca e suporte já foram separados.
16. Serviços de torneios, circuitos, perfis e páginas públicas.
17. Autenticação, sincronização e persistência por último.

Cada fronteira deve permanecer compatível com os dados já salvos antes de avançar para a próxima.
