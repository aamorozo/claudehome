const FUB_BASE = "https://api.followupboss.com/v1";

async function fubFetch(path, apiKey, params = {}) {
  const url = new URL(`${FUB_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Basic ${btoa(apiKey + ":")}`,
      "Content-Type": "application/json",
    },
  });

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "10", 10);
    await new Promise((r) => setTimeout(r, (retryAfter + 2) * 1000));
    return fubFetch(path, apiKey, params);
  }

  if (!res.ok) throw new Error(`FUB ${path} → ${res.status}`);
  return res.json();
}

// Returns all people matching given stages updated within windowDays, paginated
export async function getPeopleByStages(stages, windowDays, apiKey) {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  const sinceStr = since.toISOString().split("T")[0];

  const allPeople = [];

  for (const stage of stages) {
    let offset = 0;
    const limit = 100;

    while (true) {
      const data = await fubFetch("/people", apiKey, {
        stage,
        updatedSince: sinceStr,
        limit,
        offset,
        sort: "updated",
        direction: "desc",
      });

      const people = data.people ?? [];
      allPeople.push(...people);

      if (people.length < limit) break;
      offset += limit;
    }
  }

  return allPeople;
}

// Returns events for a person, filtered to outbound types, sorted desc
export async function getLastOutbound(personId, apiKey) {
  const data = await fubFetch("/events", apiKey, {
    personId,
    limit: 10,
    sort: "created",
    direction: "desc",
  });

  const outboundTypes = new Set(["Call", "Email", "Text", "SMS"]);
  const events = (data.events ?? []).filter(
    (e) => outboundTypes.has(e.type) && e.isOutbound !== false
  );

  return events[0]?.created ?? null;
}

export async function resolveAgentName(userId, apiKey, cache) {
  if (cache.has(userId)) return cache.get(userId);
  const data = await fubFetch(`/users/${userId}`, apiKey);
  const name = data.name ?? data.email ?? userId;
  cache.set(userId, name);
  return name;
}
