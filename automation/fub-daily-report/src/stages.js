/**
 * FUB Stage → Smart List mappings
 * Source of truth for pipeline stage configuration
 */

export const SMART_LIST_STAGES = {
  "Hot List": ["Hot Lead-Responded"],
  "FUB Apps": [
    "Application",
    "Appointments",
    "No Show Appt",
    "Application-Lending Pad",
    "Pending Submission",
    "Referrals To Convert",
  ],
};

export const DAILY_REPORT_SECTIONS = {
  "New Business": [
    "New",
    "Attempted Contact",
    "Active Buyer",
    "Active Seller",
  ],
  "Money List": [
    "Hot Lead-Responded",
    "Application",
    "Appointments",
    "No Show Appt",
    "Application-Lending Pad",
    "Pending Submission",
    "Referrals To Convert",
  ],
};

// All stages tracked by the report (flattened)
export const ALL_REPORT_STAGES = [
  ...new Set(Object.values(DAILY_REPORT_SECTIONS).flat()),
];
