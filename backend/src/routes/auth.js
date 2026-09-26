import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import smsProvider from '../services/smsProvider.js';
import emailProvider from '../services/emailProvider.js';
import { generateTokens, verifyRefreshToken, revokeRefreshToken } from '../utils/tokens.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Helper: Universal Email/Phone + Password Login Handler
async function handleEmailPasswordLogin(req, res, preferredRole = null) {
  try {
    const { email, phoneNumber, password, role } = req.body;
    const targetRole = role || preferredRole;
    const identifier = (email || phoneNumber || '').trim().toLowerCase();

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email or phone number, and password are required' });
    }

    // Find user by lowercase email OR phone number
    const userRes = await query(
      `SELECT * FROM users 
       WHERE LOWER(email) = $1 OR phone_number = $1 OR phone_number = $2`,
      [identifier, email ? email.trim() : (phoneNumber ? phoneNumber.trim() : '')]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'No account found with this email or phone. Please check your credentials or register.' });
    }

    const user = userRes.rows[0];

    // If account was created via phone OTP and had no password, allow setting one on first password login
    if (!user.password_hash) {
      const newHash = await bcrypt.hash(password, 10);
      await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);
      user.password_hash = newHash;
    } else {
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return res.status(401).json({ error: 'Incorrect password. Please try again.' });
      }
    }

    // If preferred or target role was requested and user is switching or upgrading role:
    if (targetRole && user.role !== targetRole) {
      if (targetRole === 'employer') {
        const empCheck = await query('SELECT * FROM employers WHERE user_id = $1', [user.id]);
        if (empCheck.rows.length === 0) {
          await query(
            `INSERT INTO employers (user_id, display_name, is_organization, trust_tier) 
             VALUES ($1, $2, false, 'unverified')`,
            [user.id, user.email ? user.email.split('@')[0] : 'My Business']
          );
        }
        await query('UPDATE users SET role = $1 WHERE id = $2', ['employer', user.id]);
        user.role = 'employer';
      } else if (targetRole === 'job_seeker') {
        await query('UPDATE users SET role = $1 WHERE id = $2', ['job_seeker', user.id]);
        user.role = 'job_seeker';
      }
    }

    // Attach profile details
    let profile = null;
    let employer = null;

    if (user.role === 'job_seeker') {
      let pRes = await query('SELECT * FROM job_seeker_profiles WHERE user_id = $1', [user.id]);
      if (pRes.rows.length === 0) {
        const seekerName = user.email ? user.email.split('@')[0] : `Seeker (${(user.phone_number || '').slice(-4)})`;
        await query('INSERT INTO job_seeker_profiles (user_id, full_name) VALUES ($1, $2)', [user.id, seekerName]);
        pRes = await query('SELECT * FROM job_seeker_profiles WHERE user_id = $1', [user.id]);
      }
      profile = pRes.rows[0];
    } else if (user.role === 'employer') {
      let eRes = await query('SELECT * FROM employers WHERE user_id = $1', [user.id]);
      if (eRes.rows.length === 0) {
        await query(
          `INSERT INTO employers (user_id, display_name, is_organization, trust_tier) 
           VALUES ($1, $2, false, 'unverified')`,
          [user.id, user.email ? user.email.split('@')[0] : 'My Business']
        );
        eRes = await query('SELECT * FROM employers WHERE user_id = $1', [user.id]);
      }
      employer = eRes.rows[0];
    }

    const tokens = generateTokens(user);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        phoneNumber: user.phone_number,
        role: user.role,
        preferredLanguage: user.preferred_language,
        profile,
        employer
      },
      tokens
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Failed to log in' });
  }
}

// 1. Universal Login (Email or Phone + Password)
router.post('/login', async (req, res) => {
  return handleEmailPasswordLogin(req, res);
});

// 2. Job Seeker Email + Password Login
router.post('/seeker/login', async (req, res) => {
  return handleEmailPasswordLogin(req, res, 'job_seeker');
});

