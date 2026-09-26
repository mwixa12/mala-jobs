import express from 'express';
import { query } from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Master list of available skills
router.get('/skills/catalog', async (req, res) => {
  try {
    const result = await query('SELECT * FROM skills ORDER BY category, name ASC');
    return res.json({ skills: result.rows });
  } catch (err) {
    console.error('Error fetching skills catalog:', err);
    return res.status(500).json({ error: 'Failed to fetch skills catalog' });
  }
});

// Get Seeker Profile + Skills
router.get('/me', authenticateToken, requireRole('job_seeker'), async (req, res) => {
  try {
    const profileRes = await query('SELECT * FROM job_seeker_profiles WHERE user_id = $1', [req.user.id]);
    let profile = profileRes.rows[0];

    if (!profile) {
      // Auto-create profile if missing
      const insertRes = await query(
        `INSERT INTO job_seeker_profiles (user_id, full_name) 
         VALUES ($1, $2) RETURNING *`,
        [req.user.id, `Job Seeker (${req.user.phone_number.slice(-4)})`]
      );
      profile = insertRes.rows[0];
    }

    // Fetch user's skills
    const skillsRes = await query(
      `SELECT us.*, s.name as skill_name, s.category as skill_category
       FROM user_skills us
       JOIN skills s ON us.skill_id = s.id
       WHERE us.user_id = $1
       ORDER BY s.name ASC`,
      [req.user.id]
    );

    return res.json({
      profile,
      skills: skillsRes.rows
    });
  } catch (err) {
    console.error('Error fetching seeker profile:', err);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update Seeker Profile
router.put('/me', authenticateToken, requireRole('job_seeker'), async (req, res) => {
  try {
    const {
      fullName,
      locationDistrict,
      bio,
      highestEducation,
      openToGigWork,
      openToRelocation,
      profilePhotoUrl,
      preferredLanguage
    } = req.body;

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ error: 'Full name is required' });
    }

    // Update user's preferred language if provided
    if (preferredLanguage) {
      await query('UPDATE users SET preferred_language = $1, updated_at = now() WHERE id = $2', [preferredLanguage, req.user.id]);
    }

    const updateRes = await query(
      `UPDATE job_seeker_profiles 
       SET full_name = $1,
           location_district = $2,
           bio = $3,
           highest_education = $4,
           open_to_gig_work = COALESCE($5, open_to_gig_work),
           open_to_relocation = COALESCE($6, open_to_relocation),
           profile_photo_url = $7,
           updated_at = now()
       WHERE user_id = $8
       RETURNING *`,
      [
        fullName.trim(),
        locationDistrict || null,
        bio || null,
        highestEducation || null,
        openToGigWork !== undefined ? !!openToGigWork : null,
        openToRelocation !== undefined ? !!openToRelocation : null,
        profilePhotoUrl || null,
        req.user.id
      ]
    );

    return res.json({ profile: updateRes.rows[0] });
  } catch (err) {
    console.error('Error updating profile:', err);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Add or Update User Skill
router.post('/me/skills', authenticateToken, requireRole('job_seeker'), async (req, res) => {
  try {
    const { skillId, skillName, proficiency = 'beginner', yearsExperience = 0 } = req.body;

    let targetSkillId = skillId;

    if (!targetSkillId && skillName) {
      // Find or create skill by name
      const cleanName = skillName.trim();
      const existingSkill = await query('SELECT id FROM skills WHERE LOWER(name) = LOWER($1)', [cleanName]);
      if (existingSkill.rows.length > 0) {
        targetSkillId = existingSkill.rows[0].id;
      } else {
        const newSkill = await query('INSERT INTO skills (name, category) VALUES ($1, $2) RETURNING id', [cleanName, 'Custom']);
        targetSkillId = newSkill.rows[0].id;
      }
    }

    if (!targetSkillId) {
      return res.status(400).json({ error: 'skillId or skillName is required' });
    }

    // Upsert user skill
    const upsertRes = await query(
      `INSERT INTO user_skills (user_id, skill_id, proficiency, years_experience, self_reported)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (user_id, skill_id) 
       DO UPDATE SET proficiency = EXCLUDED.proficiency, 
                     years_experience = EXCLUDED.years_experience,
                     created_at = now()
       RETURNING *`,
      [req.user.id, targetSkillId, proficiency, yearsExperience]
    );

    // Get skill details
    const skillDetail = await query('SELECT name, category FROM skills WHERE id = $1', [targetSkillId]);

    return res.status(201).json({
      userSkill: {
        ...upsertRes.rows[0],
        skill_name: skillDetail.rows[0]?.name,
        skill_category: skillDetail.rows[0]?.category
      }
    });
  } catch (err) {
    console.error('Error adding user skill:', err);
    return res.status(500).json({ error: 'Failed to add user skill' });
  }
});

// Remove User Skill
router.delete('/me/skills/:skillId', authenticateToken, requireRole('job_seeker'), async (req, res) => {
  try {
    const { skillId } = req.params;
    await query('DELETE FROM user_skills WHERE user_id = $1 AND skill_id = $2', [req.user.id, skillId]);
    return res.json({ success: true, message: 'Skill removed successfully' });
  } catch (err) {
    console.error('Error deleting skill:', err);
    return res.status(500).json({ error: 'Failed to remove skill' });
  }
});

export default router;
