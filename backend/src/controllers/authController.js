const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const User = require("../models/User");
const { recordActivity } = require("../services/activityService");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;
const SALT_ROUNDS = 12;

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sanitizeName(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function sanitizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function toPublicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt
  };
}

function signToken(user) {
  if (!env.jwtSecret) {
    throw createHttpError(500, "JWT secret is not configured.");
  }

  return jwt.sign({ userId: user._id.toString() }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn
  });
}

async function register(req, res) {
  const name = sanitizeName(req.body.name);
  const email = sanitizeEmail(req.body.email);
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const confirmPassword =
    typeof req.body.confirmPassword === "string" ? req.body.confirmPassword : "";

  if (!name) {
    throw createHttpError(400, "Full name is required.");
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw createHttpError(400, "Enter a valid email address.");
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    throw createHttpError(400, "Password must be at least 8 characters.");
  }

  if (password !== confirmPassword) {
    throw createHttpError(400, "Password confirmation must match.");
  }

  const existingUser = await User.findOne({ email }).select("_id").lean();

  if (existingUser) {
    throw createHttpError(409, "An account with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ name, email, passwordHash });
  await recordActivity({
    userId: user._id,
    type: "registration",
    title: "Account registered",
    metadata: {
      email: user.email
    }
  });

  return res.status(201).json({
    user: toPublicUser(user),
    token: signToken(user)
  });
}

async function login(req, res) {
  const email = sanitizeEmail(req.body.email);
  const password = typeof req.body.password === "string" ? req.body.password : "";

  if (!EMAIL_PATTERN.test(email) || !password) {
    throw createHttpError(401, "Invalid credentials.");
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw createHttpError(401, "Invalid credentials.");
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    throw createHttpError(401, "Invalid credentials.");
  }

  await recordActivity({
    userId: user._id,
    type: "login",
    title: "Logged in",
    metadata: {
      email: user.email
    }
  });

  return res.status(200).json({
    user: toPublicUser(user),
    token: signToken(user)
  });
}

async function getCurrentUser(req, res) {
  return res.status(200).json({
    user: toPublicUser(req.user)
  });
}

module.exports = {
  register,
  login,
  getCurrentUser
};
