# Central de alertas do gerente — design

Data: 2026-11-18. Base: branch `deploy` (a `main` está desatualizada). Status: aguardando aprovação.

## Intenção e por quê

Quando o gerente abre o painel durante o turno, precisa saber em menos de um minuto duas coisas: **quem está sobrecarregado** e **se algo está errado no restaurante agora**. Hoje o `PainelEquipe` mostra números do período (faturamento, barras por hora, % no tempo), mas não diz o que exige ação nem compara com o normal da casa.

A Central de alertas é uma tela ao vivo, guiada por exceção: no topo, uma lista curta do que foge do normal, em ordem de gravidade; abaixo, cartões de carga por pessoa e por estação (visão grupo e individual).

## Objetivos

- Lista de alertas ao vivo, ordenada por gravidade, cada alerta com um link para o detalhe (a mesa, a pessoa ou a estação).
- Cartões de **carga** por garçom e por estação, com indicador de carga.
- Contexto: faturamento, ticket médio e linha de pedidos por hora de hoje contra a média do mesmo dia da semana (últimas 4 semanas).
- Limites configuráveis pelo dono, com padrões sensatos.
- Atualização por tempo real, no padrão existente (aviso por socket e refetch por REST).

## Não objetivos

- Tela de análise histórica com filtros e comparação de períodos (fica para depois, como "Análise").
- Ranking, pódio, "quem vendeu mais" e cor vermelha de "atrasado" para o desempenho de alguém. A spec de metas (`2026-11-09-estoque-e-metas-design.md`) proíbe isso. Carga e cuidado não são desempenho.
- Notificação push para o gerente. Fica para uma segunda fase se o dono pedir (a pergunta sobre isso ficou sem resposta).
- Alterar o que garçom e cozinha veem nos seus próprios painéis.

## Antiobjetivos (seria falha mesmo que funcione)

- Alarme falso constante: se o gerente aprende a ignorar a lista, o painel falhou. Cada alerta tem limite e tempo mínimo antes de aparecer.
- Painel que vira ferramenta de vigilância sobre garçom. O texto dos alertas fala de situação ("7 mesas abertas"), nunca julga a pessoa.

## Restrições

- Monorepo existente: NestJS + Prisma na API, React + Vite no app da equipe, `@cardapio/opcoes` compartilhado.
- Só `DONO` acessa (`exigirDono`). Tudo filtrado por `restauranteId`.
- Reaproveitar `PaineisService`, `avisosDeCuidado`, `medirPedidos`, `TurnoEquipe`, `TempoRealService.paraEquipe` e o hook `useEquipeAoVivo`.
- Dia de serviço segue `inicioDoDiaDeServico`.

## Abordagens consideradas

- **A. Central de alertas** (escolhida, com B embutido): lista por exceção com regras e limites.
- **B. Mapa de carga por pessoa e estação:** visual, mas não diz o que fazer e deixa de fora mesa esquecida e estoque. Entra como a segunda parte da tela.
- **C. Painel de análise com tendências:** não responde "o que está errado agora" e precisa de histórico. Fica fora desta entrega.

O dono escolheu "A com B embutido".

## Desenho

### Alertas (cada um com gravidade ALTA, MÉDIA ou BAIXA)

Todos calculados no servidor, a partir de dados que já existem. Os limites abaixo são padrões [minha escolha] e ficam configuráveis.

| Alerta | Condição (padrão) | Gravidade |
|---|---|---|
| Mesa sem atendimento | Mesa com sessão aberta, sem chamado respondido e sem pedido novo há mais de 10 min | MÉDIA |
| Chamado sem resposta | Chamado ABERTO há mais de 3 min (já é o limite de `CHAMADO_DEMORADO_SEG`) | ALTA |
| Pedido atrasado | Pedido (rodada, estação) além de esperado × 1,10, ainda não pronto | MÉDIA |
| Pedido esquecido | Pedido além de esperado × 2 (`FATOR_ESQUECIDO`) | ALTA |
| Fila acumulada | Estação com mais de N pedidos NA_FILA (N=6) | MÉDIA |
| Garçom com carga alta | Mesas abertas do garçom acima da média dos colegas em turno + 3 (`MESAS_A_MAIS`) e chamados pendentes | MÉDIA |
| Garçom sem pausa | Horas em turno sem pausa acima do limite (padrão 4 h, já existe) | BAIXA |
| Estoque crítico | Item de estoque em nível crítico (usa os alertas de estoque existentes) | MÉDIA |
| Movimento fora do normal | Pedidos da última hora ≥ 1,4 × a média do mesmo dia e hora nas últimas 4 semanas | BAIXA |
| Sem garçom em turno | Há mesas abertas e nenhum garçom em turno | ALTA |

Regras:
- Um alerta só aparece depois que a condição se mantém por 1 minuto (evita piscar).
- Um alerta some sozinho quando a condição acaba.
- Alertas ordenados por gravidade e depois por há quanto tempo duram.
- Sem alertas, a tela diz "Tudo certo agora" com a hora da última verificação.

