// src/components/SimpleCharts.jsx
import React from "react";

export function Sparkline({ data = [], w = 160, h = 40, stroke = "#58a6ff" }) {
  if (!data.length) return <svg width={w} height={h} />;
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (w - 8) + 4;
    const y = h - 6 - ((v - min) / Math.max(1e-6, max - min)) * (h - 12);
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h}>
      <polyline fill="none" stroke={stroke} strokeWidth="2" points={pts} />
    </svg>
  );
}

export function Bar({ value = 0.7, w = 160, h = 12, color = "#2ea043" }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <svg width={w} height={h} style={{ background: "rgba(255,255,255,0.06)", borderRadius: 6 }}>
      <rect x="0" y="0" width={clamped * w} height={h} fill={color} rx="6" ry="6" />
    </svg>
  );
}

export function Donut({ value = 0.6, size = 90, color = "#ffa657", bg = "rgba(255,255,255,0.1)" }) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} stroke={bg} strokeWidth="10" fill="none" />
      <circle cx={size/2} cy={size/2} r={r}
        stroke={color} strokeWidth="10" fill="none"
        strokeDasharray={`${c * v} ${c * (1 - v)}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="#dce3ea" fontSize="14" fontWeight="600">
        {(v*100).toFixed(0)}%
      </text>
    </svg>
  );
}
