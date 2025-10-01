const NASA_KEY = import.meta.env.VITE_NASA_KEY || "DEMO_KEY";

/** YYYY-MM-DD */
export function todayISO() { return new Date().toISOString().slice(0,10); }

/** map Kp (0..9) to a gentle drag multiplier (1.00..1.35) */
export function dragFromKp(kp) {
  const k = Math.max(0, Math.min(9, Number(kp)||0));
  const m = 1 + 0.08 * Math.max(0, k - 3);
  return Math.min(1.35, Math.max(1.0, Number(m.toFixed(2))));
}

/** NASA DONKI Kp last 3 days. Always returns a number + modifier; never throws. */
export async function fetchKpLast3Days() {
  const end = new Date(); const start = new Date(end.getTime() - 3*24*3600*1000);
  const fmt = d => d.toISOString().slice(0,10);
  const url = `https://api.nasa.gov/DONKI/KP?startDate=${fmt(start)}&endDate=${fmt(end)}&api_key=${NASA_KEY}`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw 0;
    const data = await r.json();
    const last = Array.isArray(data) && data.length ? data[data.length-1] : {};
    const kp = Number(last.kpIndex ?? last.Kp ?? last.kp ?? 3) || 3;
    return { kp, modifier: dragFromKp(kp) };
  } catch {
    return { kp: 3, modifier: 1.0 };
  }
}
