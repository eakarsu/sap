const USER_ROLES = new Set(['admin', 'manager', 'user']);

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validPassword(value, minimumLength = 16) {
  return typeof value === 'string' && value.length >= minimumLength;
}

function normalizeRole(value, fallback = 'user') {
  const role = String(value || fallback).trim().toLowerCase();
  return USER_ROLES.has(role) ? role : null;
}

module.exports = { normalizeEmail, normalizeRole, validPassword };
