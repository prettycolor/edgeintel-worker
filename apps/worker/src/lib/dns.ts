import type {
  DnsProfile,
  DnsQueryEvidence,
  DnsRecord,
  TtlSummary,
} from "../types";
import { withRetry } from "./utils";

const DNS_JSON_ACCEPT = "application/dns-json";
const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";

interface DohAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

interface DohResponse {
  Status: number;
  Answer?: DohAnswer[];
}

const TYPE_NUMBERS: Record<string, number> = {
  A: 1,
  NS: 2,
  CNAME: 5,
  MX: 15,
  TXT: 16,
  AAAA: 28,
};

interface QueryOutcome {
  records: DnsRecord[];
  evidence: DnsQueryEvidence;
}

function mapAnswers(type: keyof typeof TYPE_NUMBERS, answers?: DohAnswer[]): DnsRecord[] {
  return (answers ?? [])
    .filter((answer) => answer.type === TYPE_NUMBERS[type])
    .map((answer) => ({
      name: answer.name,
      type,
      data: answer.data.replace(/^"|"$/g, ""),
      ttl: answer.TTL,
    }));
}

async function queryDnsOnce(
  name: string,
  type: keyof typeof TYPE_NUMBERS,
): Promise<DnsRecord[]> {
  const url = new URL(DOH_ENDPOINT);
  url.searchParams.set("name", name);
  url.searchParams.set("type", type);

  const response = await fetch(url, {
    headers: {
      accept: DNS_JSON_ACCEPT,
    },
  });

  if (!response.ok) {
    throw new Error(`DNS query failed for ${name} ${type} with status ${response.status}`);
  }

  const payload = (await response.json()) as DohResponse;
  if (payload.Status !== 0 && payload.Status !== 3) {
    throw new Error(`DNS query returned status ${payload.Status} for ${name} ${type}`);
  }

  return mapAnswers(type, payload.Answer);
}

async function queryDns(
  name: string,
  type: keyof typeof TYPE_NUMBERS,
): Promise<QueryOutcome> {
  const startedAt = Date.now();

  try {
    const { value, attempts } = await withRetry(
      () => queryDnsOnce(name, type),
      {
        attempts: 2,
        delayMs: 150,
      },
    );

    return {
      records: value,
      evidence: {
        type,
        ok: true,
        recordCount: value.length,
        durationMs: Date.now() - startedAt,
        attempts,
      },
    };
  } catch (error) {
    return {
      records: [],
      evidence: {
        type,
        ok: false,
        recordCount: 0,
        durationMs: Date.now() - startedAt,
        attempts:
          typeof error === "object" &&
          error !== null &&
          "attempts" in error &&
          typeof (error as { attempts?: unknown }).attempts === "number"
            ? (error as { attempts: number }).attempts
            : 2,
        error: error instanceof Error ? error.message : "DNS query failed",
      },
    };
  }
}

function summarizeTtls(records: DnsRecord[]): TtlSummary {
  const ttls = records
    .map((record) => record.ttl)
    .filter((ttl): ttl is number => typeof ttl === "number");

  if (ttls.length === 0) {
    return {
      min: null,
      max: null,
      average: null,
    };
  }

  const total = ttls.reduce((sum, ttl) => sum + ttl, 0);
  return {
    min: Math.min(...ttls),
    max: Math.max(...ttls),
    average: Math.round(total / ttls.length),
  };
}

export async function resolveDnsProfile(domain: string): Promise<DnsProfile> {
  const [nameservers, a, aaaa, cname, mx, txt] = await Promise.all([
    queryDns(domain, "NS"),
    queryDns(domain, "A"),
    queryDns(domain, "AAAA"),
    queryDns(domain, "CNAME"),
    queryDns(domain, "MX"),
    queryDns(domain, "TXT"),
  ]);

  const allRecords = [
    ...nameservers.records,
    ...a.records,
    ...aaaa.records,
    ...cname.records,
    ...mx.records,
    ...txt.records,
  ];

  return {
    nameservers: nameservers.records,
    a: a.records,
    aaaa: aaaa.records,
    cname: cname.records,
    mx: mx.records,
    txt: txt.records,
    evidence: {
      queryResults: [
        nameservers.evidence,
        a.evidence,
        aaaa.evidence,
        cname.evidence,
        mx.evidence,
        txt.evidence,
      ],
      observedRecordTypes: [
        nameservers.records.length ? "NS" : null,
        a.records.length ? "A" : null,
        aaaa.records.length ? "AAAA" : null,
        cname.records.length ? "CNAME" : null,
        mx.records.length ? "MX" : null,
        txt.records.length ? "TXT" : null,
      ].filter(Boolean) as string[],
      ttlSummary: summarizeTtls(allRecords),
    },
  };
}
