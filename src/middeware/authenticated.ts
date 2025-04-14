import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/generateToken";

export async function IsAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const header = req.headers["authorization"];
  if (!header) {
    res.status(401).json({
      status: false,
      message: "Unauthorized",
    });
    return;
  }
  try {
    if (header?.startsWith("Bearer")) {
      const token = header.split(" ")[1];

      const isValid = verifyToken(token);

      if (!isValid) {
        res.status(401).json({
          status: false,
          message: "Unauthorized",
        });
        return;
      }

      next();
    } else {
      res.status(401).json({
        status: false,
        message: "Unauthorized",
      });
      return;
    }
  } catch (error) {
    res.status(401).json({
      status: false,
      message: "Unauthorized",
    });
    return;
  }
}
