import { AppConfig } from '../config';
import { AegisStore } from './store';

export class NotificationService {
  constructor(private readonly store: AegisStore, private readonly config: AppConfig) {}

  sendLoginMagicLinkEmail(params: { toEmail: string; userName: string; magicToken: string; expiresAt: string }): string {
    const loginUrl = `${this.config.baseUrl}/auth/magic-link/verify?token=${encodeURIComponent(params.magicToken)}`;
    const subject = 'Aegis Login Link';
    const bodyText = [
      `Hi ${params.userName},`,
      '',
      `Click to sign in: ${loginUrl}`,
      `Expires at: ${params.expiresAt}`,
      '',
      'This is a MVP prototype (magic link login).',
    ].join('\n');
    const bodyHtml = `<p>Hi ${escapeHtml(params.userName)},</p><p><a href="${loginUrl}">Sign in to Aegis</a></p><p>Expires at: ${escapeHtml(params.expiresAt)}</p>`;
    return this.store.queueEmail(params.toEmail, subject, bodyText, bodyHtml, {
      type: 'login_magic_link',
      login_url: loginUrl,
      expires_at: params.expiresAt,
    });
  }

  sendApprovalEmail(params: { toEmail: string; userName: string; actionId: string; amount: string; currency: string; recipientName: string; magicToken: string; expiresAt: string }): string {
    const approveUrl = `${this.config.baseUrl}/approve/${encodeURIComponent(params.magicToken)}`;
    const subject = 'Aegis Approval Request';
    const bodyText = [
      `Hi ${params.userName},`,
      '',
      `Your AI agent wants to pay ${params.amount} ${params.currency} to ${params.recipientName}.`,
      `Action ID: ${params.actionId}`,
      `Approve or deny: ${approveUrl}`,
      `Expires at: ${params.expiresAt}`,
      '',
      'This is a MVP prototype email (magic link delivery).',
    ].join('\n');
    const bodyHtml = `<p>Hi ${escapeHtml(params.userName)},</p><p>Your AI agent wants to pay <strong>${escapeHtml(
      params.amount
    )} ${escapeHtml(params.currency)}</strong> to <strong>${escapeHtml(params.recipientName)}</strong>.</p><p><a href="${approveUrl}">Open approval page</a></p><p>Action ID: ${escapeHtml(
      params.actionId
    )}<br/>Expires at: ${escapeHtml(params.expiresAt)}</p><p><em>MVP prototype email (magic link delivery)</em></p>`;

    return this.store.queueEmail(params.toEmail, subject, bodyText, bodyHtml, {
      type: 'approval_request',
      action_id: params.actionId,
      approve_url: approveUrl,
      expires_at: params.expiresAt,
      from: this.config.emailFrom,
    });
  }
}

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}
