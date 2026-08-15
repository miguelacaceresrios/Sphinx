// bot-local.js
// Corre el bot en modo long polling para desarrollo local (`npm run bot`).
// Mantiene un proceso prendido escuchando mensajes en tiempo real.

import { bot } from "./bot.js";

bot.launch();
console.log("🤖 Bot corriendo (long polling)...");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
