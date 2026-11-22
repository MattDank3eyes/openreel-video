import { app, BrowserWindow, dialog, Menu, session } from "electron";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { PRODUCT_NAME } from "./brand";

function showAbout(): void {
  void dialog.showMessageBox({
    type: "info",
    title: `About ${PRODUCT_NAME}`,
    message: PRODUCT_NAME,
    detail: "Timeline, word-by-word captions, noise removal, auto-ducking, and export.",
  });
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: PRODUCT_NAME,
    icon: path.join(__dirname, "../../assets/icon.png"),
    backgroundColor: "#14110e",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  void win.loadFile(path.join(__dirname, "../../renderer/index.html"));
}

app.setName(PRODUCT_NAME);

void app.whenReady().then(() => {
  session.defaultSession.on("will-download", (_event, item) => {
    const dir = app.getPath("downloads");
    mkdirSync(dir, { recursive: true });
    const target = path.join(dir, item.getFilename() || "OBSTcut.mp4");
    item.setSavePath(target);
  });
  app.setAboutPanelOptions({
    applicationName: PRODUCT_NAME,
    applicationVersion: app.getVersion(),
  });
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: PRODUCT_NAME,
        submenu: [
          { label: `About ${PRODUCT_NAME}`, click: showAbout },
          { type: "separator" },
          { role: "quit" },
        ],
      },
    ]),
  );
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
