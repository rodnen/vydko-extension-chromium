export function compareGroups(a, b) {
  const getParts = value => String(value).match(/\d+/g)?.map(Number) ?? [];
  const left = getParts(a);
  const right = getParts(b);
  const length = Math.min(left.length, right.length);

  for (let index = 0; index < length; index++) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }

  if (left.length !== right.length) {
    return left.length - right.length;
  }

  return String(a).localeCompare(String(b));
}

const GROUP_VALUE_PATTERN = /^\d+(?:\.\d+)?$/;

/**
 * Витягує номери груп із відповіді Yasno (planned-outages).
 * Ключі мають вигляд "1.1", "2.1", ... — беремо лише валідні.
 */
export function extractYasnoGroups(data) {
  if (!data || typeof data !== 'object') return [];

  return Object.keys(data)
    .filter(key => GROUP_VALUE_PATTERN.test(key))
    .sort(compareGroups);
}

/**
 * Витягує номери груп із сирої відповіді DTEK (fact).
 * У даних дня групи мають вигляд "GPV1.1", "GPV2.1", ...
 * Беремо об'єднання по всіх днях, щоб не загубити групу, якої немає
 * лише в поточному дні.
 */
export function extractDtekGroups(rawData) {
  const fact = resolveDtekFact(rawData);
  if (!fact) return [];

  // Дані днів зазвичай лежать у fact.data, але рендерер DTEK також
  // підтримує «пласку» структуру, де timestamp — ключ самого fact.
  const days = fact.data && typeof fact.data === 'object' ? fact.data : fact;
  const keys = new Set();

  for (const dayData of Object.values(days)) {
    if (!dayData || typeof dayData !== 'object') continue;

    for (const key of Object.keys(dayData)) {
      if (key.startsWith('GPV')) keys.add(key.slice(3));
    }
  }

  return [...keys]
    .filter(key => GROUP_VALUE_PATTERN.test(key))
    .sort(compareGroups);
}

function resolveDtekFact(rawData) {
  const candidate = rawData?.data;
  if (candidate && typeof candidate === 'object' && 'today' in candidate) {
    return candidate;
  }

  if (rawData && typeof rawData === 'object' && 'today' in rawData) {
    return rawData;
  }

  return null;
}
