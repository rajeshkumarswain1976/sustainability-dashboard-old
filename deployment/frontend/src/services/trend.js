export const timestamp = value => Date.parse(value.length === 10 ? `${value}T00:00:00+05:30` : value);

export function trendLines(history, forecast, cutoff) {
  const boundary = timestamp(cutoff);
  const valid = points => points.filter(point => Number.isFinite(point.value) && Number.isFinite(timestamp(point.timestamp)))
    .sort((a, b) => timestamp(a.timestamp) - timestamp(b.timestamp));
  const past = valid(history).filter(point => timestamp(point.timestamp) <= boundary);
  const future = valid(forecast).filter(point => timestamp(point.timestamp) > boundary);
  // Only join an observed endpoint when both segments exist; never invent a reading.
  return { past, future, dotted: past.length && future.length ? [past.at(-1), ...future] : future, boundary };
}
