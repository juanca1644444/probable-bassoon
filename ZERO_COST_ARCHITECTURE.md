# 💎 Arquitectura Zero-Cost / Serverless — CHASKYAPP ($0.00 / mes)

Esta guía técnica detalla la adaptación y despliegue de **CHASKYAPP** sin incurrir en ningún costo mensual de infraestructura o servidores VPS, aprovechando al máximo las capas gratuitas (*Free Tiers*) de plataformas de nube modernas y tu cuenta personal de **Google (Google Drive de 5 TB y Google Sheets)**.

---

## 🗺️ 1. Topología de la Arquitectura Zero-Cost

```
                           ┌────────────────────────────────────────┐
                           │          Usuario Final / Móvil         │
                           │     (Navegador Web / PWA / Celular)    │
                           └───────────────────┬────────────────────┘
                                               │
                                               ▼
                      ┌──────────────────────────────────────────────────┐
                      │    FRONTEND GRATUITO (Vercel / Netlify CDN)      │
                      │  - React 18 + Vite SPA optimizada                │
                      │  - Certificado SSL/TLS wildcard automático gratis│
                      │  - Dominio: https://chaskyapp.vercel.app         │
                      └───────────────┬──────────────────────────────────┘
                                      │
                                      ▼ Peticiones REST (/api) y WebSocket (wss://)
                      ┌──────────────────────────────────────────────────┐
                      │    BACKEND GRATUITO (Render / Railway Web Svc)   │
                      │  - Node.js 20 + Express + WebSockets en vivo     │
                      │  - Healthcheck keep-alive en /api/health         │
                      │  - SQLite en memoria/disco local en modo WAL     │
                      └───────────────┬─────────────────┬────────────────┘
                                      │                 │
                Snapshot Cifrado      │                 │ Webhook Leads
                (Gzip 9 + AES-256)    │                 │ (Google Apps Script)
                                      ▼                 ▼
          ┌──────────────────────────────────────┐  ┌──────────────────────────────────────┐
          │     GOOGLE DRIVE VAULT (5 TB)        │  │     GOOGLE SHEETS CRM HUIRACOCHA     │
          │  - scripts/backup_gdrive.py          │  │  - scripts/google_sheets_crm_template│
          │  - Respaldos en caliente sin locks   │  │  - Dashboard colaborativo de ventas  │
          │  - Restauración en 1 clic            │  │  - Acceso desde Google Workspace    │
          │  - Costo: $0.00 (Espacio Google One) │  │  - Costo: $0.00                      │
          └──────────────────────────────────────┘  └──────────────────────────────────────┘
```

---

## ⚡ 2. Despliegue del Frontend (Vercel o Netlify)

El frontend está preconfigurado para compilar y desplegarse en segundos con soporte completo de Single Page Application (SPA).

