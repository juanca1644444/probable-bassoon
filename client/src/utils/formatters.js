import { format, isToday, isYesterday, isSameWeek } from 'date-fns'
import { es } from 'date-fns/locale'

function toDate(ts) {
  if (!ts) return new Date()
  return typeof ts === 'string' ? new Date(ts) : new Date(ts)
}

// Alias used by ChatArea
export const formatTime = (ts) => format(toDate(ts), 'HH:mm')

export const formatDate = (ts) => {
  const d = toDate(ts)
  if (isToday(d))     return 'Hoy'
  if (isYesterday(d)) return 'Ayer'
  if (isSameWeek(d, new Date(), { locale: es })) return format(d, 'EEEE', { locale: es })
  return format(d, "d 'de' MMMM 'de' yyyy", { locale: es })
}

// Legacy names kept for Sidebar etc.
export const formatMessageTime  = formatTime
export const formatChatTime     = (ts) => {
  if (!ts) return ''
  const d = toDate(ts)
  if (isToday(d))     return format(d, 'HH:mm')
  if (isYesterday(d)) return 'Ayer'
  if (isSameWeek(d, new Date(), { locale: es })) return format(d, 'EEEE', { locale: es })
  return format(d, 'dd/MM/yy')
}
export const formatDateSeparator = formatDate
export const formatRelativeTime  = formatDate

export function formatFileSize(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0, size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return `${size.toFixed(1)} ${units[i]}`
}

export function getAvatarGradient(id) {
  const gradients = [
    'from-purple-500 to-blue-500',
    'from-green-500 to-teal-500',
    'from-orange-500 to-red-500',
    'from-pink-500 to-rose-500',
    'from-blue-500 to-cyan-500',
    'from-yellow-500 to-orange-500',
    'from-indigo-500 to-purple-500',
  ]
  const idx = (typeof id === 'string' ? id.charCodeAt(0) : (id || 0)) % gradients.length
  return `bg-gradient-to-br ${gradients[idx]}`
}

export function getInitials(name = '') {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}
