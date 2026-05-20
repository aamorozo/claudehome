# Premier LO — Verbatim Templates

Captured 2026-05-20 from Joshua-equivalent Premier LO account (Arran's
own login). Preserve verbatim so any rebuild starts from Arran's actual
good copy, not a blank page.

---

## Email — Subject line

```
{{first_name}} {{last_name}} - West Capital Lending Rate Options
```

Premier LO note: *"Available merge fields: `{{first_name}}`, `{{last_name}}`, `{{full_name}}`, `{{company_name}}`, `{{loan_type}}`, `{{agent_name}}`. Leave blank to use the default."*

---

## Email body — Refinance variant

> ### Your Personalized Loan Options from {{ company_name }}
> {{ agent_name }} — {{ agent_title }} | {{ company_name }}
>
> Hi **{{ first_name }} {{ last_name }}**,
>
> This is **{{ agent_first_name }}** with **{{ company_name }}** at
> **{{ agent_phone_formatted }}**. I know your phone is probably blowing
> up with calls and texts, so I'll get right to the point — I ran the
> numbers and wanted to personally reach out to share a clear, no-pressure
> proposal that could help you save more.
>
> **[Click Here to Apply Now Online]**
>
> ### Loan Comparison Options
>
> Below is your personalized quote with 3 different programs: **Home
> Equity, HELOC, and Refinance** options. The proposal is based on the
> parameters you filled out online. If the image doesn't appear, please
> check your email settings.
>
> {{ quote_image }}
>
> ### What I Offer
>
> | Fast Closings | Wide Access |
> |---|---|
> | We close loans in about **1-2 Weeks** on average for loans that do not require an appraisal. | We shop rates from **100+ wholesale lenders** with a single secure portal — no multiple credit pulls. |
>
> ### Why Work With Us
>
> - {{ agent_years }}+ years in the mortgage industry
> - No deposits required in most cases — we stand behind our offers
> - A+ rating with the Better Business Bureau, 3000+ Google and Zillow reviews
> - We can roll closing costs into the loan — **zero out-of-pocket**
> - Skip 1 or 2 mortgage payments and receive an escrow refund (when applicable)
>
> **Have questions or ready to move forward?**
>
> Call/text: **{{ agent_phone_formatted }}** • Email: **{{ agent_email }}**
>
> **[Click Here to Schedule an Appointment]**

## Email body — Purchase variant

NOT YET CAPTURED. Open Email Editor → Purchase tab → grab the body.

---

## SMS body — Refinance variant

NOT YET CAPTURED. Likely in Sequences page, step 1, SMS channel.

## SMS body — Purchase variant

NOT YET CAPTURED.

---

## Email signature (HTML, current production version)

Source: Settings → Email Signature tab. Imported from Bonzo via "Import
from Bonzo" button. Reproduce as HTML when rebuilding.

