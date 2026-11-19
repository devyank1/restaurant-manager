// Regras puras da central de alertas do gerente. Os textos dizem a situação,
// nunca julgam a pessoa, e não há ranking.
import { MESAS_A_MAIS } from './cuidado';
import { FATOR_ESQUECIDO, FOLGA_NO_TEMPO } from './pedidos-estacao';

export type TipoAlerta =
  | 'MESA_SEM_ATENDIMENTO'
  | 'CHAMADO_SEM_RESPOSTA'
  | 'PEDIDO_ATRASADO'
  | 'PEDIDO_ESQUECIDO'
  | 'FILA_ACUMULADA'
  | 'GARCOM_CARGA_ALTA'
  | 'GARCOM_SEM_PAUSA'
  | 'ESTOQUE_CRITICO'
  | 'MOVIMENTO_ALTO'
  | 'SEM_GARCOM'
  | 'CHAMADO_PARA_TODOS';

export type Gravidade = 'ALTA' | 'MEDIA' | 'BAIXA';

export type AlertaBruto = {
  /** `tipo:alvo`, estável entre execuções. */
  chave: string;
  tipo: TipoAlerta;
  gravidade: Gravidade;
  titulo: string;
  detalhe: string;
  /** null = usar a primeira vez em que foi visto. */
  desde: Date | null;
  link: string | null;
};

/** Minutos, pedidos na fila, ou percentual (MOVIMENTO_ALTO). */
export type LimitesAlerta = Record<
  TipoAlerta,
  { ativo: boolean; valor: number | null }
>;

export const LIMITES_PADRAO: LimitesAlerta = {
  MESA_SEM_ATENDIMENTO: { ativo: true, valor: 10 },
  CHAMADO_SEM_RESPOSTA: { ativo: true, valor: 3 },
  PEDIDO_ATRASADO: { ativo: true, valor: null },
  PEDIDO_ESQUECIDO: { ativo: true, valor: null },
  FILA_ACUMULADA: { ativo: true, valor: 6 },
  GARCOM_CARGA_ALTA: { ativo: true, valor: null },
  GARCOM_SEM_PAUSA: { ativo: true, valor: null },
  ESTOQUE_CRITICO: { ativo: true, valor: null },
  MOVIMENTO_ALTO: { ativo: true, valor: 140 },
  SEM_GARCOM: { ativo: true, valor: null },
  CHAMADO_PARA_TODOS: { ativo: true, valor: null },
};

export type EntradaAlertas = {
  agora: Date;
  /** Só sessões abertas. */
  mesas: {
    sessaoId: string;
    numero: number;
    ultimaAtividade: Date;
    temProblemaMaior: boolean;
  }[];
  /** Só chamados abertos. */
  chamados: {
    id: string;
    mesa: number;
    garcomId: string | null;
    paraTodos: boolean;
    criadoEm: Date;
  }[];
  /** Pedidos (rodada, estação) ainda não prontos. */
  pedidos: {
    rodadaId: string;
    estacao: string;
    mesa: number;
    confirmadaEm: Date;
    esperadoMin: number;
  }[];
  filas: { estacao: string; naFila: number }[];
  /** Garçons em turno. */
  garcons: {
    id: string;
    nome: string;
    emTurnoDesde: Date | null;
    mesasAbertas: number;
    chamadosPendentes: number;
  }[];
  horasSemPausa: number;
  estoqueCritico: { id: string; nome: string; zerado: boolean }[];
  movimento: {
    ultimaHora: number;
    mediaHistorica: number | null;
    semanasComDados: number;
  };
  mesasAbertasTotal: number;
};

const MIN_MS = 60_000;
const HORA_MS = 3_600_000;

const minutosDesde = (de: Date, agora: Date) =>
  (agora.getTime() - de.getTime()) / MIN_MS;

const plural = (n: number, um: string, varios: string) =>
  `${n} ${n === 1 ? um : varios}`;

type Regra = (e: EntradaAlertas, valor: number | null) => AlertaBruto[];

function mesasSemAtendimento(e: EntradaAlertas, valor: number | null) {
  const limite = valor ?? 10;
  return e.mesas
    .filter(
      (m) =>
        !m.temProblemaMaior &&
        minutosDesde(m.ultimaAtividade, e.agora) > limite,
    )
    .map((m): AlertaBruto => ({
      chave: `MESA_SEM_ATENDIMENTO:${m.sessaoId}`,
      tipo: 'MESA_SEM_ATENDIMENTO',
      gravidade: 'MEDIA',
      titulo: `Mesa ${m.numero} sem atividade`,
      detalhe: `Mesa ${m.numero} está há ${Math.floor(minutosDesde(m.ultimaAtividade, e.agora))} min sem movimento`,
      desde: m.ultimaAtividade,
      link: null,
    }));
}

