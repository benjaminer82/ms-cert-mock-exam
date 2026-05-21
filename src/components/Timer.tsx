import { useEffect, useState } from "react";
import { formatHms } from "../utils/helpers";

export function Timer({
  endsAt,
  onExpire,
}: {
  endsAt: number;
  onExpire: () => void;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, Math.floor((endsAt - now) / 1000));

  useEffect(() => {
    if (remaining === 0) onExpire();
  }, [remaining, onExpire]);

  const danger = remaining <= 30;
  const warn = !danger && remaining <= 120;

  return (
    <div
      role="timer"
      aria-live="polite"
      aria-label={`Time remaining ${formatHms(remaining)}`}
      className={`font-mono text-base px-3 py-1.5 rounded ${
        danger
          ? "bg-red-100 text-red-800"
          : warn
          ? "bg-amber-100 text-amber-800"
          : "bg-slate-100 text-slate-700"
      }`}
    >
      {formatHms(remaining)}
    </div>
  );
}
