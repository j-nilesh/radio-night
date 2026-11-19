CREATE TABLE "audio_assets" (
	"asset_id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"purpose" text NOT NULL,
	"source_type" text NOT NULL,
	"provider" text,
	"model_or_library" text,
	"license" text,
	"redistribution_allowed" boolean,
	"proof_location" text,
	"version" text DEFAULT '1.0' NOT NULL,
	"file_url" text,
	"loop" boolean DEFAULT false NOT NULL,
	"duration_ms" integer,
	"loudness_lufs" real,
	"caption_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guest_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "guest_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "provider_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid,
	"turn_id" uuid,
	"provider" text NOT NULL,
	"feature" text NOT NULL,
	"units" real,
	"estimated_cost_usd" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guest_session_id" uuid,
	"case_id" text NOT NULL,
	"case_version" text NOT NULL,
	"play_mode" text DEFAULT 'solo' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"state_json" jsonb NOT NULL,
	"dialogue_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"finished" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"actor" text NOT NULL,
	"redacted_text" text,
	"decision_code" text NOT NULL,
	"audio_generated" boolean DEFAULT false NOT NULL,
	"audio_asset_ref" text,
	"timings_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "turns_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "provider_usage" ADD CONSTRAINT "provider_usage_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_usage" ADD CONSTRAINT "provider_usage_turn_id_turns_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."turns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_events" ADD CONSTRAINT "run_events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_guest_session_id_guest_sessions_id_fk" FOREIGN KEY ("guest_session_id") REFERENCES "public"."guest_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turns" ADD CONSTRAINT "turns_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "provider_usage_run_idx" ON "provider_usage" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "provider_usage_provider_idx" ON "provider_usage" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "run_events_run_sequence_idx" ON "run_events" USING btree ("run_id","sequence");--> statement-breakpoint
CREATE INDEX "runs_guest_session_idx" ON "runs" USING btree ("guest_session_id");--> statement-breakpoint
CREATE INDEX "runs_case_idx" ON "runs" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "turns_run_idx" ON "turns" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "turns_idempotency_idx" ON "turns" USING btree ("idempotency_key");