export type OpcaoPublica = {
  id: string;
  nome: string;
  precoCentavos: number;
  precoPromocionalCentavos: number | null;
};

export type GrupoOpcaoPublico = {
  id: string;
  nome: string;
  tipo: 'UNICA' | 'MULTIPLA' | 'SABORES';
  obrigatorio: boolean;
  min: number;
  max: number;
  opcoes: OpcaoPublica[];
};

export type PratoPublico = {
  id: string;
  nome: string;
  descricao: string;
  precoCentavos: number;
  precoPromocionalCentavos: number | null;
  destaque: boolean;
  esgotado: boolean;
  videoUrl: string | null;
  posterUrl: string | null;
  grupos: GrupoOpcaoPublico[];
};

export type CategoriaPublica = {
  id: string;
  nome: string;
  pratos: PratoPublico[];
};

export type CardapioPublico = {
  restaurante: {
    nome: string;
    logoUrl: string | null;
    googleAvaliacaoUrl: string | null;
    // null quando o restaurante não configurou o Wi-Fi.
    wifi: { ssid: string; senha: string | null } | null;
  };
  mesa: { numero: number };
  // Ordenadas por `ordem`; categorias sem pratos ficam de fora.
  categorias: CategoriaPublica[];
};
