/**
 * 规范化 JSON：键按字典序递归排序后 `JSON.stringify` 无空格。
 *
 * 签名覆盖对象与 IR 层摘要共用这一份，避免两套序列化悄悄漂出不同摘要
 * （元语不变量 12：一份判定只写一次）。
 */
export declare function canonicalizeJson(value: unknown): string;
//# sourceMappingURL=canonical-json.d.ts.map