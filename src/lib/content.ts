import rawContent from "../generated/content.json";
import type { CourseContent } from "../types";

export const content = rawContent as CourseContent;

export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}

export function topicPath(subject: string, slug: string): string {
  return `/subjects/${encodeURIComponent(subject)}/topics/${encodeURIComponent(slug)}`;
}

export function homeworkPath(subject: string, slug: string): string {
  return `/subjects/${encodeURIComponent(subject)}/homework/${encodeURIComponent(slug)}`;
}

export function plural(count: number, forms: [string, string, string]): string {
  const lastTwo = count % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
  const last = count % 10;
  return last === 1 ? forms[0] : last >= 2 && last <= 4 ? forms[1] : forms[2];
}
