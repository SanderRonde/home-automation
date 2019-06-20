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
let key = null;
function readSecret() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(yield fs.pathExists(constants_1.SECRETS_FILE))) {
            console.log('Missing auth file');
            process.exit(1);
        }
        return (key = yield fs.readFile(constants_1.SECRETS_FILE, {
            encoding: 'utf8'
        }));
    });
}
exports.readSecret = readSecret;
function authenticate(authKey) {
    return key === authKey;
}
exports.authenticate = authenticate;
