"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canonicalizeJson = canonicalizeJson;
/**
 * 规范化 JSON：键按字典序递归排序后 `JSON.stringify` 无空格。
 *
 * 签名覆盖对象与 IR 层摘要共用这一份，避免两套序列化悄悄漂出不同摘要
 * （元语不变量 12：一份判定只写一次）。
 */
function canonicalizeJson(value) {
    return JSON.stringify(sortKeys(value));
}
function sortKeys(value) {
    if (Array.isArray(value))
        return value.map(sortKeys);
    if (value !== null && typeof value === 'object') {
        const record = value;
        return Object.fromEntries(Object.keys(record)
            .sort()
            .map((key) => [key, sortKeys(record[key])]));
    }
    return value;
}
//# sourceMappingURL=canonical-json.js.map