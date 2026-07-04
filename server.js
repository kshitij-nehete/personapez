import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import chatRoute from "./chatRoute.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

app.use("/api", chatRoute);

app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "PersonaPez is running" });
});

app.listen(PORT, () => {
  console.log(`PersonaPez running on http://localhost:${PORT}`);
});
