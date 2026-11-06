"use client";

import { useEffect, useState } from "react";
import { getTimeLeft, type TimeLeft } from "@/lib/event";

const LABELS: { key: keyof Omit<TimeLeft, "complete">; label: string }[] = [
  { key: "days", label: "DIAS" },
  { key: "hours", label: "HORAS" },
  { key: "minutes", label: "MIN" },
  { key: "seconds", label: "SEG" },
];

export function Countdown() {
  // Calculado depois da montagem para evitar diferença entre HTML do servidor e navegador.
  const [time, setTime] = useState<TimeLeft | null>(null);

  useEffect(() => {
    const update = () => setTime(getTimeLeft());
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, []);

  if (time?.complete) {
    return <p className="countdown-finished">O GRANDE DIA CHEGOU</p>;
  }

  return (
    <div className="countdown" role="timer" aria-label="Contagem regressiva até o evento">
      {LABELS.map(({ key, label }, index) => (
        <div className="time-slot-with-rule" key={key}>
          {index !== 0 && <span className="time-divider" aria-hidden="true" />}
          <div className="time-slot">
            <span className="time-value" suppressHydrationWarning>
              {time ? String(time[key]).padStart(2, "0") : "--"}
            </span>
            <span className="time-label">{label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
