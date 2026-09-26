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
export declare const BLUEPRINT_IR_VERSION: "blueprint-ir/v1";
export type BlueprintDependency = {
    atomic: string;
    version: string;
} | {
    module: string;
    version: string;
} | {
    blueprint: string;
    version: string;
};
export type BlueprintLayerName = 'public' | 'configurable' | 'protected';
export interface BlueprintManifest {
    /** 蓝图标识（kebab-case） */
    blueprint: string;
    /** 语义化版本 */
    version: string;
    /** 所需 Runtime 的语义化范围，如 ">=1.0.0 <2.0.0" */
    runtime: string;
    dependencies?: BlueprintDependency[];
    layers: Partial<Record<BlueprintLayerName, string[]>> & {
        public: string[];
    };
    /** 包内每个文件的校验和，形如 `sha256:<64 hex>` */
    files: Record<string, string>;
    license?: {
        required: boolean;
        server?: string | null;
    };
    /** 可选编译记录：加载时比对 IR 摘要，防"包内容与编译结果"漂移 */
    compiled?: {
        irDigest: string;
        compiledAt?: string;
    };
    /** v1 允许缺失（签名属 License 协议那条线） */
    signature?: string;
}
export type BlueprintIrActionKind = 'check' | 'require-approval' | 'post-accounting';
export interface BlueprintIrAction {
    kind: BlueprintIrActionKind;
    /** kind=check 时必填：`atomicType@range` */
    atomic?: string;
    /** kind=require-approval 时必填 */
    rule?: string;
    /** kind=post-accounting 时必填 */
    entry?: string;
    /** 可选触发条件（表达式文本） */
    when?: string;
}
export interface BlueprintIrEvent {
    /** 形如 `SalesOrder.submitted` */
    on: string;
    actions: BlueprintIrAction[];
}
export interface BlueprintIrEntity {
    name: string;
    fieldCount: number;
    states: string[];
}
export interface BlueprintIr {
    ir: typeof BLUEPRINT_IR_VERSION;
    blueprint: string;
    version: string;
    /** 所需 Runtime 的语义化范围（与 manifest.runtime 一致） */
    runtime: string;
    entities: BlueprintIrEntity[];
    events: BlueprintIrEvent[];
    /** 编译时**实际解析到的**依赖版本 */
    dependencies: string[];
    summary?: {
        entities?: number;
        events?: number;
        files?: number;
    };
}
/** 编译结果：IR 双形态 + 依赖清单 + 内容摘要。 */
export interface BlueprintCompileResult {
    blueprint: string;
    version: string;
    ir: BlueprintIr;
    irText: string;
    /** IR 摘要：加载时比对，防止 IR 与包内容漂移 */
    irDigest: string;
}
