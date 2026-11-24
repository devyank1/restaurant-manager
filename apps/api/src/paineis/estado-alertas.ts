import type { AlertaBruto, Gravidade } from './alertas';

export type Alerta = Omit<AlertaBruto, 'desde'> & { desde: Date };

/** Tempo que uma condição precisa persistir antes de virar alerta. */
export const JANELA_ESTABILIZACAO_MS = 60_000;

const ORDEM: Record<Gravidade, number> = { ALTA: 0, MEDIA: 1, BAIXA: 2 };

type EstadoRestaurante = { vistos: Map<string, Date>; assinatura: string };

/**
 * Estabiliza alertas (só aparecem após 60 s seguidos) e detecta mudança do
 * conjunto visível. Estado em memória, por restaurante; `agora` é injetado.
 */
export class EstadoAlertas {
  private readonly porRestaurante = new Map<string, EstadoRestaurante>();

  atualizar(
    restauranteId: string,
    candidatos: AlertaBruto[],
    agora: Date,
  ): { visiveis: Alerta[]; mudou: boolean } {
    const anterior = this.porRestaurante.get(restauranteId);
    const vistos = new Map<string, Date>();
    const visiveis: Alerta[] = [];

    for (const c of candidatos) {
      const primeiraVez = anterior?.vistos.get(c.chave) ?? agora;
      vistos.set(c.chave, primeiraVez);
      if (agora.getTime() - primeiraVez.getTime() >= JANELA_ESTABILIZACAO_MS) {
        visiveis.push({ ...c, desde: c.desde ?? primeiraVez });
      }
    }

    visiveis.sort(
      (a, b) =>
        ORDEM[a.gravidade] - ORDEM[b.gravidade] ||
        a.desde.getTime() - b.desde.getTime(),
    );

    const assinatura = visiveis
      .map((a) => `${a.chave}:${a.gravidade}`)
      .sort()
      .join('|');
    const mudou = assinatura !== (anterior?.assinatura ?? '');
    this.porRestaurante.set(restauranteId, { vistos, assinatura });

    return { visiveis, mudou };
  }
}
