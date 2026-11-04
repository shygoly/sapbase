"use strict";
/**
 * 蓝图包与 IR 的**类型**（前后端共用）。
 *
 * 权威定义在仓库根：
 *   - `schemas/blueprint-package.schema.json`
 *   - `schemas/blueprint-ir.schema.json`
 *
 * 这里**只放类型，不放判定** —— 校验一律调用后端/共享校验器（元语不变量 12：
 * 一份判定逻辑只写一次），不要在前端另写一套。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BLUEPRINT_IR_VERSION = void 0;
exports.BLUEPRINT_IR_VERSION = 'blueprint-ir/v1';
