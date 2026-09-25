module.exports = {
  cacheDirectory: '<rootDir>/.jest-cache',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/support/scval-matchers.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  coverageReporters: ['text-summary', 'lcov', 'json-summary'],
  // Floor set just under the measured baseline; ratchet towards 60 (see CONTRIBUTING.md).
  coverageThreshold: { global: { branches: 43, functions: 55, lines: 55, statements: 55 } },
};
