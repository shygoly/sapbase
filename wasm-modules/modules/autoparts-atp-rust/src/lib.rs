//! 汽配 ATP 原子（可用量 + 替代件单向合并）。
//!
//! 为什么是纯计算、不查库：给定整数列必得输出，正是零能力沙箱的形状。
//! 标识（零件号）留在宿主；模块只看见下标与数量。替代方向由宿主投影
//! `replacedBy`（本行被哪个下标替代，-1 = 无）表达，模块不回向查找。
//!
//! ABI v1（小端，列优先）：
//!   run(in_off, n, out_off) -> i32   0=成功
//!   输入：onHand / reserved / committed / inTransit / replacedBy
//!   输出：atp / counted / replacedBy（回显），末格 total = Σ counted[j]×atp[j]
//!
//! 约定：第 0 行 = 被查询的零件；counted[j]=1 当且仅当从 j 沿 replacedBy 能走到 0。
//! 错误码：1 参数非法；2 成环或越界；8 溢出（不许静默回绕）。
#![no_std]

use core::panic::PanicInfo;

/// 1 = n/偏移非法。与 ABI v1 其它原子共用，便于宿主统一映射。
const ERR_ARG: i32 = 1;
/// 2 = replacedBy 成环或越界。必须报错，不许返回部分结果（会死循环或算错方向）。
const ERR_CYCLE: i32 = 2;
/// 8 = i32 溢出。overflow-checks=false 是为了产物确定，溢出必须走错误码。
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

/// i64 中间量落到 i32：溢出返回 None，调用方转成 ERR_OVERFLOW。
fn i32_from_i64(v: i64) -> Option<i32> {
    if v < i32::MIN as i64 || v > i32::MAX as i64 {
        None
    } else {
        Some(v as i32)
    }
}

/// 有界走图：从每个结点沿 replacedBy 最多走 n 步。
/// 步数超过 n 仍未碰到 -1 ⇒ 鸽笼原理，必有环。不分配、不递归。
unsafe fn validate_replaced_by(replaced_off: i32, n: i32) -> i32 {
    let mut j = 0;
    while j < n {
        let mut cur = j;
        let mut steps = 0;
        loop {
            let nxt = load_i32(replaced_off, cur);
            if nxt == -1 {
                break;
            }
            if nxt < -1 || nxt >= n {
                return ERR_CYCLE;
            }
            steps += 1;
            if steps > n {
                return ERR_CYCLE;
            }
            cur = nxt;
        }
        j += 1;
    }
    0
}

/// 从 j 沿 replacedBy 能否走到 0（含 j=0）。图已通过 validate，不会死循环。
unsafe fn reaches_zero(replaced_off: i32, j: i32, n: i32) -> bool {
    if j == 0 {
        return true;
    }
    let mut cur = j;
    let mut steps = 0;
    while steps <= n {
        let nxt = load_i32(replaced_off, cur);
        if nxt == -1 {
            return false;
        }
        if nxt == 0 {
            return true;
        }
        cur = nxt;
        steps += 1;
    }
    false
}

#[no_mangle]
pub extern "C" fn run(in_off: i32, n: i32, out_off: i32) -> i32 {
    if n < 0 || in_off < 0 || out_off < 0 {
        return ERR_ARG;
    }
    // 输入五段等长；输出三段 + total。上限由沙箱内存页约束，模块自身不做分配。
    let on_hand_off = in_off;
    let reserved_off = in_off + n * 4;
    let committed_off = in_off + n * 8;
    let in_transit_off = in_off + n * 12;
    let replaced_off = in_off + n * 16;

    let atp_off = out_off;
    let counted_off = out_off + n * 4;
    let echo_off = out_off + n * 8;

    unsafe {
        let graph_rc = validate_replaced_by(replaced_off, n);
        if graph_rc != 0 {
            return graph_rc;
        }

        let mut total: i64 = 0;
        let mut i = 0;
        while i < n {
            let on_hand = load_i32(on_hand_off, i) as i64;
            let reserved = load_i32(reserved_off, i) as i64;
            let committed = load_i32(committed_off, i) as i64;
            let in_transit = load_i32(in_transit_off, i) as i64;
            let replaced_by = load_i32(replaced_off, i);
            // atp = onHand − reserved − committed + inTransit；中间用 i64 避免静默回绕。
            let atp64 = on_hand - reserved - committed + in_transit;
            let atp = match i32_from_i64(atp64) {
                Some(v) => v,
                None => return ERR_OVERFLOW,
            };
            let counted = if reaches_zero(replaced_off, i, n) { 1 } else { 0 };
            store_i32(atp_off, i, atp);
            store_i32(counted_off, i, counted);
            store_i32(echo_off, i, replaced_by);
            total += (counted as i64) * (atp as i64);
            i += 1;
        }
        match i32_from_i64(total) {
            Some(v) => {
                store_i32(out_off, n * 3, v);
                0
            }
            None => ERR_OVERFLOW,
        }
    }
}
