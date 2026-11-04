import { execSync } from 'node:child_process';

export default function globalSetup() {
  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'ignore',
  });
}
