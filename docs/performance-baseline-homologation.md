# Referência de desempenho da homologação

Data da medição: 25/08/2026

## Escopo

- Site: `torneio360-homologacao.vercel.app`
- Supabase: projeto exclusivo de homologação `vcixhzvytkrautotinpi`
- Branch medida: `codex/prepara-escala-torneio360`
- Tráfego somente de leitura nas rotas públicas.
- Cada rota foi aquecida antes da medição.
- O cenário de acesso inicial completo usa `get_public_arena_initial_view`: perfil, contadores e primeira página de torneios ativos em uma única chamada.
- Há 1,5 segundo de intervalo entre cenários independentes para que um pico não contamine artificialmente o cenário seguinte.

## 50 acessos simultâneos

| Cenário | Sucessos | Erros | p50 | p95 | Máximo |
| --- | ---: | ---: | ---: | ---: | ---: |
| Diretório público paginado | 50 | 0 | 628 ms | 689 ms | 700 ms |
| Resumo do perfil público | 50 | 0 | 903 ms | 1.420 ms | 1.463 ms |
| Página pública de eventos | 50 | 0 | 614 ms | 921 ms | 966 ms |
| Acesso inicial completo ao perfil | 50 | 0 | 1.191 ms | 1.656 ms | 1.714 ms |
| Checagem condicional de torneio | 50 | 0 | 156 ms | 184 ms | 197 ms |

## 100 acessos simultâneos

| Cenário | Sucessos | Erros | p50 | p95 | Máximo |
| --- | ---: | ---: | ---: | ---: | ---: |
| Diretório público paginado | 100 | 0 | 591 ms | 677 ms | 698 ms |
| Resumo do perfil público | 100 | 0 | 1.192 ms | 2.078 ms | 2.127 ms |
| Página pública de eventos | 100 | 0 | 1.018 ms | 1.687 ms | 1.701 ms |
| Acesso inicial completo ao perfil | 100 | 0 | 1.682 ms | 2.801 ms | 2.882 ms |
| Checagem condicional de torneio | 100 | 0 | 246 ms | 294 ms | 334 ms |

## Avaliação

- As 750 chamadas HTTP medidas nesta rodada terminaram sem erro.
- Todos os p95 ficaram abaixo dos limites definidos no teste.
- O fluxo inicial completo ficou em 1,66 segundo no p95 com 50 acessos e 2,80 segundos com 100 acessos.
- A meta aspiracional de 2 segundos não é constante durante um pico súbito de 100 aberturas. A rodada permaneceu abaixo de 3 segundos e sem erro; uma redução adicional passa a depender principalmente do plano/latência externa do Supabase ou de mudanças mais invasivas.
- A chamada combinada evita que cada abertura dispare duas requisições HTTP simultâneas e mantém fallback para bancos ainda sem a função nova.

O p95 indica que 95% das medições terminaram naquele tempo ou mais rápido. Esta referência cobre o tráfego público de leitura; operações autenticadas de administração e renderização completa em navegadores reais devem ser avaliadas separadamente quando houver dados e usuários de homologação representativos.

## Circuitos com rankings muito grandes

O laboratório foi ampliado para 200 torneios, 30 circuitos e 45.000 linhas de ranking — 1.500 nomes em cada circuito. O ranking público agora abre com 30 nomes, carrega as páginas seguintes sob demanda e pesquisa no conjunto completo sem perder a posição global. A exportação continua completa, mas só busca todas as páginas quando o visitante pede para compartilhar ou baixar.

O payload inicial do circuito medido caiu de aproximadamente 356.879 bytes para 24.923 bytes, redução de cerca de 93%. A integridade foi conferida percorrendo os 1.500 nomes em seis páginas de 250, sem repetição ou quebra de posição.

| Concorrência | Cenário | Sucessos | Erros | p50 | p95 | Payload médio |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 100 | Circuito público paginado | 100 | 0 | 563 ms | 867 ms | 24.923 bytes |
| 100 | Página de 30 nomes do ranking | 100 | 0 | 415 ms | 571 ms | 7.557 bytes |
| 200 | Circuito público paginado | 200 | 0 | 925 ms | 1.715 ms | 24.923 bytes |
| 200 | Página de 30 nomes do ranking | 200 | 0 | 509 ms | 734 ms | 7.557 bytes |

