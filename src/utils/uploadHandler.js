// // utils/uploadHandler.js
// import multer from "multer";
// import fs from "fs-extra";
// import path from "path";
// import { randomUUID } from "crypto";

// // Root upload directory
// const UPLOAD_DIR = path.join(process.cwd(), "uploads", "courses");

// // Ensure directory exists
// fs.ensureDirSync(UPLOAD_DIR);

// // Multer storage config
// const storage = multer.diskStorage({
//   destination: async (req, file, cb) => {
//     await fs.ensureDir(UPLOAD_DIR);
//     cb(null, UPLOAD_DIR);
//   },
//   filename: (req, file, cb) => {
//     try {
//       const ext = path.extname(file.originalname);
//       const fileName = `${randomUUID()}${ext}`;
//       cb(null, fileName);
//     } catch (err) {
//       cb(err);
//     }
//   },
// });

// export const upload = multer({ storage });


// utils/uploadHandler.js (updated)
import multer from "multer";
import fs from "fs-extra";
import path from "path";
import { randomUUID } from "crypto";

// Root upload directory for courses
const COURSE_UPLOAD_DIR = path.join(process.cwd(), "uploads", "courses");

// Ensure course directory exists
fs.ensureDirSync(COURSE_UPLOAD_DIR);

// Multer storage config for courses
const courseStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await fs.ensureDir(COURSE_UPLOAD_DIR);
    cb(null, COURSE_UPLOAD_DIR);
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

export const upload = multer({ storage: courseStorage });

// New: Multer storage config for quizzes
export const uploadQuizImage = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      if (!req.quiz || !req.quiz.lessonId) {
        return cb(new Error('Quiz or lesson information not available'));
      }
      const lessonId = req.quiz.lessonId;
      const quizUploadDir = path.join(process.cwd(), "uploads", "quizzes", `lesson_${lessonId}`);
      await fs.ensureDir(quizUploadDir);
      cb(null, quizUploadDir);
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
  }),
});