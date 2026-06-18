/**
 * License lookup.
 *
 * The lookup consults a curated static table for the well-known model
 * families (Llama, Mistral, Whisper, Stable Diffusion) and falls back to
 * scraping the HuggingFace model card metadata block for anything else.
 * The HuggingFace card format is stable: the YAML front-matter at the
 * top of the README declares the `license` field per the HuggingFace hub
 * documentation.
 */

import * as cheerio from "cheerio";
import type { LicenseFacts, LicenseId } from "./schema.js";
import { LicenseFacts as LicenseFactsSchema } from "./schema.js";

/**
 * Fetch adapter. Defaults to the global `fetch` (available on Node.js
 * 18+, browsers, Cloudflare Workers). Injectable so callers can point
 * the resolver at their own cache / proxy.
 */
export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export interface LookupOptions {
  fetch?: FetchFn;
  /** User-Agent header (HuggingFace rate-limits anonymous requests). */
  userAgent?: string;
}

/**
 * Resolve a model id (`meta-llama/Meta-Llama-3-8B-Instruct` etc.) to
 * canonical license facts.
 */
export async function lookupLicense(
  modelId: string,
  options: LookupOptions = {},
): Promise<LicenseFacts> {
  const cached = STATIC_LICENSES[modelId.toLowerCase()];
  if (cached) return LicenseFactsSchema.parse(cached);

  const fetchFn = options.fetch ?? globalThis.fetch;
  if (!fetchFn) {
    throw new Error(
      "no fetch implementation available; supply `fetch` in options",
    );
  }
  const headers: Record<string, string> = {
    "user-agent": options.userAgent ?? "wattz-model-registry/0.1",
  };
  const response = await fetchFn(`https://huggingface.co/${modelId}`, {
    headers,
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(
      `huggingface.co returned ${response.status} for model ${modelId}`,
    );
  }
  const html = await response.text();
  return parseHuggingFaceCard(modelId, html);
}

const HF_LICENSE_MAP: Record<string, LicenseId> = {
  "apache-2.0": "apache-2.0",
  apache: "apache-2.0",
  mit: "mit",
  "bsd-3-clause": "bsd-3-clause",
  "creativeml-openrail-m": "creativeml-openrail-m",
  llama3: "llama-3-community",
  llama3_community: "llama-3-community",
  "llama-3-community": "llama-3-community",
  llama2: "llama-2-community",
  gemma: "gemma-terms-of-use",
  "gemma-terms-of-use": "gemma-terms-of-use",
  "mistral-ai-research": "mistral-ai-research",
  "mistral-ai-non-production": "mistral-ai-non-production",
  "cc-by-4.0": "cc-by-4.0",
  "cc-by-nc-4.0": "cc-by-nc-4.0",
  "cc-by-sa-4.0": "cc-by-sa-4.0",
  "cc0-1.0": "cc0-1.0",
  openrail: "openrail",
  "openrail++": "openrail-plus-plus",
};

export function normaliseLicense(raw: string): LicenseId {
  const key = raw.trim().toLowerCase();
  return HF_LICENSE_MAP[key] ?? "custom";
}

export function isKycRequired(license: LicenseId): boolean {
  switch (license) {
    case "llama-3-community":
    case "llama-2-community":
    case "gemma-terms-of-use":
    case "mistral-ai-research":
    case "mistral-ai-non-production":
    case "cc-by-nc-4.0":
    case "custom":
      return true;
    default:
      return false;
  }
}

function parseHuggingFaceCard(modelId: string, html: string): LicenseFacts {
  const $ = cheerio.load(html);
  // HuggingFace embeds the model card front-matter as a `<code>` block
  // inside `.hf-metadata-block` and as a `<meta property="og:...">` tag
  // for the display name.
  const metaLicense =
    $('a[href*="/license/"]').first().text() ||
    $("[data-license]").attr("data-license") ||
    "";
  const displayName =
    $('meta[property="og:title"]').attr("content") ?? modelId;
  const license = normaliseLicense(metaLicense);
  const facts: LicenseFacts = {
    license,
    licenseUrl: licenseTextUrl(license),
    weightsUrl: `https://huggingface.co/${modelId}`,
    displayName,
    kycRequired: isKycRequired(license),
  };
  return LicenseFactsSchema.parse(facts);
}

function licenseTextUrl(license: LicenseId): string {
  switch (license) {
    case "apache-2.0":
      return "https://www.apache.org/licenses/LICENSE-2.0";
    case "mit":
      return "https://opensource.org/license/mit";
    case "bsd-3-clause":
      return "https://opensource.org/license/bsd-3-clause";
    case "llama-3-community":
      return "https://llama.meta.com/llama3/license/";
    case "llama-2-community":
      return "https://llama.meta.com/llama2/license/";
    case "gemma-terms-of-use":
      return "https://ai.google.dev/gemma/terms";
    case "mistral-ai-research":
      return "https://mistral.ai/licenses/MRL-0.1.md";
    case "mistral-ai-non-production":
      return "https://mistral.ai/licenses/MNPL-0.1.md";
    case "creativeml-openrail-m":
      return "https://huggingface.co/spaces/CompVis/stable-diffusion-license";
    case "openrail":
      return "https://huggingface.co/blog/open_rail";
    case "openrail-plus-plus":
      return "https://www.licenses.ai/ai-licenses";
    case "cc-by-4.0":
      return "https://creativecommons.org/licenses/by/4.0/";
    case "cc-by-nc-4.0":
      return "https://creativecommons.org/licenses/by-nc/4.0/";
    case "cc-by-sa-4.0":
      return "https://creativecommons.org/licenses/by-sa/4.0/";
    case "cc0-1.0":
      return "https://creativecommons.org/publicdomain/zero/1.0/";
    case "custom":
    default:
      return "https://huggingface.co/models";
  }
}

/**
 * Curated table for the models Wattz bootstraps with. Skips the network
 * roundtrip for the common case.
 */
const STATIC_LICENSES: Record<string, LicenseFacts> = {
  "meta-llama/meta-llama-3-8b-instruct": {
    displayName: "Meta Llama 3 8B Instruct",
    license: "llama-3-community",
    licenseUrl: "https://llama.meta.com/llama3/license/",
    weightsUrl:
      "https://huggingface.co/meta-llama/Meta-Llama-3-8B-Instruct",
    contextWindow: 8192,
    vramMib: 16384,
    kycRequired: true,
  },
  "meta-llama/meta-llama-3-70b-instruct": {
    displayName: "Meta Llama 3 70B Instruct",
    license: "llama-3-community",
    licenseUrl: "https://llama.meta.com/llama3/license/",
    weightsUrl:
      "https://huggingface.co/meta-llama/Meta-Llama-3-70B-Instruct",
    contextWindow: 8192,
    vramMib: 140_000,
    kycRequired: true,
  },
  "mistralai/mistral-7b-instruct-v0.3": {
    displayName: "Mistral 7B Instruct v0.3",
    license: "apache-2.0",
    licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
    weightsUrl:
      "https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.3",
    contextWindow: 32768,
    vramMib: 14_500,
    kycRequired: false,
  },
  "openai/whisper-base": {
    displayName: "Whisper base",
    license: "mit",
    licenseUrl: "https://opensource.org/license/mit",
    weightsUrl: "https://huggingface.co/openai/whisper-base",
    contextWindow: 30,
    vramMib: 1024,
    kycRequired: false,
  },
  "stabilityai/stable-diffusion-3-medium": {
    displayName: "Stable Diffusion 3 Medium",
    license: "creativeml-openrail-m",
    licenseUrl:
      "https://huggingface.co/spaces/CompVis/stable-diffusion-license",
    weightsUrl:
      "https://huggingface.co/stabilityai/stable-diffusion-3-medium",
    contextWindow: 77,
    vramMib: 8192,
    kycRequired: true,
  },
};
