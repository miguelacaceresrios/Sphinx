# Contexto del proyecto — Sphinx

Sphinx: indexador + bot de consulta para un canal de Telegram. El objetivo: la gente sube archivos a un canal sin explicar qué son, y este proyecto los indexa (nombre, caption, tipo) y deja un bot al que cualquiera (sin conocimientos técnicos) le puede escribir una palabra clave para encontrar recursos. Sin IA: se descartó a propósito (ver "Decisiones de diseño") para no depender de tokens/costo — es búsqueda por texto directa contra SQLite.

Se usa muy poco (según el usuario, "cada mil años"), así que el objetivo explícito es que **no dependa de la máquina ni de la cuenta de nadie estando prendida** — todo corre en GitHub Actions, gratis, bajo demanda.

## Arquitectura

- **`indexer.js`** — Se conecta a Telegram con **GramJS** (MTProto, usando la cuenta de usuario, no un bot — porque solo somos miembros del canal, no admins). Escanea mensajes nuevos desde el último `message_id` guardado, detecta duplicados por hash, y guarda nombre/caption/tipo tal cual vienen del mensaje — sin generar nada con IA.
- **`bot.js`** — Configura el bot de Telegraf (comandos, permisos, búsqueda por palabra clave contra SQLite, respuesta como lista formateada) pero **no lo arranca**. Dos entrypoints distintos lo importan:
  - **`bot-local.js`** (`npm run bot`) — long polling normal, para probar en tu máquina.
  - **`bot-poll.js`** (`npm run bot:poll`) — hace un solo `getUpdates`, procesa lo pendiente, guarda el último `update_id` en la tabla `bot_estado`, y termina. Es el que corre en GitHub Actions.
- **`db.js`** — SQLite (`better-sqlite3`), **sin WAL** (a propósito: así todo el estado vive en un único archivo `data/recursos.db`, sin un `-wal` aparte que se pueda perder al no commitearlo). Tablas: `recursos` (cada archivo indexado), `estado_indexado` (último `message_id` procesado por canal) y `bot_estado` (último `update_id` de Telegram procesado por el bot).

## Cómo queda desacoplado de la máquina del usuario

No hay servidor ni VM. Todo corre en **GitHub Actions**, con el estado (la base SQLite) guardado directamente en el repo:

- **`.github/workflows/bot-poll.yml`** — corre cada 30 min (+ disparo manual), revisa mensajes nuevos, responde, y commitea `data/recursos.db` de vuelta al repo si cambió.
- **`.github/workflows/indexer.yml`** — corre semanal (+ disparo manual), escanea el canal por archivos nuevos, y commitea `data/recursos.db`.

Ambos workflows necesitan `contents: write` para poder pushear el commit del estado actualizado.

**Importante:** GitHub desactiva automáticamente los triggers `schedule` de un repo si pasan ~60 días sin actividad. Como este proyecto se usa poquísimo, es posible que el cron quede dormido — en ese caso hay que disparar el workflow a mano una vez desde la pestaña Actions (`workflow_dispatch` siempre funciona, dormido o no).

### Sesión de GramJS en CI

`indexer.js` necesita una sesión de Telegram ya autorizada para correr sin intervención humana (GitHub Actions no puede recibir el código SMS). Por eso:

1. La primera vez se corre `npm run index` **local**, interactivo (pide teléfono + código), y eso genera `data/session.txt`.
2. El contenido de ese archivo se guarda como secret `TG_SESSION` en el repo de GitHub.
3. `indexer.js` prioriza `process.env.TG_SESSION` sobre el archivo local — si hay una sesión válida ahí, GramJS no vuelve a pedir teléfono/código.

## Decisiones de diseño importantes

- **Sin presupuesto, sin VPS, sin máquina propia prendida, sin IA.** Todo corre gratis en GitHub Actions (minutos gratis de sobra para este volumen de uso). Se sacó Anthropic del todo (indexer ya no genera resumen, bot ya no redacta respuesta) porque el usuario explícitamente no quiere gastar en tokens y el caso de uso real es simple: leer metadata que ya existe e importarla, no generar contenido nuevo.
- **Bot API descartada para el indexador** porque no somos admins del canal — solo funciona MTProto con cuenta de usuario (GramJS).
- **Se descartó long polling 24/7 como forma de producción** (se usaba así al principio, local) — se cambió a poll único vía cron de GitHub Actions porque el bot se usa con muy poca frecuencia y no vale la pena mantener nada prendido todo el tiempo.
- **Se descartó un VM gratis (Oracle Cloud Free Tier)** para esto — es una solución pensada para algo que corre 24/7; overkill para algo que se consulta ocasionalmente. Ver comparación completa que se discutió: VM = simple pero hay que mantenerlo prendido y configurarlo; webhook serverless = respuesta instantánea pero obliga a reescribir el bot y cambiar de base de datos; **GitHub Actions con cron = elegido**, cero mantenimiento, cero costo, tolera el delay de hasta 30 min entre polls.
- **El SQLite se commitea al repo a propósito** (`data/recursos.db` ya no está en `.gitignore`) — es la forma más simple de persistir estado entre corridas efímeras de Actions sin agregar una base de datos externa.
- **Hash de duplicados** ≠ detección de "mensaje nuevo": el `message_id` se usa para saber desde dónde seguir escaneando; el hash se usa aparte, para no reprocesar el mismo archivo si se resube con otro nombre.
- El usuario final del bot de consulta **no tiene conocimientos técnicos** — el lenguaje natural y las respuestas deben ser simples, sin jerga.

## Pendiente / por definir

- Confirmar si el canal real sube también fotos/texto sin archivo adjunto (el indexador ahora mismo solo procesa mensajes con `m.media.document`).
- Crear el repo en GitHub, configurar los secrets, y generar/subir `TG_SESSION` (ver README).
- Restringir acceso al bot con `ALLOWED_USER_IDS` en `.env` / secret si se quiere limitar quién puede consultarlo.

Instrucciones de instalación y configuración paso a paso están en `README.md`.
