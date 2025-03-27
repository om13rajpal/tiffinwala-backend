import { NextFunction, Request, Response } from "express";

export default function logger(
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.log(`Request: ${req.method} ${req.path} ${req.ip}`);
  next();
}
