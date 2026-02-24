import Database from 'better-sqlite3';
try {
  const db = new Database(':memory:');
  console.log('better-sqlite3 is working');
  db.close();
} catch (e) {
  console.error('better-sqlite3 failed:', e);
}
