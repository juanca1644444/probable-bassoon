import { create } from 'zustand'

export const useTenantStore = create((set, get) => ({
  activeTenant: null,
  tenantSettings: {
    appName: 'CHASKYAPP',
    companyLegalName: 'CHASKYAPP Enterprise',
    logoUrl: '',
    primaryColor: '#00a884',
    secondaryColor: '#111b21',
    footerText: 'Potenciado por CHASKYAPP Enterprise',
    supportEmail: 'soporte@chaskyapp.com',
    supportPhone: '+51 987 654 321',
    whiteLabelEnabled: 1
  },
  subscription: null,
  invoices: [],
  tenants: [],
  plans: [],
  licenseKeys: [],
  loading: false,
  error: null,

  // Fetch current tenant info, white-label settings and subscription
  fetchCurrentTenant: async () => {
    set({ loading: true, error: null })
    try {
      const [subRes, setRes] = await Promise.all([
        fetch('/api/saas/subscription/current').then(r => r.json()),
        fetch('/api/saas/tenant-settings').then(r => r.json())
      ])

      if (subRes.success) {
        set({
          activeTenant: subRes.tenant,
          subscription: subRes.subscription,
          invoices: subRes.invoices || []
        })
      }

      if (setRes.success && setRes.settings) {
        set({ tenantSettings: setRes.settings })
        // Apply primary color dynamic CSS variable
        if (typeof document !== 'undefined' && setRes.settings.primaryColor) {
          document.documentElement.style.setProperty('--wa-primary', setRes.settings.primaryColor)
        }
      }
    } catch (err) {
      console.warn('Failed to load current tenant data:', err)
      set({ error: err.message })
    } finally {
      set({ loading: false })
    }
  },

  // Fetch all tenants for superadmin
  fetchTenants: async () => {
    try {
      const res = await fetch('/api/saas/tenants').then(r => r.json())
      if (res.success) {
        set({ tenants: res.tenants || [] })
      }
    } catch (err) {
      console.error('Failed to load tenants:', err)
    }
  },

  // Fetch plans
  fetchPlans: async () => {
    try {
      const res = await fetch('/api/saas/plans').then(r => r.json())
      if (res.success) {
        set({ plans: res.plans || [] })
      }
    } catch (err) {
      console.error('Failed to load plans:', err)
    }
  },

  // Fetch license keys
  fetchLicenseKeys: async () => {
    try {
      const res = await fetch('/api/saas/license-keys').then(r => r.json())
      if (res.success) {
        set({ licenseKeys: res.keys || [] })
      }
    } catch (err) {
      console.error('Failed to load license keys:', err)
    }
  },

  // Switch active tenant context
  switchTenant: async (tenantId) => {
    set({ loading: true })
    try {
      const res = await fetch('/api/saas/tenants/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId })
      }).then(r => r.json())

      if (res.success) {
        await get().fetchCurrentTenant()
        await get().fetchTenants()
        return { success: true, message: res.message }
      } else {
        return { success: false, error: res.error }
      }
    } catch (err) {
      return { success: false, error: err.message }
    } finally {
      set({ loading: false })
    }
  },

  // Activate license key
  activateLicense: async (licenseKey) => {
    set({ loading: true })
    try {
      const res = await fetch('/api/saas/subscription/activate-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey })
      }).then(r => r.json())

      if (res.success) {
        await get().fetchCurrentTenant()
        return { success: true, message: res.message }
      } else {
        return { success: false, error: res.error }
      }
    } catch (err) {
      return { success: false, error: err.message }
    } finally {
      set({ loading: false })
    }
  },

  // Update white-label settings
  updateWhiteLabel: async (settings) => {
    set({ loading: true })
    try {
      const res = await fetch('/api/saas/tenant-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      }).then(r => r.json())

      if (res.success) {
        set((state) => ({
          tenantSettings: { ...state.tenantSettings, ...settings }
        }))
        if (typeof document !== 'undefined' && settings.primaryColor) {
          document.documentElement.style.setProperty('--wa-primary', settings.primaryColor)
        }
        return { success: true, message: res.message }
      } else {
        return { success: false, error: res.error }
      }
    } catch (err) {
      return { success: false, error: err.message }
    } finally {
      set({ loading: false })
    }
  }
}))

export default useTenantStore
