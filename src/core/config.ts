import { z } from 'zod';

export const configSchema = z
  .object({
    owner: z.string().trim().min(1).max(100).default('local'),
    repositories: z
      .array(
        z.object({ path: z.string().min(1), name: z.string().trim().min(1).max(100).optional() }),
      )
      .max(8)
      .default([]),
    exclude: z.array(z.string()).default([]),
    scanner: z
      .object({
        maxFileBytes: z.number().int().positive().max(50_000_000).default(2_000_000),
        maxFiles: z.number().int().positive().max(100_000).default(20_000),
      })
      .default({ maxFileBytes: 2_000_000, maxFiles: 20_000 }),
    appearance: z
      .object({
        theme: z.literal('github-dark').default('github-dark'),
        showLabels: z.boolean().default(true),
        showLegend: z.boolean().default(true),
      })
      .default({ theme: 'github-dark', showLabels: true, showLegend: true }),
    profile: z
      .object({
        title: z.string().min(1).max(28).default('My Code City'),
        subtitle: z.string().max(48).default('A skyline built from code'),
        width: z.literal(1200).default(1200),
        height: z.literal(420).default(420),
      })
      .default({
        title: 'My Code City',
        subtitle: 'A skyline built from code',
        width: 1200,
        height: 420,
      }),
  })
  .strict();
export type CodeCityConfig = z.infer<typeof configSchema>;

const number = z.number().finite();
const positive = number.positive();
const point = z.object({ x: number, y: number });
const rect = point.extend({ width: positive, depth: positive });
const color = z.string().regex(/^#[a-fA-F0-9]{6}$/);
const githubUrl = z
  .string()
  .regex(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\/blob\/[a-f0-9]{40,64}\/.+)?$/);
const building = z.object({
  id: z.string().min(1),
  path: z.string(),
  category: z.enum(['source', 'test', 'docs', 'config', 'asset']),
  language: z.string(),
  lines: number.int().nonnegative(),
  bytes: number.int().nonnegative(),
  modifiedAt: z.string().optional(),
  position: point,
  width: positive,
  depth: positive,
  height: positive,
  color,
  landmark: z.boolean().optional(),
  seed: number.int().nonnegative().optional(),
  githubUrl: githubUrl.optional(),
});

export const sceneSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  owner: z.string(),
  isFixture: z.boolean(),
  theme: z.object({
    name: z.string(),
    background: color,
    text: color,
    muted: color,
    languages: z.record(z.string(), color),
  }),
  camera: z.object({ origin: point, scale: positive }),
  repositories: z.array(
    z.object({
      name: z.string().min(1),
      description: z.string(),
      url: githubUrl.optional(),
      commitSha: z.string(),
      primaryLanguage: z.string(),
      stars: number.nonnegative(),
      bounds: rect,
      buildings: z.array(building),
      blocks: z.array(z.object({ name: z.string(), bounds: rect })).optional(),
    }),
  ),
  bounds: rect.optional(),
  snapshotHash: z.string().optional(),
});
