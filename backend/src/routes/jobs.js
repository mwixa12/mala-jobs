import express from 'express';
import { query } from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import calculateSkillMatch from '../services/skillMatch.js';
import checkOpportunityQuality from '../services/qualityChecker.js';
import { emitNotification } from '../services/notification.js';
import logAudit from '../services/auditLog.js';

const router = express.Router();

// 1. Opportunity Board - Mixed, Paginated (20/page), Filterable
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const district = req.query.district ? req.query.district.trim() : null;
    const opportunityType = req.query.opportunityType ? req.query.opportunityType.trim() : null;
    const search = req.query.search ? req.query.search.trim() : null;

    let whereClauses = ["j.status = 'published'"];
    let queryParams = [];
    let paramIndex = 1;

    if (district && district !== 'All') {
      whereClauses.push(`j.location_district = $${paramIndex}`);
      queryParams.push(district);
      paramIndex++;
    }

    if (opportunityType && opportunityType !== 'All') {
      whereClauses.push(`j.opportunity_type = $${paramIndex}::opportunity_type`);
      queryParams.push(opportunityType);
      paramIndex++;
    }

    if (search) {
      whereClauses.push(`(LOWER(j.title) LIKE $${paramIndex} OR LOWER(j.description) LIKE $${paramIndex})`);
      queryParams.push(`%${search.toLowerCase()}%`);
      paramIndex++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count query
    const countSql = `SELECT count(*) FROM jobs j ${whereSql}`;
    const countRes = await query(countSql, queryParams);
    const totalJobs = parseInt(countRes.rows[0].count);
    const totalPages = Math.ceil(totalJobs / limit);

    // Fetch jobs query (ordered by published_at DESC, mixed opportunity types)
    const jobsSql = `
      SELECT j.*, 
             e.display_name as employer_name, 
             e.trust_tier as employer_trust_tier,
             e.is_organization as employer_is_organization,
             (SELECT count(*) FROM applications a WHERE a.job_id = j.id) as application_count
      FROM jobs j
      JOIN employers e ON j.employer_id = e.id
      ${whereSql}
      ORDER BY j.published_at DESC, j.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);
    const jobsRes = await query(jobsSql, queryParams);

    // If request contains authorization header, calculate seeker skill match
    let seekerUserId = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const { verifyAccessToken } = await import('../utils/tokens.js');
        const decoded = verifyAccessToken(token);
        if (decoded && decoded.role === 'job_seeker') {
          seekerUserId = decoded.userId;
        }
      } catch (e) {
        // Ignore invalid token on public board endpoint
      }
    }

    let appliedJobIds = new Set();
    if (seekerUserId) {
      try {
        const appliedRes = await query('SELECT job_id FROM applications WHERE seeker_user_id = $1', [seekerUserId]);
        appliedJobIds = new Set(appliedRes.rows.map(r => r.job_id));
      } catch (e) {
        // Ignore application query error
      }
    }

    const jobsWithDetails = await Promise.all(
      jobsRes.rows.map(async (job) => {
        // Fetch job skills
        const skillsRes = await query(
          `SELECT js.skill_id, js.is_required, s.name as skill_name, s.category
           FROM job_skills js
           JOIN skills s ON js.skill_id = s.id
           WHERE js.job_id = $1`,
          [job.id]
        );

        let matchResult = null;
        if (seekerUserId) {
          matchResult = await calculateSkillMatch(job.id, seekerUserId);
        }

        return {
          ...job,
          skills: skillsRes.rows,
          match: matchResult,
          has_applied: appliedJobIds.has(job.id)
        };
      })
    );

    return res.json({
      jobs: jobsWithDetails,
      pagination: {
        page,
        limit,
        totalJobs,
        totalPages,
        hasMore: page < totalPages
      }
    });
  } catch (err) {
    console.error('Error fetching opportunity board:', err);
    return res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// 2. Get Job Details by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const jobRes = await query(
      `SELECT j.*, 
              e.display_name as employer_name, 
              e.trust_tier as employer_trust_tier,
              e.is_organization as employer_is_organization,
              e.location_district as employer_district,
              e.business_reg_number
       FROM jobs j
       JOIN employers e ON j.employer_id = e.id
       WHERE j.id = $1`,
      [id]
    );

    if (jobRes.rows.length === 0) {
      return res.status(404).json({ error: 'Job opportunity not found' });
    }

    const job = jobRes.rows[0];

    // Fetch skills
    const skillsRes = await query(
      `SELECT js.skill_id, js.is_required, s.name as skill_name, s.category
       FROM job_skills js
       JOIN skills s ON js.skill_id = s.id
       WHERE js.job_id = $1`,
      [id]
    );

    // Calculate match & check if already applied if user token present
    let matchResult = null;
    let hasApplied = false;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const { verifyAccessToken } = await import('../utils/tokens.js');
        const decoded = verifyAccessToken(token);
        if (decoded && decoded.role === 'job_seeker') {
          matchResult = await calculateSkillMatch(job.id, decoded.userId);
          const appCheck = await query(
            'SELECT id FROM applications WHERE job_id = $1 AND seeker_user_id = $2',
            [job.id, decoded.userId]
          );
          hasApplied = appCheck.rows.length > 0;
        }
      } catch (e) {
        // Ignore token error
      }
    }

    return res.json({
      job: {
        ...job,
        skills: skillsRes.rows,
        match: matchResult,
        has_applied: hasApplied
      }
    });
  } catch (err) {
    console.error('Error fetching job details:', err);
    return res.status(500).json({ error: 'Failed to fetch job details' });
  }
});

// 3. Post New Opportunity (Employer Portal)
router.post('/', authenticateToken, requireRole('employer'), async (req, res) => {
  try {
    const {
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
      niceToHaveSkillIds = []
    } = req.body;

    if (!title || !description || !opportunityType) {
      return res.status(400).json({ error: 'Title, description, and opportunity type are required' });
    }

    // Get employer ID
    const empRes = await query('SELECT id, trust_tier FROM employers WHERE user_id = $1', [req.user.id]);
    if (empRes.rows.length === 0) {
      return res.status(403).json({ error: 'Employer profile not found' });
    }
    const employer = empRes.rows[0];

    // Fetch skill names for quality checker
    const allSkillIds = [...requiredSkillIds, ...niceToHaveSkillIds];
    let skillNames = [];
    if (allSkillIds.length > 0) {
      const sRes = await query('SELECT name FROM skills WHERE id = ANY($1)', [allSkillIds]);
      skillNames = sRes.rows.map(r => r.name);
    }

    // Run Automated Quality Checker
    const qualityResult = await checkOpportunityQuality({
      title,
      description,
      payAmountMin,
      payAmountMax,
      payPeriod,
      skills: skillNames
    });

    const initialStatus = qualityResult.status; // 'published' or 'flagged'
    const publishedAt = initialStatus === 'published' ? new Date() : null;

    const insertJobRes = await query(
      `INSERT INTO jobs (
        employer_id, title, description, opportunity_type, location_district, 
        is_remote, pay_amount_min, pay_amount_max, pay_period, status, 
        quality_flag_reason, quality_checked_at, application_deadline, published_at
      ) VALUES ($1, $2, $3, $4::opportunity_type, $5, $6, $7, $8, $9, $10::job_status, $11, now(), $12, $13)
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
        qualityResult.reason,
        applicationDeadline || null,
        publishedAt
      ]
    );

    const job = insertJobRes.rows[0];

    // Attach required skills
    for (const sId of requiredSkillIds) {
      await query('INSERT INTO job_skills (job_id, skill_id, is_required) VALUES ($1, $2, true) ON CONFLICT DO NOTHING', [job.id, sId]);
    }

    // Attach nice-to-have skills
    for (const sId of niceToHaveSkillIds) {
      await query('INSERT INTO job_skills (job_id, skill_id, is_required) VALUES ($1, $2, false) ON CONFLICT DO NOTHING', [job.id, sId]);
    }

    if (initialStatus === 'flagged') {
      await emitNotification({
        userId: req.user.id,
        type: 'job_flagged',
        title: 'Opportunity Flagged for Review',
        body: `Your posting "${title}" was routed for human review. Reason: ${qualityResult.reason}`,
        relatedJobId: job.id
      });
    }

    await logAudit({
      actorUserId: req.user.id,
      action: 'JOB_POSTED',
      targetType: 'JOB',
      targetId: job.id,
      details: { title, status: initialStatus, trustTier: employer.trust_tier }
    });

    return res.status(201).json({
      job,
      qualityCheck: qualityResult,
      message: initialStatus === 'published' 
        ? 'Opportunity posted and live!' 
        : 'Opportunity received and queued for review.'
    });
  } catch (err) {
    console.error('Error posting job:', err);
    return res.status(500).json({ error: 'Failed to post opportunity' });
  }
});

