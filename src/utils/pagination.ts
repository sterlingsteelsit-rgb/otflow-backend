export function normalizePagination(pageRaw: unknown, limitRaw: unknown) {
  const page = Math.max(1, Number(pageRaw ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(limitRaw ?? 20) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
