import { CandidatoGarcom, escolherGarcom } from './escolher-garcom';

const garcom = (
  id: string,
  mesasAbertas: number,
  mesasAtendidasNoTurno: number,
  ultimoChamadoEm: Date | null = null,
): CandidatoGarcom => ({
  id,
  mesasAbertas,
  mesasAtendidasNoTurno,
  ultimoChamadoEm,
});

const as = (hhmm: string) => new Date(`2026-11-06T${hhmm}:00Z`);

describe('escolherGarcom', () => {
  it('responsável em turno recebe', () => {
    const candidatos = [garcom('ana', 0, 0), garcom('bruno', 3, 5)];
    expect(escolherGarcom(candidatos, 'bruno', [])).toBe('bruno');
  });

  it('responsável excluído cai para a regra', () => {
    const candidatos = [garcom('ana', 0, 2), garcom('bruno', 3, 5)];
    expect(escolherGarcom(candidatos, 'bruno', ['bruno'])).toBe('ana');
  });

  it('responsável fora de turno cai para a regra', () => {
    const candidatos = [garcom('ana', 1, 2)];
    expect(escolherGarcom(candidatos, 'bruno', [])).toBe('ana');
  });

  it('livre ganha de ocupado', () => {
    const candidatos = [garcom('ana', 2, 0), garcom('bruno', 0, 9)];
    expect(escolherGarcom(candidatos, null, [])).toBe('bruno');
  });

  it('ninguém livre: quem atendeu menos', () => {
    const candidatos = [garcom('ana', 1, 4), garcom('bruno', 2, 3)];
    expect(escolherGarcom(candidatos, null, [])).toBe('bruno');
  });

  it('empate: quem está há mais tempo sem chamado (null primeiro)', () => {
    expect(
      escolherGarcom(
        [garcom('ana', 1, 3, as('20:10')), garcom('bruno', 1, 3, as('20:05'))],
        null,
        [],
      ),
    ).toBe('bruno');
    expect(
      escolherGarcom(
        [garcom('ana', 1, 3, as('20:05')), garcom('bruno', 1, 3, null)],
        null,
        [],
      ),
    ).toBe('bruno');
  });

  it('sem candidatos → null', () => {
    expect(escolherGarcom([], null, [])).toBeNull();
    expect(escolherGarcom([garcom('ana', 0, 0)], null, ['ana'])).toBeNull();
  });
});