function chamadosSemResposta(e: EntradaAlertas, valor: number | null) {
  const limite = valor ?? 3;
  return e.chamados
    .filter((c) => !c.paraTodos && minutosDesde(c.criadoEm, e.agora) > limite)
    .map((c): AlertaBruto => ({
      chave: `CHAMADO_SEM_RESPOSTA:${c.id}`,
      tipo: 'CHAMADO_SEM_RESPOSTA',
      gravidade: 'ALTA',
      titulo: `Chamado da mesa ${c.mesa} sem resposta`,
      detalhe: `A mesa ${c.mesa} chamou há ${Math.floor(minutosDesde(c.criadoEm, e.agora))} min e o chamado segue aberto`,
      desde: c.criadoEm,
      link: null,
    }));
}

function chamadosParaTodos(e: EntradaAlertas) {
  return e.chamados
    .filter((c) => c.paraTodos && minutosDesde(c.criadoEm, e.agora) > 3)
    .map((c): AlertaBruto => ({
      chave: `CHAMADO_PARA_TODOS:${c.id}`,
      tipo: 'CHAMADO_PARA_TODOS',
      gravidade: 'ALTA',
      titulo: `Chamado da mesa ${c.mesa} para todos`,
      detalhe: `A mesa ${c.mesa} chamou a equipe há ${Math.floor(minutosDesde(c.criadoEm, e.agora))} min e ninguém assumiu`,
      desde: c.criadoEm,
      link: null,
    }));
}

/** Esquecido (passou de esperado × 2) substitui o atrasado. */
function pedidos(e: EntradaAlertas, limites: LimitesAlerta) {
  const alertas: AlertaBruto[] = [];
  for (const p of e.pedidos) {
    const minutos = minutosDesde(p.confirmadaEm, e.agora);
    const alvo = `${p.rodadaId}:${p.estacao}`;
    if (minutos > p.esperadoMin * FATOR_ESQUECIDO) {
      if (!limites.PEDIDO_ESQUECIDO.ativo) continue;
      alertas.push({
        chave: `PEDIDO_ESQUECIDO:${alvo}`,
        tipo: 'PEDIDO_ESQUECIDO',
        gravidade: 'ALTA',
        titulo: `Pedido da mesa ${p.mesa} parado em ${p.estacao}`,
        detalhe: `Pedido da mesa ${p.mesa} em ${p.estacao}: ${Math.floor(minutos)} min de espera, esperado ${p.esperadoMin} min`,
        desde: new Date(
          p.confirmadaEm.getTime() + p.esperadoMin * FATOR_ESQUECIDO * MIN_MS,
        ),
        link: null,
      });
    } else if (
      minutos > p.esperadoMin * FOLGA_NO_TEMPO &&
      limites.PEDIDO_ATRASADO.ativo
    ) {
      alertas.push({
        chave: `PEDIDO_ATRASADO:${alvo}`,
        tipo: 'PEDIDO_ATRASADO',
        gravidade: 'MEDIA',
        titulo: `Pedido da mesa ${p.mesa} atrasado em ${p.estacao}`,
        detalhe: `Pedido da mesa ${p.mesa} em ${p.estacao}: ${Math.floor(minutos)} min de espera, esperado ${p.esperadoMin} min`,
        desde: new Date(
          p.confirmadaEm.getTime() + p.esperadoMin * FOLGA_NO_TEMPO * MIN_MS,
        ),
        link: null,
      });
    }
  }
  return alertas;
}

function filasAcumuladas(e: EntradaAlertas, valor: number | null) {
  const limite = valor ?? 6;
  return e.filas
    .filter((f) => f.naFila > limite)
    .map((f): AlertaBruto => ({
      chave: `FILA_ACUMULADA:${f.estacao}`,
      tipo: 'FILA_ACUMULADA',
      gravidade: 'MEDIA',
      titulo: `Fila acumulada em ${f.estacao}`,
      detalhe: `${f.estacao} tem ${plural(f.naFila, 'pedido', 'pedidos')} na fila`,
      desde: null,
      link: null,
    }));
}

function garconsCargaAlta(e: EntradaAlertas) {
  if (e.garcons.length < 2) return [];
  return e.garcons
    .filter((g) => {
      const colegas = e.garcons.filter((o) => o.id !== g.id);
      const media =
        colegas.reduce((soma, o) => soma + o.mesasAbertas, 0) / colegas.length;
      return g.mesasAbertas > media + MESAS_A_MAIS;
    })
    .map((g): AlertaBruto => ({
      chave: `GARCOM_CARGA_ALTA:${g.id}`,
      tipo: 'GARCOM_CARGA_ALTA',
      gravidade: 'MEDIA',
      titulo: `Carga alta no salão: ${g.nome}`,
      detalhe: `${g.nome}: ${plural(g.mesasAbertas, 'mesa aberta', 'mesas abertas')}, ${plural(g.chamadosPendentes, 'chamado pendente', 'chamados pendentes')}`,
      desde: null,
      link: `/central/garcom/${g.id}`,
    }));
}

