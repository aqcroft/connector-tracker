const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require('node:path').join(__dirname, 'Code.gs'), 'utf8');
const TEST_WORKSPACE_KEY = ['synthetic', 'test', 'key'].join('-');
const INVALID_TEST_KEY = ['incorrect', 'test', 'key'].join('-');
const schemas = {
  ConnectorAccess: ['partner_id', 'connector_id', 'role', 'enabled'],
  Connectors: ['connector_id', 'name', 'active'],
  ConnectorProfiles: ['connector_id', 'code', 'logo', 'primary_color', 'accent_color', 'main_contact_name'],
  CRMRecords: ['record_id', 'entity', 'connector_id', 'owner_partner_id', 'payload_json', 'version', 'updated_at', 'deleted', 'last_transaction_id'],
  CloudTestRecords: ['record_id', 'connector_id', 'owner_partner_id', 'payload_json', 'version', 'updated_at'],
  AuditLog: ['audit_id', 'connector_id', 'actor_partner_id', 'action', 'record_id', 'created_at']
};

function createHarness() {
  const properties = new Map([['TRACKER_SHEET_ID', 'private-test-sheet'], ['COMPANION_CLOUD_URL', 'https://script.google.com/macros/s/test/exec']]);
  const cache = new Map();
  const sheets = new Map(Object.entries(schemas).map(([name, headers]) => [name, new MockSheet([headers])]));
  sheets.get('Connectors').appendRow(['demo-connector', 'Demo Connector', 'TRUE']);
  sheets.get('ConnectorAccess').appendRow(['pilot-admin', 'demo-connector', 'Admin', 'TRUE']);
  sheets.get('ConnectorAccess').appendRow(['pilot-editor', 'demo-connector', 'Editor', 'TRUE']);
  sheets.get('ConnectorAccess').appendRow(['pilot-second', 'demo-connector', 'Editor', 'TRUE']);
  const activePartners = new Set(['pilot-admin', 'pilot-editor', 'pilot-second']);
  let companionCalls = 0;
  let uuid = 0;

  const context = vm.createContext({
    Date,
    JSON,
    Math,
    Number,
    Object,
    String,
    RegExp,
    Error,
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => properties.get(key) || null,
      setProperty: (key, value) => properties.set(key, String(value)),
      deleteProperty: key => properties.delete(key)
    }) },
    CacheService: { getScriptCache: () => ({
      get: key => cache.get(key) || null,
      put: (key, value) => cache.set(key, String(value)),
      remove: key => cache.delete(key)
    }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: name => sheets.get(name) }) },
    Utilities: {
      getUuid: () => `test-uuid-${++uuid}`,
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      computeDigest: (_algorithm, value) => [...crypto.createHash('sha256').update(String(value)).digest()].map(byte => byte > 127 ? byte - 256 : byte)
    },
    UrlFetchApp: { fetch: (_url, options) => {
      companionCalls++;
      const request = JSON.parse(options.payload);
      let result;
      if (request.action === 'getPartnerProfile') {
        result = request.workspace_key === TEST_WORKSPACE_KEY && activePartners.has(request.partner_id)
          ? { ok: true, partner: { partner_id: request.partner_id, name: `Demo ${request.partner_id}`, status: 'active' } }
          : { ok: false, error: 'rejected' };
      } else if (request.action === 'getPublicPartnerProfile') {
        result = activePartners.has(request.partner_id)
          ? { ok: true, partner: { partner_id: request.partner_id, name: `Demo ${request.partner_id}`, status: 'active' } }
          : { ok: false, error: 'inactive' };
      } else result = { ok: false, error: 'unexpected action' };
      return { getContentText: () => JSON.stringify(result) };
    } },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: value => ({ setMimeType: () => value }) },
    console
  });
  vm.runInContext(source, context, { filename: 'Code.gs' });
  return {
    context, sheets, cache, properties, activePartners,
    get companionCalls() { return companionCalls; }
  };
}

