import React, { useMemo } from "react";

/** Build a Worldview snapshot URL (static PNG via GIBS WMS) */
function gibsUrl(layer, date, w = 1024, h = 512) {
  const base = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi";
  const params = [
    "SERVICE=WMS",
    "REQUEST=GetMap",
    "VERSION=1.3.0",
    `LAYERS=${encodeURIComponent(layer)}`,
    "CRS=EPSG:4326",
    "BBOX=-90,-180,90,180",
    `TIME=${date}`,
    "FORMAT=image/jpeg",
    `WIDTH=${w}`,
    `HEIGHT=${h}`
  ];
  return `${base}?${params.join("&")}`;
}

export default function MiniMap2D({ open, onClose, overlayType, dateStr }) {
  const { layerId, label } = useMemo(() => {
    if (overlayType === "atmoRivers") return { layerId: "IMERG_Precipitation_Rate", label: "Atmospheric Rivers (IMERG)" };
    if (overlayType === "elNino")     return { layerId: "GHRSST_L4_MUR25_SSTfnd_Anomalies", label: "El Niño Impact (SST Anomaly)" };
    return { layerId: "BlueMarble_ShadedRelief", label: "Blue Marble" };
  }, [overlayType]);

  const url = useMemo(() => {
    const d = (dateStr || new Date().toISOString().slice(0,10)).slice(0,10);
    return gibsUrl(layerId, d);
  }, [layerId, dateStr]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <div className="card-title" style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span>Worldview snapshot • {label} • {dateStr}</span>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
        <div className="map-img-wrap">
          {/* key forces reload when url changes */}
          <img key={url} src={url} alt={label} style={{ maxWidth:"100%", borderRadius:8 }} />
        </div>
      </div>
    </div>
  );
}
