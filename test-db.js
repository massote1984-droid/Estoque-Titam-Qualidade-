// MOCKED per web migration guidelines
export const db = {
  prepare: () => ({
    get: () => null,
    all: () => [],
    run: () => ({ changes: 0 })
  })
};
console.log('SQLite mock active');

