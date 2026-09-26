import express from 'express';
import { query } from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Employer Profile Details
router.get('/profile', authenticateToken, requireRole('employer'), async (req, res) => {
  try {
    const empRes = await query('SELECT * FROM employers WHERE user_id = $1', [req.user.id]);
    if (empRes.rows.length === 0) {
      return res.status(404).json({ error: 'Employer profile not found' });
    }
    return res.json({ employer: empRes.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch employer profile' });
  }
});

// Update Employer Profile
router.put('/profile', authenticateToken, requireRole('employer'), async (req, res) => {
  try {
    const { displayName, isOrganization, businessRegNumber, locationDistrict } = req.body;
    if (!displayName || !displayName.trim()) {
      return res.status(400).json({ error: 'Display name is required' });
    }

    const updateRes = await query(
      `UPDATE employers 
       SET display_name = $1,
           is_organization = COALESCE($2, is_organization),
           business_reg_number = $3,
           location_district = $4,
           updated_at = now()
       WHERE user_id = $5
       RETURNING *`,
      [displayName.trim(), isOrganization, businessRegNumber || null, locationDistrict || null, req.user.id]
    );

    return res.json({ employer: updateRes.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update employer profile' });
  }
});

// Get My Posted Opportunities
router.get('/my-jobs', authenticateToken, requireRole('employer'), async (req, res) => {
  try {
    const empRes = await query('SELECT id FROM employers WHERE user_id = $1', [req.user.id]);
    if (empRes.rows.length === 0) {
      return res.status(404).json({ error: 'Employer profile not found' });
    }
    const employerId = empRes.rows[0].id;

    const jobsRes = await query(
      `SELECT j.*, 
              (SELECT count(*) FROM applications a WHERE a.job_id = j.id) as applicant_count
       FROM jobs j
       WHERE j.employer_id = $1
       ORDER BY j.created_at DESC`,
      [employerId]
    );

    return res.json({ jobs: jobsRes.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch employer jobs' });
  }
});

export default router;
