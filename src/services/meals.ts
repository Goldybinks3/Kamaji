import { requireSupabase } from '../lib/supabase.ts'
import type { Meal, MealDraft, MealSlot, ShoppingItem } from '../types/domain.ts'

type MealRow = {
  id: string
  served_on: string
  slot: MealSlot
  title: string
  cook_id: string | null
  recipe_url?: string | null
}

type ShoppingRow = {
  id: string
  label: string
  done: boolean
}

export function mapMeal(row: MealRow): Meal {
  return {
    id: row.id,
    servedOn: row.served_on,
    slot: row.slot,
    title: row.title,
    cookId: row.cook_id,
    recipeUrl: row.recipe_url ?? undefined,
  }
}

export function mapShopping(row: ShoppingRow): ShoppingItem {
  return {
    id: row.id,
    label: row.label,
    done: row.done,
  }
}

export async function fetchMeals(householdId: string): Promise<Meal[]> {
  const client = requireSupabase()
  const withRecipe = await client
    .from('meals')
    .select('id, served_on, slot, title, cook_id, recipe_url')
    .eq('household_id', householdId)
    .order('served_on', { ascending: true })

  if (!withRecipe.error) return ((withRecipe.data ?? []) as MealRow[]).map(mapMeal)
  if (!/column|schema cache|recipe_url/i.test(withRecipe.error.message)) {
    throw new Error(withRecipe.error.message)
  }

  const legacy = await client
    .from('meals')
    .select('id, served_on, slot, title, cook_id')
    .eq('household_id', householdId)
    .order('served_on', { ascending: true })
  if (legacy.error) throw new Error(legacy.error.message)
  return ((legacy.data ?? []) as MealRow[]).map(mapMeal)
}

export async function upsertMeal(householdId: string, draft: MealDraft): Promise<Meal> {
  const client = requireSupabase()
  const payload = {
    household_id: householdId,
    served_on: draft.servedOn,
    slot: draft.slot,
    title: draft.title.trim(),
    cook_id: draft.cookId,
    recipe_url: draft.recipeUrl?.trim() || null,
  }
  const withRecipe = await client
    .from('meals')
    .upsert(payload, { onConflict: 'household_id,served_on,slot' })
    .select('id, served_on, slot, title, cook_id, recipe_url')
    .single()

  if (!withRecipe.error) return mapMeal(withRecipe.data as MealRow)
  if (!/column|schema cache|recipe_url/i.test(withRecipe.error.message)) {
    throw new Error(withRecipe.error.message)
  }

  const legacyPayload = {
    household_id: payload.household_id,
    served_on: payload.served_on,
    slot: payload.slot,
    title: payload.title,
    cook_id: payload.cook_id,
  }
  const legacy = await client
    .from('meals')
    .upsert(legacyPayload, { onConflict: 'household_id,served_on,slot' })
    .select('id, served_on, slot, title, cook_id')
    .single()
  if (legacy.error) throw new Error(legacy.error.message)
  return mapMeal(legacy.data as MealRow)
}

export async function deleteMeal(id: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('meals').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function fetchShopping(householdId: string): Promise<ShoppingItem[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('shopping_items')
    .select('id, label, done')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return ((data ?? []) as ShoppingRow[]).map(mapShopping)
}

export async function addShoppingItem(
  householdId: string,
  userId: string,
  label: string,
): Promise<ShoppingItem> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('shopping_items')
    .insert({
      household_id: householdId,
      added_by: userId,
      label: label.trim(),
      done: false,
    })
    .select('id, label, done')
    .single()

  if (error) throw new Error(error.message)
  return mapShopping(data as ShoppingRow)
}

export async function toggleShoppingItem(id: string, done: boolean): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('shopping_items').update({ done }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function removeShoppingItem(id: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('shopping_items').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
