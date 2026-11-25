/**
 * Dados centralizados do convite.
 * O horário da cerimônia não foi informado; a contagem usa provisoriamente
 * meia-noite no fuso horário America/Belem (UTC-03:00).
 */
export const WEDDING_DATE = {
  day: "08",
  monthLabel: "AGOSTO",
  year: "2027",
  longLabel: "08 de agosto de 2027",
  numericLabel: "08.08.2027",
  timeZone: "America/Belem",
  dateISO: "2027-08-08T00:00:00-03:00",
} as const;

/** Única fonte de verdade para as duas mídias visuais da abertura. */
export const OCEAN_MEDIA = {
  mobileQuery: "(max-width: 767px)",
  mobile: "/media/ocean-fallback-mobile.mp4",
  desktop: "/media/ocean-fallback-desktop.mp4",
} as const;

export const EVENT = {
  names: "Bárbara & Felipe",
  ...WEDDING_DATE,
} as const;

export type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  complete: boolean;
};

export function getTimeLeft(now = Date.now()): TimeLeft {
  const remaining = Math.max(0, new Date(EVENT.dateISO).getTime() - now);
  return {
    days: Math.floor(remaining / 86_400_000),
    hours: Math.floor((remaining / 3_600_000) % 24),
    minutes: Math.floor((remaining / 60_000) % 60),
    seconds: Math.floor((remaining / 1_000) % 60),
    complete: remaining === 0,
  };
}
