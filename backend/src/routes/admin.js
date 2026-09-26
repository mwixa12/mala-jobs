import express from 'express';
import { query } from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { emitNotification } from '../services/notification.js';
import logAudit from '../services/auditLog.js';
import checkOpportunityQuality from '../services/qualityChecker.js';

const router = express.Router();

// 0. Platform Stats Dashboard
router.get('/stats', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const [seekers, employers, jobs, applications, flagged, reports] = await Promise.all([
      query(`SELECT count(*) FROM users WHERE role = 'job_seeker'`),
      query(`SELECT count(*) FROM employers`),
      query(`SELECT count(*) FROM jobs WHERE status = 'published'`),
      query(`SELECT count(*) FROM applications WHERE created_at > now() - interval '7 days'`),
      query(`SELECT count(*) FROM jobs WHERE status = 'flagged'`),
      query(`SELECT count(*) FROM reports WHERE resolved = false`)
    ]);
    return res.json({
      stats: {
        totalSeekers: parseInt(seekers.rows[0].count),
        totalEmployers: parseInt(employers.rows[0].count),
        activeJobs: parseInt(jobs.rows[0].count),
        applicationsThisWeek: parseInt(applications.rows[0].count),
        pendingFlaggedJobs: parseInt(flagged.rows[0].count),
        openReports: parseInt(reports.rows[0].count)
      }
    });
  } catch (err) {
    console.error('Error fetching admin stats:', err);
    return res.status(500).json({ error: 'Failed to fetch platform stats' });
  }
});

// 1. Get All Registered Companies / Employers for Admin Verification
router.get('/employers', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const empRes = await query(
      `SELECT e.*, u.email as account_email, u.phone_number as account_phone,
              (SELECT count(*) FROM jobs j WHERE j.employer_id = e.id) as job_count
       FROM employers e
       JOIN users u ON e.user_id = u.id
       ORDER BY e.created_at DESC`
    );
    return res.json({ employers: empRes.rows });
  } catch (err) {
    console.error('Error fetching employers for admin:', err);
    return res.status(500).json({ error: 'Failed to fetch registered companies' });
  }
});

// 2. Grant / Update Company Verification Badge (Trust Tier)
router.post('/employers/:id/trust-tier', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { trustTier } = req.body; // 'unverified', 'tier_0_phone', 'tier_1_reviewed'

    if (!['unverified', 'tier_0_phone', 'tier_1_reviewed'].includes(trustTier)) {
      return res.status(400).json({ error: 'Invalid trust tier' });
    }

    const empRes = await query(
      `UPDATE employers 
       SET trust_tier = $1::employer_trust_tier, 
           trust_tier_reviewed_at = now(),
           trust_tier_reviewed_by = $2,
           updated_at = now()
       WHERE id = $3
       RETURNING *`,
      [trustTier, req.user.id, id]
    );

    const employer = empRes.rows[0];

    // Notify company user
    await emitNotification({
      userId: employer.user_id,
      type: 'account',
      title: trustTier === 'tier_1_reviewed' ? 'Company Verification Badge Granted!' : 'Company Verification Tier Updated',
      body: trustTier === 'tier_1_reviewed' 
        ? `Congratulations! Your company "${employer.display_name}" has been verified by administrators. A Verified Badge is now displayed on your company profile and job postings.`
        : `Your company verification trust status was updated to ${trustTier}.`
    });

    await logAudit({
      actorUserId: req.user.id,
      action: 'COMPANY_VERIFICATION_UPDATED',
      targetType: 'EMPLOYER',
      targetId: id,
      details: { newTrustTier: trustTier }
    });

    return res.json({ employer });
  } catch (err) {
    console.error('Error updating trust tier:', err);
    return res.status(500).json({ error: 'Failed to update company verification status' });
  }
});

// 3. Get Flagged Opportunities Queue
router.get('/flagged-jobs', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const jobsRes = await query(
      `SELECT j.*, e.display_name as employer_name, e.trust_tier as employer_trust_tier, u.email as employer_email, u.phone_number as employer_phone
       FROM jobs j
       JOIN employers e ON j.employer_id = e.id
       JOIN users u ON e.user_id = u.id
       WHERE j.status = 'flagged'
       ORDER BY j.created_at ASC`
    );

    const jobsWithSkills = await Promise.all(
      jobsRes.rows.map(async (job) => {
        const skillsRes = await query(
          `SELECT js.skill_id, js.is_required, s.name as skill_name 
           FROM job_skills js 
           JOIN skills s ON js.skill_id = s.id 
           WHERE js.job_id = $1`,
          [job.id]
        );
        return { ...job, skills: skillsRes.rows };
      })
    );

    return res.json({ flaggedJobs: jobsWithSkills });
  } catch (err) {
    console.error('Error fetching flagged jobs:', err);
    return res.status(500).json({ error: 'Failed to fetch flagged jobs' });
  }
});

