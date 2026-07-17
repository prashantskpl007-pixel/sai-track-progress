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
      alert_resolutions: {
        Row: {
          alert_key: string
          customer_id: string | null
          id: string
          resolved_at: string
          resolved_by: string | null
        }
        Insert: {
          alert_key: string
          customer_id?: string | null
          id?: string
          resolved_at?: string
          resolved_by?: string | null
        }
        Update: {
          alert_key?: string
          customer_id?: string | null
          id?: string
          resolved_at?: string
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_resolutions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_name: string | null
          actor_user_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_name?: string | null
          actor_user_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_name?: string | null
          actor_user_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          agreement_charges: number | null
          agreement_downloaded_at: string | null
          agreement_pdf_path: string | null
          agreement_type: string
          application_number: string
          appointment_date: string | null
          appointment_location: string | null
          assigned_staff_id: string | null
          balance_amount: number | null
          created_at: string
          current_status: Database["public"]["Enums"]["registration_status"]
          customer_email: string | null
          customer_name: string
          id: string
          last_contacted_at: string | null
          mobile_number: string
          notes: string | null
          other_charges: number | null
          payment_amount: number | null
          payment_date: string | null
          payment_method: string | null
          payment_received: number | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          property_address: string | null
          registration_charges: number | null
          registration_date: string
          service_charges: number | null
          support_number: string | null
          total_amount: number | null
          updated_at: string
          user_id: string | null
          verification_partner_name: string | null
          verification_partner_user_id: string | null
        }
        Insert: {
          agreement_charges?: number | null
          agreement_downloaded_at?: string | null
          agreement_pdf_path?: string | null
          agreement_type: string
          application_number: string
          appointment_date?: string | null
          appointment_location?: string | null
          assigned_staff_id?: string | null
          balance_amount?: number | null
          created_at?: string
          current_status?: Database["public"]["Enums"]["registration_status"]
          customer_email?: string | null
          customer_name: string
          id?: string
          last_contacted_at?: string | null
          mobile_number: string
          notes?: string | null
          other_charges?: number | null
          payment_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
          payment_received?: number | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          property_address?: string | null
          registration_charges?: number | null
          registration_date?: string
          service_charges?: number | null
          support_number?: string | null
          total_amount?: number | null
          updated_at?: string
          user_id?: string | null
          verification_partner_name?: string | null
          verification_partner_user_id?: string | null
        }
        Update: {
          agreement_charges?: number | null
          agreement_downloaded_at?: string | null
          agreement_pdf_path?: string | null
          agreement_type?: string
          application_number?: string
          appointment_date?: string | null
          appointment_location?: string | null
          assigned_staff_id?: string | null
          balance_amount?: number | null
          created_at?: string
          current_status?: Database["public"]["Enums"]["registration_status"]
          customer_email?: string | null
          customer_name?: string
          id?: string
          last_contacted_at?: string | null
          mobile_number?: string
          notes?: string | null
          other_charges?: number | null
          payment_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
          payment_received?: number | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          property_address?: string | null
          registration_charges?: number | null
          registration_date?: string
          service_charges?: number | null
          support_number?: string | null
          total_amount?: number | null
          updated_at?: string
          user_id?: string | null
          verification_partner_name?: string | null
          verification_partner_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_notes: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          note_text: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          note_text: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          note_text?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_documents: {
        Row: {
          created_at: string
          customer_id: string
          document_type: Database["public"]["Enums"]["kyc_document_type"]
          file_name: string
          file_path: string
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          remarks: string | null
          updated_at: string
          uploaded_by: string | null
          uploaded_by_name: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          document_type: Database["public"]["Enums"]["kyc_document_type"]
          file_name: string
          file_path: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          remarks?: string | null
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          document_type?: Database["public"]["Enums"]["kyc_document_type"]
          file_name?: string
          file_path?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          remarks?: string | null
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kyc_documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          is_read: boolean
          message: string
          title: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          is_read?: boolean
          message: string
          title: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string
          designation: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          joining_date: string
          mobile_number: string
          profile_photo_url: string | null
          updated_at: string
          user_id: string | null
          username: string | null
        }
        Insert: {
          created_at?: string
          designation?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          joining_date?: string
          mobile_number: string
          profile_photo_url?: string | null
          updated_at?: string
          user_id?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string
          designation?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          joining_date?: string
          mobile_number?: string
          profile_photo_url?: string | null
          updated_at?: string
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      status_updates: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          remarks: string | null
          status: Database["public"]["Enums"]["registration_status"]
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          remarks?: string | null
          status: Database["public"]["Enums"]["registration_status"]
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          remarks?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "status_updates_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_cases: {
        Row: {
          actual_verification_date: string | null
          assigned_at: string | null
          assigned_partner_name: string | null
          assigned_partner_user_id: string | null
          completion_date: string | null
          created_at: string
          customer_id: string
          id: string
          missing_documents: string | null
          pending_work_details: string | null
          rejection_reason: string | null
          scheduled_date: string | null
          status: Database["public"]["Enums"]["verification_status"]
          updated_at: string
          verification_location: string | null
          verification_remarks: string | null
          verification_time: string | null
        }
        Insert: {
          actual_verification_date?: string | null
          assigned_at?: string | null
          assigned_partner_name?: string | null
          assigned_partner_user_id?: string | null
          completion_date?: string | null
          created_at?: string
          customer_id: string
          id?: string
          missing_documents?: string | null
          pending_work_details?: string | null
          rejection_reason?: string | null
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          updated_at?: string
          verification_location?: string | null
          verification_remarks?: string | null
          verification_time?: string | null
        }
        Update: {
          actual_verification_date?: string | null
          assigned_at?: string | null
          assigned_partner_name?: string | null
          assigned_partner_user_id?: string | null
          completion_date?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          missing_documents?: string | null
          pending_work_details?: string | null
          rejection_reason?: string | null
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          updated_at?: string
          verification_location?: string | null
          verification_remarks?: string | null
          verification_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_cases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_documents: {
        Row: {
          created_at: string
          document_type: Database["public"]["Enums"]["verification_document_type"]
          file_name: string
          file_path: string
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          remarks: string | null
          uploaded_by: string | null
          uploaded_by_name: string | null
          verification_case_id: string
        }
        Insert: {
          created_at?: string
          document_type: Database["public"]["Enums"]["verification_document_type"]
          file_name: string
          file_path: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          remarks?: string | null
          uploaded_by?: string | null
          uploaded_by_name?: string | null
          verification_case_id: string
        }
        Update: {
          created_at?: string
          document_type?: Database["public"]["Enums"]["verification_document_type"]
          file_name?: string
          file_path?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          remarks?: string | null
          uploaded_by?: string | null
          uploaded_by_name?: string | null
          verification_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_documents_verification_case_id_fkey"
            columns: ["verification_case_id"]
            isOneToOne: false
            referencedRelation: "verification_cases"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_first_admin: { Args: { _user_id: string }; Returns: boolean }
      find_applications_by_mobile: {
        Args: { _mobile: string }
        Returns: {
          agreement_type: string
          application_number: string
          current_status: Database["public"]["Enums"]["registration_status"]
          customer_name: string
        }[]
      }
      get_handled_by: {
        Args: { _customer_id: string }
        Returns: {
          designation: string
          full_name: string
          mobile_number: string
          profile_photo_url: string
        }[]
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "customer"
        | "staff"
        | "owner"
        | "manager"
        | "verification_partner"
        | "viewer"
      kyc_document_type:
        | "aadhaar"
        | "pan"
        | "passport"
        | "driving_license"
        | "property_tax_receipt"
        | "electricity_bill"
        | "property_documents"
        | "photograph"
        | "other"
      payment_status: "pending" | "partial" | "paid"
      registration_status:
        | "application_created"
        | "documents_received"
        | "draft_prepared"
        | "appointment_scheduled"
        | "biometric_completed"
        | "registration_submitted"
        | "registration_completed"
        | "agreement_ready"
        | "kyc_uploaded"
        | "noc_initiated"
        | "noc_completed"
      verification_document_type:
        | "noc_certificate"
        | "police_verification"
        | "site_visit_photo"
        | "supporting"
      verification_status:
        | "pending_assignment"
        | "assigned"
        | "in_progress"
        | "additional_documents_required"
        | "on_hold"
        | "approved"
        | "rejected"
        | "completed"
        | "partial_completed"
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
      app_role: [
        "admin",
        "customer",
        "staff",
        "owner",
        "manager",
        "verification_partner",
        "viewer",
      ],
      kyc_document_type: [
        "aadhaar",
        "pan",
        "passport",
        "driving_license",
        "property_tax_receipt",
        "electricity_bill",
        "property_documents",
        "photograph",
        "other",
      ],
      payment_status: ["pending", "partial", "paid"],
      registration_status: [
        "application_created",
        "documents_received",
        "draft_prepared",
        "appointment_scheduled",
        "biometric_completed",
        "registration_submitted",
        "registration_completed",
        "agreement_ready",
        "kyc_uploaded",
        "noc_initiated",
        "noc_completed",
      ],
      verification_document_type: [
        "noc_certificate",
        "police_verification",
        "site_visit_photo",
        "supporting",
      ],
      verification_status: [
        "pending_assignment",
        "assigned",
        "in_progress",
        "additional_documents_required",
        "on_hold",
        "approved",
        "rejected",
        "completed",
        "partial_completed",
      ],
    },
  },
} as const
