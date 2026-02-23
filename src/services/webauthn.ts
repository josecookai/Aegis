import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, RegistrationResponseJSON, AuthenticatorTransportFuture } from '@simplewebauthn/server';
import { AppConfig } from '../config';
import { DomainError } from './aegis';
import { AegisStore } from './store';
import { nowIso } from '../lib/time';

export class WebAuthnService {
  private readonly rpName = 'Aegis MVP';
  private readonly rpID: string;
  private readonly origin: string;

  constructor(private readonly store: AegisStore, config: AppConfig) {
    const url = new URL(config.baseUrl);
    this.rpID = url.hostname;
    this.origin = `${url.protocol}//${url.host}`;
  }

  async generateRegistrationOptionsForUser(userId: string): Promise<any> {
    const user = this.store.getEndUserById(userId);
    if (!user) throw new DomainError('INVALID_END_USER', 'Unknown user', 404);
    const existing = this.store.listPasskeysForUser(userId);
    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpID,
      userName: user.email,
      userDisplayName: user.display_name,
      userID: Buffer.from(user.id, 'utf8'),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      excludeCredentials: existing.map((c) => ({ id: c.credential_id, transports: toTransportList(c.transports) })),
      attestationType: 'none',
    });
    this.store.createWebauthnChallenge({
      userId,
      actionId: null,
      purpose: 'passkey_register',
      challenge: options.challenge,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
    return options;
  }

  async verifyRegistrationForUser(userId: string, response: RegistrationResponseJSON): Promise<{ verified: boolean; credentialId?: string }> {
    const user = this.store.getEndUserById(userId);
    if (!user) throw new DomainError('INVALID_END_USER', 'Unknown user', 404);

    const challenge = this.store.getLatestActiveWebauthnChallenge(userId, 'passkey_register');
    if (!challenge) throw new DomainError('WEBAUTHN_CHALLENGE_MISSING', 'No active registration challenge', 400);

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new DomainError('WEBAUTHN_REGISTRATION_FAILED', 'Passkey registration verification failed', 400);
    }

    const cred = verification.registrationInfo.credential;
    this.store.upsertPasskeyCredential({
      userId,
      credentialId: cred.id,
      publicKeyB64: Buffer.from(cred.publicKey).toString('base64url'),
      counter: cred.counter,
      deviceType: verification.registrationInfo.credentialDeviceType,
      backedUp: verification.registrationInfo.credentialBackedUp,
      transports: cred.transports ?? [],
      aaguid: verification.registrationInfo.aaguid,
      createdAt: nowIso(),
    });
    this.store.consumeWebauthnChallenge(challenge.id);
    return { verified: true, credentialId: cred.id };
  }

  async generateApprovalAuthenticationOptions(rawMagicToken: string): Promise<any> {
    const view = this.store.resolveApprovalMagicLinkContext(rawMagicToken);
    if (!view) throw new DomainError('INVALID_MAGIC_LINK', 'Invalid magic link', 400);
    const creds = this.store.listPasskeysForUser(view.userId);
    if (creds.length === 0) throw new DomainError('PASSKEY_NOT_ENROLLED', 'No passkeys enrolled for this user', 400);

    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      allowCredentials: creds.map((c) => ({ id: c.credential_id, transports: toTransportList(c.transports) })),
      userVerification: 'preferred',
    });
    this.store.createWebauthnChallenge({
      userId: view.userId,
      actionId: view.actionId,
      purpose: 'passkey_approval_auth',
      challenge: options.challenge,
      expiresAt: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
    });
    return options;
  }

  async verifyApprovalAuthentication(rawMagicToken: string, response: AuthenticationResponseJSON): Promise<{ verified: boolean; userId: string }> {
    const view = this.store.resolveApprovalMagicLinkContext(rawMagicToken);
    if (!view) throw new DomainError('INVALID_MAGIC_LINK', 'Invalid magic link', 400);

    const challenge = this.store.getLatestActiveWebauthnChallenge(view.userId, 'passkey_approval_auth', view.actionId);
    if (!challenge) throw new DomainError('WEBAUTHN_CHALLENGE_MISSING', 'No active authentication challenge', 400);

    const cred = this.store.getPasskeyByCredentialId(response.id);
    if (!cred || cred.user_id !== view.userId) {
      throw new DomainError('WEBAUTHN_CREDENTIAL_UNKNOWN', 'Unknown passkey credential', 400);
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
      credential: {
        id: cred.credential_id,
        publicKey: Buffer.from(cred.public_key_b64, 'base64url'),
        counter: cred.counter,
        transports: toTransportList(cred.transports),
      },
      requireUserVerification: true,
    });

    if (!verification.verified) {
      throw new DomainError('WEBAUTHN_AUTH_FAILED', 'Passkey authentication failed', 400);
    }

    this.store.updatePasskeyCounterAndUsage(cred.id, verification.authenticationInfo.newCounter);
    this.store.consumeWebauthnChallenge(challenge.id);
    return { verified: true, userId: view.userId };
  }

  async generateAuthenticationOptionsForUser(userId: string): Promise<any> {
    const user = this.store.getEndUserById(userId);
    if (!user) throw new DomainError('INVALID_END_USER', 'Unknown user', 404);
    const creds = this.store.listPasskeysForUser(userId);
    if (creds.length === 0) throw new DomainError('PASSKEY_NOT_ENROLLED', 'No passkeys enrolled for this user', 400);
    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      allowCredentials: creds.map((c) => ({ id: c.credential_id, transports: toTransportList(c.transports) })),
      userVerification: 'preferred',
    });
    this.store.createWebauthnChallenge({
      userId,
      actionId: null,
      purpose: 'passkey_auth_test',
      challenge: options.challenge,
      expiresAt: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
    });
    return options;
  }

  async verifyAuthenticationForUser(userId: string, response: AuthenticationResponseJSON): Promise<{ verified: boolean }> {
    const challenge = this.store.getLatestActiveWebauthnChallenge(userId, 'passkey_auth_test', null);
    if (!challenge) throw new DomainError('WEBAUTHN_CHALLENGE_MISSING', 'No active auth challenge', 400);
    const cred = this.store.getPasskeyByCredentialId(response.id);
    if (!cred || cred.user_id !== userId) throw new DomainError('WEBAUTHN_CREDENTIAL_UNKNOWN', 'Unknown passkey credential', 400);
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
      credential: {
        id: cred.credential_id,
        publicKey: Buffer.from(cred.public_key_b64, 'base64url'),
        counter: cred.counter,
        transports: toTransportList(cred.transports),
      },
      requireUserVerification: true,
    });
    if (!verification.verified) throw new DomainError('WEBAUTHN_AUTH_FAILED', 'Passkey authentication failed', 400);
    this.store.updatePasskeyCounterAndUsage(cred.id, verification.authenticationInfo.newCounter);
    this.store.consumeWebauthnChallenge(challenge.id);
    return { verified: true };
  }
}

function toTransportList(values: string[] | undefined): AuthenticatorTransportFuture[] | undefined {
  if (!values?.length) return undefined;
  const allowed = new Set<AuthenticatorTransportFuture>(['ble', 'cable', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb']);
  return values.filter((v): v is AuthenticatorTransportFuture => allowed.has(v as AuthenticatorTransportFuture));
}
