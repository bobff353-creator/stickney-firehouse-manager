import { z } from "zod";
export const observationSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9-]{1,100}$/),
  planId: z
    .string()
    .regex(/^[a-zA-Z0-9-]{1,100}$/)
    .nullable(),
  address: z.string().trim().max(500),
  text: z.string().trim().min(1, "Write what you noticed.").max(4000),
  priority: z.enum(["note", "crew-alert"]),
});
export type ObservationInput = z.infer<typeof observationSchema>;
export type Observation = {
  id: string;
  planId: string | null;
  address: string;
  text: string;
  priority: "note" | "crew-alert";
  state: "unreviewed" | "reviewed" | "resolved";
  revision: number;
  createdAt: string;
  updatedAt: string;
  reviewNote: string;
  hasPhoto: boolean;
  photoType: string | null;
  photoName: string | null;
};
export type ObservationDraft = {
  id: string;
  owner: string;
  data: ObservationInput;
  photo: File | null;
  modifiedAt: number;
};
export function readObservation(r: Record<string, unknown>): Observation {
  return {
    id: String(r.id),
    planId: r.plan_id as string | null,
    address: String(r.address),
    text: String(r.text),
    priority: r.priority as Observation["priority"],
    state: r.state as Observation["state"],
    revision: Number(r.revision),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    reviewNote: String(r.review_note),
    hasPhoto: !!r.photo_key,
    photoType: r.photo_type as string | null,
    photoName: r.photo_name as string | null,
  };
}
