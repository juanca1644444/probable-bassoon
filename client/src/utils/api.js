import axios from 'axios'

// Resolución dinámica del Backend API para entorno local (PC), red local (LAN móvil), Serverless (Vercel/Netlify) y producción
const isDev = typeof window !== 'undefined' && (window.location.port === '5173' || window.location.port === '3000');
const host = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost';
const envBackend = import.meta.env.VITE_BACKEND_URL || (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app') ? 'https://probable-bassoon-wk5u.onrender.com' : null);

let dynamicBaseURL = '/api';
if (envBackend) {
  dynamicBaseURL = envBackend.endsWith('/api') ? envBackend : `${envBackend.replace(/\/$/, '')}/api`;
}

const api = axios.create({
  baseURL: dynamicBaseURL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
})

// Chats
export const fetchChats = () => api.get('/chats').then((r) => r.data)
export const createChat = (data) => api.post('/chats', data).then((r) => r.data)

// Messages
export const fetchMessages = (chatId, params = {}) =>
  api.get(`/messages/${chatId}`, { params }).then((r) => r.data)
export const sendMessage = (chatId, data) =>
  api.post(`/messages/${chatId}`, data).then((r) => r.data)

// Contacts
export const fetchContacts = () => api.get('/contacts').then((r) => r.data)
export const createContact = (data) => api.post('/contacts', data).then((r) => r.data)

// Files
export const uploadFile = (file, onProgress) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => onProgress && onProgress(Math.round((e.loaded * 100) / e.total))
  }).then((r) => r.data)
}

// Settings
export const fetchSettings = () => api.get('/settings').then((r) => r.data)
export const updateSettings = (data) => api.put('/settings', data).then((r) => r.data)

// AI Summary
export const fetchAiSummary = (chatId) =>
  api.post(`/ai-summary/${chatId}`).then((r) => r.data)

export default api
