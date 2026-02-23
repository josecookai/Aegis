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
    'Aegis',
    `
    <div class="grid" style="gap:20px">
      <section class="card" style="padding:0; overflow:hidden; border-color:#cfd7ea;">
        <div style="padding:12px 18px; border-bottom:1px solid #e4e9f4; background:linear-gradient(180deg,#ffffff,#f8fbff); display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#0052ff,#5fa3ff);"></div>
            <strong style="font-size:15px;">Aegis</strong>
            <span class="small">AI Agent Consumption Authorization Protocol</span>
          </div>
          <div class="actions">
            <a href="/docs/openapi.yaml">API Docs</a>
            <a href="/admin">Demo Console</a>
          </div>
        </div>
        <div style="padding:32px 24px; background:
          radial-gradient(800px 300px at 15% 0%, rgba(0,82,255,.14), transparent 70%),
          radial-gradient(700px 260px at 95% 20%, rgba(63,131,255,.10), transparent 60%),
          linear-gradient(180deg,#fbfdff 0%,#f5f8ff 100%);">
          <div class="grid cols-2" style="align-items:start;">
            <div>
              <div class="badge" style="background:#edf3ff;color:#1d4ed8;border-color:#bfdbfe;">Coinbase-style fintech clarity · Trust-first for agents</div>
              <h1 style="font-size:clamp(34px,5vw,56px); line-height:1.02; margin:14px 0 14px; letter-spacing:-0.02em;">
                Let AI agents buy for you.
                <span style="color:#0052ff;">Only when you approve.</span>
              </h1>
              <p style="font-size:17px; line-height:1.5; max-width:56ch;">
                Aegis is the human authorization layer for the agent economy. Agents request a payment through one API.
                You approve or deny in real time. Raw credentials stay out of the agent stack.
              </p>
              <div class="actions" style="margin-top:16px;">
                <a href="/admin" style="background:#0052ff;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none;">Try Interactive Demo</a>
                <a href="/docs/openapi.yaml" style="background:#eef4ff;color:#0f3a8a;padding:10px 14px;border-radius:10px;text-decoration:none;">OpenAPI Spec</a>
              </div>
              <div class="grid cols-2" style="margin-top:18px;">
                <div class="card" style="padding:12px; background:#fff; border-color:#e4e9f4;">
                  <div class="small">MVP rails</div>
                  <strong>Card + Crypto</strong>
                </div>
                <div class="card" style="padding:12px; background:#fff; border-color:#e4e9f4;">
                  <div class="small">Approval model</div>
                  <strong>Web + Passkey</strong>
                </div>
              </div>
            </div>
            <div>
              <div class="card" style="border-color:#dbe5fb; background:linear-gradient(180deg,#ffffff,#f8fbff);">
                <h3 style="margin-bottom:8px;">Live request flow</h3>
                <table>
                  <tr><th>1</th><td>Agent calls <code>POST /v1/request_action</code></td></tr>
                  <tr><th>2</th><td>Aegis sends approval link / app prompt</td></tr>
                  <tr><th>3</th><td>User approves via Web / Passkey / App biometric</td></tr>
                  <tr><th>4</th><td>Aegis executes on selected payment rail</td></tr>
                  <tr><th>5</th><td>Signed webhook callback returns terminal status</td></tr>
                </table>
                <div class="small" style="margin-top:10px;">Built for agent developers first. Designed to become a consumer-grade trust product.</div>
              </div>
              <div class="card" style="margin-top:14px; border-color:#dbe5fb; background:#fff;">
                <h3 style="margin-bottom:8px;">Design style (benchmark: Coinbase landing)</h3>
                <p style="margin:0;">Aegis uses a clean, high-trust fintech visual language: bright whites, disciplined blue accents, generous spacing, structured cards, and low-noise information hierarchy. The goal is to communicate security and clarity before speed.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="grid cols-2">
        <div class="card">
          <h2>Why Aegis</h2>
          <table>
            <tr><th>Problem</th><td>Agents can automate buying, but users do not want to expose cards, CVVs, or private keys.</td></tr>
            <tr><th>Aegis role</th><td>Acts as an approval and execution proxy so agents request intent, not credentials.</td></tr>
            <tr><th>User control</th><td>Real-time approve/deny for each transaction instead of coarse budgets only.</td></tr>
          </table>
        </div>
        <div class="card">
          <h2>Core value props</h2>
          <div class="grid">
            <div><span class="badge">Universal API</span><p>One agent-facing integration surface across card and crypto rails.</p></div>
            <div><span class="badge">Human-in-the-loop</span><p>Structured requests with clear amount/recipient/description before execution.</p></div>
            <div><span class="badge">Auditability</span><p>Immutable-style audit logs, webhook deliveries, and replay tooling for every action.</p></div>
          </div>
        </div>
      </section>

      <section class="card">
        <h2>How It Works (Developer + User)</h2>
        <div class="grid cols-2">
          <div>
            <h3>For agent developers</h3>
            <ol style="padding-left:18px; margin:0;">
              <li>Register agent and get API key</li>
              <li>Call <code>/v1/request_action</code> with declarative payment intent</li>
              <li>Receive lifecycle webhooks: approved / denied / succeeded / failed</li>
              <li>Use replay and sandbox tools to test edge cases quickly</li>
            </ol>
          </div>
          <div>
            <h3>For end users</h3>
            <ol style="padding-left:18px; margin:0;">
              <li>Connect payment methods (tokenized card / managed crypto rail)</li>
              <li>Open approval request in web or app</li>
              <li>Confirm using passkey or biometric flow</li>
              <li>Track all actions in a transparent audit trail</li>
            </ol>
          </div>
        </div>
      </section>

      <section class="grid cols-2">
        <div class="card">
          <h2>Security posture (MVP)</h2>
          <div class="grid">
            <div><strong>Credential isolation</strong><p>Agents never touch raw credentials.</p></div>
            <div><strong>Webhook signatures</strong><p>HMAC signed callback delivery with retry + replay tooling.</p></div>
            <div><strong>Passkey support</strong><p>Web approval flow supports WebAuthn passkey verification.</p></div>
            <div><strong>Admin protection</strong><p>Dev/admin tooling is protected by login session.</p></div>
          </div>
        </div>
        <div class="card">
          <h2>Try the product locally</h2>
          <p><strong>Seed demo credentials</strong></p>
          <p><code>x-aegis-api-key: aegis_demo_agent_key</code></p>
          <p><code>end_user_id: usr_demo</code></p>
          <p class="small">Card refs: <code>merchant_api:*</code> / <code>payment_link:*</code><br/>Crypto refs: <code>address:0x...</code> / <code>wallet:*</code></p>
          <div class="actions">
            <a href="/dev/sandbox">Sandbox Demos</a>
            <a href="/dev/webhooks">Webhook Replay UI</a>
            <a href="/dev/passkeys">Passkey Enrollment</a>
            <a href="/dev/emails">Email Outbox</a>
            <a href="/healthz">Health</a>
          </div>
        </div>
      </section>

      <section class="card" style="background:linear-gradient(180deg,#0052ff,#0b4fd1); color:#fff; border-color:#0b4fd1;">
        <div class="grid cols-2" style="align-items:center;">
          <div>
            <h2 style="color:#fff; margin-bottom:8px;">Build the trust layer for agent commerce</h2>
            <p style="color:rgba(255,255,255,.86);">Aegis is building the approval protocol between autonomous agents and human money. Start with the MVP console and sandbox tools, then integrate the API.</p>
          </div>
          <div class="actions" style="justify-content:flex-end;">
            <a href="/admin" style="background:#fff;color:#0b4fd1;padding:10px 14px;border-radius:10px;text-decoration:none;">Open Demo Console</a>
            <a href="/docs/openapi.yaml" style="background:rgba(255,255,255,.14);color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none;border:1px solid rgba(255,255,255,.25);">View API Spec</a>
          </div>
        </div>
      </section>
    </div>`
  );
}

