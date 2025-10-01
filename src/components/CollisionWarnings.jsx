import React from 'react';
import { formatTimeRemaining } from '../utils/collisionDetect';

/**
 * CollisionWarnings - Displays upcoming collision alerts
 */
export default function CollisionWarnings({ collisions, onClose }) {
  if (!collisions || collisions.length === 0) return null;

  return (
    <div className="collision-panel">
      <div className="collision-title">
        ⚠️ Collision Alerts ({collisions.length})
      </div>
      <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 8 }}>
        {collisions.slice(0, 5).map((collision, idx) => (
          <div key={idx} className="collision-item">
            <div className="collision-time">
              T-{formatTimeRemaining(collision.timeSeconds)}
            </div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 11 }}>
              {shortName(collision.obj1)} ⚔️ {shortName(collision.obj2)}
            </div>
            <div className="collision-detail">
              Distance: {collision.distance.toFixed(2)} km
              {' '} • {' '}
              Severity: <span style={{ 
                color: collision.severity === 'critical' ? '#ff4757' : 
                       collision.severity === 'high' ? '#ffa502' : '#ffd600',
                fontWeight: 700
              }}>
                {collision.severity.toUpperCase()}
              </span>
            </div>
            <div className="collision-detail">
              Types: {collision.type1} vs {collision.type2}
            </div>
          </div>
        ))}
        {collisions.length > 5 && (
          <div style={{ 
            textAlign: 'center', 
            padding: '8px', 
            color: '#ffd600', 
            fontSize: 11,
            fontWeight: 600
          }}>
            +{collisions.length - 5} more warnings...
          </div>
        )}
      </div>
      {onClose && (
        <button 
          className="btn tiny" 
          onClick={onClose}
          style={{ width: '100%', marginTop: 4 }}
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

function shortName(name) {
  if (!name) return '???';
  return name.length > 12 ? name.slice(0, 12) + '…' : name;
}
