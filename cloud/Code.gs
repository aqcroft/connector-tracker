/**
 * Connector Tracker Cloud API · Phase 1
 *
 * Authentication is checked against Appointment Companion's existing Partner
 * profile endpoint. The Companion workspace_key is used only for that login
 * request and is never written to this spreadsheet or retained in a session.
 */
const TRACKER_SCHEMA_ = {
  ConnectorAccess: ['partner_id', 'connector_id', 'role', 'enabled'],
  Connectors: ['connector_id', 'name', 'active'],
  CloudTestRecords: ['record_id', 'connector_id', 'owner_partner_id', 'payload_json', 'version', 'updated_at'],
  AuditLog: ['audit_id', 'connector_id', 'actor_partner_id', 'action', 'record_id', 'created_at']
};
const TRACKER_SESSION_TTL_SECONDS_ = 21600;
const TRACKER_LOGIN_LIMIT_ = 5;
const TRACKER_LOGIN_WINDOW_SECONDS_ = 900;

function doPost(e) {
  try {
    const body = JSON.parse(String(e && e.postData && e.postData.contents || '{}'));
    const result = trackerDispatch_(body);
    return trackerJson_({ ok: true, ...result });
  } catch (error) {
    return trackerJson_({ ok: false, error: trackerPublicError_(error) });
  }
}

function doGet() {
  return trackerJson_({ ok: false, error: 'Use the Connector Tracker Cloud API.' });
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
  return 'Connector Tracker Phase 1 tabs are ready.';
}

function trackerDispatch_(body) {
  const action = String(body && body.action || '');
  if (action === 'login') return trackerLogin_(body);
  if (action === 'logout') return trackerLogout_(body);
  if (action === 'getSession') {
    const session = trackerRequireSession_(body.session_token);
    return trackerSessionPayload_(session.partnerId, session.expiresAt);
  }
  if (action === 'getCloudTestRecord' || action === 'saveCloudTestRecord') {
    const session = trackerRequireSession_(body.session_token);
    const connectorId = String(body.connector_id || '').trim();
    const access = trackerRequireConnector_(session.partnerId, connectorId);
    if (action === 'getCloudTestRecord') return trackerGetTestRecord_(session.partnerId, connectorId);
    return trackerSaveTestRecord_(session.partnerId, connectorId, access.role, body);
  }
  throw new Error('This Cloud action is not available.');
}

function trackerLogin_(body) {
  const partnerId = trackerPartnerId_(body && body.partner_id);
  const workspaceKey = String(body && body.workspace_key || '');
  if (!partnerId || !workspaceKey || workspaceKey.length > 512) throw new Error('Enter your Partner ID and password.');
  trackerCheckLoginRate_(partnerId);

  let profile;
  try {
    profile = trackerCompanionRequest_('getPartnerProfile', {
      partner_id: partnerId,
      workspace_key: workspaceKey
    });
  } catch (error) {
    if (/Partner ID or password was not accepted/i.test(error.message)) trackerRecordLoginFailure_(partnerId);
    throw error;
  }
  const partner = profile && profile.partner;
  if (!partner || trackerPartnerId_(partner.partner_id) !== partnerId || String(partner.status || 'active').toLowerCase() !== 'active') {
    trackerRecordLoginFailure_(partnerId);
    throw new Error('Partner ID or password was not accepted.');
  }

  const connectors = trackerConnectorAccess_(partnerId);
  if (!connectors.length) throw new Error('This Partner account has no active Connector Tracker access. Ask an administrator to assign a Connector.');
  CacheService.getScriptCache().remove(trackerRateKey_(partnerId));
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
  if (!session || session.expiresAt <= Date.now()) throw new Error('Your session has expired. Sign in again.');

  // This read-only Companion action checks shared Partner active status on
  // every protected API call, so a deactivated Partner loses access at once.
  const current = trackerCompanionRequest_('getPublicPartnerProfile', { partner_id: session.partnerId });
  const partner = current && current.partner;
  if (!partner || trackerPartnerId_(partner.partner_id) !== session.partnerId || String(partner.status || 'active').toLowerCase() !== 'active') {
    CacheService.getScriptCache().remove(trackerSessionKey_(token));
    throw new Error('This Partner account is inactive. Contact the Partner administrator.');
  }
  return session;
}

function trackerSessionPayload_(partnerId, expiresAt) {
  const current = trackerCompanionRequest_('getPublicPartnerProfile', { partner_id: partnerId });
  const partner = current && current.partner;
  if (!partner || String(partner.status || 'active').toLowerCase() !== 'active') throw new Error('This Partner account is inactive.');
  const connectors = trackerConnectorAccess_(partnerId);
  if (!connectors.length) throw new Error('Connector Tracker access has been revoked.');
  return { profile: trackerCleanProfile_(partner), connectors, expires_at: new Date(expiresAt).toISOString() };
}

function trackerConnectorAccess_(partnerId) {
  const connectors = trackerRows_('Connectors');
  return trackerRows_('ConnectorAccess').filter(row =>
    trackerPartnerId_(row.partner_id) === partnerId && trackerEnabled_(row.enabled)
  ).map(row => {
    const connectorId = String(row.connector_id || '').trim();
    const connector = connectors.find(item => String(item.connector_id || '').trim() === connectorId && trackerEnabled_(item.active));
    if (!connector) return null;
    const role = String(row.role || '').trim();
    if (!['Admin', 'Editor'].includes(role)) return null;
    return { id: connectorId, name: String(connector.name || connectorId), role };
  }).filter(Boolean);
}

function trackerRequireConnector_(partnerId, connectorId) {
  if (!connectorId) throw new Error('Choose a Connector.');
  const access = trackerConnectorAccess_(partnerId).find(item => item.id === connectorId);
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

function trackerSaveTestRecord_(partnerId, connectorId, role, body) {
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
    if (existing && existing.owner_partner_id !== partnerId && role !== 'Admin') throw new Error('This test record belongs to another Partner.');
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
    email: String(partner.email || ''),
    mobile: String(partner.mobile || ''),
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
  if (!id) throw new Error('The Connector Tracker Sheet is not configured.');
  const spreadsheet = SpreadsheetApp.openById(id);
  const sheet = spreadsheet.getSheetByName(name);
  if (!sheet) throw new Error('The Connector Tracker ' + name + ' tab is missing. Run initializeTrackerCloud().');
  const expected = TRACKER_SCHEMA_[name];
  if (!expected || expected.some((header, index) => sheet.getRange(1, index + 1).getDisplayValue() !== header)) {
    throw new Error('The Connector Tracker ' + name + ' tab has an invalid schema.');
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
function trackerRateKey_(partnerId) { return 'LOGIN-RATE:' + trackerSha256_(partnerId); }
function trackerTestRecordId_(partnerId, connectorId) { return 'smoke-' + trackerSha256_(connectorId + '|' + partnerId).slice(0, 24); }

function trackerCheckLoginRate_(partnerId) {
  const attempts = Number(CacheService.getScriptCache().get(trackerRateKey_(partnerId)) || 0);
  if (attempts >= TRACKER_LOGIN_LIMIT_) throw new Error('Too many sign-in attempts. Wait 15 minutes and try again.');
}

function trackerRecordLoginFailure_(partnerId) {
  const cache = CacheService.getScriptCache();
  const key = trackerRateKey_(partnerId);
  const attempts = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(attempts), TRACKER_LOGIN_WINDOW_SECONDS_);
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
function trackerPublicError_(error) { return String(error && error.message || 'Connector Tracker Cloud request failed.').slice(0, 220); }
