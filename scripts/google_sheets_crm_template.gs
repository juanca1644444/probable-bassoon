/**
 * ==============================================================================
 * CHASKYAPP — Google Sheets CRM & Leads Sync (Apps Script Webhook)
 * ==============================================================================
 * Este script convierte cualquier Hoja de Cálculo de Google en un CRM colaborativo
 * y gratuito para Servicios Educativos Huiracocha y CHASKYAPP.
 *
 * INSTRUCCIONES DE INSTALACIÓN (En 2 Minutos - 100% Gratuito):
 * 1. Crea una hoja de cálculo nueva en Google Drive: "CHASKYAPP - Leads & CRM Huiracocha"
 * 2. En el menú superior ve a: Extensiones > Apps Script
 * 3. Borra el código por defecto y pega TODO este archivo.
 * 4. Haz clic en "Implementar" (botón azul arriba a la derecha) > "Nueva implementación"
 * 5. Selecciona tipo: "Aplicación web" (Web App)
 *    - Descripción: CHASKYAPP Webhook CRM
 *    - Ejecutar como: "Yo" (tu cuenta con 5 TB)
 *    - Quién tiene acceso: "Cualquier usuario" (Anyone)
 * 6. Haz clic en "Implementar" y autoriza los permisos.
 * 7. Copia la URL generada (ej: https://script.google.com/macros/s/AKfycb.../exec)
 * 8. Pégala en el archivo .env de CHASKYAPP como:
 *    GOOGLE_SHEETS_WEBHOOK_URL="https://script.google.com/macros/s/AKfycb.../exec"
 * ==============================================================================
 */

