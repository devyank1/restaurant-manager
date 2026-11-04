import { execSync } from 'node:child_process';
import { garantirBancoDeTeste } from './banco-teste';

export default function globalSetup() {
  garantirBancoDeTeste(process.env.DATABASE_URL);
  execSync('pnpm exec prisma migrate deploy', { stdio: 'inherit' });
}
