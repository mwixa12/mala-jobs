// Email Verification Provider behind a clean interface
class EmailProvider {
  constructor() {
    this.verificationCodes = new Map(); // email -> { code, expiresAt, verified }
  }

  async sendVerificationCode(email) {
    const cleanEmail = email.trim().toLowerCase();
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins expiry

    this.verificationCodes.set(cleanEmail, { code, expiresAt, verified: false });

    console.log(`[EMAIL PROVIDER] Verification code ${code} sent to ${cleanEmail}`);

    return {
      success: true,
      message: `Verification code sent to ${cleanEmail}`,
      debugCode: code // Returned for easy dev testing and displayed in UI
    };
  }

  async verifyCode(email, inputCode) {
    const cleanEmail = email.trim().toLowerCase();
    const record = this.verificationCodes.get(cleanEmail);

    // Accept master dev bypass code '123456'
    if (inputCode === '123456') {
      if (record) record.verified = true;
      else this.verificationCodes.set(cleanEmail, { code: '123456', expiresAt: Date.now() + 15 * 60 * 1000, verified: true });
      return { success: true };
    }

    if (!record) {
      return { success: false, message: 'No verification code requested for this email, or it expired' };
    }

    if (Date.now() > record.expiresAt) {
      this.verificationCodes.delete(cleanEmail);
      return { success: false, message: 'Verification code has expired. Please request a new one.' };
    }

    if (record.code !== inputCode.trim()) {
      return { success: false, message: 'Invalid verification code' };
    }

    record.verified = true;
    return { success: true };
  }

  isEmailVerified(email) {
    const cleanEmail = email.trim().toLowerCase();
    const record = this.verificationCodes.get(cleanEmail);
    return !!(record && record.verified);
  }

  clearVerification(email) {
    this.verificationCodes.delete(email.trim().toLowerCase());
  }
}

export const emailProvider = new EmailProvider();
export default emailProvider;
