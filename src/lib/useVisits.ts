'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import type {
  Person,
  RestaurantVisit,
  VisitAttendee,
  VisitOrderedDish,
  VisitDishFeedback,
  VisitWithDetails,
  Dish,
} from './types';

/**
 * These hooks are deliberately separate from useRestaurants() and are only
 * called by the restaurant detail page / My Food — Home and Explore never
 * import them, so their payload (112 restaurants + 115 dishes) is
 * unchanged by Stage 3.
 */

export function usePeople() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('people')
      .select('*')
      .eq('active', true)
      .order('id', { ascending: true })
      .then(({ data }) => {
        if (!cancelled) {
          setPeople((data as Person[]) || []);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { people, loading };
}

async function hydrateVisits(visits: RestaurantVisit[]): Promise<VisitWithDetails[]> {
  if (visits.length === 0) return [];
  const visitIds = visits.map((v) => v.id);

  const [{ data: attendees }, { data: orderedDishes }] = await Promise.all([
    supabase.from('visit_attendees').select('*').in('visit_id', visitIds),
    supabase.from('visit_ordered_dishes').select('*').in('visit_id', visitIds),
  ]);

  const orderedDishRows = (orderedDishes as VisitOrderedDish[]) || [];
  const orderedDishIds = orderedDishRows.map((d) => d.id);
  const dishIds = Array.from(new Set(orderedDishRows.map((d) => d.dish_id)));

  const [{ data: feedback }, { data: dishCatalogueRows }] = await Promise.all([
    orderedDishIds.length
      ? supabase.from('visit_dish_feedback').select('*').in('visit_ordered_dish_id', orderedDishIds)
      : Promise.resolve({ data: [] as VisitDishFeedback[] }),
    dishIds.length
      ? supabase.from('dishes').select('id, name, description').in('id', dishIds)
      : Promise.resolve({ data: [] as Pick<Dish, 'id' | 'name' | 'description'>[] }),
  ]);

  const dishById = new Map((dishCatalogueRows || []).map((d) => [d.id, d]));
  const feedbackByOrderedDish = new Map<number, VisitDishFeedback[]>();
  ((feedback as VisitDishFeedback[]) || []).forEach((f) => {
    const list = feedbackByOrderedDish.get(f.visit_ordered_dish_id) || [];
    list.push(f);
    feedbackByOrderedDish.set(f.visit_ordered_dish_id, list);
  });

  const attendeesByVisit = new Map<number, number[]>();
  ((attendees as VisitAttendee[]) || []).forEach((a) => {
    const list = attendeesByVisit.get(a.visit_id) || [];
    list.push(a.person_id);
    attendeesByVisit.set(a.visit_id, list);
  });

  const orderedDishesByVisit = new Map<number, typeof orderedDishRows>();
  orderedDishRows.forEach((d) => {
    const list = orderedDishesByVisit.get(d.visit_id) || [];
    list.push(d);
    orderedDishesByVisit.set(d.visit_id, list);
  });

  return visits.map((v) => ({
    ...v,
    attendeePersonIds: attendeesByVisit.get(v.id) || [],
    orderedDishes: (orderedDishesByVisit.get(v.id) || []).map((od) => ({
      ...od,
      dish: dishById.get(od.dish_id) || { id: od.dish_id, name: '(deleted dish)', description: null },
      feedback: feedbackByOrderedDish.get(od.id) || [],
    })),
  }));
}

/** Full visit history for one restaurant, newest first. Only the detail
 * page calls this. */
export function useRestaurantVisits(restaurantId: number) {
  const [visits, setVisits] = useState<VisitWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: visitRows, error: vErr } = await supabase
        .from('restaurant_visits')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('visited_at', { ascending: false })
        .order('created_at', { ascending: false });
      if (vErr) throw vErr;

      const hydrated = await hydrateVisits((visitRows as RestaurantVisit[]) || []);
      setVisits(hydrated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load visit history.");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    load();
  }, [load]);

  return { visits, loading, error, reload: load };
}

export interface RecentVisit {
  visit: RestaurantVisit;
  restaurantId: number;
  restaurantName: string;
  attendeePersonIds: number[];
}

/** A bounded, cross-restaurant slice of the most recent visits, for My
 * Food's dashboard. Small, capped query — not the whole table. */
export function useRecentVisits(limit: number) {
  const [recent, setRecent] = useState<RecentVisit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data: visitRows } = await supabase
        .from('restaurant_visits')
        .select('*')
        .order('visited_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      const visits = (visitRows as RestaurantVisit[]) || [];
      if (visits.length === 0) {
        if (!cancelled) {
          setRecent([]);
          setLoading(false);
        }
        return;
      }

      const restaurantIds = Array.from(new Set(visits.map((v) => v.restaurant_id)));
      const visitIds = visits.map((v) => v.id);

      const [{ data: restaurants }, { data: attendees }] = await Promise.all([
        supabase.from('restaurants').select('id, name').in('id', restaurantIds),
        supabase.from('visit_attendees').select('*').in('visit_id', visitIds),
      ]);

      const nameById = new Map((restaurants || []).map((r) => [r.id, r.name as string]));
      const attendeesByVisit = new Map<number, number[]>();
      ((attendees as VisitAttendee[]) || []).forEach((a) => {
        const list = attendeesByVisit.get(a.visit_id) || [];
        list.push(a.person_id);
        attendeesByVisit.set(a.visit_id, list);
      });

      if (!cancelled) {
        setRecent(
          visits.map((v) => ({
            visit: v,
            restaurantId: v.restaurant_id,
            restaurantName: nameById.get(v.restaurant_id) || 'Unknown restaurant',
            attendeePersonIds: attendeesByVisit.get(v.id) || [],
          }))
        );
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return { recent, loading };
}
