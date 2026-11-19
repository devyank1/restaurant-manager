import type { Gravidade, TipoAlerta } from './alertas';
import type { FaixaCarga } from './carga';

export type CentralResposta = {
  verificadoEm: string;
  alertas: {
    chave: string;
    tipo: TipoAlerta;
    gravidade: Gravidade;
    titulo: string;
    detalhe: string;
    desde: string;
    link: string | null;
  }[];
  cargaGarcons: {
    id: string;
    nome: string;
    mesasAbertas: number;
    chamadosPendentes: number;
    carga: number;
    faixa: FaixaCarga;
    emTurnoDesde: string | null;
  }[];
  cargaEstacoes: {
    estacao: string;
    naFila: number;
    emPreparo: number;
    carga: number;
    maisAntigoMin: number | null;
  }[];
  grupo: {
    garconsEmTurno: number;
    cargaTotal: number;
    cargaMedia: number | null;
  };
  contexto: {
    faturamentoCentavos: number;
    ticketMedioCentavos: number | null;
    porHora: { hora: number; hoje: number; media: number }[];
  };
};
