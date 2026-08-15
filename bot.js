// bot.js
// Configura el bot de Telegram (comandos, permisos, lógica de búsqueda) pero no lo arranca.
// Quien lo importa decide cómo correrlo: long polling local (bot-local.js) o un solo
// chequeo de mensajes pendientes (bot-poll.js, pensado para GitHub Actions).

import "dotenv/config";
import { Telegraf } from "telegraf";
import Anthropic from "@anthropic-ai/sdk";
import { buscarRecursos, listarTodo, contarRecursos } from "./db.js";

export const bot = new Telegraf(process.env.TG_BOT_TOKEN);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

  await ctx.sendChatAction("typing");

  // Búsqueda simple por palabras clave de la pregunta, y le pasamos los resultados a Claude
  // para que arme una respuesta en lenguaje natural (no es necesario que el usuario sepa
  // cómo se llama exactamente el archivo).
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

  const contexto = candidatos
    .slice(0, 25)
    .map(
      (r) =>
        `- [${r.categoria}] ${r.nombre_archivo}${r.resumen ? ` — ${r.resumen}` : ""} (${r.link_mensaje})`
    )
    .join("\n");

  const respuesta = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `Eres un asistente que ayuda a encontrar recursos en un canal de Telegram indexado. Aquí están los recursos relevantes que encontré para la pregunta del usuario:\n\n${contexto || "(no se encontraron coincidencias)"}\n\nPregunta del usuario: "${pregunta}"\n\nResponde en español, de forma breve y clara, en formato de lista si aplica. Si no hay resultados relevantes, dilo directamente y sugiere reformular la pregunta. No inventes recursos que no estén en la lista.`,
      },
    ],
  });

  const texto = respuesta.content.find((b) => b.type === "text")?.text ?? "No pude generar una respuesta.";
  await ctx.reply(texto);
});
