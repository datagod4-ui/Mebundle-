export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          admin_user_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          email: string
          is_active: boolean
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          is_active?: boolean
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          is_active?: boolean
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      bundles: {
        Row: {
          created_at: string
          data_amount_mb: number | null
          display_order: number
          id: string
          is_available: boolean
          is_featured: boolean
          last_synced_at: string | null
          name: string
          network_id: string
          selling_price: number
          supplier_cost: number | null
          supplier_metadata: Json
          supplier_product_id: string | null
          updated_at: string
          validity_label: string | null
        }
        Insert: {
          created_at?: string
          data_amount_mb?: number | null
          display_order?: number
          id?: string
          is_available?: boolean
          is_featured?: boolean
          last_synced_at?: string | null
          name: string
          network_id: string
          selling_price: number
          supplier_cost?: number | null
          supplier_metadata?: Json
          supplier_product_id?: string | null
          updated_at?: string
          validity_label?: string | null
        }
        Update: {
          created_at?: string
          data_amount_mb?: number | null
          display_order?: number
          id?: string
          is_available?: boolean
          is_featured?: boolean
          last_synced_at?: string | null
          name?: string
          network_id?: string
          selling_price?: number
          supplier_cost?: number | null
          supplier_metadata?: Json
          supplier_product_id?: string | null
          updated_at?: string
          validity_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bundles_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      networks: {
        Row: {
          code: string
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          bundle_id: string | null
          bundle_name: string
          created_at: string
          customer_name: string | null
          customer_phone: string
          data_amount_mb: number | null
          failure_reason: string | null
          fulfilled_at: string | null
          id: string
          network_code: string
          order_status: string
          paid_at: string | null
          payment_status: string
          profit: number | null
          recipient_phone: string
          reseller_customer_price: number | null
          reseller_earning: number | null
          reseller_id: string | null
          reseller_store_slug: string | null
          reseller_wholesale_price: number | null
          selling_price: number
          supplier_cost: number | null
          supplier_order_id: string | null
          supplier_response: Json
          supplier_status: string | null
          tracking_code: string
          updated_at: string
          validity_label: string | null
        }
        Insert: {
          bundle_id?: string | null
          bundle_name: string
          created_at?: string
          customer_name?: string | null
          customer_phone: string
          data_amount_mb?: number | null
          failure_reason?: string | null
          fulfilled_at?: string | null
          id?: string
          network_code: string
          order_status?: string
          paid_at?: string | null
          payment_status?: string
          profit?: number | null
          recipient_phone: string
          reseller_customer_price?: number | null
          reseller_earning?: number | null
          reseller_id?: string | null
          reseller_store_slug?: string | null
          reseller_wholesale_price?: number | null
          selling_price: number
          supplier_cost?: number | null
          supplier_order_id?: string | null
          supplier_response?: Json
          supplier_status?: string | null
          tracking_code?: string
          updated_at?: string
          validity_label?: string | null
        }
        Update: {
          bundle_id?: string | null
          bundle_name?: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string
          data_amount_mb?: number | null
          failure_reason?: string | null
          fulfilled_at?: string | null
          id?: string
          network_code?: string
          order_status?: string
          paid_at?: string | null
          payment_status?: string
          profit?: number | null
          recipient_phone?: string
          reseller_customer_price?: number | null
          reseller_earning?: number | null
          reseller_id?: string | null
          reseller_store_slug?: string | null
          reseller_wholesale_price?: number | null
          selling_price?: number
          supplier_cost?: number | null
          supplier_order_id?: string | null
          supplier_response?: Json
          supplier_status?: string | null
          tracking_code?: string
          updated_at?: string
          validity_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "reseller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          channel: string | null
          checkout_url: string | null
          created_at: string
          currency: string
          id: string
          order_id: string
          provider: string
          provider_reference: string | null
          provider_response: Json
          status: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          amount: number
          channel?: string | null
          checkout_url?: string | null
          created_at?: string
          currency?: string
          id?: string
          order_id: string
          provider?: string
          provider_reference?: string | null
          provider_response?: Json
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          amount?: number
          channel?: string | null
          checkout_url?: string | null
          created_at?: string
          currency?: string
          id?: string
          order_id?: string
          provider?: string
          provider_reference?: string | null
          provider_response?: Json
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          bundle_id: string | null
          bundle_name: string
          changed_by: string | null
          created_at: string
          id: string
          network_code: string
          new_price: number
          note: string | null
          old_price: number | null
        }
        Insert: {
          bundle_id?: string | null
          bundle_name: string
          changed_by?: string | null
          created_at?: string
          id?: string
          network_code: string
          new_price: number
          note?: string | null
          old_price?: number | null
        }
        Update: {
          bundle_id?: string | null
          bundle_name?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          network_code?: string
          new_price?: number
          note?: string | null
          old_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "price_history_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_bundle_prices: {
        Row: {
          bundle_id: string
          reseller_id: string
          selling_price: number
          updated_at: string
          updated_by: string | null
          wholesale_price: number
        }
        Insert: {
          bundle_id: string
          reseller_id: string
          selling_price: number
          updated_at?: string
          updated_by?: string | null
          wholesale_price: number
        }
        Update: {
          bundle_id?: string
          reseller_id?: string
          selling_price?: number
          updated_at?: string
          updated_by?: string | null
          wholesale_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "reseller_bundle_prices_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_bundle_prices_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "reseller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          momo_network: string | null
          momo_number: string | null
          phone: string
          status: string
          store_name: string
          store_slug: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          momo_network?: string | null
          momo_number?: string | null
          phone: string
          status?: string
          store_name: string
          store_slug: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          momo_network?: string | null
          momo_number?: string | null
          phone?: string
          status?: string
          store_name?: string
          store_slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      reseller_wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          order_id: string | null
          reseller_id: string
          transaction_type: string
          withdrawal_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          order_id?: string | null
          reseller_id: string
          transaction_type: string
          withdrawal_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          order_id?: string | null
          reseller_id?: string
          transaction_type?: string
          withdrawal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reseller_wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_wallet_transactions_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "reseller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_wallet_transactions_withdrawal_id_fkey"
            columns: ["withdrawal_id"]
            isOneToOne: false
            referencedRelation: "reseller_withdrawals"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_wholesale_prices: {
        Row: {
          bundle_id: string
          updated_at: string
          updated_by: string | null
          wholesale_price: number
        }
        Insert: {
          bundle_id: string
          updated_at?: string
          updated_by?: string | null
          wholesale_price: number
        }
        Update: {
          bundle_id?: string
          updated_at?: string
          updated_by?: string | null
          wholesale_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "reseller_wholesale_prices_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: true
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_withdrawals: {
        Row: {
          admin_note: string | null
          amount: number
          id: string
          momo_network: string
          momo_number: string
          payout_reference: string | null
          processed_at: string | null
          processed_by: string | null
          requested_at: string
          reseller_id: string
          status: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          id?: string
          momo_network: string
          momo_number: string
          payout_reference?: string | null
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string
          reseller_id: string
          status?: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          id?: string
          momo_network?: string
          momo_number?: string
          payout_reference?: string | null
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string
          reseller_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_withdrawals_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "reseller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          is_public: boolean
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          is_public?: boolean
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          is_public?: boolean
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      supplier_sync_logs: {
        Row: {
          created_at: string
          details: Json
          id: string
          items_received: number
          message: string | null
          status: string
          supplier: string
          sync_type: string
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: string
          items_received?: number
          message?: string | null
          status: string
          supplier?: string
          sync_type: string
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          items_received?: number
          message?: string | null
          status?: string
          supplier?: string
          sync_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_process_reseller_withdrawal: {
        Args: {
          p_admin_note: string
          p_internal_secret: string
          p_payout_reference: string
          p_status: string
          p_withdrawal_id: string
        }
        Returns: Json
      }
      claim_supplier_dispatch: {
        Args: { p_internal_secret: string; p_tracking_code: string }
        Returns: Json
      }
      confirm_paystack_payment: {
        Args: {
          p_amount_minor: number
          p_currency: string
          p_internal_secret: string
          p_provider_response: Json
          p_reference: string
        }
        Returns: Json
      }
      create_pending_bundle_order: {
        Args: {
          p_bundle_id: string
          p_customer_name: string
          p_customer_phone: string
          p_provider_reference: string
          p_recipient_phone: string
        }
        Returns: Json
      }
      is_mebundle_admin: { Args: never; Returns: boolean }
      record_supplier_submission: {
        Args: {
          p_internal_secret: string
          p_supplier_order_id: string
          p_supplier_response: Json
          p_supplier_status: string
          p_tracking_code: string
        }
        Returns: boolean
      }
      reseller_request_withdrawal: {
        Args: {
          p_amount: number
          p_internal_secret: string
          p_momo_network: string
          p_momo_number: string
          p_reseller_id: string
        }
        Returns: Json
      }
      track_mebundle_order: {
        Args: { p_phone: string; p_tracking_code: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
