export const USD_TO_ETB_ESTIMATE = 125

export function formatEthiopianBirr(value: number | string) {
  const num = Number(value) || 0
  return `ETB ${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function formatUSD(value: number | string) {
  const num = Number(value) || 0
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function convertEtbToUsd(etbAmount: number | string, rate = USD_TO_ETB_ESTIMATE): number {
  const num = Number(etbAmount) || 0
  return Number((num / rate).toFixed(2))
}

