import { Request, Response } from "express";
import userModel from "../../models/user";

export async function AddPointsHandler(req: Request, res: Response) {
  const { phone, points } = req.body;

  try {
    const updatedUser = await userModel.findOneAndUpdate(
      { phone },
      {
        $inc: {
          loyaltyPoints: points,
        },
      },
      {
        new: true,
      }
    );

    if (!updatedUser) {
      res.status(400).json({
        status: false,
        message: "User not found",
      });
      return;
    }

    res.json({
      status: true,
      message: "Points added successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error adding points:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
}

export async function GetPointsHandler(req: Request, res: Response) {
  const { phone } = req.params;

  const user = await userModel.findOne({ phone });

  if (!user) {
    res.status(400).json({
      status: false,
      message: "User not found",
    });
    return;
  }

  res.json({
    status: true,
    message: "User found",
    data: user.loyaltyPoints,
  });
}
