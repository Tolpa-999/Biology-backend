import prisma from "../../loaders/prisma.js";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import fs from "fs";
import jwt from "jsonwebtoken";

const BUNNY_API_KEY = process.env.BUNNY_API_KEY;
const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID;
const BUNNY_SIGNING_KEY = process.env.BUNNY_SIGNING_KEY;
const BUNNY_LIBRARY_HOSTNAME = process.env.BUNNY_LIBRARY_HOSTNAME;

// Multer setup (store locally first in /uploads folder)
const upload = multer({ dest: "uploads/" });
export const uploadMiddleware = upload.single("video");

//
// 🔹 Admin: Upload video
//
export const uploadVideo = async (req, res) => {
  try {
    const { title, courseId } = req.body;
    if (!title || !req.file) {
      return res.status(400).json({ error: "title and file are required" });
    }

    // 1. Create video entry in Bunny
    const response = await axios.post(
      `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos`,
      { title },
      { headers: { AccessKey: BUNNY_API_KEY } }
    );

    const videoId = response.data.guid; // Bunny’s video GUID

    // 2. Upload actual file
    const fileStream = fs.createReadStream(req.file.path);
    await axios.put(
      `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${videoId}`,
      fileStream,
      {
        headers: {
          AccessKey: BUNNY_API_KEY,
          "Content-Type": "application/octet-stream",
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );

    // Delete local temp file
    fs.unlinkSync(req.file.path);

    // 3. Save metadata in DB
    const file = await prisma.file.create({
      data: {
        id: uuidv4(),
        category: "COURSE",
        type: "VIDEO",
        ...(courseId && { courseId }), // only add if provided
        originalName: req.file.originalname,
        path: videoId, // store Bunny GUID
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });

    res.json({ message: "✅ Video uploaded to Bunny", file, videoId });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Video upload failed" });
  }
};

//
// 🔹 Student: Get signed playback URL
//
export const getSignedVideoUrl = async (req, res) => {
  try {
    const { id } = req.params; // DB file.id

    const file = await prisma.file.findUnique({ where: { id } });
    if (!file) {
      return res.status(404).json({ error: "Video not found" });
    }

    const expires = Math.floor(Date.now() / 1000) + 3600 * 10;

    // Only exp in payload
    const token = jwt.sign({ exp: expires }, BUNNY_SIGNING_KEY, {
      algorithm: "HS256",
    });

    // Playback link
    const playbackUrl = `https://${BUNNY_LIBRARY_HOSTNAME}/${file.path}/playlist.m3u8?token=${token}&expires=${expires}`;

    res.json({ playbackUrl, expiresAt: expires });
  } catch (err) {
    console.error("getSignedVideoUrl error:", err.message);
    res.status(500).json({ error: "Failed to generate signed URL" });
  }
};

//
// 🔹 Admin/Dev: Check video status on Bunny
//
//
// 🔹 Admin/Dev: Check video status on Bunny
//
export const getVideoStatus = async (req, res) => {
  try {
    const { id } = req.params; // Bunny video GUID

    const response = await axios.get(
      `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${id}`,
      {
        headers: { AccessKey: BUNNY_API_KEY },
      }
    );

    const statusMap = {
      0: "Not Uploaded",
      1: "Uploaded",
      2: "Processing",
      3: "Encoding",
      4: "Finished",
      5: "Failed",
    };

    const rawStatus = response.data.status;
    const statusText = statusMap[rawStatus] || "Unknown";

    res.json({
      videoId: id,
      status: rawStatus,
      statusText,
      meta: response.data,
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch video status" });
  }
};

