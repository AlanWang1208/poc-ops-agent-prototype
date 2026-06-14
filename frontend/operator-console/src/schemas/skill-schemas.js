import { z } from "zod";

/**
 * @typedef {z.infer<typeof registeredSkillSchema>} RegisteredSkill
 */

const nonBlankString = z.string().trim().min(1);

export const skillCategorySchema = z.enum([
  "INFRASTRUCTURE_DIAGNOSTICS",
  "APPLICATION_DIAGNOSTICS",
  "PLATFORM_OBSERVABILITY",
]);

export const skillRiskLevelSchema = z.enum([
  "READ_ONLY",
  "LOW",
  "MEDIUM",
  "HIGH",
]);

export const skillPublicationStatusSchema = z.enum([
  "VALIDATED",
  "DRAFT",
  "REJECTED",
]);

const skillParameterSchema = z
  .object({
    name: nonBlankString,
    displayName: nonBlankString,
    description: nonBlankString,
    type: z.enum(["STRING", "INTEGER", "BOOLEAN", "ENUM"]),
    required: z.boolean(),
    allowedValues: z.array(nonBlankString),
    defaultValue: nonBlankString.nullable(),
  })
  .strict();

export const skillDescriptorSchema = z
  .object({
    skillId: nonBlankString,
    version: nonBlankString,
    displayName: nonBlankString,
    description: nonBlankString,
    category: skillCategorySchema,
    riskLevel: skillRiskLevelSchema,
    executor: z.enum(["SHELL", "HTTP", "WORKFLOW"]),
    outputType: z.enum(["JSON", "TEXT", "TABLE", "MARKDOWN"]),
    readOnly: z.boolean(),
    timeoutSeconds: z.number().int().positive(),
    owner: nonBlankString,
    requiredRoles: z.array(nonBlankString),
    tags: z.array(nonBlankString),
    interceptors: z.array(
      z.enum(["AUTHORIZATION", "AUDIT", "SENSITIVE_DATA_MASKING", "RATE_LIMIT"]),
    ),
    parameters: z.array(skillParameterSchema),
  })
  .strict();

const skillPublicationMetadataSchema = z
  .object({
    publishedBy: nonBlankString,
    publishedAt: z.iso.datetime({ offset: true }),
    checksumSha256: nonBlankString,
    signatureAlgorithm: nonBlankString,
    signature: nonBlankString,
  })
  .strict();

export const registeredSkillSchema = z
  .object({
    descriptor: skillDescriptorSchema,
    publication: skillPublicationMetadataSchema,
    publicationStatus: skillPublicationStatusSchema,
    manifestPath: nonBlankString,
  })
  .strict();

export const skillCatalogSchema = z
  .object({
    total: z.number().int().nonnegative(),
    skills: z.array(registeredSkillSchema),
  })
  .strict()
  .refine((catalog) => catalog.total === catalog.skills.length, {
    message: "Skill catalog total must match skills length",
    path: ["total"],
  });

export const skillLookupSchema = z
  .object({
    skill: registeredSkillSchema,
  })
  .strict();
