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
      }
      
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
  const { phone } = req.params;
  const { address } = req.body;

  const updatedUser = await userModel.findOneAndUpdate(
    {
      phone,
    },
    {
      $set: { address },
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
    message: "User address updated successfully",
    data: {
      address: updatedUser.address,
    },
  });
}
