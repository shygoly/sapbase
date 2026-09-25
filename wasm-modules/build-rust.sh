#!/bin/sh
# 隔离构建器入口（原子模块准入闸 2）。
#
# 契约：/src 只读挂载源码，/out 挂载输出目录；本脚本只把 `.wasm` 放进 /out。
# 所有判定（哈希、双构建器对拍、闸 1）都在容器外做 —— 容器只负责关住编译过程。
#
# 环境（由调用方注入，保持与 scripts/toolchains.mjs 的配方一字不差）：
#   RUSTFLAGS / SOURCE_DATE_EPOCH / CARGO_NET_OFFLINE
set -eu

: "${CRATE_LIB:?CRATE_LIB 未注入（crate 库名，连字符已转下划线）}"

# cargo 的可变状态全部落在 tmpfs：根文件系统是只读的。
export CARGO_HOME="${CARGO_HOME:-/tmp/cargo-home}"
export CARGO_TARGET_DIR=/tmp/target
mkdir -p "$CARGO_HOME" "$CARGO_TARGET_DIR"

# 源码只读挂载，cargo 需要可写的工作副本（它会碰 Cargo.lock 的 mtime）。
WORK=/tmp/src
mkdir -p "$WORK"
cp -R /src/. "$WORK"/
# 丢掉提交方夹带的构建缓存：带着预构建的 target/ 进来，cargo 可能直接复用而不重编译，
# 产物就不再是"从这份源码复现出来的"。复现构建必须从零开始。
rm -rf "$WORK/target" "$WORK/.cargo"
cd "$WORK"

cargo build \
  --release \
  --target wasm32-unknown-unknown \
  --offline \
  --locked \
  --target-dir "$CARGO_TARGET_DIR" >&2

cp "$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/${CRATE_LIB}.wasm" /out/module.wasm
