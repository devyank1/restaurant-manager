import { ForbiddenException } from '@nestjs/common';
import type { UsuarioToken } from './equipe.types';

/** Garçom e dono atendem mesas e chamados; cozinha não. */
export function exigirSalao(usuario: UsuarioToken): void {
  if (usuario.papel !== 'GARCOM' && usuario.papel !== 'DONO') {
    throw new ForbiddenException({ mensagem: 'Acesso só para o salão' });
  }
}

/** Estoque, compras e receitas: só o gerente (perfil DONO). */
export function exigirDono(usuario: UsuarioToken): void {
  if (usuario.papel !== 'DONO') {
    throw new ForbiddenException({ mensagem: 'Acesso só para o gerente' });
  }
}

/** Telas de produção: a cozinha (e o bar) e o dono; garçom não. */
export function exigirProducao(usuario: UsuarioToken): void {
  if (usuario.papel !== 'COZINHA' && usuario.papel !== 'DONO') {
    throw new ForbiddenException({ mensagem: 'Acesso só para a produção' });
  }
}
