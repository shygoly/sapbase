//! 汽配价格解析原子（优先级显式且确定）。
//!
//! 为什么优先级写死在模块里：契约要求"MUST NOT 由调用方任选一个"。
//! 选择规则唯一：最小 kind → 同 kind 最大 minQty → 仍并列取下标最小。
//! kind：0 客户等级价 / 1 阶梯价 / 2 最近成交价 / 3 标准价。
//!
//! ABI v1（小端，列优先）：
//!   输入：kind / minQty / priceMinor
//!   输出：selected（0/1）/ kind / priceMinor，末格 total = 中选价格
//!
//! 错误码：1 参数非法；5 缺标准价；6 非法 kind。
//! 标准价必须存在：它是回落锚点，缺了就无法给出确定价格。
#![no_std]

use core::panic::PanicInfo;

const ERR_ARG: i32 = 1;
const ERR_NO_STANDARD: i32 = 5;
const ERR_KIND: i32 = 6;

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

#[no_mangle]
pub extern "C" fn run(in_off: i32, n: i32, out_off: i32) -> i32 {
    if n < 0 || in_off < 0 || out_off < 0 {
        return ERR_ARG;
    }
    let kind_off = in_off;
    let min_qty_off = in_off + n * 4;
    let price_off = in_off + n * 8;

    let selected_off = out_off;
    let out_kind_off = out_off + n * 4;
    let out_price_off = out_off + n * 8;

    unsafe {
        let mut has_standard = false;
        let mut i = 0;
        while i < n {
            let kind = load_i32(kind_off, i);
            if kind < 0 || kind > 3 {
                return ERR_KIND;
            }
            if kind == 3 {
                has_standard = true;
            }
            i += 1;
        }
        if !has_standard {
            return ERR_NO_STANDARD;
        }

        // 先找最小 kind，再在该 kind 里取最大 minQty，并列取最小下标。
        let mut best_idx: i32 = -1;
        let mut best_kind: i32 = 4;
        let mut best_min_qty: i32 = i32::MIN;
        i = 0;
        while i < n {
            let kind = load_i32(kind_off, i);
            let min_qty = load_i32(min_qty_off, i);
            let better = if best_idx < 0 {
                true
            } else if kind < best_kind {
                true
            } else if kind == best_kind && min_qty > best_min_qty {
                true
            } else {
                false
            };
            if better {
                best_idx = i;
                best_kind = kind;
                best_min_qty = min_qty;
            }
            i += 1;
        }

        let win_price = load_i32(price_off, best_idx);
        i = 0;
        while i < n {
            let selected = if i == best_idx { 1 } else { 0 };
            store_i32(selected_off, i, selected);
            store_i32(out_kind_off, i, load_i32(kind_off, i));
            store_i32(out_price_off, i, load_i32(price_off, i));
            i += 1;
        }
        store_i32(out_off, n * 3, win_price);
    }
    0
}