> **Arran Amorozo | Vice President**
> Direct: (949)-401-7593
> [aamorozo@westcaplending.com](mailto:aamorozo@westcaplending.com)
> 17911 Von Karman Ave Suite 400 Irvine CA 92614
> NMLS 1491497 | NMLS 1566096
> Website: [www.westcapitallending.com](https://www.westcapitallending.com)
> [Upload Documents Securely]
> [Apply Now]
>
> NOTICE: This e-mail transmission, and any documents, files or previous
> e-mail messages attached to it may contain confidential information that
> is legally privileged. If you are not the intended recipient, or if you
> are not responsible for delivering it to the intended recipient, you
> are hereby notified that any disclosure, copying, distribution or use
> of any of the information contained in or attached to this transmission
> is STRICTLY PROHIBITED. For legal advice, please consult with an
> attorney. For tax advice, please consult with an accountant.
>
> [WCL logo] [A+ BBB Accredited Business] [Presidents Club Top Producer 2020] [Top 20 Mortgage Broker] [Closing Costs Refund]

Headshot: real headshot present in signature (different from the green
"A" placeholder in the Premier LO quote image — see findings).

---

## Merge field inventory

Confirmed used in templates above:

| Field | Source | Notes |
|---|---|---|
| `{{first_name}}` | Lead | Bonzo prospect first name |
| `{{last_name}}` | Lead | Bonzo prospect last name |
| `{{full_name}}` | Lead | Convenience field |
| `{{company_name}}` | User | "West Capital Lending" |
| `{{loan_type}}` | Lead | Refinance / Purchase |
| `{{agent_name}}` | User | "Arran Amorozo" |
| `{{agent_first_name}}` | User | "Arran" |
| `{{agent_title}}` | User | "Vice President" |
| `{{agent_years}}` | User | "10" |
| `{{agent_phone_formatted}}` | User | "(949) 401-7593" |
| `{{agent_email}}` | User | "aamorozo@westcaplending.com" |
| `{{quote_image}}` | Computed | URL to rendered quote PNG, embedded inline in email body |

Premier LO's Email tab "Available merge fields" list only mentions
`{{first_name}}`, `{{last_name}}`, `{{full_name}}`, `{{company_name}}`,
`{{loan_type}}`, `{{agent_name}}` — but the body template actually uses
several more (`agent_first_name`, `agent_title`, `agent_years`,
`agent_phone_formatted`, `agent_email`, `quote_image`). The doc is
incomplete vs. the actual product surface.

---

## Quote image — settings observed

Source: Settings → Settings tab → Quote Image Settings section. These
values populate the rendered PNG embedded inline via `{{quote_image}}`.

| Field | Arran's current value |
|---|---|
| Headshot | Broken — green "A" Google profile placeholder. Requires Help Desk ticket to fix. |
| NMLS | 1491497 |
| Application Link | https://westcaplending.loanzify.io/register/arran-amorozo |
| Figure Application Link (HELOC) | https://heloc.westcapitallending.com/account/heloc/register?referrer=241cbddd-8894-4d6c-8417-b88ee5e9f5db |
| Calendar Link | *(empty — needs filling)* |
| Title | Vice President |
| Name | Arran Amorozo |
| Website | https://westcapitallending.com/team/arran-amorozo |
| Years | 10 |
| Phone Number | (949) 401-7593 |

---

## Loan rates — observed (admin-locked)

Source: Settings → Loan Rates tab. UI shows "Rate preference managed by
administrator." Rates below are current admin global rates as of capture.

### Purchase Rates (3 options shown on quote)

| Option | Rate | Points |
|---|---|---|
| 1 | 6.375 | 0.1 |
| 2 | 5.99 | 1.4 |
| 3 | 5.875 | 2.1 |

### Purchase FHA Rates (used when credit score < 630)

| Option | Rate | Points |
|---|---|---|
| 1 | 5.875 | 0.1 |
| 2 | 5.625 | 1.2 |
| 3 | 5.49 | 1.8 |

### Purchase VA Rates (used for military leads)

| Option | Rate | Points |
|---|---|---|
| 1 | 5.875 | 0.202 |
| 2 | 5.625 | 1.4 |
| 3 | 5.492 | 2.3 |

Conventional (Better/Worse tiers), FHA, VA, HELOC, HELOAN20, HELOAN30 —
ranges referenced in prior chat but not yet screenshotted. Need to scroll
or expand on the Loan Rates page.

---

## Status

- [x] Email subject template
- [x] Email body — Refinance
- [ ] Email body — Purchase
- [ ] SMS body — Refinance
- [ ] SMS body — Purchase
- [x] Email signature
- [x] Merge fields inventory
- [x] Quote image settings
- [x] Purchase / FHA / VA rates
- [ ] Conventional / HELOC / HELOAN rate tiers
- [ ] Sequences page contents (step-by-step copy for each color campaign equivalent)
- [ ] Broadcast Messages content
