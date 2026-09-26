import { query } from '../config/db.js';

export async function logAudit({ actorUserId, action, targetType, targetId, details = {} }) {
  try {
    await query(
      `INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [actorUserId || null, action, targetType, targetId || null, JSON.stringify(details)]
    );
  } catch (err) {
    console.error('Failed to record audit log:', err);
  }
}

export default logAudit;
