import { db } from '../db/index.js';

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomSuffix(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return result;
}

export function generateInviteCode(): string {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = `gory-${year}-${randomSuffix(3)}`;
    const existing = db.prepare('SELECT id FROM groups WHERE invite_code = ?').get(code);
    if (!existing) return code;
  }
  return `gory-${year}-${randomSuffix(6)}`;
}
