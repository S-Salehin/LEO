import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { fetchEONETEvents } from "../lib/nasa";

/** Worldview-like config from your link */
const WV_CFG = {
  // bbox in your link is for the Worldview UI; we center/zoom globally
  imageryDate: "2023-02-24",                 // t=2023-02-24-T10:00:00Z
  eventStart:  "2025-05-25",                 // efd start
  eventEnd:    "2025-09-22",                 // efd end
  categories: [
    "Dust and Haze","Manmade","Sea and Lake Ice","Severe Storms",
    "Snow","Volcanoes","Water Color","Floods","Wildfires"
  ]
};

export default function MapPanel({ open }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open || ready || !ref.current) return;

    const date = WV_CFG.imageryDate;
    const map = new maplibregl.Map({
      container: ref.current,
      style: {
        version: 8,
        sources: {},
        layers: [{ id: "bg", type: "background", paint: { "background-color": "#000" } }]
      },
      center: [20, 10],
      zoom: 1.6,
      attributionControl: false
    });
    mapRef.current = map;

    map.on("load", async () => {
      // 1) BlueMarble base (static)
      map.addSource("gibs-bmng", {
        type: "raster",
        tiles: [
          "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/2004-01-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg"
        ],
        tileSize: 256,
        attribution: "Imagery © NASA GIBS"
      });
      map.addLayer({ id: "gibs-bmng", type: "raster", source: "gibs-bmng", paint: { "raster-opacity": 1 } });

      // 2) VIIRS TrueColor on top for your specific date
      map.addSource("gibs-viirs", {
        type: "raster",
        tiles: [
          `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`
        ],
        tileSize: 256
      });
      map.addLayer({ id: "gibs-viirs", type: "raster", source: "gibs-viirs", paint: { "raster-opacity": 0.9 } });

      // 3) Coastlines + Reference Features overlays
      map.addSource("gibs-coast", {
        type: "raster",
        tiles: [
          "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Coastlines_15m/default/2012-01-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png"
        ],
        tileSize: 256
      });
      map.addLayer({ id: "gibs-coast", type: "raster", source: "gibs-coast", paint: { "raster-opacity": 0.9 } });

      map.addSource("gibs-ref", {
        type: "raster",
        tiles: [
          "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Reference_Features_15m/default/2012-01-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png"
        ],
        tileSize: 256
      });
      map.addLayer({ id: "gibs-ref", type: "raster", source: "gibs-ref", paint: { "raster-opacity": 0.8 } });

      // 4) EONET events matching your filter/time window
      const geojson = await fetchEONETEvents({
        start: WV_CFG.eventStart,
        end: WV_CFG.eventEnd,
        categories: WV_CFG.categories
      });
      map.addSource("eonet", { type: "geojson", data: geojson });
      map.addLayer({
        id: "eonet-circles",
        type: "circle",
        source: "eonet",
        paint: {
          "circle-radius": 4,
          "circle-color": "#ffcc66",
          "circle-stroke-color": "#000",
          "circle-stroke-width": 1
        }
      });
      map.addLayer({
        id: "eonet-labels",
        type: "symbol",
        source: "eonet",
        layout: {
          "text-field": ["get", "title"],
          "text-size": 10,
          "text-offset": [0, 1.2],
          "text-allow-overlap": false
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "#000000",
          "text-halo-width": 1
        }
      });

      // Simple click popup
      map.on("click", "eonet-circles", (e) => {
        const p = e.features?.[0]?.properties || {};
        const html = `
          <div style="font-weight:700;margin-bottom:4px">${p.title || "Event"}</div>
          <div style="opacity:.8;margin-bottom:6px">${p.category || ""}</div>
          ${p.link ? `<a href="${p.link}" target="_blank" rel="noopener">Open source</a>` : ""}
        `;
        new maplibregl.Popup({ closeButton: true }).setLngLat(e.lngLat).setHTML(html).addTo(map);
      });

      setReady(true);
    });

    return () => { map.remove(); mapRef.current = null; };
  }, [open, ready]);

  if (!open) return null;
  return <div className="map-panel"><div ref={ref} style={{width:"100%",height:"100%"}}/></div>;
}
