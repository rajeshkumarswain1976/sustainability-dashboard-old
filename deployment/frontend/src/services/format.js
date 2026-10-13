export const formatReading = (value, unit = '') => Number.isFinite(value)
  ? `${value.toLocaleString('en-IN', {maximumFractionDigits:2})}${unit ? ` ${unit}` : ''}`
  : '—';
