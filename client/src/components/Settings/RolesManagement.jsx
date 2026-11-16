import React, { useState, useEffect } from 'react'
import useAppStore from '../../store/useAppStore'
import { getAvatarGradient, getInitials } from '../../utils/formatters'

export default function RolesManagement() {
  const { addToast } = useAppStore()
  const [activeSubTab, setActiveSubTab] = useState('members') // 'members' | 'matrix'
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingRoleId, setSavingRoleId] = useState(null)
  const [savingUserId, setSavingUserId] = useState(null)
  const [selectedRoleForMatrix, setSelectedRoleForMatrix] = useState('supervisor')
  const [rolePermissionsDraft, setRolePermissionsDraft] = useState({})

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true)
    try {
      const [rolesRes, permsRes, usersRes] = await Promise.all([
        fetch('/api/rbac/roles'),
        fetch('/api/rbac/permissions'),
        fetch('/api/rbac/users'),
      ])

      if (rolesRes.ok && permsRes.ok && usersRes.ok) {
        const rolesData = await rolesRes.json()
        const permsData = await permsRes.json()
        const usersData = await usersRes.json()

        setRoles(rolesData)
        setPermissions(permsData)
        setUsers(usersData)

        // Initialize draft for matrix permissions
        const drafts = {}
        rolesData.forEach((r) => {
          drafts[r.id] = [...(r.permissions || [])]
        })
        setRolePermissionsDraft(drafts)
      }
    } catch (err) {
      console.error('Error fetching RBAC data:', err)
      addToast({
        id: `toast-${Date.now()}`,
        name: 'Error RBAC',
        message: 'No se pudo cargar la configuración de roles',
        avatar: '',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Assign role to user
  const handleAssignUserRole = async (userId, newRoleId) => {
    setSavingUserId(userId)
    try {
      const res = await fetch(`/api/rbac/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId: newRoleId }),
      })
      if (res.ok) {
        const data = await res.json()
        addToast({
          id: `toast-${Date.now()}`,
          name: 'Roles de Equipo',
          message: `Rol actualizado a ${data.roleName || newRoleId}`,
          avatar: '',
        })
        // Update local user state
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId
              ? {
                  ...u,
                  roleId: newRoleId,
                  roleName: roles.find((r) => r.id === newRoleId)?.name || newRoleId,
                }
              : u
          )
        )
      } else {
        const err = await res.json()
        alert(err.error || 'Error al cambiar rol')
      }
    } catch (e) {
      console.error('Error updating user role:', e)
    } finally {
      setSavingUserId(null)
    }
  }

  // Toggle permission for selected role in draft
  const handleTogglePermission = (roleId, permId) => {
    if (roleId === 'admin') return // Admin has all permissions locked
    setRolePermissionsDraft((prev) => {
      const current = prev[roleId] || []
      const exists = current.includes(permId)
      const next = exists
        ? current.filter((id) => id !== permId)
        : [...current, permId]
      return { ...prev, [roleId]: next }
    })
  }

  // Save role permissions to backend
  const handleSaveRolePermissions = async (roleId) => {
    if (roleId === 'admin') return
    setSavingRoleId(roleId)
    try {
      const newPerms = rolePermissionsDraft[roleId] || []
      const res = await fetch(`/api/rbac/roles/${roleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: newPerms }),
      })
      if (res.ok) {
        addToast({
          id: `toast-${Date.now()}`,
          name: 'Permisos Actualizados',
          message: `Permisos guardados para el rol ${roleId}`,
          avatar: '',
        })
        // Refresh local roles list
        setRoles((prev) =>
          prev.map((r) => (r.id === roleId ? { ...r, permissions: newPerms } : r))
        )
      }
    } catch (e) {
      console.error('Error saving role permissions:', e)
    } finally {
      setSavingRoleId(null)
    }
  }

  // Helper for role color badge
  const getRoleBadgeStyle = (roleId) => {
    switch (roleId) {
      case 'admin':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/40 ring-1 ring-purple-500/30'
      case 'supervisor':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/40 ring-1 ring-blue-500/30'
      case 'sales':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 ring-1 ring-emerald-500/30'
      case 'support':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40 ring-1 ring-amber-500/30'
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/40'
    }
  }

  // Group permissions by category
  const categories = Array.from(new Set(permissions.map((p) => p.category)))

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-wa-secondary space-y-3">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs">Cargando roles y permisos del equipo...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in text-wa-text">
      {/* Header */}
      <div className="border-b border-white/5 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-wa-text flex items-center gap-2">
            <span>👥</span>
            <span>Control de Acceso Basado en Roles (RBAC)</span>
          </h3>
          <p className="text-xs text-wa-secondary">
            Gestiona los miembros del equipo, asigna roles de trabajo y define permisos granulares de seguridad.
          </p>
        </div>

        {/* Subtabs Switcher */}
        <div className="flex items-center gap-1 bg-wa-header p-1 rounded-xl border border-white/5 self-start">
          <button
            type="button"
            onClick={() => setActiveSubTab('members')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'members'
                ? 'bg-wa-green text-white shadow-sm'
                : 'text-wa-secondary hover:text-wa-text hover:bg-white/5'
            }`}
          >
            <span>👤</span>
            <span>Miembros ({users.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('matrix')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'matrix'
                ? 'bg-wa-green text-white shadow-sm'
                : 'text-wa-secondary hover:text-wa-text hover:bg-white/5'
            }`}
          >
            <span>🛡️</span>
            <span>Matriz de Permisos</span>
          </button>
        </div>
      </div>

      {/* ── TAB 1: MIEMBROS DEL EQUIPO ──────────────────────────────────── */}
      {activeSubTab === 'members' && (
        <div className="space-y-4">
          <div className="bg-wa-sidebar/70 rounded-2xl border border-white/10 overflow-hidden shadow-lg">
            <div className="p-3.5 bg-wa-header/80 border-b border-white/5 flex items-center justify-between">
              <span className="text-xs font-bold text-wa-text uppercase tracking-wider">
                Operadores y Agentes Registrados
              </span>
              <span className="text-[11px] text-emerald-400 font-medium">
                ✓ 4 agentes activos en CHASKYAPP
              </span>
            </div>

            <div className="divide-y divide-white/5">
              {users.map((u) => {
                const isCurrentUser = u.id === 'agent-me'
                const userRole = roles.find((r) => r.id === u.roleId)
                const permCount = userRole?.permissions?.length || 0

                return (
                  <div
                    key={u.id}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                  >
                    {/* User info */}
                    <div className="flex items-center gap-3.5">
                      <div className="relative">
                        {u.avatar ? (
                          <img
                            src={u.avatar}
                            alt={u.name}
                            className="w-11 h-11 rounded-full object-cover ring-2 ring-emerald-500/40"
                          />
                        ) : (
                          <div
                            className={`w-11 h-11 rounded-full ${getAvatarGradient(
                              u.name
                            )} flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-emerald-500/30`}
                          >
                            {getInitials(u.name)}
                          </div>
                        )}
                        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-wa-header rounded-full" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-wa-text">{u.name}</h4>
                          {isCurrentUser && (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-semibold border border-emerald-500/30">
                              Tú (Operador Principal)
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-wa-secondary">{u.email}</p>
                        <p className="text-[10px] text-wa-secondary/80 mt-0.5">
                          {permCount} permisos activos • Asignación de chats disponible
                        </p>
                      </div>
                    </div>

                    {/* Role selector */}
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${getRoleBadgeStyle(
                          u.roleId
                        )}`}
                      >
                        {u.roleName || u.roleId}
                      </span>

                      {isCurrentUser ? (
                        <span className="text-[11px] text-wa-secondary italic px-2">
                          Administrador Principal
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <select
                            value={u.roleId}
                            onChange={(e) => handleAssignUserRole(u.id, e.target.value)}
                            disabled={savingUserId === u.id}
                            className="bg-wa-header text-xs text-wa-text border border-gray-700/60 rounded-xl px-3 py-1.5 outline-none focus:border-emerald-500 cursor-pointer transition-colors"
                          >
                            {roles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                          {savingUserId === u.id && (
                            <span className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Role summary card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            {roles.map((r) => (
              <div
                key={r.id}
                className="bg-wa-header/70 p-3.5 rounded-xl border border-white/5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${getRoleBadgeStyle(
                      r.id
                    )}`}
                  >
                    {r.name}
                  </span>
                  <span className="text-[10px] text-wa-secondary font-mono">
                    {r.userCount || 0} agentes
                  </span>
                </div>
                <p className="text-xs text-wa-secondary leading-snug">{r.description}</p>
                <div className="text-[11px] text-emerald-400/90 font-medium pt-1 border-t border-white/5 flex items-center justify-between">
                  <span>Permisos:</span>
                  <span className="font-bold">{r.permissions?.length || 0} / {permissions.length}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 2: MATRIZ DE PERMISOS POR ROL ───────────────────────────── */}
      {activeSubTab === 'matrix' && (
        <div className="space-y-4">
          {/* Role selector pill bar */}
          <div className="flex flex-wrap items-center gap-2 p-1.5 bg-wa-sidebar/80 rounded-2xl border border-white/10">
            {roles.map((r) => {
              const isSelected = selectedRoleForMatrix === r.id
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRoleForMatrix(r.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-wa-secondary hover:text-wa-text hover:bg-white/5'
                  }`}
                >
                  <span>{r.name}</span>
                  {r.id === 'admin' ? (
                    <span className="text-[10px] bg-black/25 px-1.5 py-0.2 rounded-full">
                      👑 Total
                    </span>
                  ) : (
                    <span className="text-[10px] bg-white/10 px-1.5 py-0.2 rounded-full">
                      {(rolePermissionsDraft[r.id] || []).length} perms
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Current selected role card */}
          {(() => {
            const role = roles.find((r) => r.id === selectedRoleForMatrix)
            const draftPerms = rolePermissionsDraft[selectedRoleForMatrix] || []
            const isAdmin = selectedRoleForMatrix === 'admin'

            return (
              <div className="bg-wa-sidebar/70 rounded-2xl border border-white/10 p-5 space-y-4 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/5 pb-3">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h4 className="text-sm font-bold text-wa-text">{role?.name}</h4>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${getRoleBadgeStyle(
                          role?.id
                        )}`}
                      >
                        {role?.id}
                      </span>
                    </div>
                    <p className="text-xs text-wa-secondary mt-1">{role?.description}</p>
                  </div>

                  {!isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleSaveRolePermissions(role?.id)}
                      disabled={savingRoleId === role?.id}
                      className="px-4 py-2 bg-wa-green hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 self-start"
                    >
                      {savingRoleId === role?.id ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Guardando...</span>
                        </>
                      ) : (
                        <>
                          <span>💾</span>
                          <span>Guardar Permisos de {role?.name}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {isAdmin && (
                  <div className="p-3 bg-purple-950/30 border border-purple-500/30 rounded-xl text-xs text-purple-200 flex items-center gap-2.5">
                    <span className="text-lg">🛡️</span>
                    <p>
                      <strong>Rol de Administrador Protegido:</strong> Posee todos los privilegios del sistema por diseño y no puede ser deshabilitado para evitar bloqueos del sistema.
                    </p>
                  </div>
                )}

                {/* Permissions grouped by category */}
                <div className="space-y-4 pt-1">
                  {categories.map((cat) => {
                    const catPerms = permissions.filter((p) => p.category === cat)
                    return (
                      <div
                        key={cat}
                        className="bg-wa-header/60 rounded-xl p-3.5 border border-white/5 space-y-2.5"
                      >
                        <h5 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span>📁</span>
                          <span>{cat}</span>
                        </h5>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {catPerms.map((p) => {
                            const isChecked = isAdmin || draftPerms.includes(p.id)

                            return (
                              <label
                                key={p.id}
                                className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all ${
                                  isChecked
                                    ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-100'
                                    : 'bg-black/20 border-white/5 text-wa-secondary hover:border-white/10'
                                } ${isAdmin ? 'cursor-not-allowed opacity-90' : 'cursor-pointer hover:bg-white/5'}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={isAdmin}
                                  onChange={() => handleTogglePermission(role.id, p.id)}
                                  className="mt-0.5 h-4 w-4 rounded border-gray-700 text-wa-green focus:ring-wa-green/30 bg-wa-header"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-wa-text">{p.name}</span>
                                    <span className="text-[10px] font-mono text-gray-400">{p.id}</span>
                                  </div>
                                  <p className="text-[11px] text-wa-secondary mt-0.5 leading-snug">
                                    {p.description}
                                  </p>
                                </div>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
