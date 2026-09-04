'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import type { Dish, Restaurant, RestaurantWithDishes } from './types';

interface State {
  restaurants: RestaurantWithDishes[];
  loading: boolean;
  error: string | null;
}

export function useRestaurants() {
  const [state, setState] = useState<State>({ restaurants: [], loading: true, error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [{ data: restaurants, error: rErr }, { data: dishes, error: dErr }] = await Promise.all([
        supabase.from('restaurants').select('*').order('name', { ascending: true }),
        supabase.from('dishes').select('*'),
      ]);

      if (rErr) throw rErr;
      if (dErr) throw dErr;

      const dishesByRestaurant = new Map<number, Dish[]>();
      (dishes || []).forEach((d) => {
        const list = dishesByRestaurant.get(d.restaurant_id) || [];
        list.push(d);
        dishesByRestaurant.set(d.restaurant_id, list);
      });
      for (const list of dishesByRestaurant.values()) {
        list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      }

      const merged: RestaurantWithDishes[] = (restaurants as Restaurant[]).map((r) => ({
        ...r,
        dishes: dishesByRestaurant.get(r.id) || [],
      }));

      setState({ restaurants: merged, loading: false, error: null });
    } catch (e) {
      setState({
        restaurants: [],
        loading: false,
        error: e instanceof Error ? e.message : 'Could not load your restaurant list.',
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