// 4. Admin Edit Job Details & Qualifications Before Publishing
router.put('/jobs/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      opportunityType,
      locationDistrict,
      payAmountMin,
      payAmountMax,
      payPeriod,
      status = 'published',
      requiredSkillIds = [],
      niceToHaveSkillIds = []
    } = req.body;

    const jobRes = await query('SELECT j.*, e.user_id as employer_user_id FROM jobs j JOIN employers e ON j.employer_id = e.id WHERE j.id = $1', [id]);
    if (jobRes.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    const job = jobRes.rows[0];

    const updateRes = await query(
      `UPDATE jobs 
       SET title = $1,
           description = $2,
           opportunity_type = $3::opportunity_type,
           location_district = $4,
           pay_amount_min = $5,
           pay_amount_max = $6,
           pay_period = $7,
           status = $8::job_status,
           published_at = CASE WHEN $8::job_status = 'published' THEN now() ELSE published_at END,
           quality_flag_reason = NULL,
           updated_at = now()
       WHERE id = $9
       RETURNING *`,
      [
        title || job.title,
        description || job.description,
        opportunityType || job.opportunity_type,
        locationDistrict || job.location_district,
        payAmountMin !== undefined ? payAmountMin : job.pay_amount_min,
        payAmountMax !== undefined ? payAmountMax : job.pay_amount_max,
        payPeriod || job.pay_period,
        status,
        id
      ]
    );

    // Update Skills mapping
    await query('DELETE FROM job_skills WHERE job_id = $1', [id]);
    for (const sId of requiredSkillIds) {
      await query('INSERT INTO job_skills (job_id, skill_id, is_required) VALUES ($1, $2, true) ON CONFLICT DO NOTHING', [id, sId]);
    }
    for (const sId of niceToHaveSkillIds) {
      await query('INSERT INTO job_skills (job_id, skill_id, is_required) VALUES ($1, $2, false) ON CONFLICT DO NOTHING', [id, sId]);
    }

    // Notify Employer
    await emitNotification({
      userId: job.employer_user_id,
      type: 'account',
      title: 'Opportunity Edited & Published by Admin',
      body: `Your posting "${title}" was reviewed, edited for compliance, and published by system administrators.`,
      relatedJobId: id
    });

    await logAudit({
      actorUserId: req.user.id,
      action: 'ADMIN_EDITED_AND_PUBLISHED_JOB',
      targetType: 'JOB',
      targetId: id,
      details: { title, newStatus: status }
    });

    return res.json({ success: true, job: updateRes.rows[0] });
  } catch (err) {
    console.error('Error in admin edit job:', err);
    return res.status(500).json({ error: 'Failed to update job' });
  }
});

// 5. Moderation Decision (Approve or Remove Flagged Job)
router.post('/jobs/:id/review', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { action, moderationNote } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action must be "approve" or "reject"' });
    }

    const jobRes = await query('SELECT j.*, e.user_id as employer_user_id FROM jobs j JOIN employers e ON j.employer_id = e.id WHERE j.id = $1', [id]);
    if (jobRes.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    const job = jobRes.rows[0];

    const newStatus = action === 'approve' ? 'published' : 'removed';
    const publishedAt = action === 'approve' ? new Date() : job.published_at;

    await query(
      `UPDATE jobs 
       SET status = $1::job_status, 
           published_at = $2, 
           updated_at = now() 
       WHERE id = $3`,
      [newStatus, publishedAt, id]
    );

    // Emit notification to employer
    await emitNotification({
      userId: job.employer_user_id,
      type: 'account',
      title: action === 'approve' ? 'Opportunity Approved!' : 'Opportunity Moderated',
      body: action === 'approve'
        ? `Your posting "${job.title}" has been approved by moderators and is now live on the board.`
        : `Your posting "${job.title}" was removed by moderators. Note: ${moderationNote || 'Violated community guidelines.'}`,
      relatedJobId: id
    });

    await logAudit({
      actorUserId: req.user.id,
      action: action === 'approve' ? 'JOB_APPROVED' : 'JOB_REJECTED',
      targetType: 'JOB',
      targetId: id,
      details: { moderationNote }
    });

    return res.json({ success: true, status: newStatus });
  } catch (err) {
    console.error('Error reviewing job:', err);
    return res.status(500).json({ error: 'Failed to process moderation review' });
  }
});

