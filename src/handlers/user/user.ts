import { Request, Response } from "express";
import userModel from "../../models/user";

export async function GetUserHandler(req: Request, res: Response) {
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
    data: {
      firstName: user.firstName,
      lastName: user.lastName,
      address: user.address,
    },
  });
}

export async function UpdateNameHandler(req: Request, res: Response) {
  const { phone } = req.params;
  const { firstName, lastName } = req.body;

  const updatedUser = await userModel.findOneAndUpdate(
    {
      phone,
    },
    {
      $set: {
        firstName,
        lastName,
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
    message: "User name updated successfully",
    data: {
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
    },
  });
}

export async function UpdateAddressHandler(req: Request, res: Response) {
  try {
    const { phone } = req.params;
    const { address } = req.body;

    if (!phone || !address) {
      res.status(400).json({
        status: false,
        message: "Missing phone or address in request body",
      });
      return;
    }

    const updatedUser = await userModel.findOneAndUpdate(
      { phone },
      {
        $push: {
          address: { address },
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      res.status(404).json({
        status: false,
        message: "User not found",
      });
      return
    }

    res.json({
      status: true,
      message: "Address added successfully",
      data: {
        addresses: updatedUser.address,
      },
    });
    return
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error instanceof Error ? error.message : String(error),
    });
    return
  }
}
