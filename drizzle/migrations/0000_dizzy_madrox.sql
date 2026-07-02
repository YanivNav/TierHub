CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tier_list_id" uuid NOT NULL,
	"tier_id" uuid,
	"label" text NOT NULL,
	"type" text DEFAULT 'text' NOT NULL,
	"image_url" text,
	"video_url" text,
	"rank" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tier_list_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tier_list_id" uuid NOT NULL,
	"viewer_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tier_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"cover_image_url" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"remixed_from_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tier_list_id" uuid NOT NULL,
	"label" text NOT NULL,
	"color" text DEFAULT '#ef4444' NOT NULL,
	"rank" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_tier_list_id_tier_lists_id_fk" FOREIGN KEY ("tier_list_id") REFERENCES "public"."tier_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_tier_id_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."tiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tier_list_views" ADD CONSTRAINT "tier_list_views_tier_list_id_tier_lists_id_fk" FOREIGN KEY ("tier_list_id") REFERENCES "public"."tier_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tier_lists" ADD CONSTRAINT "tier_lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tier_lists" ADD CONSTRAINT "tier_lists_remixed_from_id_tier_lists_id_fk" FOREIGN KEY ("remixed_from_id") REFERENCES "public"."tier_lists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tiers" ADD CONSTRAINT "tiers_tier_list_id_tier_lists_id_fk" FOREIGN KEY ("tier_list_id") REFERENCES "public"."tier_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tier_list_views_list_created_idx" ON "tier_list_views" USING btree ("tier_list_id","created_at");--> statement-breakpoint
CREATE INDEX "tier_lists_remixed_from_idx" ON "tier_lists" USING btree ("remixed_from_id");