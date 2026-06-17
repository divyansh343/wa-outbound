const bcrypt = require('bcryptjs');

/**
 * Basic password hashing utility (using node-crypto if bcryptjs isn't fully compiled,
 * but bcryptjs is standard and easy). Let's install bcryptjs.
 */
function hashPassword(password) {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

module.exports = {
  hashPassword,
  verifyPassword,
};
