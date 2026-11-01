import { hash } from "./domain.js";
// Stable opaque IDs preserve repeated words without exposing their original positions.
export function sentenceTokens(id: string, answer: string) {
  return answer
    .trim()
    .split(/\s+/)
    .map((text, index) => ({ id: hash(`${id}:${index}`).slice(0, 24), text }))
    .sort((a, b) => hash(a.id).localeCompare(hash(b.id)));
}
