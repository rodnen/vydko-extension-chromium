export function serializeError(error, i18n) {
  if (!error) return { message: i18n.get('errorUnknown') };
  if (typeof error === 'string') return { message: error };

  return {
    message: error.message || String(error),
    ...(error.url ? { url: error.url } : {})
  };
}
