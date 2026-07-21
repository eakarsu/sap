const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEmail, normalizeRole, validPassword } = require('../lib/security');

test('login emails are normalized', () => {
  assert.equal(normalizeEmail(' Operator@Example.COM '), 'operator@example.com');
});

test('only supported roles are accepted', () => {
  assert.equal(normalizeRole('MANAGER'), 'manager');
  assert.equal(normalizeRole('super-admin'), null);
});

test('operator passwords require at least sixteen characters', () => {
  assert.equal(validPassword('short'), false);
  assert.equal(validPassword('SixteenChars!2026'), true);
});
