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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action_type: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          new_values: Json | null
          old_values: Json | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      activity_reactions: {
        Row: {
          activity_id: string
          created_at: string
          id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          id?: string
          reaction_type: string
          user_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_reactions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activity_log"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_sectors: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      agencies: {
        Row: {
          active: boolean
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          id: string
          kdrive_drive_id: number | null
          kdrive_folder_id: string | null
          kdrive_folder_path: string | null
          logo_url: string | null
          main_contact_id: string | null
          name: string
          revenue: number | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kdrive_drive_id?: number | null
          kdrive_folder_id?: string | null
          kdrive_folder_path?: string | null
          logo_url?: string | null
          main_contact_id?: string | null
          name: string
          revenue?: number | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kdrive_drive_id?: number | null
          kdrive_folder_id?: string | null
          kdrive_folder_path?: string | null
          logo_url?: string | null
          main_contact_id?: string | null
          name?: string
          revenue?: number | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agencies_main_contact_id_fkey"
            columns: ["main_contact_id"]
            isOneToOne: false
            referencedRelation: "agency_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_contacts: {
        Row: {
          agency_id: string
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_contacts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_members: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_members_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_tags: {
        Row: {
          color: string
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          color: string
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      chat_message_mentions: {
        Row: {
          created_at: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_mentions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_message_reads: {
        Row: {
          created_at: string
          id: string
          last_read_at: string
          room_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_read_at?: string
          room_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_read_at?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_reads_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          content: string
          created_at: string
          id: string
          room_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content: string
          created_at?: string
          id?: string
          room_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string
          created_at?: string
          id?: string
          room_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_room_members: {
        Row: {
          id: string
          joined_at: string
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          created_at: string
          id: string
          name: string | null
          project_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          project_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          project_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_rooms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          title: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_sources: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      client_statuses: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          action: string | null
          active: boolean
          activity_sector_id: string | null
          company: string
          created_at: string
          email: string
          facturation_pro_id: string | null
          facturation_pro_synced_at: string | null
          first_name: string
          follow_up_date: string | null
          id: string
          kanban_stage: string
          kdrive_drive_id: number | null
          kdrive_folder_id: string | null
          kdrive_folder_path: string | null
          last_contact: string | null
          last_name: string
          linkedin_connected: boolean
          logo_url: string | null
          main_contact_id: string | null
          phone: string | null
          revenue: number | null
          revenue_current_year: number | null
          source_id: string | null
          status_id: string | null
          updated_at: string
        }
        Insert: {
          action?: string | null
          active?: boolean
          activity_sector_id?: string | null
          company: string
          created_at?: string
          email: string
          facturation_pro_id?: string | null
          facturation_pro_synced_at?: string | null
          first_name: string
          follow_up_date?: string | null
          id?: string
          kanban_stage?: string
          kdrive_drive_id?: number | null
          kdrive_folder_id?: string | null
          kdrive_folder_path?: string | null
          last_contact?: string | null
          last_name: string
          linkedin_connected?: boolean
          logo_url?: string | null
          main_contact_id?: string | null
          phone?: string | null
          revenue?: number | null
          revenue_current_year?: number | null
          source_id?: string | null
          status_id?: string | null
          updated_at?: string
        }
        Update: {
          action?: string | null
          active?: boolean
          activity_sector_id?: string | null
          company?: string
          created_at?: string
          email?: string
          facturation_pro_id?: string | null
          facturation_pro_synced_at?: string | null
          first_name?: string
          follow_up_date?: string | null
          id?: string
          kanban_stage?: string
          kdrive_drive_id?: number | null
          kdrive_folder_id?: string | null
          kdrive_folder_path?: string | null
          last_contact?: string | null
          last_name?: string
          linkedin_connected?: boolean
          logo_url?: string | null
          main_contact_id?: string | null
          phone?: string | null
          revenue?: number | null
          revenue_current_year?: number | null
          source_id?: string | null
          status_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_activity_sector_id_fkey"
            columns: ["activity_sector_id"]
            isOneToOne: false
            referencedRelation: "activity_sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_main_contact_id_fkey"
            columns: ["main_contact_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "client_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "client_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      design_settings: {
        Row: {
          body_font: string
          body_font_size: string | null
          body_font_weight: string | null
          created_at: string
          dark_background: string
          dark_primary: string
          dark_secondary: string
          heading_font: string
          heading_font_size: string | null
          heading_font_weight: string | null
          id: string
          light_background: string
          light_primary: string
          light_secondary: string
          updated_at: string
        }
        Insert: {
          body_font?: string
          body_font_size?: string | null
          body_font_weight?: string | null
          created_at?: string
          dark_background?: string
          dark_primary?: string
          dark_secondary?: string
          heading_font?: string
          heading_font_size?: string | null
          heading_font_weight?: string | null
          id?: string
          light_background?: string
          light_primary?: string
          light_secondary?: string
          updated_at?: string
        }
        Update: {
          body_font?: string
          body_font_size?: string | null
          body_font_weight?: string | null
          created_at?: string
          dark_background?: string
          dark_primary?: string
          dark_secondary?: string
          heading_font?: string
          heading_font_size?: string | null
          heading_font_weight?: string | null
          id?: string
          light_background?: string
          light_primary?: string
          light_secondary?: string
          updated_at?: string
        }
        Relationships: []
      }
      external_messages: {
        Row: {
          author_identifier: string
          author_name: string
          client_id: string | null
          content: string | null
          content_type: string
          created_at: string
          external_message_id: string | null
          group_id: string
          group_name: string | null
          id: string
          media_url: string | null
          project_id: string | null
          source: string
          timestamp: string
        }
        Insert: {
          author_identifier: string
          author_name: string
          client_id?: string | null
          content?: string | null
          content_type?: string
          created_at?: string
          external_message_id?: string | null
          group_id: string
          group_name?: string | null
          id?: string
          media_url?: string | null
          project_id?: string | null
          source?: string
          timestamp: string
        }
        Update: {
          author_identifier?: string
          author_name?: string
          client_id?: string | null
          content?: string | null
          content_type?: string
          created_at?: string
          external_message_id?: string | null
          group_id?: string
          group_name?: string | null
          id?: string
          media_url?: string | null
          project_id?: string | null
          source?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_categories: {
        Row: {
          color: string
          created_at: string
          display_order: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          display_order?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      faq_items: {
        Row: {
          allowed_roles: Database["public"]["Enums"]["app_role"][] | null
          category_id: string | null
          content: string
          created_at: string
          created_by: string | null
          display_order: number
          icon: string | null
          id: string
          pdf_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          allowed_roles?: Database["public"]["Enums"]["app_role"][] | null
          category_id?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          pdf_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          allowed_roles?: Database["public"]["Enums"]["app_role"][] | null
          category_id?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          pdf_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "faq_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "faq_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          facturation_pro_id: string | null
          facturation_pro_pdf_url: string | null
          id: string
          invoice_date: string | null
          invoice_number: string
          pdf_url: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          facturation_pro_id?: string | null
          facturation_pro_pdf_url?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number: string
          pdf_url?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          facturation_pro_id?: string | null
          facturation_pro_pdf_url?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string
          pdf_url?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_notes: {
        Row: {
          attachment_url: string | null
          client_id: string
          content: string
          created_at: string
          id: string
          is_private: boolean
          meeting_date: string | null
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attachment_url?: string | null
          client_id: string
          content: string
          created_at?: string
          id?: string
          is_private?: boolean
          meeting_date?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attachment_url?: string | null
          client_id?: string
          content?: string
          created_at?: string
          id?: string
          is_private?: boolean
          meeting_date?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          deadline_approaching: boolean
          id: string
          mention: boolean
          reaction: boolean
          task_assigned: boolean
          task_comment: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deadline_approaching?: boolean
          id?: string
          mention?: boolean
          reaction?: boolean
          task_assigned?: boolean
          task_comment?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deadline_approaching?: boolean
          id?: string
          mention?: boolean
          reaction?: boolean
          task_assigned?: boolean
          task_comment?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      pending_quote_actions: {
        Row: {
          actioned_at: string | null
          actioned_by: string | null
          amount: number | null
          created_at: string
          customer_id: number
          customer_name: string | null
          id: string
          linked_project_id: string | null
          quote_id: number
          quote_ref: string
          quote_title: string
          status: string
        }
        Insert: {
          actioned_at?: string | null
          actioned_by?: string | null
          amount?: number | null
          created_at?: string
          customer_id: number
          customer_name?: string | null
          id?: string
          linked_project_id?: string | null
          quote_id: number
          quote_ref: string
          quote_title: string
          status?: string
        }
        Update: {
          actioned_at?: string | null
          actioned_by?: string | null
          amount?: number | null
          created_at?: string
          customer_id?: number
          customer_name?: string | null
          id?: string
          linked_project_id?: string | null
          quote_id?: number
          quote_ref?: string
          quote_title?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_quote_actions_linked_project_id_fkey"
            columns: ["linked_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_agencies: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          project_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          project_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_agencies_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_agencies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          project_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          project_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          project_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_clients: {
        Row: {
          client_id: string
          created_at: string
          id: string
          project_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          project_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_clients_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          is_private: boolean
          project_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          is_private?: boolean
          project_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_private?: boolean
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_step_notifications: {
        Row: {
          created_at: string
          id: string
          notification_sent_at: string
          project_id: string
          step_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          notification_sent_at?: string
          project_id: string
          step_name: string
        }
        Update: {
          created_at?: string
          id?: string
          notification_sent_at?: string
          project_id?: string
          step_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_step_notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_team_members: {
        Row: {
          created_at: string
          id: string
          member_id: string
          member_type: Database["public"]["Enums"]["team_member_type"]
          project_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          member_type: Database["public"]["Enums"]["team_member_type"]
          project_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          member_type?: Database["public"]["Enums"]["team_member_type"]
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_team_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived: boolean
          created_at: string
          created_by: string | null
          date_brief: string | null
          date_concertation_agences: string | null
          date_montage_reco: string | null
          date_prise_en_main: string | null
          date_restitution: string | null
          description: string | null
          end_date: string | null
          id: string
          kdrive_drive_id: number | null
          kdrive_folder_id: string | null
          kdrive_folder_path: string | null
          name: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          created_by?: string | null
          date_brief?: string | null
          date_concertation_agences?: string | null
          date_montage_reco?: string | null
          date_prise_en_main?: string | null
          date_restitution?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          kdrive_drive_id?: number | null
          kdrive_folder_id?: string | null
          kdrive_folder_path?: string | null
          name: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          created_by?: string | null
          date_brief?: string | null
          date_concertation_agences?: string | null
          date_montage_reco?: string | null
          date_prise_en_main?: string | null
          date_restitution?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          kdrive_drive_id?: number | null
          kdrive_folder_id?: string | null
          kdrive_folder_path?: string | null
          name?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      prospection_email_logs: {
        Row: {
          created_at: string | null
          id: string
          recipient_email: string
          recipient_name: string | null
          sent_at: string | null
          status: string
          subject: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          user_id?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      quick_note_mentions: {
        Row: {
          created_at: string
          id: string
          note_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_note_mentions_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "quick_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          meeting_note_id: string | null
          task_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          meeting_note_id?: string | null
          task_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          meeting_note_id?: string | null
          task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_notes_meeting_note_id_fkey"
            columns: ["meeting_note_id"]
            isOneToOne: false
            referencedRelation: "meeting_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_notes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          id: string
          pdf_url: string | null
          quote_number: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          id?: string
          pdf_url?: string | null
          quote_number: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          id?: string
          pdf_url?: string | null
          quote_number?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          action: Database["public"]["Enums"]["permission_action"]
          created_at: string
          id: string
          module: Database["public"]["Enums"]["app_module"]
          role: Database["public"]["Enums"]["app_role"]
          scope: Database["public"]["Enums"]["permission_scope"] | null
          updated_at: string
        }
        Insert: {
          action: Database["public"]["Enums"]["permission_action"]
          created_at?: string
          id?: string
          module: Database["public"]["Enums"]["app_module"]
          role: Database["public"]["Enums"]["app_role"]
          scope?: Database["public"]["Enums"]["permission_scope"] | null
          updated_at?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["permission_action"]
          created_at?: string
          id?: string
          module?: Database["public"]["Enums"]["app_module"]
          role?: Database["public"]["Enums"]["app_role"]
          scope?: Database["public"]["Enums"]["permission_scope"] | null
          updated_at?: string
        }
        Relationships: []
      }
      task_agencies: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_agencies_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_agencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          attachment_url: string | null
          content: string
          created_at: string
          id: string
          parent_id: string | null
          project_id: string | null
          task_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attachment_url?: string | null
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          project_id?: string | null
          task_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attachment_url?: string | null
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          project_id?: string | null
          task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "task_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          position: number | null
          priority: string
          project_id: string | null
          start_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          position?: number | null
          priority?: string
          project_id?: string | null
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          position?: number | null
          priority?: string
          project_id?: string | null
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      todos: {
        Row: {
          completed: boolean
          created_at: string
          description: string | null
          id: string
          project_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          description?: string | null
          id?: string
          project_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          description?: string | null
          id?: string
          project_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "todos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_post_comment_mentions: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_post_comment_mentions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "user_post_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "user_post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "user_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_post_reactions: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reaction_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "user_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_posts: {
        Row: {
          content: string
          created_at: string
          embed_url: string | null
          id: string
          link_description: string | null
          link_image: string | null
          link_site_name: string | null
          link_title: string | null
          media_urls: string[] | null
          pdf_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          embed_url?: string | null
          id?: string
          link_description?: string | null
          link_image?: string | null
          link_site_name?: string | null
          link_title?: string | null
          media_urls?: string[] | null
          pdf_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          embed_url?: string | null
          id?: string
          link_description?: string | null
          link_image?: string | null
          link_site_name?: string | null
          link_title?: string | null
          media_urls?: string[] | null
          pdf_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_permission: {
        Args: {
          _action: Database["public"]["Enums"]["permission_action"]
          _module: Database["public"]["Enums"]["app_module"]
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
      is_room_member: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      notify_upcoming_deadlines: { Args: never; Returns: undefined }
    }
    Enums: {
      app_module:
        | "dashboard"
        | "crm"
        | "agencies"
        | "projects"
        | "tasks"
        | "settings"
        | "faq"
        | "messages"
        | "settings_profile"
        | "settings_security"
        | "settings_notifications"
        | "settings_users"
        | "settings_permissions"
        | "settings_data"
        | "settings_design"
        | "settings_faq"
        | "feed"
        | "prospection"
        | "notes"
      app_role: "admin" | "team" | "client" | "agency"
      permission_action: "read" | "create" | "update" | "delete"
      permission_scope: "all" | "limited" | "own"
      team_member_type:
        | "profile"
        | "agency_contact"
        | "client"
        | "client_contact"
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
      app_module: [
        "dashboard",
        "crm",
        "agencies",
        "projects",
        "tasks",
        "settings",
        "faq",
        "messages",
        "settings_profile",
        "settings_security",
        "settings_notifications",
        "settings_users",
        "settings_permissions",
        "settings_data",
        "settings_design",
        "settings_faq",
        "feed",
        "prospection",
        "notes",
      ],
      app_role: ["admin", "team", "client", "agency"],
      permission_action: ["read", "create", "update", "delete"],
      permission_scope: ["all", "limited", "own"],
      team_member_type: [
        "profile",
        "agency_contact",
        "client",
        "client_contact",
      ],
    },
  },
} as const
