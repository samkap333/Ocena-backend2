const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Tenant, User } = require('../models/crm');

function getJwtSecret(name, fallback) {
  const secret = process.env[name];
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} is required`);
  }

  return fallback;
}

function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId },
    getJwtSecret('JWT_SECRET', 'ocena-local-dev-jwt-secret'),
    { expiresIn: '15m' }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { id: user.id, tenantId: user.tenantId },
    getJwtSecret('REFRESH_TOKEN_SECRET', 'ocena-local-dev-refresh-secret'),
    { expiresIn: '7d' }
  );
}

function publicUser(user) {
  const source = typeof user.toObject === 'function' ? user.toObject() : user;
  const { password, refreshToken, ...safeUser } = source;
  return safeUser;
}

exports.register = async (req, res, next) => {
  try {
    const { email, password, name, tenantName } = req.body;
    const tenant = await Tenant.create({ name: tenantName || `${name}'s Workspace` });
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({ email, password: hashedPassword, name, role: 'ADMIN', tenantId: tenant._id });
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    user.refreshToken = refreshToken;
    await user.save();
    return res.status(201).json({ user: publicUser(user), tokens: { accessToken, refreshToken } });
  } catch (error) {
    return next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    user.refreshToken = refreshToken;
    await user.save();
    return res.json({ user: publicUser(user), tokens: { accessToken, refreshToken } });
  } catch (error) {
    return next(error);
  }
};

exports.refresh = async (req, res, next) => {
  try {
    const payload = jwt.verify(
      req.body.refreshToken,
      getJwtSecret('REFRESH_TOKEN_SECRET', 'ocena-local-dev-refresh-secret')
    );
    const user = await User.findOne({ _id: payload.id, refreshToken: req.body.refreshToken });
    if (!user) return res.status(401).json({ message: 'Invalid refresh token' });
    return res.json({ accessToken: signAccessToken(user) });
  } catch (error) {
    return next(error);
  }
};

exports.me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    return res.json(publicUser(user));
  } catch (error) {
    return next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { refreshToken: null });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};
