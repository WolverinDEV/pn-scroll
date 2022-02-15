// @ts-check

const config = {
    rootDir: './',
    collectCoverage: true,
    collectCoverageFrom: [
        '<rootDir>/**/*.js',
        '<rootDir>/**/*.ts',
        '!**/coverage/**',
        '!**/dist/**',
    ],
    projects: [
        {
            testPathIgnorePatterns: [".*\.js"],
            coveragePathIgnorePatterns: [".*"],
        },
    ],
};

module.exports = config;
