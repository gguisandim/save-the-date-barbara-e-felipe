/**
 * Dados editáveis do convite. Somente o mês e o ano foram informados.
 * Dia 1º e horário 17h são provisórios — confirme a data antes de publicar.
 */
export const EVENT = {
  names: "Bárbara & Felipe",
  monthLabel: "MARÇO",
  year: "2027",
  dateISO: "2027-03-01T17:00:00-03:00",
  // Pexels: vídeos verticais e horizontais sem trilha de áudio embutida.
  oceanVideoMobile: "https://videos.pexels.com/video-files/32599724/13901186_1080_1920_25fps.mp4",
  oceanVideoDesktop: "https://videos.pexels.com/video-files/30970653/13239312_1920_1080_30fps.mp4",
  // Os vídeos de reserva são locais e tocam imediatamente, inclusive sem internet.
  localVideoMobile: "/media/ocean-fallback-mobile.mp4",
  localVideoDesktop: "/media/ocean-fallback-desktop.mp4",
  posterMobile: "/media/ocean-poster-mobile.jpg",
  posterDesktop: "/media/ocean-poster-desktop.jpg",
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
