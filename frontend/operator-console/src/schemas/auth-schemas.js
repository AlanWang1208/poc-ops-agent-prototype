import { z } from "zod";

/**
 * @typedef {z.infer<typeof browserSessionSchema>} BrowserSession
 */

const nonBlankString = z.string().trim().min(1);
const nullableNonBlankString = nonBlankString.nullable();

const workspaceSessionViewSchema = z
  .object({
    workspaceId: nonBlankString,
  })
  .passthrough();

export const browserSessionSchema = z
  .object({
    authenticated: z.boolean(),
    subject: nullableNonBlankString,
    username: nullableNonBlankString,
    roles: z.array(nonBlankString),
    authenticationType: nonBlankString,
    sessionExpiresAt: z.iso.datetime({ offset: true }).nullable().optional(),
    passwordChangeRequired: z.boolean().optional(),
    workspaces: z.array(workspaceSessionViewSchema).optional(),
    currentWorkspaceId: nullableNonBlankString.optional(),
  })
  .strict()
  .superRefine((session, context) => {
    if (session.authenticated) {
      if (session.subject === null || session.username === null) {
        context.addIssue({
          code: "custom",
          message: "Authenticated sessions require subject and username",
        });
      }
      if (
        session.currentWorkspaceId &&
        session.workspaces &&
        !session.workspaces.some(
          (workspace) => workspace.workspaceId === session.currentWorkspaceId,
        )
      ) {
        context.addIssue({
          code: "custom",
          message: "currentWorkspaceId must be visible in workspaces",
        });
      }
      return;
    }

    if (
      session.subject !== null ||
      session.username !== null ||
      session.roles.length > 0 ||
      session.sessionExpiresAt != null ||
      session.passwordChangeRequired === true ||
      (session.workspaces?.length ?? 0) > 0 ||
      session.currentWorkspaceId != null
    ) {
      context.addIssue({
        code: "custom",
        message: "Anonymous sessions must not contain authenticated fields",
      });
    }
  });
