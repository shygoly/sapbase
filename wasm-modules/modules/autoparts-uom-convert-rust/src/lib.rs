//! 汽配单位换算原子（无浮点误差）。
//!
//! 为什么禁止 f64：JS/IEEE754 的 0.1+0.2 ≠ 0.3，金额与包装换算一旦进浮点就
//! 无法复现、也无法对账。数量用整数小单位（契约约定标度 3：2.500 箱 = 2500）。
//!
//! ABI v1（小端，列优先）：
//!   输入：qtyMinor / numerator / denominator / rounding
//!   输出：convertedMinor，末格 total = 各行之和
//!   rounding=0 只允许整除；=1 不整除时 half-up（一半及以上远离 0）
//!
//! 算法：纯整数 (qtyMinor × numerator) / denominator，余数用整数判定。
//! 错误码：1 参数非法；3 不整除；4 分母≤0 / 分子<0 / rounding 非法；8 溢出。
#![no_std]

use core::panic::PanicInfo;

const ERR_ARG: i32 = 1;
/// 3 = rounding=0 且不能整除。调用方必须换标度或改 rounding，不许"差不多 30"。
const ERR_INEXACT: i32 = 3;
/// 4 = 换算比非法。分母必须为正；分子不得为负（反向换算由宿主交换分子分母）。
const ERR_RATIO: i32 = 4;
const ERR_OVERFLOW: i32 = 8;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

#[no_mangle]
pub extern "C" fn abi_version() -> i32 {
    1
}

#[inline(always)]
unsafe fn load_i32(off: i32, i: i32) -> i32 {
    *((off + i * 4) as usize as *const i32)
}

#[inline(always)]
unsafe fn store_i32(off: i32, i: i32, value: i32) {
    *((off + i * 4) as usize as *mut i32) = value;
}

fn i32_from_i64(v: i64) -> Option<i32> {
    if v < i32::MIN as i64 || v > i32::MAX as i64 {
        None
    } else {
        Some(v as i32)
    }
}

/// 纯整数 half-up：|余数|×2 ≥ |分母| 则远离 0 进一。
/// 不用浮点比较，避免 2.5 箱变成 29.999999。
fn half_up(quot: i64, rem: i64, denom: i64) -> i64 {
    let abs_rem = if rem < 0 { -rem } else { rem };
    let abs_den = if denom < 0 { -denom } else { denom };
    if abs_rem * 2 >= abs_den {
        if quot >= 0 {
            quot + 1
        } else {
            quot - 1
        }
    } else {
        quot
    }
}

#[no_mangle]
pub extern "C" fn run(in_off: i32, n: i32, out_off: i32) -> i32 {
    if n < 0 || in_off < 0 || out_off < 0 {
        return ERR_ARG;
    }
    let qty_off = in_off;
    let num_off = in_off + n * 4;
    let den_off = in_off + n * 8;
    let rnd_off = in_off + n * 12;

    unsafe {
        let mut total: i64 = 0;
        let mut i = 0;
        while i < n {
            let qty = load_i32(qty_off, i) as i64;
            let numerator = load_i32(num_off, i);
            let denominator = load_i32(den_off, i);
            let rounding = load_i32(rnd_off, i);
            if denominator <= 0 || numerator < 0 || (rounding != 0 && rounding != 1) {
                return ERR_RATIO;
            }
            // i32×i32 必进 i64，不会在这一步溢出。
            let product = qty * (numerator as i64);
            let denom = denominator as i64;
            let quot = product / denom;
            let rem = product % denom;
            let converted = if rem == 0 {
                quot
            } else if rounding == 0 {
                return ERR_INEXACT;
            } else {
                half_up(quot, rem, denom)
            };
            let stored = match i32_from_i64(converted) {
                Some(v) => v,
                None => return ERR_OVERFLOW,
            };
            store_i32(out_off, i, stored);
            total += converted;
            i += 1;
        }
        match i32_from_i64(total) {
            Some(v) => {
                store_i32(out_off, n, v);
                0
            }
            None => ERR_OVERFLOW,
        }
    }
}
