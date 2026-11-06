import { PapelUsuario } from '@prisma/client';

/** O que a API devolve sobre a pessoa logada. */
export type UsuarioEquipe = {
  id: string;
  nome: string;
  papel: PapelUsuario;
  emTurno: boolean;
};

/** O que viaja no JWT e fica em `req.usuario`. */
export type UsuarioToken = {
  id: string;
  restauranteId: string;
  papel: PapelUsuario;
};

export const COOKIE_EQUIPE = 'equipe';
export const DURACAO_SESSAO_MS = 12 * 60 * 60 * 1000;
