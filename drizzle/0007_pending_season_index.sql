CREATE UNIQUE INDEX "ux_seasons_one_open_status_per_group" ON "seasons" USING btree ("group_id","status") WHERE "seasons"."status" <> 'closed';
