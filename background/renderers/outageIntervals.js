/**
 * Об'єднує інтервали відключень у абсолютних мілісекундах.
 *
 * Головна причина існування цієї функції — перехід через північ:
 * 19:00–00:00 сьогодні та 00:00–02:00 завтра мають стати одним
 * інтервалом 19:00–02:00, а не двома окремими подіями.
 *
 * @param {Array<{start: number, end: number}>} intervals
 * @returns {Array<{start: number, end: number}>} відсортовані інтервали без перетинів
 */
export function mergeOutageIntervals(intervals) {
  if (!Array.isArray(intervals) || !intervals.length) return [];

  return intervals
    .filter(({ start, end }) =>
      Number.isFinite(start) && Number.isFinite(end) && end > start
    )
    .sort((a, b) => a.start - b.start)
    .reduce((result, next) => {
      const current = result[result.length - 1];

      if (current && next.start <= current.end) {
        current.end = Math.max(current.end, next.end);
      } else {
        result.push({ ...next });
      }

      return result;
    }, []);
}

/**
 * Повертає моменти початку тих об'єднаних інтервалів, які ще не настали.
 * Саме вони потрібні планувальнику сповіщень і таймеру.
 *
 * @param {Array<{start: number, end: number}>} intervals
 * @param {number} now
 * @returns {number[]}
 */
export function collectFutureStarts(intervals, now) {
  return mergeOutageIntervals(intervals)
    .map(({ start }) => start)
    .filter(start => start > now);
}
