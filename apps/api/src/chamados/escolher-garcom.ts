/** Garçom em turno, com os números que a regra da spec §5.2 usa. */
export type CandidatoGarcom = {
  id: string;
  /** Sessões abertas em que ele é o responsável. */
  mesasAbertas: number;
  /** Sessões que ele assumiu desde que entrou em turno. */
  mesasAtendidasNoTurno: number;
  ultimoChamadoEm: Date | null;
};

const tempo = (data: Date | null) => data?.getTime() ?? -Infinity;

// Menos mesas atendidas no turno; empate → mais tempo sem chamado (null antes).
function melhor(a: CandidatoGarcom, b: CandidatoGarcom): number {
  return (
    a.mesasAtendidasNoTurno - b.mesasAtendidasNoTurno ||
    tempo(a.ultimoChamadoEm) - tempo(b.ultimoChamadoEm)
  );
}

/**
 * Escolhe quem recebe o chamado:
 * responsável da mesa → em turno e livre → quem atendeu menos no turno.
 * `candidatos` são só os garçons em turno. Sem ninguém → null.
 */
export function escolherGarcom(
  candidatos: CandidatoGarcom[],
  responsavelId: string | null,
  excluir: string[],
): string | null {
  const disponiveis = candidatos.filter((c) => !excluir.includes(c.id));
  if (responsavelId && disponiveis.some((c) => c.id === responsavelId)) {
    return responsavelId;
  }
  const livres = disponiveis.filter((c) => c.mesasAbertas === 0);
  const grupo = livres.length > 0 ? livres : disponiveis;
  return [...grupo].sort(melhor)[0]?.id ?? null;
}
