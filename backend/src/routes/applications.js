import express from 'express';
import { query } from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import calculateSkillMatch from '../services/skillMatch.js';
import { emitNotification } from '../services/notification.js';
import logAudit from '../services/auditLog.js';

const router = express.Router();

// 1. Seeker Apply for Opportunity
router.post('/', authenticateToken, requireRole('job_seeker'), async (req, res) => {
  try {
    const { jobId, coverNote } = req.body;
    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }

    // Verify job existence & status
    const jobRes = await query('SELECT id, title, status FROM jobs WHERE id = $1', [jobId]);
    if (jobRes.rows.length === 0) {
      return res.status(404).json({ error: 'Job opportunity not found' });
    }
    const job = jobRes.rows[0];

    if (job.status !== 'published') {
      return res.status(400).json({ error: 'This opportunity is not currently accepting applications' });
    }

    // Check if already applied
    const existing = await query('SELECT id FROM applications WHERE job_id = $1 AND seeker_user_id = $2', [jobId, req.user.id]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'You have already submitted an application for this opportunity' });
    }

    // Compute SkillMatch snapshot at this moment
    const matchSnapshot = await calculateSkillMatch(jobId, req.user.id);

    // Insert application
    const appRes = await query(
      `INSERT INTO applications (job_id, seeker_user_id, current_status, cover_note, match_explanation_json)
       VALUES ($1, $2, 'submitted', $3, $4)
       RETURNING *`,
      [jobId, req.user.id, coverNote || null, JSON.stringify(matchSnapshot)]
    );
    const application = appRes.rows[0];

    // Log to application_status_history
    await query(
      `INSERT INTO application_status_history (application_id, from_status, to_status, changed_by_user_id, note)
       VALUES ($1, NULL, 'submitted', $2, 'Application submitted by seeker')`,
      [application.id, req.user.id]
    );

    await logAudit({
      actorUserId: req.user.id,
      action: 'APPLICATION_SUBMITTED',
      targetType: 'APPLICATION',
      targetId: application.id,
      details: { jobId, matchPercentage: matchSnapshot.matchPercentage }
    });

    return res.status(201).json({
      application,
      matchSnapshot,
      message: 'Application submitted successfully!'
    });
  } catch (err) {
    console.error('Error applying for job:', err);
    return res.status(500).json({ error: 'Failed to submit application' });
  }
});

