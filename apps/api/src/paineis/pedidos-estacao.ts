// Pedido = (rodada, estação). No tempo: pronto até esperado × 1,10.
// Esquecido: passou de esperado × 2 [spec §4.1].

export const FOLGA_NO_TEMPO = 1.1;
export const FATOR_ESQUECIDO = 2;

export type ItemMedido = {
  rodadaId: string;
  estacao: string;
  confirmadaEm: Date;
  tempoEsperadoMin: number;
  prontoEm: Date | null;
  mesa: number;
};

export type MedidaEstacao = {
  estacao: string;
  pedidos: number;
  /** Prontos + em andamento que já passaram do prazo. */
  avaliados: number;
  noTempo: number;
  noTempoPct: number | null;
  mediaMin: number | null;
  esquecidos: { rodadaId: string; mesa: number; minutos: number }[];
};

type Pedido = {
  rodadaId: string;
  mesa: number;
  confirmadaEm: Date;
  esperadoMin: number;
  /** null = algum item ainda não ficou pronto. */
  prontoEm: Date | null;
};

const MIN_MS = 60_000;

export function medirPedidos(
  itens: ItemMedido[],
  agora: Date,
): MedidaEstacao[] {
  const porEstacao = new Map<string, Map<string, Pedido>>();
  for (const i of itens) {
    const pedidos = porEstacao.get(i.estacao) ?? new Map<string, Pedido>();
    porEstacao.set(i.estacao, pedidos);
    const p = pedidos.get(i.rodadaId);
    if (!p) {
      pedidos.set(i.rodadaId, {
        rodadaId: i.rodadaId,
        mesa: i.mesa,
        confirmadaEm: i.confirmadaEm,
        esperadoMin: i.tempoEsperadoMin,
        prontoEm: i.prontoEm,
      });
      continue;
    }
    p.esperadoMin = Math.max(p.esperadoMin, i.tempoEsperadoMin);
    p.prontoEm =
      p.prontoEm && i.prontoEm
        ? new Date(Math.max(p.prontoEm.getTime(), i.prontoEm.getTime()))
        : null;
  }

  return [...porEstacao.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([estacao, mapa]) => medir(estacao, [...mapa.values()], agora));
}

function medir(estacao: string, pedidos: Pedido[], agora: Date): MedidaEstacao {
  let avaliados = 0;
  let noTempo = 0;
  const duracoesProntos: number[] = [];
  const esquecidos: MedidaEstacao['esquecidos'] = [];
  for (const p of pedidos) {
    const fim = p.prontoEm ?? agora;
    const minutos = (fim.getTime() - p.confirmadaEm.getTime()) / MIN_MS;
    const prazo = p.esperadoMin * FOLGA_NO_TEMPO;
    if (p.prontoEm) {
      duracoesProntos.push(minutos);
      avaliados += 1;
      if (minutos <= prazo) noTempo += 1;
    } else if (minutos > prazo) {
      avaliados += 1;
    }
    if (minutos > p.esperadoMin * FATOR_ESQUECIDO) {
      esquecidos.push({
        rodadaId: p.rodadaId,
        mesa: p.mesa,
        minutos: Math.floor(minutos),
      });
    }
  }
  const media =
    duracoesProntos.length > 0
      ? Math.round(
          duracoesProntos.reduce((a, b) => a + b, 0) / duracoesProntos.length,
        )
      : null;
  return {
    estacao,
    pedidos: pedidos.length,
    avaliados,
    noTempo,
    noTempoPct: avaliados > 0 ? Math.round((100 * noTempo) / avaliados) : null,
    mediaMin: media,
    esquecidos,
  };
}