class MockSheet {
  constructor(rows = []) { this.rows = rows.map(row => [...row]); }
  getDataRange() { return this.getRange(1, 1, Math.max(this.rows.length, 1), Math.max(...this.rows.map(row => row.length), 1)); }
  getRange(row, column, rowCount = 1, columnCount = 1) {
    const sheet = this;
    return {
      getDisplayValues() {
        return Array.from({ length: rowCount }, (_, rowOffset) => Array.from({ length: columnCount }, (_, columnOffset) => String(sheet.rows[row + rowOffset - 1]?.[column + columnOffset - 1] ?? '')));
      },
      getDisplayValue() { return String(sheet.rows[row - 1]?.[column - 1] ?? ''); },
      setValues(values) {
        values.forEach((valuesRow, rowOffset) => {
          const targetRow = row + rowOffset - 1;
          while (sheet.rows.length <= targetRow) sheet.rows.push([]);
          valuesRow.forEach((value, columnOffset) => { sheet.rows[targetRow][column + columnOffset - 1] = value; });
        });
      }
      ,setValue(value) {
        while (sheet.rows.length < row) sheet.rows.push([]);
        sheet.rows[row - 1][column - 1] = value;
      }
    };
  }
  appendRow(row) { this.rows.push([...row]); }
  setFrozenRows() {}
}

function rejected(run, errorText) {
  assert.throws(run, error => errorText.test(error.message));
}
function post(harness, body) { return harness.context.trackerDispatch_(body); }

// Unassigned Partner IDs are rejected before Tracker calls Companion.
{
  const h = createHarness();
  h.activePartners.add('companion-only');
  rejected(() => post(h, { action: 'login', partner_id: 'companion-only', workspace_key: TEST_WORKSPACE_KEY }), /not accepted/);
  assert.equal(h.companionCalls, 0);
}

{
  const h = createHarness();
  const response = JSON.parse(h.context.doPost({ postData: { contents: '{"action":"login","padding":"' + 'x'.repeat(35000) + '"}' } }));
  assert.equal(response.ok, false);
  assert.match(response.error, /too large/);
  assert.equal(h.companionCalls, 0);
}

// Invalid credentials hit the per-Partner limit; a successful login clears it.
{
  const h = createHarness();
  for (let attempt = 0; attempt < 5; attempt++) {
    rejected(() => post(h, { action: 'login', partner_id: 'pilot-admin', workspace_key: INVALID_TEST_KEY }), /not accepted/);
  }
  const callsAtLimit = h.companionCalls;
  rejected(() => post(h, { action: 'login', partner_id: 'pilot-admin', workspace_key: TEST_WORKSPACE_KEY }), /Too many sign-in attempts/);
  assert.equal(h.companionCalls, callsAtLimit);
}

{
  const h = createHarness();
  for (let attempt = 0; attempt < 4; attempt++) {
    rejected(() => post(h, { action: 'login', partner_id: 'pilot-admin', workspace_key: INVALID_TEST_KEY }), /not accepted/);
  }
  const session = post(h, { action: 'login', partner_id: 'pilot-admin', workspace_key: TEST_WORKSPACE_KEY });
  assert.ok(session.session_token);
  assert.equal(h.properties.has(h.context.trackerPartnerRateKey_('pilot-admin')), false);
}

