/** Display dates only. Authorization still comes exclusively from the billing service. */
export function billingPresentation(account: {
 trial_exempt?: boolean; can_write?: boolean; trial_ends_at?: string | null;
 billing_current_period_end?: string | null; billing_cancel_at_period_end?: boolean;
}, now = Date.now()) {
 const paid = Date.parse(account.billing_current_period_end || '');
 const trial = Date.parse(account.trial_ends_at || '');
 const hasPaidDate = Number.isFinite(paid), hasTrialDate = Number.isFinite(trial);
 const end = account.trial_exempt ? null : hasPaidDate ? paid : hasTrialDate ? trial : null;
 return {
  end, paid: hasPaidDate, ended: end !== null && end <= now,
  trialEnded: !account.trial_exempt && hasTrialDate && trial <= now,
  renewal: account.trial_exempt || !account.billing_cancel_at_period_end ? null
    : account.can_write && hasPaidDate && paid > now ? 'through-period' : 'cancelled',
 } as const;
}
