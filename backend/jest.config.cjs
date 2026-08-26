/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  rootDir: ".",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  setupFiles: ["<rootDir>/tests/setup-env.cjs"],
  moduleFileExtensions: ["ts", "js", "json"],
  // Source files import sibling modules with an explicit ".js" extension
  // (required by "moduleResolution": "nodenext" at runtime). Jest resolves
  // modules itself, so this maps those specifiers back to the ".ts" files.
  moduleNameMapper: {
    // The real generated client uses top-level `import.meta.url`, which
    // cannot run under the CommonJS transform below — see the stub file for
    // the full explanation. Listed before the generic ".js" stripper so it
    // takes priority.
    "generated/prisma/client\\.js$": "<rootDir>/tests/mocks/generated-prisma-client.ts",
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: {
          module: "commonjs",
          moduleResolution: "node",
          esModuleInterop: true,
          target: "es2022",
          strict: true,
          types: ["jest", "node"]
        }
      }
    ]
  },
  // Resets mock.calls AND any mockResolvedValue/mockImplementation set by the
  // previous test, so a forgotten `mockResolvedValueOnce` chain in one test
  // can never leak a stale return value into the next one.
  resetMocks: true,
  collectCoverageFrom: [
    "src/services/**/*.ts",
    "src/utils/**/*.ts",
    "src/errors/**/*.ts"
  ]
}
