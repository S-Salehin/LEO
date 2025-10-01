import { useEffect, useRef, useState } from 'react';

export default function RevenueChart() {
  const canvasRef = useRef(null);
  const [hoveredSegment, setHoveredSegment] = useState(null);

  const revenueData = [
    { label: 'Debris Collection', value: 4500000, color: '#00d4ff', gradient: ['#00d4ff', '#0099cc'] },
    { label: 'Material Recycling', value: 3200000, color: '#00ff9f', gradient: ['#00ff9f', '#00cc7f'] },
    { label: 'Subscriptions', value: 2800000, color: '#ffd600', gradient: ['#ffd600', '#ffb300'] },
    { label: 'Insurance Savings', value: 1900000, color: '#ff6b9d', gradient: ['#ff6b9d', '#ff4081'] },
    { label: 'Satellite Servicing', value: 2600000, color: '#a78bfa', gradient: ['#a78bfa', '#8b5cf6'] }
  ];

  const total = revenueData.reduce((sum, item) => sum + item.value, 0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 40;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background glow
    const bgGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius + 60);
    bgGradient.addColorStop(0, 'rgba(0, 212, 255, 0.05)');
    bgGradient.addColorStop(1, 'rgba(0, 212, 255, 0)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    let currentAngle = -Math.PI / 2;

    revenueData.forEach((item, index) => {
      const sliceAngle = (item.value / total) * 2 * Math.PI;
      const endAngle = currentAngle + sliceAngle;

      // Create gradient for each slice
      const gradient = ctx.createLinearGradient(
        centerX + Math.cos(currentAngle) * radius,
        centerY + Math.sin(currentAngle) * radius,
        centerX + Math.cos(endAngle) * radius,
        centerY + Math.sin(endAngle) * radius
      );
      gradient.addColorStop(0, item.gradient[0]);
      gradient.addColorStop(1, item.gradient[1]);

      // Draw slice
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, endAngle);
      ctx.closePath();

      // Fill with gradient
      ctx.fillStyle = gradient;
      ctx.fill();

      // Add glow effect on hover
      if (hoveredSegment === index) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = item.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw label and percentage
      const midAngle = currentAngle + sliceAngle / 2;
      const labelX = centerX + Math.cos(midAngle) * (radius * 0.7);
      const labelY = centerY + Math.sin(midAngle) * (radius * 0.7);
      
      const percentage = ((item.value / total) * 100).toFixed(1);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${percentage}%`, labelX, labelY);

      currentAngle = endAngle;
    });

    // Draw center circle for donut effect
    const centerGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 0.5);
    centerGradient.addColorStop(0, 'rgba(7, 11, 18, 1)');
    centerGradient.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.5, 0, 2 * Math.PI);
    ctx.fillStyle = centerGradient;
    ctx.fill();
    
    // Center text
    ctx.fillStyle = '#00d4ff';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TOTAL', centerX, centerY - 20);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(`$${(total / 1000000).toFixed(1)}M`, centerX, centerY + 10);
    
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px monospace';
    ctx.fillText('Annual Revenue', centerX, centerY + 35);

  }, [hoveredSegment]);

  const formatCurrency = (value) => {
    return `$${(value / 1000000).toFixed(2)}M`;
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(7,11,18,0.95) 100%)',
      backdropFilter: 'blur(12px)',
      borderRadius: '16px',
      border: '1px solid rgba(0, 212, 255, 0.2)',
      padding: '24px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 212, 255, 0.1) inset',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Animated background effect */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at 50% 50%, rgba(0, 212, 255, 0.05) 0%, transparent 70%)',
        pointerEvents: 'none',
        animation: 'pulse 4s ease-in-out infinite'
      }} />

      <h3 style={{
        fontSize: '20px',
        fontWeight: 'bold',
        background: 'linear-gradient(135deg, #00d4ff 0%, #00ff9f 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        marginBottom: '20px',
        textAlign: 'center',
        letterSpacing: '1px'
      }}>
        💰 REVENUE BREAKDOWN
      </h3>

      <div style={{ 
        display: 'flex', 
        gap: '30px', 
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap'
      }}>
        {/* Canvas Chart */}
        <canvas
          ref={canvasRef}
          width={350}
          height={350}
          style={{ maxWidth: '100%', height: 'auto' }}
        />

        {/* Legend */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px',
          minWidth: '250px'
        }}>
          {revenueData.map((item, index) => (
            <div
              key={item.label}
              onMouseEnter={() => setHoveredSegment(index)}
              onMouseLeave={() => setHoveredSegment(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                background: hoveredSegment === index 
                  ? `linear-gradient(135deg, ${item.gradient[0]}20 0%, ${item.gradient[1]}10 100%)` 
                  : 'rgba(15, 23, 42, 0.5)',
                borderRadius: '8px',
                border: `1px solid ${hoveredSegment === index ? item.color : 'rgba(255, 255, 255, 0.1)'}`,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                transform: hoveredSegment === index ? 'translateX(5px)' : 'translateX(0)',
                boxShadow: hoveredSegment === index 
                  ? `0 4px 20px ${item.color}40, 0 0 0 1px ${item.color}30 inset`
                  : 'none'
              }}
            >
              <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '4px',
                background: `linear-gradient(135deg, ${item.gradient[0]} 0%, ${item.gradient[1]} 100%)`,
                boxShadow: `0 2px 8px ${item.color}60`,
                flexShrink: 0
              }} />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '12px',
                  color: '#cbd5e1',
                  marginBottom: '2px',
                  fontWeight: '500'
                }}>
                  {item.label}
                </div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#ffffff',
                  fontFamily: 'monospace'
                }}>
                  {formatCurrency(item.value)}
                </div>
              </div>
              <div style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: item.color,
                fontFamily: 'monospace'
              }}>
                {((item.value / total) * 100).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Growth indicator */}
      <div style={{
        marginTop: '20px',
        padding: '16px',
        background: 'linear-gradient(135deg, rgba(0, 255, 159, 0.1) 0%, rgba(0, 212, 255, 0.1) 100%)',
        borderRadius: '8px',
        border: '1px solid rgba(0, 255, 159, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>📈</span>
          <div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>
              Projected Annual Growth
            </div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#00ff9f' }}>
              +24.5% YoY
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>
              Next Year Projection
            </div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#00d4ff' }}>
              ${((total * 1.245) / 1000000).toFixed(1)}M
            </div>
          </div>
          <span style={{ fontSize: '24px' }}>🚀</span>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
