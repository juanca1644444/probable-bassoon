# CHASKYAPP 🌐 — Suite de Mensajería Omnicanal y Red Privada Autónoma

> **Red Privada de Comunicación Empresarial e Institucional** con IA Local (RAG), Videollamadas WebRTC P2P de Alta Disponibilidad, Arquitectura PWA Offline-First y Single-Port Proxy.

---

## 🚀 Características Principales

* **🔒 Red Privada y Cerrada:** Comunicación 100% autónoma y segura entre usuarios registrados sin depender de servidores o números de terceros.
* **📞 Llamadas y Videollamadas WebRTC P2P:**
  * Soporte cross-operator (funciona en 4G/5G y Wi-Fi de diferentes operadores).
  * Servidores STUN de Google y relés TURN dedicados en puerto 443 (UDP/TCP) para atravesar firewalls corporativos y CGNAT móvil.
  * Acumulación persistente de pistas de audio y video con controles en pantalla y PiP (Picture-in-Picture).
* **📱 Progressive Web App (PWA):**
  * Instalable con 1 toque en Android e iOS como app nativa (`display: standalone`).
  * Service Worker con precaching automático de assets y soporte de cola de sincronización offline con IndexedDB.
* **🧠 Inteligencia Artificial y RAG Local:**
  * Motor semántico vectorial integrado (`ragEngine.js`) para asistencia y generación de respuestas contextuales.
  * Handoff inteligente de chatbot hacia operador humano.
* **⚡ Single-Port Proxy (Desarrollo y LAN):**
  * Vite (`:5173`) actúa como proxy inverso transparente para la API REST (`/api`), archivos adjuntos (`/uploads`) y WebSockets (`/ws`) hacia el backend (`:3001`). No requiere abrir múltiples puertos en el firewall local.
* **☁️ Despliegue en la Nube:**
  * **Frontend (Vercel):** [https://client-teal-eta-82.vercel.app](https://client-teal-eta-82.vercel.app)
  * **Backend (Render):** `https://probable-bassoon-wk5u.onrender.com` (WebSockets en `/ws`)

---

## 🛠️ Comandos Rápidos

| Comando | Acción |
| :--- | :--- |
| `npm run dev` | Inicia de forma concurrente el backend (`:3001`) y el frontend (`:5173`). |
| `npm run dev:server` | Inicia únicamente el servidor Node.js/Express (`server/index.js`). |
| `npm run dev:client` | Inicia el frontend Vite escuchando en todas las interfaces (`0.0.0.0:5173`). |
| `npm test` | Ejecuta la suite de pruebas automatizadas de 20 casos (`test_phase3_suite.js`). |
| `npm run audit` | Ejecuta la auditoría integral de salud y esquema SQLite (`comprehensive_health_audit.js`). |
| `npm run build` | Compila el cliente frontend optimizando bundles y assets precacheados. |

---

## 📋 Guía de Pruebas Móviles y Multi-Dispositivo

Para realizar pruebas completas de campo entre una PC y un smartphone (o entre dos teléfonos móviles):

### Opción 1: Pruebas Móviles en Red Local (LAN Wi-Fi)
1. Inicia la aplicación en la máquina anfitrión:
   ```bash
   npm run dev
   ```
2. Desde el navegador del teléfono móvil (en la misma red Wi-Fi), abre:
   ```text
   http://192.168.1.9:5173
   ```
3. Gracias al **Single-Port Proxy**, todo el tráfico REST y WebSocket fluye por el puerto `5173` sin requerir abrir el puerto `3001`.

### Opción 2: Pruebas Móviles Reales (Diferentes Operadores 4G/5G y PWA)
Por especificación de seguridad web (W3C/RFC), los navegadores móviles requieren **HTTPS** para acceder a la cámara, micrófono e instalar la PWA de forma nativa:
1. Abre en Chrome (Android) o Safari (iOS) la URL de producción segura:
   👉 **https://client-teal-eta-82.vercel.app**
2. Pulsa el botón de opciones del navegador y selecciona **"Instalar aplicación"** o **"Agregar a la pantalla principal"**.
3. Realiza llamadas o videollamadas entre dispositivos con total interoperabilidad de audio y video.

---

## 🏗️ Arquitectura del Sistema

```
[Dispositivo Móvil / Laptop]
             │
             │ HTTPS / WSS
             ▼
[Vite Frontend (:5173)] ──(Proxy /api, /ws)──► [Node.js + Express Backend (:3001)]
       │                                                      │
       ├─► PWA (Service Worker + IndexedDB)                   ├─► SQLite WAL (whatsapp_pro.db)
       └─► WebRTC Audio/Video (STUN/TURN 443)                 ├─► WebSocket Engine (ws)
                                                              └─► Motor RAG Local
```

---

## 🏛️ Antecedentes Técnicos e Históricos (REA Foundations)

El diseño modular de este proyecto se originó a partir de un análisis de ingeniería inversa (Reverse Engineering & Analysis) de artefactos de WhatsApp Desktop v2.2134.10:

* **Gestión de Estados:** Patrón de arquitectura desacoplada para gestión de ventanas y paneles auxiliares.
* **Modelo Offline-First:** Persistencia local estructurada con cola outbox para reintento de entrega al reconectar.
* **Cifrado y Transporte:** Adopción de WebRTC para streaming punto a punto y WebSockets para señalización determinista.

---

## 📄 Licencia

MIT — CHASKYAPP Enterprise Messaging Suite.