// 3. Job Seeker Email + Password Register
router.post('/seeker/register', async (req, res) => {
  try {
    const { email, password, fullName, phoneNumber } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phoneNumber && phoneNumber.trim() ? phoneNumber.trim() : `SEEKER_${Date.now()}`;

    // Check if user exists
    const existing = await query('SELECT * FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    let user;

    if (existing.rows.length > 0) {
      user = existing.rows[0];
      const passwordHash = await bcrypt.hash(password, 10);
      await query(
        `UPDATE users SET password_hash = $1, role = 'job_seeker', email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $2`,
        [passwordHash, user.id]
      );
      user.role = 'job_seeker';
    } else {
      const existingPhone = await query('SELECT * FROM users WHERE phone_number = $1', [cleanPhone]);
      if (existingPhone.rows.length > 0) {
        user = existingPhone.rows[0];
        const passwordHash = await bcrypt.hash(password, 10);
        await query(
          `UPDATE users SET email = $1, password_hash = $2, role = 'job_seeker', email_verified_at = now() WHERE id = $3`,
          [cleanEmail, passwordHash, user.id]
        );
        user.role = 'job_seeker';
        user.email = cleanEmail;
      } else {
        const passwordHash = await bcrypt.hash(password, 10);
        const userRes = await query(
          `INSERT INTO users (phone_number, email, password_hash, role, email_verified_at) 
           VALUES ($1, $2, $3, 'job_seeker', now()) 
           RETURNING *`,
          [cleanPhone, cleanEmail, passwordHash]
        );
        user = userRes.rows[0];
      }
    }

    // Ensure seeker profile exists
    const seekerName = fullName && fullName.trim() ? fullName.trim() : (user.email ? user.email.split('@')[0] : 'Job Seeker');
    let pRes = await query('SELECT * FROM job_seeker_profiles WHERE user_id = $1', [user.id]);
    let profile;
    if (pRes.rows.length === 0) {
      const insP = await query(
        `INSERT INTO job_seeker_profiles (user_id, full_name) VALUES ($1, $2) RETURNING *`,
        [user.id, seekerName]
      );
      profile = insP.rows[0];
    } else {
      if (fullName && fullName.trim()) {
        const updP = await query(
          `UPDATE job_seeker_profiles SET full_name = $1 WHERE user_id = $2 RETURNING *`,
          [fullName.trim(), user.id]
        );
        profile = updP.rows[0];
      } else {
        profile = pRes.rows[0];
      }
    }

    const tokens = generateTokens(user);

    return res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        phoneNumber: user.phone_number,
        role: user.role,
        preferredLanguage: user.preferred_language,
        profile
      },
      tokens
    });
  } catch (err) {
    console.error('Error registering job seeker:', err);
    return res.status(500).json({ error: 'Failed to register job seeker' });
  }
});

// 4. Seeker Phone OTP Request
router.post('/seeker/request-otp', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber || phoneNumber.trim().length < 7) {
      return res.status(400).json({ error: 'Valid phone number is required' });
    }

    const cleanPhone = phoneNumber.trim();
    const result = await smsProvider.sendOtp(cleanPhone);
    return res.json(result);
  } catch (err) {
    console.error('Error requesting OTP:', err);
    return res.status(500).json({ error: 'Failed to request OTP' });
  }
});

