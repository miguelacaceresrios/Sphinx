// bot-poll.js
// Revisa una sola vez si hay mensajes pendientes, los procesa, y termina.
// Pensado para correr desde un workflow de GitHub Actions cada cierto tiempo
// (`npm run bot:poll`), sin depender de una máquina o servidor prendido 24/7.

import { bot } from "./bot.js";
import { getUltimoUpdateId, setUltimoUpdateId } from "./db.js";

async function main() {
  const offset = getUltimoUpdateId();
  const updates = await bot.telegram.getUpdates(0, 100, offset + 1, undefined);

  if (updates.length === 0) {
    console.log("Sin mensajes nuevos.");
    return;
  }

  let maxId = offset;
  for (const update of updates) {
    await bot.handleUpdate(update);
    if (update.update_id > maxId) maxId = update.update_id;
  }
  setUltimoUpdateId(maxId);

  console.log(`Procesados ${updates.length} mensaje(s) nuevo(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode || 0));
