"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const route_handler_1 = require("./route-handler");
function initRoutes(app, db) {
    app.get('/:auth/:key', (req, res, _next) => {
        route_handler_1.RouteHandler.get(res, req.params, db);
    });
    app.all('/:auth/:key/:value', (req, res, _next) => {
        route_handler_1.RouteHandler.set(res, req.params, db);
    });
    app.use((_req, res, _next) => {
        res.status(404).send('404');
    });
}
exports.initRoutes = initRoutes;
