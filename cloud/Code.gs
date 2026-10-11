/**
 * Connector Activity Tracker Cloud API · Phase 2 CRM sync
 *
 * Authentication is checked against Appointment Companion's existing Partner
 * profile endpoint. The Companion workspace_key is used only for that login
 * request and is never written to this spreadsheet or retained in a session.
 */
const TRACKER_SCHEMA_ = {
  ConnectorAccess: ['partner_id', 'connector_id', 'role', 'enabled'],
  Connectors: ['connector_id', 'name', 'active'],
  CloudTestRecords: ['record_id', 'connector_id', 'owner_partner_id', 'payload_json', 'version', 'updated_at'],
  ConnectorProfiles: ['connector_id', 'code', 'logo', 'primary_color', 'accent_color', 'main_contact_name'],
  CRMRecords: ['record_id', 'entity', 'connector_id', 'owner_partner_id', 'payload_json', 'version', 'updated_at', 'deleted', 'last_transaction_id'],
  AuditLog: ['audit_id', 'connector_id', 'actor_partner_id', 'action', 'record_id', 'created_at']
};
const TRACKER_SESSION_TTL_SECONDS_ = 21600;
const TRACKER_LOGIN_LIMIT_ = 5;
const TRACKER_LOGIN_WINDOW_SECONDS_ = 900;
const TRACKER_LOGIN_GLOBAL_LIMIT_ = 120;
const TRACKER_MAX_REQUEST_CHARS_ = 30000;
const TRACKER_MAX_RECORD_CHARS_ = 24000;
const TRACKER_RECORD_ENTITIES_ = ['activity', 'twenty-k', 'lead', 'activity-partner-stat', 'customer-result', 'generated-partner', 'commission-rule'];
const TRACKER_PRIVATE_ENTITIES_ = ['twenty-k', 'lead', 'customer-result', 'generated-partner'];
const TRACKER_OWNER_CONTROLLED_ENTITIES_ = TRACKER_PRIVATE_ENTITIES_.concat(['activity-partner-stat']);

function doPost(e) {
  try {
    const raw = String(e && e.postData && e.postData.contents || '{}');
    if (raw.length > TRACKER_MAX_REQUEST_CHARS_) throw new Error('Request is too large.');
    const body = JSON.parse(raw);
    const result = trackerDispatch_(body);
    return trackerJson_({ ok: true, ...result });
  } catch (error) {
    return trackerJson_({ ok: false, error: trackerPublicError_(error) });
  }
}

function doGet() {
  return trackerJson_({ ok: false, error: 'Use the CAT Cloud API.' });
}

function initializeTrackerCloud() {
  const id = PropertiesService.getScriptProperties().getProperty('TRACKER_SHEET_ID');
  if (!id) throw new Error('Set TRACKER_SHEET_ID in Script Properties first.');
  const spreadsheet = SpreadsheetApp.openById(id);
  spreadsheet.setSpreadsheetTimeZone('Europe/London');
  spreadsheet.setSpreadsheetLocale('en_GB');
  Object.keys(TRACKER_SCHEMA_).forEach(name => {
    let sheet = spreadsheet.getSheetByName(name);
    if (!sheet) sheet = spreadsheet.insertSheet(name);
    const expected = TRACKER_SCHEMA_[name];
    const current = sheet.getRange(1, 1, 1, expected.length).getDisplayValues()[0];
    if (current.every(value => !value)) sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
    else if (expected.some((value, index) => current[index] !== value)) {
      throw new Error('The ' + name + ' header does not match the Phase 1 schema. No data was changed.');
    }
    sheet.setFrozenRows(1);
  });
  return 'CAT Cloud tabs are ready.';
}

