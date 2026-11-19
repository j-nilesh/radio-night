ALTER TABLE "guest_sessions" ADD COLUMN "voice_chars_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "guest_sessions" ADD COLUMN "voice_chars_allowance" integer;--> statement-breakpoint
ALTER TABLE "guest_sessions" ADD COLUMN "model_replies_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "guest_sessions" ADD COLUMN "access_label" text;