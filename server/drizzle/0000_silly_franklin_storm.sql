CREATE TABLE "devices" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"push_token" text,
	"location_push_token" text,
	"app_version" text,
	"os_version" text,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalations" (
	"id" text PRIMARY KEY NOT NULL,
	"watched_id" text NOT NULL,
	"state" text NOT NULL,
	"last_signal_at" timestamp with time zone,
	"last_signal_type" text,
	"last_lat" real,
	"last_lng" real,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"alerted_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"resolved_by" text
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"watched_id" text NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_by" text,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"watcher_id" text NOT NULL,
	"watched_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" text PRIMARY KEY NOT NULL,
	"watched_id" text NOT NULL,
	"device_id" text,
	"type" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"meta" jsonb
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"firebase_uid" text NOT NULL,
	"role" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"timezone" text DEFAULT 'Asia/Tokyo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watch_relationships" (
	"id" text PRIMARY KEY NOT NULL,
	"watcher_id" text NOT NULL,
	"watched_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watch_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"watched_id" text NOT NULL,
	"threshold_hours" integer DEFAULT 12 NOT NULL,
	"quiet_start" text DEFAULT '22:00' NOT NULL,
	"quiet_end" text DEFAULT '07:00' NOT NULL,
	"activity_interval_hours" integer DEFAULT 6 NOT NULL,
	"timezone" text DEFAULT 'Asia/Tokyo' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_watched_id_users_id_fk" FOREIGN KEY ("watched_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_watched_id_users_id_fk" FOREIGN KEY ("watched_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_watcher_id_users_id_fk" FOREIGN KEY ("watcher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_watched_id_users_id_fk" FOREIGN KEY ("watched_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_watched_id_users_id_fk" FOREIGN KEY ("watched_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_relationships" ADD CONSTRAINT "watch_relationships_watcher_id_users_id_fk" FOREIGN KEY ("watcher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_relationships" ADD CONSTRAINT "watch_relationships_watched_id_users_id_fk" FOREIGN KEY ("watched_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_settings" ADD CONSTRAINT "watch_settings_watched_id_users_id_fk" FOREIGN KEY ("watched_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "devices_user_idx" ON "devices" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_push_token_key" ON "devices" USING btree ("push_token");--> statement-breakpoint
CREATE INDEX "escalations_watched_state_idx" ON "escalations" USING btree ("watched_id","state");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_code_key" ON "invitations" USING btree ("code");--> statement-breakpoint
CREATE INDEX "messages_watched_created_idx" ON "messages" USING btree ("watched_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "signals_dedup_key" ON "signals" USING btree ("watched_id","type","observed_at","device_id");--> statement-breakpoint
CREATE INDEX "signals_watched_observed_idx" ON "signals" USING btree ("watched_id","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users" USING btree ("firebase_uid");--> statement-breakpoint
CREATE UNIQUE INDEX "watch_rel_pair_key" ON "watch_relationships" USING btree ("watcher_id","watched_id");--> statement-breakpoint
CREATE INDEX "watch_rel_watched_idx" ON "watch_relationships" USING btree ("watched_id");--> statement-breakpoint
CREATE UNIQUE INDEX "watch_settings_watched_key" ON "watch_settings" USING btree ("watched_id");