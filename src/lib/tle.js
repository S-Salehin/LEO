// Fetch small sets of TLEs from Celestrak (CORS-enabled)
export const GROUPS = {
  ACTIVE: "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle",
  IRIDIUM33_DEBRIS: "https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium-33-debris&FORMAT=tle",
  FENGYUN1C_DEBRIS: "https://celestrak.org/NORAD/elements/gp.php?GROUP=fengyun-1c-debris&FORMAT=tle"
};

export async function fetchTLE(groupUrl, maxCount = 150) {
  const res = await fetch(groupUrl);
  if (!res.ok) throw new Error("TLE fetch failed");
  const text = await res.text();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const sats = [];
  for (let i = 0; i < lines.length - 2; i += 3) {
    sats.push({ name: lines[i], l1: lines[i+1], l2: lines[i+2] });
    if (sats.length >= maxCount) break;
  }
  return sats;
}
