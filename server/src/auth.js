const jwt = require("jsonwebtoken");
const { db } = require("./db");
const { AppError, formatUser } = require("./utils");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in production.");
}

function createToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function authenticate(req, _res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return next(new AppError(401, "Authentication is required."));
  }

  try {
    const token = header.slice("Bearer ".length);
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db
      .prepare("SELECT id, name, email, created_at FROM users WHERE id = ?")
      .get(payload.sub);

    if (!user) {
      throw new AppError(401, "Your session is no longer valid.");
    }

    req.user = formatUser(user);
    return next();
  } catch (error) {
    return next(new AppError(401, "Invalid or expired token."));
  }
}

module.exports = {
  authenticate,
  createToken
};
