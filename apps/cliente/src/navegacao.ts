// Isolado para os testes trocarem (jsdom não deixa espiar location.replace).
export function irPara(url: string): void {
  window.location.replace(url)
}
