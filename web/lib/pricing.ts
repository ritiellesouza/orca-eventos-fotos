export function formatTotalBRL(unitPriceCents: number, count: number): string {
  const totalCents = unitPriceCents * count
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCents / 100)
}
