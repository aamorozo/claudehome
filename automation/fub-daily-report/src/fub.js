export class FUBClient {
  constructor(apiKey) {
    this.baseUrl = 'https://api.followupboss.com/v1';
    this.auth = 'Basic ' + btoa(apiKey + ':');
  }

  async request(path, params = {}) {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
    const res = await fetch(url, {
      headers: { Authorization: this.auth, 'Content-Type': 'application/json' },
    });
    if (res.status === 429) {
      const retry = res.headers.get('Retry-After') || '60';
      throw new Error(`FUB 429: Rate limited. Retry-After: ${retry}s`);
    }
    if (res.status === 401) throw new Error('FUB 401: Invalid API key — check FUB_API_KEY secret');
    if (!res.ok) throw new Error(`FUB ${res.status} on ${path}: ${await res.text().catch(() => '')}`);
    return res.json();
  }

  // Fetch all people in a given stage updated after `since` (YYYY-MM-DD).
  // Paginates automatically up to 500 leads per stage.
  async getPeopleByStage(stage, since) {
    const results = [];
    let offset = 0;
    while (results.length < 500) {
      const data = await this.request('/people', {
        stage,
        sort: '-lastActivityAt',
        limit: 100,
        offset,
        updatedAfter: since,
      });
      const page = data.people || [];
      results.push(...page);
      if (page.length < 100 || results.length >= (data.total ?? 0)) break;
      offset += 100;
    }
    return results;
  }

  // Verify the API key is valid. Throws on failure.
  async healthCheck() {
    return this.request('/identity');
  }
}