function trackerDispatch_(body) {
  const action = String(body && body.action || '');
  if (action === 'login') return trackerLogin_(body);
  if (action === 'logout') return trackerLogout_(body);
  if (action === 'getSession') {
    const session = trackerRequireSession_(body.session_token);
    return trackerSessionPayload_(session);
  }
  if (action === 'getWorkspace') return trackerWorkspace_(trackerRequireSession_(body.session_token));
  if (action === 'saveCrmRecord') return trackerSaveCrmRecord_(trackerRequireSession_(body.session_token), body);
  if (action === 'deleteCrmRecord') return trackerDeleteCrmRecord_(trackerRequireSession_(body.session_token), body);
  if (action === 'saveConnector') return trackerSaveConnector_(trackerRequireSession_(body.session_token), body);
  if (action === 'grantConnectorAccess') return trackerGrantConnectorAccess_(trackerRequireSession_(body.session_token), body);
  if (action === 'getCloudTestRecord' || action === 'saveCloudTestRecord') {
    const session = trackerRequireSession_(body.session_token);
    const connectorId = String(body.connector_id || '').trim();
    trackerRequireConnector_(session.partnerId, connectorId, session.connectors);
    if (action === 'getCloudTestRecord') return trackerGetTestRecord_(session.partnerId, connectorId);
    return trackerSaveTestRecord_(session.partnerId, connectorId, body);
  }
  throw new Error('This Cloud action is not available.');
}

function trackerLogin_(body) {
  const partnerId = trackerPartnerId_(body && body.partner_id);
  const workspaceKey = String(body && body.workspace_key || '');
  if (!/^[a-z0-9._-]{1,60}$/.test(partnerId) || !workspaceKey || workspaceKey.length > 512) throw new Error('Partner ID or password was not accepted.');

  // Do not turn the Companion endpoint into a general-purpose credential
  // checker. Only Partners explicitly assigned to an active Connector may
  // proceed to the shared identity service.
  if (!trackerConnectorAccess_(partnerId).length) throw new Error('Partner ID or password was not accepted.');
  trackerCheckLoginRate_(partnerId);

  const profile = trackerCompanionRequest_('getPartnerProfile', {
    partner_id: partnerId,
    workspace_key: workspaceKey
  });
  const partner = profile && profile.partner;
  if (!partner || trackerPartnerId_(partner.partner_id) !== partnerId || String(partner.status || 'active').toLowerCase() !== 'active') {
    throw new Error('Partner ID or password was not accepted.');
  }

  // Access may have been disabled while Companion was checking credentials.
  const connectors = trackerConnectorAccess_(partnerId);
  if (!connectors.length) throw new Error('This Partner account has no active CAT access. Ask an administrator to assign a Connector.');
  trackerClearLoginRate_(partnerId);
  const token = [Utilities.getUuid(), Utilities.getUuid(), Utilities.getUuid()].join('').replace(/-/g, '');
  const expiresAt = Date.now() + TRACKER_SESSION_TTL_SECONDS_ * 1000;
  CacheService.getScriptCache().put(trackerSessionKey_(token), JSON.stringify({ partnerId, expiresAt }), TRACKER_SESSION_TTL_SECONDS_);
  trackerAudit_(connectors[0].id, partnerId, 'sign-in', '');
  return { session_token: token, expires_at: new Date(expiresAt).toISOString(), profile: trackerCleanProfile_(partner), connectors };
}

function trackerLogout_(body) {
  const token = String(body && body.session_token || '');
  const session = trackerSession_(token);
  if (session) {
    CacheService.getScriptCache().remove(trackerSessionKey_(token));
    trackerAudit_('', session.partnerId, 'sign-out', '');
  }
  return { logged_out: true };
}

