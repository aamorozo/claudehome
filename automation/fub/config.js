/**
 * FUB configuration — stage mappings, user IDs, thresholds
 * Update ARRAN_USER_ID and KERI_USER_ID from FUB Admin > Team Members
 */

export const ARRAN_USER_ID = '1';   // Replace with actual FUB user ID
export const KERI_USER_ID  = '2';   // Replace with actual FUB user ID

// Days since last update to include a lead in the report
export const LOOKBACK_DAYS = 10;

// Days since last outbound contact before flagging stale (🚨)
export const STALE_DAYS = 5;

// Stage groups posted as separate sections in the hit-list
export const STAGE_GROUPS = {
  'New Business': [
    'New',
    'Attempted Contact',
    'Contacted',
    'Nurture',
  ],
  'Money List': [
    'Hot Lead-Responded',       // Smart List: Hot List
    'Application',              // Smart List: FUB Apps
    'Appointments',             // Smart List: FUB Apps
    'No Show Appt',             // Smart List: FUB Apps
    'Application-Lending Pad',  // Smart List: FUB Apps
    'Pending Submission',       // Smart List: FUB Apps
    'Referrals To Convert',     // Smart List: FUB Apps
  ],
};

// Smart List → Stage cross-reference (for documentation / future webhook use)
export const SMART_LIST_MAP = {
  'Hot List':  ['Hot Lead-Responded'],
  'FUB Apps':  ['Application', 'Appointments', 'No Show Appt', 'Application-Lending Pad', 'Pending Submission', 'Referrals To Convert'],
};

// Lead routing — which assignedUserId owns inbound vs referral leads
export const ROUTING = {
  inbound:   ARRAN_USER_ID,
  referral:  KERI_USER_ID,
};
