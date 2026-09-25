//! 可用库存原子（Compute Kernel）—— Rust 源码模块，零能力沙箱形态。
//!
//! 对应《ERP Space Platform 设计方案 v3》§6.2 的计算示例：
//!   可用库存 = 现有库存 - 已预留库存 + 在途库存
//!
//! 这是 Atomic Contract 中 `kind: "calculation"` 的实现体：宿主只把**整数列投影**
//! 写进线性内存并调用 `run`，模块不接收物料号、单据号或任何标识 —— 标识留在宿主
//! 一侧，宿主按下标回填。因此模块即使被完整逆向，也拿不到业务数据，
//! 而平台拿到的是"实现不可导出"的边界。
//!
//! ABI v1（小端）：
//!   run(in_off: i32, n: i32, out_off: i32) -> i32   （0 = 成功，非 0 = 参数非法）
//!   输入 @in_off : [on_hand: i32[n]] [reserved: i32[n]] [in_transit: i32[n]]
//!   输出 @out_off: [available: i32[n]] [total_available: i32]，共 n*4 + 4 字节
//!
//! 零能力：no_std、无 panic 运行时、不导入任何函数/表/全局量；内存由宿主通过
//! `--import-memory` 注入（有上限、可回收）。产物由闸 1 静态校验后才会被登记。
#![no_std]

use core::panic::PanicInfo;

/// panic = abort，且 no_std 下不引入格式化机器 —— 保证产物里没有任何
/// 能把信息写出去的路径（连 panic 消息都不存在）。
#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

/// ABI 版本。导出为 wasm **函数**：Rust/wasm-ld 无法把 `static` 导成值型常量全局
/// （它导的是地址）。宿主两种形态都认，见 static-gate 的导出校验。
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
    // 输入三段等长，输出 n*4 + 4 —— 上限由沙箱内存页约束，模块自身不做分配。
    let on_hand_off = in_off;
    let reserved_off = in_off + n * 4;
    let in_transit_off = in_off + n * 8;

    let mut total_available: i32 = 0;
    unsafe {
        let mut i = 0;
        while i < n {
            let available = load_i32(on_hand_off, i) - load_i32(reserved_off, i)
                + load_i32(in_transit_off, i);
            store_i32(out_off, i, available);
            total_available += available;
            i += 1;
        }
        // total 紧跟在 n 个 available 之后。
        store_i32(out_off, n, total_available);
    }
    0
}