function trackerRequireSession_(token) {
  const session = trackerSession_(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (token) CacheService.getScriptCache().remove(trackerSessionKey_(String(token)));
    throw new Error('Your session has expired. Sign in again.');
  }

  // This read-only Companion action checks shared Partner active status on
  // every protected API call, so a deactivated Partner loses access at once.
  let current;
  try {
    current = trackerCompanionRequest_('getPublicPartnerProfile', { partner_id: session.partnerId });
  } catch (error) {
    // A reachable Companion response that rejects the profile means the
    // identity is no longer active. Network/parse errors remain retryable.
    if (/could not confirm this account/i.test(error.message)) {
      CacheService.getScriptCache().remove(trackerSessionKey_(String(token)));
    }
    throw error;
  }
  const partner = current && current.partner;
  if (!partner || trackerPartnerId_(partner.partner_id) !== session.partnerId || String(partner.status || 'active').toLowerCase() !== 'active') {
    CacheService.getScriptCache().remove(trackerSessionKey_(token));
    throw new Error('This Partner account is inactive. Contact the Partner administrator.');
  }
  const connectors = trackerConnectorAccess_(session.partnerId);
  if (!connectors.length) {
    CacheService.getScriptCache().remove(trackerSessionKey_(String(token)));
    throw new Error('CAT access has been revoked.');
  }
  return { ...session, profile: trackerCleanProfile_(partner), connectors };
}

function trackerSessionPayload_(session) {
  return { profile: session.profile, connectors: session.connectors, expires_at: new Date(session.expiresAt).toISOString() };
}

function trackerConnectorAccess_(partnerId) {
  const connectors = trackerRows_('Connectors');
  const profiles = trackerRows_('ConnectorProfiles');
  return trackerRows_('ConnectorAccess').filter(row =>
    trackerPartnerId_(row.partner_id) === partnerId && trackerEnabled_(row.enabled)
  ).map(row => {
    const connectorId = String(row.connector_id || '').trim();
    const connector = connectors.find(item => String(item.connector_id || '').trim() === connectorId && trackerEnabled_(item.active));
    if (!connector) return null;
    const role = String(row.role || '').trim();
    if (!['Admin', 'Editor'].includes(role)) return null;
    const profile = profiles.find(item => String(item.connector_id || '').trim() === connectorId) || {};
    return { id: connectorId, name: String(connector.name || connectorId), code: String(profile.code || connectorId), active: true, role,
      logo: String(profile.logo || '◈'), primaryColor: String(profile.primary_color || '#351065'),
      accentColor: String(profile.accent_color || '#5c2e9a'), mainContactName: String(profile.main_contact_name || '') };
  }).filter(Boolean);
}

function trackerWorkspace_(session) {
  const connectorIds = session.connectors.map(item => item.id);
  const roles = Object.fromEntries(session.connectors.map(item => [item.id, item.role]));
  const records = trackerRows_('CRMRecords').filter(row => {
    const connectorId = String(row.connector_id || '');
    const entity = String(row.entity || '');
    if (!connectorIds.includes(connectorId) || !TRACKER_RECORD_ENTITIES_.includes(entity) || trackerEnabled_(row.deleted)) return false;
    return !TRACKER_PRIVATE_ENTITIES_.includes(entity) || roles[connectorId] === 'Admin' || trackerPartnerId_(row.owner_partner_id) === session.partnerId;
  }).map(row => {
    let payload;
    try { payload = JSON.parse(row.payload_json || '{}'); } catch (_) { return null; }
    return { entity: String(row.entity || ''), id: String(row.record_id || ''), connectorId: String(row.connector_id || ''),
      ownerPartnerId: trackerPartnerId_(row.owner_partner_id), payload, version: Number(row.version || 0), updatedAt: String(row.updated_at || '') };
  }).filter(Boolean);
  const accessRows = trackerRows_('ConnectorAccess').filter(row => {
    const connectorId = String(row.connector_id || '').trim();
    return connectorIds.includes(connectorId) && trackerEnabled_(row.enabled) && (roles[connectorId] === 'Admin' || trackerPartnerId_(row.partner_id) === session.partnerId);
  });
  const users = {};
  accessRows.forEach(row => {
    const partnerId = trackerPartnerId_(row.partner_id);
    if (!partnerId) return;
    const role = String(row.role || '') === 'Admin' ? 'Admin' : 'Partner';
    if (!users[partnerId] || role === 'Admin') users[partnerId] = { id: partnerId, name: partnerId, role, active: true };
  });
  const access = accessRows.map(row => ({ connectorId: String(row.connector_id || '').trim(), userId: trackerPartnerId_(row.partner_id), role: String(row.role || '') }));
  return { connectors: session.connectors, access, users: Object.values(users), records };
}

