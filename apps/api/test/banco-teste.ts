// Impede que os testes e2e rodem no banco de dev: sem .env.test, o Prisma
// carregaria apps/api/.env sozinho e o seed apagaria os dados de lá.
export function garantirBancoDeTeste(url: string | undefined): void {
  if (!url) {
    throw new Error(
      'DATABASE_URL ausente nos testes e2e. Crie apps/api/.env.test a partir de .env.test.example.',
    );
  }
  const nomeBanco = new URL(url).pathname.slice(1);
  if (!nomeBanco.endsWith('_test')) {
    throw new Error(
      `Testes e2e recusados: o banco "${nomeBanco}" não termina em _test (esperado cardapio_test).`,
    );
  }
}
