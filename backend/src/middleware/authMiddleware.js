const jwt = require("jsonwebtoken");
const env = require("../config/env");
const User = require("../models/User");

function unauthorized(message = "Unauthorized") {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
}

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.get("Authorization") || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      throw unauthorized();
    }

    if (!env.jwtSecret) {
      throw unauthorized("Authentication is not configured.");
    }

    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.userId).select(
      "name email createdAt"
    );

    if (!user) {
      throw unauthorized();
    }

    req.user = user;
    req.userId = user._id;
    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(unauthorized("Session expired."));
    }

    if (error.name === "JsonWebTokenError") {
      return next(unauthorized());
    }

    return next(error.statusCode ? error : unauthorized());
  }
}

module.exports = authMiddleware;
