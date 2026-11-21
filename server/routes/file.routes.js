import express from "express";
import multer from "multer";
import { uploadFile, getFile, checkFile, downloadAllAsZip } from "../controllers/file.controller.js";

const router = express.Router();
const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB) || 50;
const MAX_FILES = Number(process.env.MAX_FILES) || 20;

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024, files: MAX_FILES },
});

// Turns multer limit errors into a clear 413 response instead of a 500.
const uploadFiles = (req, res, next) =>
    upload.array("files")(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(413).json({ error: `Upload limit: ${MAX_FILES} files, ${MAX_FILE_SIZE_MB} MB each` });
        }
        next(err);
    });

router.post("/upload", uploadFiles, uploadFile);
router.get("/check/:id", checkFile);
router.get("/:id", getFile);
router.get("/:id/zip", downloadAllAsZip);

export default router;
