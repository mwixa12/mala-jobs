import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getDb, query } from './config/db.js';

import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profiles.js';
import jobRoutes from './routes/jobs.js';
import applicationRoutes from './routes/applications.js';
import notificationRoutes from './routes/notifications.js';
import employerRoutes from './routes/employer.js';
import adminRoutes from './routes/admin.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// API Route Registration
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/companies', jobRoutes); // company profile at /api/companies/:id
app.use('/api/applications', applicationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/employer', employerRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'MalaJobs API', timestamp: new Date() });
});

// Seed sample data function for clean immediate demo board
async function seedInitialDemoData() {
  try {
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;');
    // Ensure seeker profile exists for any job seeker missing one
    const seekersWithoutProfile = await query(`
      SELECT u.id, u.phone_number, u.email 
      FROM users u 
      LEFT JOIN job_seeker_profiles p ON u.id = p.user_id 
      WHERE u.role = 'job_seeker' AND p.id IS NULL
    `);
    for (const seeker of seekersWithoutProfile.rows) {
      const fallbackName = seeker.email ? seeker.email.split('@')[0] : (seeker.phone_number ? `Seeker (${seeker.phone_number.slice(-4)})` : 'Job Seeker');
      await query(`INSERT INTO job_seeker_profiles (user_id, full_name) VALUES ($1, $2)`, [seeker.id, fallbackName]);
    }

    const allUsers = await query('SELECT id, phone_number, email, role, (password_hash IS NOT NULL) as has_password FROM users');
    console.log('📋 Current users in DB:', JSON.stringify(allUsers.rows, null, 2));

    const jobCheck = await query('SELECT count(*) FROM jobs');
    if (parseInt(jobCheck.rows[0].count) > 0) {
      return; // Already seeded
    }

    console.log('🌱 Seeding initial demo opportunities & employers...');

    // 1. Seed demo verified employer
    const empUserRes = await query(
      `INSERT INTO users (phone_number, email, role) 
       VALUES ('+265888123456', 'contact@malawisolar.mw', 'employer') 
       RETURNING id`
    );
    const empUserId = empUserRes.rows[0].id;

    const empRes = await query(
      `INSERT INTO employers (user_id, display_name, is_organization, location_district, trust_tier)
       VALUES ($1, 'Malawi Green Energy Solutions', true, 'Lilongwe', 'tier_1_reviewed')
       RETURNING id`,
      [empUserId]
    );
    const employerId = empRes.rows[0].id;

    // 2. Seed demo unverified employer
    const unverifiedEmpUserRes = await query(
      `INSERT INTO users (phone_number, email, role) 
       VALUES ('+265999888777', 'bobsgaragemw@gmail.com', 'employer') 
       RETURNING id`
    );
    const unverifiedEmpUserId = unverifiedEmpUserRes.rows[0].id;

    const unverifiedEmpRes = await query(
      `INSERT INTO employers (user_id, display_name, is_organization, location_district, trust_tier)
       VALUES ($1, 'Bob Auto Workshop', false, 'Blantyre', 'unverified')
       RETURNING id`,
      [unverifiedEmpUserId]
    );
    const unverifiedEmployerId = unverifiedEmpRes.rows[0].id;

    // Fetch skills
    const skillsRes = await query('SELECT id, name FROM skills');
    const skillMap = new Map();
    skillsRes.rows.forEach(s => skillMap.set(s.name, s.id));

    // Sample jobs across all 6 opportunity types
    const sampleJobs = [
      {
        employer_id: employerId,
        title: 'Solar System Installation Technician',
        description: 'Seeking energetic youth technicians to install and commission 5kW off-grid solar kits across rural Lilongwe clinics. Hands-on wiring and panel mounting experience required.',
        opportunity_type: 'formal_job',
        location_district: 'Lilongwe',
        is_remote: false,
        pay_amount_min: 250000,
        pay_amount_max: 350000,
        pay_period: 'monthly',
        status: 'published',
        published_at: new Date(),
        reqSkills: ['Solar Installation & Maintenance', 'Electrical Wiring'],
        niceSkills: ['Driving & Logistics']
      },
      {
        employer_id: employerId,
        title: 'Digital Marketing & Community Officer Internship',
        description: '3-month internship program for youth passionate about graphic design and social media strategy. Training provided.',
        opportunity_type: 'internship',
        location_district: 'Lilongwe',
        is_remote: true,
        pay_amount_min: 120000,
        pay_amount_max: 150000,
        pay_period: 'monthly',
        status: 'published',
        published_at: new Date(Date.now() - 3600000),
        reqSkills: ['Digital Marketing & Social Media'],
        niceSkills: ['Graphic Design & Branding']
      },
      {
        employer_id: unverifiedEmployerId,
        title: 'Apprentice Auto Electrician',
        description: 'Hands-on 6-month apprenticeship in vehicle diagnostics and alternator rewiring. Perfect for passionate youth looking to build a trade career.',
        opportunity_type: 'apprenticeship',
        location_district: 'Blantyre',
        is_remote: false,
        pay_amount_min: 80000,
        pay_amount_max: 100000,
        pay_period: 'monthly',
        status: 'published',
        published_at: new Date(Date.now() - 7200000),
        reqSkills: ['Electrical Wiring', 'Auto Mechanics & Repair'],
        niceSkills: ['Customer Service & Sales']
      },
      {
        employer_id: unverifiedEmployerId,
        title: 'Mobile Money Kiosk Operator',
        description: 'Weekend gig operating Airtel Money & TNM Mpamba kiosk at Mzuzu market hub. Daily cash payout.',
        opportunity_type: 'gig',
        location_district: 'Mzuzu',
        is_remote: false,
        pay_amount_min: 8000,
        pay_amount_max: 12000,
        pay_period: 'daily',
        status: 'published',
        published_at: new Date(Date.now() - 10800000),
        reqSkills: ['Mobile Money Operations', 'Customer Service & Sales'],
        niceSkills: ['Basic Bookkeeping & Accounting']
      },
      {
        employer_id: employerId,
        title: 'Custom Garment Tailoring Order',
        description: 'Informal contract sewing 50 school uniforms for local community project. Fabric supplied.',
        opportunity_type: 'informal',
        location_district: 'Zomba',
        is_remote: false,
        pay_amount_min: 180000,
        pay_amount_max: 200000,
        pay_period: 'project',
        status: 'published',
        published_at: new Date(Date.now() - 14400000),
        reqSkills: ['Tailoring & Garment Making'],
        niceSkills: []
      },
      {
        employer_id: employerId,
        title: 'Youth Agri-Tech Drip Irrigation Kit Starter Grant',
        description: 'Self-employment resource grant providing 10 youth farming groups in Salima with solar drip irrigation kits and technical training.',
        opportunity_type: 'self_employment_resource',
        location_district: 'Salima',
        is_remote: false,
        pay_amount_min: 500000,
        pay_amount_max: 500000,
        pay_period: 'one-time',
        status: 'published',
        published_at: new Date(Date.now() - 18000000),
        reqSkills: ['Agri-Tech & Drip Irrigation'],
        niceSkills: ['Solar Installation & Maintenance']
      }
    ];

    for (const job of sampleJobs) {
      const jRes = await query(
        `INSERT INTO jobs (employer_id, title, description, opportunity_type, location_district, is_remote, pay_amount_min, pay_amount_max, pay_period, status, published_at)
         VALUES ($1, $2, $3, $4::opportunity_type, $5, $6, $7, $8, $9, $10::job_status, $11)
         RETURNING id`,
        [job.employer_id, job.title, job.description, job.opportunity_type, job.location_district, job.is_remote, job.pay_amount_min, job.pay_amount_max, job.pay_period, job.status, job.published_at]
      );
      const jobId = jRes.rows[0].id;

      for (const reqSkillName of job.reqSkills) {
        const sId = skillMap.get(reqSkillName);
        if (sId) {
          await query('INSERT INTO job_skills (job_id, skill_id, is_required) VALUES ($1, $2, true)', [jobId, sId]);
        }
      }

      for (const niceSkillName of job.niceSkills) {
        const sId = skillMap.get(niceSkillName);
        if (sId) {
          await query('INSERT INTO job_skills (job_id, skill_id, is_required) VALUES ($1, $2, false)', [jobId, sId]);
        }
      }
    }

    console.log('✅ Initial demo data seeded successfully!');
  } catch (err) {
    console.error('Error seeding demo data:', err);
  }
}

// Start Server
async function startServer() {
  try {
    await getDb();
    await seedInitialDemoData();
    app.listen(PORT, () => {
      console.log(`🚀 MalaJobs Express Backend running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
  }
}

startServer();
