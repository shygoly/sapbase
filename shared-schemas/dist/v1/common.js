"use strict";
/**
 * Common types and enums shared across Speckit ERP
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditAction = exports.UserStatus = exports.EntityStatus = void 0;
// Status enums
var EntityStatus;
(function (EntityStatus) {
    EntityStatus["ACTIVE"] = "active";
    EntityStatus["INACTIVE"] = "inactive";
    EntityStatus["ARCHIVED"] = "archived";
})(EntityStatus || (exports.EntityStatus = EntityStatus = {}));
var UserStatus;
(function (UserStatus) {
    UserStatus["ACTIVE"] = "active";
    UserStatus["INACTIVE"] = "inactive";
    UserStatus["SUSPENDED"] = "suspended";
})(UserStatus || (exports.UserStatus = UserStatus = {}));
var AuditAction;
(function (AuditAction) {
    AuditAction["CREATE"] = "CREATE";
    AuditAction["READ"] = "READ";
    AuditAction["UPDATE"] = "UPDATE";
    AuditAction["DELETE"] = "DELETE";
    AuditAction["LOGIN"] = "LOGIN";
    AuditAction["LOGOUT"] = "LOGOUT";
})(AuditAction || (exports.AuditAction = AuditAction = {}));
