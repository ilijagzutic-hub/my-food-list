export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'VERY HIGH';
export type Status = 'Want to try' | 'Tried';
export type VisitAgain = 'yes' | 'maybe' | 'no';

export interface Restaurant {
  id: number;
  name: string;
  suburb: string | null;
  address: string | null;
  region: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  cuisine: string[] | null;
  venue_type: string[] | null;
  occasions: string[] | null;
  tags: string[] | null;
  priority: Priority | null;
  status: Status | null;
  summary: string | null;
  user_notes: string | null;
  source_notes: string | null;
  rating: number | string | null;
  closed: boolean | null;
  latitude: number | null;
  longitude: number | null;
  location_precision: string | null;
  visit_again: VisitAgain | null;
  last_visited_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Dish {
  id: number;
  restaurant_id: number;
  name: string;
  description: string | null;
  must_order: boolean | null;
  user_note: string | null;
  temporary: boolean | null;
  sort_order: number | null;
  liked: boolean | null;
}

export interface RestaurantWithDishes extends Restaurant {
  dishes: Dish[];
  distanceKm?: number | null;
}

export interface Coords {
  lat: number;
  lon: number;
}
