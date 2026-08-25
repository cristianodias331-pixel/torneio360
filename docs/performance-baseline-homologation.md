# Referência de desempenho da homologação

Data da medição: 25/08/2026

## Escopo

- Site: `torneio360-homologacao.vercel.app`
- Supabase: projeto exclusivo de homologação `vcixhzvytkrautotinpi`
- Versão da aplicação medida: commit `b2954d2`
- Tráfego somente de leitura nas rotas públicas.
- Cada rota foi aquecida antes da medição.
- O cenário de acesso inicial completo reproduz a abertura do perfil: resumo da arena seguido da primeira página de torneios ativos.

## 50 acessos simultâneos

| Cenário | Sucessos | Erros | p50 | p95 | Máximo |
| --- | ---: | ---: | ---: | ---: | ---: |
| Diretório público paginado | 50 | 0 | 648 ms | 669 ms | 674 ms |
| Resumo do perfil público | 50 | 0 | 874 ms | 1.217 ms | 1.232 ms |
| Página pública de eventos | 50 | 0 | 373 ms | 529 ms | 538 ms |
| Acesso inicial completo ao perfil | 50 | 0 | 1.328 ms | 1.568 ms | 1.607 ms |
| Checagem condicional de torneio | 50 | 0 | 137 ms | 150 ms | 150 ms |

## 100 acessos simultâneos

| Cenário | Sucessos | Erros | p50 | p95 | Máximo |
| --- | ---: | ---: | ---: | ---: | ---: |
| Diretório público paginado | 100 | 0 | 763 ms | 778 ms | 784 ms |
| Resumo do perfil público | 100 | 0 | 1.079 ms | 1.879 ms | 1.908 ms |
| Página pública de eventos | 100 | 0 | 663 ms | 961 ms | 989 ms |
| Acesso inicial completo ao perfil | 100 | 0 | 2.008 ms | 2.609 ms | 2.683 ms |
| Checagem condicional de torneio | 100 | 0 | 173 ms | 205 ms | 216 ms |

## Avaliação

- As 900 chamadas HTTP medidas terminaram sem erro.
- Todos os p95 ficaram abaixo dos limites definidos no teste.
- O fluxo inicial completo ficou abaixo de 1,6 segundo no p95 com 50 acessos e abaixo de 2,7 segundos com 100 acessos.
- Não foi identificado gargalo que exija nova alteração de banco ou consulta nesta etapa.

O p95 indica que 95% das medições terminaram naquele tempo ou mais rápido. Esta referência cobre o tráfego público de leitura; operações autenticadas de administração e renderização completa em navegadores reais devem ser avaliadas separadamente quando houver dados e usuários de homologação representativos.

## Como repetir

O utilitário `scripts/public-load-check.mjs` aceita `LOAD_CONCURRENCY` entre 1 e 200. As variáveis `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `EXPECTED_SUPABASE_PROJECT_REF` devem apontar explicitamente para a homologação antes da execução de `pnpm test:load:public`.
