(function (global) {
  'use strict';

  const SESSION_KEY = 'connector-tracker-session-v1';
  const endpoint = String(global.CONNECTOR_TRACKER_CLOUD_CONFIG?.endpoint || '').trim();

  async function post(body) {
    if (!endpoint) throw new Error('Cloud sign-in is not configured yet. Ask the Tracker administrator to finish the cloud setup.');
    let response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(body),
          redirect: 'follow',
          cache: 'no-store',
          signal: controller.signal
        });
      } finally { clearTimeout(timeout); }
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('CAT Cloud took too long to respond. Check your connection and try again.');
      throw new Error('Could not reach CAT Cloud. Check your connection and try again.');
    }
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch (_) { throw new Error('CAT Cloud returned an unreadable response.'); }
    if (!data || data.ok !== true) throw new Error(data?.error || 'CAT Cloud rejected the request.');
    return data;
  }

  function sessionToken() {
    try { return sessionStorage.getItem(SESSION_KEY) || ''; }
    catch (_) { return ''; }
  }

  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); }
    catch (_) {}
  }

  async function authenticated(action, payload = {}) {
    const token = sessionToken();
    if (!token) throw new Error('Your session has ended. Sign in again.');
    try { return await post({ ...payload, action, session_token: token }); }
    catch (error) {
      if (/session|sign in again|revoked|inactive|not authorised/i.test(error.message)) clearSession();
      throw error;
    }
  }

  global.ConnectorTrackerCloud = Object.freeze({
    get configured() { return !!endpoint; },
    async login(partnerId, password) {
      const data = await post({ action: 'login', partner_id: partnerId, workspace_key: password });
      try { sessionStorage.setItem(SESSION_KEY, data.session_token); }
      catch (_) { throw new Error('This browser cannot keep a sign-in session. Enable session storage and try again.'); }
      return { profile: data.profile, connectors: data.connectors, expiresAt: data.expires_at };
    },
    async restoreSession() {
      if (!sessionToken()) return null;
      try {
        const data = await authenticated('getSession');
        return { profile: data.profile, connectors: data.connectors, expiresAt: data.expires_at };
      } catch (error) {
        // Network timeouts are not an authentication failure. Keep the token
        // so the existing Partner can retry. Authenticated() already removes
        // expired and revoked credentials.
        throw error;
      }
    },
    async getWorkspace() {
      return authenticated('getWorkspace');
    },
    async saveRecord(entity, connectorId, recordId, payload, baseVersion, transactionId) {
      return authenticated('saveCrmRecord', { entity, connector_id: connectorId, record_id: recordId, payload, base_version: baseVersion, transaction_id: transactionId });
    },
    async deleteRecord(entity, connectorId, recordId, baseVersion, transactionId) {
      return authenticated('deleteCrmRecord', { entity, connector_id: connectorId, record_id: recordId, base_version: baseVersion, transaction_id: transactionId });
    },
    async saveConnector(connector) {
      return authenticated('saveConnector', {
        connector_id: connector.id, name: connector.name, code: connector.code, logo: connector.logo,
        primary_color: connector.primaryColor, accent_color: connector.accentColor, main_contact_name: connector.mainContactName
      });
    },
    async grantConnectorAccess(connectorId, partnerId, role) {
      return authenticated('grantConnectorAccess', { connector_id: connectorId, partner_id: partnerId, role });
    },
    async getTestRecord(connectorId) {
      const data = await authenticated('getCloudTestRecord', { connector_id: connectorId });
      return data.record || null;
    },
    async saveTestRecord(connectorId, message, version) {
      return authenticated('saveCloudTestRecord', { connector_id: connectorId, message, version });
    },
    async logout() {
      const token = sessionToken();
      try { if (token) await post({ action: 'logout', session_token: token }); }
      finally { clearSession(); }
    }
  });
})(window);
