import { query } from '../config/db.js';

export async function calculateSkillMatch(jobId, seekerUserId) {
  // Fetch job skills (required & nice-to-have)
  const jobSkillsRes = await query(
    `SELECT js.skill_id, js.is_required, s.name as skill_name, s.category
     FROM job_skills js
     JOIN skills s ON js.skill_id = s.id
     WHERE js.job_id = $1`,
    [jobId]
  );

  const jobSkills = jobSkillsRes.rows;

  // Fetch seeker skills
  let seekerSkillsMap = new Map();
  if (seekerUserId) {
    const seekerSkillsRes = await query(
      `SELECT us.skill_id, us.proficiency, us.years_experience, s.name as skill_name
       FROM user_skills us
       JOIN skills s ON us.skill_id = s.id
       WHERE us.user_id = $1`,
      [seekerUserId]
    );

    seekerSkillsRes.rows.forEach(s => {
      seekerSkillsMap.set(s.skill_id, s);
    });
  }

  const requiredSkills = jobSkills.filter(js => js.is_required);
  const optionalSkills = jobSkills.filter(js => !js.is_required);

  const metRequired = [];
  const missingRequired = [];
  const wouldStrengthen = [];

  requiredSkills.forEach(js => {
    if (seekerSkillsMap.has(js.skill_id)) {
      const seekerSkill = seekerSkillsMap.get(js.skill_id);
      metRequired.push({
        skillId: js.skill_id,
        skillName: js.skill_name,
        proficiency: seekerSkill.proficiency,
        yearsExperience: seekerSkill.years_experience
      });
    } else {
      missingRequired.push({
        skillId: js.skill_id,
        skillName: js.skill_name
      });
    }
  });

  optionalSkills.forEach(js => {
    const hasSkill = seekerSkillsMap.has(js.skill_id);
    wouldStrengthen.push({
      skillId: js.skill_id,
      skillName: js.skill_name,
      seekerHasSkill: hasSkill,
      status: hasSkill ? 'bonus_matched' : 'recommended_addition'
    });
  });

  // Calculate Match %: (required skills met) / (total required skills) * 100
  let matchPercentage = 100;
  if (requiredSkills.length > 0) {
    matchPercentage = Math.round((metRequired.length / requiredSkills.length) * 100);
  }

  // Explanation text
  let summary = '';
  if (requiredSkills.length === 0) {
    summary = 'No specific required skills specified for this opportunity.';
  } else if (metRequired.length === requiredSkills.length) {
    summary = `Perfect match! You have all ${requiredSkills.length} required skill(s).`;
  } else {
    summary = `You meet ${metRequired.length} of ${requiredSkills.length} required skill(s).`;
  }

  if (wouldStrengthen.length > 0) {
    const bonusCount = wouldStrengthen.filter(s => s.seekerHasSkill).length;
    if (bonusCount > 0) {
      summary += ` Plus ${bonusCount} bonus nice-to-have skill(s).`;
    }
  }

  return {
    matchPercentage,
    totalRequired: requiredSkills.length,
    metRequiredCount: metRequired.length,
    missingRequiredCount: missingRequired.length,
    buckets: {
      met: metRequired,
      missing: missingRequired,
      wouldStrengthen: wouldStrengthen
    },
    summary
  };
}

export default calculateSkillMatch;