// Admin and Editor cannot retrieve or overwrite one another's test record.
{
  const h = createHarness();
  const admin = post(h, { action: 'login', partner_id: 'pilot-admin', workspace_key: TEST_WORKSPACE_KEY });
  const editor = post(h, { action: 'login', partner_id: 'pilot-editor', workspace_key: TEST_WORKSPACE_KEY });
  h.sheets.get('Connectors').appendRow(['other-connector', 'Other Connector', 'TRUE']);
  const adminRecordId = h.context.trackerTestRecordId_('pilot-admin', 'demo-connector');
  const editorRecordId = h.context.trackerTestRecordId_('pilot-editor', 'demo-connector');
  h.sheets.get('CloudTestRecords').appendRow([adminRecordId, 'demo-connector', 'pilot-admin', '{"message":"private admin fixture"}', 1, '2026-10-11T00:00:00.000Z']);

  assert.equal(post(h, { action: 'getCloudTestRecord', session_token: editor.session_token, connector_id: 'demo-connector' }).record, null);
  const editorSave = post(h, { action: 'saveCloudTestRecord', session_token: editor.session_token, connector_id: 'demo-connector', message: 'my private fixture', version: 0 });
  assert.equal(editorSave.record.id, editorRecordId);
  const storedAdminRecord = h.sheets.get('CloudTestRecords').rows.find(row => row[0] === adminRecordId);
  assert.equal(storedAdminRecord[2], 'pilot-admin');
  assert.equal(storedAdminRecord[3], '{"message":"private admin fixture"}');
  rejected(() => post(h, { action: 'getCloudTestRecord', session_token: editor.session_token, connector_id: 'other-connector' }), /do not have access/);
  rejected(() => post(h, { action: 'saveCloudTestRecord', session_token: editor.session_token, connector_id: 'other-connector', message: 'unauthorised', version: 0 }), /do not have access/);

  // An Editor also cannot overwrite a row at their own derived ID if it has
  // been tampered with to claim a different owner.
  h.sheets.get('CloudTestRecords').rows.find(row => row[0] === editorRecordId)[2] = 'pilot-admin';
  rejected(() => post(h, { action: 'saveCloudTestRecord', session_token: editor.session_token, connector_id: 'demo-connector', message: 'overwrite', version: 1 }), /belongs to another Partner or Connector/);

  // Even an Admin role cannot overwrite a row whose owner/connector is wrong.
  h.sheets.get('CloudTestRecords').rows.find(row => row[0] === adminRecordId)[2] = 'pilot-editor';
  rejected(() => post(h, { action: 'saveCloudTestRecord', session_token: admin.session_token, connector_id: 'demo-connector', message: 'overwrite', version: 1 }), /belongs to another Partner or Connector/);
  assert.equal(h.sheets.get('CloudTestRecords').rows.find(row => row[0] === editorRecordId)[3], '{"message":"my private fixture"}');
}

// The app-wide pilot cap is enforced atomically in persistent Script Properties.
{
  const h = createHarness();
  for (let attempt = 0; attempt < 120; attempt++) {
    h.context.trackerCheckLoginRate_('pilot-admin');
    h.context.trackerClearLoginRate_('pilot-admin');
  }
  rejected(() => h.context.trackerCheckLoginRate_('pilot-admin'), /Too many sign-in attempts/);
}

// Connector scoping, inactive identity, and logout revoke access.
{
  const h = createHarness();
  const session = post(h, { action: 'login', partner_id: 'pilot-admin', workspace_key: TEST_WORKSPACE_KEY });
  rejected(() => post(h, { action: 'getCloudTestRecord', session_token: 'unknown-token', connector_id: 'demo-connector' }), /session has expired/);
  h.activePartners.delete('pilot-admin');
  rejected(() => post(h, { action: 'getCloudTestRecord', session_token: session.session_token, connector_id: 'demo-connector' }), /could not confirm/);
  assert.equal(h.cache.has(h.context.trackerSessionKey_(session.session_token)), false);
}

{
  const h = createHarness();
  const session = post(h, { action: 'login', partner_id: 'pilot-admin', workspace_key: TEST_WORKSPACE_KEY });
  h.sheets.get('ConnectorAccess').rows.find(row => row[0] === 'pilot-admin')[3] = 'FALSE';
  rejected(() => post(h, { action: 'getSession', session_token: session.session_token }), /access has been revoked/);
  assert.equal(h.cache.has(h.context.trackerSessionKey_(session.session_token)), false);
}

{
  const h = createHarness();
  const session = post(h, { action: 'login', partner_id: 'pilot-admin', workspace_key: TEST_WORKSPACE_KEY });
  post(h, { action: 'logout', session_token: session.session_token });
  assert.equal(h.cache.has(h.context.trackerSessionKey_(session.session_token)), false);
  rejected(() => post(h, { action: 'getSession', session_token: session.session_token }), /session has expired/);
}

{
  const h = createHarness();
  const token = 'expired-test-token';
  h.cache.set(h.context.trackerSessionKey_(token), JSON.stringify({ partnerId: 'pilot-admin', expiresAt: Date.now() - 1000 }));
  rejected(() => post(h, { action: 'getSession', session_token: token }), /session has expired/);
  assert.equal(h.companionCalls, 0);
  assert.equal(h.cache.has(h.context.trackerSessionKey_(token)), false);
}