function trackerSaveCrmRecord_(session, body) {
  const entity = String(body.entity || '');
  if (!TRACKER_RECORD_ENTITIES_.includes(entity)) throw new Error('This record type is not enabled for cloud saving.');
  const connectorId = String(body.connector_id || '').trim();
  const access = trackerRequireConnector_(session.partnerId, connectorId, session.connectors);
  const recordId = String(body.record_id || '').trim();
  const transactionId = String(body.transaction_id || '').trim();
  if (!/^[A-Za-z0-9._:-]{1,120}$/.test(recordId) || !/^[A-Za-z0-9._:-]{1,120}$/.test(transactionId)) throw new Error('The record ID or transaction ID is invalid.');
  const expectedVersion = Number(body.base_version);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) throw new Error('The record version is invalid. Refresh the workspace and try again.');
  const payload = body.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || String(payload.id || '') !== recordId) throw new Error('The record content is invalid.');
  if (payload.connectorId && String(payload.connectorId) !== connectorId) throw new Error('Record Connector does not match the selected Connector.');
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sheet = trackerSheet_('CRMRecords');
    const rows = trackerRows_('CRMRecords');
    const existing = rows.find(row => String(row.record_id || '') === recordId && String(row.connector_id || '') === connectorId);
    if (existing && String(existing.entity || '') !== entity) throw new Error('The record type cannot be changed.');
    const privateRecord = TRACKER_PRIVATE_ENTITIES_.includes(entity);
    const ownerControlled = TRACKER_OWNER_CONTROLLED_ENTITIES_.includes(entity);
    let owner = existing ? trackerPartnerId_(existing.owner_partner_id) : session.partnerId;
    if (existing && ownerControlled && access.role !== 'Admin' && owner !== session.partnerId) throw new Error('You cannot change another Partner’s private record.');
    if (existing && String(existing.last_transaction_id || '') === transactionId) return { acknowledged: true, id: recordId, version: Number(existing.version || 0), duplicate: true };
    if (existing && Number(existing.version || 0) !== expectedVersion) throw new Error('This record changed elsewhere. Refresh before saving your changes.');
    if (!existing && expectedVersion !== 0) throw new Error('This record is not in the cloud. Refresh before saving your changes.');
    if (ownerControlled && !existing && payload.partnerId && trackerPartnerId_(payload.partnerId) !== session.partnerId) throw new Error('A private record must belong to the signed-in Partner.');
    if (ownerControlled && !existing) owner = session.partnerId;
    const savedPayload = { ...payload, connectorId };
    if (ownerControlled) {
      if (!existing) {
        savedPayload.partnerId = session.partnerId;
        savedPayload.generatedByPartnerId = session.partnerId;
        savedPayload.currentOwnerId = session.partnerId;
      } else if (access.role !== 'Admin') {
        savedPayload.partnerId = owner;
        savedPayload.generatedByPartnerId = owner;
        savedPayload.currentOwnerId = owner;
      }
    }
    trackerValidateRecordRelations_(entity, connectorId, savedPayload, session.partnerId, access.role === 'Admin');
    if (!existing && entity === 'customer-result') owner = trackerPrivateOwner_(connectorId, 'lead', savedPayload.leadId) || owner;
    if (!existing && entity === 'generated-partner') owner = trackerPrivateOwner_(connectorId, 'lead', savedPayload.originLeadId) || owner;
    const json = JSON.stringify(savedPayload);
    if (json.length > TRACKER_MAX_RECORD_CHARS_) throw new Error('This record is too large to save. Reduce its attached data and try again.');
    const nextVersion = expectedVersion + 1;
    const row = [recordId, entity, connectorId, owner, json, nextVersion, new Date().toISOString(), 'FALSE', transactionId];
    if (existing) sheet.getRange(existing.__row, 1, 1, row.length).setValues([row]); else sheet.appendRow(row);
    trackerAudit_(connectorId, session.partnerId, 'save-' + entity, recordId);
    return { acknowledged: true, id: recordId, version: nextVersion };
  } finally { lock.releaseLock(); }
}

