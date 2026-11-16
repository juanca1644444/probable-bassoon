# 🚀 Guía de Despliegue en Producción — CHASKYAPP

Esta guía detalla los pasos para desplegar **CHASKYAPP** en entornos de producción utilizando **Docker**, **Docker Compose**, **Nginx** como proxy inverso y el motor automatizado de **Respaldos Cifrados** para SQLite.

---

## 🏗️ 1. Arquitectura de Despliegue

```
                       ┌────────────────────────────────────────┐
                       │           Tráfico de Internet          │
                       │             (Puertos 80 / 443)         │
                       └───────────────────┬────────────────────┘
                                           │
                                           ▼
                       ┌────────────────────────────────────────┐
                       │     Nginx Gateway / Frontend SPA       │
                       │    (Contenedor: chaskyapp_frontend)    │
                       └───────────┬────────────────┬───────────┘
                                   │                │
            Rutas Estáticas        │                │ Proxies a /api y /ws
            (HTML/JS/CSS/Assets)   │                │
                                   ▼                ▼
                       ┌───────────────┐  ┌────────────────────────────────────┐
                       │  Vite Bundle  │  │         Node.js Backend            │
                       │  (Optimizada) │  │   (Contenedor: chaskyapp_backend)  │
                       └───────────────┘  └─────────────────┬──────────────────┘
                                                            │
                                                Volúmenes Persistentes
                                                            │
                                        ┌───────────────────┴──────────────────┐
                                        ▼                                      ▼
                             ┌─────────────────────┐               ┌──────────────────────┐
                             │   chasky_db_data    │               │ chasky_uploads_data  │
                             │ (/app/data/*.db WAL)│               │    (/app/uploads)    │
                             └─────────────────────┘               └──────────────────────┘
```

---

## 📋 2. Requisitos Previos