// The cloud workspace shares Activities but returns private Lead data only to
// the owning Partner and Connector Admins, and enforces connector boundaries.
{
  const h = createHarness();
  const admin = post(h, { action: 'login', partner_id: 'pilot-admin', workspace_key: TEST_WORKSPACE_KEY });
  const editor = post(h, { action: 'login', partner_id: 'pilot-editor', workspace_key: TEST_WORKSPACE_KEY });
  const second = post(h, { action: 'login', partner_id: 'pilot-second', workspace_key: TEST_WORKSPACE_KEY });
  h.sheets.get('Connectors').appendRow(['other-org', 'Other Org', 'TRUE']);
  h.sheets.get('ConnectorAccess').appendRow(['pilot-admin', 'other-org', 'Admin', 'TRUE']);
  h.sheets.get('CRMRecords').appendRow(['foreign-event', 'activity', 'other-org', '', JSON.stringify({ id: 'foreign-event', connectorId: 'other-org', name: 'Synthetic other Event' }), 1, '2026-10-11T00:00:00.000Z', 'FALSE', 'seed'] );

  const eventPayload = { id: 'event-sync-01', connectorId: 'demo-connector', name: 'Synthetic shared Event', date: '2026-10-12', active: true };
  post(h, { action: 'saveCrmRecord', session_token: editor.session_token, entity: 'activity', connector_id: 'demo-connector', record_id: eventPayload.id, payload: eventPayload, base_version: 0, transaction_id: 'evt-create-01' });
  rejected(() => post(h, { action: 'deleteCrmRecord', session_token: editor.session_token, entity: 'activity', connector_id: 'demo-connector', record_id: eventPayload.id, base_version: 1, transaction_id: 'evt-delete-01' }), /Only a Connector Admin/);
  const stat = { id: 'stat-private-owner', connectorId: 'demo-connector', activityId: eventPayload.id, partnerId: 'pilot-editor', forms20K: 4 };
  post(h, { action: 'saveCrmRecord', session_token: editor.session_token, entity: 'activity-partner-stat', connector_id: 'demo-connector', record_id: stat.id, payload: stat, base_version: 0, transaction_id: 'stat-create-01' });
  rejected(() => post(h, { action: 'saveCrmRecord', session_token: second.session_token, entity: 'activity-partner-stat', connector_id: 'demo-connector', record_id: stat.id, payload: { ...stat, forms20K: 400 }, base_version: 1, transaction_id: 'stat-tamper-01' }), /another Partner/);
  const twentyK = { id: 'twenty-k-private-01', connectorId: 'demo-connector', activityId: eventPayload.id, partnerId: 'pilot-editor', name: 'Synthetic private 20K' };
  post(h, { action: 'saveCrmRecord', session_token: editor.session_token, entity: 'twenty-k', connector_id: 'demo-connector', record_id: twentyK.id, payload: twentyK, base_version: 0, transaction_id: '20k-create-01' });
  const leadPayload = { id: 'lead-private-01', connectorId: 'demo-connector', activityId: eventPayload.id, origin20KId: twentyK.id, partnerId: 'pilot-editor', name: 'Synthetic private Lead', history: [] };
  const savedLead = post(h, { action: 'saveCrmRecord', session_token: editor.session_token, entity: 'lead', connector_id: 'demo-connector', record_id: leadPayload.id, payload: leadPayload, base_version: 0, transaction_id: 'lead-create-01' });
  assert.equal(savedLead.version, 1);
  const editorWorkspace = post(h, { action: 'getWorkspace', session_token: second.session_token });
  assert.ok(editorWorkspace.records.some(record => record.id === eventPayload.id));
  assert.ok(editorWorkspace.records.some(record => record.id === stat.id));
  assert.ok(!editorWorkspace.records.some(record => record.id === twentyK.id));
  assert.ok(!editorWorkspace.records.some(record => record.id === leadPayload.id));
  assert.ok(editorWorkspace.access.every(row => row.userId === 'pilot-second'));
  const ownerWorkspace = post(h, { action: 'getWorkspace', session_token: editor.session_token });
  assert.ok(ownerWorkspace.records.some(record => record.id === leadPayload.id));
  assert.ok(ownerWorkspace.records.some(record => record.id === twentyK.id));
  const adminWorkspace = post(h, { action: 'getWorkspace', session_token: admin.session_token });
  assert.ok(adminWorkspace.records.some(record => record.id === leadPayload.id));
  assert.ok(!editorWorkspace.records.some(record => record.id === 'foreign-event'));
  rejected(() => post(h, { action: 'saveCrmRecord', session_token: second.session_token, entity: 'lead', connector_id: 'demo-connector', record_id: leadPayload.id, payload: { ...leadPayload, name: 'tampered' }, base_version: 1, transaction_id: 'lead-tamper-01' }), /another Partner/);
  rejected(() => post(h, { action: 'saveCrmRecord', session_token: second.session_token, entity: 'lead', connector_id: 'demo-connector', record_id: 'lead-forged-01', payload: { id: 'lead-forged-01', connectorId: 'demo-connector', activityId: 'foreign-event', partnerId: 'pilot-second' }, base_version: 0, transaction_id: 'lead-forged-01' }), /linked Event or record is missing/);
  rejected(() => post(h, { action: 'saveCrmRecord', session_token: second.session_token, entity: 'customer-result', connector_id: 'demo-connector', record_id: 'result-forged-01', payload: { id: 'result-forged-01', connectorId: 'demo-connector', leadId: leadPayload.id }, base_version: 0, transaction_id: 'result-forged-01' }), /linked private record belongs to another Partner/);
  rejected(() => post(h, { action: 'saveCrmRecord', session_token: second.session_token, entity: 'lead', connector_id: 'demo-connector', record_id: 'lead-forged-20k', payload: { id: 'lead-forged-20k', connectorId: 'demo-connector', origin20KId: twentyK.id, partnerId: 'pilot-second' }, base_version: 0, transaction_id: 'lead-forged-20k' }), /linked private record belongs to another Partner/);
  rejected(() => post(h, { action: 'deleteCrmRecord', session_token: second.session_token, entity: 'lead', connector_id: 'demo-connector', record_id: leadPayload.id, base_version: 1, transaction_id: 'lead-delete-01' }), /another Partner/);
  const retry = post(h, { action: 'saveCrmRecord', session_token: editor.session_token, entity: 'lead', connector_id: 'demo-connector', record_id: leadPayload.id, payload: leadPayload, base_version: 0, transaction_id: 'lead-create-01' });
  assert.equal(retry.version, 1);
  assert.equal(retry.duplicate, true);
  rejected(() => post(h, { action: 'saveCrmRecord', session_token: editor.session_token, entity: 'lead', connector_id: 'demo-connector', record_id: leadPayload.id, payload: leadPayload, base_version: 0, transaction_id: 'lead-stale-01' }), /changed elsewhere/);
}

