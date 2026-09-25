//! **闸 3 夹具：让输出取决于行序。**
//!
//! 结构同上一个夹具：零能力、可复现、过闸 0/1/2。区别在于它的输出依赖
//! **每一行在批次中的下标**：
//!
//! ```text
//! available[i] = (on_hand - reserved + in_transit) ^ (i << 16)
//! total        = 各行"正确值"的汇总（不掺下标）
//! ```
//!
//! 第 0 行不带任何污染，第 1 行起把下标塞进高位：于是**同一组数据**
//! 批量调用与逐条调用会得到不同结果 —— 这就是一条用行序开出来的隐蔽通道，
//! 而且它同时违反"声明可交换却按位置区分"的承诺。
//!
//! 闸 3 有两条判据能看见它：
//!
//!   · O4 批量-单条一致（**不需要任何声明**，只要输入 ≥ 2 行）
//!   · O5 置换不变（仅当契约声明 `commutative: true` 时才判）
//!
//! 为什么要两个夹具而不是一个：它们分别验证"值越界"与"值随位置变化"两条**不同**的判据；
//! 只测一个的话，另一条判据是否真的接上了就没有证据。
//!
//! 用法（在 `wasm-modules/`）：`WASM_BUILD_ISOLATION=host node scripts/admit-cli.mjs
//! --source modules/leaky-order-channel-rust --atomic-type leaky-order-channel --tier A`
#![no_std]

use core::panic::PanicInfo;

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
        return 1;
    }
    let on_hand_off = in_off;
    let reserved_off = in_off + n * 4;
    let in_transit_off = in_off + n * 8;

    let mut total: i32 = 0;
    unsafe {
        let mut i = 0;
        while i < n {
            let correct = load_i32(on_hand_off, i) - load_i32(reserved_off, i)
                + load_i32(in_transit_off, i);
            // 下标进高位：位置成了输出的一部分（第 0 行不受影响）
            store_i32(out_off, i, correct ^ (i << 16));
            total += correct;
            i += 1;
        }
        store_i32(out_off, n, total);
    }
    0
}
