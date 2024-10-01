/**
 * YouTrack Cloud and YouTrack Server adapter
 *
 * The adapter uses the YouTrack REST API to extract ticket information from issues.
 *
 * Supported page URLs:
 * - Issue page: …/issue/<ISSUE-KEY>
 * - Issue page (with slug): …/issue/<ISSUE-KEY>/<SLUG>
 * - Issue detail view on agile board: …/agiles/<BOARD-ID>/<SPRINT>?issue=<ISSUE-KEY>
 *
 * For development, you can get a YouTrack (Cloud) account at:
 * https://youtrack.cloud/
 */

import client from "../client";
import type { TicketData } from "../types";
import { $has } from "./dom-helpers";

type YouTrackMatch = {
  base: string;
  id: string;
};

type YouTrackIssue = {
  idReadable: string;
  summary: string | null;
  description: string | null;
  fields: YouTrackIssueField[];
};

type YouTrackIssueField = {
  name: string;
  value: { name: string };
};

function normalize(url: URL): string {
  const u = new URL(url);

  u.hash = "";
  u.search = "";

  return u.toString();
}

function match(value: string, regex: RegExp): Record<string, string> {
  return value.match(regex)?.groups ?? {};
}

function analyze(url: URL): YouTrackMatch | null {
  // Drop hash and search/query for URL matching

  const u = normalize(url);

  // Match issue page URL (with optional slug)

  const m1 = match(
    u,
    /(?<base>.+)\/issue\/(?<id>[A-Z]+-[0-9]+)(?<slug>\/[^/]+)?$/,
  );

  if (m1.base && m1.id) {
    return { base: m1.base, id: m1.id };
  }

  // Match agile board URL

  const m2 = match(
    u,
    /(?<base>.+)\/agiles\/(?<board>[0-9]+-[0-9]+)\/(?<sprint>[0-9]+-[0-9]+|current)$/,
  );

  const params = new URLSearchParams(url.search);
  const id = params.get("issue");

  if (m2.base && id) {
    return { base: m2.base, id };
  }

  return null;
}

async function scan(url: URL, document: Document): Promise<TicketData[]> {
  if (!$has("yt-page-loader", document)) return []; // document is not a YouTrack page

  const info = analyze(url);

  if (info === null) return []; // URL not recognized as an issue page

  const yt = client(`${info.base}/api`);

  const options = {
    searchParams: {
      fields: [
        "idReadable",
        "summary",
        "description",
        "fields(name,value(name))",
      ].join(","),
    },
  };

  const issue = await yt
    .get(`issues/${info.id}`, options)
    .json<YouTrackIssue>();

  const ticket: TicketData = {
    id: issue.idReadable,
    title: issue.summary ?? issue.idReadable,
    url: `${info.base}/issue/${issue.idReadable}`,
  };

  if (issue.description) {
    ticket.description = issue.description;
  }

  const type = issue.fields
    ?.find(({ name }) => name === "Type")
    ?.value?.name?.toLowerCase();

  if (type) {
    ticket.type = type;
  }

  return [ticket];
}

export default scan;
