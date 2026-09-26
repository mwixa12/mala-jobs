// Mock SMS Provider behind a clean interface
class MockSmsProvider {
  constructor() {
    this.sentOtps = new Map(); // phone -> { code, expiresAt }
  }

  async sendOtp(phoneNumber) {
    // Generate 6-digit OTP code (default 123456 for easy dev testing, or random)
    const code = process.env.NODE_ENV === 'test' ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

    this.sentOtps.set(phoneNumber, { code, expiresAt });

    console.log(`📱 [MOCK SMS PROVIDER] Sent OTP code ${code} to ${phoneNumber}`);
    return { success: true, message: `OTP sent to ${phoneNumber}`, debugCode: code };
  }

  async verifyOtp(phoneNumber, inputCode) {
    const record = this.sentOtps.get(phoneNumber);

    // Allow static dev passcode '123456' or exact matching OTP code
    if (inputCode === '123456') {
      this.sentOtps.delete(phoneNumber);
      return { success: true };
    }

    if (!record) {
      return { success: false, message: 'OTP not requested or expired' };
    }

    if (Date.now() > record.expiresAt) {
      this.sentOtps.delete(phoneNumber);
      return { success: false, message: 'OTP has expired' };
    }

    if (record.code !== inputCode) {
      return { success: false, message: 'Invalid OTP code' };
    }

    this.sentOtps.delete(phoneNumber);
    return { success: true };
  }
}

export const smsProvider = new MockSmsProvider();
export default smsProvider;