No navegador, a abertura mostrou `30 de 1500`, o carregamento adicional mostrou `60 de 1500` e a busca encontrou corretamente um nome na posição global 976. Em viewport de 390 × 844, a página não apresentou estouro horizontal; apenas a tabela manteve sua rolagem interna intencional.

## Carregamento inicial da interface

O commit `4676907` passou a carregar sob demanda as áreas pesadas de chaves, partidas, ranking, participantes, circuitos, diálogos, mídia e configurações. A alteração não modifica regras, placares, confrontos, persistência ou dados salvos.

| Pacote inicial | Antes | Depois | Redução |
| --- | ---: | ---: | ---: |
| JavaScript | 711,39 kB | 500,98 kB | 29,6% |
| JavaScript compactado | 185,97 kB | 130,83 kB | 29,7% |
| CSS | 672,52 kB | 672,53 kB | sem alteração relevante |
| CSS compactado | 102,54 kB | 102,80 kB | sem alteração relevante |

O CSS foi preservado nesta etapa porque a folha atual é fortemente compartilhada entre as telas. Dividi-la agora aumentaria o risco visual sem ganho significativo, já que sua transferência compactada está próxima de 103 kB. A validação local cobriu início, perfil público, torneio público, partidas, ranking, autenticação e largura móvel de 390 px, sem erro de carregamento.

## Painel autenticado com grande volume

O teste `scripts/organizer-scale-check.sql` executa tudo dentro de uma transação e termina obrigatoriamente com `rollback`. Foram simulados 1.000 torneios temporários com 40 participantes e 45 partidas cada, além de 250 circuitos. Nenhum registro sintético permaneceu no banco.

| Consulta autenticada | Linhas | Payload | Tempo no banco |
| --- | ---: | ---: | ---: |
| Resumo dos torneios | 1.005 | 940.523 bytes | 415,58 ms |
| Diretório de circuitos | 250 | 237.008 bytes | 8,05 ms |

O resultado comprova que a camada de consulta resumida do painel permanece leve mesmo com um organizador muito carregado. Ele não representa o tempo de desenhar 1.000 cartões de uma vez; a interface continua dependendo da paginação e do carregamento sob demanda já implementados.

## Experiência percebida no navegador

A medição foi feita em Chrome headless novo, sem sessão ou cache anterior, no perfil público da homologação. Ela não abriu abas visíveis.

| Dispositivo | Perfil visível | DOM carregado | LCP | CLS | Requisições | Transferência |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Computador (1440 × 900) | 5.769 ms | 579 ms | 1.120 ms | 0 | 19 | 7.486 kB |
| Celular (390 × 844, escala 2×) | 5.958 ms | 625 ms | 1.132 ms | 0 | 18 | 7.637 kB |

O conteúdo e a maior pintura aparecem rapidamente, mas o perfil só é liberado depois do tempo mínimo intencional de 5 segundos do vídeo de abertura. Esse vídeo também responde pela maior parte dos cerca de 7,5 MB transferidos. Remover ou encurtar essa apresentação é uma decisão visual separada e não foi feita nesta fase.

## Como repetir

O utilitário `scripts/public-load-check.mjs` aceita `LOAD_CONCURRENCY` entre 1 e 200. As variáveis `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `EXPECTED_SUPABASE_PROJECT_REF` devem apontar explicitamente para a homologação antes da execução de `pnpm test:load:public`.

Para conferir todas as páginas, posições e busca de um circuito grande, execute `pnpm test:pagination:circuit` com as mesmas variáveis e, opcionalmente, `LOAD_ARENA_ID`.

Para repetir a medição de navegador sem abrir uma janela, defina `PERFORMANCE_URL` e, opcionalmente, `PERFORMANCE_DEVICE=mobile`, antes de executar `pnpm test:browser:public`.
