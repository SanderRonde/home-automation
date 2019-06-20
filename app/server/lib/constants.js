"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const ROOT = path.join(__dirname, '../../../');
exports.DB_FOLDER = path.join(ROOT, 'database');
exports.DB_FILE = path.join(exports.DB_FOLDER, 'db.json');
exports.SECRETS_FOLDER = path.join(ROOT, 'secrets');
exports.SECRETS_FILE = path.join(exports.SECRETS_FOLDER, 'secrets.txt');
