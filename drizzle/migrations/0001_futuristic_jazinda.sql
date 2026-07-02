CREATE INDEX "items_tier_list_id_idx" ON "items" USING btree ("tier_list_id");--> statement-breakpoint
CREATE INDEX "items_tier_id_idx" ON "items" USING btree ("tier_id");--> statement-breakpoint
CREATE INDEX "tier_lists_user_id_idx" ON "tier_lists" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tier_lists_created_at_idx" ON "tier_lists" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tiers_tier_list_id_idx" ON "tiers" USING btree ("tier_list_id");