// 2. Get Seeker Applications
router.get('/me', authenticateToken, requireRole('job_seeker'), async (req, res) => {
  try {
    const appsRes = await query(
      `SELECT a.*, 
              j.title as job_title, 
              j.opportunity_type, 
              j.location_district, 
              j.pay_amount_min, 
              j.pay_amount_max, 
              j.pay_period,
              j.status as job_status,
              e.display_name as employer_name,
              e.trust_tier as employer_trust_tier
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       JOIN employers e ON j.employer_id = e.id
       WHERE a.seeker_user_id = $1
       ORDER BY a.created_at DESC`,
      [req.user.id]
    );

    // Attach history for each application
    const applicationsWithHistory = await Promise.all(
      appsRes.rows.map(async (app) => {
        const historyRes = await query(
          `SELECT h.*, u.role as changed_by_role
           FROM application_status_history h
           LEFT JOIN users u ON h.changed_by_user_id = u.id
           WHERE h.application_id = $1
           ORDER BY h.changed_at ASC`,
          [app.id]
        );
        return {
          ...app,
          history: historyRes.rows
        };
      })
    );

    return res.json({ applications: applicationsWithHistory });
  } catch (err) {
    console.error('Error fetching seeker applications:', err);
    return res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// 3. Employer: View Applicants for a Job (Sorted by Match %)
router.get('/employer/job/:jobId', authenticateToken, requireRole('employer', 'admin'), async (req, res) => {
  try {
    const { jobId } = req.params;

    // Check ownership if employer
    if (req.user.role === 'employer') {
      const empRes = await query('SELECT id FROM employers WHERE user_id = $1', [req.user.id]);
      const employerId = empRes.rows[0]?.id;
      const jobCheck = await query('SELECT id FROM jobs WHERE id = $1 AND employer_id = $2', [jobId, employerId]);
      if (jobCheck.rows.length === 0) {
        return res.status(403).json({ error: 'You do not own this job opportunity' });
      }
    }

    const appsRes = await query(
      `SELECT a.*, 
              p.full_name as seeker_name, 
              p.location_district as seeker_district, 
              p.highest_education, 
              p.bio as seeker_bio,
              u.phone_number as seeker_phone
       FROM applications a
       JOIN job_seeker_profiles p ON a.seeker_user_id = p.user_id
       JOIN users u ON a.seeker_user_id = u.id
       WHERE a.job_id = $1
       ORDER BY (a.match_explanation_json->>'matchPercentage')::int DESC, a.created_at ASC`,
      [jobId]
    );

    const applicantsWithHistory = await Promise.all(
      appsRes.rows.map(async (app) => {
        const historyRes = await query(
          `SELECT * FROM application_status_history WHERE application_id = $1 ORDER BY changed_at ASC`,
          [app.id]
        );
        return {
          ...app,
          history: historyRes.rows
        };
      })
    );

    return res.json({ applicants: applicantsWithHistory });
  } catch (err) {
    console.error('Error fetching job applicants:', err);
    return res.status(500).json({ error: 'Failed to fetch applicants' });
  }
});

// 4. Update Application Status (Employer or Seeker Withdraw)
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { toStatus, note } = req.body;

    const validStatuses = ['submitted', 'viewed', 'shortlisted', 'interview', 'offered', 'rejected', 'withdrawn'];
    if (!validStatuses.includes(toStatus)) {
      return res.status(400).json({ error: 'Invalid application status' });
    }

    const appRes = await query(
      `SELECT a.*, j.title as job_title, j.employer_id 
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       WHERE a.id = $1`,
      [id]
    );

    if (appRes.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const app = appRes.rows[0];
    const fromStatus = app.current_status;

    // Check authorization: Seeker can only set 'withdrawn'; Employer can change any
    if (req.user.role === 'job_seeker') {
      if (app.seeker_user_id !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized to update this application' });
      }
      if (toStatus !== 'withdrawn') {
        return res.status(403).json({ error: 'Seekers can only withdraw their applications' });
      }
    } else if (req.user.role === 'employer') {
      const empRes = await query('SELECT id FROM employers WHERE user_id = $1', [req.user.id]);
      if (empRes.rows[0]?.id !== app.employer_id) {
        return res.status(403).json({ error: 'You are not the employer for this job' });
      }
    }

    // Update application status
    const updateRes = await query(
      `UPDATE applications 
       SET current_status = $1::application_status, updated_at = now() 
       WHERE id = $2 
       RETURNING *`,
      [toStatus, id]
    );

    // Add status history record
    await query(
      `INSERT INTO application_status_history (application_id, from_status, to_status, changed_by_user_id, note)
       VALUES ($1, $2::application_status, $3::application_status, $4, $5)`,
      [id, fromStatus, toStatus, req.user.id, note || null]
    );

    // Emit notification to seeker if updated by employer
    if (req.user.role === 'employer' || req.user.role === 'admin') {
      let notifTitle = 'Application Status Updated';
      let notifBody = `Your application for "${app.job_title}" status changed to ${toStatus.toUpperCase()}`;

      if (toStatus === 'offered') {
        notifTitle = 'Job Offer Received!';
        notifBody = `Congratulations! You have received an offer for "${app.job_title}"!`;
      } else if (toStatus === 'interview') {
        notifTitle = 'Interview Invitation';
        notifBody = `You have been invited for an interview for "${app.job_title}".`;
      } else if (toStatus === 'shortlisted') {
        notifTitle = 'You are Shortlisted!';
        notifBody = `Great news! You were shortlisted for "${app.job_title}".`;
      }

      await emitNotification({
        userId: app.seeker_user_id,
        type: 'application_status_changed',
        title: notifTitle,
        body: notifBody,
        relatedApplicationId: id,
        relatedJobId: app.job_id
      });
    }

    await logAudit({
      actorUserId: req.user.id,
      action: 'APPLICATION_STATUS_UPDATED',
      targetType: 'APPLICATION',
      targetId: id,
      details: { fromStatus, toStatus, note }
    });

    return res.json({ application: updateRes.rows[0] });
  } catch (err) {
    console.error('Error updating application status:', err);
    return res.status(500).json({ error: 'Failed to update application status' });
  }
});

export default router;