// 5. Seeker Phone OTP Verify & Register/Login
router.post('/seeker/verify-otp', async (req, res) => {
  try {
    const { phoneNumber, otpCode, fullName } = req.body;
    if (!phoneNumber || !otpCode) {
      return res.status(400).json({ error: 'Phone number and OTP code are required' });
    }

    const cleanPhone = phoneNumber.trim();
    const verification = await smsProvider.verifyOtp(cleanPhone, otpCode.trim());

    if (!verification.success) {
      return res.status(400).json({ error: verification.message });
    }

    // Find or create seeker user
    let userRes = await query('SELECT * FROM users WHERE phone_number = $1', [cleanPhone]);
    let user;

    if (userRes.rows.length === 0) {
      const insertUser = await query(
        `INSERT INTO users (phone_number, role, phone_verified_at) 
         VALUES ($1, 'job_seeker', now()) 
         RETURNING *`,
        [cleanPhone]
      );
      user = insertUser.rows[0];

      const seekerName = fullName && fullName.trim() ? fullName.trim() : `Job Seeker (${cleanPhone.slice(-4)})`;
      await query(
        `INSERT INTO job_seeker_profiles (user_id, full_name) 
         VALUES ($1, $2)`,
        [user.id, seekerName]
      );
    } else {
      user = userRes.rows[0];
      if (user.role !== 'job_seeker') {
        await query(`UPDATE users SET role = 'job_seeker', phone_verified_at = now() WHERE id = $1`, [user.id]);
        user.role = 'job_seeker';
      } else if (!user.phone_verified_at) {
        await query('UPDATE users SET phone_verified_at = now() WHERE id = $1', [user.id]);
      }

      const pCheck = await query('SELECT id FROM job_seeker_profiles WHERE user_id = $1', [user.id]);
      if (pCheck.rows.length === 0) {
        const seekerName = fullName && fullName.trim() ? fullName.trim() : `Job Seeker (${cleanPhone.slice(-4)})`;
        await query('INSERT INTO job_seeker_profiles (user_id, full_name) VALUES ($1, $2)', [user.id, seekerName]);
      }
    }

    const profileRes = await query('SELECT * FROM job_seeker_profiles WHERE user_id = $1', [user.id]);
    const profile = profileRes.rows[0] || null;

    const tokens = generateTokens(user);

    return res.json({
      user: {
        id: user.id,
        phoneNumber: user.phone_number,
        email: user.email,
        role: user.role,
        preferredLanguage: user.preferred_language,
        profile
      },
      tokens
    });
  } catch (err) {
    console.error('Error verifying OTP:', err);
    return res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// 6. Employer Request Email Verification Code
router.post('/employer/send-verification-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid company email address is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const result = await emailProvider.sendVerificationCode(cleanEmail);
    return res.json(result);
  } catch (err) {
    console.error('Error sending email verification code:', err);
    return res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// 7. Employer Verify Email Code
router.post('/employer/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const verification = await emailProvider.verifyCode(cleanEmail, code.trim());
    if (!verification.success) {
      return res.status(400).json({ error: verification.message });
    }

    return res.json({ success: true, message: 'Email code verified successfully' });
  } catch (err) {
    console.error('Error verifying email code:', err);
    return res.status(500).json({ error: 'Failed to verify code' });
  }
});

// 8. Employer Register (Email + Password + Company Details)
router.post('/employer/register', async (req, res) => {
  try {
    const { email, password, displayName, isOrganization, businessRegNumber, locationDistrict, phoneNumber, verificationCode } = req.body;

    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Email, password, and company name are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phoneNumber && phoneNumber.trim() ? phoneNumber.trim() : `EMP_${Date.now()}`;

    // Verify email verification code if provided
    if (verificationCode) {
      const verifyResult = await emailProvider.verifyCode(cleanEmail, verificationCode.trim());
      if (!verifyResult.success && !emailProvider.isEmailVerified(cleanEmail)) {
        return res.status(400).json({ error: verifyResult.message || 'Invalid or expired email verification code' });
      }
    }

    // Check existing email
    const existingEmail = await query('SELECT * FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    let user;

    if (existingEmail.rows.length > 0) {
      user = existingEmail.rows[0];
      const passwordHash = await bcrypt.hash(password, 10);
      await query(
        `UPDATE users SET password_hash = $1, role = 'employer', email_verified_at = now() 
         WHERE id = $2`,
        [passwordHash, user.id]
      );
      user.role = 'employer';
    } else {
      const existingPhone = await query('SELECT * FROM users WHERE phone_number = $1', [cleanPhone]);
      if (existingPhone.rows.length > 0) {
        user = existingPhone.rows[0];
        const passwordHash = await bcrypt.hash(password, 10);
        await query(
          `UPDATE users SET email = $1, password_hash = $2, role = 'employer', email_verified_at = now() 
           WHERE id = $3`,
          [cleanEmail, passwordHash, user.id]
        );
        user.role = 'employer';
        user.email = cleanEmail;
      } else {
        const passwordHash = await bcrypt.hash(password, 10);
        const userRes = await query(
          `INSERT INTO users (phone_number, email, password_hash, role, email_verified_at) 
           VALUES ($1, $2, $3, 'employer', now()) 
           RETURNING *`,
          [cleanPhone, cleanEmail, passwordHash]
        );
        user = userRes.rows[0];
      }
    }

    // Ensure employer record exists
    let empRes = await query('SELECT * FROM employers WHERE user_id = $1', [user.id]);
    let employer;
    if (empRes.rows.length === 0) {
      const insEmp = await query(
        `INSERT INTO employers (user_id, display_name, is_organization, business_reg_number, location_district, trust_tier) 
         VALUES ($1, $2, $3, $4, $5, 'unverified') 
         RETURNING *`,
        [user.id, displayName.trim(), !!isOrganization, businessRegNumber || null, locationDistrict || null]
      );
      employer = insEmp.rows[0];
    } else {
      const updEmp = await query(
        `UPDATE employers 
         SET display_name = $1, is_organization = $2, business_reg_number = COALESCE($3, business_reg_number), location_district = COALESCE($4, location_district) 
         WHERE user_id = $5 
         RETURNING *`,
        [displayName.trim(), !!isOrganization, businessRegNumber || null, locationDistrict || null, user.id]
      );
      employer = updEmp.rows[0];
    }

    emailProvider.clearVerification(cleanEmail);
    const tokens = generateTokens(user);

    return res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        phoneNumber: user.phone_number,
        role: user.role,
        preferredLanguage: user.preferred_language,
        employer
      },
      tokens
    });
  } catch (err) {
    console.error('Error registering employer:', err);
    return res.status(500).json({ error: 'Failed to register employer' });
  }
});

