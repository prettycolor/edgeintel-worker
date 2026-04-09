import type { DnsProfile, DnsRecord } from "../types";

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

async function queryDns(name: string, type: keyof typeof TYPE_NUMBERS): Promise<DnsRecord[]> {
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

export async function resolveDnsProfile(domain: string): Promise<DnsProfile> {
  const [nameservers, a, aaaa, cname, mx, txt] = await Promise.all([
    queryDns(domain, "NS").catch(() => []),
    queryDns(domain, "A").catch(() => []),
    queryDns(domain, "AAAA").catch(() => []),
    queryDns(domain, "CNAME").catch(() => []),
    queryDns(domain, "MX").catch(() => []),
    queryDns(domain, "TXT").catch(() => []),
  ]);

  return {
    nameservers,
    a,
    aaaa,
    cname,
    mx,
    txt,
  };
}
