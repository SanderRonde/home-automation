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
const routes_1 = require("./lib/routes");
const auth_1 = require("./lib/auth");
const db_1 = require("./lib/db");
const express = require("express");
const http = require("http");
class WebServer {
    constructor({ ports: { http = 1234 } = {
        http: 1234,
        https: 1235
    } } = {}) {
        this._http = http;
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            yield auth_1.readSecret();
            yield this._initVars();
            this._initRoutes();
            this._listen();
        });
    }
    _initVars() {
        return __awaiter(this, void 0, void 0, function* () {
            this.app = express();
            this.db = yield new db_1.Database().init();
        });
    }
    _initRoutes() {
        routes_1.initRoutes(this.app, this.db);
    }
    _listen() {
        // HTTPS is unused for now
        http.createServer(this.app).listen(this._http, () => {
            console.log(`HTTP server listening on port ${this._http}`);
        });
    }
}
function getArg(name) {
    for (let i = 0; i < process.argv.length; i++) {
        if (process.argv[i] === `--${name}`) {
            return process.argv[i + 1];
        }
        else if (process.argv[i].startsWith(`--${name}=`)) {
            return process.argv[i].slice(3 + name.length);
        }
    }
    return void 0;
}
function getNumberArg(name) {
    const arg = getArg(name);
    if (arg === void 0)
        return void 0;
    return ~~arg;
}
new WebServer({
    ports: {
        http: getNumberArg('http') || undefined,
        https: getNumberArg('https') || undefined
    }
}).init();