### Opción A: Vercel (Recomendado)
El archivo [`vercel.json`](file:///C:/Users/Lenovo/.gemini/antigravity/scratch/whatsapp-pro/vercel.json) y [`client/vercel.json`](file:///C:/Users/Lenovo/.gemini/antigravity/scratch/whatsapp-pro/client/vercel.json) ya están configurados en el repositorio:

1. Ve a [Vercel](https://vercel.com/) e inicia sesión con GitHub o Google.
2. Haz clic en **Add New Project** e importa tu repositorio de CHASKYAPP.
3. Si importas desde la raíz, define:
   - **Root Directory**: `client`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. En **Environment Variables**, añade:
   ```env
   VITE_BACKEND_URL=https://tu-backend-chasky.onrender.com
   ```
5. Haz clic en **Deploy**. Tendrás tu aplicación en `https://tu-proyecto.vercel.app` con SSL activo.

### Opción B: Netlify
El archivo [`netlify.toml`](file:///C:/Users/Lenovo/.gemini/antigravity/scratch/whatsapp-pro/netlify.toml) y [`client/netlify.toml`](file:///C:/Users/Lenovo/.gemini/antigravity/scratch/whatsapp-pro/client/netlify.toml) ya resuelven la redirección de rutas (`/*` -> `/index.html 200`):
1. Conecta tu repositorio en [Netlify](https://www.netlify.com/).
2. Configura:
   - **Base directory**: `client`
   - **Build command**: `npm run build`
   - **Publish directory**: `client/dist`
3. Agrega la variable de entorno `VITE_BACKEND_URL` y pulsa **Deploy site**.

---

## 🔌 3. Despliegue del Backend Gratuito (Render / Railway)

### A. Despliegue en Render (Free Web Service)
El archivo [`render.yaml`](file:///C:/Users/Lenovo/.gemini/antigravity/scratch/whatsapp-pro/render.yaml) define el servicio automáticamente:
1. Crea una cuenta en [Render](https://render.com/).
2. Haz clic en **New +** > **Blueprint** (o **Web Service**) y conecta el repositorio.
3. Configuración del servicio:
   - **Environment**: `Node`
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && node index.js`
   - **Plan**: `Free`
   - **Health Check Path**: `/api/health`
4. Variables de entorno en Render:
   - `NODE_ENV`: `production`
   - `CORS_ORIGIN`: `*` (o la URL de tu Vercel: `https://tu-proyecto.vercel.app`)
   - `JWT_SECRET`: `clave_secreta_jwt_produccion_2026`
   - `GEMINI_API_KEY`: Tu clave gratuita de Google AI Studio.
   - `BACKUP_ENCRYPTION_KEY`: Clave AES generada con `python scripts/backup_db.py --generate-key`.

### 🛡️ Evitar la Hibernación de Render (Keep-Alive 100% Gratis)
Los servicios web gratuitos de Render entran en suspensión tras 15 minutos sin tráfico.
Para mantenerlo **activo 24/7 sin pagar nada**:
1. Entra a [Cron-job.org](https://cron-job.org/) o [UptimeRobot](https://uptimerobot.com/) (ambos 100% gratuitos).
2. Crea un monitor HTTP de tipo `GET` apuntando a:
   ```
   https://tu-backend-chasky.onrender.com/api/health
   ```
3. Programa la frecuencia cada **10 minutos**.
4. ¡Listo! El endpoint `/api/health` responderá `{ "status": "ok" }` manteniendo la instancia en memoria despierta permanentemente.

---

## 💾 4. Base de Datos y Respaldos Cifrados en Google Drive (5 TB)

SQLite en modo WAL es el motor más rápido y eficiente del mundo para cargas locales. Para proteger la información contra reinicios o contingencias, el script [`scripts/backup_gdrive.py`](file:///C:/Users/Lenovo/.gemini/antigravity/scratch/whatsapp-pro/scripts/backup_gdrive.py) automatiza el ciclo:

$$\text{SQLite WAL} \xrightarrow[\text{Zero-Locks}]{\text{Backup API}} \text{Snapshot} \xrightarrow{\text{Gzip 9}} \text{.gz} \xrightarrow{\text{AES-256 / Fernet}} \text{.db.gz.enc} \xrightarrow{\text{Google Drive API}} \text{Google Drive (5 TB)}$$

### Paso 1: Configurar el Acceso a Google Drive (Gratis)
1. Ve a [Google Cloud Console](https://console.cloud.google.com/) con tu cuenta de Google.
2. Crea un proyecto (ej: `Chaskyapp-Storage`).
3. En el menú, ve a **APIs y Servicios > Biblioteca**, busca **Google Drive API** y haz clic en **Habilitar**.
4. Ve a **APIs y Servicios > Credenciales** > **Crear credenciales** > **Cuenta de servicio (Service Account)**.
   - Nombre: `chasky-backup-bot`
   - Rol: `Editor` o `Propietario`.
5. Entra a la cuenta de servicio creada, ve a la pestaña **Claves** > **Agregar clave** > **Crear clave nueva (JSON)**.
6. Se descargará un archivo `.json`. Guárdalo en la raíz del proyecto como `service_account.json`.
7. **Paso Clave**: Abre Google Drive en tu navegador con tu cuenta de 5 TB, crea una carpeta llamada `CHASKYAPP_BACKUPS` y compártela (dándole permiso de *Editor*) con el correo de la cuenta de servicio (ej: `chasky-backup-bot@chaskyapp-storage.iam.gserviceaccount.com`).

### Paso 2: Ejecutar y Probar el Respaldo
```bash
# 1. Instalar dependencias de Google API
pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib

# 2. Probar la conexión con tu Google Drive
python scripts/backup_gdrive.py --dry-run

# 3. Realizar un respaldo completo en caliente hacia Google Drive
python scripts/backup_gdrive.py

# 4. Listar los respaldos almacenados en tu Google Drive
python scripts/backup_gdrive.py --list-drive

# 5. Restauración Automatizada con Validación de Integridad (scripts/restore_db.py)
python scripts/restore_db.py                      # Descarga el último respaldo de Drive y restaura
python scripts/restore_db.py --dry-run            # Audita integridad matemática sin modificar la DB
python scripts/restore_db.py --file <archivo.enc> # Restaura desde un archivo cifrado local
```

---

## 📊 5. Google Sheets como CRM Ligero y Panel de Control

Para que el equipo de admisiones y ventas de **Servicios Educativos Huiracocha** pueda monitorear leads, matriculaciones y cotizaciones sin entrar a consolas técnicas, se diseñó la integración con Google Sheets mediante un **Webhook de Google Apps Script** sin costos de API ni límites de cuota.

### Instalación en 2 Minutos:
1. Crea una nueva Hoja de Cálculo en tu Google Drive: `CHASKYAPP - Leads & CRM Huiracocha`.
2. En la barra superior, abre **Extensiones > Apps Script**.
3. Copia y pega el código completo de [`scripts/google_sheets_crm_template.gs`](file:///C:/Users/Lenovo/.gemini/antigravity/scratch/whatsapp-pro/scripts/google_sheets_crm_template.gs).
4. Haz clic en **Implementar > Nueva implementación**:
   - Tipo: **Aplicación web**.
   - Ejecutar como: **Yo** (tu cuenta).
   - Quién tiene acceso: **Cualquier usuario** (Anyone).
5. Copia la URL generada (ej: `https://script.google.com/macros/s/AKfycb.../exec`).
6. Configura esta URL en el `.env` de CHASKYAPP:
   ```env
   GOOGLE_SHEETS_WEBHOOK_URL="https://script.google.com/macros/s/AKfycb.../exec"
   ```

### Capacidades del CRM en Google Sheets:
- **Upsert Inteligente**: Si un lead ya existe en la hoja (por `chatId`), actualiza automáticamente su etapa, asesor asignado, monto y notas sin duplicar filas.
- **Formato Visual Automático**: Aplica colores según la etapa (`Nuevo Lead` en azul, `Contactado` en ámbar, `Propuesta` en morado, `Matriculado` en verde).
- **Sincronización en Tiempo Real**: Cada vez que un asesor mueve un prospecto en el pipeline CRM de CHASKYAPP, se refleja en vivo en Google Sheets.
- **Sincronización Masiva**: Se agregó el endpoint `POST /api/crm/sync-google-sheets` para exportar todos los leads actuales en 1 clic.

---

## 💰 6. Resumen de Costos Mensuales

| Componente | Proveedor / Tecnología | Capacidad / Límite | Costo Mensual |
| :--- | :--- | :--- | :---: |
| **Frontend Web** | Vercel / Netlify | Ancho de banda 100 GB/mes + SSL | **$0.00** |
| **Backend API & WebSockets** | Render Free Tier + Cron-job Pinger | 512 MB RAM + Conexiones WS | **$0.00** |
| **Almacenamiento de Respaldos** | Google Drive (Cuenta Google One) | 5 TB disponibles | **$0.00** |
| **CRM Colaborativo de Leads** | Google Sheets + Apps Script | Ilimitado para Workspace | **$0.00** |
| **Certificados SSL** | Let's Encrypt / Vercel Edge SSL | Renovación automática | **$0.00** |
| **TOTAL** | **Infraestructura Completa en la Nube** | **Producción Total** | **$0.00 / mes** |
