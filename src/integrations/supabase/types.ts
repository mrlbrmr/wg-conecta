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
      admin_users: {
        Row: {
          active: boolean
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          id: string
          name: string
          email: string
          department: string | null
          job_title: string | null
          active: boolean
          invited_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          email: string
          department?: string | null
          job_title?: string | null
          active?: boolean
          invited_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          department?: string | null
          job_title?: string | null
          active?: boolean
          invited_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          attachment_url: string | null
          category: string | null
          content: string | null
          created_at: string
          expires_at: string | null
          id: string
          image_url: string | null
          important: boolean
          pinned: boolean
          published_at: string | null
          status: string
          summary: string | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          attachment_url?: string | null
          category?: string | null
          content?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          image_url?: string | null
          important?: boolean
          pinned?: boolean
          published_at?: string | null
          status?: string
          summary?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          attachment_url?: string | null
          category?: string | null
          content?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          image_url?: string | null
          important?: boolean
          pinned?: boolean
          published_at?: string | null
          status?: string
          summary?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      benefits: {
        Row: {
          active: boolean
          attachment_url: string | null
          created_at: string
          description: string | null
          eligibility: string | null
          external_url: string | null
          icon: string | null
          id: string
          image_url: string | null
          observation: string | null
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          attachment_url?: string | null
          created_at?: string
          description?: string | null
          eligibility?: string | null
          external_url?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          observation?: string | null
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          attachment_url?: string | null
          created_at?: string
          description?: string | null
          eligibility?: string | null
          external_url?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          observation?: string | null
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      birthdays: {
        Row: {
          active: boolean
          birthday_day: number
          birthday_month: number
          created_at: string
          id: string
          name: string
          photo_url: string | null
          role: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          birthday_day: number
          birthday_month: number
          created_at?: string
          id?: string
          name: string
          photo_url?: string | null
          role?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          birthday_day?: number
          birthday_month?: number
          created_at?: string
          id?: string
          name?: string
          photo_url?: string | null
          role?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          end_date: string | null
          external_url: string | null
          id: string
          image_url: string | null
          start_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          end_date?: string | null
          external_url?: string | null
          id?: string
          image_url?: string | null
          start_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          end_date?: string | null
          external_url?: string | null
          id?: string
          image_url?: string | null
          start_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          active: boolean
          area: string | null
          created_at: string
          description: string | null
          email: string | null
          id: string
          name: string
          order_index: number
          phone: string | null
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          area?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          name: string
          order_index?: number
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          area?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          name?: string
          order_index?: number
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          description: string | null
          featured: boolean
          file_url: string
          id: string
          published_at: string | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          file_url: string
          id?: string
          published_at?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          file_url?: string
          id?: string
          published_at?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      faq_items: {
        Row: {
          active: boolean
          answer: string
          category: string | null
          created_at: string
          id: string
          order_index: number
          question: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          answer: string
          category?: string | null
          created_at?: string
          id?: string
          order_index?: number
          question: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          answer?: string
          category?: string | null
          created_at?: string
          id?: string
          order_index?: number
          question?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      forms: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          description: string | null
          external_url: string
          icon: string | null
          id: string
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          external_url: string
          icon?: string | null
          id?: string
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          external_url?: string
          icon?: string | null
          id?: string
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      gg_pages: {
        Row: {
          active: boolean
          attachment_url: string | null
          body: string | null
          created_at: string
          external_url: string | null
          id: string
          page_key: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          attachment_url?: string | null
          body?: string | null
          created_at?: string
          external_url?: string | null
          id?: string
          page_key: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          attachment_url?: string | null
          body?: string | null
          created_at?: string
          external_url?: string | null
          id?: string
          page_key?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      internal_jobs: {
        Row: {
          created_at: string
          external_url: string | null
          id: string
          job_type: string | null
          location: string | null
          order_index: number
          published_at: string | null
          requirements: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_url?: string | null
          id?: string
          job_type?: string | null
          location?: string | null
          order_index?: number
          published_at?: string | null
          requirements?: string | null
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_url?: string | null
          id?: string
          job_type?: string | null
          location?: string | null
          order_index?: number
          published_at?: string | null
          requirements?: string | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      onboarding_materials: {
        Row: {
          active: boolean
          attachment_url: string | null
          category: string | null
          content: string | null
          created_at: string
          description: string | null
          external_url: string | null
          id: string
          image_url: string | null
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          attachment_url?: string | null
          category?: string | null
          content?: string | null
          created_at?: string
          description?: string | null
          external_url?: string | null
          id?: string
          image_url?: string | null
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          attachment_url?: string | null
          category?: string | null
          content?: string | null
          created_at?: string
          description?: string | null
          external_url?: string | null
          id?: string
          image_url?: string | null
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      portal_access: {
        Row: {
          access_code_hash: string | null
          id: string
          singleton: boolean
          updated_at: string
        }
        Insert: {
          access_code_hash?: string | null
          id?: string
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          access_code_hash?: string | null
          id?: string
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      portal_settings: {
        Row: {
          created_at: string
          footer_message: string
          gg_contact_text: string
          id: string
          logo_url: string | null
          portal_name: string
          primary_color: string
          privacy_notice: string
          singleton: boolean
          updated_at: string
          welcome_text: string
        }
        Insert: {
          created_at?: string
          footer_message?: string
          gg_contact_text?: string
          id?: string
          logo_url?: string | null
          portal_name?: string
          primary_color?: string
          privacy_notice?: string
          singleton?: boolean
          updated_at?: string
          welcome_text?: string
        }
        Update: {
          created_at?: string
          footer_message?: string
          gg_contact_text?: string
          id?: string
          logo_url?: string | null
          portal_name?: string
          primary_color?: string
          privacy_notice?: string
          singleton?: boolean
          updated_at?: string
          welcome_text?: string
        }
        Relationships: []
      }
      quick_links: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          order_index: number
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          order_index?: number
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          order_index?: number
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      recognitions: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          person_or_team: string
          recognition_date: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          person_or_team: string
          recognition_date?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          person_or_team?: string
          recognition_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      work_anniversaries: {
        Row: {
          active: boolean
          admission_date: string
          created_at: string
          id: string
          message: string | null
          name: string
          photo_url: string | null
          role: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          admission_date: string
          created_at?: string
          id?: string
          message?: string | null
          name: string
          photo_url?: string | null
          role?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          admission_date?: string
          created_at?: string
          id?: string
          message?: string | null
          name?: string
          photo_url?: string | null
          role?: string | null
          unit?: string | null
          updated_at?: string
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
    Enums: {},
  },
} as const
