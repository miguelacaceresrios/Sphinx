// indexer.js
// Escanea el canal y guarda la metadata de cada archivo nuevo tal cual viene de Telegram
// (nombre, caption, tipo). Se corre manualmente (`npm run index`) o vía GitHub Actions.

import "dotenv/config";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";
import crypto from "crypto";
import {
  getUltimoMessageId,
  setUltimoMessageId,
  existeHash,
  guardarRecurso,
} from "./db.js";

const apiId = Number(process.env.TG_API_ID);
const apiHash = process.env.TG_API_HASH;
const canal = process.env.TG_CHANNEL;

// La sesión se guarda en un archivo local para no tener que loguearse cada vez.
// En CI (GitHub Actions) no hay filesystem persistente, así que ahí se usa el secret
// TG_SESSION directamente — con una sesión ya autorizada, GramJS no pide teléfono ni código.
import fs from "fs";
const SESSION_FILE = "data/session.txt";
const sessionString =
  process.env.TG_SESSION ||
  (fs.existsSync(SESSION_FILE) ? fs.readFileSync(SESSION_FILE, "utf-8") : "");

// La versión de GramJS instalada solo reconoce links de invitación viejos
// (t.me/joinchat/HASH), no el formato nuevo (t.me/+HASH) que usa Telegram hoy.
// Por eso los links "+..." se resuelven a mano con CheckChatInvite.
async function resolverCanal(client, canal) {
  const invite = canal.match(/t\.me\/\+([\w-]+)/i) || canal.match(/^\+([\w-]+)$/);
  if (invite) {
    const resultado = await client.invoke(
      new Api.messages.CheckChatInvite({ hash: invite[1] })
    );
    if (resultado instanceof Api.ChatInviteAlready || resultado.chat) {
      return resultado.chat;
    }
    throw new Error(
      "No eres miembro de ese canal todavía — únete desde la app de Telegram y corre el indexador de nuevo."
    );
  }

  // Link a un mensaje puntual dentro de un canal privado (t.me/c/ID/mensaje) — de ahí
  // sacamos el ID del canal. Hace falta haber cargado los diálogos al menos una vez
  // para que GramJS tenga en caché el access_hash de un canal privado.
  const canalPrivado = canal.match(/t\.me\/c\/(\d+)/i);
  if (canalPrivado) {
    await client.getDialogs({});
    return client.getEntity(canalPrivado[1]);
  }

  return client.getEntity(canal);
}

function categorizar(nombre, caption) {
  const texto = `${nombre || ""} ${caption || ""}`.toLowerCase();
  if (/\.pdf$/.test(texto)) return "pdf";
  if (/\.(zip|rar|7z)$/.test(texto)) return "comprimido";
  if (/\.(jpg|jpeg|png|webp)$/.test(texto)) return "imagen";
  if (/\.(mp4|mkv|avi)$/.test(texto)) return "video";
  return "otro";
}

async function main() {
  const client = new TelegramClient(
    new StringSession(sessionString),
    apiId,
    apiHash,
    { connectionRetries: 5 }
  );

  await client.start({
    phoneNumber: async () => await input.text("Tu número de teléfono (+57...): "),
    password: async () => await input.text("Contraseña 2FA (si tienes, si no ENTER): "),
    phoneCode: async () => await input.text("Código que te llegó por Telegram: "),
    onError: (err) => console.error(err),
  });

  // Guardamos la sesión para no tener que volver a loguearnos
  fs.writeFileSync(SESSION_FILE, client.session.save());
  console.log("✅ Sesión guardada en", SESSION_FILE);

  const entity = await resolverCanal(client, canal);
  const ultimoId = getUltimoMessageId(canal);
  console.log(`Escaneando "${canal}" desde message_id > ${ultimoId}...`);

  const mensajes = await client.getMessages(entity, {
    limit: 200,
    minId: ultimoId,
  });

  // getMessages trae del más nuevo al más viejo; procesamos en orden cronológico
  const ordenados = mensajes.reverse();
  let nuevos = 0;
  let maxId = ultimoId;

  for (const m of ordenados) {
    if (m.id > maxId) maxId = m.id;
    if (!m.media) continue; // solo nos interesan archivos

    const doc = m.media.document;
    const nombreAttr = doc?.attributes?.find((a) => a.fileName)?.fileName;
    const nombreArchivo = nombreAttr || m.message || `archivo_${m.id}`;
    const caption = m.message || "";

    // Hash simple basado en el file reference / tamaño para detectar duplicados
    const hashBase = `${doc?.size || ""}_${nombreArchivo}`;
    const hash = crypto.createHash("sha256").update(hashBase).digest("hex");

    const dup = existeHash(hash);
    if (dup) {
      console.log(`↩️  Duplicado de "${dup.nombre_archivo}", se omite.`);
      continue;
    }

    const categoria = categorizar(nombreArchivo, caption);

    guardarRecurso({
      message_id: m.id,
      canal,
      nombre_archivo: nombreArchivo,
      caption,
      tipo: doc?.mimeType || "desconocido",
      hash,
      categoria,
      fecha_mensaje: m.date ? new Date(m.date * 1000).toISOString() : null,
      link_mensaje: `https://t.me/c/${String(entity.id).replace("-100", "")}/${m.id}`,
    });

    nuevos++;
    console.log(`✅ Indexado: ${nombreArchivo}${caption ? ` — ${caption}` : ""}`);
  }

  setUltimoMessageId(canal, maxId);
  console.log(`\nListo. ${nuevos} recursos nuevos indexados.`);
  await client.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
