const jwt = require('jsonwebtoken');

function isPositiveInteger(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isValidPassword(password) {
  return typeof password === 'string'
    && password.length >= 8
    && Buffer.byteLength(password, 'utf8') <= 72;
}

function signAuthToken(memberId, secret) {
  if (!isPositiveInteger(memberId)) throw new TypeError('memberId must be a positive integer');
  return jwt.sign({ sub: String(memberId) }, secret, { expiresIn: '7d' });
}

function verifyAuthToken(token, secret) {
  const payload = jwt.verify(token, secret);
  const memberId = Number(payload.sub);
  if (!isPositiveInteger(memberId)) throw new Error('Invalid token subject');
  return memberId;
}

module.exports = { isPositiveInteger, isValidPassword, signAuthToken, verifyAuthToken };
