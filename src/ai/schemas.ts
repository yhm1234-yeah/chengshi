import { z } from 'zod';

// AI 输出契约（与《系统设计说明书》4.2 节一致），前后端同源校验
export const evidenceSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
  label: z.string(),
  confidence: z.number().min(0).max(1).optional()
});

export const problemTypeSchema = z.enum(['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07']);
export const severitySchema = z.enum(['low', 'medium', 'urgent']);
export const qualityFlagSchema = z.enum(['blur', 'backlight', 'no_subject', 'occluded']);

export const findingSchema = z.object({
  type: problemTypeSchema,
  severity: severitySchema,
  confidence: z.number().min(0).max(1),
  evidence: z.array(evidenceSchema),
  desc: z.string()
});

export const classifySchema = z.object({
  type: problemTypeSchema,
  severity: severitySchema,
  confidence: z.number().min(0).max(1),
  evidence: z.array(evidenceSchema),
  quality_flags: z.array(qualityFlagSchema),
  findings: z.array(findingSchema),
  reason: z.string()
});

export const describeSchema = z.object({
  text: z.string().min(1)
});

export const locateSchema = z.object({
  hints: z.array(
    z.object({
      text: z.string(),
      type: z.enum(['road_sign', 'door_plate', 'landmark']),
      confidence: z.number().min(0).max(1)
    })
  )
});

export const urgeSchema = z.object({
  text: z.string().min(1)
});

export const reassignSchema = z.object({
  text: z.string().min(1)
});

export const chatSchema = z.object({
  answer: z.string().min(1)
});

export type ClassifyOutput = z.infer<typeof classifySchema>;
