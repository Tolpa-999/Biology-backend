import express from "express";
import { uploadVideo, uploadMiddleware, getSignedVideoUrl, getVideoStatus } from "./controller.js";

const router = express.Router();

// Admin upload with file (multipart/form-data)
router.post("/upload", uploadMiddleware, uploadVideo);

// Student fetch signed URL
router.get("/:id/signed-url", getSignedVideoUrl);


router.get("/:id", getVideoStatus);

export default router;
