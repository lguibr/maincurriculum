export const getSafeDate = (dt: string | undefined | null, fallback = "2000-01-01"): string => {
  if (!dt || dt.toLowerCase() === "present") return new Date().toISOString().split("T")[0];
  try {
    const d = new Date(dt);
    if (isNaN(d.getTime())) return fallback;
    return d.toISOString().split("T")[0];
  } catch {
    return fallback;
  }
};

export const getSafeEnd = (start: string, end: string | undefined | null): string => {
  if (!end || end.toLowerCase() === "present") return new Date().toISOString().split("T")[0];
  let e = getSafeDate(end);
  if (e === start) {
    const nextDay = new Date(e);
    nextDay.setDate(nextDay.getDate() + 1);
    e = nextDay.toISOString().split("T")[0];
  }
  return e;
};
