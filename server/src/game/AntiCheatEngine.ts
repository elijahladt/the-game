import {
  FocusPenaltyTier,
  FocusViolationConfig,
  PlayerFocusStatus,
} from '@quickfire/shared';

export const DEFAULT_FOCUS_CONFIG: FocusViolationConfig = {
  firstViolation: 'warning',
  secondViolation: 'lockout',
  secondViolationLockSeconds: 5,
  thirdViolation: 'point_deduction',
  thirdViolationDeduction: 1,
  fourthViolation: 'disqualified',
  debounceMs: 1500, // Debounce window to deduplicate simultaneous blur + visibilitychange
};

export class AntiCheatEngine {
  private config: FocusViolationConfig;

  constructor(config: Partial<FocusViolationConfig> = {}) {
    this.config = { ...DEFAULT_FOCUS_CONFIG, ...config };
  }

  public createInitialPlayerStatus(): PlayerFocusStatus {
    return {
      violationsCount: 0,
      lastViolationTimestamp: 0,
      isLockedOut: false,
      lockedUntil: 0,
      isDisqualified: false,
      penaltyLog: [],
    };
  }

  /**
   * Handle focus loss event from client during an active question.
   * Returns penalty applied, or null if ignored due to debounce.
   */
  public registerFocusLoss(
    status: PlayerFocusStatus,
    eventType: 'blur' | 'visibilitychange',
    timestamp: number = Date.now()
  ): {
    penalty: FocusPenaltyTier;
    violationsCount: number;
    lockedUntil?: number;
    deduction?: number;
    message: string;
  } | null {
    // Check if already disqualified
    if (status.isDisqualified) {
      return null;
    }

    // Debounce check: Deduplicate overlapping blur and visibilitychange
    const timeSinceLast = timestamp - status.lastViolationTimestamp;
    if (status.lastViolationTimestamp > 0 && timeSinceLast < this.config.debounceMs) {
      return null; // Ignore duplicate event within grace period
    }

    status.lastViolationTimestamp = timestamp;
    status.violationsCount += 1;

    let penalty: FocusPenaltyTier = 'none';
    let message = '';
    let deduction = 0;

    switch (status.violationsCount) {
      case 1:
        penalty = 'warning';
        message = 'Tab switch detected! Quickfire requires keeping focus on the game window. Next violation will lock answer submission.';
        break;

      case 2:
        penalty = 'lockout';
        status.isLockedOut = true;
        status.lockedUntil = timestamp + this.config.secondViolationLockSeconds * 1000;
        message = `Second violation! Answer submission locked for ${this.config.secondViolationLockSeconds} seconds.`;
        break;

      case 3:
        penalty = 'point_deduction';
        deduction = this.config.thirdViolationDeduction;
        message = 'Third violation! Deducted 1 point. One more violation will result in disqualification.';
        break;

      default:
        penalty = 'disqualified';
        status.isDisqualified = true;
        status.isLockedOut = true;
        message = 'Disqualified from this match due to repeated focus loss violations.';
        break;
    }

    status.penaltyLog.push({
      timestamp,
      penalty,
      reason: `${eventType} triggered tier: ${penalty}`,
    });

    return {
      penalty,
      violationsCount: status.violationsCount,
      lockedUntil: status.lockedUntil,
      deduction,
      message,
    };
  }

  /**
   * Check if a player is currently permitted to submit an answer.
   */
  public canSubmitAnswer(status: PlayerFocusStatus, now: number = Date.now()): {
    allowed: boolean;
    reason?: string;
  } {
    if (status.isDisqualified) {
      return { allowed: false, reason: 'You have been disqualified from this match.' };
    }

    if (status.isLockedOut && now < status.lockedUntil) {
      const remainingSec = Math.ceil((status.lockedUntil - now) / 1000);
      return {
        allowed: false,
        reason: `Answer submission locked due to anti-cheat violation. Wait ${remainingSec}s.`,
      };
    }

    // Unlock if lockout duration expired
    if (status.isLockedOut && now >= status.lockedUntil) {
      status.isLockedOut = false;
    }

    return { allowed: true };
  }
}
