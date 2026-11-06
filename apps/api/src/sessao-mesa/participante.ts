/** Dispositivo que faz parte da sessão aberta de uma mesa. */
export type Participante = {
  restauranteId: string;
  mesa: { id: string; numero: number };
  sessao: { id: string; garcomId: string | null };
  dispositivo: { id: string; dispositivoId: string; confirmado: boolean };
};

export const COOKIE_DISPOSITIVO = 'dispositivo';
export const DURACAO_DISPOSITIVO_MS = 365 * 24 * 60 * 60 * 1000;

const FORMATO_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cookie de dispositivo aceito só se tiver cara de UUID. */
export function dispositivoValido(valor: unknown): valor is string {
  return typeof valor === 'string' && FORMATO_UUID.test(valor);
}
