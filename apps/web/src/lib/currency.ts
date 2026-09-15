export function formatEthiopianBirr(value: number | string) {
  return `ETB ${Number(value).toLocaleString()}`
}