// 9. Employer Login (Email + Password)
router.post('/employer/login', async (req, res) => {
  return handleEmailPasswordLogin(req, res, 'employer');
});

// 10. Admin Login
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = email ? email.trim().toLowerCase() : '';

    let userRes = await query('SELECT * FROM users WHERE role = $1', ['admin']);
    let user;

    if (userRes.rows.length === 0) {
      const passwordHash = await bcrypt.hash(password || 'admin123', 10);
      const insertUser = await query(
        `INSERT INTO users (phone_number, email, password_hash, role) 
         VALUES ('+265999000111', 'admin@malajobs.mw', $1, 'admin') 
         RETURNING *`,
        [passwordHash]
      );
      user = insertUser.rows[0];
    } else {
      user = userRes.rows[0];
      if (password) {
        const match = await bcrypt.compare(password, user.password_hash || '');
        if (!match) {
          return res.status(401).json({ error: 'Invalid admin credentials' });
        }
      }
    }

    const tokens = generateTokens(user);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        phoneNumber: user.phone_number,
        role: user.role
      },
      tokens
    });
  } catch (err) {
    console.error('Admin login error:', err);
    return res.status(500).json({ error: 'Failed to log in as admin' });
  }
});

// 11. Refresh Token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return res.status(403).json({ error: 'Invalid or revoked refresh token' });
    }

    const userRes = await query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
    if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
      return res.status(403).json({ error: 'User account not active' });
    }

    const user = userRes.rows[0];
    revokeRefreshToken(refreshToken);
    const newTokens = generateTokens(user);

    return res.json({ tokens: newTokens });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// 12. Logout
router.post('/logout', (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    revokeRefreshToken(refreshToken);
  }
  return res.json({ success: true, message: 'Logged out successfully' });
});

// 13. Current User
router.get('/me', authenticateToken, async (req, res) => {
  try {
    let profile = null;
    let employer = null;

    if (req.user.role === 'job_seeker') {
      const pRes = await query('SELECT * FROM job_seeker_profiles WHERE user_id = $1', [req.user.id]);
      profile = pRes.rows[0] || null;
    } else if (req.user.role === 'employer') {
      const eRes = await query('SELECT * FROM employers WHERE user_id = $1', [req.user.id]);
      employer = eRes.rows[0] || null;
    }

    return res.json({
      user: {
        id: req.user.id,
        phoneNumber: req.user.phone_number,
        email: req.user.email,
        role: req.user.role,
        preferredLanguage: req.user.preferred_language,
        profile,
        employer
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

export default router;
