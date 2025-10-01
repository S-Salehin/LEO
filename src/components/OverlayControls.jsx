import React from "react";

/**
 * onChange({ key, layerId, dateStr, opacity })
 * Preset keys:
 *  - "none"
 *  - "ar"      -> MODIS_Terra_Aerosol  (proxy for Atmospheric Rivers context)
 *  - "elnino"  -> GHRSST_L4_MUR25_Sea_Surface_Temperature_Anomalies
 */
const PRESETS = {
  none: { key: "none", layerId: null, label: "No overlay" },
  ar: {
    key: "ar",
    label: "Atmospheric Rivers (Aerosol proxy)",
    layerId: "MODIS_Terra_Aerosol",
    defaultDate: "2023-02-24",
    defaultOpacity: 0.70
  },
  elnino: {
    key: "elnino",
    label: "El Niño Impact (SST Anomalies)",
    layerId: "GHRSST_L4_MUR25_Sea_Surface_Temperature_Anomalies",
    defaultDate: "2023-10-22",
    defaultOpacity: 0.85
  }
};

export default function OverlayControls({ value, onChange }) {
  const curKey = value?.key || "none";
  const cur = PRESETS[curKey] || PRESETS.none;

  function applyPreset(k) {
    const p = PRESETS[k];
    if (!p || k === "none") {
      onChange({ key: "none", layerId: null });
      return;
    }
    onChange({
      key: p.key,
      layerId: p.layerId,
      dateStr: value?.dateStr || p.defaultDate,
      opacity: value?.opacity ?? p.defaultOpacity
    });
  }

  return (
    <div className="metric" style={{ marginTop: 8 }}>
      <div className="k">3D Earth Overlay (GIBS)</div>

      <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
        <button className="btn" onClick={() => applyPreset("ar")}>Atmospheric Rivers</button>
        <button className="btn" onClick={() => applyPreset("elnino")}>El Niño Impact</button>
        <button className="btn" onClick={() => applyPreset("none")}>Clear</button>
      </div>

      {curKey !== "none" && (
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontSize: 12, opacity: 0.8 }}>
            Date:
            <input
              type="date"
              value={value?.dateStr || cur.defaultDate || ""}
              onChange={(e) =>
                onChange({ ...value, key: curKey, layerId: cur.layerId, dateStr: e.target.value })
              }
              style={{ marginLeft: 8 }}
            />
          </label>
          <label style={{ fontSize: 12, opacity: 0.8 }}>
            Opacity:
            <input
              type="range"
              min="0" max="1" step="0.05"
              value={value?.opacity ?? cur.defaultOpacity ?? 0.75}
              onChange={(e) =>
                onChange({
                  ...value,
                  key: curKey,
                  layerId: cur.layerId,
                  opacity: Number(e.target.value)
                })
              }
              style={{ marginLeft: 8, width: 160, verticalAlign: "middle" }}
            />
            <span style={{ marginLeft: 8 }}>
              {(value?.opacity ?? cur.defaultOpacity ?? 0.75).toFixed(2)}
            </span>
          </label>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Layer: <code className="inline">{cur.layerId}</code>
          </div>
        </div>
      )}
    </div>
  );
}
