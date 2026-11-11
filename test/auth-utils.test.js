const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isPositiveInteger,
  isValidPassword,
  signAuthToken,
  verifyAuthToken,
} = require('../lib/auth-utils');

const secret = 'unit-test-secret-with-more-than-thirty-two-characters';

test('positive ID validator rejects booleans, strings, zero and unsafe integers', () => {
  assert.equal(isPositiveInteger(1), true);
  assert.equal(isPositiveInteger(Number.MAX_SAFE_INTEGER), true);
  assert.equal(isPositiveInteger(true), false);
  assert.equal(isPositiveInteger('1'), false);
  assert.equal(isPositiveInteger(0), false);
  assert.equal(isPositiveInteger(Number.MAX_SAFE_INTEGER + 1), false);
});

test('password validation enforces minimum characters and bcrypt byte limit', () => {
  assert.equal(isValidPassword('12345678'), true);
  assert.equal(isValidPassword('short'), false);
  assert.equal(isValidPassword('я'.repeat(37)), false);
  assert.equal(isValidPassword(null), false);
});

test('JWT binds a positive member ID and rejects invalid signatures', () => {
  const token = signAuthToken(42, secret);
  assert.equal(verifyAuthToken(token, secret), 42);
  assert.throws(() => verifyAuthToken(token, `${secret}-wrong`));
  assert.throws(() => signAuthToken(true, secret));
});