function doPost(e) {
  try {
    var rawData = e.postData ? e.postData.contents : null;
    if (!rawData) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'No payload provided' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var payload = JSON.parse(rawData);
    var sheet = getOrCreateLeadsSheet();

    // Extraer campos del Lead o Deal de CHASKYAPP
    var chatId = payload.chatId || payload.id || 'N/A';
    var contactName = payload.contactName || payload.name || 'Desconocido';
    var phone = payload.contactPhone || payload.phone || '';
    var stage = payload.stageName || payload.stage || 'Nuevo Lead';
    var dealValue = payload.dealValue !== undefined ? Number(payload.dealValue) : 0;
    var assignedAgent = payload.agentName || payload.assignedAgentName || 'Equipo Huiracocha';
    var notes = payload.notes || payload.lastMessage || '';
    var channel = payload.channel || 'WhatsApp';
    var updatedAt = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });

    // Buscar si el chatId ya existe en la hoja para actualizar (Upsert)
    var data = sheet.getDataRange().getValues();
    var rowIndexToUpdate = -1;

    for (var i = 1; i < data.length; i++) {
      if (data[i][1] === chatId) { // Columna B: ID Chat
        rowIndexToUpdate = i + 1;
        break;
      }
    }

    if (rowIndexToUpdate > 0) {
      // Actualizar registro existente
      sheet.getRange(rowIndexToUpdate, 3).setValue(contactName);
      sheet.getRange(rowIndexToUpdate, 4).setValue(phone);
      sheet.getRange(rowIndexToUpdate, 5).setValue(channel);
      sheet.getRange(rowIndexToUpdate, 6).setValue(stage);
      sheet.getRange(rowIndexToUpdate, 7).setValue(dealValue);
      sheet.getRange(rowIndexToUpdate, 8).setValue(assignedAgent);
      sheet.getRange(rowIndexToUpdate, 9).setValue(notes);
      sheet.getRange(rowIndexToUpdate, 10).setValue(updatedAt);

      applyStageColor(sheet.getRange(rowIndexToUpdate, 6), stage);

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        action: 'updated',
        row: rowIndexToUpdate,
        chatId: chatId
      })).setMimeType(ContentService.MimeType.JSON);

    } else {
      // Insertar nuevo Lead como nueva fila
      var newRow = [
        updatedAt,        // A: Fecha Ingreso
        chatId,           // B: ID Chat
        contactName,      // C: Contacto / Padre de Familia
        phone,            // D: Teléfono / WhatsApp
        channel,          // E: Canal
        stage,            // F: Etapa CRM
        dealValue,        // G: Monto Estimado (S/.)
        assignedAgent,    // H: Asesor Asignado
        notes,            // I: Notas / Resumen Consulta
        updatedAt         // J: Última Actualización
      ];

      sheet.appendRow(newRow);
      var lastRow = sheet.getLastRow();
      applyStageColor(sheet.getRange(lastRow, 6), stage);

      // Formato de moneda para columna de Monto (G)
      sheet.getRange(lastRow, 7).setNumberFormat('"S/."#,##0.00');

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        action: 'inserted',
        row: lastRow,
        chatId: chatId
      })).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';
    var sheet = getOrCreateLeadsSheet();

    // Consulta bidireccional: Permite a CHASKYAPP leer los leads actualizados por los asesores desde Google Sheets
    if (action === 'getLeads' || action === 'all') {
      var data = sheet.getDataRange().getValues();
      var leads = [];
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (!row[1]) continue; // Omite filas vacías
        leads.push({
          fechaIngreso: row[0],
          chatId: row[1],
          contactName: row[2],
          phone: row[3],
          channel: row[4],
          stageName: row[5],
          dealValue: row[6],
          assignedAgent: row[7],
          notes: row[8],
          updatedAt: row[9]
        });
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        total: leads.length,
        leads: leads
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Ping / Healthcheck estándar
    return ContentService.createTextOutput(JSON.stringify({
      status: 'online',
      service: 'CHASKYAPP Google Sheets CRM Webhook',
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Obtiene o inicializa la hoja con encabezados profesionales
 */
function getOrCreateLeadsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = "Leads_Huiracocha";
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var headers = [
      "Fecha Ingreso", "ID Chat", "Contacto / Padre de Familia", "Teléfono",
      "Canal", "Etapa CRM", "Monto Estimado", "Asesor Asignado",
      "Notas / Resumen Consulta", "Última Actualización"
    ];

    sheet.appendRow(headers);

    // Estilos del Encabezado
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#00a884"); // Color característico de CHASKYAPP
    headerRange.setFontColor("#ffffff");
    headerRange.setFontWeight("bold");
    headerRange.setFontSize(11);
    headerRange.setHorizontalAlignment("center");
    headerRange.setVerticalAlignment("middle");
    sheet.setRowHeight(1, 35);
    sheet.setFrozenRows(1);

    // Autoajustar anchos
    sheet.setColumnWidth(1, 150); // Fecha
    sheet.setColumnWidth(2, 100); // ID
    sheet.setColumnWidth(3, 220); // Contacto
    sheet.setColumnWidth(4, 130); // Teléfono
    sheet.setColumnWidth(5, 100); // Canal
    sheet.setColumnWidth(6, 140); // Etapa
    sheet.setColumnWidth(7, 120); // Monto
    sheet.setColumnWidth(8, 160); // Asesor
    sheet.setColumnWidth(9, 300); // Notas
    sheet.setColumnWidth(10, 150); // Actualización
  }

  return sheet;
}

/**
 * Aplica formato condicional visual según la etapa del lead
 */
function applyStageColor(cell, stage) {
  var s = (stage || '').toLowerCase();
  if (s.indexOf('nuevo') !== -1) {
    cell.setBackground('#e0f2fe').setFontColor('#0369a1'); // Azul suave
  } else if (s.indexOf('contactado') !== -1 || s.indexOf('interesado') !== -1) {
    cell.setBackground('#fef3c7').setFontColor('#b45309'); // Ámbar suave
  } else if (s.indexOf('cotiz') !== -1 || s.indexOf('propuesta') !== -1) {
    cell.setBackground('#f3e8ff').setFontColor('#7e22ce'); // Morado suave
  } else if (s.indexOf('matriculado') !== -1 || s.indexOf('ganado') !== -1 || s.indexOf('cerrado') !== -1) {
    cell.setBackground('#dcfce7').setFontColor('#15803d'); // Verde suave
  } else if (s.indexOf('perdido') !== -1 || s.indexOf('descartado') !== -1) {
    cell.setBackground('#fee2e2').setFontColor('#b91c1c'); // Rojo suave
  }
}
