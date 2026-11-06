import type { ChamadoEquipe, MesaResumo } from '../api/tipos'

export function chamado(parcial: Partial<ChamadoEquipe> & { id: string }): ChamadoEquipe {
  return {
    tipo: 'ATENDENTE',
    status: 'ABERTO',
    mesa: { numero: 7, token: 'tok7' },
    criadoEm: new Date(Date.now() - 2 * 60_000).toISOString(),
    paraTodos: false,
    tentativas: 1,
    ...parcial,
  }
}

export const mesasDemo: MesaResumo[] = [
  { numero: 7, token: 'tok7', aberta: true, garcomNome: 'Ana', pendentes: 1 },
  { numero: 8, token: 'tok8', aberta: true, garcomNome: 'Bruno', pendentes: 0 },
  { numero: 9, token: 'tok9', aberta: false, garcomNome: null, pendentes: 0 },
]
