import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Routers para funcionalidades do sistema de interpretação Libras
  professor: router({
    translateToLibras: protectedProcedure
      .input(z.object({ text: z.string() }))
      .mutation(async ({ input }) => {
        const { translateAndGenerateVideo } = await import('./vlibras');
        const videoId = await translateAndGenerateVideo(input.text);
        return { videoId };
      }),
    
    getVideoStatus: protectedProcedure
      .input(z.object({ videoId: z.string() }))
      .query(async ({ input }) => {
        const { getVideoStatus } = await import('./vlibras');
        return await getVideoStatus(input.videoId);
      }),
    
    getVideoUrl: protectedProcedure
      .input(z.object({ videoId: z.string() }))
      .query(async ({ input }) => {
        const { getVideoUrl } = await import('./vlibras');
        return { url: await getVideoUrl(input.videoId) };
      }),
  }),

  student: router({
    // Placeholder para reconhecimento de gestos
    // Em produção, isso seria implementado com MediaPipe + modelo de ML
    recognizeGesture: protectedProcedure
      .input(z.object({ landmarks: z.any() }))
      .mutation(async ({ input }) => {
        // TODO: Implementar reconhecimento real com modelo de ML
        return { text: 'Gesto reconhecido (placeholder)' };
      }),
  }),

  session: router({
    create: protectedProcedure
      .input(z.object({
        title: z.string().optional(),
        type: z.enum(['professor', 'aluno']),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createSession } = await import('./db');
        const sessionId = await createSession({
          userId: ctx.user.id,
          title: input.title,
          type: input.type,
        });
        return { sessionId };
      }),
    
    end: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ input }) => {
        const { endSession } = await import('./db');
        await endSession(input.sessionId);
        return { success: true };
      }),
    
    list: protectedProcedure
      .query(async ({ ctx }) => {
        const { getSessionsByUser } = await import('./db');
        return await getSessionsByUser(ctx.user.id);
      }),
    
    getById: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        const { getSessionById } = await import('./db');
        return await getSessionById(input.sessionId);
      }),
  }),

  translation: router({
    save: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        type: z.enum(['speech_to_libras', 'libras_to_speech']),
        originalText: z.string().optional(),
        translatedText: z.string().optional(),
        videoUrl: z.string().optional(),
        confidence: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { saveTranslation } = await import('./db');
        const translationId = await saveTranslation(input);
        return { translationId };
      }),
    
    listBySession: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        const { getTranslationsBySession } = await import('./db');
        return await getTranslationsBySession(input.sessionId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
