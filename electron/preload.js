'use strict';
// Preload script — runs in renderer context before page load.
// contextIsolation is ON so we use contextBridge to expose safe APIs.
// Currently no APIs are exposed — the frontend talks directly to the
// NestJS HTTP server on localhost:3000.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
});
