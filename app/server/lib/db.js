"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("./constants");
const fs = require("fs-extra");
const path = require("path");
class DBFileManager {
    static get date() {
        return {
            ___last_updated: Date.now()
        };
    }
    static read() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield fs.pathExists(constants_1.DB_FILE))) {
                // Create it
                yield fs.mkdirp(path.dirname(constants_1.DB_FILE));
                yield fs.writeFile(constants_1.DB_FILE, JSON.stringify(this.date, null, 4), {
                    encoding: 'utf8'
                });
                return this.date;
            }
            return JSON.parse(yield fs.readFile(constants_1.DB_FILE, {
                encoding: 'utf8'
            }));
        });
    }
    static write(data) {
        return __awaiter(this, void 0, void 0, function* () {
            yield fs.writeFile(constants_1.DB_FILE, JSON.stringify(Object.assign({}, data, this.date), null, 4), {
                encoding: 'utf8'
            });
        });
    }
}
class Database {
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            this._data = yield DBFileManager.read();
            return this;
        });
    }
    setVal(key, val) {
        return __awaiter(this, void 0, void 0, function* () {
            const parts = key.split('.');
            let current = this._data;
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                if (typeof current !== 'object')
                    return;
                if (!(part in current)) {
                    // Value does not exist,
                    // create an empty object to hold its values
                    current[part] = {};
                }
                current = current[part];
            }
            if (typeof current !== 'object')
                return;
            current[parts[parts.length - 1]] = val;
            yield DBFileManager.write(this._data);
        });
    }
    get(key, defaultVal = undefined) {
        const parts = key.split('.');
        let current = this._data;
        for (const part of parts) {
            if (typeof current !== 'object' || !(part in current)) {
                // Value does not exist
                return defaultVal;
            }
            current = current[part];
        }
        return current || defaultVal;
    }
}
exports.Database = Database;
