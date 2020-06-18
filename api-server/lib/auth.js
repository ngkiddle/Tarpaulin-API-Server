const jwt = require('jsonwebtoken');

const secretKey = 'SuperSecret123';

exports.generateAuthToken = function (userId, role) {
  const payload = { sub: userId, role: role };
  return jwt.sign(payload, secretKey, { expiresIn: '24h' });
};

exports.requireAuthentication = async (req, res, next) => {
  /*
   * Authorization: Bearer <token>
   */
  const authHeader = req.get('Authorization') || '';
  const authHeaderParts = authHeader.split(' ');
  const token = authHeaderParts[0] === 'Bearer' ?
    authHeaderParts[1] : null;

  try {
    const payload = await jwt.verify(token, secretKey);
    req.user = payload.sub;
    req.role = payload.role;
    next();
  } catch (err) {
    console.error("  -- error:", err);
    return res.status(401).send({
      error: "Invalid authentication token"
    });
  }
};
