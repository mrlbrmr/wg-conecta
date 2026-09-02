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
      peer_recognitions: {
        Row: {
          id: string
          to_employee_id: string
          from_employee_id: string | null
          message: string
          highlight: boolean
          status: string
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          to_employee_id: string
          from_employee_id?: string | null
          message: string
          highlight?: boolean
          status?: string
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          to_employee_id?: string
          from_employee_id?: string | null
          message?: string
          highlight?: boolean
          status?: string
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      announcement_reads: {
        Row: {
          id: string
          announcement_id: string
          employee_id: string
          read_at: string
        }
        Insert: {
          id?: string
          announcement_id: string
          employee_id: string
          read_at?: string
        }
        Update: {
          id?: string
          announcement_id?: string
          employee_id?: string
          read_at?: string
        }
        Relationships: []
      }
      announcement_reactions: {
        Row: {
          id: string
          announcement_id: string
          employee_id: string
          reaction: string
          created_at: string
        }
        Insert: {
          id?: string
          announcement_id: string
          employee_id: string
          reaction: string
          created_at?: string
        }
        Update: {
          id?: string
          announcement_id?: string
          employee_id?: string
          reaction?: string
          created_at?: string
        }
        Relationships: []
      }
      announcement_comments: {
        Row: {
          id: string
          announcement_id: string
          author_id: string | null
          body: string
          official: boolean
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          announcement_id: string
          author_id?: string | null
          body: string
          official?: boolean
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          announcement_id?: string
          author_id?: string | null
          body?: string
          official?: boolean
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      requests: {
        Row: {
          id: string
          protocol: number
          employee_id: string
          form_id: string | null
          title: string
          subject: string | null
          body: string | null
          status: string
          assignee_id: string | null
          due_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          protocol?: number
          employee_id: string
          form_id?: string | null
          title: string
          subject?: string | null
          body?: string | null
          status?: string
          assignee_id?: string | null
          due_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          protocol?: number
          employee_id?: string
          form_id?: string | null
          title?: string
          subject?: string | null
          body?: string | null
          status?: string
          assignee_id?: string | null
          due_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      request_messages: {
        Row: {
          id: string
          request_id: string
          author_id: string | null
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          request_id: string
          author_id?: string | null
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          request_id?: string
          author_id?: string | null
          body?: string
          created_at?: string
        }
        Relationships: []
      }
      onboarding_checklist_items: {
        Row: {
          id: string
          title: string
          detail: string | null
          stage: string
          deadline_label: string | null
          order_index: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          detail?: string | null
          stage?: string
          deadline_label?: string | null
          order_index?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          detail?: string | null
          stage?: string
          deadline_label?: string | null
          order_index?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      onboarding_progress: {
        Row: {
          id: string
          employee_id: string
          item_id: string
          done_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          item_id: string
          done_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          item_id?: string
          done_at?: string
        }
        Relationships: []
      }
      material_views: {
        Row: {
          id: string
          employee_id: string
          material_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          material_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          material_id?: string
          viewed_at?: string
        }
        Relationships: []
      }
      culture_photos: {
        Row: {
          id: string
          image_url: string
          title: string
          event_date: string | null
          unit: string | null
          order_index: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          image_url: string
          title: string
          event_date?: string | null
          unit?: string | null
          order_index?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          image_url?: string
          title?: string
          event_date?: string | null
          unit?: string | null
          order_index?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      culture_events: {
        Row: {
          id: string
          title: string
          detail: string | null
          event_date: string
          event_type: string
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          detail?: string | null
          event_date: string
          event_type?: string
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          detail?: string | null
          event_date?: string
          event_type?: string
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      anniversary_congrats: {
        Row: {
          id: string
          from_employee_id: string
          to_employee_id: string
          year: number
          created_at: string
        }
        Insert: {
          id?: string
          from_employee_id: string
          to_employee_id: string
          year: number
          created_at?: string
        }
        Update: {
          id?: string
          from_employee_id?: string
          to_employee_id?: string
          year?: number
          created_at?: string
        }
        Relationships: []
      }
      monthly_deadlines: {
        Row: {
          id: string
          label: string
          due_date: string
          order_index: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          label: string
          due_date: string
          order_index?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          label?: string
          due_date?: string
          order_index?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          id: string
          actor_id: string | null
          actor_label: string | null
          action: string
          resource: string
          resource_id: string | null
          summary: string | null
          created_at: string
        }
        Insert: {
          id?: string
          actor_id?: string | null
          actor_label?: string | null
          action: string
          resource: string
          resource_id?: string | null
          summary?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          actor_id?: string | null
          actor_label?: string | null
          action?: string
          resource?: string
          resource_id?: string | null
          summary?: string | null
          created_at?: string
        }
        Relationships: []
      }
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
          bio: string | null
          unit: string | null
          extension: string | null
          manager_id: string | null
          buddy_id: string | null
          id: string
          auth_user_id: string | null
          name: string
          email: string | null
          department: string | null
          job_title: string | null
          phone: string | null
          birth_date: string | null
          admission_date: string | null
          photo_url: string | null
          active: boolean
          invited_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          bio?: string | null
          unit?: string | null
          extension?: string | null
          manager_id?: string | null
          buddy_id?: string | null
          id?: string
          auth_user_id?: string | null
          name: string
          email?: string | null
          department?: string | null
          job_title?: string | null
          phone?: string | null
          birth_date?: string | null
          admission_date?: string | null
          photo_url?: string | null
          active?: boolean
          invited_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          bio?: string | null
          unit?: string | null
          extension?: string | null
          manager_id?: string | null
          buddy_id?: string | null
          id?: string
          auth_user_id?: string | null
          name?: string
          email?: string | null
          department?: string | null
          job_title?: string | null
          phone?: string | null
          birth_date?: string | null
          admission_date?: string | null
          photo_url?: string | null
          active?: boolean
          invited_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          lead: string | null
          author_name: string | null
          author_role: string | null
          headline: boolean
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
          lead?: string | null
          author_name?: string | null
          author_role?: string | null
          headline?: boolean
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
          lead?: string | null
          author_name?: string | null
          author_role?: string | null
          headline?: boolean
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
          featured: boolean
          next_date: string | null
          badge: string | null
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
          featured?: boolean
          next_date?: string | null
          badge?: string | null
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
          featured?: boolean
          next_date?: string | null
          badge?: string | null
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
          sla_days: number
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
          sla_days?: number
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
          sla_days?: number
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
          unit: string | null
          applications_deadline: string | null
          owner: string | null
          applicants_count: number
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
          unit?: string | null
          applications_deadline?: string | null
          owner?: string | null
          applicants_count?: number
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
          unit?: string | null
          applications_deadline?: string | null
          owner?: string | null
          applicants_count?: number
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
          duration_label: string | null
          material_type: string | null
          required: boolean
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
          duration_label?: string | null
          material_type?: string | null
          required?: boolean
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
          duration_label?: string | null
          material_type?: string | null
          required?: boolean
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
      employee_directory: {
        Row: {
          id: string
          name: string
          job_title: string | null
          department: string | null
          unit: string | null
          extension: string | null
          photo_url: string | null
          bio: string | null
          admission_date: string | null
          manager_id: string | null
          birthday_day: number | null
          birthday_month: number | null
        }
        Relationships: []
      }
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
