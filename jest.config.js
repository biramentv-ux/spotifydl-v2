module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@auth/(.*)$': '<rootDir>/src/auth/$1',
    '^@download/(.*)$': '<rootDir>/src/download/$1',
    '^@metadata/(.*)$': '<rootDir>/src/metadata/$1',
    '^@plugins/(.*)$': '<rootDir>/src/plugins/$1',
    '^@visualizer/(.*)$': '<rootDir>/src/visualizer/$1',
    '^@graphql/(.*)$': '<rootDir>/src/graphql/$1',
    '^@neo4j/(.*)$': '<rootDir>/src/neo4j/$1',
    '^@ml/(.*)$': '<rootDir>/src/ml/$1',
    '^@websocket/(.*)$': '<rootDir>/src/websocket/$1',
    '^@bot/(.*)$': '<rootDir>/src/bot/$1',
    '^@webhook/(.*)$': '<rootDir>/src/webhook/$1',
    '^@cloud/(.*)$': '<rootDir>/src/cloud/$1',
    '^@updater/(.*)$': '<rootDir>/src/updater/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@extractor/(.*)$': '<rootDir>/src/extractor/$1',
    '^@api/(.*)$': '<rootDir>/src/api/$1'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html']
};
