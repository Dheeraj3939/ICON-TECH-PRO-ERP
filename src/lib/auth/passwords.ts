import crypto from 'crypto';

const PASS_SALT = 'icon_tech_pro_enterprise_salt_2026';

// Precomputed PBKDF2 SHA-512 hashes for standard staff accounts (Password: IconTech@2026!)
const PRECOMPUTED_HASH = 'a5acfceafa58ac388a8440c08766bbf6c356f72c44304fba51436bfde0dbc13d1f05bceb7609e06ae8bcfe1177c72573fc3aec4f8a80a1001ff33174451772f5';

const STAFF_PASSWORD_HASHES: Record<string, string> = {
  // Official Staff Master Emails
  'icontechpro@gmail.com': PRECOMPUTED_HASH, // Borra Narsimulu (MD)
  'dheeraj@icontechpro.in': PRECOMPUTED_HASH, // B V Dheeraj Reddy (Admin / Sales)
  'vineet@icontechpro.in': PRECOMPUTED_HASH,  // B Vineet Babu (Sales Executive)
  'sales@icontechpro.in': PRECOMPUTED_HASH,   // Reshma (Sales Executive)
  'accounts@icontechpro.in': PRECOMPUTED_HASH,// Hemalath (Accounts)
  'service01@icontechpro.in': PRECOMPUTED_HASH,// Manisha (Office Assistant)
  // Backward-compatible test/demo aliases
  'md@icontechpro.in': PRECOMPUTED_HASH,
  'reshma@icontechpro.in': PRECOMPUTED_HASH,
  'admin@icontechpro.in': PRECOMPUTED_HASH,
};

export function hashPassword(plainText: string): string {
  return crypto
    .pbkdf2Sync(plainText, PASS_SALT, 10000, 64, 'sha512')
    .toString('hex');
}

export function verifyStaffPassword(email: string, plainText: string): boolean {
  const normalizedEmail = email.toLowerCase().trim();
  const expectedHash = STAFF_PASSWORD_HASHES[normalizedEmail];
  if (!expectedHash) return false;

  const actualHash = hashPassword(plainText);
  const actualBuf = Buffer.from(actualHash, 'utf8');
  const expBuf = Buffer.from(expectedHash, 'utf8');

  if (actualBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expBuf);
}
