import { NextFunction, Request, Response } from "express";

export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  res.status(404).send("Endpoint not found");
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error(err);
  res.status(500).send("Something went wrong");
}