// Connector create, branding and access are cloud records, and access grants
// are administered only by a Partner with Admin rights for that Connector.
{
  const h = createHarness();
  const admin = post(h, { action: 'login', partner_id: 'pilot-admin', workspace_key: TEST_WORKSPACE_KEY });
  const editor = post(h, { action: 'login', partner_id: 'pilot-editor', workspace_key: TEST_WORKSPACE_KEY });
  const connector = post(h, { action: 'saveConnector', session_token: admin.session_token, connector_id: 'miss-england-01', name: 'Miss England', code: 'ME', logo: '👑', primary_color: '#123456', accent_color: '#abcdef', main_contact_name: 'Synthetic Contact' });
  assert.equal(connector.acknowledged, true);
  assert.ok(h.sheets.get('ConnectorProfiles').rows.some(row => row[0] === 'miss-england-01' && row[1] === 'ME'));
  assert.ok(h.sheets.get('ConnectorAccess').rows.some(row => row[0] === 'pilot-admin' && row[1] === 'miss-england-01' && row[2] === 'Admin'));
  post(h, { action: 'grantConnectorAccess', session_token: admin.session_token, connector_id: 'miss-england-01', partner_id: 'pilot-second', role: 'Editor' });
  const second = post(h, { action: 'login', partner_id: 'pilot-second', workspace_key: TEST_WORKSPACE_KEY });
  assert.ok(second.connectors.some(item => item.id === 'miss-england-01'));
  rejected(() => post(h, { action: 'saveConnector', session_token: editor.session_token, connector_id: 'unauthorised-org', name: 'Unsafe', code: 'NO' }), /administration permission/);
  rejected(() => post(h, { action: 'grantConnectorAccess', session_token: editor.session_token, connector_id: 'demo-connector', partner_id: 'pilot-second', role: 'Editor' }), /Only this Connector’s Admin/);
}

console.log('Passed: login throttling and revocation; allowlist-before-Companion; shared Activity and private Lead access; Connector isolation and relationship checks; version conflicts and retry idempotency; Connector branding/admin; Partner access grants.');
