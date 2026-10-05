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
