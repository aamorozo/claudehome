const FUB_BASE = 'https://api.followupboss.com/v1';
const MAX_RETRIES = 3;

export class FUBClient {
  constructor(apiKey) {
    this.auth = 'Basic ' + btoa(apiKey + ':');
  }

  async _fetch(path, params = {}) {
    const url = new URL(FUB_BASE + path);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    }

    let delay = 2000;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const res = await fetch(url.toString(), {
        headers: { Authorization: this.auth, 'Content-Type': 'application/json' },
      });

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10);
        await sleep((retryAfter * 1000) + 500);
        continue;
      }

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`FUB ${res.status} on ${path}: ${body}`);
      }

      return res.json();
    }
    throw new Error(`FUB max retries exceeded for ${path}`);
  }

  // Fetch all people in a given stage, sorted by updatedAt desc, stopping once
  // records fall outside the cutoff window. Skips unassigned leads.
  async getPeopleByStage(stage, cutoffDate) {
    const results = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const data = await this._fetch('/people', {
        stage,
        sort: 'updated',
        sortDirection: 'desc',
        limit,
        offset,
      });

      const people = data.people || [];
      if (people.length === 0) break;

      let reachedCutoff = false;
      for (const p of people) {
        if (!p.assignedTo) continue; // skip unassigned

        const updated = new Date(p.updatedAt || p.updated || 0);
        if (updated < cutoffDate) {
          reachedCutoff = true;
          break;
        }

        results.push(p);
      }

      if (reachedCutoff || people.length < limit) break;
      offset += limit;
    }

    return results;
  }

  // Returns the most recent outbound event date for a person, or null.
  // Outbound = Call, Email, Text/Sms initiated by agent (isIncoming: false or type-based).
  async getLastOutboundDate(personId) {
    const OUTBOUND_TYPES = new Set(['Call', 'Email', 'Text', 'Sms', 'Message']);

    const data = await this._fetch('/events', {
      personId,
      sort: 'created',
      sortDirection: 'desc',
      limit: 25,
    });

    const events = data.events || [];
    for (const ev of events) {
      const type = ev.type || '';
      // Skip purely inbound events
      if (ev.isIncoming === true) continue;
      if (OUTBOUND_TYPES.has(type)) {
        return new Date(ev.createdAt || ev.created);
      }
    }
    return null;
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
