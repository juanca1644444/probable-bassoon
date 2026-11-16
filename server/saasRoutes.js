'use strict';
/**
 * saasRoutes.js — Multi-Tenant Licensing, Subscriptions & Automated Billing Engine for CHASKYAPP
 * Provides full tenant isolation, quotas, license key activation, subscription billing,
 * and white-label customization.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('./database');

const router = express.Router();

// ─── Initialize SaaS Tables & Seed Data ─────────────────────────────────────
function initSaasTables() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      description TEXT,
      priceMonthly REAL DEFAULT 0,
      priceYearly REAL DEFAULT 0,
      currency TEXT DEFAULT 'USD',
      maxAgents INTEGER DEFAULT 5,
      maxMonthlyChats INTEGER DEFAULT 1000,
      maxStorageMb INTEGER DEFAULT 2048,
      features TEXT DEFAULT '[]',
      isPopular INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      createdAt INTEGER DEFAULT (strftime('%s','now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      domain TEXT,
      status TEXT DEFAULT 'active', -- 'active', 'suspended', 'trial', 'expired'
      planId TEXT NOT NULL,
      billingCycle TEXT DEFAULT 'monthly', -- 'monthly', 'yearly'
      maxAgents INTEGER DEFAULT 5,
      maxMonthlyChats INTEGER DEFAULT 1000,
      maxStorageMb INTEGER DEFAULT 5120,
      currentChatsCount INTEGER DEFAULT 0,
      currentAgentsCount INTEGER DEFAULT 1,
      currentStorageMb INTEGER DEFAULT 120,
      ownerName TEXT DEFAULT 'Administrador',
      ownerEmail TEXT DEFAULT 'admin@tenant.com',
      ownerPhone TEXT,
      createdAt INTEGER DEFAULT (strftime('%s','now') * 1000),
      expiresAt INTEGER,
      FOREIGN KEY (planId) REFERENCES plans(id)
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      planId TEXT NOT NULL,
      status TEXT DEFAULT 'active', -- 'active', 'past_due', 'canceled', 'trialing'
      billingCycle TEXT DEFAULT 'monthly',
      currentPeriodStart INTEGER DEFAULT (strftime('%s','now') * 1000),
      currentPeriodEnd INTEGER,
      amount REAL DEFAULT 0,
      currency TEXT DEFAULT 'USD',
      paymentMethod TEXT DEFAULT 'license_key',
      lastPaymentDate INTEGER DEFAULT (strftime('%s','now') * 1000),
      invoiceNumber TEXT,
      autoRenew INTEGER DEFAULT 1,
      createdAt INTEGER DEFAULT (strftime('%s','now') * 1000),
      FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (planId) REFERENCES plans(id)
    );

    CREATE TABLE IF NOT EXISTS license_keys (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      planId TEXT NOT NULL,
      durationDays INTEGER DEFAULT 365,
      isRedeemed INTEGER DEFAULT 0,
      redeemedByTenantId TEXT,
      redeemedAt INTEGER,
      createdForOrganization TEXT,
      createdAt INTEGER DEFAULT (strftime('%s','now') * 1000),
      FOREIGN KEY (planId) REFERENCES plans(id)
    );

    CREATE TABLE IF NOT EXISTS tenant_settings (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL UNIQUE,
      appName TEXT DEFAULT 'CHASKYAPP',
      companyLegalName TEXT DEFAULT 'CHASKYAPP Enterprise',
      logoUrl TEXT,
      faviconUrl TEXT,
      primaryColor TEXT DEFAULT '#00a884',
      secondaryColor TEXT DEFAULT '#111b21',
      footerText TEXT DEFAULT 'Potenciado por CHASKYAPP Enterprise',
      supportEmail TEXT DEFAULT 'soporte@chaskyapp.com',
      supportPhone TEXT DEFAULT '+51 987 654 321',
      customCss TEXT DEFAULT '',
      whiteLabelEnabled INTEGER DEFAULT 1,
      updatedAt INTEGER DEFAULT (strftime('%s','now') * 1000),
      FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tenant_usage_ledger (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      metricType TEXT NOT NULL, -- 'chat_sent', 'storage_bytes', 'ai_tokens', 'api_calls'
      quantity INTEGER DEFAULT 1,
      recordedAt INTEGER DEFAULT (strftime('%s','now') * 1000),
      metadata TEXT,
      FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE
    );
  `);

  // Ensure active tenant setting exists
  try {
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('active_tenant_id', 'tenant_default')").run();
  } catch (_) {}

  // Add tenantId column to chats if not present
  try {
    db.exec("ALTER TABLE chats ADD COLUMN tenantId TEXT DEFAULT 'tenant_default'");
  } catch (_) {}

  // Seed default plans if empty
  const planCount = db.prepare('SELECT COUNT(*) as c FROM plans').get();
  if (planCount.c === 0) {
    const insertPlan = db.prepare(`
      INSERT INTO plans (id, name, code, description, priceMonthly, priceYearly, currency, maxAgents, maxMonthlyChats, maxStorageMb, features, isPopular, isActive)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    insertPlan.run(
      'plan_basic_edu',
      'Plan Educativo / Básico',
      'plan_basic_edu',
      'Ideal para colegios, academias e instituciones formativas con atención estructurada a estudiantes y padres.',
      29.00,
      290.00,
      'USD',
      3,
      500,
      2048,
      JSON.stringify([
        'Hasta 3 Agentes de Atención simultáneos',
        '500 Conversaciones mensuales incluidas',
        '2 GB Almacenamiento multimedia seguro',
        'Canales: WhatsApp Web y Telegram',
        'Horarios de Atención y Respuestas Rápidas',
        'Encuestas de Satisfacción CSAT básicas',
        'Soporte estándar por correo'
      ]),
      0
    );

    insertPlan.run(
      'plan_pro',
      'Plan Chasky Pro',
      'plan_pro',
      'La solución completa para pymes y empresas en crecimiento con omnicanalidad total e inteligencia artificial.',
      79.00,
      790.00,
      'USD',
      15,
      5000,
      15360,
      JSON.stringify([
        'Hasta 15 Agentes de Atención simultáneos',
        '5,000 Conversaciones mensuales incluidas',
        '15 GB Almacenamiento en la nube',
        'Omnicanalidad total (WhatsApp, Facebook, Instagram, Web)',
        'Copilot IA para Asistencia y Sugerencias Inteligentes',
        'Campañas Masivas con filtros y plantillas HSM',
        'Gestión de Roles RBAC y Auditoría en tiempo real',
        'Transcripción de Voz y Traducción Automática',
        'Soporte Prioritario 24/7'
      ]),
      1
    );

    insertPlan.run(
      'plan_enterprise',
      'Plan Enterprise / Ilimitado',
      'plan_enterprise',
      'Para grandes corporaciones, franquicias y gobiernos con requerimientos de alta disponibilidad y marca blanca total.',
      199.00,
      1990.00,
      'USD',
      100,
      50000,
      102400,
      JSON.stringify([
        'Agentes de Atención Ilimitados (100+)',
        '50,000+ Conversaciones mensuales de alta capacidad',
        '100 GB Almacenamiento dedicado de alta velocidad',
        'Personalización White-Label Total (Logo, Colores, Dominio y Footer)',
        'Centro de Desarrolladores (API Keys & Webhooks Hub ilimitado)',
        'Motor RAG Autónomo con múltiples Bases de Conocimiento',
        'Despliegue On-Premise / Docker privado',
        'SLA 99.9% de Disponibilidad y Gestor de Cuenta Dedicado'
      ]),
      0
    );
  }

  // Seed default tenants if empty
  const tenantCount = db.prepare('SELECT COUNT(*) as c FROM tenants').get();
  if (tenantCount.c === 0) {
    const now = Date.now();
    const oneYearLater = now + 365 * 24 * 60 * 60 * 1000;

    const insTenant = db.prepare(`
      INSERT INTO tenants (id, name, slug, domain, status, planId, billingCycle, maxAgents, maxMonthlyChats, maxStorageMb, currentChatsCount, currentAgentsCount, currentStorageMb, ownerName, ownerEmail, ownerPhone, createdAt, expiresAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insSub = db.prepare(`
      INSERT INTO subscriptions (id, tenantId, planId, status, billingCycle, currentPeriodStart, currentPeriodEnd, amount, currency, paymentMethod, lastPaymentDate, invoiceNumber, autoRenew)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const insSettings = db.prepare(`
      INSERT INTO tenant_settings (id, tenantId, appName, companyLegalName, logoUrl, primaryColor, secondaryColor, footerText, supportEmail, supportPhone, customCss, whiteLabelEnabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    // 1. CHASKYAPP Global HQ (Default Tenant)
    insTenant.run(
      'tenant_default',
      'CHASKYAPP Global HQ',
      'chaskyapp-hq',
      'app.chaskyapp.com',
      'active',
      'plan_pro',
      'yearly',
      15,
      5000,
      15360,
      28,
      4,
      350,
      'Juan Carlos Mendoza',
      'admin@chaskyapp.com',
      '+51 987 654 321',
      now,
      oneYearLater
    );
    insSub.run(
      uuidv4(),
      'tenant_default',
      'plan_pro',
      'active',
      'yearly',
      now,
      oneYearLater,
      790.00,
      'USD',
      'license_key',
      now,
      'INV-2026-001'
    );
    insSettings.run(
      uuidv4(),
      'tenant_default',
      'CHASKYAPP',
      'CHASKYAPP Technologies S.A.C.',
      '',
      '#00a884',
      '#111b21',
      'CHASKYAPP Enterprise • Mensajería Omnicanal Andina',
      'contacto@chaskyapp.com',
      '+51 987 654 321',
      ''
    );

    // 2. Colegio San Martín de Porres (Red Educativa)
    insTenant.run(
      'tenant_colegio_san_martin',
      'Colegio San Martín de Porres',
      'colegio-san-martin',
      'sanmartin.edu.pe',
      'active',
      'plan_basic_edu',
      'monthly',
      3,
      500,
      2048,
      142,
      2,
      180,
      'Directora Patricia Valdivia',
      'direccion@sanmartin.edu.pe',
      '+51 1 456 7890',
      now,
      now + 30 * 24 * 60 * 60 * 1000
    );
    insSub.run(
      uuidv4(),
      'tenant_colegio_san_martin',
      'plan_basic_edu',
      'active',
      'monthly',
      now,
      now + 30 * 24 * 60 * 60 * 1000,
      29.00,
      'USD',
      'license_key',
      now,
      'INV-2026-042'
    );
    insSettings.run(
      uuidv4(),
      'tenant_colegio_san_martin',
      'San Martín Chat Educativo',
      'Consorcio Educativo San Martín de Porres',
      'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=100&h=100&fit=crop',
      '#2563eb', // Royal Blue
      '#0f172a',
      'Plataforma de Atención y Tutoría Escolar • Colegio San Martín',
      'atencion@sanmartin.edu.pe',
      '+51 1 456 7890',
      ''
    );

    // 3. Corporación Retail Andina S.A.C.
    insTenant.run(
      'tenant_retail_andina',
      'Corporación Retail Andina S.A.C.',
      'retail-andina',
      'andina-express.com',
      'active',
      'plan_enterprise',
      'yearly',
      100,
      50000,
      102400,
      4120,
      28,
      5400,
      'Gerente de Logística Roberto Paz',
      'rpaz@andina-express.com',
      '+51 999 888 777',
      now,
      oneYearLater
    );
    insSub.run(
      uuidv4(),
      'tenant_retail_andina',
      'plan_enterprise',
      'active',
      'yearly',
      now,
      oneYearLater,
      1990.00,
      'USD',
      'license_key',
      now,
      'INV-2026-108'
    );
    insSettings.run(
      uuidv4(),
      'tenant_retail_andina',
      'Andina Express Contact Center',
      'Corporación Retail Andina S.A.C.',
      'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=100&h=100&fit=crop',
      '#7c3aed', // Purple
      '#18181b',
      'Atención al Cliente Retail Andina • Cobertura Nacional',
      'soporte@andina-express.com',
      '+51 999 888 777',
      ''
    );
  }

  // Seed sample license keys if empty
  const keyCount = db.prepare('SELECT COUNT(*) as c FROM license_keys').get();
  if (keyCount.c === 0) {
    const insKey = db.prepare(`
      INSERT INTO license_keys (id, key, planId, durationDays, isRedeemed, createdForOrganization, createdAt)
      VALUES (?, ?, ?, ?, 0, ?, (strftime('%s','now') * 1000))
    `);
    insKey.run(uuidv4(), 'CHASKY-PRO-2026-X881', 'plan_pro', 365, 'Clientes Chasky Pro Anual');
    insKey.run(uuidv4(), 'CHASKY-ENT-2026-VIP9', 'plan_enterprise', 365, 'Cuentas Corporativas Enterprise');
    insKey.run(uuidv4(), 'CHASKY-EDU-2026-EDU1', 'plan_basic_edu', 365, 'Instituciones y Redes Educativas');
    insKey.run(uuidv4(), 'CHASKY-PRO-RENOV-2027', 'plan_pro', 365, 'Renovaciones de Licencia Pro');
  }
}

// Call table initialization
initSaasTables();

// ─── Multi-Tenant Middleware ───────────────────────────────────────────────
function multiTenantMiddleware(req, res, next) {
  try {
    const db = getDb();
    
    // Resolve tenant identifier from:
    // 1. Header 'x-tenant-id'
    // 2. Query param 'tenantId'
    // 3. Stored active_tenant_id setting in db
    let tenantId = req.headers['x-tenant-id'] || req.query.tenantId;

    if (!tenantId) {
      const activeSetting = db.prepare("SELECT value FROM settings WHERE key = 'active_tenant_id'").get();
      tenantId = activeSetting ? activeSetting.value : 'tenant_default';
    }

    // Retrieve tenant record
    let tenant = db.prepare(`
      SELECT t.*, p.name AS planName, p.code AS planCode, p.features AS planFeatures
      FROM tenants t
      LEFT JOIN plans p ON t.planId = p.id
      WHERE t.id = ? OR t.slug = ?
    `).get(tenantId, tenantId);

    // Fallback if tenant not found
    if (!tenant) {
      tenant = db.prepare(`
        SELECT t.*, p.name AS planName, p.code AS planCode, p.features AS planFeatures
        FROM tenants t
        LEFT JOIN plans p ON t.planId = p.id
        WHERE t.id = 'tenant_default'
      `).get();
    }

    if (tenant) {
      // Get white-label settings
      const settings = db.prepare('SELECT * FROM tenant_settings WHERE tenantId = ?').get(tenant.id);
      req.tenant = tenant;
      req.tenantSettings = settings || {
        appName: 'CHASKYAPP',
        companyLegalName: 'CHASKYAPP Enterprise',
        primaryColor: '#00a884',
        secondaryColor: '#111b21',
        footerText: 'Potenciado por CHASKYAPP Enterprise'
      };
    }

    next();
  } catch (err) {
    console.error('Multi-tenant middleware error:', err);
    next();
  }
}

// ─── Helper: Get Active Tenant ID ──────────────────────────────────────────
function getActiveTenantId(db) {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'active_tenant_id'").get();
  return row ? row.value : 'tenant_default';
}

// ─── API Endpoints ──────────────────────────────────────────────────────────

// 1. GET /api/saas/tenants — List all tenants with plan and settings info
router.get('/tenants', (req, res) => {
  const db = getDb();
  try {
    const tenants = db.prepare(`
      SELECT t.*, 
             p.name AS planName, p.code AS planCode, p.priceMonthly, p.priceYearly,
             s.appName, s.companyLegalName, s.logoUrl, s.primaryColor, s.footerText, s.supportEmail, s.supportPhone
      FROM tenants t
      LEFT JOIN plans p ON t.planId = p.id
      LEFT JOIN tenant_settings s ON t.id = s.tenantId
      ORDER BY t.createdAt ASC
    `).all();

    const activeTenantId = getActiveTenantId(db);

    res.json({
      success: true,
      activeTenantId,
      tenants: tenants.map(t => ({
        ...t,
        isActiveTenant: t.id === activeTenantId,
        isExpired: t.expiresAt ? Date.now() > t.expiresAt : false
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. POST /api/saas/tenants — Create new Tenant
router.post('/tenants', (req, res) => {
  const db = getDb();
  const {
    name,
    slug,
    domain = '',
    planId = 'plan_pro',
    billingCycle = 'monthly',
    ownerName = 'Administrador',
    ownerEmail = 'admin@tenant.com',
    ownerPhone = '',
    primaryColor = '#00a884',
    appName
  } = req.body;

  if (!name || !slug) {
    return res.status(400).json({ error: 'Nombre y Slug son requeridos para la organización.' });
  }

  const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-');

  try {
    // Check slug uniqueness
    const existing = db.prepare('SELECT id FROM tenants WHERE slug = ?').get(cleanSlug);
    if (existing) {
      return res.status(400).json({ error: `El slug '${cleanSlug}' ya se encuentra en uso por otra organización.` });
    }

    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId) || 
                 db.prepare("SELECT * FROM plans WHERE id = 'plan_pro'").get();

    const tenantId = 'tenant_' + cleanSlug.replace(/-/g, '_') + '_' + Math.random().toString(36).slice(2, 6);
    const now = Date.now();
    const durationDays = billingCycle === 'yearly' ? 365 : 30;
    const expiresAt = now + durationDays * 24 * 60 * 60 * 1000;

    const insTenant = db.prepare(`
      INSERT INTO tenants (id, name, slug, domain, status, planId, billingCycle, maxAgents, maxMonthlyChats, maxStorageMb, currentChatsCount, currentAgentsCount, currentStorageMb, ownerName, ownerEmail, ownerPhone, createdAt, expiresAt)
      VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, 0, 1, 50, ?, ?, ?, ?, ?)
    `);

    insTenant.run(
      tenantId,
      name.trim(),
      cleanSlug,
      domain.trim() || null,
      plan.id,
      billingCycle,
      plan.maxAgents,
      plan.maxMonthlyChats,
      plan.maxStorageMb,
      ownerName.trim(),
      ownerEmail.trim(),
      ownerPhone.trim() || null,
      now,
      expiresAt
    );

    // Create Subscription record
    const amount = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
    const insSub = db.prepare(`
      INSERT INTO subscriptions (id, tenantId, planId, status, billingCycle, currentPeriodStart, currentPeriodEnd, amount, currency, paymentMethod, lastPaymentDate, invoiceNumber, autoRenew)
      VALUES (?, ?, ?, 'active', ?, ?, ?, ?, 'USD', 'trial_setup', ?, ?, 1)
    `);
    const invoiceNum = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    insSub.run(uuidv4(), tenantId, plan.id, billingCycle, now, expiresAt, amount, now, invoiceNum);

    // Create Tenant Settings record (White-Label)
    const insSettings = db.prepare(`
      INSERT INTO tenant_settings (id, tenantId, appName, companyLegalName, logoUrl, primaryColor, secondaryColor, footerText, supportEmail, supportPhone, customCss, whiteLabelEnabled)
      VALUES (?, ?, ?, ?, '', ?, '#111b21', ?, ?, ?, '', 1)
    `);
    insSettings.run(
      uuidv4(),
      tenantId,
      appName?.trim() || name.trim(),
      name.trim() + ' S.A.C.',
      primaryColor || '#00a884',
      `${name.trim()} • Potenciado por CHASKYAPP Enterprise`,
      ownerEmail.trim(),
      ownerPhone.trim() || '+51 987 654 321'
    );

    // Fetch created tenant
    const created = db.prepare(`
      SELECT t.*, p.name AS planName, s.appName, s.primaryColor
      FROM tenants t
      LEFT JOIN plans p ON t.planId = p.id
      LEFT JOIN tenant_settings s ON t.id = s.tenantId
      WHERE t.id = ?
    `).get(tenantId);

    res.status(201).json({
      success: true,
      message: `Organización inquilina '${name}' aprovisionada exitosamente.`,
      tenant: created
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. PUT /api/saas/tenants/:id — Update Tenant details & quotas
router.put('/tenants/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const {
    name,
    domain,
    status,
    planId,
    billingCycle,
    maxAgents,
    maxMonthlyChats,
    maxStorageMb,
    ownerName,
    ownerEmail,
    ownerPhone
  } = req.body;

  try {
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(id);
    if (!tenant) {
      return res.status(404).json({ error: 'Organización inquilina no encontrada.' });
    }

    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name.trim()); }
    if (domain !== undefined) { updates.push('domain = ?'); values.push(domain.trim() || null); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (planId !== undefined) { updates.push('planId = ?'); values.push(planId); }
    if (billingCycle !== undefined) { updates.push('billingCycle = ?'); values.push(billingCycle); }
    if (maxAgents !== undefined) { updates.push('maxAgents = ?'); values.push(Number(maxAgents)); }
    if (maxMonthlyChats !== undefined) { updates.push('maxMonthlyChats = ?'); values.push(Number(maxMonthlyChats)); }
    if (maxStorageMb !== undefined) { updates.push('maxStorageMb = ?'); values.push(Number(maxStorageMb)); }
    if (ownerName !== undefined) { updates.push('ownerName = ?'); values.push(ownerName.trim()); }
    if (ownerEmail !== undefined) { updates.push('ownerEmail = ?'); values.push(ownerEmail.trim()); }
    if (ownerPhone !== undefined) { updates.push('ownerPhone = ?'); values.push(ownerPhone.trim() || null); }

    if (updates.length > 0) {
      values.push(id);
      db.prepare(`UPDATE tenants SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare(`
      SELECT t.*, p.name AS planName
      FROM tenants t
      LEFT JOIN plans p ON t.planId = p.id
      WHERE t.id = ?
    `).get(id);

    res.json({
      success: true,
      message: 'Organización actualizada correctamente.',
      tenant: updated
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. POST /api/saas/tenants/:id/status — Toggle status ('active', 'suspended', 'trial', 'expired')
router.post('/tenants/:id/status', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['active', 'suspended', 'trial', 'expired'].includes(status)) {
    return res.status(400).json({ error: 'Estado de tenant inválido.' });
  }

  try {
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(id);
    if (!tenant) {
      return res.status(404).json({ error: 'Organización inquilina no encontrada.' });
    }

    db.prepare('UPDATE tenants SET status = ? WHERE id = ?').run(status, id);

    res.json({
      success: true,
      message: `El estado de '${tenant.name}' se actualizó a ${status.toUpperCase()}.`,
      status
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. POST /api/saas/tenants/switch — Switch Active Tenant context
router.post('/tenants/switch', (req, res) => {
  const db = getDb();
  const { tenantId } = req.body;

  if (!tenantId) {
    return res.status(400).json({ error: 'Se requiere el ID de la organización a conmutar.' });
  }

  try {
    const tenant = db.prepare(`
      SELECT t.*, p.name AS planName, s.appName, s.primaryColor, s.logoUrl
      FROM tenants t
      LEFT JOIN plans p ON t.planId = p.id
      LEFT JOIN tenant_settings s ON t.id = s.tenantId
      WHERE t.id = ?
    `).get(tenantId);

    if (!tenant) {
      return res.status(404).json({ error: 'Organización inquilina no encontrada.' });
    }

    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('active_tenant_id', ?)").run(tenantId);

    res.json({
      success: true,
      message: `Contexto conmutado exitosamente a '${tenant.name}'.`,
      activeTenantId: tenantId,
      tenant
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. DELETE /api/saas/tenants/:id — Delete tenant
router.delete('/tenants/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;

  if (id === 'tenant_default') {
    return res.status(400).json({ error: 'No es posible eliminar la organización principal del sistema.' });
  }

  try {
    db.prepare('DELETE FROM subscriptions WHERE tenantId = ?').run(id);
    db.prepare('DELETE FROM tenant_settings WHERE tenantId = ?').run(id);
    const result = db.prepare('DELETE FROM tenants WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Organización inquilina no encontrada.' });
    }

    // Reset active tenant if this was active
    const active = getActiveTenantId(db);
    if (active === id) {
      db.prepare("UPDATE settings SET value = 'tenant_default' WHERE key = 'active_tenant_id'").run();
    }

    res.json({ success: true, message: 'Organización inquilina eliminada exitosamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. GET /api/saas/plans — List all plans
router.get('/plans', (req, res) => {
  const db = getDb();
  try {
    const plans = db.prepare('SELECT * FROM plans WHERE isActive = 1 ORDER BY priceMonthly ASC').all();
    res.json({
      success: true,
      plans: plans.map(p => ({
        ...p,
        features: JSON.parse(p.features || '[]')
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. GET /api/saas/subscription/current & /api/saas/license/status — Get current tenant subscription, quotas & invoices
router.get(['/subscription/current', '/license/status'], (req, res) => {
  const db = getDb();
  try {
    const activeTenantId = getActiveTenantId(db);
    const tenant = db.prepare(`
      SELECT t.*, p.name AS planName, p.code AS planCode, p.description AS planDescription,
             p.priceMonthly, p.priceYearly, p.features AS planFeatures
      FROM tenants t
      LEFT JOIN plans p ON t.planId = p.id
      WHERE t.id = ?
    `).get(activeTenantId) || db.prepare("SELECT * FROM tenants WHERE id = 'tenant_default'").get();

    if (!tenant) {
      return res.status(404).json({ error: 'No se encontró la información del inquilino actual.' });
    }

    // Get active subscription
    const subscription = db.prepare(`
      SELECT * FROM subscriptions 
      WHERE tenantId = ? 
      ORDER BY createdAt DESC LIMIT 1
    `).get(tenant.id);

    // Get invoices history
    const invoices = db.prepare(`
      SELECT * FROM subscriptions 
      WHERE tenantId = ? 
      ORDER BY createdAt DESC
    `).all(tenant.id);

    // Calculate usage percentage
    const agentUsagePct = Math.min(100, Math.round(((tenant.currentAgentsCount || 1) / (tenant.maxAgents || 1)) * 100));
    const chatUsagePct = Math.min(100, Math.round(((tenant.currentChatsCount || 0) / (tenant.maxMonthlyChats || 1000)) * 100));
    const storageUsagePct = Math.min(100, Math.round(((tenant.currentStorageMb || 0) / (tenant.maxStorageMb || 2048)) * 100));

    res.json({
      success: true,
      tenant: {
        ...tenant,
        planFeatures: JSON.parse(tenant.planFeatures || '[]'),
        isExpired: tenant.expiresAt ? Date.now() > tenant.expiresAt : false,
        daysRemaining: tenant.expiresAt ? Math.max(0, Math.ceil((tenant.expiresAt - Date.now()) / (1000 * 60 * 60 * 24))) : 30,
        usage: {
          agents: { current: tenant.currentAgentsCount || 1, limit: tenant.maxAgents, percentage: agentUsagePct },
          chats: { current: tenant.currentChatsCount || 0, limit: tenant.maxMonthlyChats, percentage: chatUsagePct },
          storage: { current: tenant.currentStorageMb || 0, limit: tenant.maxStorageMb, percentage: storageUsagePct }
        }
      },
      subscription: subscription || {
        status: 'active',
        billingCycle: tenant.billingCycle || 'monthly',
        amount: tenant.priceMonthly || 79.0,
        currency: 'USD',
        paymentMethod: 'license_key',
        currentPeriodEnd: tenant.expiresAt
      },
      invoices
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. POST /api/saas/subscription/activate-license — Redeem a License Key
router.post('/subscription/activate-license', (req, res) => {
  const db = getDb();
  const { licenseKey } = req.body;
  const activeTenantId = getActiveTenantId(db);

  if (!licenseKey || !licenseKey.trim()) {
    return res.status(400).json({ error: 'Por favor ingresa una Clave de Activación de Licencia válida.' });
  }

  const cleanKey = licenseKey.trim().toUpperCase();

  try {
    const keyRecord = db.prepare('SELECT * FROM license_keys WHERE key = ?').get(cleanKey);

    if (!keyRecord) {
      return res.status(404).json({ error: 'La Clave de Activación ingresada no existe o es inválida.' });
    }

    if (keyRecord.isRedeemed) {
      return res.status(400).json({
        error: `Esta clave ya fue canjeada el ${new Date(keyRecord.redeemedAt).toLocaleDateString()} por otra organización.`
      });
    }

    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(keyRecord.planId);
    if (!plan) {
      return res.status(400).json({ error: 'El plan asociado a esta licencia no está disponible.' });
    }

    const now = Date.now();
    const durationMs = (keyRecord.durationDays || 365) * 24 * 60 * 60 * 1000;
    
    // Check current tenant's expiresAt
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(activeTenantId);
    const currentExpiry = (tenant && tenant.expiresAt && tenant.expiresAt > now) ? tenant.expiresAt : now;
    const newExpiresAt = currentExpiry + durationMs;

    // 1. Mark license as redeemed
    db.prepare(`
      UPDATE license_keys 
      SET isRedeemed = 1, redeemedByTenantId = ?, redeemedAt = ?
      WHERE id = ?
    `).run(activeTenantId, now, keyRecord.id);

    // 2. Upgrade tenant plan, limits & expiration
    db.prepare(`
      UPDATE tenants
      SET planId = ?, status = 'active', maxAgents = ?, maxMonthlyChats = ?, maxStorageMb = ?, expiresAt = ?
      WHERE id = ?
    `).run(plan.id, plan.maxAgents, plan.maxMonthlyChats, plan.maxStorageMb, newExpiresAt, activeTenantId);

    // 3. Create invoice / subscription renewal record
    const invoiceNum = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    db.prepare(`
      INSERT INTO subscriptions (id, tenantId, planId, status, billingCycle, currentPeriodStart, currentPeriodEnd, amount, currency, paymentMethod, lastPaymentDate, invoiceNumber, autoRenew)
      VALUES (?, ?, ?, 'active', 'yearly', ?, ?, ?, 'USD', 'license_key', ?, ?, 1)
    `).run(uuidv4(), activeTenantId, plan.id, now, newExpiresAt, plan.priceYearly, now, invoiceNum);

    // 4. Log audit action
    try {
      db.prepare(`
        INSERT INTO audit_logs (id, agentId, agentName, event, category, severity, details)
        VALUES (?, 'system', 'Licensing Hub', 'license_activated', 'billing', 'info', ?)
      `).run(uuidv4(), `Licencia ${cleanKey} canjeada exitosamente. Plan '${plan.name}' activado hasta ${new Date(newExpiresAt).toLocaleDateString()}.`);
    } catch (_) {}

    res.json({
      success: true,
      message: `¡Licencia activada con éxito! Tu plan ha sido actualizado a '${plan.name}' con vigencia hasta el ${new Date(newExpiresAt).toLocaleDateString()}.`,
      planName: plan.name,
      expiresAt: newExpiresAt,
      newLimits: {
        maxAgents: plan.maxAgents,
        maxMonthlyChats: plan.maxMonthlyChats,
        maxStorageMb: plan.maxStorageMb
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. POST /api/saas/subscription/renew — Renew Plan (Monthly or Yearly)
router.post('/subscription/renew', (req, res) => {
  const db = getDb();
  const { billingCycle = 'yearly', planId } = req.body;
  const activeTenantId = getActiveTenantId(db);

  try {
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(activeTenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant no encontrado.' });

    const targetPlanId = planId || tenant.planId;
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(targetPlanId);
    if (!plan) return res.status(404).json({ error: 'Plan no encontrado.' });

    const now = Date.now();
    const durationDays = billingCycle === 'yearly' ? 365 : 30;
    const currentExpiry = (tenant.expiresAt && tenant.expiresAt > now) ? tenant.expiresAt : now;
    const newExpiresAt = currentExpiry + durationDays * 24 * 60 * 60 * 1000;
    const amount = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;

    db.prepare(`
      UPDATE tenants
      SET planId = ?, status = 'active', billingCycle = ?, maxAgents = ?, maxMonthlyChats = ?, maxStorageMb = ?, expiresAt = ?
      WHERE id = ?
    `).run(plan.id, billingCycle, plan.maxAgents, plan.maxMonthlyChats, plan.maxStorageMb, newExpiresAt, activeTenantId);

    const invoiceNum = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    db.prepare(`
      INSERT INTO subscriptions (id, tenantId, planId, status, billingCycle, currentPeriodStart, currentPeriodEnd, amount, currency, paymentMethod, lastPaymentDate, invoiceNumber, autoRenew)
      VALUES (?, ?, ?, 'active', ?, ?, ?, ?, 'USD', 'online_billing', ?, ?, 1)
    `).run(uuidv4(), activeTenantId, plan.id, billingCycle, now, newExpiresAt, amount, now, invoiceNum);

    res.json({
      success: true,
      message: `Plan '${plan.name}' renovado exitosamente por ${durationDays} días.`,
      expiresAt: newExpiresAt,
      invoiceNumber: invoiceNum
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 11. GET /api/saas/license-keys — List all generated license keys
router.get('/license-keys', (req, res) => {
  const db = getDb();
  try {
    const keys = db.prepare(`
      SELECT k.*, p.name AS planName, p.code AS planCode, t.name AS redeemedByTenantName
      FROM license_keys k
      LEFT JOIN plans p ON k.planId = p.id
      LEFT JOIN tenants t ON k.redeemedByTenantId = t.id
      ORDER BY k.createdAt DESC
    `).all();

    res.json({ success: true, keys });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 12. POST /api/saas/license-keys — Generate new license key
router.post('/license-keys', (req, res) => {
  const db = getDb();
  const { planId = 'plan_pro', durationDays = 365, organizationName = 'Cliente Comercial' } = req.body;

  try {
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
    if (!plan) return res.status(404).json({ error: 'Plan seleccionado no existe.' });

    // Generate readable, professional key format: CHASKY-PRO-YYYY-RAND
    const planCodePrefix = plan.code.includes('enterprise') ? 'ENT' : plan.code.includes('edu') ? 'EDU' : 'PRO';
    const year = new Date().getFullYear();
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const generatedKey = `CHASKY-${planCodePrefix}-${year}-${randomHex}`;

    const id = uuidv4();
    db.prepare(`
      INSERT INTO license_keys (id, key, planId, durationDays, isRedeemed, createdForOrganization, createdAt)
      VALUES (?, ?, ?, ?, 0, ?, (strftime('%s','now') * 1000))
    `).run(id, generatedKey, plan.id, Number(durationDays), organizationName.trim());

    res.status(201).json({
      success: true,
      message: `Clave de activación generada exitosamente para ${plan.name}.`,
      license: {
        id,
        key: generatedKey,
        planName: plan.name,
        durationDays,
        createdForOrganization: organizationName
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 13. GET /api/saas/tenant-settings — Get active tenant white-label settings
router.get('/tenant-settings', (req, res) => {
  const db = getDb();
  try {
    const activeTenantId = getActiveTenantId(db);
    const settings = db.prepare('SELECT * FROM tenant_settings WHERE tenantId = ?').get(activeTenantId);
    const tenant = db.prepare('SELECT name, slug, domain FROM tenants WHERE id = ?').get(activeTenantId);

    res.json({
      success: true,
      tenantId: activeTenantId,
      tenantName: tenant ? tenant.name : 'CHASKYAPP Global HQ',
      settings: settings || {
        appName: 'CHASKYAPP',
        companyLegalName: 'CHASKYAPP Technologies S.A.C.',
        logoUrl: '',
        primaryColor: '#00a884',
        secondaryColor: '#111b21',
        footerText: 'Potenciado por CHASKYAPP Enterprise',
        supportEmail: 'soporte@chaskyapp.com',
        supportPhone: '+51 987 654 321'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 14. PUT /api/saas/tenant-settings — Update active tenant white-label settings
router.put('/tenant-settings', (req, res) => {
  const db = getDb();
  const {
    appName,
    companyLegalName,
    logoUrl,
    primaryColor,
    secondaryColor,
    footerText,
    supportEmail,
    supportPhone,
    customCss,
    whiteLabelEnabled
  } = req.body;

  const activeTenantId = getActiveTenantId(db);

  try {
    const existing = db.prepare('SELECT id FROM tenant_settings WHERE tenantId = ?').get(activeTenantId);

    if (existing) {
      db.prepare(`
        UPDATE tenant_settings
        SET appName = ?, companyLegalName = ?, logoUrl = ?, primaryColor = ?, secondaryColor = ?, 
            footerText = ?, supportEmail = ?, supportPhone = ?, customCss = ?, whiteLabelEnabled = ?,
            updatedAt = (strftime('%s','now') * 1000)
        WHERE tenantId = ?
      `).run(
        appName || 'CHASKYAPP',
        companyLegalName || 'CHASKYAPP Enterprise',
        logoUrl || '',
        primaryColor || '#00a884',
        secondaryColor || '#111b21',
        footerText || 'Potenciado por CHASKYAPP Enterprise',
        supportEmail || 'soporte@chaskyapp.com',
        supportPhone || '+51 987 654 321',
        customCss || '',
        whiteLabelEnabled !== false ? 1 : 0,
        activeTenantId
      );
    } else {
      db.prepare(`
        INSERT INTO tenant_settings (id, tenantId, appName, companyLegalName, logoUrl, primaryColor, secondaryColor, footerText, supportEmail, supportPhone, customCss, whiteLabelEnabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        activeTenantId,
        appName || 'CHASKYAPP',
        companyLegalName || 'CHASKYAPP Enterprise',
        logoUrl || '',
        primaryColor || '#00a884',
        secondaryColor || '#111b21',
        footerText || 'Potenciado por CHASKYAPP Enterprise',
        supportEmail || 'soporte@chaskyapp.com',
        supportPhone || '+51 987 654 321',
        customCss || '',
        whiteLabelEnabled !== false ? 1 : 0
      );
    }

    res.json({
      success: true,
      message: 'Configuración White-Label (Marca Blanca) guardada correctamente.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = {
  saasRouter: router,
  multiTenantMiddleware,
  initSaasTables
};
