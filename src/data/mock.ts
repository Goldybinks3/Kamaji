import { addDays, parisToday } from '../lib/dates.ts'
import type { Assignment, Meal, Member, ShoppingItem } from '../types/domain.ts'

export const currentUserId = 'eden'

export const initialMembers: Member[] = [
  {
    id: 'eden',
    displayName: 'Eden',
    avatarKey: 'cercle',
    phone: '0601020304',
    energy: 'ok',
  },
  {
    id: 'noam',
    displayName: 'Noam',
    avatarKey: 'carre',
    phone: '0602030405',
    energy: 'high',
  },
  {
    id: 'sasha',
    displayName: 'Sasha',
    avatarKey: 'triangle',
    phone: '0603040506',
    energy: 'ok',
  },
  {
    id: 'lou',
    displayName: 'Lou',
    avatarKey: 'etoile',
    energy: 'low',
  },
]

export function createAssignments(today: string): Assignment[] {
  return [
    {
      id: 'task-dishwasher',
      title: 'Vider le lave-vaisselle',
      details: 'Ranger aussi les couverts du tiroir.',
      kind: 'rotation',
      status: 'accepted',
      assigneeId: currentUserId,
      requestedBy: null,
      dueOn: today,
      dueTime: '18:30',
    },
    {
      id: 'task-trash',
      title: 'Sortir les poubelles',
      details: 'Bac jaune et ordures ménagères.',
      kind: 'rotation',
      status: 'accepted',
      assigneeId: currentUserId,
      requestedBy: null,
      dueOn: addDays(today, 1),
      dueTime: '20:00',
    },
    {
      id: 'task-laundry',
      title: 'Étendre le linge',
      details: 'Le cycle se termine vers midi.',
      kind: 'rotation',
      status: 'accepted',
      assigneeId: currentUserId,
      requestedBy: null,
      dueOn: addDays(today, 2),
    },
    {
      id: 'task-vacuum',
      title: 'Passer l’aspirateur',
      details: 'Salon et couloir.',
      kind: 'rotation',
      status: 'accepted',
      assigneeId: currentUserId,
      requestedBy: null,
      dueOn: addDays(today, 4),
    },
    {
      id: 'offer-plants',
      title: 'Arroser les plantes',
      details: 'Celles du salon, pas le balcon.',
      kind: 'offer',
      status: 'open',
      assigneeId: null,
      requestedBy: 'noam',
      dueOn: today,
    },
    {
      id: 'request-groceries',
      title: 'Courses',
      details: 'Pain et lait, la liste est dans Repas.',
      kind: 'request',
      status: 'open',
      assigneeId: currentUserId,
      requestedBy: 'sasha',
      dueOn: addDays(today, 1),
      dueTime: '17:00',
    },
  ]
}

export function createMeals(today: string): Meal[] {
  return [
    {
      id: 'meal-today',
      servedOn: today,
      slot: 'dinner',
      title: 'Gratin de courgettes',
      cookId: 'lou',
    },
    {
      id: 'meal-tomorrow',
      servedOn: addDays(today, 1),
      slot: 'dinner',
      title: 'Pâtes au pesto',
      cookId: 'noam',
    },
    {
      id: 'meal-later',
      servedOn: addDays(today, 3),
      slot: 'dinner',
      title: 'Soupe et tartines',
      cookId: 'sasha',
    },
  ]
}

export const initialShopping: ShoppingItem[] = [
  { id: 'shop-milk', label: 'Lait', done: false },
  { id: 'shop-bread', label: 'Pain', done: false },
  { id: 'shop-apples', label: 'Pommes', done: true },
]

export function createInitialState() {
  const today = parisToday()
  return {
    today,
    members: initialMembers,
    assignments: createAssignments(today),
    meals: createMeals(today),
    shopping: initialShopping,
  }
}
