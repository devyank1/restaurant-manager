import { ForbiddenException } from '@nestjs/common';
import type { UsuarioToken } from './equipe.types';

/** Garçom e dono atendem mesas e chamados; cozinha não. */
export function exigirSalao(usuario: UsuarioToken): void {
  if (usuario.papel !== 'GARCOM' && usuario.papel !== 'DONO') {
    throw new ForbiddenException({ mensagem: 'Acesso só para o salão' });
  }
}
