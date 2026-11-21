import File from "../model/fileModels.js";
import { uploadToSupabase, getSupabaseUrl } from "../services/supabase.service.js";
import archiver from "archiver";
import axios from "axios";
import mongoose from "mongoose";

const DEFAULT_TTL = Number(process.env.TTL_IN_SECONDS) || 3600;
const MAX_TTL = Number(process.env.MAX_TTL_IN_SECONDS) || 24 * 3600;
const PUBLIC_URL = (process.env.PUBLIC_URL || "http://localhost:3000").replace(/\/$/, "");

// Content-Disposition with a safe ASCII fallback and the original UTF-8 name (RFC 6266 / 5987).
const contentDisposition = (name) => {
    const ascii = name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
    return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
};

// Loads an upload by id; returns null and sends the response if it is missing, invalid or expired.
const findActive = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        res.status(404).json({ valid: false, message: "File not found" });
        return null;
    }
    const file = await File.findById(req.params.id);
    if (!file) {
        res.status(404).json({ valid: false, message: "File not found" });
        return null;
    }
    if (file.expiresAt < Date.now()) {
        res.status(410).json({ valid: false, message: "Link expired" });
        return null;
    }
    return file;
};

export const uploadFile = async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ error: "No files uploaded" });
        }

        const requested = parseInt(req.body.ttl, 10);
        const ttl = Math.min(requested > 0 ? requested : DEFAULT_TTL, MAX_TTL);
        const expiresAt = new Date(Date.now() + ttl * 1000);
        const originalNames = [];
        const supabasePaths = [];

        for (const file of files) {
            const path = await uploadToSupabase(file);
            originalNames.push(file.originalname);
            supabasePaths.push(path);
        }

        const newFile = await File.create({ originalNames, supabasePaths, expiresAt });

        res.json({ link: `${PUBLIC_URL}/open/${newFile._id}`, expiresAt });
    } catch (err) {
        console.error("Upload error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

export const getFile = async (req, res) => {
    try {
        const file = await findActive(req, res);
        if (!file) return;
        const index = parseInt(req.query.index, 10);
        if (!file.supabasePaths[index]) return res.status(404).json({ message: "File not found" });

        const ttl = Math.floor((file.expiresAt - Date.now()) / 1000);
        const url = await getSupabaseUrl(file.supabasePaths[index], ttl);

        const response = await axios({
            method: "get",
            url,
            responseType: "stream",
        });

        const filename = file.originalNames[index];
        res.setHeader("Content-Disposition", contentDisposition(filename));
        res.setHeader("Content-Type", response.headers["content-type"]);

        // Stream the file through the server so the storage URL is never exposed
        response.data.pipe(res);
    } catch (err) {
        console.error("File download error:", err.message);
        if (!res.headersSent) res.status(500).json({ error: "Download failed" });
        else res.end();
    }
};

export const checkFile = async (req, res) => {
    try {
        const file = await findActive(req, res);
        if (!file) return;

        res.status(200).json({
            valid: true,
            message: "File exists",
            file: {
                originalNames: file.originalNames,
                expiresAt: file.expiresAt,
            }
        });
    } catch (err) {
        res.status(500).json({ valid: false, message: "Server error" });
    }
};

export const downloadAllAsZip = async (req, res) => {
    try {
        const file = await findActive(req, res);
        if (!file) return;

        const zip = archiver("zip", { zlib: { level: 9 } });
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename="files-${file._id}.zip"`);

        zip.pipe(res);

        for (let i = 0; i < file.supabasePaths.length; i++) {
            const path = file.supabasePaths[i];
            const ttl = Math.floor((file.expiresAt - Date.now()) / 1000);
            const url = await getSupabaseUrl(path, ttl);
            const response = await axios.get(url, { responseType: "stream" });

            const fileName = file.originalNames[i] || `file-${i}`;
            zip.append(response.data, { name: fileName });
        }

        await zip.finalize();
    } catch (err) {
        console.error("ZIP error:", err.message);
        if (!res.headersSent) res.status(500).send("Server error");
        else res.end();
    }
};
