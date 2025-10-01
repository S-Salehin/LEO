import { useEffect, useRef } from "react";

/** Tiny wrapper around global Chart.js (loaded via CDN). */
export default function ChartCanvas({ config, className, style }) {
  const ref = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    const ctx = ref.current.getContext("2d");
    if (chartRef.current) chartRef.current.destroy();
    // Defensive if Chart.js failed to load
    if (!window.Chart) return;
    chartRef.current = new window.Chart(ctx, config);
    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [config]);

  return <canvas ref={ref} className={className} style={style} />;
}
