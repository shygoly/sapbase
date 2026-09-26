//! 汽配信用检查原子（结论 + 依据同时给出）。
//!
//! 为什么依据三项必须回显：契约禁止只返回"通过/不通过"——没有额度/应收/本单，
//! 调用方无法向客户解释，也无法审计。模块不做决策策略，只算 available 与 overLimit。
//!
//! ABI v1（小端，列优先）：
//!   输入：limitMinor / receivableMinor / inFlightMinor / orderMinor
//!   输出：availableMinor / overLimit / limitMinor / receivableMinor / orderMinor
//!   total = availableMinor 之和（单行时即该行可用额度）
//!
//! available = limit − receivable − inFlight；overLimit = order > available ? 1 : 0
//! 错误码：1 参数非法；7 负数入参；8 溢出。
#![no_std]

use core::panic::PanicInfo;

const ERR_ARG: i32 = 1;
const ERR_NEGATIVE: i32 = 7;
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

#[no_mangle]
pub extern "C" fn run(in_off: i32, n: i32, out_off: i32) -> i32 {
    if n < 0 || in_off < 0 || out_off < 0 {
        return ERR_ARG;
    }
    let limit_off = in_off;
    let recv_off = in_off + n * 4;
    let flight_off = in_off + n * 8;
    let order_off = in_off + n * 12;

    let avail_off = out_off;
    let over_off = out_off + n * 4;
    let echo_limit_off = out_off + n * 8;
    let echo_recv_off = out_off + n * 12;
    let echo_order_off = out_off + n * 16;

    unsafe {
        let mut total: i64 = 0;
        let mut i = 0;
        while i < n {
            let limit = load_i32(limit_off, i);
            let receivable = load_i32(recv_off, i);
            let in_flight = load_i32(flight_off, i);
            let order = load_i32(order_off, i);
            if limit < 0 || receivable < 0 || in_flight < 0 || order < 0 {
                return ERR_NEGATIVE;
            }
            let available64 = (limit as i64) - (receivable as i64) - (in_flight as i64);
            let available = match i32_from_i64(available64) {
                Some(v) => v,
                None => return ERR_OVERFLOW,
            };
            let over_limit = if (order as i64) > available64 { 1 } else { 0 };
            store_i32(avail_off, i, available);
            store_i32(over_off, i, over_limit);
            store_i32(echo_limit_off, i, limit);
            store_i32(echo_recv_off, i, receivable);
            store_i32(echo_order_off, i, order);
            total += available64;
            i += 1;
        }
        match i32_from_i64(total) {
            Some(v) => {
                store_i32(out_off, n * 5, v);
                0
            }
            None => ERR_OVERFLOW,
        }
    }
}
