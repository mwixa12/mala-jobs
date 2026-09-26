import fs from 'fs';
import path from 'path';
import { getDb, query } from '../config/db.js';
import fileDirName from '../utils/fileDirName.js';

const { __dirname } = fileDirName(import.meta.url);

async function runMigrations() {
  console.log('🔄 Starting MalaJobs Database Migration...');
  const db = await getDb();

  const migrationPath = path.resolve(__dirname, '../../migrations/001_initial_schema.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  try {
    // Execute SQL script
    await db.exec(sql);
    console.log('✅ Executed 001_initial_schema.sql successfully');

    // Verify skills table seed count
    const skillsRes = await query('SELECT count(*) FROM skills;');
    console.log(`📊 Seeded skills count: ${skillsRes.rows[0].count}`);

    // Verify tables list
    const tablesRes = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('📋 Existing database tables:');
    tablesRes.rows.forEach(r => console.log(`  - ${r.table_name}`));

    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

runMigrations();
