import jwt from "jsonwebtoken";
import {
  API_KEY,
  LOGIN_JWT_SECRET,
  SECRET_KEY,
  TIFFINWALA_ADMIN,
} from "../config/config";

interface TokenPayload {
  iss: string;
  iat: number;
  jti: string;
}

export function generateToken() {
  const tokenCreationTime = Math.floor(Date.now() / 1000);

  const tokenPayload: TokenPayload = {
    iss: API_KEY!,
    iat: tokenCreationTime,
    jti: `xyz_${tokenCreationTime}`,
  };
  return jwt.sign(tokenPayload, SECRET_KEY!);
}

export function generateLoginToken(phoneNumber: string) {
  const tokenData = {
    iss: TIFFINWALA_ADMIN,
    phone: phoneNumber,
  };

  return jwt.sign(tokenData, LOGIN_JWT_SECRET!, {
    expiresIn: "24h",
  });
}

export function verifyToken(token: string) {
  const decoded = jwt.verify(token, LOGIN_JWT_SECRET!);
  if (decoded) {
    return true;
  }

  return false;
}
