export function browserTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
  catch { return "UTC"; }
}

export function publicationTimeZones(current = browserTimeZone()): string[] {
  return [...new Set([current, "America/Sao_Paulo", "America/Manaus", "America/Noronha", "UTC"])];
}

function partsAt(instant: Date, timeZone: string): number[] {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(instant);
  const values = new Map<string, number>(parts.map(part => [part.type, Number(part.value)]));
  return ["year", "month", "day", "hour", "minute"].map(key => values.get(key) ?? NaN);
}

export function localDateTimeToIso(value: string, timeZone: string, now = new Date()): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Informe uma data e um horário válidos.");
  const target = match.slice(1).map(Number);
  const [year, month, day, hour, minute] = target;
  const targetEpoch = Date.UTC(year, month - 1, day, hour, minute);
  const normalized = new Date(targetEpoch);
  if (normalized.getUTCFullYear() !== year || normalized.getUTCMonth() !== month - 1
    || normalized.getUTCDate() !== day || normalized.getUTCHours() !== hour || normalized.getUTCMinutes() !== minute) {
    throw new Error("Informe uma data e um horário válidos.");
  }
  let candidate = targetEpoch;
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const actual = partsAt(new Date(candidate), timeZone);
      const actualEpoch = Date.UTC(actual[0], actual[1] - 1, actual[2], actual[3], actual[4]);
      const difference = targetEpoch - actualEpoch;
      if (difference === 0) break;
      candidate += difference;
    }
    const resolved = partsAt(new Date(candidate), timeZone);
    if (resolved.some((part, index) => part !== target[index])) {
      throw new Error("Esse horário não existe no fuso selecionado por causa da mudança de horário.");
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Esse horário")) throw error;
    throw new Error("Selecione um fuso horário válido.");
  }
  if (candidate <= now.getTime()) throw new Error("A data e o horário precisam estar no futuro.");
  return new Date(candidate).toISOString();
}

export function isoToLocalDateTime(value: string, timeZone: string): string {
  const [year, month, day, hour, minute] = partsAt(new Date(value), timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatPublicationDate(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short", timeStyle: "short", timeZone,
  }).format(new Date(value));
}
