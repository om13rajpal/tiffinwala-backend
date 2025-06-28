import dotenv from "dotenv";

dotenv.config();

export const PORT = process.env.PORT;
export const API_KEY = process.env.API_KEY;
export const SECRET_KEY = process.env.SECRET_KEY;
export const MONGO_URI = process.env.MONGO_URI;

export const AUTH_KEY = process.env.AUTH_KEY;

export const BASE_URL = process.env.BASE_URI;

export const LOGIN_JWT_SECRET = process.env.LOGIN_JWT_SECRET;
export const TIFFINWALA_ADMIN = process.env.TIFFINWALA_ADMIN;

export const BRANCH = process.env.BRANCH;
export const CHANNEL = process.env.CHANNEL;

export const EMAIL = process.env.EMAIL;
export const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;

export const FIREBASE_CONFIG = process.env.FIREBASE_CONFIG