import { Request, Response } from "express";
import pointsModel from "../../models/points";

export async function savePointsHandler(req: Request, res: Response) {
  const { lower, upper, loyaltyPoints } = req.body;

  try {
    const points = await new pointsModel({
      lower,
      upper,
      loyaltyPoints,
    }).save();

    if (!points) {
      res.status(401).json({
        status: false,
        message: "error saving points",
      });
      return;
    }

    res.json({
      status: true,
      message: "points saved successfully",
    });
  } catch (error) {
    console.error("error saving points", error);
    res.status(500).json({
      status: false,
      message: "internal server error",
    });
  }
}

export async function getPointsHandler(req: Request, res: Response) {
  try {
    const points = await pointsModel.find({});
    res.json({
      status: true,
      points,
    });
  } catch (error) {
    console.error("error getting points", error);
    res.status(500).json({
      status: false,
      nessage: "internal server error",
    });
  }
}

export async function deletePointsHandler(req: Request, res: Response) {
  const id = req.params.id;

  try {
    const points = await pointsModel.findByIdAndDelete(id);
    if (!points) {
      res.status(404).json({
        status: false,
        message: "points not found",
      });
      return;
    }

    res.json({
      status: true,
      message: "delete successful",
    });
  } catch (error) {
    console.error("error deleting points", error);
    res.status(500).json({
      status: false,
      message: "internal server error",
    });
  }
}