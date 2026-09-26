import { query } from '../config/db.js';

/**
 * Internal Notification Service
 * Emits in-app notifications and acts as hook target for future Web Push / SMS
 */
export async function emitNotification({
  userId,
  type,
  title,
  body,
  relatedApplicationId = null,
  relatedJobId = null
}) {
  try {
    const res = await query(
      `INSERT INTO notifications (user_id, type, title, body, related_application_id, related_job_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, type, title, body, relatedApplicationId, relatedJobId]
    );

    const notification = res.rows[0];
    console.log(`🔔 [NOTIFICATION EMITTED] User ${userId} | ${title}`);

    return notification;
  } catch (err) {
    console.error('Error emitting notification:', err);
    throw err;
  }
}

export default {
  emitNotification
};
