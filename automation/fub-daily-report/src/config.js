// FUB pipeline stages included in each daily report section
export const STAGES = {
  NEW_BUSINESS: ["New Business"],
  MONEY_LIST: [
    "Hot Lead-Responded",
    "Application",
    "Appointments",
    "No Show Appt",
    "Application-Lending Pad",
    "Pending Submission",
  ],
};

// Smart List → stage grouping labels (for context, not used in API queries)
export const SMART_LIST_MAP = {
  "Hot List": "Hot Lead-Responded",
  "FUB Apps": [
    "Application",
    "Appointments",
    "No Show Appt",
    "Application-Lending Pad",
    "Pending Submission",
  ],
  "Referrals To Convert": "Referrals To Convert",
};

// FUB user IDs — update these from GET /v1/users
export const AGENTS = {
  arran: { id: "ARRAN_USER_ID", name: "Arran" },
  keri: { id: "KERI_USER_ID", name: "Keri" },
};

// Routing: new internet leads → Keri; referrals + high-value → Arran
export const ROUTING_RULES = [
  { source: "internet", assignTo: "keri" },
  { source: "referral", assignTo: "arran" },
  { source: "zillow", assignTo: "keri" },
  { source: "realtor", assignTo: "keri" },
  { source: "past client", assignTo: "arran" },
  { source: "repeat", assignTo: "arran" },
];

// Report window: leads updated within this many days are included
export const REPORT_WINDOW_DAYS = 10;

// Stale threshold: flag with 🚨 if no outbound contact in this many days
export const STALE_DAYS = 5;

// Slack channel for daily hit-list
export const SLACK_CHANNEL = "#fub-dashboard";
