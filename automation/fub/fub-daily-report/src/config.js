/**
 * Stage definitions and agent mappings for fub-daily-report.
 *
 * NEW_BUSINESS: leads in active prospecting/contact phases
 * MONEY_LIST:   leads with application/appointment activity — closest to close
 *
 * Update AGENT_MAP with real FUB user IDs after first deploy:
 *   curl -u <API_KEY>: https://api.followupboss.com/v1/users | jq '.users[] | {id, name}'
 */

export const STAGES = {
  NEW_BUSINESS: [
    'New',
    'Active Prospect',
    'Attempting to Contact',
    'Working',
    'Pre-Qualified',
  ],
  MONEY_LIST: [
    'Hot Lead-Responded',
    'Application',
    'Appointments',
    'No Show Appt',
    'Application-Lending Pad',
    'Pending Submission',
    'Referrals To Convert',
  ],
};

// Fallback name map for FUB user IDs not covered by env vars ARRAN_USER_ID / KERI_USER_ID.
// Add entries as: { [fubUserId]: 'Display Name' }
export const AGENT_MAP = {
  // Example: 12345: 'Arran', 67890: 'Keri'
};
