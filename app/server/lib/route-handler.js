"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("./errors");
const auth_1 = require("./auth");
function requireParams(...keys) {
    return function (_target, _propertyKey, descriptor) {
        const original = descriptor.value;
        descriptor.value = (res, params, ...args) => {
            for (const key of keys) {
                if (!params[key]) {
                    throw new errors_1.KeyError(`Missing key ${key}`);
                }
            }
            original(res, params, ...args);
        };
    };
}
function auth(_target, _propertyKey, descriptor) {
    const original = descriptor.value;
    descriptor.value = (res, params, ...args) => {
        if (!auth_1.authenticate(params.auth)) {
            throw new errors_1.AuthError('Invalid auth key');
        }
        original(res, params, ...args);
        ;
    };
}
function errorHandle(_target, _propertyKey, descriptor) {
    const original = descriptor.value;
    descriptor.value = (res, ...args) => {
        RouteHandler.errorHandler(res, () => {
            original(res, ...args);
            ;
        });
    };
}
class RouteHandler {
    static get(res, params, db) {
        const value = db.get(params.key);
        res.status(200).write(value === undefined ?
            '' : value);
        res.end();
    }
    static set(res, params, db) {
        return __awaiter(this, void 0, void 0, function* () {
            yield db.setVal(params.key, params.value);
            res.status(200);
            res.end();
        });
    }
    static errorHandler(res, fn) {
        try {
            fn();
        }
        catch (e) {
            if (e instanceof errors_1.KeyError) {
                res.status(400).write(e.message);
            }
            else if (e instanceof errors_1.AuthError) {
                res.status(403).write(e.message);
            }
            else {
                res.status(400).write('Internal server error');
            }
            res.end();
        }
    }
}
__decorate([
    errorHandle,
    requireParams('auth', 'key'),
    auth
], RouteHandler, "get", null);
__decorate([
    errorHandle,
    requireParams('auth', 'key', 'value'),
    auth
], RouteHandler, "set", null);
exports.RouteHandler = RouteHandler;