export function renderAdminLoginPage(params?: { error?: string; next?: string }): string {
  return layout(
    'Admin Login',
    `<div class="grid" style="max-width:520px;margin:0 auto">
      <div class="card">
        <h1>Aegis Admin Login</h1>
        <p>Access required for admin and dev tooling routes.</p>
        ${params?.error ? `<p style="color:#b42318"><strong>${escapeHtml(params.error)}</strong></p>` : ''}
        <form method="post" action="/login" class="grid">
          <input type="hidden" name="next" value="${escapeHtml(params?.next ?? '/admin')}" />
          <label>Password
            <input type="password" name="password" autocomplete="current-password" required />
          </label>
          <div class="actions">
            <button class="primary" type="submit">Login</button>
            <a href="/">Back</a>
          </div>
          <p class="small">MVP auth: environment password + signed cookie session.</p>
        </form>
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
        <td>
          <a href="/dev/actions/${encodeURIComponent(String(a.action_id))}">audit</a>
          ${
            (a.execution as Record<string, unknown> | null)?.sandbox_injected_fault
              ? `<div class="small" style="color:#b42318">sandbox-injected: ${escapeHtml(
                  String((a.execution as Record<string, unknown>).sandbox_injected_fault)
                )}</div>`
              : ''
          }
        </td>
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
        <div class="actions">
          <a href="/dev/webhooks">Webhook Deliveries UI</a>
          <a href="/dev/sandbox">Sandbox Fault Injection</a>
          <form method="post" action="/logout" style="display:inline">
            <button class="ghost" type="submit">Logout</button>
          </form>
        </div>
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

export function renderWebhookDevPage(params: {
  deliveries: Array<Record<string, unknown>>;
  filters: { action_id?: string; status?: string };
}): string {
  const rows = params.deliveries
    .map((d) => {
      const payload = (d.payload as Record<string, unknown>) ?? {};
      const action = (payload.action as Record<string, unknown>) ?? {};
      return `<tr>
        <td><code>${escapeHtml(String(d.id))}</code></td>
        <td><span class="status ${escapeHtml(String(d.status))}">${escapeHtml(String(d.status))}</span></td>
        <td>${escapeHtml(String(d.event_type))}</td>
        <td><code>${escapeHtml(String(d.action_id))}</code></td>
        <td>${escapeHtml(String(d.attempts ?? 0))}</td>
        <td>${escapeHtml(String(d.http_status ?? ''))}</td>
        <td>${escapeHtml(String(d.last_error ?? ''))}</td>
        <td class="small">${escapeHtml(String(d.next_attempt_at ?? ''))}</td>
        <td>
          <div class="actions">
            <form method="post" action="/dev/webhooks/${encodeURIComponent(String(d.id))}/requeue">
              <button class="ghost" type="submit">Requeue</button>
            </form>
            <details>
              <summary>Payload</summary>
              <pre>${escapeHtml(JSON.stringify({ event_type: d.event_type, action: { id: action.id, status: action.status } }, null, 2))}</pre>
            </details>
          </div>
        </td>
      </tr>`;
    })
    .join('');

  return layout(
    'Dev Webhooks',
    `<div class="grid">
      <div class="card">
        <h1>Dev Webhook Deliveries</h1>
        <p>Inspect webhook delivery attempts and manually requeue failed or dead deliveries.</p>
        <form method="get" action="/dev/webhooks" class="grid cols-2">
          <label>action_id
            <input type="text" name="action_id" value="${escapeHtml(params.filters.action_id ?? '')}" placeholder="act_..." />
          </label>
          <label>status
            <select name="status">
              <option value="" ${!params.filters.status ? 'selected' : ''}>All</option>
              <option value="pending" ${params.filters.status === 'pending' ? 'selected' : ''}>pending</option>
              <option value="delivered" ${params.filters.status === 'delivered' ? 'selected' : ''}>delivered</option>
              <option value="dead" ${params.filters.status === 'dead' ? 'selected' : ''}>dead</option>
              <option value="failed" ${params.filters.status === 'failed' ? 'selected' : ''}>failed</option>
            </select>
          </label>
          <div class="actions">
            <button class="primary" type="submit">Filter</button>
            <a href="/dev/webhooks">Reset</a>
          </div>
        </form>
      </div>
      <div class="card">
        <h2>Deliveries (${params.deliveries.length})</h2>
        <table>
          <thead><tr><th>ID</th><th>Status</th><th>Event</th><th>Action</th><th>Attempts</th><th>HTTP</th><th>Error</th><th>Next Try</th><th>Actions</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="9">No deliveries</td></tr>'}</tbody>
        </table>
      </div>
    </div>`
  );
}

export function renderActionAuditPage(params: {
  action: any;
  auditLogs: Array<Record<string, unknown>>;
}): string {
  const action = params.action;
  const execution = (action.execution as Record<string, unknown> | null) ?? null;
  const details = (action.details as Record<string, unknown> | null) ?? null;
  const rows = params.auditLogs
    .map((log) => `<tr>
      <td>${escapeHtml(String(log.id))}</td>
      <td>${escapeHtml(String(log.created_at))}</td>
      <td>${escapeHtml(String(log.event_type))}</td>
      <td>${escapeHtml(String(log.actor_type))}</td>
      <td><pre>${escapeHtml(String(log.payload_json ?? '{}'))}</pre></td>
    </tr>`)
    .join('');

  return layout(
    'Action Audit',
    `<div class="grid">
      <div class="card">
        <h1>Action Detail & Audit</h1>
        <div class="actions"><a href="/admin">Back to Admin</a><a href="/dev/webhooks?action_id=${encodeURIComponent(String(action.action_id))}">Open Webhooks</a></div>
      </div>
      <div class="card">
        <h2>Action ${escapeHtml(String(action.action_id))}</h2>
        <div class="grid cols-2">
          <div>
            <p><span class="status ${escapeHtml(String(action.status))}">${escapeHtml(String(action.status))}</span></p>
            <p><strong>Amount:</strong> ${escapeHtml(String(details?.amount ?? ''))} ${escapeHtml(String(details?.currency ?? ''))}</p>
            <p><strong>Recipient:</strong> ${escapeHtml(String(details?.recipient_name ?? ''))}</p>
            <p><strong>Rail:</strong> ${escapeHtml(String(details?.payment_rail ?? ''))}</p>
            <p><strong>Description:</strong> ${escapeHtml(String(details?.description ?? ''))}</p>
          </div>
          <div>
            <p><strong>Execution Status:</strong> ${escapeHtml(String(execution?.status ?? 'n/a'))}</p>
            <p><strong>Error Code:</strong> ${escapeHtml(String(execution?.error_code ?? ''))}</p>
            <p><strong>Payment ID:</strong> ${escapeHtml(String(execution?.payment_id ?? ''))}</p>
            <p><strong>Tx Hash:</strong> ${escapeHtml(String(execution?.tx_hash ?? ''))}</p>
            ${
              execution?.sandbox_injected_fault
                ? `<p><strong style="color:#b42318">Sandbox injected failure: ${escapeHtml(String(execution.sandbox_injected_fault))}</strong></p>`
                : ''
            }
          </div>
        </div>
        <h3>Raw Action JSON</h3>
        <pre>${escapeHtml(JSON.stringify(action, null, 2))}</pre>
      </div>
      <div class="card">
        <h2>Audit Logs (${params.auditLogs.length})</h2>
        <table>
          <thead><tr><th>ID</th><th>Time</th><th>Event</th><th>Actor</th><th>Payload</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5">No logs</td></tr>'}</tbody>
        </table>
      </div>
    </div>`
  );
}

export function renderSandboxFaultsPage(params: {
  snapshot: Record<string, any>;
  message?: string;
  recentCallbacks?: Array<Record<string, unknown>>;
}): string {
  const card = params.snapshot.card ?? {};
  const crypto = params.snapshot.crypto ?? {};
  return layout(
    'Dev Sandbox Faults',
    `<div class="grid">
      <div class="card">
        <h1>Sandbox Fault Injection</h1>
        <p>Inject deterministic mock failures/timeouts for the next execution(s).</p>
        ${params.message ? `<p><strong>${escapeHtml(params.message)}</strong></p>` : ''}
        <div class="actions">
          <form method="post" action="/dev/sandbox/reset"><button class="danger" type="submit">Reset All</button></form>
          <form method="post" action="/dev/sandbox/demo"><input type="hidden" name="preset" value="PSP_DECLINE_DEMO"/><button class="primary" type="submit">Run Demo: PSP_DECLINE</button></form>
          <form method="post" action="/dev/sandbox/demo"><input type="hidden" name="preset" value="CHAIN_REVERT_DEMO"/><button class="primary" type="submit">Run Demo: CHAIN_REVERT</button></form>
          <form method="post" action="/dev/sandbox/demo"><input type="hidden" name="preset" value="TIMEOUT_DEMO"/><button class="primary" type="submit">Run Demo: TIMEOUT</button></form>
          <a href="/admin">Back to Admin</a>
        </div>
        <p class="small">One-click demo will apply the preset, create a demo action, force-approve it, run execution, and send callback to local test inbox.</p>
      </div>
      <div class="grid cols-2">
        <div class="card">
          <h2>Card Rail</h2>
          <p>Current: <span class="status">${escapeHtml(String(card.mode ?? 'none'))}</span> scope=${escapeHtml(String(card.scope ?? 'once'))} remaining=${escapeHtml(String(card.remaining ?? 0))}</p>
          <div class="actions">
            <form method="post" action="/dev/sandbox/preset"><input type="hidden" name="preset" value="PSP_DECLINE_DEMO"/><button class="primary" type="submit">Preset: PSP_DECLINE_DEMO</button></form>
            <form method="post" action="/dev/sandbox/set"><input type="hidden" name="rail" value="card"/><input type="hidden" name="mode" value="decline"/><input type="hidden" name="scope" value="once"/><button class="ghost" type="submit">Next Card Decline</button></form>
            <form method="post" action="/dev/sandbox/set"><input type="hidden" name="rail" value="card"/><input type="hidden" name="mode" value="timeout"/><input type="hidden" name="scope" value="once"/><button class="ghost" type="submit">Next Card Timeout</button></form>
            <form method="post" action="/dev/sandbox/set"><input type="hidden" name="rail" value="card"/><input type="hidden" name="mode" value="decline"/><input type="hidden" name="scope" value="sticky"/><button class="ghost" type="submit">Sticky Card Decline</button></form>
            <form method="post" action="/dev/sandbox/set"><input type="hidden" name="rail" value="card"/><input type="hidden" name="mode" value="none"/><input type="hidden" name="scope" value="once"/><button class="ghost" type="submit">Clear Card Fault</button></form>
          </div>
        </div>
        <div class="card">
          <h2>Crypto Rail</h2>
          <p>Current: <span class="status">${escapeHtml(String(crypto.mode ?? 'none'))}</span> scope=${escapeHtml(String(crypto.scope ?? 'once'))} remaining=${escapeHtml(String(crypto.remaining ?? 0))}</p>
          <div class="actions">
            <form method="post" action="/dev/sandbox/preset"><input type="hidden" name="preset" value="CHAIN_REVERT_DEMO"/><button class="primary" type="submit">Preset: CHAIN_REVERT_DEMO</button></form>
            <form method="post" action="/dev/sandbox/preset"><input type="hidden" name="preset" value="TIMEOUT_DEMO"/><button class="primary" type="submit">Preset: TIMEOUT_DEMO</button></form>
            <form method="post" action="/dev/sandbox/set"><input type="hidden" name="rail" value="crypto"/><input type="hidden" name="mode" value="revert"/><input type="hidden" name="scope" value="once"/><button class="ghost" type="submit">Next Crypto Revert</button></form>
            <form method="post" action="/dev/sandbox/set"><input type="hidden" name="rail" value="crypto"/><input type="hidden" name="mode" value="timeout"/><input type="hidden" name="scope" value="once"/><button class="ghost" type="submit">Next Crypto Timeout</button></form>
            <form method="post" action="/dev/sandbox/set"><input type="hidden" name="rail" value="crypto"/><input type="hidden" name="mode" value="revert"/><input type="hidden" name="scope" value="sticky"/><button class="ghost" type="submit">Sticky Crypto Revert</button></form>
            <form method="post" action="/dev/sandbox/set"><input type="hidden" name="rail" value="crypto"/><input type="hidden" name="mode" value="none"/><input type="hidden" name="scope" value="once"/><button class="ghost" type="submit">Clear Crypto Fault</button></form>
          </div>
        </div>
      </div>
      <div class="card">
        <h3>Snapshot</h3>
        <pre>${escapeHtml(JSON.stringify(params.snapshot, null, 2))}</pre>
      </div>
      <div class="card">
        <h3>Recent Callback Inbox (${params.recentCallbacks?.length ?? 0})</h3>
        <pre>${escapeHtml(JSON.stringify(params.recentCallbacks ?? [], null, 2))}</pre>
      </div>
    </div>`
  );
}
