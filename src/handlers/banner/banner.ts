import { Request, Response } from "express";
import bannerModel from "../../models/banners";

export async function uploadBannerHandler(req: Request, res: Response) {
  const fileUrl = (req.file as any)?.path;
  const { redirect } = req.body;

  if (!fileUrl) {
    res.status(400).json({
      status: false,
      message: "No file uploaded",
    });
    return;
  }

  const banner = await new bannerModel({
    url: fileUrl,
    redirect
  }).save();

  if (!banner) {
    res.status(500).json({
      status: false,
      message: "error saving banner",
    });
    return;
  }

  res.json({
    status: true,
    data: banner,
  });
}

export async function getAllBanners(req: Request, res: Response) {
  try {
    const banners = await bannerModel.find({});
    res.json({
      status: true,
      data: banners,
    });
  } catch (error) {
    console.error("Error getting banners", error);
    res.status(500).json({
      status: false,
      message: "internal server error",
    });
  }
}

export async function deleteBannerHandler(req: Request, res: Response) {
  const id = req.params.id;

  try {
    const banner = await bannerModel.findByIdAndDelete(id);
    if (!banner) {
      res.status(404).json({
        status: false,
        message: "banner not found",
      });
      return;
    }

    res.json({
      status: true,
      message: "banner deteled successfully",
    });
  } catch (error) {
    console.error("error deleting the banner", error);
    res.status(500).json({
      status: false,
      message: "internal server error",
    });
  }
}
