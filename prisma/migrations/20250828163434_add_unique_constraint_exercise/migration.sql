/*
  Warnings:

  - A unique constraint covering the columns `[lesson_id,order_index]` on the table `exercises` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "exercises_lesson_id_order_index_key" ON "public"."exercises"("lesson_id", "order_index");
