"use strict";
/**
 * 定点金额：整数小单位运算，禁止引入浮点。
 *
 * 缺省 `decimal(18,4)`、`rounding: "half-up"`（裸 decimal 合法，见交付协议）。
 * 舍入只发生在 `roundTo`；`add` / `sub` / `mul` 保留全精度，不提前舍入。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoneyError = exports.MAX_MONEY_PRECISION = exports.DEFAULT_MONEY_ROUNDING = exports.DEFAULT_MONEY_SCALE = exports.DEFAULT_MONEY_PRECISION = void 0;
exports.parseFixed = parseFixed;
exports.formatFixed = formatFixed;
exports.add = add;
exports.sub = sub;
exports.mul = mul;
exports.alignScale = alignScale;
exports.addAligned = addAligned;
exports.subAligned = subAligned;
exports.div = div;
exports.compare = compare;
exports.assertFits = assertFits;
exports.roundTo = roundTo;
exports.DEFAULT_MONEY_PRECISION = 18;
exports.DEFAULT_MONEY_SCALE = 4;
exports.DEFAULT_MONEY_ROUNDING = 'half-up';
exports.MAX_MONEY_PRECISION = 38;
class MoneyError extends Error {
    constructor(message) {
        super(message);
        this.name = 'MoneyError';
    }
}
exports.MoneyError = MoneyError;
function assertScale(scale) {
    if (!Number.isInteger(scale) || scale < 0 || scale > exports.MAX_MONEY_PRECISION) {
        throw new MoneyError(`非法标度：${String(scale)}（必须是 0..${exports.MAX_MONEY_PRECISION} 的整数）`);
    }
}
function assertPrecision(precision) {
    if (!Number.isInteger(precision) || precision < 1 || precision > exports.MAX_MONEY_PRECISION) {
        throw new MoneyError(`非法精度：${String(precision)}（必须是 1..${exports.MAX_MONEY_PRECISION} 的整数）`);
    }
}
/**
 * 从十进制文本构造定点值。多出来的小数位直接拒（禁止静默截断）。
 * 不接受 JS number：0.1 在二进制浮点里已经丢精度。
 */
function parseFixed(text, scale) {
    assertScale(scale);
    const match = text.trim().match(/^(-?)(\d+)(?:\.(\d+))?$/);
    if (!match) {
        throw new MoneyError(`无法解析的定点数字：${text}`);
    }
    const frac = match[3] ?? '';
    if (frac.length > scale) {
        throw new MoneyError(`小数位 ${frac.length} 超出标度 ${scale}（禁止静默截断）`);
    }
    const units = BigInt(match[2] + frac.padEnd(scale, '0')) * (match[1] === '-' ? -1n : 1n);
    return { units, scale };
}
function formatFixed(value) {
    const sign = value.units < 0n ? '-' : '';
    const abs = value.units < 0n ? -value.units : value.units;
    const digits = abs.toString().padStart(value.scale + 1, '0');
    if (value.scale === 0)
        return `${sign}${digits}`;
    return `${sign}${digits.slice(0, -value.scale)}.${digits.slice(-value.scale)}`;
}
function add(a, b) {
    if (a.scale !== b.scale) {
        throw new MoneyError(`加减要求同一标度，实际 ${a.scale} 与 ${b.scale}`);
    }
    return { units: a.units + b.units, scale: a.scale };
}
function sub(a, b) {
    if (a.scale !== b.scale) {
        throw new MoneyError(`加减要求同一标度，实际 ${a.scale} 与 ${b.scale}`);
    }
    return { units: a.units - b.units, scale: a.scale };
}
/** 乘积标度 = 两侧标度之和，不舍入。 */
function mul(a, b) {
    const scale = a.scale + b.scale;
    if (scale > exports.MAX_MONEY_PRECISION) {
        throw new MoneyError(`乘法后标度 ${scale} 超出上限 ${exports.MAX_MONEY_PRECISION}`);
    }
    return { units: a.units * b.units, scale };
}
/** 对齐到更大标度（只增 0，不是舍入）。 */
function alignScale(value, targetScale) {
    if (targetScale === value.scale)
        return value;
    if (targetScale < value.scale) {
        throw new MoneyError('对齐到更小标度必须走 round，禁止静默截断');
    }
    return { units: value.units * 10n ** BigInt(targetScale - value.scale), scale: targetScale };
}
/** 不同标度先对齐到最大标度再加，中间不舍入。 */
function addAligned(a, b) {
    const scale = Math.max(a.scale, b.scale);
    return add(alignScale(a, scale), alignScale(b, scale));
}
/** 不同标度先对齐到最大标度再减，中间不舍入。 */
function subAligned(a, b) {
    const scale = Math.max(a.scale, b.scale);
    return sub(alignScale(a, scale), alignScale(b, scale));
}
/**
 * 精确除法：只在能整除时接受（必要时抬高标度补 0）。
 * 除不尽 → 拒（中间禁止舍入）。
 */
function div(a, b) {
    if (b.units === 0n) {
        throw new MoneyError('除数为 0');
    }
    // a/b = (ua / 10^sa) / (ub / 10^sb) = (ua * 10^sb) / (ub * 10^sa)
    let scale = a.scale;
    let numerator = a.units * 10n ** BigInt(b.scale);
    const denominator = b.units;
    for (;;) {
        if (numerator % denominator === 0n) {
            const result = { units: numerator / denominator, scale };
            if (result.scale > exports.MAX_MONEY_PRECISION) {
                throw new MoneyError(`除法后标度 ${result.scale} 超出上限 ${exports.MAX_MONEY_PRECISION}`);
            }
            return result;
        }
        if (scale >= exports.MAX_MONEY_PRECISION) {
            throw new MoneyError(`除法无法精确表示：${formatFixed(a)} / ${formatFixed(b)}`);
        }
        numerator *= 10n;
        scale += 1;
    }
}
function compare(a, b) {
    const scale = Math.max(a.scale, b.scale);
    const left = alignScale(a, scale).units;
    const right = alignScale(b, scale).units;
    if (left < right)
        return -1;
    if (left > right)
        return 1;
    return 0;
}
/** 总位数（含小数位）不得超过 precision；超了报错而不是截断。 */
function assertFits(value, precision = exports.DEFAULT_MONEY_PRECISION) {
    assertPrecision(precision);
    assertScale(value.scale);
    if (value.scale > precision) {
        throw new MoneyError(`标度 ${value.scale} 大于精度 ${precision}`);
    }
    const abs = value.units < 0n ? -value.units : value.units;
    const max = 10n ** BigInt(precision) - 1n;
    if (abs > max) {
        throw new MoneyError(`定点溢出：${formatFixed(value)} 超出 precision=${precision}`);
    }
    return value;
}
function roundTo(value, targetScale, mode) {
    assertScale(targetScale);
    if (targetScale > value.scale)
        return alignScale(value, targetScale);
    if (targetScale === value.scale)
        return value;
    const divisor = 10n ** BigInt(value.scale - targetScale);
    const truncated = value.units / divisor;
    const remainder = value.units % divisor;
    const absRem = remainder < 0n ? -remainder : remainder;
    const sign = value.units < 0n ? -1n : 1n;
    const twice = absRem * 2n;
    let bump = 0n;
    if (twice > divisor) {
        bump = sign;
    }
    else if (twice === divisor) {
        if (mode === 'half-up') {
            bump = sign;
        }
        else if (truncated % 2n !== 0n) {
            bump = sign;
        }
    }
    return { units: truncated + bump, scale: targetScale };
}
//# sourceMappingURL=money.js.map