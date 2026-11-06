// Regras de preço do servidor. Espelham apps/cliente/src/preco/preco.ts
// (mesmos casos de teste): o cliente mostra, o servidor cobra.
import { TipoGrupoOpcao } from '@prisma/client';

/** Opções escolhidas: id do grupo → ids das opções. */
export type Selecao = Record<string, string[]>;

type OpcaoComPreco = {
  id: string;
  nome: string;
  precoCentavos: number;
  precoPromocionalCentavos: number | null;
};

type GrupoComOpcoes = {
  id: string;
  nome: string;
  tipo: TipoGrupoOpcao;
  obrigatorio: boolean;
  min: number;
  max: number;
  opcoes: OpcaoComPreco[];
};

export type PratoComGrupos = {
  nome: string;
  precoCentavos: number;
  precoPromocionalCentavos: number | null;
  grupos: GrupoComOpcoes[];
};

// Promoção só vale se for maior que zero e menor que o preço.
function precoEfetivo(base: number, promo: number | null): number {
  return promo !== null && promo > 0 && promo < base ? promo : base;
}

// Escolha única com preço (Tamanho) define o preço; sem preço (Ponto) não.
function definePreco(grupo: GrupoComOpcoes): boolean {
  return (
    grupo.tipo === 'UNICA' && grupo.opcoes.some((o) => o.precoCentavos > 0)
  );
}

function opcoesEscolhidas(grupo: GrupoComOpcoes, selecao: Selecao) {
  const ids = selecao[grupo.id] ?? [];
  return grupo.opcoes.filter((opcao) => ids.includes(opcao.id));
}

export function precoUnitario(prato: PratoComGrupos, selecao: Selecao): number {
  let base = precoEfetivo(prato.precoCentavos, prato.precoPromocionalCentavos);
  let maiorSabor = 0;
  let adicionais = 0;

  for (const grupo of prato.grupos) {
    const precos = opcoesEscolhidas(grupo, selecao).map((o) =>
      precoEfetivo(o.precoCentavos, o.precoPromocionalCentavos),
    );
    if (precos.length === 0) continue;

    if (definePreco(grupo)) base = precos[0];
    // Meio a meio cobra o sabor mais caro (regra "MAIOR" da spec).
    if (grupo.tipo === 'SABORES') maiorSabor = Math.max(...precos);
    if (grupo.tipo === 'MULTIPLA') {
      adicionais += precos.reduce((a, b) => a + b, 0);
    }
  }

  return base + maiorSabor + adicionais;
}

/** Lista de erros; vazia quando a seleção é válida. */
export function validarSelecao(
  prato: PratoComGrupos,
  selecao: Selecao,
): string[] {
  // O corpo pode vir adulterado: grupo ou opção alheia ao prato, ou repetida.
  const grupos = new Map(prato.grupos.map((g) => [g.id, g]));
  for (const [grupoId, ids] of Object.entries(selecao)) {
    const grupo = grupos.get(grupoId);
    const validos = new Set(grupo?.opcoes.map((o) => o.id));
    if (
      !grupo ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !validos.has(id))
    ) {
      return ['Opção inválida'];
    }
  }

  const erros: string[] = [];
  for (const grupo of prato.grupos) {
    const quantidade = (selecao[grupo.id] ?? []).length;
    const minimo = grupo.obrigatorio ? Math.max(grupo.min, 1) : grupo.min;
    if (quantidade < minimo) erros.push(`Escolha ${grupo.nome}`);
    else if (quantidade > grupo.max) {
      erros.push(`Escolha até ${grupo.max} em ${grupo.nome}`);
    }
  }
  return erros;
}

const SEPARADOR_OPCOES: Record<TipoGrupoOpcao, string> = {
  UNICA: ', ',
  MULTIPLA: ', ',
  SABORES: ' / ',
};

export function resumirOpcoes(prato: PratoComGrupos, selecao: Selecao): string {
  return prato.grupos
    .map((grupo) =>
      opcoesEscolhidas(grupo, selecao)
        .map((o) => o.nome)
        .join(SEPARADOR_OPCOES[grupo.tipo]),
    )
    .filter((parte) => parte.length > 0)
    .join(' · ');
}
