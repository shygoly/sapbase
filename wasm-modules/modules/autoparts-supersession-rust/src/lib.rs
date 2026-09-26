//! 汽配替代链解析原子（旧件 → 新件，含方向与合并规则）。
//!
//! 为什么只输出 canonical / depth：宿主按 canonical 下标合并数量，模块不碰库存。
//! 方向单向：replacedBy[j] = 替代 j 的新件下标（-1 = 已是最新件）。
//! 成环必须报错，不许返回部分结果 —— 部分结果会被宿主当成"已经解析完"。
//!
//! ABI v1（小端，列优先）：
//!   输入：replacedBy
//!   输出：canonical（最末端下标）/ depth（跳数），末格 total = 不同 canonical 的个数
//!
//! 错误码：1 参数非法；2 成环或越界。走图有界（最多 n 步），不分配。
#![no_std]

use core::panic::PanicInfo;

const ERR_ARG: i32 = 1;
const ERR_CYCLE: i32 = 2;

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

/// 从 start 走到末端。成功返回 (canonical, depth)，失败返回 ERR_CYCLE。
unsafe fn walk(replaced_off: i32, start: i32, n: i32) -> Result<(i32, i32), i32> {
    let mut cur = start;
    let mut depth: i32 = 0;
    loop {
        let nxt = load_i32(replaced_off, cur);
        if nxt == -1 {
            return Ok((cur, depth));
        }
        if nxt < -1 || nxt >= n {
            return Err(ERR_CYCLE);
        }
        depth += 1;
        if depth > n {
            return Err(ERR_CYCLE);
        }
        cur = nxt;
    }
}

#[no_mangle]
pub extern "C" fn run(in_off: i32, n: i32, out_off: i32) -> i32 {
    if n < 0 || in_off < 0 || out_off < 0 {
        return ERR_ARG;
    }
    let replaced_off = in_off;
    let canonical_off = out_off;
    let depth_off = out_off + n * 4;

    unsafe {
        let mut i = 0;
        while i < n {
            match walk(replaced_off, i, n) {
                Ok((canonical, depth)) => {
                    store_i32(canonical_off, i, canonical);
                    store_i32(depth_off, i, depth);
                }
                Err(code) => return code,
            }
            i += 1;
        }
        // 不同 canonical 的个数：读回刚写的输出列，不另开缓冲区。
        let mut distinct: i32 = 0;
        i = 0;
        while i < n {
            let c = load_i32(canonical_off, i);
            let mut first = true;
            let mut k = 0;
            while k < i {
                if load_i32(canonical_off, k) == c {
                    first = false;
                    break;
                }
                k += 1;
            }
            if first {
                distinct += 1;
            }
            i += 1;
        }
        store_i32(out_off, n * 2, distinct);
    }
    0
}