// 6. Get Open Reports Queue
router.get('/reports', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const reportsRes = await query(
      `SELECT r.*, 
              u.phone_number as reporter_phone,
              j.title as job_title,
              e.display_name as employer_name
       FROM reports r
       LEFT JOIN users u ON r.reporter_user_id = u.id
       LEFT JOIN jobs j ON r.job_id = j.id
       LEFT JOIN employers e ON r.employer_id = e.id
       ORDER BY r.created_at DESC`
    );

    return res.json({ reports: reportsRes.rows });
  } catch (err) {
    console.error('Error fetching reports:', err);
    return res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// 7. Resolve Report
router.post('/reports/:id/resolve', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { actionNote } = req.body;

    const reportRes = await query('SELECT * FROM reports WHERE id = $1', [id]);
    if (reportRes.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    const report = reportRes.rows[0];

    await query(
      `UPDATE reports 
       SET resolved = true, 
           resolved_by_user_id = $1, 
           resolved_at = now() 
       WHERE id = $2`,
      [req.user.id, id]
    );

    // Notify reporter
    await emitNotification({
      userId: report.reporter_user_id,
      type: 'account',
      title: 'Report Resolved',
      body: `Thank you for reporting. Our moderation team has reviewed and resolved the issue.`
    });

    await logAudit({
      actorUserId: req.user.id,
      action: 'REPORT_RESOLVED',
      targetType: 'REPORT',
      targetId: id,
      details: { actionNote }
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('Error resolving report:', err);
    return res.status(500).json({ error: 'Failed to resolve report' });
  }
});

// 8. Admin Creates New Job On Behalf of an Employer
router.post('/jobs', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const {
      employerId,
      title,
      description,
      opportunityType,
      locationDistrict,
      isRemote,
      payAmountMin,
      payAmountMax,
      payPeriod,
      applicationDeadline,
      requiredSkillIds = [],
      niceToHaveSkillIds = [],
      publishImmediately = true
    } = req.body;

    if (!employerId || !title || !description || !opportunityType) {
      return res.status(400).json({ error: 'employerId, title, description, and opportunityType are required' });
    }

    const empCheck = await query('SELECT id, display_name, user_id FROM employers WHERE id = $1', [employerId]);
    if (empCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Employer not found' });
    }
    const employer = empCheck.rows[0];

    // Run quality checker unless admin is force-publishing
    let initialStatus = 'published';
    let flagReason = null;
    if (!publishImmediately) {
      const qualityResult = await checkOpportunityQuality({ title, description, payAmountMin, payAmountMax, payPeriod, skills: [] });
      initialStatus = qualityResult.status;
      flagReason = qualityResult.reason;
    }

    const insertRes = await query(
      `INSERT INTO jobs (
        employer_id, title, description, opportunity_type, location_district,
        is_remote, pay_amount_min, pay_amount_max, pay_period, status,
        quality_flag_reason, quality_checked_at, application_deadline, published_at
      ) VALUES ($1,$2,$3,$4::opportunity_type,$5,$6,$7,$8,$9,$10::job_status,$11,now(),$12,$13)
      RETURNING *`,
      [
        employer.id,
        title.trim(),
        description.trim(),
        opportunityType,
        locationDistrict || null,
        !!isRemote,
        payAmountMin || null,
        payAmountMax || null,
        payPeriod || 'monthly',
        initialStatus,
        flagReason,
        applicationDeadline || null,
        initialStatus === 'published' ? new Date() : null
      ]
    );
    const job = insertRes.rows[0];

    for (const sId of requiredSkillIds) {
      await query('INSERT INTO job_skills (job_id, skill_id, is_required) VALUES ($1, $2, true) ON CONFLICT DO NOTHING', [job.id, sId]);
    }
    for (const sId of niceToHaveSkillIds) {
      await query('INSERT INTO job_skills (job_id, skill_id, is_required) VALUES ($1, $2, false) ON CONFLICT DO NOTHING', [job.id, sId]);
    }

    // Notify employer that admin posted on their behalf
    await emitNotification({
      userId: employer.user_id,
      type: 'account',
      title: 'New Job Posted On Your Behalf',
      body: `Admin posted "${title}" for your company. It is now ${initialStatus === 'published' ? 'live on the board' : 'queued for review'}.`,
      relatedJobId: job.id
    });

    await logAudit({
      actorUserId: req.user.id,
      action: 'ADMIN_CREATED_JOB',
      targetType: 'JOB',
      targetId: job.id,
      details: { title, employerId, status: initialStatus }
    });

    return res.status(201).json({ success: true, job });
  } catch (err) {
    console.error('Error in admin create job:', err);
    return res.status(500).json({ error: 'Failed to create job' });
  }
});

// 9. Get Audit Logs Paper Trail
router.get('/audit-logs', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const logsRes = await query(
      `SELECT l.*, u.phone_number as actor_phone, u.email as actor_email, u.role as actor_role
       FROM audit_logs l
       LEFT JOIN users u ON l.actor_user_id = u.id
       ORDER BY l.created_at DESC
       LIMIT 100`
    );

    return res.json({ auditLogs: logsRes.rows });
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    return res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