- **Docker Engine**: v24.0 o superior ([Instalar Docker](https://docs.docker.com/engine/install/))
- **Docker Compose**: v2.20 o superior
- **Python**: v3.9 o superior (para ejecutar el script de respaldos cifrados `scripts/backup_db.py`)
- **Memoria RAM Mínima**: 1 GB (Recomendado: 2 GB o superior)
- **Disco**: 10 GB de almacenamiento disponible

---

## ⚙️ 3. Configuración del Entorno (.env)

Antes de iniciar los contenedores, configure su archivo de variables de entorno:

```bash
# 1. Copiar plantilla de entorno
cp .env.example .env

# 2. Generar una clave criptográfica para los respaldos de la base de datos
python scripts/backup_db.py --generate-key
```

Edite `.env` con sus valores de producción:

```env
# Puertos expuestos en el Host
HTTP_PORT=80
HTTPS_PORT=443
BACKEND_PORT=3001

# Entorno
NODE_ENV=production

# Seguridad (Cambie por un token seguro)
JWT_SECRET=super_secret_jwt_key_chasky_production_2026
SESSION_TIMEOUT_MINUTES=15

# Inteligencia Artificial (Speech-to-Text, Traductor, Sentimientos)
GEMINI_API_KEY=AIzaSy...Tu_Clave_Aqui

# Política de Respaldos
BACKUP_ENCRYPTION_KEY=JYXCCNYtVHBh3-2RdD5gdgnz2FPx0WS9E4Yx6KP4l-E=
BACKUP_RETENTION_DAYS=7
BACKUP_OUTPUT_DIR=./backups
```

---

## 🚢 4. Comandos de Lanzamiento

### ⚡ Despliegue Rápido en 1 Clic (VPS en Producción):
Si estás en un servidor VPS nuevo (Ubuntu/Debian), ejecuta este comando único para clonar, configurar e iniciar toda la infraestructura:
```bash
git clone <URL_REPOSITORIO> chaskyapp && cd chaskyapp && cp .env.example .env && docker compose up -d --build
```

### Iniciar o actualizar la aplicación en segundo plano:
```bash
docker compose up -d --build
```

### Verificar el estado de los contenedores:
```bash
docker compose ps
```

### Visualizar registros en tiempo real:
```bash
# Todos los servicios
docker compose logs -f

# Solo Backend
docker compose logs -f backend

# Solo Frontend / Nginx
docker compose logs -f frontend
```

### Detener los servicios:
```bash
docker compose down
```

*(Nota: `docker compose down` detiene los contenedores pero **NUNCA** elimina los datos de la base de datos ni los archivos multimedia).*

---

## 💾 5. Persistencia y Soberanía de Datos

Los datos críticos de CHASKYAPP están protegidos contra reinicios y actualizaciones mediante volúmenes con nombre gestionados por Docker:

| Volumen Docker | Ruta en Contenedor | Propósito |
| :--- | :--- | :--- |
| `chaskyapp_db_data` | `/app/data` | Base de datos SQLite (`chaskyapp.db`, WAL y SHM) |
| `chaskyapp_uploads_data` | `/app/uploads` | Notas de voz, imágenes de catálogo y adjuntos |

---

## 🔐 6. Motor Automatizado de Respaldos Cifrados (`scripts/backup_db.py`)

Para garantizar la **soberanía total y seguridad absoluta** de la información empresarial, CHASKYAPP incluye un motor de respaldos en caliente:

1. **Snapshot en vivo**: Utiliza la API de respaldos de SQLite para capturar consistencia total sin bloquear escrituras WAL.
2. **Compresión Gzip**: Reduce el tamaño del archivo entre un 40% y 80%.
3. **Cifrado AES-256 Authenticated**: Cifra el archivo con Fernet / AES-256 + HMAC-SHA256.
4. **Política de Retención**: Elimina automáticamente respaldos que superen los días estipulados (por defecto 7 días).

### Comandos del Script de Respaldos:

```bash
# Ejecutar un respaldo manual inmediato
python scripts/backup_db.py

# Listar todos los respaldos cifrados existentes
python scripts/backup_db.py --list

# Verificar la integridad matemática de un archivo de respaldo
python scripts/backup_db.py --verify backups/chaskyapp_backup_YYYYMMDD_HHMMSS.db.gz.enc

# Restaurar la base de datos a partir de un respaldo cifrado
python scripts/backup_db.py --restore backups/chaskyapp_backup_YYYYMMDD_HHMMSS.db.gz.enc
```

### Automatización con Cron (Linux):

Para ejecutar el respaldo todos los días a las **02:00 AM**, agregue la siguiente entrada a su crontab (`crontab -e`):

```cron
0 2 * * * cd /ruta/a/chaskyapp && /usr/bin/python3 scripts/backup_db.py >> /var/log/chasky_backup.log 2>&1
```

### Automatización en Windows (Programador de Tareas):

```powershell
schtasks /create /tn "CHASKYAPP_Daily_Backup" /tr "python C:\ruta\a\chaskyapp\scripts\backup_db.py" /sc daily /st 02:00
```

---

## 🔒 7. Configuración SSL / HTTPS con Let's Encrypt

Para habilitar certificados SSL gratuitos con Certbot en su servidor de producción:

1. Instalar Certbot en su servidor Linux:
   ```bash
   sudo apt update && sudo apt install certbot -y
   ```
2. Obtener el certificado (sustituya `app.chasky.pe` por su dominio):
   ```bash
   sudo certbot certonly --standalone -d app.chasky.pe
   ```
3. Monte la carpeta de certificados en `docker-compose.yml` y descomente las líneas del bloque SSL en `nginx/nginx.conf` o `client/nginx.conf`.
4. Recargue Nginx:
   ```bash
   docker compose restart frontend
   ```

---

## 🩺 8. Monitoreo y Pruebas de Salud (Healthchecks)

Tanto el contenedor Frontend como el Backend disponen de verificaciones de estado nativas:

- **Frontend Health**: `wget -q --spider http://localhost/ || exit 1`
- **Backend Health**: `wget -q --spider http://localhost:3001/api/chats || exit 1`

Puede inspeccionar el estado de salud ejecutando:
```bash
docker inspect --format='{{json .State.Health}}' chaskyapp_backend
```

---
*CHASKYAPP — Mensajería Omnicanal Empresarial de Alto Rendimiento.*
