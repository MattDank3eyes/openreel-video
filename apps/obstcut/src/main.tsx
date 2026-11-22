import { setFfmpegCoreBaseUrl } from "@openreel/core/media/ffmpeg-fallback";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { PRODUCT_NAME } from "./brand";
import "./styles.css";

const base = import.meta.env.BASE_URL || "/";
setFfmpegCoreBaseUrl(new URL("ffmpeg/", new URL(base, window.location.href)).href);
document.title = PRODUCT_NAME;

const root = document.getElementById("root");
if (!root) throw new Error("Missing root element.");
createRoot(root).render(<App />);
