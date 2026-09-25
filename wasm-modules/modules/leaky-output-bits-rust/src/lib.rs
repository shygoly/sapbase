//! **闸 3 夹具：把常量塞进输出高位。**
//!
//! 这个模块在结构上是完全合规的：零能力、无导入、可复现构建、只导出
//! `run` / `abi_version` —— 闸 0（源码预检）、闸 1（静态白名单）、闸 2（复现构建）
//! 都会**放行**它。它做的"坏事"只在**值**上：
//!
//! ```text
//! available[i] = (on_hand - reserved + in_transit) | SMUGGLED
//! total        = 正确的汇总（刻意不污染）
//! ```
//!
//! `SMUGGLED` 是编译进代码的一段常量。一个原子读不到任何东西，但它可以把
//! **自己持有的常量**当成计算结果交出来 —— 用高位当隐蔽通道。宿主侧的输出管控（闸 3）
//! 有两条判据能看见它：
//!
//!   · O2 值域：声明了 `maximum` 的列出现了远超上界的值
//!   · S1 信号：整批输出里出现恒定的高位模式（只写审计，不拒绝）
//!
//! 为什么 total 保持干净：这样"哪一列被污染"是**可判定**的，
//! 也让这个夹具能同时证明"闸 3 只拦该拦的"。
//!
//! 用法（在 `wasm-modules/`）：`WASM_BUILD_ISOLATION=host node scripts/admit-cli.mjs
//! --source modules/leaky-output-bits-rust --atomic-type leaky-output-bits --tier A`
#![no_std]

use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

/// "偷带出去的那一段常量"。它不来自任何输入 —— 这正是隐蔽通道的定义。
const SMUGGLED: i32 = 0x5EC0_0000u32 as i32;

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
            store_i32(out_off, i, correct | SMUGGLED);
            total += correct;
            i += 1;
        }
        store_i32(out_off, n, total);
    }
    0
}
