# Sphinx — Indexador + Bot de consulta para canal de Telegram

Este proyecto tiene dos partes:

1. **Indexador** (`indexer.js`): escanea un canal de Telegram, guarda cada archivo nuevo en una base de datos y le genera un resumen corto con IA.
2. **Bot de consulta** (`bot.js`): un bot de Telegram al que le escribes en lenguaje natural ("¿qué mapas hay?") y te responde buscando en lo ya indexado.

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

## Paso 4 — Sacar tu API key de Anthropic (para los resúmenes y respuestas)

1. Entra a https://console.anthropic.com
2. Crea una API key
3. Cópiala

## Paso 5 — Configurar el archivo `.env`

1. Copia el archivo `.env.example` y renómbralo a `.env`
2. Ábrelo y pega ahí todo lo que sacaste en los pasos anteriores:

```
TG_API_ID=          (del paso 2)
TG_API_HASH=        (del paso 2)
TG_CHANNEL=          (el @usuario del canal, ej: @nombredelcanal)
TG_BOT_TOKEN=       (del paso 3)
ANTHROPIC_API_KEY=  (del paso 4)
```

## Paso 6 — Indexar el canal (primera vez)

```
npm run index
```

La primera vez te va a pedir tu número de teléfono y el código que te llega por Telegram (es el login normal, como cuando entras a Telegram Web). Después de eso guarda la sesión y no te lo vuelve a pedir.

Esto va a tardar según cuántos archivos tenga el canal — va mostrando en la terminal cada recurso que va indexando.

**Corre este comando cada vez que quieras traer lo nuevo** (solo procesa lo que no ha visto, no repite trabajo).

## Paso 7 — Prender el bot de consulta

```
npm run bot
```

Con esto el bot queda escuchando. Ábrelo en Telegram (el que creaste con BotFather) y ya le puedes preguntar cosas. Mientras esta terminal esté abierta, el bot responde. Si la cierras, el bot deja de responder (para que quede prendido todo el tiempo hay que subirlo a algún lado gratis, como Oracle Cloud Free Tier — se puede ver más adelante).

## Notas

- La base de datos queda en `data/recursos.db`, es un solo archivo, se puede respaldar copiándolo.
- Si quieres restringir quién puede usar el bot, pon tu ID de Telegram (te lo da @userinfobot) en `ALLOWED_USER_IDS` del `.env`.
- El indexador detecta duplicados por hash, así que si alguien resube el mismo archivo con otro nombre, no lo vuelve a procesar.
