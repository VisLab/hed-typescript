module.exports = {
  testEnvironment: 'node',
  transform: {
    '\\.xml$': '<rootDir>/xml-transformer.cjs',
    '^.+\\.(js|jsx)$': 'babel-jest',
    '^.+\\.(ts|tsx)$': 'babel-jest',
  },
  transformIgnorePatterns: ['/node_modules/(?!unicode-name|semver)'],
  testPathIgnorePatterns: ['node_modules/', '<rootDir>/spec_tests/hed-tests/'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  collectCoverageFrom: ['src/**/*.(js|ts)', '!src/**/*.spec.js', '!src/**/*.test.js'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/spec_tests/',
    '/coverage/',
    '/docs/',
    '/scripts/',
    '\\.spec\\.js$',
    '\\.test\\.js$',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageProvider: 'v8',
}
