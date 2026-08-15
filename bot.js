// bot.js
// Configura el bot de Telegram (comandos, permisos, lógica de búsqueda) pero no lo arranca.
// Quien lo importa decide cómo correrlo: long polling local (bot-local.js) o un solo
// chequeo de mensajes pendientes (bot-poll.js, pensado para GitHub Actions).
// Sin IA: busca por palabra clave y devuelve la lista tal cual, sin gastar tokens.

import "dotenv/config";
import { Telegraf } from "telegraf";
import { buscarRecursos, listarTodo, contarRecursos } from "./db.js";

export const bot = new Telegraf(process.env.TG_BOT_TOKEN);

const allowedIds = (process.env.ALLOWED_USER_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

bot.use((ctx, next) => {
  if (allowedIds.length === 0) return next(); // sin restricción si no se configuró
  const userId = String(ctx.from?.id);
  if (allowedIds.includes(userId)) return next();
  return ctx.reply("No tienes permiso para usar este bot.");
});

bot.start((ctx) =>
  ctx.reply(
    "¡Hola! Pregúntame lo que quieras sobre los recursos indexados, por ejemplo:\n" +
      '"¿qué mapas hay?"\n"muéstrame lo más nuevo"\n"busca algo de reglas de combate"'
  )
);

bot.command("total", (ctx) => {
  ctx.reply(`Hay ${contarRecursos()} recursos indexados en total.`);
});

bot.on("text", async (ctx) => {
  const pregunta = ctx.message.text;
  if (pregunta.startsWith("/")) return;

  // Búsqueda simple por palabras clave de la pregunta — sin IA, directo contra SQLite.
  const palabrasClave = pregunta
    .toLowerCase()
    .replace(/[¿?¡!.,]/g, "")
    .split(" ")
    .filter((w) => w.length > 3);

  let candidatos = [];
  for (const palabra of palabrasClave.slice(0, 4)) {
    candidatos.push(...buscarRecursos(palabra, 10));
  }
  if (candidatos.length === 0) candidatos = listarTodo(20);

  // Deduplicar por id
  const vistos = new Set();
  candidatos = candidatos.filter((r) => {
    if (vistos.has(r.id)) return false;
    vistos.add(r.id);
    return true;
  });

  if (candidatos.length === 0) {
    await ctx.reply("No encontré nada con esas palabras. Intenta con otro término.");
    return;
  }

  const texto = candidatos
    .slice(0, 25)
    .map(
      (r) =>
        `[${r.categoria}] ${r.nombre_archivo}${r.caption ? ` — ${r.caption}` : ""}\n${r.link_mensaje}`
    )
    .join("\n\n");

  await ctx.reply(texto);
});
