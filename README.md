# Sphinx — Indexador + Bot de consulta para canal de Telegram

Este proyecto tiene dos partes:

1. **Indexador** (`indexer.js`): escanea un canal de Telegram y guarda cada archivo nuevo (nombre, caption, tipo) en una base de datos.
2. **Bot de consulta** (`bot.js`): un bot de Telegram al que le escribes una palabra clave ("mapas", "reglas de combate") y te devuelve la lista de archivos que coinciden, con link directo al mensaje.

Sin IA de por medio — es búsqueda directa por texto, cero costo de tokens.

No necesitas saber programar para usarlo, solo seguir estos pasos en orden.

## Paso 0 — Requisitos

- Tener **Node.js** instalado (versión 18 o más nueva). Se descarga gratis en https://nodejs.org
- Una cuenta de Telegram (la que ya usas normalmente)

## Paso 1 — Instalar las dependencias

Abre una terminal dentro de esta carpeta y corre:

```
npm install
```

Esto descarga todo lo necesario, solo se hace una vez.

## Paso 2 — Sacar tus credenciales de Telegram (API ID y Hash)

1. Entra a https://my.telegram.org con tu número de teléfono
2. Ve a "API development tools"
3. Crea una app (el nombre no importa, pon lo que quieras)
4. Te da un **App api_id** y un **App api_hash** — cópialos

## Paso 3 — Crear el bot de consulta

1. En Telegram, busca **@BotFather**
2. Escríbele `/newbot` y sigue las instrucciones (nombre, username)
3. Te da un **token** (algo como `123456:ABC-DEF...`) — cópialo

## Paso 4 — Configurar el archivo `.env`

1. Copia el archivo `.env.example` y renómbralo a `.env`
2. Ábrelo y pega ahí todo lo que sacaste en los pasos anteriores:

```
TG_API_ID=          (del paso 2)
TG_API_HASH=        (del paso 2)
TG_CHANNEL=          (el @usuario del canal, ej: @nombredelcanal)
TG_BOT_TOKEN=       (del paso 3)
```

## Paso 5 — Indexar el canal (primera vez)

```
npm run index
```

La primera vez te va a pedir tu número de teléfono y el código que te llega por Telegram (es el login normal, como cuando entras a Telegram Web). Después de eso guarda la sesión y no te lo vuelve a pedir.

Esto va a tardar según cuántos archivos tenga el canal — va mostrando en la terminal cada recurso que va indexando.

**Corre este comando cada vez que quieras traer lo nuevo** (solo procesa lo que no ha visto, no repite trabajo).

## Paso 6 — Probar el bot localmente (opcional)

```
npm run bot
```

Esto prende el bot en tu máquina para probarlo. Mientras esta terminal esté abierta, el bot responde; si la cierras, deja de responder. **Para que quede funcionando siempre, sin depender de tu compu, seguí con el Paso 7** — ahí es donde queda desplegado de verdad.

## Paso 7 — Dejarlo corriendo solo, gratis, sin tu compu (GitHub Actions)

Esto usa GitHub Actions: GitHub revisa cada 30 minutos si hay mensajes nuevos para el bot, y una vez por semana si hay archivos nuevos en el canal — todo gratis, sin servidor ni computadora prendida. La única espera es que una respuesta puede tardar hasta 30 min en llegar (no es al instante), pero como esto se usa muy poco, no debería notarse.

1. **Crea un repo en GitHub** (puede ser privado) y sube este proyecto:
   ```
   git init
   git add .
   git commit -m "Setup inicial de Sphinx"
   git branch -M main
   git remote add origin <URL-de-tu-repo>
   git push -u origin main
   ```
   (El `.env` no se sube — está en `.gitignore` a propósito.)

2. **Genera la sesión de Telegram** para que el indexador pueda correr solo, sin que nadie escriba el código por SMS cada vez:
   - Corre `npm run index` local una vez (el Paso 5) — esto crea `data/session.txt`.
   - Abre ese archivo y copia todo su contenido (es un texto largo).

3. **Agrega los secrets en GitHub**: en tu repo, ve a **Settings → Secrets and variables → Actions → New repository secret**, y crea uno por cada variable de tu `.env`, con el mismo nombre:
   - `TG_API_ID`
   - `TG_API_HASH`
   - `TG_CHANNEL`
   - `TG_BOT_TOKEN`
   - `ALLOWED_USER_IDS` (si lo usas)
   - `TG_SESSION` — el contenido que copiaste en el paso 2

4. **Listo.** Ve a la pestaña **Actions** de tu repo — ahí vas a ver dos workflows ("Bot - revisar mensajes" e "Indexador - traer recursos nuevos"). Corren solos según su horario, pero también los puedes disparar a mano con el botón **Run workflow** cuando quieras (por ejemplo, justo después de subir archivos nuevos al canal, para no esperar hasta el próximo domingo).

**Nota:** si el proyecto pasa mucho tiempo (~2 meses) sin ninguna actividad, GitHub puede pausar automáticamente los horarios programados. Si notas que el bot dejó de responder después de mucho tiempo sin usarse, entra a la pestaña Actions y dale **Run workflow** manualmente una vez — con eso vuelve a quedar funcionando.

## Notas

- La base de datos queda en `data/recursos.db`. En este modo desplegado, GitHub Actions la actualiza y la guarda en el propio repo automáticamente después de cada corrida — no hay que hacer nada manual.
- Si quieres restringir quién puede usar el bot, pon tu ID de Telegram (te lo da @userinfobot) en `ALLOWED_USER_IDS` del `.env` (y del secret correspondiente en GitHub).
- El indexador detecta duplicados por hash, así que si alguien resube el mismo archivo con otro nombre, no lo vuelve a procesar.
- La búsqueda del bot es por palabra clave contra el nombre de archivo, el caption y la categoría — si el archivo no tiene nombre ni caption claro, va a aparecer tal cual lo subieron.