### Carga (parte B)

- **Garçom:** carga = mesas abertas + chamados pendentes × 2 [minha escolha, ajustável]. Mostrada como uma barra neutra (azul), em três faixas de texto: "tranquilo", "cheio" e "sobrecarregado", em relação à média dos colegas em turno. Sem vermelho; sem ordenar por desempenho. A ordem dos cartões é alfabética.
- **Estação:** carga = pedidos NA_FILA + EM_PREPARO, com o tempo do pedido mais antigo.
- Visão **grupo:** soma da equipe e média. Visão **individual:** toque no cartão abre o detalhe (mesas da pessoa, chamados pendentes, horas em turno).

### Contexto

- Faturamento e ticket médio do dia (já calculados).
- Linha de pedidos por hora de hoje contra a linha da média do mesmo dia da semana (4 semanas). Primeiro gráfico de linha do app, em SVG simples, sem biblioteca nova.

### API

- `GET equipe/painel/central`: devolve `{ alertas, cargaGarcons, cargaEstacoes, contexto }`. Só dono.
- `GET/PUT equipe/painel/central/limites`: lê e grava os limites. Guardados em uma tabela nova `LimiteAlerta` (restauranteId, tipo, valor) com padrões no código quando não há linha.
- Cálculo em módulo puro e testável (`paineis/alertas.ts`), no estilo de `cuidado.ts` e `pedidos-estacao.ts`.
- Tempo real: reutilizar os eventos que já chegam à equipe e acrescentar um aviso `central.mudou`; o cliente refaz o GET. Além disso, uma verificação periódica no servidor (a cada 30 s) emite o aviso quando o conjunto de alertas muda, porque alertas por tempo (ex.: "há mais de 10 min") não são causados por um evento.

### App da equipe

- Nova rota "Central" como a home do dono (substituindo a posição do painel atual, que continua disponível como "Detalhes do dia").
- Topo: alertas. Meio: cartões de carga (garçons e estações). Fim: contexto.
- Tela de limites dentro de "Metas" ou numa tela própria (decisão do construtor).
- Mobile primeiro, já que o gerente usa o celular.

## O que fica para o construtor

- Nomes e textos exatos dos alertas.
- Ajuste fino dos padrões depois de ver dados da demo (`dashboards demo data` já existe).
- Se os alertas "Mesa sem atendimento" e "Sem garçom em turno" usam uma tabela de estado ou são recalculados a cada requisição.
- Posição da tela de limites.

## Decisões que são minhas (não foram confirmadas pelo dono)

- Lista de tipos de alerta e todos os limites padrão.
- Fórmula de carga (mesas abertas + chamados × 2).
- Estabilização de 1 minuto e verificação a cada 30 s.
- Sem push na primeira entrega.
- Trabalhar a partir da branch `deploy`, não da `main`.

## Esclarecimentos da revisão (minhas decisões, marcadas como tais)

- **Base:** este worktree está na `deploy` (`ea9e880`). `CHAMADO_DEMORADO_SEG`, `FATOR_ESQUECIDO`, `medirPedidos`, `horasSemPausa` (configurável) e os níveis de estoque existem aqui. Há também um agendador com `setInterval` em `chamados/chamados-agendador.ts`, que serve de modelo para a verificação de 30 s; não precisa de `@nestjs/schedule`.
- **Mesa sem atendimento:** só sessões ABERTAS. O relógio parte da última atividade (o maior entre abertura, último pedido e último chamado resolvido). Se a mesa já tem um pedido esquecido ou chamado sem resposta, o alerta de mesa é omitido para não duplicar.
- **Tempo esperado:** é `ItemRodada.tempoEsperadoMin`, congelado na criação do item; o pedido usa o maior dos itens da estação (como em `pedidos-estacao.ts`). "Esquecido" (ALTA) substitui "atrasado" (MÉDIA) para o mesmo pedido.
- **Estabilização e duração:** estado em memória por restaurante (mapa tipo+alvo → primeira vez vista). Assume uma instância da API. Se reiniciar, a contagem recomeça, e isso é aceitável. Alertas sem horário próprio usam a primeira vez vista.
- **Garçom em turno e pausa:** vêm de `TurnoEquipe`. A média dos colegas exclui a própria pessoa. Com um só garçom em turno, o alerta de carga alta fica desligado.
- **Movimento fora do normal:** exige pelo menos 10 pedidos na última hora e pelo menos 1 semana de histórico com movimento naquela hora; caso contrário, não alerta.
- **Limites:** um número por tipo de alerta (tabela `LimiteAlerta`), com chave para desligar o tipo. Multiplicadores e a margem de +3 continuam constantes no código.
- **Chamado pendente:** ABERTO atribuído ao garçom. Chamado "para todos" não entra na carga de ninguém e aparece como alerta próprio.
- **Rota da home do dono:** o construtor confere links, deep links de push e testes que apontam para a rota atual. O acesso é só `DONO`; o host "gerente" da `deploy` usa o mesmo papel.
