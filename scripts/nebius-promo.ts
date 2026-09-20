#!/usr/bin/env tsx
/**
 * Submit the Nebius promo-code HubSpot form without a browser.
 *
 * The form at https://nebius.com/promo-code is a HubSpot embed (portal
 * 26806167, form 88354744-4a98-4bb6-84d1-44870ed72bce, region eu1, no
 * captcha per its hs_context). This posts the same payload the iframe
 * produces to the public submissions endpoint, so a promo claim is one
 * CLI call instead of a manual form fill.
 *
 * Usage:
 *   pnpm tsx scripts/nebius-promo.ts \
 *     --first-name Ada --last-name Lovelace --email ada@example.dev \
 *     --company Chezy --job-title "ML Engineer" --dry-run
 *
 * Discovery notes: .agents/plans/2026-09-20-nebius-promo-automation.md
 */
import { parseArgs } from "node:util";

const PORTAL_ID = "26806167";
const FORM_ID = "88354744-4a98-4bb6-84d1-44870ed72bce";
const SUBMIT_URL = `https://api-eu1.hsforms.com/submissions/v3/integration/submit/${PORTAL_ID}/${FORM_ID}`;
const PAGE_URI =
  "https://nebius.com/promo-code?utm_promo_event_code=2026-09-19-HackBarna-Barcelona" +
  "&utm_promo_code_type=Token_Factory&utm_promo_activation_code=HackBarna_1909_TF" +
  "&utm_promo_campaign_id=26Q3_FM-DV_TF_TRD_AWR_VA_EMEA_AI-Summit-Barcelona";
const PROCESSING_CONSENT_TEXT =
  "By clicking submit below, you consent to allow Nebius B.V. to store and process the " +
  "personal information submitted above to provide you the content requested.";

// HubSpot subscription type ids, read from the embed's legalConsentOptions.
const SUBSCRIPTION_TYPES = {
  "ai-cloud": { id: 166354038, label: "Nebius AI Cloud" },
  "token-factory": { id: 545262025, label: "Nebius Token Factory" },
  "ai-builders": { id: 2181949154, label: "Nebius for AI Builders" },
} as const;

// The exact option labels of the Job title combobox.
const JOB_TITLES = [
  "Data Analyst",
  "Data Engineer",
  "Data Scientist",
  "ML Engineer",
  "DevOps Specialist / Manager",
  "MLOps Specialist / Manager",
  "Architect",
  "Founder",
  "Product Manager",
  "CTO",
  "CIO",
  "CPO",
  "CEO",
  "Venture Capitalist",
  "Ecosystem partner",
  "Research / professor",
  "Student",
  "Other",
] as const;

// HubSpot's email check rejects RFC-valid placeholder domains.
const BLOCKED_EMAIL_DOMAINS = new Set(["example.com", "example.org", "example.net", "test.com"]);

interface SubmissionField {
  objectTypeId: string;
  name: string;
  value: string;
}

function die(message: string): never {
  console.error(`error: ${message}`);
  process.exit(2);
}

const { values } = parseArgs({
  options: {
    "first-name": { type: "string" },
    "last-name": { type: "string" },
    email: { type: "string" },
    phone: { type: "string" },
    "job-title": { type: "string" },
    company: { type: "string" },
    website: { type: "string" },
    "activation-code": { type: "string", default: "HackBarna_1909_TF" },
    subscribe: { type: "string", default: "token-factory" },
    "utm-event": { type: "string", default: "2026-09-19-HackBarna-Barcelona" },
    "utm-code-type": { type: "string", default: "Token_Factory" },
    "utm-campaign-id": {
      type: "string",
      default: "26Q3_FM-DV_TF_TRD_AWR_VA_EMEA_AI-Summit-Barcelona",
    },
    "page-uri": { type: "string", default: PAGE_URI },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (values.help) {
  console.log(`Submit the Nebius promo-code HubSpot form.

Required: --first-name, --last-name, --email, --company, --job-title
Optional: --phone, --website, --activation-code (default HackBarna_1909_TF),
          --subscribe ai-cloud,token-factory,ai-builders (comma list,
          default token-factory), --utm-event, --utm-code-type,
          --utm-campaign-id, --page-uri
Flags:    --dry-run prints the payload instead of POSTing, -h/--help

Job titles: ${JOB_TITLES.join(", ")}`);
  process.exit(0);
}

const required = ["first-name", "last-name", "email", "company", "job-title"] as const;
for (const name of required) {
  if (!values[name]) die(`missing --${name}`);
}

const email = values.email ?? "";
const emailDomain = email.split("@")[1]?.toLowerCase() ?? "";
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) die(`invalid email "${email}"`);
if (BLOCKED_EMAIL_DOMAINS.has(emailDomain)) {
  die(`email domain "${emailDomain}" is rejected by HubSpot validation`);
}

const jobTitle = values["job-title"] ?? "";
if (!(JOB_TITLES as readonly string[]).includes(jobTitle)) {
  die(`invalid --job-title "${jobTitle}"; expected one of: ${JOB_TITLES.join(", ")}`);
}

const subscriptions = (values.subscribe ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);
for (const name of subscriptions) {
  if (!(name in SUBSCRIPTION_TYPES)) {
    die(`invalid --subscribe "${name}"; expected: ${Object.keys(SUBSCRIPTION_TYPES).join(", ")}`);
  }
}

const fields: SubmissionField[] = [
  { objectTypeId: "0-1", name: "firstname", value: values["first-name"] ?? "" },
  { objectTypeId: "0-1", name: "lastname", value: values["last-name"] ?? "" },
  { objectTypeId: "0-1", name: "email", value: email },
  { objectTypeId: "0-1", name: "job_title_select", value: jobTitle },
  { objectTypeId: "0-1", name: "company", value: values.company ?? "" },
  {
    objectTypeId: "0-1",
    name: "utm_promo_activation_code",
    value: values["activation-code"] ?? "",
  },
  { objectTypeId: "0-1", name: "utm_promo_event_code", value: values["utm-event"] ?? "" },
  { objectTypeId: "0-1", name: "utm_promo_code_type", value: values["utm-code-type"] ?? "" },
  { objectTypeId: "0-1", name: "utm_promo_campaign_id", value: values["utm-campaign-id"] ?? "" },
];
if (values.phone) fields.push({ objectTypeId: "0-1", name: "phone", value: values.phone });
if (values.website) fields.push({ objectTypeId: "0-1", name: "website", value: values.website });

const body = {
  submittedAt: Date.now(),
  fields,
  context: { pageUri: values["page-uri"], pageName: "Nebius Promo Codes" },
  legalConsentOptions: {
    consent: {
      consentToProcess: true,
      text: PROCESSING_CONSENT_TEXT,
      communications: subscriptions.map((name) => {
        const sub = SUBSCRIPTION_TYPES[name as keyof typeof SUBSCRIPTION_TYPES];
        return { value: true, subscriptionTypeId: sub.id, text: sub.label };
      }),
    },
  },
};

if (values["dry-run"]) {
  console.log(JSON.stringify(body, null, 2));
  console.log(`\ndry run: would POST to ${SUBMIT_URL}`);
  process.exit(0);
}

const response = await fetch(SUBMIT_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const result = (await response.json()) as {
  inlineMessage?: string;
  errors?: { message: string }[];
};

if (!response.ok) {
  console.error(`submit failed (${response.status}):`, JSON.stringify(result));
  process.exit(1);
}
console.log(`submitted: ${result.inlineMessage ?? "ok"}`);