function trackerDeleteCrmRecord_(session, body) {
  const entity = String(body.entity || '');
  if (!TRACKER_RECORD_ENTITIES_.includes(entity)) throw new Error('This record type is not enabled for cloud saving.');
  const connectorId = String(body.connector_id || '').trim();
  const access = trackerRequireConnector_(session.partnerId, connectorId, session.connectors);
  const recordId = String(body.record_id || '').trim();
  const transactionId = String(body.transaction_id || '').trim();
  const expectedVersion = Number(body.base_version);
  if (!/^[A-Za-z0-9._:-]{1,120}$/.test(recordId) || !/^[A-Za-z0-9._:-]{1,120}$/.test(transactionId) || !Number.isInteger(expectedVersion) || expectedVersion < 1) throw new Error('The record ID or version is invalid.');
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sheet = trackerSheet_('CRMRecords');
    const existing = trackerRows_('CRMRecords').find(row => String(row.record_id || '') === recordId && String(row.connector_id || '') === connectorId);
    if (!existing || existing.entity !== entity) throw new Error('This record changed elsewhere. Refresh before removing it.');
    if (!TRACKER_PRIVATE_ENTITIES_.includes(entity) && access.role !== 'Admin') throw new Error('Only a Connector Admin can remove shared Connector records.');
    if (TRACKER_PRIVATE_ENTITIES_.includes(entity) && access.role !== 'Admin' && trackerPartnerId_(existing.owner_partner_id) !== session.partnerId) throw new Error('You cannot remove another Partner’s private record.');
    if (String(existing.last_transaction_id || '') === transactionId) return { acknowledged: true, id: recordId, version: Number(existing.version || 0), deleted: true, duplicate: true };
    if (Number(existing.version || 0) !== expectedVersion) throw new Error('This record changed elsewhere. Refresh before removing it.');
    sheet.getRange(existing.__row, 7, 1, 2).setValues([[new Date().toISOString(), 'TRUE']]);
    sheet.getRange(existing.__row, 6).setValue(expectedVersion + 1);
    sheet.getRange(existing.__row, 9).setValue(transactionId);
    trackerAudit_(connectorId, session.partnerId, 'delete-' + entity, recordId);
    return { acknowledged: true, id: recordId, version: expectedVersion + 1, deleted: true };
  } finally { lock.releaseLock(); }
}

function trackerSaveConnector_(session, body) {
  const hasPortfolioAdmin = session.connectors.some(item => item.role === 'Admin');
  if (!hasPortfolioAdmin) throw new Error('Connector administration permission is required.');
  const id = String(body.connector_id || '').trim();
  const name = String(body.name || '').trim();
  if (!/^[A-Za-z0-9._:-]{1,120}$/.test(id) || !name || name.length > 80) throw new Error('Connector name or ID is invalid.');
  if (String(body.logo || '').length > 12000) throw new Error('Choose a smaller Connector logo.');
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sheet = trackerSheet_('Connectors');
    const rows = trackerRows_('Connectors');
    const existing = rows.find(row => String(row.connector_id || '').trim() === id);
    if (existing && !session.connectors.some(item => item.id === id && item.role === 'Admin')) throw new Error('You may only edit Connectors you administer.');
    if (existing) sheet.getRange(existing.__row, 1, 1, 3).setValues([[id, name, 'TRUE']]);
    else {
      sheet.appendRow([id, name, 'TRUE']);
      trackerGrantAccessRow_(session.partnerId, id, 'Admin', true);
    }
    trackerSaveConnectorProfile_(id, body);
    trackerAudit_(id, session.partnerId, existing ? 'update-connector' : 'create-connector', id);
    return { acknowledged: true, connector: trackerConnectorAccess_(session.partnerId).find(item => item.id === id) || { id, name, code: id, role: 'Admin', active: true } };
  } finally { lock.releaseLock(); }
}

