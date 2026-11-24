import type { MotivoPerda, UnidadeEstoque } from '@prisma/client';
import type { MedidaEstacao } from './pedidos-estacao';
import type { ProgressoMeta } from './progresso';

export type CartaoPessoa = {
  id: string;
  nome: string;
  emTurno: boolean;
  emTurnoDesde: string | null;
  /** Avisos de cuidado (pausa, mesas a mais). Nunca ranking. */
  avisos: string[];
  /** VALOR e/ou MESAS; alvo = ajuste ?? padrão; [] sem padrão. */
  metas: ProgressoMeta[];
  mesasHoje: number;
};

export type PainelEquipe = {
  periodo: 'DIA' | 'SEMANA';
  inicio: string;
  metaEquipe: ProgressoMeta[];
  pessoas: CartaoPessoa[];
  operacao: {
    faturamentoCentavos: number;
    contas: number;
    ticketMedioCentavos: number | null;
    porHora: { hora: number; rodadas: number }[];
    porDiaSemana: { dia: number; mediaRodadas: number }[];
    maisVendidos: { nome: string; quantidade: number }[];
    estacoes: MedidaEstacao[];
    chamadosDemorados: { quantidade: number; mediaRespostaSeg: number | null };
    perdasSemana: {
      item: string;
      unidade: UnidadeEstoque;
      quantidade: number;
      motivo: MotivoPerda | null;
    }[];
  };
};

export type PainelGarcom = { metaEquipe: ProgressoMeta[]; eu: CartaoPessoa };

export type PainelEstacao = {
  estacao: string;
  metaEquipe: ProgressoMeta[];
  metas: ProgressoMeta[];
  medida: MedidaEstacao;
};

/** Evento interno: alguém ligou ou desligou "Em turno". */
export const TURNO_MUDOU = 'equipe.turno-mudou';
export type TurnoMudou = { restauranteId: string };
