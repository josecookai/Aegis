import { safeJsonParse } from './lib/crypto';
import { ActionRecord } from './types';

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
:root {
  --bg: #f6f4ec;
  --fg: #162018;
  --muted: #5a655c;
  --card: #ffffff;
  --line: #d9d4c4;
  --accent: #0f766e;
  --danger: #b42318;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; color: var(--fg); background: radial-gradient(circle at 20% -10%, #d5f1e4 0, rgba(213,241,228,0) 45%), radial-gradient(circle at 90% 10%, #f2e8cf 0, rgba(242,232,207,0) 35%), var(--bg); }
main { max-width: 980px; margin: 40px auto; padding: 0 16px; }
.card { background: color-mix(in srgb, var(--card) 95%, #f6f4ec); border: 1px solid var(--line); border-radius: 18px; padding: 20px; box-shadow: 0 6px 24px rgba(0,0,0,.04); }
.grid { display: grid; gap: 16px; }
.grid.cols-2 { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
h1, h2, h3 { margin: 0 0 12px; }
p { margin: 8px 0; color: var(--muted); }
label { display: block; margin-bottom: 8px; font-weight: 600; }
input, select, textarea, button { font: inherit; }
input, select, textarea { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--line); background: white; }
button { border: 0; border-radius: 10px; padding: 10px 14px; cursor: pointer; }
button.primary { background: var(--accent); color: white; }
button.danger { background: #fff2f0; color: var(--danger); border: 1px solid #f3c8c2; }
button.ghost { background: #eef5f3; color: #0f3f3b; }
code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
pre { background: #f8faf7; border: 1px solid var(--line); border-radius: 12px; padding: 12px; overflow: auto; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { text-align: left; border-bottom: 1px solid var(--line); padding: 8px 6px; vertical-align: top; }
.status { display: inline-block; padding: 4px 8px; border-radius: 999px; font-size: 12px; border: 1px solid var(--line); background: #fff; }
.status.approved,.status.succeeded { background: #ecfdf3; border-color: #abefc6; color: #067647; }
.status.awaiting_approval { background: #fffaeb; border-color: #fec84b; color: #b54708; }
.status.denied,.status.failed,.status.expired,.status.canceled { background: #fef3f2; border-color: #fecdca; color: #b42318; }
.small { font-size: 12px; color: var(--muted); }
.actions { display: flex; gap: 12px; flex-wrap: wrap; }
.badge { display: inline-flex; align-items: center; gap: 4px; background: #edf7f5; color: #115e59; border-radius: 999px; padding: 4px 8px; font-size: 12px; border: 1px solid #b8e3dd; }
</style>
</head>
<body>
<main>${body}</main>
</body>
</html>`;
}

export function renderHomePage(): string {
  return layout(
    'Aegis MVP',
    `
    <div class="grid">
      <div class="card">
        <h1>Aegis MVP Prototype</h1>
        <p>AI agent payment authorization sandbox (API + web approval + audit + webhook + mock card/crypto execution).</p>
        <div class="actions">
          <a href="/docs/openapi.yaml">OpenAPI YAML</a>
          <a href="/admin">Admin Dashboard</a>
          <a href="/dev/emails">Dev Email Outbox</a>
          <a href="/healthz">Health</a>
        </div>
      </div>
      <div class="card">
        <h2>Seed Data</h2>
        <p><code>x-aegis-api-key: aegis_demo_agent_key</code></p>
        <p><code>end_user_id: usr_demo</code></p>
        <p class="small">Use <code>merchant_api:*</code> / <code>payment_link:*</code> for card rail, and <code>address:0x...</code> / <code>wallet:*</code> for crypto rail.</p>
      </div>
    </div>`
  );
}

export function renderApprovalPage(params: {
  valid: boolean;
  reason?: string;
  action?: ActionRecord;
  endUser?: { id: string; email: string; display_name: string };
  token?: string;
  csrfToken?: string;
  passkeyCount?: number;
  alreadyDecided?: boolean;
  decision?: { decision: 'approved' | 'denied'; source: string; submitted_at: string } | null;
}): string {
  if (!params.valid || !params.action || !params.endUser || !params.token) {
    return layout('Invalid Approval Link', `<div class="card"><h1>Approval Link Invalid</h1><p>${escapeHtml(params.reason ?? 'Unknown error')}</p></div>`);
  }

  const action = params.action;
  const metadataPretty = JSON.stringify(safeJsonParse(action.metadata_json, {}), null, 2);
  const decided = params.alreadyDecided || action.status !== 'awaiting_approval';

  return layout(
    'Aegis Approval',
    `
    <div class="grid cols-2">
      <section class="card">
        <h1>Aegis Approval Request</h1>
        <p>Review and approve/deny this agent payment request.</p>
        <p><span class="badge">User: ${escapeHtml(params.endUser.display_name)}</span> <span class="badge">Action: ${escapeHtml(action.id)}</span></p>
        <table>
          <tr><th>Status</th><td><span class="status ${escapeHtml(action.status)}">${escapeHtml(action.status)}</span></td></tr>
          <tr><th>Amount</th><td>${escapeHtml(action.amount)} ${escapeHtml(action.currency)}</td></tr>
          <tr><th>Recipient</th><td>${escapeHtml(action.recipient_name)}</td></tr>
          <tr><th>Description</th><td>${escapeHtml(action.description)}</td></tr>
          <tr><th>Rail</th><td>${escapeHtml(action.payment_rail)}</td></tr>
          <tr><th>Payment Pref</th><td>${escapeHtml(action.payment_method_preference)}</td></tr>
          <tr><th>Recipient Ref</th><td><code>${escapeHtml(action.recipient_reference)}</code></td></tr>
          <tr><th>Expires</th><td>${escapeHtml(action.expires_at)}</td></tr>
        </table>
      </section>
      <section class="card">
        <h2>Decision</h2>
        ${
          decided
            ? `<p>This request has already been finalized.</p>${
                params.decision
                  ? `<p><strong>Decision:</strong> ${escapeHtml(params.decision.decision)} via <code>${escapeHtml(
                      params.decision.source
                    )}</code> at ${escapeHtml(params.decision.submitted_at)}</p>`
                  : ''
              }`
            : `
          <form method="post" action="/approve/${encodeURIComponent(params.token)}/decision" class="grid">
            <input type="hidden" name="csrf" value="${escapeHtml(params.csrfToken ?? '')}" />
            <label>Auth / Decision Source (MVP simulation)
              <select name="decision_source">
                <option value="web_passkey">Passkey (simulated)</option>
                <option value="web_otp">OTP (simulated)</option>
                <option value="web_magic_link">Magic Link Only</option>
              </select>
            </label>
            <div class="actions">
              <button class="primary" type="submit" name="decision" value="approve">Approve</button>
              <button class="danger" type="submit" name="decision" value="deny">Deny</button>
            </div>
            ${
              (params.passkeyCount ?? 0) > 0
                ? `<div class="card" style="padding:12px; background:#f7fffd">
                    <p><strong>Passkey available (${params.passkeyCount})</strong></p>
                    <div class="actions">
                      <button class="ghost" type="button" id="passkeyApproveBtn">Approve with Passkey</button>
                      <button class="ghost" type="button" id="passkeyDenyBtn">Deny with Passkey</button>
                    </div>
                    <p class="small" id="passkeyStatus"></p>
                  </div>`
                : `<p class="small">No passkey enrolled yet. Enroll one from <a href="/dev/passkeys">/dev/passkeys</a>.</p>`
            }
            <p class="small">Prototype note: real WebAuthn/OTP verification is represented as a decision source flag in this build.</p>
          </form>`
        }
      </section>
    </div>
    <section class="card" style="margin-top:16px">
      <h3>Metadata</h3>
      <pre>${escapeHtml(metadataPretty)}</pre>
    </section>
    ${
      (params.passkeyCount ?? 0) > 0 && !decided
        ? `<script>
          const token = ${JSON.stringify(params.token)};
          const csrf = ${JSON.stringify(params.csrfToken ?? '')};
          const statusEl = document.getElementById('passkeyStatus');
          const approveBtn = document.getElementById('passkeyApproveBtn');
          const denyBtn = document.getElementById('passkeyDenyBtn');

          function toBase64URL(bytes) {
            const str = btoa(String.fromCharCode(...new Uint8Array(bytes)));
            return str.replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/g, '');
          }
          function fromBase64URL(input) {
            const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
            const bin = atob(b64);
            return Uint8Array.from(bin, c => c.charCodeAt(0));
          }
          function publicKeyRequestOptionsFromJSON(opts) {
            const out = { ...opts, challenge: fromBase64URL(opts.challenge) };
            if (Array.isArray(out.allowCredentials)) {
              out.allowCredentials = out.allowCredentials.map(c => ({ ...c, id: fromBase64URL(c.id) }));
            }
            return out;
          }
          function credentialToJSON(cred) {
            return {
              id: cred.id,
              rawId: toBase64URL(cred.rawId),
              type: cred.type,
              authenticatorAttachment: cred.authenticatorAttachment || undefined,
              clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
              response: {
                clientDataJSON: toBase64URL(cred.response.clientDataJSON),
                authenticatorData: toBase64URL(cred.response.authenticatorData),
                signature: toBase64URL(cred.response.signature),
                userHandle: cred.response.userHandle ? toBase64URL(cred.response.userHandle) : undefined,
              },
            };
          }
          async function submitWithPasskey(decision) {
            if (!window.PublicKeyCredential || !navigator.credentials) {
              statusEl.textContent = 'Passkey is not supported in this browser.';
              return;
            }
            approveBtn.disabled = true; denyBtn.disabled = true;
            statusEl.textContent = 'Preparing passkey challenge...';
            try {
              const optRes = await fetch('/approve/' + encodeURIComponent(token) + '/passkey/options', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ csrf }),
              });
              const optData = await optRes.json();
              if (!optRes.ok) throw new Error(optData.message || optData.error || 'Failed to fetch passkey options');
              statusEl.textContent = 'Waiting for passkey verification...';
              const assertion = await navigator.credentials.get({ publicKey: publicKeyRequestOptionsFromJSON(optData.options) });
              if (!assertion) throw new Error('Passkey canceled');
              const res = await fetch('/approve/' + encodeURIComponent(token) + '/passkey-decision', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ csrf, decision, assertion: credentialToJSON(assertion) }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.message || data.error || 'Approval failed');
              window.location.href = data.redirect_url || window.location.href;
            } catch (err) {
              statusEl.textContent = err && err.message ? err.message : String(err);
              approveBtn.disabled = false; denyBtn.disabled = false;
            }
          }
          approveBtn?.addEventListener('click', () => void submitWithPasskey('approve'));
          denyBtn?.addEventListener('click', () => void submitWithPasskey('deny'));
        </script>`
        : ''
    }`
  );
}

export function renderApprovalResultPage(params: { status: string; message: string; action?: ActionRecord | null }): string {
  return layout(
    'Approval Result',
    `<div class="card"><h1>Approval Result</h1><p>${escapeHtml(params.message)}</p>${
      params.action
        ? `<p><span class="status ${escapeHtml(params.action.status)}">${escapeHtml(params.action.status)}</span> <code>${escapeHtml(params.action.id)}</code></p>`
        : ''
    }<p><a href="/admin">Open Admin Dashboard</a> · <a href="/dev/emails">Open Email Outbox</a></p></div>`
  );
}

export function renderAdminPage(data: Record<string, unknown>): string {
  const actions = (data.recent_actions as Array<Record<string, unknown>>) ?? [];
  const emails = (data.emails as Array<Record<string, unknown>>) ?? [];
  const agents = (data.agents as Array<Record<string, unknown>>) ?? [];
  const users = (data.end_users as Array<Record<string, unknown>>) ?? [];

  const actionRows = actions
    .map((a) => {
      const details = (a.details as Record<string, unknown>) ?? {};
      return `<tr>
        <td><code>${escapeHtml(String(a.action_id))}</code></td>
        <td><span class="status ${escapeHtml(String(a.status))}">${escapeHtml(String(a.status))}</span></td>
        <td>${escapeHtml(String(a.end_user_id))}</td>
        <td>${escapeHtml(String(details.amount ?? ''))} ${escapeHtml(String(details.currency ?? ''))}</td>
        <td>${escapeHtml(String(details.recipient_name ?? ''))}</td>
        <td>${escapeHtml(String(details.payment_rail ?? ''))}</td>
        <td><a href="/api/dev/actions/${encodeURIComponent(String(a.action_id))}/audit">audit</a></td>
      </tr>`;
    })
    .join('');

  const emailRows = emails
    .map((e) => {
      const mdRaw = String(e.metadata_json ?? '{}');
      const md = safeJsonParse<Record<string, unknown>>(mdRaw, {});
      return `<tr>
        <td><code>${escapeHtml(String(e.id))}</code></td>
        <td>${escapeHtml(String(e.to_email))}</td>
        <td>${escapeHtml(String(e.subject))}</td>
        <td>${md.approve_url ? `<a href="${escapeHtml(String(md.approve_url))}">approval link</a>` : ''}</td>
        <td>${escapeHtml(String(e.created_at))}</td>
      </tr>`;
    })
    .join('');

  return layout(
    'Aegis Admin',
    `
    <div class="grid">
      <div class="card">
        <h1>Aegis Admin Dashboard</h1>
        <p>Prototype internal console for trial ops, debugging, and audit visibility.</p>
        <p class="small">Now: ${escapeHtml(String(data.now ?? ''))}</p>
      </div>
      <div class="grid cols-2">
        <div class="card">
          <h2>Agents (${agents.length})</h2>
          <pre>${escapeHtml(JSON.stringify(agents, null, 2))}</pre>
        </div>
        <div class="card">
          <h2>End Users (${users.length})</h2>
          <pre>${escapeHtml(JSON.stringify(users, null, 2))}</pre>
        </div>
      </div>
      <div class="card">
        <h2>Recent Actions (${actions.length})</h2>
        <table>
          <thead><tr><th>ID</th><th>Status</th><th>User</th><th>Amount</th><th>Recipient</th><th>Rail</th><th>Audit</th></tr></thead>
          <tbody>${actionRows || '<tr><td colspan="7">No actions yet</td></tr>'}</tbody>
        </table>
      </div>
      <div class="card">
        <h2>Email Outbox (${emails.length})</h2>
        <table>
          <thead><tr><th>ID</th><th>To</th><th>Subject</th><th>Link</th><th>Created</th></tr></thead>
          <tbody>${emailRows || '<tr><td colspan="5">No emails</td></tr>'}</tbody>
        </table>
      </div>
    </div>`
  );
}

export function renderEmailOutboxPage(emails: Array<Record<string, unknown>>): string {
  const items = emails
    .map((email) => {
      const md = safeJsonParse<Record<string, unknown>>(String(email.metadata_json ?? '{}'), {});
      const approveUrl = md.approve_url ? `<p><a href="${escapeHtml(String(md.approve_url))}">Open approval link</a></p>` : '';
      return `<div class="card"><h3>${escapeHtml(String(email.subject))}</h3><p><strong>To:</strong> ${escapeHtml(
        String(email.to_email)
      )}</p><pre>${escapeHtml(String(email.body_text ?? ''))}</pre>${approveUrl}<p class="small">${escapeHtml(
        String(email.created_at)
      )}</p></div>`;
    })
    .join('');
  return layout('Dev Email Outbox', `<div class="grid"><div class="card"><h1>Dev Email Outbox</h1><p>Magic link emails are captured here in this MVP prototype.</p></div>${items || '<div class="card">No emails</div>'}</div>`);
}

export function renderPasskeyDevPage(params: {
  users: Array<{ id: string; email: string; display_name: string }>;
  selectedUserId: string;
  passkeys: Array<Record<string, unknown>>;
}): string {
  const options = params.users
    .map(
      (u) =>
        `<option value="${escapeHtml(u.id)}" ${u.id === params.selectedUserId ? 'selected' : ''}>${escapeHtml(u.display_name)} (${escapeHtml(
          u.email
        )})</option>`
    )
    .join('');
  return layout(
    'Dev Passkeys',
    `<div class="grid">
      <div class="card">
        <h1>Dev Passkey Enrollment</h1>
        <p>Enroll and verify a real WebAuthn passkey for a demo user (works on localhost with supported browsers).</p>
        <div class="grid cols-2">
          <label>User
            <select id="userId">${options}</select>
          </label>
          <div class="actions" style="align-items:end">
            <button id="enrollPasskeyBtn" class="primary" type="button">Enroll Passkey</button>
            <button id="authPasskeyBtn" class="ghost" type="button">Test Passkey Auth</button>
          </div>
        </div>
        <p id="passkeyDevStatus" class="small"></p>
      </div>
      <div class="card">
        <h2>Existing Passkeys (${params.passkeys.length})</h2>
        <pre>${escapeHtml(JSON.stringify(params.passkeys, null, 2))}</pre>
      </div>
    </div>
    <script>
      function toBase64URL(bytes) {
        const str = btoa(String.fromCharCode(...new Uint8Array(bytes)));
        return str.replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/g, '');
      }
      function fromBase64URL(input) {
        const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
        const bin = atob(b64);
        return Uint8Array.from(bin, c => c.charCodeAt(0));
      }
      function creationOptionsFromJSON(opts) {
        const out = { ...opts, challenge: fromBase64URL(opts.challenge), user: { ...opts.user, id: fromBase64URL(opts.user.id) } };
        if (Array.isArray(out.excludeCredentials)) out.excludeCredentials = out.excludeCredentials.map(c => ({ ...c, id: fromBase64URL(c.id) }));
        return out;
      }
      function requestOptionsFromJSON(opts) {
        const out = { ...opts, challenge: fromBase64URL(opts.challenge) };
        if (Array.isArray(out.allowCredentials)) out.allowCredentials = out.allowCredentials.map(c => ({ ...c, id: fromBase64URL(c.id) }));
        return out;
      }
      function credentialToJSON(cred) {
        const base = {
          id: cred.id,
          rawId: toBase64URL(cred.rawId),
          type: cred.type,
          authenticatorAttachment: cred.authenticatorAttachment || undefined,
          clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
        };
        if (cred.response.attestationObject) {
          return {
            ...base,
            response: {
              clientDataJSON: toBase64URL(cred.response.clientDataJSON),
              attestationObject: toBase64URL(cred.response.attestationObject),
              transports: cred.response.getTransports ? cred.response.getTransports() : [],
            },
          };
        }
        return {
          ...base,
          response: {
            clientDataJSON: toBase64URL(cred.response.clientDataJSON),
            authenticatorData: toBase64URL(cred.response.authenticatorData),
            signature: toBase64URL(cred.response.signature),
            userHandle: cred.response.userHandle ? toBase64URL(cred.response.userHandle) : undefined,
          },
        };
      }
      async function enroll() {
        const userId = document.getElementById('userId').value;
        const status = document.getElementById('passkeyDevStatus');
        status.textContent = 'Requesting registration options...';
        try {
          const optRes = await fetch('/dev/passkeys/register/options', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user_id: userId }) });
          const optData = await optRes.json();
          if (!optRes.ok) throw new Error(optData.message || optData.error || 'Options failed');
          const cred = await navigator.credentials.create({ publicKey: creationOptionsFromJSON(optData.options) });
          const verifyRes = await fetch('/dev/passkeys/register/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user_id: userId, response: credentialToJSON(cred) }) });
          const verifyData = await verifyRes.json();
          if (!verifyRes.ok) throw new Error(verifyData.message || verifyData.error || 'Verify failed');
          status.textContent = 'Passkey enrolled: ' + (verifyData.credential_id || 'ok');
          setTimeout(() => window.location.reload(), 500);
        } catch (e) {
          status.textContent = e && e.message ? e.message : String(e);
        }
      }
      async function authTest() {
        const userId = document.getElementById('userId').value;
        const status = document.getElementById('passkeyDevStatus');
        status.textContent = 'Requesting auth options...';
        try {
          const optRes = await fetch('/dev/passkeys/auth/options', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user_id: userId }) });
          const optData = await optRes.json();
          if (!optRes.ok) throw new Error(optData.message || optData.error || 'Options failed');
          const assertion = await navigator.credentials.get({ publicKey: requestOptionsFromJSON(optData.options) });
          const verifyRes = await fetch('/dev/passkeys/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user_id: userId, response: credentialToJSON(assertion) }) });
          const verifyData = await verifyRes.json();
          if (!verifyRes.ok) throw new Error(verifyData.message || verifyData.error || 'Verify failed');
          status.textContent = 'Passkey auth verified';
        } catch (e) {
          status.textContent = e && e.message ? e.message : String(e);
        }
      }
      document.getElementById('enrollPasskeyBtn')?.addEventListener('click', () => void enroll());
      document.getElementById('authPasskeyBtn')?.addEventListener('click', () => void authTest());
    </script>`
  );
}
