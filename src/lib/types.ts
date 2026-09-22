export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'VERY HIGH';
export type Status = 'Want to try' | 'Tried';
export type VisitAgain = 'yes' | 'maybe' | 'no';
export type DishStatus = 'known_for' | 'want_to_try' | 'tried';

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
  is_favourite: boolean;
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
  dish_status: DishStatus | null;
}

export interface RestaurantWithDishes extends Restaurant {
  dishes: Dish[];
  distanceKm?: number | null;
}

export interface Coords {
  lat: number;
  lon: number;
}

// --- Stage 3: visit history -------------------------------------------------

export interface Person {
  id: number;
  name: string;
  active: boolean;
}

export interface RestaurantVisit {
  id: number;
  restaurant_id: number;
  visited_at: string; // date, e.g. "2026-09-22"
  occasion: string | null;
  overall_rating: number | null; // integer 1-10, DB-enforced
  would_return: VisitAgain | null;
  includes_guests: boolean;
  notes: string | null;
  created_at: string;
}

export interface VisitAttendee {
  visit_id: number;
  person_id: number;
}

/** A dish actually eaten on a visit. Existence alone means "we ordered
 * this" — it carries no opinion. See VisitDishFeedback for that. */
export interface VisitOrderedDish {
  id: number;
  visit_id: number;
  dish_id: number;
  notes: string | null;
  price: number | null;
  photo_url: string | null;
  created_at: string;
}

/** One person's (or, when person_id is null, the anonymous guests')
 * verdict on an ordered dish. No row = unrated — never a row with a
 * null `liked`. */
export interface VisitDishFeedback {
  id: number;
  visit_ordered_dish_id: number;
  person_id: number | null;
  liked: boolean;
  created_at: string;
}

/** Rendering-ready: an ordered dish with its catalogue name and every
 * feedback row resolved. */
export interface OrderedDishWithFeedback extends VisitOrderedDish {
  dish: Pick<Dish, 'id' | 'name' | 'description'>;
  feedback: VisitDishFeedback[];
}

/** A full visit, ready to render in Our History or pre-fill the editor. */
export interface VisitWithDetails extends RestaurantVisit {
  attendeePersonIds: number[];
  orderedDishes: OrderedDishWithFeedback[];
}

/** Payload shape for the save_visit RPC (create when id is omitted/null). */
export interface SaveVisitPayload {
  visit_id?: number | null;
  restaurant_id: number;
  visited_at?: string;
  occasion?: string | null;
  overall_rating?: number | null;
  would_return?: VisitAgain | null;
  includes_guests: boolean;
  notes?: string | null;
  attendee_person_ids: number[];
  dishes: {
    dish_id: number;
    notes?: string | null;
    price?: number | null;
    photo_url?: string | null;
    feedback: { person_id: number | null; liked: boolean }[];
  }[];
}
