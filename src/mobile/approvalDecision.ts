export type AppDecisionSource = 'app_biometric' | 'web_magic_link';

export function determineApproveDecisionSource(params: { hasHardware: boolean; supportedCount: number; authSuccess?: boolean }): { proceed: boolean; source?: AppDecisionSource; reason?: string } {
  if (!params.hasHardware || params.supportedCount <= 0) {
    return { proceed: false, reason: 'Biometric authentication is unavailable on this device' };
  }
  if (!params.authSuccess) {
    return { proceed: false, reason: 'Biometric authentication was canceled or failed' };
  }
  return { proceed: true, source: 'app_biometric' };
}

export function determineDenyDecisionSource(): AppDecisionSource {
  return 'web_magic_link';
}
