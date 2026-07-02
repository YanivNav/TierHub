import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/trpc";
import { users } from "@/server/db/schema";
import { buildAvatarKey, getPresignedUploadUrl, getPublicUrl } from "@/lib/r2";

export const userRouter = createTRPCRouter({
  /** The signed-in user's DB profile (handle/avatar/email shown across the app). */
  getMe: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.users.findFirst({
      where: eq(users.id, ctx.userId),
      columns: { username: true, imageUrl: true, email: true },
    });
  }),

  updateUsername: protectedProcedure
    .input(
      z.object({
        username: z
          .string()
          .min(3)
          .max(30)
          .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers and underscores."),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Store the handle lowercased for uniqueness; keep original casing as
      // displayUsername (the username plugin's convention).
      const handle = input.username.toLowerCase();
      const taken = await ctx.db.query.users.findFirst({
        where: eq(users.username, handle),
        columns: { id: true },
      });
      if (taken && taken.id !== ctx.userId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "That username is taken.",
        });
      }

      const [updated] = await ctx.db
        .update(users)
        .set({
          username: handle,
          displayUsername: input.username,
          updatedAt: new Date(),
        })
        .where(eq(users.id, ctx.userId))
        .returning({ username: users.username });
      return updated;
    }),

  /** Presigned R2 URL for uploading a new avatar image. */
  getAvatarUploadUrl: protectedProcedure
    .input(z.object({ filename: z.string(), contentType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const key = buildAvatarKey(ctx.userId, input.filename);
      const uploadUrl = await getPresignedUploadUrl(key, input.contentType);
      return { uploadUrl, publicUrl: getPublicUrl(key) };
    }),

  /** Persist a newly-uploaded avatar URL (R2) onto the profile. */
  updateAvatar: protectedProcedure
    .input(z.object({ imageUrl: z.string().url().nullable() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(users)
        .set({ imageUrl: input.imageUrl, updatedAt: new Date() })
        .where(eq(users.id, ctx.userId));
      return { imageUrl: input.imageUrl };
    }),

  /** Permanently delete the account. Cascades to lists, sessions, and accounts. */
  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.delete(users).where(eq(users.id, ctx.userId));
    return { deleted: true };
  }),
});
