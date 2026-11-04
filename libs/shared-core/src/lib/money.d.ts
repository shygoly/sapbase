/**
 * 定点金额：整数小单位运算，禁止引入浮点。
 *
 * 缺省 `decimal(18,4)`、`rounding: "half-up"`（裸 decimal 合法，见交付协议）。
 * 舍入只发生在 `roundTo`；`add` / `sub` / `mul` 保留全精度，不提前舍入。
 */
export declare const DEFAULT_MONEY_PRECISION = 18;
export declare const DEFAULT_MONEY_SCALE = 4;
export declare const DEFAULT_MONEY_ROUNDING: "half-up";
export declare const MAX_MONEY_PRECISION = 38;
export type MoneyRounding = 'half-up' | 'half-even';
export declare class MoneyError extends Error {
    constructor(message: string);
}
/** 以 10^(-scale) 为 1 的整数小单位。 */
export interface FixedDecimal {
    readonly units: bigint;
    readonly scale: number;
}
/**
 * 从十进制文本构造定点值。多出来的小数位直接拒（禁止静默截断）。
 * 不接受 JS number：0.1 在二进制浮点里已经丢精度。
 */
export declare function parseFixed(text: string, scale: number): FixedDecimal;
export declare function formatFixed(value: FixedDecimal): string;
export declare function add(a: FixedDecimal, b: FixedDecimal): FixedDecimal;
export declare function sub(a: FixedDecimal, b: FixedDecimal): FixedDecimal;
/** 乘积标度 = 两侧标度之和，不舍入。 */
export declare function mul(a: FixedDecimal, b: FixedDecimal): FixedDecimal;
/** 对齐到更大标度（只增 0，不是舍入）。 */
export declare function alignScale(value: FixedDecimal, targetScale: number): FixedDecimal;
/** 不同标度先对齐到最大标度再加，中间不舍入。 */
export declare function addAligned(a: FixedDecimal, b: FixedDecimal): FixedDecimal;
/** 不同标度先对齐到最大标度再减，中间不舍入。 */
export declare function subAligned(a: FixedDecimal, b: FixedDecimal): FixedDecimal;
/**
 * 精确除法：只在能整除时接受（必要时抬高标度补 0）。
 * 除不尽 → 拒（中间禁止舍入）。
 */
export declare function div(a: FixedDecimal, b: FixedDecimal): FixedDecimal;
export declare function compare(a: FixedDecimal, b: FixedDecimal): -1 | 0 | 1;
/** 总位数（含小数位）不得超过 precision；超了报错而不是截断。 */
export declare function assertFits(value: FixedDecimal, precision?: number): FixedDecimal;
export declare function roundTo(value: FixedDecimal, targetScale: number, mode: MoneyRounding): FixedDecimal;
//# sourceMappingURL=money.d.ts.map