// 4. Update / Close Job Posting (Employer Owner)
router.patch('/:id/status', authenticateToken, requireRole('employer', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['published', 'closed', 'flagged', 'removed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid job status' });
    }

    // Check ownership if employer
    if (req.user.role === 'employer') {
      const empRes = await query('SELECT id FROM employers WHERE user_id = $1', [req.user.id]);
      const employerId = empRes.rows[0]?.id;

      const jobCheck = await query('SELECT id FROM jobs WHERE id = $1 AND employer_id = $2', [id, employerId]);
      if (jobCheck.rows.length === 0) {
        return res.status(403).json({ error: 'You do not own this job opportunity' });
      }
    }

    const updateRes = await query(
      `UPDATE jobs SET status = $1::job_status, updated_at = now() WHERE id = $2 RETURNING *`,
      [status, id]
    );

    await logAudit({
      actorUserId: req.user.id,
      action: 'JOB_STATUS_CHANGED',
      targetType: 'JOB',
      targetId: id,
      details: { newStatus: status }
    });

    return res.json({ job: updateRes.rows[0] });
  } catch (err) {
    console.error('Error updating job status:', err);
    return res.status(500).json({ error: 'Failed to update job status' });
  }
});

// 5. Submit Report on Job or Employer
router.post('/:id/report', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Report reason is required' });
    }

    const insertRes = await query(
      `INSERT INTO reports (reporter_user_id, job_id, reason)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.user.id, id, reason.trim()]
    );

    await logAudit({
      actorUserId: req.user.id,
      action: 'JOB_REPORTED',
      targetType: 'JOB',
      targetId: id,
      details: { reason }
    });

    return res.status(201).json({ success: true, report: insertRes.rows[0] });
  } catch (err) {
    console.error('Error submitting report:', err);
    return res.status(500).json({ error: 'Failed to submit report' });
  }
});

// 6. Public Company Profile (name, badge, active jobs)
router.get('/companies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const empRes = await query(
      `SELECT e.id, e.display_name, e.trust_tier, e.location_district,
              e.is_organization, e.business_reg_number, e.created_at,
              u.email as contact_email
       FROM employers e
       JOIN users u ON e.user_id = u.id
       WHERE e.id = $1`,
      [id]
    );
    if (empRes.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    const company = empRes.rows[0];

    // Fetch active published jobs for this company
    const jobsRes = await query(
      `SELECT id, title, opportunity_type, location_district,
              pay_amount_min, pay_amount_max, pay_period,
              is_remote, application_deadline, published_at,
              (SELECT count(*) FROM applications a WHERE a.job_id = j.id) as application_count
       FROM jobs j
       WHERE j.employer_id = $1 AND j.status = 'published'
       ORDER BY j.published_at DESC
       LIMIT 20`,
      [id]
    );

    return res.json({ company, jobs: jobsRes.rows });
  } catch (err) {
    console.error('Error fetching company profile:', err);
    return res.status(500).json({ error: 'Failed to fetch company profile' });
  }
});

export default router;