function trackerSaveConnectorProfile_(connectorId, body) {
  const sheet = trackerSheet_('ConnectorProfiles');
  const existing = trackerRows_('ConnectorProfiles').find(row => String(row.connector_id || '').trim() === connectorId);
    const values = [connectorId, String(body.code || connectorId).slice(0, 24), String(body.logo || '◈'), trackerHex_(body.primary_color, '#351065'), trackerHex_(body.accent_color, '#5c2e9a'), String(body.main_contact_name || '').slice(0, 80)];
  if (existing) sheet.getRange(existing.__row, 1, 1, values.length).setValues([values]); else sheet.appendRow(values);
}

function trackerGrantConnectorAccess_(session, body) {
  const connectorId = String(body.connector_id || '').trim();
  trackerRequireConnector_(session.partnerId, connectorId, session.connectors);
  if (!session.connectors.some(item => item.id === connectorId && item.role === 'Admin')) throw new Error('Only this Connector’s Admin can manage access.');
  const partnerId = trackerPartnerId_(body.partner_id);
  const role = String(body.role || 'Editor');
  if (!/^[a-z0-9._-]{1,60}$/.test(partnerId) || !['Admin', 'Editor'].includes(role)) throw new Error('Partner ID or access role is invalid.');
  trackerGrantAccessRow_(partnerId, connectorId, role, body.enabled !== false);
  trackerAudit_(connectorId, session.partnerId, 'set-partner-access', partnerId);
  return { acknowledged: true };
}

function trackerGrantAccessRow_(partnerId, connectorId, role, enabled) {
  const sheet = trackerSheet_('ConnectorAccess');
  const existing = trackerRows_('ConnectorAccess').find(row => trackerPartnerId_(row.partner_id) === partnerId && String(row.connector_id || '').trim() === connectorId);
  const values = [partnerId, connectorId, role, enabled ? 'TRUE' : 'FALSE'];
  if (existing) sheet.getRange(existing.__row, 1, 1, values.length).setValues([values]); else sheet.appendRow(values);
}

function trackerHex_(value, fallback) { return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : fallback; }

function trackerValidateRecordRelations_(entity, connectorId, payload, partnerId, isAdmin) {
  const related = [];
  if (['activity', 'twenty-k', 'lead'].includes(entity) && payload.activityId) related.push(['activity', payload.activityId]);
  if (entity === 'lead' && payload.origin20KId) related.push(['twenty-k', payload.origin20KId]);
  if (entity === 'customer-result' && payload.leadId) related.push(['lead', payload.leadId]);
  if (entity === 'generated-partner' && payload.originLeadId) related.push(['lead', payload.originLeadId]);
  const rows = trackerRows_('CRMRecords');
  related.forEach(([relatedEntity, relatedId]) => {
    const found = rows.find(row => row.entity === relatedEntity && row.record_id === String(relatedId) && row.connector_id === connectorId && !trackerEnabled_(row.deleted));
    if (!found) throw new Error('A linked Event or record is missing from this Connector. Refresh and try again.');
    if (TRACKER_PRIVATE_ENTITIES_.includes(relatedEntity) && !isAdmin && trackerPartnerId_(found.owner_partner_id) !== partnerId) throw new Error('The linked private record belongs to another Partner.');
  });
}
function trackerPrivateOwner_(connectorId, entity, recordId) {
  const row = trackerRows_('CRMRecords').find(item => item.entity === entity && item.connector_id === connectorId && item.record_id === String(recordId || '') && !trackerEnabled_(item.deleted));
  return row ? trackerPartnerId_(row.owner_partner_id) : '';
}

