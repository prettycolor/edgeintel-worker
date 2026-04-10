import { BrowserWindow, Menu, Tray, app, nativeImage } from "electron";

let tray: Tray | null = null;

export function createTray(mainWindow: BrowserWindow) {
  const icon = nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="2" width="14" height="14" rx="4" fill="white"/>
        <path d="M6 6.5h6M6 9h4.5M6 11.5h6" stroke="black" stroke-width="1.4" stroke-linecap="round"/>
      </svg>`,
    ).toString("base64")}`,
  );
  tray = new Tray(icon);
  tray.setToolTip("EdgeIntel Connector");

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Open EdgeIntel Connector",
        click: () => {
          mainWindow.show();
          mainWindow.focus();
        },
      },
      {
        label: "Quit EdgeIntel Connector",
        click: () => app.quit(),
      },
    ]),
  );

  tray.on("click", () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

export function destroyTray() {
  tray?.destroy();
  tray = null;
}
