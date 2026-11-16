import { useEffect, useRef, useCallback } from 'react'
import useAppStore from '../store/useAppStore'
import { getWsUrl } from '../utils/wsUrl'

const RECONNECT_DELAY = 3000
const MAX_RECONNECT = 10

export default function useWebSocket() {
  const wsRef = useRef(null)
  const reconnectCountRef = useRef(0)
  const reconnectTimerRef = useRef(null)

  const { addMessage, setTypingUsers, setIsConnected, activeChat, addOrUpdateChat } = useAppStore()

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const ws = new WebSocket(getWsUrl())
      wsRef.current = ws

      ws.onopen = () => {
        reconnectCountRef.current = 0
        setIsConnected(true)
        console.log('[WS] Connected')
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleMessage(data)
        } catch (err) {
          console.error('[WS] Parse error', err)
        }
      }

      ws.onclose = () => {
        setIsConnected(false)
        console.log('[WS] Disconnected, reconnecting...')
        scheduleReconnect()
      }

      ws.onerror = (err) => {
        console.error('[WS] Error', err)
        ws.close()
      }
    } catch (err) {
      console.error('[WS] Cannot connect', err)
      scheduleReconnect()
    }
  }, [])  // eslint-disable-line

  const handleMessage = useCallback((data) => {
    switch (data.type) {
      case 'new_message':
        addMessage(data.chatId, data.message)
        break
      case 'new_chat':
      case 'chat_updated':
        if (data.chat) {
          addOrUpdateChat(data.chat)
        }
        break
      case 'typing':
        setTypingUsers(data.chatId, data.users)
        break
      case 'message_status':
        // handled by store action if needed
        break
      default:
        break
    }
  }, [addMessage, setTypingUsers, addOrUpdateChat])

  const scheduleReconnect = useCallback(() => {
    if (reconnectCountRef.current >= MAX_RECONNECT) return
    clearTimeout(reconnectTimerRef.current)
    reconnectTimerRef.current = setTimeout(() => {
      reconnectCountRef.current++
      connect()
    }, RECONNECT_DELAY)
  }, [connect])

  const sendTyping = useCallback((chatId, isTyping) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing', chatId, isTyping }))
    }
  }, [])

  const sendWsMessage = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { sendTyping, sendWsMessage }
}
