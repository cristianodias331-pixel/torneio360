# Perfil unificado — arquitetura de homologação

## Princípio

Uma conta representa uma pessoa. A mesma pessoa pode competir como atleta e administrar uma ou mais organizações. Ser organizador é uma capacidade adicional liberada pela assinatura, não uma identidade que substitui o atleta.

## Camadas

1. `member_profiles`: identidade pessoal única (nome, usuário, foto, capa, bio, localização e privacidade).
2. `profiles`: compatibilidade atual da organização/arena e do acesso contratado. Não deve ser usada como perfil pessoal novo.
3. `athlete_profiles`: compatibilidade temporária dos vínculos de atleta já existentes.
4. Torneios, circuitos, placares e rankings: permanecem inalterados nesta etapa.

O perfil pessoal pode ser privado enquanto a organização continua pública. Assim, também é possível manter somente a presença pública da arena.

## Próxima camada

Antes de permitir várias organizações por conta, criar entidades próprias de organização e vínculo:

- `organizations`: identidade pública e dados profissionais;
- `organization_memberships`: relação entre pessoas e organizações, com permissões;
- capacidades de conta: participar, organizar, administrar e receber pagamentos;
- histórico esportivo derivado dos vínculos já confirmados em torneios.

Essa evolução deve manter `user_id` e os registros atuais durante a transição. Nenhuma migração deve reescrever o JSON dos torneios ou recalcular resultados.

## Experiência móvel

O perfil usa uma hierarquia familiar a redes sociais: capa curta, foto circular sobreposta, nome de usuário, bio, localização, resumo e abas. A edição permanece separada da apresentação pública para reduzir erros e cliques acidentais.
