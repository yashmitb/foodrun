/**
 * Hand-written to match supabase/migrations/*.sql.
 *
 * Normally this file is generated (`supabase gen types typescript`), which
 * needs a live project. It is written out here so the client is typed before
 * anyone has an account; regenerate it once the project exists and the two
 * should agree.
 */

export type RunStatus =
  | 'scheduled'
  | 'open'
  | 'picking_up'
  | 'delivering'
  | 'done'
  | 'cancelled';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'picked_up'
  | 'on_the_way'
  | 'arrived'
  | 'delivered'
  | 'cancelled'
  | 'problem';

export type ReportReason = 'late' | 'wrong_or_missing' | 'cannot_find_runner' | 'other';

export type HallRow = {
  id: string;
  name: string;
  college: string | null;
  triton2go: boolean;
  hours: Record<string, string>;
  active: boolean;
};

export type RestaurantRow = {
  id: string;
  hall_id: string;
  name: string;
  active: boolean;
  sort: number;
};

export type DestinationRow = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
};

export type DropSpotRow = {
  id: string;
  destination_id: string;
  label: string;
  qr_code: string | null;
};

export type ProfileRow = {
  id: string;
  name: string;
  ucsd_email: string;
  avatar_url: string | null;
  rating_avg: number;
  rating_count: number;
  stripe_customer_id: string | null;
  stripe_account_id: string | null;
  created_at: string;
};

export type RunRow = {
  id: string;
  runner_id: string;
  hall_id: string;
  destination_id: string;
  leave_at: string;
  spots_total: number;
  spots_left: number;
  fee_cents: number;
  status: RunStatus;
  created_at: string;
};

export type OrderRow = {
  id: string;
  run_id: string;
  orderer_id: string;
  hall_id: string;
  restaurant_id: string | null;
  t2g_last4: string;
  order_name: string | null;
  drop_spot_id: string | null;
  drop_spot_text: string;
  handoff_code: string;
  status: OrderStatus;
  cancel_until: string;
  fee_cents: number;
  payment_intent_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Name and rating only — an email address is not public (0003). */
export type PublicProfileRow = {
  id: string;
  name: string;
  avatar_url: string | null;
  rating_avg: number;
  rating_count: number;
};

/** The runner's view: no handoff code, no payment id, no orderer id (§5). */
export type RunnerOrderRow = {
  id: string;
  run_id: string;
  orderer_first_name: string;
  restaurant: string | null;
  t2g_last4: string;
  order_name: string | null;
  drop_spot_text: string;
  status: OrderStatus;
  cancel_until: string;
  fee_cents: number;
  created_at: string;
};

export type OrderEventRow = {
  id: string;
  order_id: string;
  status: OrderStatus;
  note: string | null;
  actor_id: string | null;
  created_at: string;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      halls: Table<HallRow>;
      restaurants: Table<RestaurantRow>;
      destinations: Table<DestinationRow>;
      drop_spots: Table<DropSpotRow>;
      profiles: Table<ProfileRow>;
      runs: Table<RunRow>;
      orders: Table<OrderRow>;
      order_events: Table<OrderEventRow>;
    };
    Views: {
      orders_for_runner: Table<RunnerOrderRow>;
      public_profiles: Table<PublicProfileRow>;
    };
    /**
     * The RPCs from 0003_hardening.sql. Writes go through these rather than
     * through the tables, so these signatures are the whole write surface of
     * the app and are worth having typed.
     */
    Functions: {
      post_run: {
        Args: {
          p_hall_id: string;
          p_destination_id: string;
          p_leave_at: string;
          p_spots: number;
          p_fee_cents: number;
        };
        Returns: RunRow;
      };
      join_run: {
        Args: {
          p_run_id: string;
          p_restaurant_id: string | null;
          p_t2g_last4: string;
          p_order_name: string | null;
          p_drop_spot_text: string;
          p_drop_spot_id?: string | null;
        };
        Returns: OrderRow;
      };
      cancel_order: { Args: { p_order_id: string }; Returns: OrderRow };
      runner_set_status: {
        Args: { p_order_id: string; p_status: OrderStatus };
        Returns: OrderRow;
      };
      runner_deliver: { Args: { p_order_id: string; p_code: string }; Returns: OrderRow };
      rate_order: {
        Args: { p_order_id: string; p_stars: number; p_note: string | null };
        Returns: undefined;
      };
      report_order: {
        Args: { p_order_id: string; p_reason: ReportReason; p_note: string | null };
        Returns: undefined;
      };
      settle_cancel_windows: { Args: Record<string, never>; Returns: undefined };
    };
    Enums: {
      run_status: RunStatus;
      order_status: OrderStatus;
      report_reason: ReportReason;
    };
    CompositeTypes: Record<string, never>;
  };
};
