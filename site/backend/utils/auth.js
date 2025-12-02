const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const generateAccessToken = (user, config) =>
  jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
      type: 'access'
    },
    config.security.jwtAccessSecret,
    { expiresIn: `${config.security.accessTokenMinutes}m` }
  );

const generateRefreshToken = (user, config) => {
  const tokenId = uuidv4();
  const payload = {
    sub: user.id,
    username: user.username,
    role: user.role,
    type: 'refresh',
    tokenId
  };

  const token = jwt.sign(payload, config.security.jwtRefreshSecret, {
    expiresIn: `${config.security.refreshTokenDays}d`
  });

  return {
    token,
    tokenId,
    expiresAt: new Date(
      Date.now() + config.security.refreshTokenDays * 24 * 60 * 60 * 1000
    ).toISOString()
  };
};

const authenticateToken = (config) => (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Требуется авторизация' });
  }

  jwt.verify(token, config.security.jwtAccessSecret, (err, payload) => {
    if (err) {
      return res.status(401).json({ message: 'Недействительный токен' });
    }

    req.user = {
      id: payload.sub,
      username: payload.username,
      role: payload.role
    };
    next();
  });
};

const permitRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Недостаточно прав' });
  }
  next();
};

module.exports = {
  authenticateToken,
  permitRoles,
  generateAccessToken,
  generateRefreshToken
};

