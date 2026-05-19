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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          section: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          section?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          section?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      admin_user_permissions: {
        Row: {
          created_at: string
          id: string
          permission: string
          permission_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission: string
          permission_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission?: string
          permission_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          password: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          password: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          password?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      agent_daily_closings: {
        Row: {
          closed_by: string | null
          closed_by_username: string | null
          closing_date: string
          created_at: string
          delivery_agent_id: string | null
          id: string
          net_amount: number
          notes: string | null
        }
        Insert: {
          closed_by?: string | null
          closed_by_username?: string | null
          closing_date: string
          created_at?: string
          delivery_agent_id?: string | null
          id?: string
          net_amount?: number
          notes?: string | null
        }
        Update: {
          closed_by?: string | null
          closed_by_username?: string | null
          closing_date?: string
          created_at?: string
          delivery_agent_id?: string | null
          id?: string
          net_amount?: number
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_daily_closings_delivery_agent_id_fkey"
            columns: ["delivery_agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_payments: {
        Row: {
          amount: number
          created_at: string
          delivery_agent_id: string | null
          id: string
          notes: string | null
          order_id: string | null
          payment_date: string
          payment_type: string
        }
        Insert: {
          amount?: number
          created_at?: string
          delivery_agent_id?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          payment_date?: string
          payment_type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          delivery_agent_id?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          payment_date?: string
          payment_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_payments_delivery_agent_id_fkey"
            columns: ["delivery_agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          product_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          product_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          product_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          active_template: string
          active_theme: string
          id: string
          invoice_name: string
          platform_name: string
          updated_at: string
        }
        Insert: {
          active_template?: string
          active_theme?: string
          id?: string
          invoice_name?: string
          platform_name?: string
          updated_at?: string
        }
        Update: {
          active_template?: string
          active_theme?: string
          id?: string
          invoice_name?: string
          platform_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      cashbox: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          opening_balance: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          opening_balance?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          opening_balance?: number
        }
        Relationships: []
      }
      cashbox_transactions: {
        Row: {
          amount: number
          cashbox_id: string | null
          created_at: string
          description: string | null
          id: string
          payment_method: string | null
          reason: string | null
          type: string
          user_id: string | null
          username: string | null
        }
        Insert: {
          amount?: number
          cashbox_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          payment_method?: string | null
          reason?: string | null
          type: string
          user_id?: string | null
          username?: string | null
        }
        Update: {
          amount?: number
          cashbox_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          payment_method?: string | null
          reason?: string | null
          type?: string
          user_id?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cashbox_transactions_cashbox_id_fkey"
            columns: ["cashbox_id"]
            isOneToOne: false
            referencedRelation: "cashbox"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          governorate: string | null
          id: string
          name: string
          phone: string | null
          phone2: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          governorate?: string | null
          id?: string
          name: string
          phone?: string | null
          phone2?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          governorate?: string | null
          id?: string
          name?: string
          phone?: string | null
          phone2?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      delivery_agents: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string | null
          serial_number: string | null
          total_owed: number
          total_paid: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          serial_number?: string | null
          total_owed?: number
          total_paid?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          serial_number?: string | null
          total_owed?: number
          total_paid?: number
        }
        Relationships: []
      }
      governorates: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          shipping_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          shipping_cost?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          shipping_cost?: number
          updated_at?: string
        }
        Relationships: []
      }
      offices: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          updated_at: string
          watermark_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          updated_at?: string
          watermark_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          updated_at?: string
          watermark_name?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          color: string | null
          created_at: string
          id: string
          order_id: string | null
          price: number
          product_details: string | null
          product_id: string | null
          quantity: number
          size: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          price?: number
          product_details?: string | null
          product_id?: string | null
          quantity?: number
          size?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          price?: number
          product_details?: string | null
          product_id?: string | null
          quantity?: number
          size?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          agent_shipping_cost: number
          assigned_at: string | null
          created_at: string
          customer_id: string | null
          delivery_agent_id: string | null
          discount: number
          governorate_id: string | null
          id: string
          notes: string | null
          order_details: string | null
          order_number: number
          shipping_cost: number
          status: Database["public"]["Enums"]["order_status"]
          total_amount: number
          tracking_code: string | null
          updated_at: string
        }
        Insert: {
          agent_shipping_cost?: number
          assigned_at?: string | null
          created_at?: string
          customer_id?: string | null
          delivery_agent_id?: string | null
          discount?: number
          governorate_id?: string | null
          id?: string
          notes?: string | null
          order_details?: string | null
          order_number?: number
          shipping_cost?: number
          status?: Database["public"]["Enums"]["order_status"]
          total_amount?: number
          tracking_code?: string | null
          updated_at?: string
        }
        Update: {
          agent_shipping_cost?: number
          assigned_at?: string | null
          created_at?: string
          customer_id?: string | null
          delivery_agent_id?: string | null
          discount?: number
          governorate_id?: string | null
          id?: string
          notes?: string | null
          order_details?: string | null
          order_number?: number
          shipping_cost?: number
          status?: Database["public"]["Enums"]["order_status"]
          total_amount?: number
          tracking_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_agent_id_fkey"
            columns: ["delivery_agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_governorate_id_fkey"
            columns: ["governorate_id"]
            isOneToOne: false
            referencedRelation: "governorates"
            referencedColumns: ["id"]
          },
        ]
      }
      product_color_variants: {
        Row: {
          color: string | null
          created_at: string
          id: string
          image_url: string | null
          product_id: string | null
          stock: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          product_id?: string | null
          stock?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          product_id?: string | null
          stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_color_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image_url: string
          product_id: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          product_id?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          color_options: string[]
          created_at: string
          description: string | null
          description_ar: string | null
          description_en: string | null
          details: string | null
          discount_price: number | null
          id: string
          image_url: string | null
          is_featured: boolean
          is_offer: boolean
          low_stock_threshold: number
          name: string
          name_ar: string | null
          name_en: string | null
          offer_price: number | null
          price: number
          quantity_pricing: Json
          rating: number
          reviews_count: number
          size_options: string[]
          size_pricing: Json
          stock: number
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          color_options?: string[]
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_en?: string | null
          details?: string | null
          discount_price?: number | null
          id?: string
          image_url?: string | null
          is_featured?: boolean
          is_offer?: boolean
          low_stock_threshold?: number
          name: string
          name_ar?: string | null
          name_en?: string | null
          offer_price?: number | null
          price?: number
          quantity_pricing?: Json
          rating?: number
          reviews_count?: number
          size_options?: string[]
          size_pricing?: Json
          stock?: number
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          color_options?: string[]
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_en?: string | null
          details?: string | null
          discount_price?: number | null
          id?: string
          image_url?: string | null
          is_featured?: boolean
          is_offer?: boolean
          low_stock_threshold?: number
          name?: string
          name_ar?: string | null
          name_en?: string | null
          offer_price?: number | null
          price?: number
          quantity_pricing?: Json
          rating?: number
          reviews_count?: number
          size_options?: string[]
          size_pricing?: Json
          stock?: number
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          created_at: string
          customer_id: string | null
          delivery_agent_id: string | null
          id: string
          notes: string | null
          order_id: string | null
          return_amount: number
          returned_items: Json
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          delivery_agent_id?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          return_amount?: number
          returned_items?: Json
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          delivery_agent_id?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          return_amount?: number
          returned_items?: Json
        }
        Relationships: [
          {
            foreignKeyName: "returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_delivery_agent_id_fkey"
            columns: ["delivery_agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          new_value: string | null
          old_value: string | null
          order_id: string | null
          session_id: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          order_id?: string | null
          session_id?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          order_id?: string | null
          session_id?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "scan_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_session_items: {
        Row: {
          id: string
          order_id: string | null
          scanned_at: string
          session_id: string | null
        }
        Insert: {
          id?: string
          order_id?: string | null
          scanned_at?: string
          session_id?: string | null
        }
        Update: {
          id?: string
          order_id?: string | null
          scanned_at?: string
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_session_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_session_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "scan_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_sessions: {
        Row: {
          ended_at: string | null
          id: string
          started_at: string
          status: string
          total_scanned: number
          user_id: string | null
          username: string | null
        }
        Insert: {
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: string
          total_scanned?: number
          user_id?: string | null
          username?: string | null
        }
        Update: {
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: string
          total_scanned?: number
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      statistics: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          metric: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          metric: string
          value?: number
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          metric?: string
          value?: number
        }
        Relationships: []
      }
      system_passwords: {
        Row: {
          id: string
          password: string
          updated_at: string
        }
        Insert: {
          id: string
          password: string
          updated_at?: string
        }
        Update: {
          id?: string
          password?: string
          updated_at?: string
        }
        Relationships: []
      }
      treasury: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          type: string
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          type: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      order_status:
        | "new"
        | "pending"
        | "processing"
        | "ready"
        | "picked_up"
        | "out_for_delivery"
        | "shipped"
        | "delivered"
        | "returned"
        | "return_no_shipping"
        | "failed"
        | "postponed"
        | "cancelled"
        | "agent_deleted"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      order_status: [
        "new",
        "pending",
        "processing",
        "ready",
        "picked_up",
        "out_for_delivery",
        "shipped",
        "delivered",
        "returned",
        "return_no_shipping",
        "failed",
        "postponed",
        "cancelled",
        "agent_deleted",
      ],
    },
  },
} as const
