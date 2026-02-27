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
<meta name="description" content="Aegis — Human authorization layer for the agent economy. Let AI agents buy for you. Only when you approve." />
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
:root {
  --bg: #fafbfc;
  --fg: #0f172a;
  --muted: #64748b;
  --card: #ffffff;
  --line: #e2e8f0;
  --accent: #0052ff;
  --accent-hover: #0046e0;
  --accent-muted: #eef4ff;
  --danger: #b42318;
  --radius: 12px;
  --radius-lg: 16px;
  --shadow: 0 1px 3px rgba(0,0,0,.06);
  --shadow-lg: 0 4px 24px rgba(0,82,255,.08);
}
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; color: var(--fg); background: var(--bg); line-height: 1.6; }
main { max-width: 1100px; margin: 0 auto; padding: 0 24px 80px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-lg); padding: 24px; box-shadow: var(--shadow); }
.grid { display: grid; gap: 20px; }
.grid.cols-2 { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
h1, h2, h3 { margin: 0 0 12px; font-weight: 600; letter-spacing: -0.02em; }
h1 { font-size: clamp(2rem, 4vw, 3rem); line-height: 1.15; }
h2 { font-size: 1.35rem; }
h3 { font-size: 1.1rem; }
p { margin: 8px 0; color: var(--muted); }
a { color: var(--accent); text-decoration: none; transition: color .15s; }
a:hover { color: var(--accent-hover); }
label { display: block; margin-bottom: 8px; font-weight: 600; }
input, select, textarea, button { font: inherit; }
input, select, textarea { width: 100%; padding: 10px 12px; border-radius: var(--radius); border: 1px solid var(--line); background: white; }
button { border: 0; border-radius: var(--radius); padding: 10px 14px; cursor: pointer; transition: opacity .15s, transform .1s; }
button:hover { opacity: .9; }
button:active { transform: scale(.98); }
button.primary { background: var(--accent); color: white; }
button.danger { background: #fff2f0; color: var(--danger); border: 1px solid #f3c8c2; }
button.ghost { background: var(--accent-muted); color: var(--accent); }
code, pre { font-family: 'SF Mono', ui-monospace, Menlo, monospace; font-size: 13px; }
pre { background: #f8fafc; border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; overflow: auto; line-height: 1.5; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { text-align: left; border-bottom: 1px solid var(--line); padding: 10px 8px; vertical-align: top; }
.status { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 500; border: 1px solid var(--line); background: #fff; }
.status.approved,.status.succeeded { background: #ecfdf3; border-color: #abefc6; color: #067647; }
.status.awaiting_approval { background: #fffaeb; border-color: #fec84b; color: #b54708; }
.status.denied,.status.failed,.status.expired,.status.canceled { background: #fef3f2; border-color: #fecdca; color: #b42318; }
.small { font-size: 13px; color: var(--muted); }
.actions { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
.badge { display: inline-flex; align-items: center; gap: 4px; background: var(--accent-muted); color: #1d4ed8; border-radius: 999px; padding: 5px 10px; font-size: 12px; font-weight: 500; border: 1px solid #bfdbfe; }
.btn { display: inline-flex; align-items: center; justify-content: center; padding: 12px 20px; border-radius: var(--radius); font-weight: 600; font-size: 15px; transition: all .15s; }
.btn-primary { background: var(--accent); color: #fff; border: none; }
.btn-primary:hover { background: var(--accent-hover); color: #fff; box-shadow: var(--shadow-lg); }
.btn-secondary { background: var(--accent-muted); color: var(--accent); border: 1px solid #bfdbfe; }
.btn-secondary:hover { background: #e0edff; color: var(--accent-hover); }
.nav { position: sticky; top: 0; z-index: 50; background: rgba(255,255,255,.9); backdrop-filter: blur(12px); border-bottom: 1px solid var(--line); padding: 12px 24px; margin: 0 -24px 32px; }
.nav-inner { max-width: 1100px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.nav-logo { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 18px; color: var(--fg); }
.nav-logo span { width: 32px; height: 32px; border-radius: 10px; background: linear-gradient(135deg, var(--accent), #5fa3ff); }
.nav-links { display: flex; gap: 8px; align-items: center; }
.nav-links a { padding: 8px 14px; border-radius: var(--radius); font-size: 14px; font-weight: 500; color: var(--muted); }
.nav-links a:hover { color: var(--accent); background: var(--accent-muted); }
@media (max-width: 768px) {
  main { padding: 0 16px 60px; }
  .nav { margin: 0 -16px 24px; padding: 12px 16px; }
  .grid.cols-2 { grid-template-columns: 1fr; }
  .card { padding: 20px; }
  section .grid.cols-2 { gap: 24px; }
}
</style>
</head>
<body>
<main>${body}</main>
</body>
</html>`;
}

export function renderHomePage(): string {
  return layout(
    'Aegis — AI Agent Consumption Authorization',
    `
    <nav class="nav">
      <div class="nav-inner">
        <a href="/" class="nav-logo">
          <span></span>
          Aegis
        </a>
        <div class="nav-links">
          <a href="/dashboard">Dashboard</a>
          <a href="/docs/openapi.yaml">API Docs</a>
          <a href="/admin">Demo Console</a>
          <a href="https://github.com/josecookai/Aegis" target="_blank" rel="noopener">GitHub</a>
        </div>
      </div>
    </nav>

    <div class="grid" style="gap:32px">
      <section class="card" style="padding:0; overflow:hidden; border-color:#c7d7fe; background:linear-gradient(180deg,#f8fbff 0%,#fff 60%);">
        <div style="padding:48px 32px 56px; background:
          radial-gradient(900px 400px at 10% -5%, rgba(0,82,255,.08), transparent 55%),
          radial-gradient(600px 300px at 95% 10%, rgba(95,163,255,.06), transparent 50%);">
          <div class="grid cols-2" style="align-items:center; gap:40px;">
            <div>
              <div class="badge" style="margin-bottom:16px;">Trust-first for agents · Coinbase-style clarity</div>
              <h1 style="margin:0 0 16px;">
                Let AI agents buy for you.
                <span style="color:var(--accent);">Only when you approve.</span>
              </h1>
              <p style="font-size:17px; line-height:1.6; max-width:52ch; margin:0 0 24px 0;">
                Aegis is the human authorization layer for the agent economy. Agents request a payment through one API.
                You approve or deny in real time. Raw credentials stay out of the agent stack.
              </p>
              <div class="actions" style="margin-bottom:28px;">
                <a href="/admin" class="btn btn-primary">Try Interactive Demo</a>
                <a href="/docs/openapi.yaml" class="btn btn-secondary">OpenAPI Spec</a>
              </div>
              <div class="grid cols-2" style="gap:12px;">
                <div class="card" style="padding:14px; background:#fff; border-color:#e2e8f0;">
                  <div class="small" style="margin-bottom:4px;">MVP rails</div>
                  <strong style="font-size:15px;">Card + Crypto</strong>
                </div>
                <div class="card" style="padding:14px; background:#fff; border-color:#e2e8f0;">
                  <div class="small" style="margin-bottom:4px;">Approval model</div>
                  <strong style="font-size:15px;">Web + Passkey</strong>
                </div>
              </div>
            </div>
            <div class="card" style="border-color:#c7d7fe; background:linear-gradient(180deg,#fff,#f8fbff);">
              <h3 style="margin-bottom:12px;">Live request flow</h3>
              <table>
                <tr><th style="width:28px;">1</th><td>Agent calls <code>POST /v1/request_action</code></td></tr>
                <tr><th>2</th><td>Aegis sends approval link / app prompt</td></tr>
                <tr><th>3</th><td>User approves via Web / Passkey / App biometric</td></tr>
                <tr><th>4</th><td>Aegis executes on selected payment rail</td></tr>
                <tr><th>5</th><td>Signed webhook callback returns terminal status</td></tr>
              </table>
              <p class="small" style="margin:12px 0 0;">Built for agent developers first. Designed to become a consumer-grade trust product.</p>
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

      <section class="card" id="integrations">
        <h2>3-Minute Integration Guides (Agent-First)</h2>
        <p>In 2026, developers do not want a 50-page API manual first. They want to know one thing: <strong>“How do I plug this into my agent loop?”</strong> Start here.</p>
        <div class="card" style="border-color:#dbe5fb; background:#f8fbff; margin-bottom:14px;">
          <div class="actions" id="integrationTabs">
            <button class="ghost" type="button" data-tab="manus" style="background:#eaf1ff;">Manus</button>
            <button class="ghost" type="button" data-tab="openclaw">OpenClaw</button>
            <button class="ghost" type="button" data-tab="curl">curl</button>
            <button class="ghost" type="button" data-tab="python">Python SDK</button>
          </div>
          <div class="small" style="margin-top:8px;">Copy-pasteable examples first. Full API docs second.</div>
        </div>
        <div class="grid cols-2">
          <div class="card integration-panel" data-panel="manus" style="border-color:#dbe5fb; background:linear-gradient(180deg,#ffffff,#f8fbff);">
            <div class="badge" style="background:#edf3ff;color:#1d4ed8;border-color:#bfdbfe;">For Manus Developers</div>
            <h3>Build an “Autonomous Payment” Skill</h3>
            <p>Manus excels at sandbox execution. Aegis gives it a safe payment gateway so it can complete a full loop from research to purchase without exposing credentials.</p>
            <p><strong>Step 1: Register an Aegis Skill in <code>SKILL.md</code></strong></p>
            <pre class="copyable"><button type="button" class="ghost copy-btn" data-copy="manus-skill" style="float:right">Copy</button><code id="manus-skill">## Skill: Aegis Payments
**Description**: Allow Manus to buy goods or book services through Aegis in a controlled environment.
**Required API**: \`AEGIS_API_KEY\` (set in Manus Environment Variables)</code></pre>
            <p><strong>Step 2: Add the core tool in your Manus sandbox (Python)</strong></p>
            <pre class="copyable"><button type="button" class="ghost copy-btn" data-copy="manus-python" style="float:right">Copy</button><code id="manus-python">import aegis_pay

gateway = aegis_pay.Client(api_key=\"AEGIS_API_KEY\")

response = gateway.request_payment(
    intent=\"Buy the hardcover edition of 'AI 2026' recommended by A16Z\",
    amount=49.9,
    currency=\"USD\",
    merchant=\"Amazon\"
)

print(response.message)  # WAITING_FOR_AUTH: Check phone / watch</code></pre>
            <p><strong>Step 3: Manus closes the loop automatically</strong></p>
            <p class="small">When Aegis returns a waiting state, Manus prompts the user to approve. Once approved on phone/watch, Manus resumes and finalizes the order.</p>
          </div>

          <div class="card integration-panel" data-panel="openclaw" style="border-color:#dbe5fb; background:#fff;">
            <div class="badge" style="background:#edf7ff;color:#075985;border-color:#bae6fd;">For OpenClaw Developers</div>
            <h3>Add a “Financial Control” Tool</h3>
            <p>OpenClaw (ex-Moltbot) focuses on local control and multi-channel automation. Aegis lets your Telegram/Slack bot pay safely while keys remain in Aegis’ secured execution boundary.</p>
            <p><strong>Step 1: Configure <code>~/.openclaw/tools.json</code></strong></p>
            <pre class="copyable"><button type="button" class="ghost copy-btn" data-copy="openclaw-tool" style="float:right">Copy</button><code id="openclaw-tool">{
  \"name\": \"aegis_secure_pay\",
  \"description\": \"Pay via Aegis with ETH/SOL or card rails\",
  \"parameters\": {
    \"type\": \"object\",
    \"properties\": {
      \"asset\": { \"type\": \"string\", \"enum\": [\"USDT\", \"SOL\", \"VISA\"] },
      \"amount\": { \"type\": \"number\" }
    }
  }
}</code></pre>
            <p><strong>Step 2: Define policy-as-code</strong></p>
            <pre class="copyable"><button type="button" class="ghost copy-btn" data-copy="openclaw-policy" style="float:right">Copy</button><code id="openclaw-policy">Allow OpenClaw to pay up to $20/month for github.com subscriptions.
Anything above requires approval on Apple Watch or phone.</code></pre>
            <p><strong>Step 3: Real-time operator interaction</strong></p>
            <pre class="copyable"><button type="button" class="ghost copy-btn" data-copy="openclaw-dialog" style="float:right">Copy</button><code id="openclaw-dialog">User: \"OpenClaw, renew next month's Copilot.\"
OpenClaw: \"Requesting $10 via Aegis. Please confirm on your watch or phone.\"
User: (double-clicks watch)
OpenClaw: \"Payment succeeded. Subscription renewed.\"</code></pre>
          </div>

          <div class="card integration-panel" data-panel="curl" style="display:none; border-color:#dbe5fb; background:#fff;">
            <div class="badge" style="background:#eefaf4;color:#166534;border-color:#bbf7d0;">Quickstart via curl</div>
            <h3>Request a Payment in 1 Call</h3>
            <p>Use this in any agent framework before building a custom SDK wrapper.</p>
            <pre class="copyable"><button type="button" class="ghost copy-btn" data-copy="curl-request" style="float:right">Copy</button><code id="curl-request">curl -s https://api.aegis.com/v1/request_action \\
  -H 'Content-Type: application/json' \\
  -H 'X-Aegis-API-Key: $AEGIS_API_KEY' \\
  -d '{
    \"idempotency_key\": \"agent-run-001\",
    \"end_user_id\": \"usr_demo\",
    \"action_type\": \"payment\",
    \"callback_url\": \"https://agent.example.com/aegis/callback\",
    \"details\": {
      \"amount\": \"49.90\",
      \"currency\": \"USD\",
      \"recipient_name\": \"Amazon\",
      \"description\": \"AI 2026 hardcover\",
      \"payment_rail\": \"card\",
      \"payment_method_preference\": \"card_default\",
      \"recipient_reference\": \"merchant_api:amazon\"
    }
  }'</code></pre>
            <p class="small">Your agent should treat the returned approval URL / callback lifecycle as the continuation point in the workflow.</p>
          </div>

          <div class="card integration-panel" data-panel="python" style="display:none; border-color:#dbe5fb; background:#fff;">
            <div class="badge" style="background:#f4f0ff;color:#6d28d9;border-color:#ddd6fe;">Python SDK Wrapper Pattern</div>
            <h3>Wrap Aegis into Your Agent Runtime</h3>
            <p>Minimal client abstraction for tool-calling frameworks.</p>
            <pre class="copyable"><button type="button" class="ghost copy-btn" data-copy="python-sdk" style="float:right">Copy</button><code id="python-sdk">class AegisTool:\n    def __init__(self, api_key, base_url=\"https://api.aegis.com\"):\n        self.api_key = api_key\n        self.base_url = base_url\n\n    def request_payment(self, payload):\n        import requests\n        r = requests.post(\n            f\"{self.base_url}/v1/request_action\",\n            headers={\"X-Aegis-API-Key\": self.api_key},\n            json=payload,\n            timeout=20,\n        )\n        r.raise_for_status()\n        return r.json()\n\n# In your agent tool graph:\n# 1) call request_payment\n# 2) surface approval request to user\n# 3) resume on webhook callback</code></pre>
          </div>
        </div>
        <script>
          (() => {
            const tabRoot = document.getElementById('integrationTabs');
            if (!tabRoot) return;
            const tabs = Array.from(tabRoot.querySelectorAll('[data-tab]'));
            const panels = Array.from(document.querySelectorAll('.integration-panel'));
            const setTab = (name) => {
              tabs.forEach(btn => {
                const active = btn.getAttribute('data-tab') === name;
                btn.style.background = active ? '#eaf1ff' : '';
                btn.style.borderColor = active ? '#bfdbfe' : '';
              });
              panels.forEach(panel => {
                panel.style.display = panel.getAttribute('data-panel') === name ? '' : 'none';
              });
            };
            tabs.forEach(btn => btn.addEventListener('click', () => setTab(btn.getAttribute('data-tab'))));
            setTab('manus');

            document.querySelectorAll('.copy-btn').forEach(btn => {
              btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-copy');
                const node = id ? document.getElementById(id) : null;
                if (!node) return;
                const text = node.textContent || '';
                try {
                  await navigator.clipboard.writeText(text);
                  const old = btn.textContent;
                  btn.textContent = 'Copied';
                  setTimeout(() => { btn.textContent = old; }, 900);
                } catch {}
              });
            });
          })();
        </script>
      </section>

      <section class="card">
        <h2>Developer-first integration</h2>
        <p>Copy-paste examples above. One API surface. Clear approval flow. Your agent waits for human auth, then resumes on webhook callback.</p>
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
          <p class="small">Card refs: <code>merchant_api:*</code> / <code>payment_link:*</code> · Crypto: <code>address:0x...</code> / <code>wallet:*</code></p>
          <div class="actions" style="margin-top:16px;">
            <a href="/dev/sandbox" class="btn btn-secondary" style="padding:10px 16px; font-size:14px;">Sandbox Demos</a>
            <a href="/dev/add-card" class="btn btn-secondary" style="padding:10px 16px; font-size:14px;">添加信用卡</a>
            <a href="/dev/webhooks" class="btn btn-secondary" style="padding:10px 16px; font-size:14px;">Webhook Replay</a>
            <a href="/dev/passkeys" class="btn btn-secondary" style="padding:10px 16px; font-size:14px;">Passkey Enrollment</a>
            <a href="/dev/emails" class="btn btn-secondary" style="padding:10px 16px; font-size:14px;">Email Outbox</a>
            <a href="/healthz" class="btn btn-secondary" style="padding:10px 16px; font-size:14px;">Health</a>
          </div>
        </div>
      </section>

      <section class="card" style="background:linear-gradient(135deg,#0052ff 0%,#0b4fd1 100%); color:#fff; border:none; padding:40px 32px;">
        <div class="grid cols-2" style="align-items:center; gap:32px;">
          <div>
            <h2 style="color:#fff; margin-bottom:12px; font-size:1.5rem;">Build the trust layer for agent commerce</h2>
            <p style="color:rgba(255,255,255,.9); margin:0; font-size:16px;">Aegis is the approval protocol between autonomous agents and human money. Start with the MVP console, then integrate the API.</p>
          </div>
          <div class="actions" style="justify-content:flex-end;">
            <a href="/admin" class="btn" style="background:#fff;color:#0b4fd1;">Open Demo Console</a>
            <a href="/docs/openapi.yaml" class="btn" style="background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.3);">View API Spec</a>
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
          <a href="/dev/add-card">添加信用卡</a>
          <a href="/admin/team-history">团队历史（只读）</a>
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

export function renderTeamHistoryAdminPage(params: { defaultUserId?: string }): string {
  const defaultUserId = params.defaultUserId?.trim() || 'usr_demo';
  return layout(
    'Admin Team History (Read-only)',
    `
    <div class="grid">
      <div class="card">
        <h1>团队历史（管理员只读）</h1>
        <p>通过 <code>GET /api/app/admin/history</code> 查看团队 action 历史。该页面不提供审批按钮。</p>
        <form id="teamHistoryForm" class="actions" style="margin-top:12px;">
          <div style="min-width:260px; flex:1;">
            <label for="userId">管理员 user_id</label>
            <input id="userId" name="user_id" value="${escapeHtml(defaultUserId)}" placeholder="例如 usr_admin_demo" />
          </div>
          <div style="min-width:120px;">
            <label for="limit">limit</label>
            <input id="limit" name="limit" type="number" min="1" max="200" value="50" />
          </div>
          <div style="padding-top:30px;">
            <button class="primary" type="submit">加载历史</button>
          </div>
          <div style="padding-top:30px;">
            <a href="/admin">返回 Admin</a>
          </div>
        </form>
      </div>

      <div class="card">
        <div class="actions" style="justify-content:space-between;">
          <div>
            <h2 style="margin-bottom:4px;">结果</h2>
            <p class="small" id="summary">未加载</p>
          </div>
          <span class="badge">Read-only</span>
        </div>
        <p id="errorBox" style="display:none; color: var(--danger); background:#fff2f0; border:1px solid #f3c8c2; border-radius:12px; padding:10px 12px;"></p>
        <div style="overflow:auto;">
          <table>
            <thead>
              <tr>
                <th>action_id</th>
                <th>requested_by_user_id</th>
                <th>Amount</th>
                <th>Recipient</th>
                <th>Status</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody id="rows">
              <tr><td colspan="6" class="small">请先输入管理员 user_id 并加载</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <script>
      (function () {
        const form = document.getElementById('teamHistoryForm');
        const userIdEl = document.getElementById('userId');
        const limitEl = document.getElementById('limit');
        const rowsEl = document.getElementById('rows');
        const summaryEl = document.getElementById('summary');
        const errorBox = document.getElementById('errorBox');

        function esc(v) {
          return String(v ?? '').replace(/[&<>\"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;' }[c] || c));
        }

        function showError(msg) {
          errorBox.style.display = 'block';
          errorBox.textContent = msg;
        }

        function clearError() {
          errorBox.style.display = 'none';
          errorBox.textContent = '';
        }

        async function loadHistory() {
          const userId = (userIdEl.value || '').trim();
          const limit = Math.max(1, Math.min(200, Number(limitEl.value) || 50));
          if (!userId) {
            showError('请输入管理员 user_id');
            return;
          }
          clearError();
          summaryEl.textContent = '加载中...';
          rowsEl.innerHTML = '<tr><td colspan="6" class="small">Loading...</td></tr>';
          try {
            const url = '/api/app/admin/history?user_id=' + encodeURIComponent(userId) + '&limit=' + encodeURIComponent(String(limit));
            const res = await fetch(url);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              const msg = data.message || data.error || data.code || ('HTTP ' + res.status);
              showError(String(msg));
              summaryEl.textContent = '加载失败（可能不是管理员或 user_id 无效）';
              rowsEl.innerHTML = '<tr><td colspan="6" class="small">无数据</td></tr>';
              return;
            }
            const items = Array.isArray(data.items) ? data.items : [];
            const teamId = data.team_id ? String(data.team_id) : '-';
            summaryEl.textContent = 'team_id=' + teamId + ' · total=' + String(data.total ?? items.length) + ' · 当前返回=' + items.length;
            if (!items.length) {
              rowsEl.innerHTML = '<tr><td colspan="6" class="small">暂无历史记录</td></tr>';
              return;
            }
            rowsEl.innerHTML = items.map((item) => {
              const details = item && typeof item.details === 'object' ? item.details : {};
              const amount = esc((details && details.amount) || '');
              const currency = esc((details && details.currency) || '');
              const recipient = esc((details && details.recipient_name) || '');
              const status = esc(item.status || '');
              return '<tr>'
                + '<td><code>' + esc(item.action_id || '') + '</code></td>'
                + '<td>' + esc(item.requested_by_user_id || '') + '</td>'
                + '<td>' + amount + ' ' + currency + '</td>'
                + '<td>' + recipient + '</td>'
                + '<td><span class="status ' + status + '">' + status + '</span></td>'
                + '<td>' + esc(item.created_at || '') + '</td>'
                + '</tr>';
            }).join('');
          } catch (err) {
            showError(err && err.message ? err.message : String(err));
            summaryEl.textContent = '请求异常';
            rowsEl.innerHTML = '<tr><td colspan="6" class="small">请求异常</td></tr>';
          }
        }

        form.addEventListener('submit', function (e) {
          e.preventDefault();
          void loadHistory();
          const q = new URLSearchParams(window.location.search);
          q.set('user_id', String(userIdEl.value || '').trim());
          q.set('limit', String(Math.max(1, Math.min(200, Number(limitEl.value) || 50))));
          history.replaceState(null, '', '/admin/team-history?' + q.toString());
        });

        if ((userIdEl.value || '').trim()) void loadHistory();
      })();
    </script>
    `
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

export interface PaymentMethodDisplay {
  id: string;
  alias: string;
  is_default: boolean;
  created_at: string;
}

export function renderDashboardPage(params: {
  userId: string;
  userDisplay?: string;
  planLabel?: string;
  agents: Array<{ id: string; name: string; status: string }>;
  paymentMethodsCount?: number;
  showUserSwitcher?: boolean;
  precheckCode?: string;
}): string {
  const plan = params.planLabel ?? 'Demo';
  const agentsRows = params.agents
    .map(
      (a) =>
        `<tr><td>${escapeHtml(a.name)}</td><td><code>${escapeHtml(a.id)}</code></td><td><span class="status ${a.status}">${escapeHtml(a.status)}</span></td></tr>`
    )
    .join('');
  const pmCount = params.paymentMethodsCount ?? 0;
  const precheckCode = String(params.precheckCode ?? '').trim().toUpperCase();
  const precheckMap: Record<string, { title: string; detail: string; next: string }> = {
    NO_DEFAULT_PAYMENT_METHOD: {
      title: '无默认支付方式',
      detail: '当前账户没有可用默认卡，无法继续支付。',
      next: '下一步：前往“支付方式”添加并设为默认卡后重试。',
    },
    LIMIT_EXCEEDED_SINGLE: {
      title: '超出单笔限额',
      detail: '本次支付金额超过当前策略允许的单笔上限。',
      next: '下一步：降低金额后重试，或联系团队管理员调整限额策略。',
    },
    LIMIT_EXCEEDED_DAILY: {
      title: '超出日累计限额',
      detail: '当日累计支付金额已达上限。',
      next: '下一步：次日重试，或联系团队管理员调整日限额。',
    },
    RECIPIENT_NOT_ALLOWED: {
      title: '收款方不在 allowlist',
      detail: '当前收款方未在允许名单中，系统已拦截本次请求。',
      next: '下一步：改用已在 allowlist 的收款方，或联系团队管理员加白。',
    },
  };
  const activePrecheck = precheckMap[precheckCode];
  return layout(
    'Dashboard — Aegis',
    `
    <nav class="nav">
      <div class="nav-inner">
        <a href="/" class="nav-logo"><span></span>Aegis</a>
        <div class="nav-links">
          <a href="/dashboard">Dashboard</a>
          <a href="/settings/payment-methods">支付方式</a>
          <a href="/settings/api-keys">API Keys</a>
          <a href="/admin">Admin</a>
        </div>
      </div>
    </nav>
    <div class="grid" style="gap:24px">
      <div class="card">
        <h1>Dashboard</h1>
        <p class="muted">当前用户与概览</p>
        ${
          params.showUserSwitcher
            ? `<form method="get" action="/dashboard" style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:16px;">
                 <label for="user_id">user_id</label>
                 <input id="user_id" name="user_id" value="${escapeHtml(params.userId)}" placeholder="usr_demo" />
                 <button type="submit" class="btn btn-secondary">切换用户</button>
               </form>
               <p class="small">当前为联调回退模式（仅内部测试）。优先建议使用登录态 session。</p>`
            : ''
        }
        <div class="grid cols-2" style="gap:16px;">
          <div class="card" style="padding:16px; background:var(--accent-muted); border-color:#bfdbfe;">
            <div class="small">当前用户</div>
            <strong style="font-size:18px;">${escapeHtml(params.userDisplay ?? params.userId)}</strong>
          </div>
          <div class="card" style="padding:16px; background:#f8fafc; border-color:var(--line);">
            <div class="small">计划</div>
            <strong style="font-size:18px;">${escapeHtml(plan)}</strong>
          </div>
          <div class="card" style="padding:16px; background:#f8fafc; border-color:var(--line);">
            <div class="small">已绑定支付方式</div>
            <strong style="font-size:18px;">${pmCount} 张卡</strong>
          </div>
        </div>
      </div>
      <div class="card">
        <h2>支付前检查失败恢复（Phase 1 占位）</h2>
        <p class="small muted">用于展示 pre-check 失败原因与下一步引导。当前版本为最小可用提示层。</p>
        ${
          activePrecheck
            ? `<div class="card" style="padding:12px; background:#fff7ed; border-color:#fdba74;">
                 <strong>${escapeHtml(activePrecheck.title)}</strong>
                 <p class="small" style="margin:8px 0 4px;">${escapeHtml(activePrecheck.detail)}</p>
                 <p class="small">${escapeHtml(activePrecheck.next)}</p>
               </div>`
            : '<p class="small">可通过 query 参数 <code>precheck_code</code> 预览失败态（例如 <code>NO_DEFAULT_PAYMENT_METHOD</code>）。</p>'
        }
        <ul class="small muted">
          <li><code>NO_DEFAULT_PAYMENT_METHOD</code>：去支付方式页补齐默认卡。</li>
          <li><code>LIMIT_EXCEEDED_SINGLE</code>/<code>LIMIT_EXCEEDED_DAILY</code>：调整金额或联系管理员调限额。</li>
          <li><code>RECIPIENT_NOT_ALLOWED</code>：改用 allowlist 收款方或联系管理员加白。</li>
        </ul>
        <p><a href="/settings/payment-methods" class="btn btn-secondary">去管理支付方式</a></p>
      </div>
      <div class="card">
        <h2>已关联 Agent</h2>
        <p class="small muted">可代表您发起支付请求的 Agent 列表</p>
        ${agentsRows ? `<table><thead><tr><th>名称</th><th>ID</th><th>状态</th></tr></thead><tbody>${agentsRows}</tbody></table>` : '<p class="muted">暂无关联 Agent</p>'}
      </div>
      <div class="actions">
        <a href="/settings/payment-methods" class="btn btn-primary">管理支付方式</a>
        <a href="/settings/api-keys" class="btn btn-secondary">API Key 管理</a>
      </div>
    </div>`
  );
}

export function renderApiKeysPage(params: {
  userId: string;
  agents: Array<{ id: string; name: string; status: string; displayKey?: string }>;
  showUserSwitcher?: boolean;
}): string {
  const demoKey = params.agents.find((a) => a.id === 'agt_demo')?.displayKey ?? 'aegis_demo_agent_key';
  const agentsRows = params.agents
    .map(
      (a) => {
        const keyDisplay = a.displayKey ?? a.id + ' (key hidden)';
        const copyBtn = a.displayKey ? `<button type="button" class="ghost copy-btn" data-copy="${escapeHtml(a.displayKey)}">复制</button>` : '-';
        return `<tr>
          <td>${escapeHtml(a.name)}</td>
          <td><code>${escapeHtml(keyDisplay)}</code></td>
          <td><span class="status ${a.status}">${escapeHtml(a.status)}</span></td>
          <td>${copyBtn}</td>
        </tr>`;
      }
    )
    .join('');
  return layout(
    'API Key 管理 — Aegis',
    `
    <nav class="nav">
      <div class="nav-inner">
        <a href="/" class="nav-logo"><span></span>Aegis</a>
        <div class="nav-links">
          <a href="/dashboard">Dashboard</a>
          <a href="/settings/payment-methods">支付方式</a>
          <a href="/settings/api-keys">API Keys</a>
        </div>
      </div>
    </nav>
    <div class="grid" style="gap:24px">
      <div class="card">
        <h1>API Key 管理</h1>
        <p class="muted">用于 Agent 调用 Aegis API 的密钥。Demo 环境展示示例 key。</p>
        ${
          params.showUserSwitcher
            ? `<form method="get" action="/settings/api-keys" style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                 <label for="user_id">user_id</label>
                 <input id="user_id" name="user_id" value="${escapeHtml(params.userId)}" placeholder="usr_demo" />
                 <button type="submit" class="btn btn-secondary">切换用户</button>
               </form>
               <p class="small">当前为联调模式（query 参数切换用户）。</p>`
            : ''
        }
      </div>
      <div class="card">
        <h2>已注册 Agent</h2>
        ${agentsRows ? `<table><thead><tr><th>名称</th><th>API Key</th><th>状态</th><th>操作</th></tr></thead><tbody>${agentsRows}</tbody></table>` : '<p class="muted">暂无 Agent</p>'}
        <p class="small muted" style="margin-top:12px;">生成新 Key 需后端支持，当前 Demo 使用 <code>${escapeHtml(demoKey)}</code>。</p>
      </div>
      <p><a href="/dashboard">← 返回 Dashboard</a></p>
    </div>
    <script>
    document.querySelectorAll('.copy-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const key = btn.dataset.copy;
        if (key && navigator.clipboard) {
          navigator.clipboard.writeText(key).then(function() { btn.textContent = '已复制'; });
        }
      });
    });
    </script>`
  );
}

export function renderAddCardPage(params: {
  publishableKey: string | null;
  baseUrl: string;
  userId: string;
  users: Array<{ id: string; email: string; display_name: string }>;
  paymentMethods: PaymentMethodDisplay[];
}): string {
  const stripeConfigured = Boolean(params.publishableKey);
  const apiBase = params.baseUrl.replace(/\/$/, '');

  const addFormHtml = stripeConfigured
    ? `
    <div class="card">
      <h2>添加信用卡</h2>
      <p class="small">卡号、有效期、CVC 经 Stripe 令牌化，不经过 Aegis 服务器。测试卡：4242 4242 4242 4242</p>
      <form id="add-card-form">
        <div id="card-element" style="padding:12px; border:1px solid var(--line); border-radius:var(--radius); background:#fff; margin-bottom:16px;"></div>
        <div id="card-errors" style="color:var(--danger); font-size:14px; margin-bottom:12px;"></div>
        <button type="submit" class="btn btn-primary" id="submit-btn">保存卡片</button>
      </form>
    </div>`
    : `
    <div class="card">
      <h2>添加信用卡</h2>
      <p>请配置 <code>STRIPE_SECRET_KEY</code> 和 <code>STRIPE_PUBLISHABLE_KEY</code> 环境变量以启用添加卡片功能。</p>
      <p class="small">从 <a href="https://dashboard.stripe.com/test/apikeys" target="_blank" rel="noopener">Stripe Dashboard</a> 获取测试密钥。</p>
    </div>`;

  const cardsHtml =
    params.paymentMethods.length > 0
      ? `
    <div class="card">
      <h2>已添加的卡片</h2>
      <table>
        <thead><tr><th>卡片</th><th>默认</th><th>操作</th></tr></thead>
        <tbody>
          ${params.paymentMethods
            .map(
              (pm) => `
          <tr>
            <td>${escapeHtml(pm.alias)}</td>
            <td>${pm.is_default ? '<span class="badge">默认</span>' : '-'}</td>
            <td class="actions">
              ${!pm.is_default ? `<button type="button" class="ghost set-default-btn" data-id="${escapeHtml(pm.id)}">设默认</button>` : ''}
              <button type="button" class="danger delete-btn" data-id="${escapeHtml(pm.id)}">删除</button>
            </td>
          </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>`
      : `
    <div class="card">
      <h2>已添加的卡片</h2>
      <p class="muted">暂无卡片。使用上方表单添加。</p>
    </div>`;

  const cardHandlersScript =
    params.paymentMethods.length > 0
      ? `
<script>
(function() {
  const apiBase = ${JSON.stringify(apiBase)};
  const userId = ${JSON.stringify(params.userId)};
  document.querySelectorAll('.delete-btn').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      if (!confirm('确定删除此卡片？')) return;
      const id = btn.dataset.id;
      const res = await fetch(apiBase + '/api/dev/payment-methods/' + id + '?user_id=' + encodeURIComponent(userId), { method: 'DELETE' });
      if (res.ok) window.location.reload();
      else alert(((await res.json()).message) || '删除失败');
    });
  });
  document.querySelectorAll('.set-default-btn').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      const id = btn.dataset.id;
      const res = await fetch(apiBase + '/api/dev/payment-methods/' + id + '/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });
      if (res.ok) window.location.reload();
      else alert(((await res.json()).message) || '设置失败');
    });
  });
})();
</script>`
      : '';

  const stripeScript = stripeConfigured
    ? `
<script src="https://js.stripe.com/v3/"></script>
<script>
(function() {
  const stripe = Stripe(${JSON.stringify(params.publishableKey)});
  const elements = stripe.elements();
  const cardElement = elements.create('card', {
    style: { base: { fontSize: '16px', color: '#32325d' }, invalid: { color: '#fa755a' } }
  });
  cardElement.mount('#card-element');
  cardElement.on('change', function(e) {
    document.getElementById('card-errors').textContent = e.error ? e.error.message : '';
  });

  document.getElementById('add-card-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = '处理中…';
    const { error, paymentMethod } = await stripe.createPaymentMethod({ type: 'card', card: cardElement });
    if (error) {
      document.getElementById('card-errors').textContent = error.message || '创建支付方式失败';
      btn.disabled = false;
      btn.textContent = '保存卡片';
      return;
    }
    try {
      const res = await fetch('${apiBase}/api/dev/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_method_id: paymentMethod.id, user_id: '${escapeHtml(params.userId)}' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || '保存失败');
      window.location.reload();
    } catch (err) {
      document.getElementById('card-errors').textContent = err.message || '保存失败';
      btn.disabled = false;
      btn.textContent = '保存卡片';
    }
  });
})();
</script>`
    : '';

  const allScripts = stripeScript + cardHandlersScript;

  return layout(
    '添加支付方式 — Aegis',
    `
    <nav class="nav">
      <div class="nav-inner">
        <a href="/" class="nav-logo"><span></span>Aegis</a>
        <div class="nav-links">
          <a href="/admin">Demo Console</a>
          <a href="/dev/sandbox">Sandbox</a>
        </div>
      </div>
    </nav>
    <div class="grid" style="gap:24px">
      <div class="card">
        <h1>添加支付方式</h1>
        <p class="muted">使用 Stripe Elements 安全收集卡信息，卡号与 CVV 不经过 Aegis 服务器。</p>
        <form method="get" action="/dev/add-card" style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
          <label>用户</label>
          <select name="user_id" onchange="this.form.submit()">
            ${params.users.map((u) => `<option value="${escapeHtml(u.id)}" ${u.id === params.userId ? 'selected' : ''}>${escapeHtml(u.display_name || u.email)} (${escapeHtml(u.id)})</option>`).join('')}
          </select>
        </form>
      </div>
      ${addFormHtml}
      ${cardsHtml}
      <p><a href="/admin">← 返回 Admin</a></p>
    </div>
    ${allScripts}
  `
  );
}

export function renderMemberPaymentMethodsPage(params: {
  publishableKey: string | null;
  baseUrl: string;
  userId: string;
  sessionMode?: boolean;
}): string {
  const stripeConfigured = Boolean(params.publishableKey);
  const apiBase = params.baseUrl.replace(/\/$/, '');

  const cardsHtml = `
    <div class="card">
      <h2>已保存的信用卡</h2>
      <div id="cards-list"><p class="muted">加载中...</p></div>
    </div>`;

  const addFormHtml = stripeConfigured
    ? `
    <div class="card">
      <h2>添加信用卡</h2>
      <p class="small">使用 Stripe Elements 安全收集卡信息（测试卡可用：4242 4242 4242 4242）。</p>
      <form id="member-card-form">
        <div id="card-element" style="padding:12px; border:1px solid var(--line); border-radius:var(--radius); background:#fff; margin-bottom:16px;"></div>
        <div id="card-errors" style="color:var(--danger); font-size:14px; margin-bottom:12px;"></div>
        <button type="submit" class="btn btn-primary" id="submit-btn">保存卡片</button>
      </form>
    </div>`
    : `
    <div class="card">
      <h2>添加信用卡</h2>
      <p>请先配置 <code>STRIPE_SECRET_KEY</code> 和 <code>STRIPE_PUBLISHABLE_KEY</code>。</p>
      <p class="small" id="card-errors" style="color:var(--danger)"></p>
    </div>`;

  return layout(
    '支付方式管理 — Aegis',
    `
    <nav class="nav">
      <div class="nav-inner">
        <a href="/" class="nav-logo"><span></span>Aegis</a>
        <div class="nav-links">
          <a href="/settings/payment-methods">支付方式</a>
          <a href="/dev/add-card">Dev Add Card</a>
        </div>
      </div>
    </nav>
    <div class="grid" style="gap:24px">
      <div class="card">
        <h1>成员信用卡管理</h1>
        <p class="muted">默认使用当前登录态（app session）识别成员；仍兼容 <code>?user_id=</code> 供内部联调。</p>
        <form method="get" action="/settings/payment-methods" style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
          <label for="user_id">user_id（可选）</label>
          <input id="user_id" name="user_id" value="${escapeHtml(params.sessionMode ? '' : params.userId)}" placeholder="留空则使用当前登录态" />
          <button type="submit" class="btn btn-secondary">刷新</button>
        </form>
        <p class="small">当前用户：<code>${escapeHtml(params.userId)}</code>${params.sessionMode ? '（来自登录态）' : '（来自 query 参数）'}</p>
        <p class="small muted">仍依赖 <code>?user_id=</code> 回退的页面：<code>/dashboard</code>、<code>/settings/payment-methods</code>、<code>/settings/api-keys</code>（仅内部联调）。</p>
        <div class="card" style="padding:12px; background:#fff7ed; border-color:#fdba74;">
          <strong>支付前检查失败恢复（占位）</strong>
          <ul class="small muted">
            <li><code>NO_DEFAULT_PAYMENT_METHOD</code>：在本页添加并设置默认卡。</li>
            <li><code>LIMIT_EXCEEDED_SINGLE</code>/<code>LIMIT_EXCEEDED_DAILY</code>：降低金额或联系管理员调整限额。</li>
            <li><code>RECIPIENT_NOT_ALLOWED</code>：更换收款方或联系管理员加入 allowlist。</li>
          </ul>
          <p id="precheck-hint" class="small" style="margin:0;"></p>
        </div>
        <p id="global-status" class="small muted" aria-live="polite"></p>
        <p><a href="/dashboard">← 返回 Dashboard</a> · <a href="/">返回首页</a></p>
      </div>
      ${addFormHtml}
      <div id="cards-container">${cardsHtml}</div>
    </div>
    ${stripeConfigured ? `<script src="https://js.stripe.com/v3/"></script>` : ''}
    <script>
    (function() {
      const apiBase = ${JSON.stringify(apiBase)};
      const userId = ${JSON.stringify(params.userId)};
      const sessionMode = ${JSON.stringify(Boolean(params.sessionMode))};
      function withUserId(url) {
        if (sessionMode) return url;
        return url + (url.includes('?') ? '&' : '?') + 'user_id=' + encodeURIComponent(userId);
      }
      const stripePk = ${JSON.stringify(params.publishableKey)};
      const statusEl = document.getElementById('global-status');
      const errorEl = document.getElementById('card-errors');
      const submitBtn = document.getElementById('submit-btn');
      const precheckHintEl = document.getElementById('precheck-hint');

      const errorCodeMap = {
        PAYMENT_METHOD_NOT_FOUND: '卡片不存在或不属于当前用户，请刷新后重试。',
        STRIPE_NOT_CONFIGURED: 'Stripe 未配置，暂时无法添加卡片。请联系管理员。',
        CARD_ALREADY_SAVED: '该卡已绑定到其他账户，请更换卡片。',
        NO_DEFAULT_PAYMENT_METHOD: '无默认支付方式。请先添加并设置默认卡。',
        LIMIT_EXCEEDED_SINGLE: '已超过单笔限额。请降低金额后重试。',
        LIMIT_EXCEEDED_DAILY: '已超过日累计限额。可次日重试或联系管理员。',
        RECIPIENT_NOT_ALLOWED: '收款方不在 allowlist。请更换收款方或联系管理员。'
      };

      function setStatus(msg, kind) {
        if (!statusEl) return;
        statusEl.textContent = msg || '';
        statusEl.style.color = kind === 'error' ? 'var(--danger)' : '';
      }
      function setError(msg) {
        if (errorEl) errorEl.textContent = msg || '';
      }
      function setPrecheckHint(codeOrMessage) {
        if (!precheckHintEl) return;
        const key = String(codeOrMessage || '').trim().toUpperCase();
        if (errorCodeMap[key]) {
          precheckHintEl.textContent = '恢复建议：' + errorCodeMap[key];
          return;
        }
        precheckHintEl.textContent = '';
      }
      async function parseError(res, fallback) {
        try {
          const data = await res.json();
          const code = String(data.error || '').trim();
          return (code && errorCodeMap[code]) ? (errorCodeMap[code] + (data.message ? '（' + data.message + '）' : '')) : (data.message || code || fallback);
        } catch {
          return fallback;
        }
      }
      function refreshPage() {
        window.location.href = sessionMode ? '/settings/payment-methods' : ('/settings/payment-methods?user_id=' + encodeURIComponent(userId));
      }

      const cardsListEl = document.getElementById('cards-list');

      function maskCard(pm) {
        const brand = pm.brand || 'card';
        const last4 = pm.last4 || '****';
        return brand + ' **** ' + last4;
      }

      async function loadCards() {
        if (!cardsListEl) return;
        setStatus('加载卡片中...');
        try {
          const res = await fetch(withUserId(apiBase + '/api/app/payment-methods'));
          if (!res.ok) throw new Error(await parseError(res, '加载卡片失败'));
          const data = await res.json();
          const methods = Array.isArray(data.payment_methods) ? data.payment_methods : [];
          if (!methods.length) {
            cardsListEl.innerHTML = '<p class="muted">暂无卡片。</p>';
            setStatus('暂无卡片');
            return;
          }
          cardsListEl.innerHTML =
            '<table><thead><tr><th>卡片</th><th>默认</th><th>操作</th></tr></thead><tbody>' +
            methods.map(function(pm) {
              const defaultBadge = pm.is_default ? '<span class="badge">默认</span>' : '-';
              const defaultBtn = pm.is_default ? '' : '<button type="button" class="ghost set-default-btn" data-id="' + pm.payment_method_id + '">设默认</button>';
              return '<tr><td>' + maskCard(pm) + '</td><td>' + defaultBadge + '</td><td class="actions">' + defaultBtn + '<button type="button" class="danger delete-btn" data-id="' + pm.payment_method_id + '">删除</button></td></tr>';
            }).join('') +
            '</tbody></table>';
          bindCardActions();
          setStatus('卡片列表已更新', 'success');
        } catch (err) {
          cardsListEl.innerHTML = '<p style="color:var(--danger)">' + ((err && err.message) || '加载卡片失败') + '</p>';
          setStatus('加载失败', 'error');
          setPrecheckHint(err && err.message);
        }
      }

      function bindCardActions() {
        document.querySelectorAll('.delete-btn').forEach(function(btn) {
          btn.addEventListener('click', async function() {
          const id = btn.dataset.id;
          if (!id || !confirm('确定删除此卡片？')) return;
          btn.disabled = true;
          setStatus('删除中...');
          try {
            const res = await fetch(withUserId(apiBase + '/api/app/payment-methods/' + id), { method: 'DELETE' });
            if (!res.ok) throw new Error(await parseError(res, '删除失败'));
            await loadCards();
            setStatus('删除成功');
          } catch (err) {
            setStatus((err && err.message) || '删除失败', 'error');
            setPrecheckHint(err && err.message);
            btn.disabled = false;
          }
        });
        });

        document.querySelectorAll('.set-default-btn').forEach(function(btn) {
          btn.addEventListener('click', async function() {
          const id = btn.dataset.id;
          if (!id) return;
          btn.disabled = true;
          setStatus('设置默认卡中...');
          try {
            const res = await fetch(withUserId(apiBase + '/api/app/payment-methods/' + id + '/default'), { method: 'POST' });
            if (!res.ok) throw new Error(await parseError(res, '设置失败'));
            await loadCards();
            setStatus('默认卡已更新');
          } catch (err) {
            setStatus((err && err.message) || '设置失败', 'error');
            setPrecheckHint(err && err.message);
            btn.disabled = false;
          }
        });
        });
      }

      loadCards();

      if (!stripePk || !window.Stripe) return;
      const stripe = window.Stripe(stripePk);
      const elements = stripe.elements();
      const cardElement = elements.create('card', {
        style: { base: { fontSize: '16px', color: '#32325d' }, invalid: { color: '#fa755a' } }
      });
      cardElement.mount('#card-element');
      cardElement.on('change', function(e) {
        setError(e.error ? e.error.message : '');
      });

      const form = document.getElementById('member-card-form');
      if (!form) return;
      form.addEventListener('submit', async function(e) {
        e.preventDefault();
        setError('');
        setStatus('添加卡片中...');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = '处理中...';
        }
        const result = await stripe.createPaymentMethod({ type: 'card', card: cardElement });
        if (result.error || !result.paymentMethod) {
          setStatus('');
          setError((result.error && result.error.message) || '创建支付方式失败');
          setPrecheckHint(result.error && result.error.message);
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '保存卡片';
          }
          return;
        }
        try {
          const res = await fetch(withUserId(apiBase + '/api/app/payment-methods'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payment_method_id: result.paymentMethod.id })
          });
          if (!res.ok) throw new Error(await parseError(res, '保存失败'));
          await loadCards();
          setStatus('添加成功');
          cardElement.clear();
        } catch (err) {
          setStatus((err && err.message) || '保存失败', 'error');
          setError((err && err.message) || '保存失败');
          setPrecheckHint(err && err.message);
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '保存卡片';
          }
        }
      });
      setPrecheckHint(new URLSearchParams(window.location.search).get('precheck_code'));
    })();
    </script>
  `
  );
}

export function renderEndUserAuthPage(params: {
  mode: 'signin' | 'signup';
  nextPath: string;
  errorCode?: string;
  user: { id: string; email: string; display_name: string } | null;
  providers: { googleEnabled: boolean; githubEnabled: boolean };
}): string {
  const isSignup = params.mode === 'signup';
  const title = isSignup ? 'Create your account' : 'Welcome back';
  const subtitle = isSignup ? 'Please fill in details to get started.' : 'Sign in to continue.';
  const errorMap: Record<string, string> = {
    INVALID_CREDENTIALS: 'Invalid email or password.',
    EMAIL_ALREADY_REGISTERED: 'This email is already registered.',
    WEAK_PASSWORD: 'Password must be at least 8 characters.',
    INVALID_EMAIL: 'Please enter a valid email address.',
    OAUTH_PROVIDER_NOT_ENABLED: 'This sign-in provider is not enabled.',
    OAUTH_INVALID_STATE: 'Login session expired. Please try again.',
    OAUTH_STATE_EXPIRED: 'Login session expired. Please try again.',
    OAUTH_TOKEN_EXCHANGE_FAILED: 'Failed to sign in with OAuth provider.',
    OAUTH_PROFILE_FETCH_FAILED: 'Failed to load account profile from provider.',
    OAUTH_EMAIL_REQUIRED: 'Provider did not return an email address.',
    INACTIVE_USER: 'This account is inactive.',
  };
  const errorMessage = params.errorCode ? errorMap[params.errorCode] ?? `Error: ${params.errorCode}` : '';

  if (params.user) {
    return layout(
      'Aegis Account',
      `
      <div class="grid" style="max-width:680px; margin:32px auto;">
        <div class="card">
          <h1>Signed in</h1>
          <p>${escapeHtml(params.user.display_name)} (${escapeHtml(params.user.email)})</p>
          <p class="small">user_id: <code>${escapeHtml(params.user.id)}</code></p>
          <div class="actions" style="margin-top:16px;">
            <a class="btn btn-secondary" href="/dashboard?user_id=${encodeURIComponent(params.user.id)}">Go to Dashboard</a>
            <a class="btn btn-secondary" href="/settings/payment-methods?user_id=${encodeURIComponent(params.user.id)}">Payment Methods</a>
            <form method="post" action="/auth/logout" style="display:inline;">
              <button class="btn btn-primary" type="submit" style="border:none;">Logout</button>
            </form>
          </div>
        </div>
      </div>`
    );
  }

  const oauthBtn = (provider: 'github' | 'google', enabled: boolean) => {
    const label = provider === 'github' ? 'GitHub' : 'Google';
    const icon = provider === 'github' ? 'GitHub' : 'Google';
    const href = `/auth/oauth/${provider}/start?next=${encodeURIComponent(params.nextPath)}`;
    return enabled
      ? `<a href="${href}" class="ghost" style="display:flex;align-items:center;justify-content:center;height:44px;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--fg);font-weight:600;">${icon}</a>`
      : `<button type="button" disabled title="${label} not configured" style="display:flex;align-items:center;justify-content:center;height:44px;border:1px solid var(--line);border-radius:12px;background:#f8fafc;color:#94a3b8;font-weight:600;cursor:not-allowed;">${icon}</button>`;
  };

  return layout(
    isSignup ? 'Create Account' : 'Sign In',
    `
    <div class="grid" style="max-width:420px; margin:24px auto;">
      <div class="card" style="padding:28px 24px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
          <div>
            <h2 style="font-size:1.8rem; margin-bottom:6px;">${escapeHtml(title)}</h2>
            <p>${escapeHtml(subtitle)}</p>
          </div>
          <a href="/" class="small" aria-label="Close">✕</a>
        </div>

        ${errorMessage ? `<p style="margin:12px 0 0; color:var(--danger); background:#fff2f0; border:1px solid #f3c8c2; border-radius:10px; padding:10px 12px;">${escapeHtml(errorMessage)}</p>` : ''}

        <div class="grid" style="grid-template-columns: repeat(3, 1fr); gap:10px; margin-top:18px;">
          ${oauthBtn('github', params.providers.githubEnabled)}
          ${oauthBtn('google', params.providers.googleEnabled)}
          <a href="/auth?mode=${isSignup ? 'signup' : 'signin'}&next=${encodeURIComponent(params.nextPath)}" class="ghost" style="display:flex;align-items:center;justify-content:center;height:44px;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--fg);font-weight:600;">Email</a>
        </div>

        <div style="display:flex; align-items:center; gap:12px; margin:18px 0 14px;">
          <div style="height:1px; background:var(--line); flex:1;"></div>
          <div class="small">or</div>
          <div style="height:1px; background:var(--line); flex:1;"></div>
        </div>

        <form method="post" action="${isSignup ? '/auth/email/register' : '/auth/email/login'}" class="grid" style="gap:12px;">
          <input type="hidden" name="mode" value="${params.mode}" />
          <input type="hidden" name="next" value="${escapeHtml(params.nextPath)}" />
          ${isSignup ? `<div><label for="display_name">Name</label><input id="display_name" name="display_name" placeholder="Enter your name" /></div>` : ''}
          <div>
            <label for="email">Email address</label>
            <input id="email" name="email" type="email" autocomplete="email" required placeholder="Enter your email address" />
          </div>
          <div>
            <label for="password">Password</label>
            <div style="position:relative;">
              <input id="password" name="password" type="password" autocomplete="${isSignup ? 'new-password' : 'current-password'}" required placeholder="Enter your password" style="padding-right:44px;" />
              <button type="button" id="togglePwd" class="ghost" style="position:absolute; right:6px; top:6px; padding:6px 8px;">👁</button>
            </div>
          </div>
          ${isSignup
            ? `<label class="small" style="display:flex; gap:8px; align-items:flex-start; margin:4px 0 0;">
                <input type="checkbox" name="tos" required style="width:auto; margin-top:2px;" />
                <span>I agree to the <a href="#" onclick="return false;">Terms of Service</a> and <a href="#" onclick="return false;">Privacy Policy</a></span>
              </label>`
            : ''}
          <button class="primary" type="submit" style="margin-top:2px;">Continue</button>
        </form>

        ${
          !isSignup
            ? `<div style="margin-top:10px;">
                <button id="forgotPwdBtn" class="ghost" type="button" style="padding:0; background:none;">Forgot password?</button>
                <form id="forgotPwdForm" class="grid" style="display:none; gap:8px; margin-top:10px;">
                  <input id="forgotPwdEmail" type="email" placeholder="Enter your email address" />
                  <button class="ghost" type="submit">Send reset link</button>
                  <p id="forgotPwdMsg" class="small" style="margin:0;"></p>
                </form>
              </div>`
            : ''
        }

        <p class="small" style="margin-top:14px;">
          ${isSignup
            ? `Already have an account? <a href="/auth?mode=signin&next=${encodeURIComponent(params.nextPath)}">Sign in</a>`
            : `Don't have an account? <a href="/auth?mode=signup&next=${encodeURIComponent(params.nextPath)}">Create account</a>`}
        </p>
        <p class="small">Magic-link login is still available for legacy flows.</p>
      </div>
    </div>
    <script>
      (function () {
        const btn = document.getElementById('togglePwd');
        const input = document.getElementById('password');
        btn && btn.addEventListener('click', function () {
          if (!input) return;
          input.type = input.type === 'password' ? 'text' : 'password';
        });
        const forgotBtn = document.getElementById('forgotPwdBtn');
        const forgotForm = document.getElementById('forgotPwdForm');
        const forgotEmail = document.getElementById('forgotPwdEmail');
        const forgotMsg = document.getElementById('forgotPwdMsg');
        forgotBtn && forgotBtn.addEventListener('click', function () {
          if (!forgotForm) return;
          forgotForm.style.display = forgotForm.style.display === 'none' ? 'grid' : 'none';
        });
        forgotForm && forgotForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          if (!forgotEmail) return;
          if (forgotMsg) forgotMsg.textContent = 'Sending...';
          try {
            const res = await fetch('/auth/password-reset/request', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ email: forgotEmail.value || '' }),
            });
            const data = await res.json().catch(function() { return {}; });
            if (forgotMsg) {
              forgotMsg.textContent = data.message || (res.ok ? 'If an account exists, a password reset link was sent.' : 'Request failed');
              forgotMsg.style.color = res.ok ? 'var(--muted)' : 'var(--danger)';
            }
          } catch (err) {
            if (forgotMsg) {
              forgotMsg.textContent = (err && err.message) ? err.message : 'Request failed';
              forgotMsg.style.color = 'var(--danger)';
            }
          }
        });
      })();
    </script>
    `
  );
}

export function renderPasswordResetAuthPage(params: { token?: string; email?: string; error?: string }): string {
  const errorHtml = params.error
    ? `<p style="margin:12px 0 0; color:var(--danger); background:#fff2f0; border:1px solid #f3c8c2; border-radius:10px; padding:10px 12px;">${escapeHtml(params.error)}</p>`
    : '';
  const formHtml = params.token
    ? `<form method="post" action="/auth/password-reset/confirm" class="grid" style="gap:12px; margin-top:14px;">
         <input type="hidden" name="token" value="${escapeHtml(params.token)}" />
         <div>
           <label>Email</label>
           <input type="email" value="${escapeHtml(params.email ?? '')}" disabled />
         </div>
         <div>
           <label for="reset_password">New password</label>
           <input id="reset_password" type="password" name="password" minlength="8" required placeholder="At least 8 characters" />
         </div>
         <button class="primary" type="submit">Reset password</button>
       </form>`
    : `<p class="small" style="margin-top:14px;">Please request a new password reset link from the sign-in page.</p>`;
  return layout(
    'Reset Password',
    `
    <div class="grid" style="max-width:420px; margin:24px auto;">
      <div class="card" style="padding:28px 24px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
          <div>
            <h2 style="font-size:1.8rem; margin-bottom:6px;">Reset password</h2>
            <p>Set a new password for your account.</p>
          </div>
          <a href="/auth?mode=signin" class="small" aria-label="Close">✕</a>
        </div>
        ${errorHtml}
        ${formHtml}
        <p class="small" style="margin-top:14px;"><a href="/auth?mode=signin">Back to sign in</a></p>
      </div>
    </div>
    `
  );
}