function garconsSemPausa(e: EntradaAlertas) {
  const alertas: AlertaBruto[] = [];
  for (const g of e.garcons) {
    if (!g.emTurnoDesde) continue;
    const h = Math.floor(
      (e.agora.getTime() - g.emTurnoDesde.getTime()) / HORA_MS,
    );
    if (h < e.horasSemPausa) continue;
    alertas.push({
      chave: `GARCOM_SEM_PAUSA:${g.id}`,
      tipo: 'GARCOM_SEM_PAUSA',
      gravidade: 'BAIXA',
      titulo: `${g.nome} há ${h} h em turno`,
      detalhe: `${g.nome} está há ${h} h em turno sem pausa`,
      desde: g.emTurnoDesde,
      link: `/central/garcom/${g.id}`,
    });
  }
  return alertas;
}

function estoqueCritico(e: EntradaAlertas) {
  if (e.estoqueCritico.length === 0) return [];
  const zerados = e.estoqueCritico.filter((i) => i.zerado).length;
  const nomes = e.estoqueCritico.map((i) => i.nome).join(', ');
  return [
    {
      chave: 'ESTOQUE_CRITICO',
      tipo: 'ESTOQUE_CRITICO',
      gravidade: zerados > 0 ? 'ALTA' : 'MEDIA',
      titulo: `Estoque crítico: ${plural(e.estoqueCritico.length, 'item', 'itens')}`,
      detalhe:
        zerados > 0
          ? `${plural(zerados, 'item zerado', 'itens zerados')}. Em nível crítico: ${nomes}`
          : `Em nível crítico: ${nomes}`,
      desde: null,
      link: null,
    } satisfies AlertaBruto,
  ];
}

function movimentoAlto(e: EntradaAlertas, valor: number | null) {
  const { ultimaHora, mediaHistorica, semanasComDados } = e.movimento;
  if (semanasComDados <= 0 || mediaHistorica === null || mediaHistorica <= 0) {
    return [];
  }
  const pct = (100 * ultimaHora) / mediaHistorica;
  if (pct < (valor ?? 140)) return [];
  return [
    {
      chave: 'MOVIMENTO_ALTO',
      tipo: 'MOVIMENTO_ALTO',
      gravidade: 'BAIXA',
      titulo: 'Movimento acima do habitual',
      detalhe: `${plural(ultimaHora, 'pedido', 'pedidos')} na última hora, contra média de ${Math.round(mediaHistorica)} nesse horário`,
      desde: null,
      link: null,
    } satisfies AlertaBruto,
  ];
}

function semGarcom(e: EntradaAlertas) {
  if (e.garcons.length > 0 || e.mesasAbertasTotal <= 0) return [];
  return [
    {
      chave: 'SEM_GARCOM',
      tipo: 'SEM_GARCOM',
      gravidade: 'ALTA',
      titulo: 'Mesas abertas sem garçom em turno',
      detalhe: `${plural(e.mesasAbertasTotal, 'mesa aberta', 'mesas abertas')} e nenhum garçom em turno`,
      desde: null,
      link: null,
    } satisfies AlertaBruto,
  ];
}

export function calcularAlertas(
  entrada: EntradaAlertas,
  limites: LimitesAlerta,
): AlertaBruto[] {
  const regras: [TipoAlerta[], Regra][] = [
    [['MESA_SEM_ATENDIMENTO'], (e, v) => mesasSemAtendimento(e, v)],
    [['CHAMADO_SEM_RESPOSTA'], (e, v) => chamadosSemResposta(e, v)],
    [['CHAMADO_PARA_TODOS'], (e) => chamadosParaTodos(e)],
    [['FILA_ACUMULADA'], (e, v) => filasAcumuladas(e, v)],
    [['GARCOM_CARGA_ALTA'], (e) => garconsCargaAlta(e)],
    [['GARCOM_SEM_PAUSA'], (e) => garconsSemPausa(e)],
    [['ESTOQUE_CRITICO'], (e) => estoqueCritico(e)],
    [['MOVIMENTO_ALTO'], (e, v) => movimentoAlto(e, v)],
    [['SEM_GARCOM'], (e) => semGarcom(e)],
  ];
  const alertas: AlertaBruto[] = [];
  for (const [[tipo], regra] of regras) {
    const limite = limites[tipo];
    if (limite.ativo) alertas.push(...regra(entrada, limite.valor));
  }
  alertas.push(...pedidos(entrada, limites));
  return alertas;
}
