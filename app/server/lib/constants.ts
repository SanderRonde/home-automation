import * as path from 'path';

const ROOT = path.join(__dirname, '../../../');
export const DB_FOLDER = path.join(ROOT, 'database');

export const SECRETS_FOLDER = path.join(ROOT, 'secrets');
export const SECRETS_FILE = path.join(SECRETS_FOLDER, 'secrets.txt');