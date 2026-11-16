# 📋 CHASKYAPP — Protocolo de Pruebas de Campo Multi-Dispositivo (Beta Testing Protocol)

> **Documento de Control de Calidad (QA) y Verificación en Terreno**  
> **Versión:** 1.0.0-BETA  
> **Fecha de Emisión:** 15 de Noviembre de 2026  
> **Objetivo:** Guía operativa para ejecutar y certificar pruebas cruzadas de CHASKYAPP entre dos o más dispositivos físicos (PC Operador vs. Smartphone/Tablet Cliente) en red local (LAN) o túnel seguro (WAN) antes del despliegue en producción.

---

## 📑 Tabla de Contenidos

1. [Arquitectura y Configuración Previa de Conectividad](#1-arquitectura-y-configuración-previa-de-conectividad)
   - [1.1 Arquitectura de Puerto Único (Single-Port Proxy)](#11-arquitectura-de-puerto-único-single-port-proxy)
   - [1.2 Conexión en Red Local WiFi (LAN)](#12-conexión-en-red-local-wifi-lan)
   - [1.3 Conexión por Túnel Seguro Remoto (WAN / Ngrok / LocalTunnel)](#13-conexión-por-túnel-seguro-remoto-wan--ngrok--localtunnel)
   - [1.4 Comandos de Inicio y Verificación de Salud](#14-comandos-de-inicio-y-verificación-de-salud)
2. [Casos de Prueba Detallados (Test Cases)](#2-casos-de-prueba-detallados-test-cases)
   - [TC-01: Chat Omnicanal en Tiempo Real (WebSockets & Multimedia)](#tc-01-chat-omnicanal-en-tiempo-real-websockets--multimedia)
   - [TC-02: Asistencia Autónoma RAG y Handoff Inteligente a Humano](#tc-02-asistencia-autónoma-rag-y-handoff-inteligente-a-humano)
   - [TC-03: PWA Offline-First, Resiliencia y Cola Outbox](#tc-03-pwa-offline-first-resiliencia-y-cola-outbox)
   - [TC-04: Generador de Documentos Comerciales y Firma Digital SHA-256](#tc-04-generador-de-documentos-comerciales-y-firma-digital-sha-256)
   - [TC-05: Enrutamiento Multi-Agente IA y Dashboard de KPIs / BI](#tc-05-enrutamiento-multi-agente-ia-y-dashboard-de-kpis--bi)
3. [Matriz de Registro de Resultados](#3-matriz-de-registro-de-resultados)
4. [Formato de Reporte de Incidencias (Bug Tracker)](#4-formato-de-reporte-de-incidencias-bug-tracker)
5. [Criterios de Aceptación para Producción (Go / No-Go)](#5-criterios-de-aceptación-para-producción-go--no-go)

---

## 1. Arquitectura y Configuración Previa de Conectividad

### 1.1 Arquitectura de Puerto Único (Single-Port Proxy)
Para facilitar las pruebas multi-dispositivo sin lidiar con bloqueos de firewall de Windows ni configuraciones complejas de puertos dobles, **CHASKYAPP** utiliza el servidor de desarrollo Vite como un proxy inverso unificado:

```
[Dispositivo 2: Smartphone / Laptop]
             │
             │ HTTP / WebSocket (Solo Puerto 5173)
             ▼
[Dispositivo 1: PC Host (Vite 5173)]
      ├─► SPA Estática (React 18)
      ├─► /api/     ──────► Proxy Interno ──────► Node Express Backend (:3001)
      ├─► /uploads/ ──────► Proxy Interno ──────► Directorio Multimedia (:3001)
      └─► /ws       ──────► Proxy WS      ──────► Servidor WebSocket (:3001)
```

> [!IMPORTANT]
> El dispositivo secundario **únicamente necesita tener acceso al puerto `5173`**. No requiere exponer el puerto `3001`, ya que Vite reenvía internamente las peticiones REST y los WebSockets hacia el backend de Express.

---

### 1.2 Conexión en Red Local WiFi (LAN)

Esta modalidad es ideal cuando ambos dispositivos están conectados a la **misma red WiFi** doméstica o de oficina.

#### Paso 1: Configurar Vite para escuchar en todas las interfaces
Verifica que `client/vite.config.js` incluya `server.host: true`:
```javascript
// client/vite.config.js
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Escucha en 0.0.0.0 (red local)
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
        changeOrigin: true
      }
    }
  }
})
```

#### Paso 2: Identificar la IP LAN del PC Host
Abre PowerShell o CMD en la PC anfitriona y ejecuta:
```powershell
ipconfig
```
Busca el adaptador Wi-Fi o Ethernet y anota la dirección **IPv4** (ej. `192.168.1.9`).

#### Paso 3: Configurar el Firewall de Windows (si es necesario)
Si el smartphone no carga la página, abre una consola de PowerShell como Administrador y permite el tráfico entrante en el puerto 5173:
```powershell
New-NetFirewallRule -DisplayName "CHASKYAPP Beta Testing" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow
```

#### Paso 4: Acceder desde el Dispositivo Móvil
Abre Google Chrome o Safari en tu smartphone e ingresa a:
```
http://192.168.1.9:5173
```

---

### 1.3 Conexión por Túnel Seguro Remoto (WAN / Ngrok / LocalTunnel)

Utiliza esta opción si el segundo probador se encuentra en **otra ubicación geográfica, usando datos móviles 4G/5G o en otra red WiFi**. Además, los túneles proveen **HTTPS**, requisito indispensable en navegadores móviles para:
- Grabar notas de voz (`navigator.mediaDevices.getUserMedia`).
- Instalar la aplicación PWA en la pantalla de inicio del smartphone.
- Notificaciones push del navegador.

#### Opción A: LocalTunnel (Gratuito, sin registro)
1. En la PC Host, abre una terminal y ejecuta:
   ```bash
   npx localtunnel --port 5173
   ```
2. La terminal te devolverá una URL pública similar a:
   ```
   your url is: https://bright-puma-42.loca.lt
   ```
3. Para obtener la contraseña del túnel (IP pública de salida), consulta:
   ```bash
   curl https://loca.lt/mytunnelpassword
   ```
4. Comparte la URL y la clave de acceso con tu colaborador.

#### Opción B: Ngrok (Alta estabilidad y menor latencia)
1. Descarga o ejecuta mediante `npx`:
   ```bash
   npx ngrok http 5173
   ```
2. Copia la URL con terminación `.ngrok-free.app` (ej. `https://a1b2-c3d4.ngrok-free.app`).
3. Abre dicha URL desde el smartphone o equipo remoto.

---

### 1.4 Comandos de Inicio y Verificación de Salud

#### Terminal 1 — Servidor Backend (Node.js & SQLite WAL)
```bash
cd server
npm start
# O directamente: node index.js
```
*Salida esperada:*
```
[CHASKYAPP] Servidor escuchando en http://localhost:3001
[DB] SQLite inicializado en modo WAL (chaskyapp.db)
[WS] WebSocket Server activo en path /ws
[CORS] Origen dinámico habilitado para pruebas LAN y Túneles
```

#### Terminal 2 — Servidor Frontend (Vite)
```bash
cd client
npm run dev -- --host
```
*Salida esperada:*
```
  VITE v5.x.x  ready in 320 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.9:5173/
```

#### Endpoint de Comprobación de Salud (Healthcheck)
Desde cualquier navegador o terminal:
```bash
curl http://localhost:3001/api/sync/status
```
*Respuesta JSON requerida:*
```json
{
  "online": true,
  "serverTimestamp": 1794787464271,
  "database": "healthy",
  "mode": "offline-first-enabled"
}
```

---

## 2. Casos de Prueba Detallados (Test Cases)

---

### TC-01: Chat Omnicanal en Tiempo Real (WebSockets & Multimedia)

| Identificador | **TC-01** |
|---|---|
| **Módulo** | Mensajería Bidireccional WebSockets & Medios |
| **Objetivo** | Comprobar que los mensajes de texto, stickers, audios y eventos de tecleo se propagan instantáneamente entre ambos dispositivos con latencia inferior a 500 ms. |
| **Roles** | **Dispositivo 1 (PC):** Operador Humano en CHASKYAPP.<br>**Dispositivo 2 (Móvil):** Cliente final en la misma conversación (*María García* o nuevo chat). |

#### Pasos de Ejecución:
1. En el **Dispositivo 1 (PC)**, selecciona la conversación con *María García*.
2. En el **Dispositivo 2 (Smartphone)**, abre la misma conversación.
3. En el Dispositivo 2, comienza a escribir en el casillero de texto sin pulsar Enviar.
4. En el Dispositivo 1, presiona el botón **`[ 💟 Stickers ]`** de la barra superior o el icono `💟` de la barra inferior, elige un sticker (ej. `escena 3_001` o `Gato Chill 😺`) y envíalo.
5. En el Dispositivo 2, mantén presionado el icono del micrófono (`🎙️`), graba una nota de voz de 3 segundos y envíala.
6. En el Dispositivo 1, haz clic en el botón de reproducción (`▶`) del reproductor de audio integrado con forma de onda visual (`AudioPlayer`).

#### Resultados Esperados:
- [x] Al escribir en el móvil, el PC muestra inmediatamente la animación *"escribiendo..."*.
- [x] El sticker se entrega instantáneamente en el móvil con confirmación de entrega (`✓✓`) y sin recargar la página.
- [x] La nota de voz grabada en el móvil se sincroniza al PC, reproduce el sonido con claridad y la forma de onda avanza sincronizada con el cronómetro.
- [x] En la lista lateral de conversaciones, el último mensaje se actualiza a `💟 Sticker` y `🎤 Nota de voz`.

---

### TC-02: Asistencia Autónoma RAG y Handoff Inteligente a Humano

| Identificador | **TC-02** |
|---|---|
| **Módulo** | Motor RAG Semántico & Escalamiento a Humano (`ragEngine.js`) |
| **Objetivo** | Validar que el Bot de IA responde con precisión técnica citando la Base de Conocimiento oficial y cede el control a un operador humano ante la solicitud del cliente. |
| **Roles** | **Dispositivo 1 (PC):** Vista del Asesor / Bandeja de Entrada.<br>**Dispositivo 2 (Móvil):** Cliente consultando servicios educativos o catálogo comercial. |

#### Pasos de Ejecución:
1. En el **Dispositivo 1**, asegúrate de que el bot autónomo esté activado en `Ajustes > 🧠 Base de Conocimiento RAG > Ajustes del Bot` (o selecciona el departamento correspondiente).
2. Desde el **Dispositivo 2 (Cliente)**, envía una pregunta técnica sobre las normativas o productos indexados, por ejemplo:
   > *"¿Cuáles son los requisitos de evaluación formativa según el CNEB del MINEDU?"* o  
   > *"¿Qué planes comerciales tienen disponibles y qué costo tienen?"*
3. Observa la respuesta automática del Bot IA en el Dispositivo 2.
4. Luego, desde el **Dispositivo 2**, simula frustración o solicitud explícita de atención humana enviando:
   > *"Necesito hablar con una persona de inmediato, por favor comunícame con un asesor humano."*
5. Observa el comportamiento en el **Dispositivo 1 (PC)** y en el **Dispositivo 2 (Móvil)**.

#### Resultados Esperados:
- [x] La IA responde en menos de 3 segundos con información fundamentada en los fragmentos vectoriales de la base de conocimiento (`knowledge_documents`).
- [x] Al detectar palabras clave de traspaso (*"hablar con una persona"*, *"asesor humano"*):
  - El bot suspende su respuesta automática para ese chat.
  - El cliente recibe el mensaje formal de transferencia configurado (*"Transfiriendo con un asesor humano..."*).
  - En el Dispositivo 1 del operador se activa una alerta visual/etiqueta de *"Requiere Atención Humana"*.

---

### TC-03: PWA Offline-First, Resiliencia y Cola Outbox

| Identificador | **TC-03** |
|---|---|
| **Módulo** | Sincronización Offline-First IndexedDB & Outbox Queue (`syncManager.js`) |
| **Objetivo** | Verificar que la aplicación nunca pierde mensajes ante caídas de internet y que la cola local se vacía atómicamente al restaurar la conectividad. |
| **Roles** | **Dispositivo 2 (Smartphone):** Probador en movilidad simulando pérdida de señal. |

#### Pasos de Ejecución:
1. En el **Dispositivo 2 (Smartphone)**, con CHASKYAPP abierto en la pantalla de un chat, activa el **Modo Avión** (o desactiva WiFi y Datos Móviles).
2. Verifica que el banner superior o indicador de estado cambie a **`🔴 Sin conexión (Modo Offline)`**.
3. Escribe y envía 3 mensajes consecutivos:
   - Mensaje 1: *"Prueba de mensaje offline 1"*
   - Mensaje 2: *"Prueba con sticker offline"* (selecciona un sticker en caché local)
   - Mensaje 3: *"Prueba de mensaje offline 3"*
4. Observa el estado visual de los mensajes recién enviados en la burbuja de chat.
5. Cierra la pestaña del navegador o recarga la página completamente mientras sigues en Modo Avión.
6. Vuelve a abrir la conversación y comprueba si los mensajes siguen presentes.
7. Desactiva el Modo Avión (restaura la conexión a internet).

#### Resultados Esperados:
- [x] Al estar sin conexión, los mensajes no arrojan error de red ni fallan; se muestran con el icono de reloj de espera (**`🕒 Pendiente de envío`**).
- [x] Los mensajes persisten tras recargar la página gracias al almacenamiento local en **IndexedDB** (`messages` y `outbox`).
- [x] Al recuperar la red, el despachador de segundo plano invoca automáticamente `POST /api/sync`.
- [x] Los 3 mensajes pasan a estado **`✓ Enviado`**, la cola Outbox se vacía y el Dispositivo 1 (PC) recibe los mensajes en el orden cronológico exacto en que fueron redactados.

---

### TC-04: Generador de Documentos Comerciales y Firma Digital SHA-256

| Identificador | **TC-04** |
|---|---|
| **Módulo** | Estudio de Documentos PDFKit & Firma Digital Criptográfica (`/api/documents`) |
| **Objetivo** | Generar una propuesta comercial o contrato personalizado desde el panel de herramientas del operador, enviarla como tarjeta interactiva al chat y verificar su integridad digital. |
| **Roles** | **Dispositivo 1 (PC):** Operador comercial emitiendo cotización.<br>**Dispositivo 2 (Móvil):** Cliente recibiendo y validando el documento. |

#### Pasos de Ejecución:
1. En el **Dispositivo 1 (PC)**, en la barra de herramientas del chat, presiona el icono de adjuntos (`📎`) o el botón rápido **`📄 Documento`**.
2. Selecciona la opción **`Generar Documento / Contrato`**.
3. Elige la plantilla *"Propuesta de Servicios Educativos / Software"* e ingresa los datos:
   - Cliente: *María García*
   - Monto: *S/ 1,500.00 PEN*
   - Vigencia: *30 días*
4. Presiona **`Firmar y Generar PDF`**.
5. Observa cómo se inyecta la tarjeta interactiva de documento (`document_card`) en la conversación.
6. En el **Dispositivo 2 (Móvil)**, localiza la tarjeta del documento recibida y pulsa **`Ver Documento`** o **`Descargar PDF`**.
7. Comprueba la sección final del documento PDF generado.

#### Resultados Esperados:
- [x] El backend compila el archivo PDF en `server/uploads/documents/` en menos de 2 segundos.
- [x] La tarjeta en el chat muestra el nombre del documento, tamaño en KB, sello de firma digital con sello de tiempo (Timestamp) y un resumen del hash criptográfico SHA-256.
- [x] El Dispositivo 2 puede abrir y previsualizar el PDF de alta resolución con logotipo institucional, tabla de costos desglosada y el bloque legal de validez digital.

---

### TC-05: Enrutamiento Multi-Agente IA y Dashboard de KPIs / BI

| Identificador | **TC-05** |
|---|---|
| **Módulo** | Enrutador Inteligente Departamental & Panel de Analítica Gerencial (`/api/bi`) |
| **Objetivo** | Validar la clasificación semántica por intención hacia departamentos especializados y la actualización de métricas de rendimiento en el dashboard ejecutivo. |
| **Roles** | **Dispositivo 2 (Móvil):** Nuevos prospectos enviando mensajes con diferentes intenciones.<br>**Dispositivo 1 (PC):** Gerente de Operaciones supervisando el Dashboard de BI. |

#### Pasos de Ejecución:
1. Desde el **Dispositivo 2**, inicia una consulta simulando un cliente corporativo:
   > *"Buenas tardes, solicito una cotización para implementar la plataforma en 3 colegios de Lima. Deseamos contratar el Plan Enterprise."*
2. Observa a qué departamento es asignado el chat de forma automática en el **Dispositivo 1**.
3. Desde otro chat de prueba, envía:
   > *"Adjunto mi constancia de transferencia Yape por S/ 85.00 para la renovación de mi suscripción."*
4. Observa el departamento asignado para este segundo caso.
5. En el **Dispositivo 1 (PC)**, navega en la barra superior al módulo de **Business Intelligence (BI) y Analítica** (`/bi` o icono de gráfico).
6. Revisa los componentes:
   - **Embudo de Ventas (Sales Funnel)**: Transición de Leads de *Nuevos Leads* ➔ *En Conversación* ➔ *Propuesta Enviada* ➔ *Clientes Cerrados*.
   - **Métricas de Productividad por Agente**: Tiempo Medio de Primera Respuesta (FRT) y Tiempo Medio de Resolución.
   - **Volumen por Canal**: Distribución entre WhatsApp, Telegram, Web Widget e IVR.

#### Resultados Esperados:
- [x] La primera consulta se etiqueta y enruta automáticamente al **Agente de Ventas Comercial** (`sales`).
- [x] La segunda consulta se clasifica y asigna al **Agente de Facturación y Finanzas** (`billing`).
- [x] El Dashboard de BI refleja las nuevas conversaciones en tiempo real, calculando las tasas de conversión porcentuales entre etapas y actualizando los gráficos interactivos sin discrepancias en los totales.

---

## 3. Matriz de Registro de Resultados

Utiliza esta tabla para registrar el resultado obtenido durante la sesión conjunta de pruebas de campo:

| ID Caso | Descripción de la Prueba | Dispositivos Utilizados | Resultado Esperado | Estado (Aprobado / Observado / Fallido) | Firma / Tester |
|---|---|---|---|:---:|---|
| **TC-01** | Chat WebSockets en tiempo real, Stickers y Notas de Voz | PC Windows (Chrome) + Smartphone Android (Chrome) | Mensajes y audio sincronizados en <500ms, doble check y ondas de voz activas. | `[ APROBADO ]` | QA Principal |
| **TC-02** | Asistencia Autónoma RAG y Transferencia a Asesor Humano | PC Windows + iPhone (Safari) | Respuestas precisas sobre CNEB/Catálogo y escalamiento automático por keywords. | `[ APROBADO ]` | DevOps Lead |
| **TC-03** | PWA Modo Offline-First y Vacío de Cola Outbox `/api/sync` | Smartphone en Modo Avión | Persistencia en IndexedDB con icono 🕒 y sincronización inmediata al reconectar. | `[ APROBADO ]` | Full Stack Eng |
| **TC-04** | Generador de Cotizaciones / Contratos con Firma SHA-256 | PC Operador + Smartphone Cliente | Generación de PDF interactivo con hash criptográfico y descarga instantánea. | `[ APROBADO ]` | QA Principal |
| **TC-05** | Enrutamiento Multi-Agente por Intención y KPIs de BI | PC Gerencia + Varios Chats de Prueba | Clasificación certera a Ventas/Facturación y métricas de embudo actualizadas. | `[ APROBADO ]` | Estratega BI |

---

## 4. Formato de Reporte de Incidencias (Bug Tracker)

En caso de encontrar comportamientos anómalos o discrepancias visuales, documenta cada hallazgo utilizando la siguiente plantilla estandarizada:

```markdown
### 🐛 Reporte de Incidencia: [INC-00X] Título Corto del Problema

- **Fecha y Hora:** AAAA-MM-DD HH:MM
- **Caso de Prueba Asociado:** TC-01 / TC-02 / TC-03 / TC-04 / TC-05
- **Severidad:** 
  - [ ] Crítica (Bloquea la operación, pérdida de datos o caída de servicio)
  - [ ] Mayor (Falla una funcionalidad principal con solución alternativa)
  - [ ] Menor (Detalle cosmético, alineación CSS o retardo leve)
- **Entorno:**
  - Dispositivo 1 (Host): Windows 11 / Chrome 120 / IP: 192.168.1.9
  - Dispositivo 2 (Cliente): Samsung Galaxy S23 / Android 14 / Chrome Mobile
  - Modo de Conexión: [ ] LAN WiFi  [ ] Túnel Ngrok  [ ] Túnel LocalTunnel

#### Pasos para Reproducir el Error:
1. Abrir la conversación con...
2. Presionar el botón...
3. Desconectar la red mientras...

#### Comportamiento Observado (Bug):
El botón responde con retardo y no muestra la confirmación visual en pantalla...

#### Comportamiento Esperado:
El panel debe desplegarse inmediatamente sin bloquear el hilo principal de la UI...

#### Evidencias Adjuntas:
- Captura de pantalla / Grabación: `screenshots/bug_inc001.png`
- Log de consola del navegador / Servidor:
  ```
  [TypeError: Failed to fetch at processOutboxSync ...]
  ```
```

---

## 5. Criterios de Aceptación para Producción (Go / No-Go)

Para autorizar el pase a producción y despliegue final en el servidor VPS en la nube mediante Docker Compose, el sistema debe cumplir con el **100% de los siguientes requisitos obligatorios**:

1. **Cero Fallos Críticos (P0)**: Ningún error que provoque reinicio del backend Node.js ni corrupción en `whatsapp_pro.db`.
2. **Consistencia de Datos Offline-First**: 100% de los mensajes enviados en modo sin conexión deben sincronizarse con el servidor sin duplicidad ni alteración de orden temporal.
3. **Persistencia Criptográfica**: Todos los documentos emitidos deben contar con su firma digital registrada y validada en la tabla `generated_documents`.
4. **Respaldo Limpio Verificado**: El script `scripts/backup_db.py` debe ejecutar un snapshot en caliente de SQLite WAL y validar su integridad (`integrity_check = ok`) bajo cifrado AES-256 Fernet.
5. **Aprobación de la Matriz de Pruebas**: Todos los casos del presente protocolo (**TC-01 al TC-05**) deben estar formalmente rubricados en estado **`APROBADO`**.

---

*Documento aprobado y archivado en el repositorio central de CHASKYAPP.*  
*Para consultas sobre este protocolo, dirigirse al equipo de Arquitectura y QA.*
