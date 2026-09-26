import React from 'react';
import { X, CheckCheck, BellRing } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext.jsx';

export function NotificationDrawer({ isOpen, onClose }) {
  const { notifications, markAsRead, markAllAsRead } = useNotifications();

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BellRing size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Notifications</h3>
          </div>
          <button className="bell-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {notifications.length > 0 && (
          <button className="btn-secondary" style={{ marginBottom: 12, padding: '6px 12px', fontSize: '0.85rem' }} onClick={markAllAsRead}>
            <CheckCheck size={14} style={{ display: 'inline', marginRight: 4 }} />
            Mark all as read
          </button>
        )}

        {notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
            No notifications yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => markAsRead(n.id)}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: n.is_read ? 'var(--bg-main)' : 'var(--primary-light)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 2 }}>{n.title}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{n.body}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default NotificationDrawer;
