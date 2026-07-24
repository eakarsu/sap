const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function main() {
  const email = String(process.env.PROVISION_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.PROVISION_ADMIN_PASSWORD || '');
  const name = String(process.env.PROVISION_ADMIN_NAME || 'Runtime Administrator');
  if (!email || password.length < 12) throw new Error('Acceptance administrator credentials are required');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 30000 });
  try {
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      `INSERT INTO users (email, password, full_name, role) VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, full_name = EXCLUDED.full_name, role = 'admin'`,
      [email, hash, name]
    );
    console.log(`SAP runtime administrator ready: ${email}`);
  } finally {
    await pool.end();
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
