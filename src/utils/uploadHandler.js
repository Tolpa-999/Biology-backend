// utils/uploadHandler.js
import multer from "multer";
import fs from "fs-extra";
import path from "path";
import { randomUUID } from "crypto";

// Root upload directory
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "courses");

// Ensure directory exists
fs.ensureDirSync(UPLOAD_DIR);

// Multer storage config
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await fs.ensureDir(UPLOAD_DIR);
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    try {
      const ext = path.extname(file.originalname);
      const fileName = `${randomUUID()}${ext}`;
      cb(null, fileName);
    } catch (err) {
      cb(err);
    }
  },
});

export const upload = multer({ storage });