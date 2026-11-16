import { cacheLife } from "next/cache";

import { prisma } from "@/lib/db";

import { WEAKNESS_THRESHOLDS as T, type Catalogue } from "./weakness";

/**
 * The published lessons and prompts, for matching recommendations.
 *
 * Cached because every learner reads the same rows and each query is a network
 * round trip on the single pooled connection. These functions take no arguments
 * and return only public lesson metadata (id, title, level, question types), so
 * an entry can never hold one learner's data. Nothing per-user belongs here.
 */
const select = { id: true, title: true, difficulty: true } as const;
const lessonQuery = {
  orderBy: { id: "asc" as const },
  take: T.catalogue,
  select: { ...select, questions: { select: { type: true } } },
};
const promptQuery = { orderBy: { id: "asc" as const }, take: T.catalogue, select };

export async function readingCatalogue(): Promise<Catalogue[]> {
  "use cache";
  cacheLife("minutes");
  return prisma.readingLesson.findMany(lessonQuery);
}

export async function listeningCatalogue(): Promise<Catalogue[]> {
  "use cache";
  cacheLife("minutes");
  return prisma.listeningLesson.findMany(lessonQuery);
}

export async function writingCatalogue(): Promise<Catalogue[]> {
  "use cache";
  cacheLife("minutes");
  return prisma.writingPrompt.findMany(promptQuery);
}

export async function speakingCatalogue(): Promise<Catalogue[]> {
  "use cache";
  cacheLife("minutes");
  return prisma.speakingPrompt.findMany(promptQuery);
}

const catalogues = {
  reading: readingCatalogue,
  listening: listeningCatalogue,
  writing: writingCatalogue,
  speaking: speakingCatalogue,
};

/**
 * The title of one published lesson or prompt, for the browser tab. Null when
 * the id is unknown or the catalogue cannot be read: a tab title must never
 * break the page it belongs to.
 */
export async function catalogueTitle(
  skill: keyof typeof catalogues,
  id: string,
): Promise<string | null> {
  try {
    return (await catalogues[skill]()).find((row) => row.id === id)?.title ?? null;
  } catch {
    return null;
  }
}