function trackerRequireConnector_(partnerId, connectorId, allowedConnectors) {
  if (!connectorId) throw new Error('Choose a Connector.');
  const access = (allowedConnectors || trackerConnectorAccess_(partnerId)).find(item => item.id === connectorId);
  if (!access) throw new Error('You do not have access to this Connector.');
  return access;
}

function trackerGetTestRecord_(partnerId, connectorId) {
  const recordId = trackerTestRecordId_(partnerId, connectorId);
  const row = trackerRows_('CloudTestRecords').find(item =>
    item.record_id === recordId && item.owner_partner_id === partnerId && item.connector_id === connectorId
  );
  return { record: row ? trackerTestRecordPayload_(row) : null };
}

function trackerSaveTestRecord_(partnerId, connectorId, body) {
  const message = String(body.message || '').trim();
  if (message.length > 120) throw new Error('Use 120 characters or fewer for the test message. Do not enter customer information.');
  const expectedVersion = Number(body.version);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) throw new Error('The test record version is invalid. Reload it and try again.');
  const recordId = trackerTestRecordId_(partnerId, connectorId);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = trackerSheet_('CloudTestRecords');
    const rows = trackerRows_('CloudTestRecords');
    const existing = rows.find(item => item.record_id === recordId);
    if (existing && (existing.owner_partner_id !== partnerId || existing.connector_id !== connectorId)) {
      throw new Error('This test record belongs to another Partner or Connector.');
    }
    const currentVersion = existing ? Number(existing.version || 0) : 0;
    if (currentVersion !== expectedVersion) throw new Error('This test record changed elsewhere. Reload it before saving.');
    const next = [recordId, connectorId, partnerId, JSON.stringify({ message }), currentVersion + 1, new Date().toISOString()];
    if (existing) sheet.getRange(existing.__row, 1, 1, next.length).setValues([next]);
    else sheet.appendRow(next);
    trackerAudit_(connectorId, partnerId, existing ? 'update-cloud-test-record' : 'create-cloud-test-record', recordId);
    return { record: { id: recordId, connectorId, version: currentVersion + 1, message, updatedAt: next[5] }, acknowledged: true };
  } finally {
    lock.releaseLock();
  }
}

function trackerTestRecordPayload_(row) {
  let payload = {};
  try { payload = JSON.parse(row.payload_json || '{}'); } catch (_) {}
  return { id: row.record_id, connectorId: row.connector_id, version: Number(row.version || 0), message: String(payload.message || ''), updatedAt: row.updated_at || '' };
}

function trackerCompanionRequest_(action, values) {
  const url = PropertiesService.getScriptProperties().getProperty('COMPANION_CLOUD_URL');
  if (!url || !/^https:\/\/script\.google\.com\/macros\/s\//.test(url)) throw new Error('The shared Partner identity service is not configured.');
  let response;
  try {
    response = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'text/plain;charset=utf-8',
      payload: JSON.stringify({ action, ...values }), muteHttpExceptions: true,
      followRedirects: true
    });
  } catch (_) { throw new Error('The shared Partner identity service is unavailable. Try again shortly.'); }
  let data;
  try { data = JSON.parse(response.getContentText()); }
  catch (_) { throw new Error('The shared Partner identity service returned an unreadable response.'); }
  if (!data || data.ok !== true) throw new Error(action === 'getPartnerProfile' ? 'Partner ID or password was not accepted.' : 'The shared Partner identity service could not confirm this account.');
  return data;
}

function trackerCleanProfile_(partner) {
  return {
    partnerId: trackerPartnerId_(partner.partner_id),
    name: String(partner.name || partner.partner_name || partner.partner_id || ''),
    photoUrl: String(partner.photo_url || ''),
    status: String(partner.status || 'active')
  };
}

