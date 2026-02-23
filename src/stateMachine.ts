import { ActionStatus, TERMINAL_STATUSES } from './types';

const ALLOWED_TRANSITIONS: Record<ActionStatus, ActionStatus[]> = {
  received: ['validation_failed', 'awaiting_approval'],
  validation_failed: [],
  awaiting_approval: ['approved', 'denied', 'expired', 'canceled'],
  approved: ['executing'],
  denied: [],
  expired: [],
  executing: ['succeeded', 'failed'],
  succeeded: [],
  failed: [],
  canceled: [],
};

export function canTransition(from: ActionStatus, to: ActionStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: ActionStatus, to: ActionStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid action status transition: ${from} -> ${to}`);
  }
}

export function isTerminalStatus(status: ActionStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}
