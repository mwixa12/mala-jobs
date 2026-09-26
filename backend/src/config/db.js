import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import fs from 'fs';
import fileDirName from '../utils/fileDirName.js';

const { __dirname } = fileDirName(import.meta.url);
const dataDir = path.resolve(__dirname, '../../data/pgdata');

let dbInstance = null;

export async function getDb() {
  if (!dbInstance) {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    dbInstance = new PGlite(dataDir);
    await dbInstance.waitReady;
  }
  return dbInstance;
}

export async function query(sql, params = []) {
  const db = await getDb();
  const result = await db.query(sql, params);
  return {
    rows: result.rows || [],
    rowCount: result.rows ? result.rows.length : 0,
    fields: result.fields || []
  };
}

export default {
  getDb,
  query
};
