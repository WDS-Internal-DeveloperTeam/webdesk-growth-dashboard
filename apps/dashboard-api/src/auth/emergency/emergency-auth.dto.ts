import { z } from "zod";

export const emergencyLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type EmergencyLoginDto = z.infer<typeof emergencyLoginSchema>;

export const emergencyTotpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "TOTP code must be 6 digits"),
});
export type EmergencyTotpDto = z.infer<typeof emergencyTotpSchema>;
