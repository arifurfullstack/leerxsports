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
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          status: Database["public"]["Enums"]["comment_status"]
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          status?: Database["public"]["Enums"]["comment_status"]
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          status?: Database["public"]["Enums"]["comment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          status: Database["public"]["Enums"]["comment_status"]
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          status?: Database["public"]["Enums"]["comment_status"]
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          status?: Database["public"]["Enums"]["comment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          author_id: string
          body: string
          comment_count: number
          created_at: string
          hashtags: string[]
          id: string
          is_demo: boolean
          kind: Database["public"]["Enums"]["community_kind"]
          media: string[]
          respect_count: number
          status: Database["public"]["Enums"]["community_status"]
          title: string
          trainer_answered: boolean
          updated_at: string
        }
        Insert: {
          author_id: string
          body?: string
          comment_count?: number
          created_at?: string
          hashtags?: string[]
          id?: string
          is_demo?: boolean
          kind: Database["public"]["Enums"]["community_kind"]
          media?: string[]
          respect_count?: number
          status?: Database["public"]["Enums"]["community_status"]
          title: string
          trainer_answered?: boolean
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          comment_count?: number
          created_at?: string
          hashtags?: string[]
          id?: string
          is_demo?: boolean
          kind?: Database["public"]["Enums"]["community_kind"]
          media?: string[]
          respect_count?: number
          status?: Database["public"]["Enums"]["community_status"]
          title?: string
          trainer_answered?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      community_respects: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_respects_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          code: string
          created_at: string
          dial_code: string | null
          id: string
          is_enabled: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          dial_code?: string | null
          id?: string
          is_enabled?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          dial_code?: string | null
          id?: string
          is_enabled?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          created_at: string
          id: string
          media: string[]
          read_at: string | null
          sender_id: string
          text: string | null
          thread_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          media?: string[]
          read_at?: string | null
          sender_id: string
          text?: string | null
          thread_id: string
        }
        Update: {
          created_at?: string
          id?: string
          media?: string[]
          read_at?: string | null
          sender_id?: string
          text?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "dm_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_threads: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      feedback_credits: {
        Row: {
          created_at: string
          id: string
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["credit_status"]
          subscriber_id: string
          subscription_id: string
          trainer_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          period_end: string
          period_start?: string
          status?: Database["public"]["Enums"]["credit_status"]
          subscriber_id: string
          subscription_id: string
          trainer_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["credit_status"]
          subscriber_id?: string
          subscription_id?: string
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_credits_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          id: string
          trainer_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          id?: string
          trainer_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          id?: string
          trainer_id?: string
        }
        Relationships: []
      }
      languages: {
        Row: {
          code: string
          created_at: string
          id: string
          is_enabled: boolean
          name: string
          native_name: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          name: string
          native_name?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          name?: string
          native_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      moderation_actions: {
        Row: {
          action: Database["public"]["Enums"]["moderation_action"]
          actor_id: string | null
          automated: boolean
          created_at: string
          id: string
          metadata: Json
          reason: string | null
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Insert: {
          action: Database["public"]["Enums"]["moderation_action"]
          actor_id?: string | null
          automated?: boolean
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Update: {
          action?: Database["public"]["Enums"]["moderation_action"]
          actor_id?: string | null
          automated?: boolean
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target"]
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          email: Json
          in_app: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          email?: Json
          in_app?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          email?: Json
          in_app?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          metadata: Json
          read_at: string | null
          target_id: string | null
          target_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          metadata?: Json
          read_at?: string | null
          target_id?: string | null
          target_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          metadata?: Json
          read_at?: string | null
          target_id?: string | null
          target_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_gateways: {
        Row: {
          config: Json
          display_name: string
          enabled: boolean
          mode: string
          provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          display_name: string
          enabled?: boolean
          mode?: string
          provider: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          display_name?: string
          enabled?: boolean
          mode?: string
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      payment_webhook_events: {
        Row: {
          event_id: string
          event_type: string
          id: string
          payload: Json
          payout_id: string | null
          processed_at: string | null
          processing_error: string | null
          provider: string
          received_at: string
          status: string
          transaction_id: string | null
          verified: boolean
        }
        Insert: {
          event_id: string
          event_type: string
          id?: string
          payload?: Json
          payout_id?: string | null
          processed_at?: string | null
          processing_error?: string | null
          provider: string
          received_at?: string
          status?: string
          transaction_id?: string | null
          verified?: boolean
        }
        Update: {
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          payout_id?: string | null
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
          received_at?: string
          status?: string
          transaction_id?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "payment_webhook_events_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_webhook_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          currency: string
          id: string
          method: string
          method_details: Json
          requested_at: string
          resolved_at: string | null
          resolved_by: string | null
          statement_url: string | null
          status: string
          trainer_id: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          currency?: string
          id?: string
          method: string
          method_details?: Json
          requested_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          statement_url?: string | null
          status?: string
          trainer_id: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          method?: string
          method_details?: Json
          requested_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          statement_url?: string | null
          status?: string
          trainer_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          base_currency: string
          commission_bps: number
          dispute_window_hours: number
          id: boolean
          max_subscription_price: number
          min_payout_amount: number
          min_subscription_price: number
          tip_presets: number[]
          trainer_sla_hours: number
          updated_at: string
        }
        Insert: {
          base_currency?: string
          commission_bps?: number
          dispute_window_hours?: number
          id?: boolean
          max_subscription_price?: number
          min_payout_amount?: number
          min_subscription_price?: number
          tip_presets?: number[]
          trainer_sla_hours?: number
          updated_at?: string
        }
        Update: {
          base_currency?: string
          commission_bps?: number
          dispute_window_hours?: number
          id?: boolean
          max_subscription_price?: number
          min_payout_amount?: number
          min_subscription_price?: number
          tip_presets?: number[]
          trainer_sla_hours?: number
          updated_at?: string
        }
        Relationships: []
      }
      policies: {
        Row: {
          body_markdown: string
          created_at: string
          id: string
          published_at: string | null
          slug: string
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          body_markdown?: string
          created_at?: string
          id?: string
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string
          version?: string
        }
        Update: {
          body_markdown?: string
          created_at?: string
          id?: string
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      post_unlocks: {
        Row: {
          created_at: string
          currency: string
          id: string
          post_id: string
          price: number
          provider: string
          trainer_id: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          post_id: string
          price: number
          provider?: string
          trainer_id: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          post_id?: string
          price?: number
          provider?: string
          trainer_id?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_unlocks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_unlocks_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          caption: string | null
          comment_count: number
          created_at: string
          duration_seconds: number | null
          id: string
          is_demo: boolean
          is_hidden: boolean
          is_premium: boolean
          is_published: boolean
          kind: Database["public"]["Enums"]["post_kind"]
          media_url: string
          respect_count: number
          save_count: number
          thumbnail_url: string | null
          trainer_id: string
          unlock_price: number | null
          updated_at: string
          view_count: number
        }
        Insert: {
          caption?: string | null
          comment_count?: number
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_demo?: boolean
          is_hidden?: boolean
          is_premium?: boolean
          is_published?: boolean
          kind?: Database["public"]["Enums"]["post_kind"]
          media_url: string
          respect_count?: number
          save_count?: number
          thumbnail_url?: string | null
          trainer_id: string
          unlock_price?: number | null
          updated_at?: string
          view_count?: number
        }
        Update: {
          caption?: string | null
          comment_count?: number
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_demo?: boolean
          is_hidden?: boolean
          is_premium?: boolean
          is_published?: boolean
          kind?: Database["public"]["Enums"]["post_kind"]
          media_url?: string
          respect_count?: number
          save_count?: number
          thumbnail_url?: string | null
          trainer_id?: string
          unlock_price?: number | null
          updated_at?: string
          view_count?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          additional_languages: string[]
          agreement_accepted_at: string | null
          avatar_url: string | null
          avatar_urls: Json | null
          bio: string | null
          body_fat_percent: number | null
          country: string | null
          cover_url: string | null
          created_at: string
          display_name: string | null
          experience_level: string | null
          full_name: string | null
          gender: string | null
          goal: string | null
          height_cm: number | null
          id: string
          injuries: string | null
          is_demo: boolean
          is_verified: boolean
          native_language: string | null
          onboarding_completed: boolean
          personal_records: string | null
          preferred_language: string | null
          profile_visibility: string
          sidebar_collapsed: boolean
          skeletal_muscle_kg: number | null
          social_links: string[]
          transformation_visibility: string
          updated_at: string
          user_id: string
          username: string | null
          verified_at: string | null
          verified_by: string | null
          weight_kg: number | null
        }
        Insert: {
          additional_languages?: string[]
          agreement_accepted_at?: string | null
          avatar_url?: string | null
          avatar_urls?: Json | null
          bio?: string | null
          body_fat_percent?: number | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          experience_level?: string | null
          full_name?: string | null
          gender?: string | null
          goal?: string | null
          height_cm?: number | null
          id?: string
          injuries?: string | null
          is_demo?: boolean
          is_verified?: boolean
          native_language?: string | null
          onboarding_completed?: boolean
          personal_records?: string | null
          preferred_language?: string | null
          profile_visibility?: string
          sidebar_collapsed?: boolean
          skeletal_muscle_kg?: number | null
          social_links?: string[]
          transformation_visibility?: string
          updated_at?: string
          user_id: string
          username?: string | null
          verified_at?: string | null
          verified_by?: string | null
          weight_kg?: number | null
        }
        Update: {
          additional_languages?: string[]
          agreement_accepted_at?: string | null
          avatar_url?: string | null
          avatar_urls?: Json | null
          bio?: string | null
          body_fat_percent?: number | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          experience_level?: string | null
          full_name?: string | null
          gender?: string | null
          goal?: string | null
          height_cm?: number | null
          id?: string
          injuries?: string | null
          is_demo?: boolean
          is_verified?: boolean
          native_language?: string | null
          onboarding_completed?: boolean
          personal_records?: string | null
          preferred_language?: string | null
          profile_visibility?: string
          sidebar_collapsed?: boolean
          skeletal_muscle_kg?: number | null
          social_links?: string[]
          transformation_visibility?: string
          updated_at?: string
          user_id?: string
          username?: string | null
          verified_at?: string | null
          verified_by?: string | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      qa_dispatches: {
        Row: {
          answer: string | null
          answered_at: string | null
          created_at: string
          creator_id: string
          expires_at: string
          fan_id: string
          id: string
          price: number
          question: string
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          created_at?: string
          creator_id: string
          expires_at?: string
          fan_id: string
          id?: string
          price?: number
          question: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          created_at?: string
          creator_id?: string
          expires_at?: string
          fan_id?: string
          id?: string
          price?: number
          question?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reporter_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target"]
          updated_at?: string
        }
        Relationships: []
      }
      respects: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "respects_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      saves: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      shares: {
        Row: {
          channel: string | null
          created_at: string
          id: string
          post_id: string
          user_id: string | null
        }
        Insert: {
          channel?: string | null
          created_at?: string
          id?: string
          post_id: string
          user_id?: string | null
        }
        Update: {
          channel?: string | null
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          custom_head_html: string | null
          favicon_url: string | null
          footer_text: string | null
          id: boolean
          logo_dark_url: string | null
          logo_url: string | null
          meta_description: string
          meta_keywords: string | null
          meta_title: string
          og_description: string | null
          og_image_url: string | null
          og_title: string | null
          site_name: string
          social_facebook: string | null
          social_instagram: string | null
          social_linkedin: string | null
          social_tiktok: string | null
          social_twitter: string | null
          social_youtube: string | null
          support_email: string | null
          tagline: string
          theme_color: string
          twitter_handle: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          custom_head_html?: string | null
          favicon_url?: string | null
          footer_text?: string | null
          id?: boolean
          logo_dark_url?: string | null
          logo_url?: string | null
          meta_description?: string
          meta_keywords?: string | null
          meta_title?: string
          og_description?: string | null
          og_image_url?: string | null
          og_title?: string | null
          site_name?: string
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_tiktok?: string | null
          social_twitter?: string | null
          social_youtube?: string | null
          support_email?: string | null
          tagline?: string
          theme_color?: string
          twitter_handle?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          custom_head_html?: string | null
          favicon_url?: string | null
          footer_text?: string | null
          id?: boolean
          logo_dark_url?: string | null
          logo_url?: string | null
          meta_description?: string
          meta_keywords?: string | null
          meta_title?: string
          og_description?: string | null
          og_image_url?: string | null
          og_title?: string | null
          site_name?: string
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_tiktok?: string | null
          social_twitter?: string | null
          social_youtube?: string | null
          support_email?: string | null
          tagline?: string
          theme_color?: string
          twitter_handle?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      stories: {
        Row: {
          caption: string | null
          created_at: string
          duration_ms: number
          expires_at: string
          id: string
          is_hidden: boolean
          like_count: number
          media_kind: string
          media_url: string
          thumbnail_url: string | null
          user_id: string
          view_count: number
        }
        Insert: {
          caption?: string | null
          created_at?: string
          duration_ms?: number
          expires_at?: string
          id?: string
          is_hidden?: boolean
          like_count?: number
          media_kind: string
          media_url: string
          thumbnail_url?: string | null
          user_id: string
          view_count?: number
        }
        Update: {
          caption?: string | null
          created_at?: string
          duration_ms?: number
          expires_at?: string
          id?: string
          is_hidden?: boolean
          like_count?: number
          media_kind?: string
          media_url?: string
          thumbnail_url?: string | null
          user_id?: string
          view_count?: number
        }
        Relationships: []
      }
      story_likes: {
        Row: {
          created_at: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_likes_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          id: string
          story_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          id?: string
          story_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          id?: string
          story_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["subscription_event_kind"]
          metadata: Json
          subscription_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["subscription_event_kind"]
          metadata?: Json
          subscription_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["subscription_event_kind"]
          metadata?: Json
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          price: number
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_subscription_id: string | null
          subscriber_id: string
          trainer_id: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          price?: number
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_subscription_id?: string | null
          subscriber_id: string
          trainer_id: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          price?: number
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_subscription_id?: string | null
          subscriber_id?: string
          trainer_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          avatar_url: string | null
          body: string
          created_at: string
          id: string
          name: string
          published: boolean
          role: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          body: string
          created_at?: string
          id?: string
          name: string
          published?: boolean
          role: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          body?: string
          created_at?: string
          id?: string
          name?: string
          published?: boolean
          role?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      tips: {
        Row: {
          amount: number
          coaching_thread_id: string | null
          created_at: string
          currency: string
          from_user_id: string
          id: string
          message: string | null
          status: string
          trainer_id: string
          transaction_id: string | null
        }
        Insert: {
          amount: number
          coaching_thread_id?: string | null
          created_at?: string
          currency?: string
          from_user_id: string
          id?: string
          message?: string | null
          status?: string
          trainer_id: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          coaching_thread_id?: string | null
          created_at?: string
          currency?: string
          from_user_id?: string
          id?: string
          message?: string | null
          status?: string
          trainer_id?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tips_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_applications: {
        Row: {
          additional_languages: string[]
          admin_notes: string | null
          agreement_accepted_at: string
          biography: string
          certificates: string[]
          certification_details: string
          country: string
          created_at: string
          full_legal_name: string
          id: string
          id_doc_url: string | null
          native_language: string
          payout_info: Json
          public_trainer_name: string
          requested_price: number
          reviewed_at: string | null
          reviewed_by: string | null
          social_links: string[]
          specialties: string[]
          status: string
          updated_at: string
          user_id: string
          years_experience: number
        }
        Insert: {
          additional_languages?: string[]
          admin_notes?: string | null
          agreement_accepted_at?: string
          biography?: string
          certificates?: string[]
          certification_details?: string
          country: string
          created_at?: string
          full_legal_name: string
          id?: string
          id_doc_url?: string | null
          native_language: string
          payout_info?: Json
          public_trainer_name: string
          requested_price?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_links?: string[]
          specialties?: string[]
          status?: string
          updated_at?: string
          user_id: string
          years_experience?: number
        }
        Update: {
          additional_languages?: string[]
          admin_notes?: string | null
          agreement_accepted_at?: string
          biography?: string
          certificates?: string[]
          certification_details?: string
          country?: string
          created_at?: string
          full_legal_name?: string
          id?: string
          id_doc_url?: string | null
          native_language?: string
          payout_info?: Json
          public_trainer_name?: string
          requested_price?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_links?: string[]
          specialties?: string[]
          status?: string
          updated_at?: string
          user_id?: string
          years_experience?: number
        }
        Relationships: []
      }
      trainer_balances: {
        Row: {
          available_amount: number
          currency: string
          frozen_amount: number
          paid_out_amount: number
          pending_amount: number
          trainer_id: string
          updated_at: string
        }
        Insert: {
          available_amount?: number
          currency?: string
          frozen_amount?: number
          paid_out_amount?: number
          pending_amount?: number
          trainer_id: string
          updated_at?: string
        }
        Update: {
          available_amount?: number
          currency?: string
          frozen_amount?: number
          paid_out_amount?: number
          pending_amount?: number
          trainer_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      trainer_profiles: {
        Row: {
          created_at: string
          dms_enabled: boolean
          is_demo: boolean
          is_verified: boolean
          monetization_enabled: boolean
          specialties: string[]
          strike_count: number
          subscription_price: number
          updated_at: string
          user_id: string
          value_proposition: string
        }
        Insert: {
          created_at?: string
          dms_enabled?: boolean
          is_demo?: boolean
          is_verified?: boolean
          monetization_enabled?: boolean
          specialties?: string[]
          strike_count?: number
          subscription_price?: number
          updated_at?: string
          user_id: string
          value_proposition?: string
        }
        Update: {
          created_at?: string
          dms_enabled?: boolean
          is_demo?: boolean
          is_verified?: boolean
          monetization_enabled?: boolean
          specialties?: string[]
          strike_count?: number
          subscription_price?: number
          updated_at?: string
          user_id?: string
          value_proposition?: string
        }
        Relationships: []
      }
      trainer_strikes: {
        Row: {
          created_at: string
          dispute_id: string | null
          expires_at: string | null
          id: string
          issued_by: string | null
          moderation_action_id: string | null
          reason: string
          revoked_at: string | null
          status: Database["public"]["Enums"]["strike_status"]
          trainer_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dispute_id?: string | null
          expires_at?: string | null
          id?: string
          issued_by?: string | null
          moderation_action_id?: string | null
          reason: string
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["strike_status"]
          trainer_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dispute_id?: string | null
          expires_at?: string | null
          id?: string
          issued_by?: string | null
          moderation_action_id?: string | null
          reason?: string
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["strike_status"]
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_strikes_moderation_action_id_fkey"
            columns: ["moderation_action_id"]
            isOneToOne: false
            referencedRelation: "moderation_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          created_at: string
          currency: string
          gross: number
          id: string
          kind: string
          metadata: Json
          payer_id: string | null
          platform_fee: number
          status: string
          stripe_payment_intent_id: string | null
          subscription_id: string | null
          tip_id: string | null
          trainer_amount: number
          trainer_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          gross: number
          id?: string
          kind: string
          metadata?: Json
          payer_id?: string | null
          platform_fee: number
          status?: string
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
          tip_id?: string | null
          trainer_amount: number
          trainer_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          gross?: number
          id?: string
          kind?: string
          metadata?: Json
          payer_id?: string | null
          platform_fee?: number
          status?: string
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
          tip_id?: string | null
          trainer_amount?: number
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      transformation_posts: {
        Row: {
          body_fat_percent: number | null
          captured_on: string
          created_at: string
          id: string
          is_demo: boolean
          is_hidden: boolean
          kind: string
          media_url: string
          notes: string | null
          thumbnail_url: string | null
          updated_at: string
          user_id: string
          view_angle: string
          visibility: string
          weight_kg: number | null
        }
        Insert: {
          body_fat_percent?: number | null
          captured_on: string
          created_at?: string
          id?: string
          is_demo?: boolean
          is_hidden?: boolean
          kind?: string
          media_url: string
          notes?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
          view_angle?: string
          visibility?: string
          weight_kg?: number | null
        }
        Update: {
          body_fat_percent?: number | null
          captured_on?: string
          created_at?: string
          id?: string
          is_demo?: boolean
          is_hidden?: boolean
          kind?: string
          media_url?: string
          notes?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
          view_angle?: string
          visibility?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      translations_cache: {
        Row: {
          created_at: string
          source_hash: string
          source_lang: string | null
          target_lang: string
          translated_text: string
        }
        Insert: {
          created_at?: string
          source_hash: string
          source_lang?: string | null
          target_lang: string
          translated_text: string
        }
        Update: {
          created_at?: string
          source_hash?: string
          source_lang?: string | null
          target_lang?: string
          translated_text?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_upload_stats: {
        Row: {
          total_bytes: number
          updated_at: string
          uploads_day: string
          uploads_today: number
          user_id: string
        }
        Insert: {
          total_bytes?: number
          updated_at?: string
          uploads_day?: string
          uploads_today?: number
          user_id: string
        }
        Update: {
          total_bytes?: number
          updated_at?: string
          uploads_day?: string
          uploads_today?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_notification: {
        Args: {
          _actor_id?: string
          _body?: string
          _link?: string
          _metadata?: Json
          _target_id?: string
          _target_type?: string
          _title: string
          _type: string
          _user_id: string
        }
        Returns: string
      }
      get_upload_quota: { Args: never; Returns: Json }
      has_active_subscription: {
        Args: { _subscriber_id: string; _trainer_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_post_view: { Args: { p_post_id: string }; Returns: undefined }
      try_record_upload: { Args: { _bytes: number }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "trainee" | "trainer"
      coaching_message_kind:
        | "primary_question"
        | "primary_response"
        | "follow_up"
        | "final_response"
      coaching_participant_role: "trainee" | "trainer"
      coaching_status:
        | "draft"
        | "pending"
        | "coached"
        | "follow_up_submitted"
        | "final_response_submitted"
        | "coaching_completed"
        | "cancelled"
      comment_status: "visible" | "hidden" | "deleted"
      community_kind: "question" | "flex"
      community_status: "visible" | "hidden" | "removed"
      credit_status:
        | "available"
        | "in_use"
        | "consumed"
        | "expired"
        | "restored"
      dispute_status:
        | "open"
        | "under_review"
        | "resolved_trainer"
        | "resolved_trainee"
        | "withdrawn"
      moderation_action: "hide" | "restore" | "remove" | "warn"
      post_kind: "feed" | "short"
      report_reason:
        | "nudity"
        | "abuse"
        | "spam"
        | "misinformation"
        | "ip_violation"
        | "self_harm"
        | "other"
      report_status: "open" | "reviewed" | "actioned" | "dismissed"
      report_target:
        | "post"
        | "comment"
        | "community_post"
        | "community_comment"
        | "profile"
        | "coaching_thread"
        | "transformation"
        | "short"
      strike_status: "active" | "expired" | "revoked"
      subscription_event_kind:
        | "created"
        | "renewed"
        | "cancelled"
        | "expired"
        | "payment_failed"
        | "refunded"
        | "reactivated"
      subscription_status:
        | "trial"
        | "active"
        | "past_due"
        | "grace"
        | "cancelled"
        | "expired"
        | "refunded"
        | "suspended"
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
      app_role: ["admin", "moderator", "user", "trainee", "trainer"],
      coaching_message_kind: [
        "primary_question",
        "primary_response",
        "follow_up",
        "final_response",
      ],
      coaching_participant_role: ["trainee", "trainer"],
      coaching_status: [
        "draft",
        "pending",
        "coached",
        "follow_up_submitted",
        "final_response_submitted",
        "coaching_completed",
        "cancelled",
      ],
      comment_status: ["visible", "hidden", "deleted"],
      community_kind: ["question", "flex"],
      community_status: ["visible", "hidden", "removed"],
      credit_status: ["available", "in_use", "consumed", "expired", "restored"],
      dispute_status: [
        "open",
        "under_review",
        "resolved_trainer",
        "resolved_trainee",
        "withdrawn",
      ],
      moderation_action: ["hide", "restore", "remove", "warn"],
      post_kind: ["feed", "short"],
      report_reason: [
        "nudity",
        "abuse",
        "spam",
        "misinformation",
        "ip_violation",
        "self_harm",
        "other",
      ],
      report_status: ["open", "reviewed", "actioned", "dismissed"],
      report_target: [
        "post",
        "comment",
        "community_post",
        "community_comment",
        "profile",
        "coaching_thread",
        "transformation",
        "short",
      ],
      strike_status: ["active", "expired", "revoked"],
      subscription_event_kind: [
        "created",
        "renewed",
        "cancelled",
        "expired",
        "payment_failed",
        "refunded",
        "reactivated",
      ],
      subscription_status: [
        "trial",
        "active",
        "past_due",
        "grace",
        "cancelled",
        "expired",
        "refunded",
        "suspended",
      ],
    },
  },
} as const
