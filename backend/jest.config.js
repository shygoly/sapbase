module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.spec.ts',
    '!**/*.e2e-spec.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/test/**',
    '!**/main.ts',
    '!**/*.module.ts',
    '!**/*.config.ts',
    '!**/migrations/**',
    '!**/seeds/**',
  ],
  coverageDirectory: '../coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    // Domain layer should have higher coverage
    '**/domain/**': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    // Application layer should have high coverage
    '**/application/**': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // 桥接：@speckit/wasm-modules 的 workspace 链接尚未安装（需 npm ci，见
    // openspec/changes/add-wasm-atomic-runtime/tasks.md 的 M0）。先指向其构建产物；
    // 安装后此行可删（判定逻辑仍是同一份 dist，不产生第二套实现）。
    '^@speckit/wasm-modules$': '<rootDir>/../../wasm-modules/dist/index.js',
  },
  setupFilesAfterEnv: ['<rootDir>/../test/setup.ts'],
  testTimeout: 10000,
}
