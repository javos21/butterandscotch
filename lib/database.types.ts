
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "blocked_dates": {
                  Row: {
                    "date": string,"note": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "date": string,"note"?: string | null
                  }
                  Update: {
                    "date"?: string,"note"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"delivery_areas": {
                  Row: {
                    "active": boolean,"fee_cents": number | null,"id": string,"name": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"fee_cents"?: number | null,"id"?: string,"name": string,"sort"?: number
                  }
                  Update: {
                    "active"?: boolean,"fee_cents"?: number | null,"id"?: string,"name"?: string,"sort"?: number
                  }
                  Relationships: [
                    
                  ]
                },"email_log": {
                  Row: {
                    "error": string | null,"id": string,"order_id": string | null,"provider_id": string | null,"sent_at": string,"template": string,"to_email": string
                  }
                  ComputedFields: never
                  Insert: {
                    "error"?: string | null,"id"?: string,"order_id"?: string | null,"provider_id"?: string | null,"sent_at"?: string,"template": string,"to_email": string
                  }
                  Update: {
                    "error"?: string | null,"id"?: string,"order_id"?: string | null,"provider_id"?: string | null,"sent_at"?: string,"template"?: string,"to_email"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "email_log_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"items": {
                  Row: {
                    "active": boolean,"allergen_note": string | null,"description": string | null,"flavours": (string)[],"id": string,"image_url": string | null,"max_qty": number,"name": string,"price_cents": number,"seasonal": boolean,"section_id": string,"sort": number,"unit_label": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"allergen_note"?: string | null,"description"?: string | null,"flavours"?: (string)[],"id"?: string,"image_url"?: string | null,"max_qty"?: number,"name": string,"price_cents": number,"seasonal"?: boolean,"section_id": string,"sort"?: number,"unit_label": string
                  }
                  Update: {
                    "active"?: boolean,"allergen_note"?: string | null,"description"?: string | null,"flavours"?: (string)[],"id"?: string,"image_url"?: string | null,"max_qty"?: number,"name"?: string,"price_cents"?: number,"seasonal"?: boolean,"section_id"?: string,"sort"?: number,"unit_label"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "items_section_id_fkey"
      columns: ["section_id"]
isOneToOne: false
      referencedRelation: "sections"
      referencedColumns: ["id"]
    }
                  ]
                },"order_adjustments": {
                  Row: {
                    "after_payment": boolean,"amount_cents": number,"created_at": string,"id": string,"order_id": string,"reason": string,"staff_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "after_payment"?: boolean,"amount_cents": number,"created_at"?: string,"id"?: string,"order_id": string,"reason": string,"staff_id"?: string | null
                  }
                  Update: {
                    "after_payment"?: boolean,"amount_cents"?: number,"created_at"?: string,"id"?: string,"order_id"?: string,"reason"?: string,"staff_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_adjustments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"order_events": {
                  Row: {
                    "created_at": string,"detail": NonNullable<Json>,"id": string,"kind": string,"order_id": string,"staff_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"detail"?: NonNullable<Json>,"id"?: string,"kind": string,"order_id": string,"staff_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"detail"?: NonNullable<Json>,"id"?: string,"kind"?: string,"order_id"?: string,"staff_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_events_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "flavour": string | null,"id": string,"item_id": string | null,"item_name": string,"order_id": string,"quantity": number,"unit_label": string,"unit_price_cents": number
                  }
                  ComputedFields: never
                  Insert: {
                    "flavour"?: string | null,"id"?: string,"item_id"?: string | null,"item_name": string,"order_id": string,"quantity": number,"unit_label": string,"unit_price_cents": number
                  }
                  Update: {
                    "flavour"?: string | null,"id"?: string,"item_id"?: string | null,"item_name"?: string,"order_id"?: string,"quantity"?: number,"unit_label"?: string,"unit_price_cents"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"order_notes": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"order_id": string,"staff_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"order_id": string,"staff_id"?: string | null
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"order_id"?: string,"staff_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_notes_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "access_token": string,"adjustments_cents": number,"allergies": string,"created_at": string,"customer_name": string,"delivery_address": string | null,"delivery_area_id": string | null,"delivery_area_name": string | null,"delivery_fee_cents": number | null,"email": string,"fulfil_date": string,"fulfilment": string,"id": string,"idempotency_key": string,"marketing_opt_in": boolean,"notes": string | null,"order_number": string,"payment_window_started_at": string | null,"phone": string,"policy_accepted_at": string,"policy_version": number,"reminder_sent_at": string | null,"status": string,"subtotal_cents": number,"total_cents": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "access_token": string,"adjustments_cents"?: number,"allergies": string,"created_at"?: string,"customer_name": string,"delivery_address"?: string | null,"delivery_area_id"?: string | null,"delivery_area_name"?: string | null,"delivery_fee_cents"?: number | null,"email": string,"fulfil_date": string,"fulfilment": string,"id"?: string,"idempotency_key": string,"marketing_opt_in"?: boolean,"notes"?: string | null,"order_number"?: string,"payment_window_started_at"?: string | null,"phone": string,"policy_accepted_at": string,"policy_version": number,"reminder_sent_at"?: string | null,"status"?: string,"subtotal_cents": number,"total_cents": number,"updated_at"?: string
                  }
                  Update: {
                    "access_token"?: string,"adjustments_cents"?: number,"allergies"?: string,"created_at"?: string,"customer_name"?: string,"delivery_address"?: string | null,"delivery_area_id"?: string | null,"delivery_area_name"?: string | null,"delivery_fee_cents"?: number | null,"email"?: string,"fulfil_date"?: string,"fulfilment"?: string,"id"?: string,"idempotency_key"?: string,"marketing_opt_in"?: boolean,"notes"?: string | null,"order_number"?: string,"payment_window_started_at"?: string | null,"phone"?: string,"policy_accepted_at"?: string,"policy_version"?: number,"reminder_sent_at"?: string | null,"status"?: string,"subtotal_cents"?: number,"total_cents"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_delivery_area_id_fkey"
      columns: ["delivery_area_id"]
isOneToOne: false
      referencedRelation: "delivery_areas"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_cents": number,"created_at": string,"id": string,"order_id": string,"receipt_path": string | null,"reference": string | null,"reject_reason": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"created_at"?: string,"id"?: string,"order_id": string,"receipt_path"?: string | null,"reference"?: string | null,"reject_reason"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"created_at"?: string,"id"?: string,"order_id"?: string,"receipt_path"?: string | null,"reference"?: string | null,"reject_reason"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"refunds": {
                  Row: {
                    "amount_cents": number,"created_at": string,"id": string,"note": string | null,"order_id": string,"refunded_on": string,"staff_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"created_at"?: string,"id"?: string,"note"?: string | null,"order_id": string,"refunded_on": string,"staff_id"?: string | null
                  }
                  Update: {
                    "amount_cents"?: number,"created_at"?: string,"id"?: string,"note"?: string | null,"order_id"?: string,"refunded_on"?: string,"staff_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "refunds_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"sections": {
                  Row: {
                    "id": string,"name": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"name": string,"sort"?: number
                  }
                  Update: {
                    "id"?: string,"name"?: string,"sort"?: number
                  }
                  Relationships: [
                    
                  ]
                },"settings": {
                  Row: {
                    "bank_details": NonNullable<Json>,"daily_order_cap": number,"id": number,"lead_time_days": number,"notify_email": string | null,"pickup_info": string,"policy_text": string,"policy_version": number,"store_open": boolean,"updated_at": string,"whatsapp_number": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bank_details"?: NonNullable<Json>,"daily_order_cap"?: number,"id"?: number,"lead_time_days"?: number,"notify_email"?: string | null,"pickup_info"?: string,"policy_text"?: string,"policy_version"?: number,"store_open"?: boolean,"updated_at"?: string,"whatsapp_number"?: string
                  }
                  Update: {
                    "bank_details"?: NonNullable<Json>,"daily_order_cap"?: number,"id"?: number,"lead_time_days"?: number,"notify_email"?: string | null,"pickup_info"?: string,"policy_text"?: string,"policy_version"?: number,"store_open"?: boolean,"updated_at"?: string,"whatsapp_number"?: string
                  }
                  Relationships: [
                    
                  ]
                },"staff": {
                  Row: {
                    "name": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "name": string,"user_id": string
                  }
                  Update: {
                    "name"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "public_settings": {
                  Row: {
                    "daily_order_cap": number,"lead_time_days": number,"pickup_info": string,"policy_text": string,"policy_version": number,"store_open": boolean,"whatsapp_number": string
                  }
                  ComputedFields: never
                  Insert: {
                           "daily_order_cap"?: number | null,"lead_time_days"?: number | null,"pickup_info"?: string | null,"policy_text"?: string | null,"policy_version"?: number | null,"store_open"?: boolean | null,"whatsapp_number"?: string | null
                         }
                        Update: {
                           "daily_order_cap"?: number | null,"lead_time_days"?: number | null,"pickup_info"?: string | null,"policy_text"?: string | null,"policy_version"?: number | null,"store_open"?: boolean | null,"whatsapp_number"?: string | null
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "create_order_with_items":
{ Args: { "items": Json,"order_data": Json }; Returns: {
              "access_token": string,"id": string,"order_number": string
            }[]
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"next_order_number":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"public_unavailable_dates":
{ Args: { "from_date": string,"to_date": string }; Returns: string[]
                           },
"staff_change_fulfil_date":
{ Args: { "p_new_date": string,"p_order_id": string,"p_override_cap": boolean }; Returns: string
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
