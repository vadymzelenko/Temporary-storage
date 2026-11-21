import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import fileRoutes from "./routes/file.routes.js";
import File from "./model/fileModels.js";
import { deleteFromSupabase } from "./services/supabase.service.js";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors({
    origin: (process.env.CLIENT_ORIGIN || "http://localhost:3000").split(","),
}));
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connected");
    })
    .catch((err) => {
        console.error("MongoDB error:", err.message);
        process.exit(1);
    });

app.use("/api/files", fileRoutes);

// Remove expired uploads from storage and the database every 5 minutes
setInterval(async () => {
    try {
        const expiredFiles = await File.find({ expiresAt: { $lt: new Date() } }).lean();

        for (const file of expiredFiles) {
            for (const path of file.supabasePaths) {
                // A file that is already gone must not block removal of the record.
                await deleteFromSupabase(path).catch((e) => console.error("Storage delete error:", e.message));
            }
            await File.findByIdAndDelete(file._id);
            console.log(`Deleted expired upload ${file._id} (${file.originalNames.length} files)`);
        }
    } catch (err) {
        console.error("Cleanup error:", err.message);
    }
}, 5 * 60 * 1000);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