function trackerRows_(name) {
  const sheet = trackerSheet_(name);
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).map((row, index) => {
    const item = { __row: index + 2 };
    headers.forEach((header, column) => { if (header) item[header] = row[column]; });
    return item;
  }).filter(row => Object.keys(row).some(key => key !== '__row' && row[key] !== ''));
}

function trackerSheet_(name) {
  const id = PropertiesService.getScriptProperties().getProperty('TRACKER_SHEET_ID');
  if (!id) throw new Error('The CAT Cloud Store is not configured.');
  const spreadsheet = SpreadsheetApp.openById(id);
  const sheet = spreadsheet.getSheetByName(name);
  if (!sheet) throw new Error('The CAT ' + name + ' tab is missing. Run initializeTrackerCloud().');
  const expected = TRACKER_SCHEMA_[name];
  if (!expected || expected.some((header, index) => sheet.getRange(1, index + 1).getDisplayValue() !== header)) {
    throw new Error('The CAT ' + name + ' tab has an invalid schema.');
  }
  return sheet;
}

function trackerSession_(token) {
  if (!token || String(token).length > 256) return null;
  const raw = CacheService.getScriptCache().get(trackerSessionKey_(String(token)));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

function trackerSessionKey_(token) { return 'SESSION:' + trackerSha256_(token); }
function trackerPartnerRateKey_(partnerId) { return 'TRACKER_LOGIN_PARTNER_' + trackerSha256_(partnerId); }
function trackerTestRecordId_(partnerId, connectorId) { return 'smoke-' + trackerSha256_(connectorId + '|' + partnerId).slice(0, 24); }

function trackerCheckLoginRate_(partnerId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const properties = PropertiesService.getScriptProperties();
    const now = Date.now();
    const globalKey = 'TRACKER_LOGIN_GLOBAL_V1';
    const partnerKey = trackerPartnerRateKey_(partnerId);
    const globalState = trackerReadLoginRate_(properties, globalKey, now);
    const partnerState = trackerReadLoginRate_(properties, partnerKey, now);
    if (globalState.count >= TRACKER_LOGIN_GLOBAL_LIMIT_ || partnerState.count >= TRACKER_LOGIN_LIMIT_) {
      throw new Error('Too many sign-in attempts. Wait 15 minutes and try again.');
    }
    globalState.count++;
    partnerState.count++;
    properties.setProperty(globalKey, JSON.stringify(globalState));
    properties.setProperty(partnerKey, JSON.stringify(partnerState));
  } finally {
    lock.releaseLock();
  }
}

function trackerReadLoginRate_(properties, key, now) {
  let state;
  try { state = JSON.parse(properties.getProperty(key) || 'null'); } catch (_) { state = null; }
  if (!state || !Number.isInteger(Number(state.count)) || !Number.isFinite(Number(state.expiresAt)) || Number(state.expiresAt) <= now) {
    return { count: 0, expiresAt: now + TRACKER_LOGIN_WINDOW_SECONDS_ * 1000 };
  }
  return { count: Number(state.count), expiresAt: Number(state.expiresAt) };
}

function trackerClearLoginRate_(partnerId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    PropertiesService.getScriptProperties().deleteProperty(trackerPartnerRateKey_(partnerId));
  } finally {
    lock.releaseLock();
  }
}

function trackerAudit_(connectorId, partnerId, action, recordId) {
  trackerSheet_('AuditLog').appendRow([Utilities.getUuid(), connectorId, partnerId, action, recordId, new Date().toISOString()]);
}

function trackerEnabled_(value) { return ['true', '1', 'yes', 'active'].includes(String(value || '').trim().toLowerCase()); }
function trackerPartnerId_(value) { return String(value || '').trim().toLowerCase(); }
function trackerSha256_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8)
    .map(byte => ('0' + ((byte + 256) % 256).toString(16)).slice(-2)).join('');
}
function trackerJson_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function trackerPublicError_(error) { return String(error && error.message || 'CAT Cloud request failed.').slice(0, 220); }
