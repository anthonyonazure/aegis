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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      adoption_benchmarks: {
        Row: {
          benchmark_type: string
          comparison_data: Json | null
          created_at: string
          customer_id: string | null
          id: string
          metrics: Json
          percentile: number | null
          user_id: string
        }
        Insert: {
          benchmark_type: string
          comparison_data?: Json | null
          created_at?: string
          customer_id?: string | null
          id?: string
          metrics?: Json
          percentile?: number | null
          user_id: string
        }
        Update: {
          benchmark_type?: string
          comparison_data?: Json | null
          created_at?: string
          customer_id?: string | null
          id?: string
          metrics?: Json
          percentile?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adoption_benchmarks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_analysis_results: {
        Row: {
          analysis_type: string
          created_at: string
          customer_id: string | null
          expires_at: string | null
          id: string
          recommendations: Json | null
          result: Json
          scheduled_job_id: string | null
          score: number | null
          tenant_connection_id: string | null
          user_id: string
        }
        Insert: {
          analysis_type: string
          created_at?: string
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          recommendations?: Json | null
          result: Json
          scheduled_job_id?: string | null
          score?: number | null
          tenant_connection_id?: string | null
          user_id: string
        }
        Update: {
          analysis_type?: string
          created_at?: string
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          recommendations?: Json | null
          result?: Json
          scheduled_job_id?: string | null
          score?: number | null
          tenant_connection_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_analysis_results_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analysis_results_scheduled_job_id_fkey"
            columns: ["scheduled_job_id"]
            isOneToOne: false
            referencedRelation: "ai_scheduled_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analysis_results_tenant_connection_id_fkey"
            columns: ["tenant_connection_id"]
            isOneToOne: false
            referencedRelation: "tenant_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_builder_models: {
        Row: {
          accuracy_score: number | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          display_name: string
          environment_id: string | null
          environment_name: string | null
          id: string
          last_trained: string | null
          metadata: Json | null
          model_id: string
          model_type: string
          status: string | null
          tenant_connection_id: string | null
          updated_at: string
          usage_count: number | null
          user_id: string
        }
        Insert: {
          accuracy_score?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          display_name: string
          environment_id?: string | null
          environment_name?: string | null
          id?: string
          last_trained?: string | null
          metadata?: Json | null
          model_id: string
          model_type: string
          status?: string | null
          tenant_connection_id?: string | null
          updated_at?: string
          usage_count?: number | null
          user_id: string
        }
        Update: {
          accuracy_score?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          display_name?: string
          environment_id?: string | null
          environment_name?: string | null
          id?: string
          last_trained?: string | null
          metadata?: Json | null
          model_id?: string
          model_type?: string
          status?: string | null
          tenant_connection_id?: string | null
          updated_at?: string
          usage_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_builder_models_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_builder_models_tenant_connection_id_fkey"
            columns: ["tenant_connection_id"]
            isOneToOne: false
            referencedRelation: "tenant_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          customer_id: string | null
          feature_type: string
          id: string
          model_id: string | null
          provider: string
          tenant_connection_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          feature_type: string
          id?: string
          model_id?: string | null
          provider?: string
          tenant_connection_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          feature_type?: string
          id?: string
          model_id?: string | null
          provider?: string
          tenant_connection_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_tenant_connection_id_fkey"
            columns: ["tenant_connection_id"]
            isOneToOne: false
            referencedRelation: "tenant_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_governance_policies: {
        Row: {
          created_at: string
          customer_id: string | null
          description: string | null
          enforcement_level: string | null
          id: string
          is_active: boolean | null
          last_enforced_at: string | null
          name: string
          policy_type: string
          settings: Json | null
          target_group_id: string | null
          target_tenant_ids: string[] | null
          target_type: string
          updated_at: string
          user_id: string
          violations_count: number | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          description?: string | null
          enforcement_level?: string | null
          id?: string
          is_active?: boolean | null
          last_enforced_at?: string | null
          name: string
          policy_type: string
          settings?: Json | null
          target_group_id?: string | null
          target_tenant_ids?: string[] | null
          target_type?: string
          updated_at?: string
          user_id: string
          violations_count?: number | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          description?: string | null
          enforcement_level?: string | null
          id?: string
          is_active?: boolean | null
          last_enforced_at?: string | null
          name?: string
          policy_type?: string
          settings?: Json | null
          target_group_id?: string | null
          target_tenant_ids?: string[] | null
          target_type?: string
          updated_at?: string
          user_id?: string
          violations_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_governance_policies_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_governance_policies_target_group_id_fkey"
            columns: ["target_group_id"]
            isOneToOne: false
            referencedRelation: "tenant_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_provider_settings: {
        Row: {
          api_endpoint: string | null
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          is_default: boolean
          model_id: string | null
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_endpoint?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          model_id?: string | null
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_endpoint?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          model_id?: string | null
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_scheduled_jobs: {
        Row: {
          created_at: string
          day_of_week: number | null
          frequency: Database["public"]["Enums"]["schedule_frequency"]
          id: string
          is_active: boolean
          last_run_at: string | null
          name: string
          next_run_at: string | null
          notification_channel_ids: string[] | null
          service_type: string
          tenant_connection_id: string | null
          time_of_day: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_of_week?: number | null
          frequency: Database["public"]["Enums"]["schedule_frequency"]
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          notification_channel_ids?: string[] | null
          service_type: string
          tenant_connection_id?: string | null
          time_of_day?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number | null
          frequency?: Database["public"]["Enums"]["schedule_frequency"]
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          notification_channel_ids?: string[] | null
          service_type?: string
          tenant_connection_id?: string | null
          time_of_day?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_scheduled_jobs_tenant_connection_id_fkey"
            columns: ["tenant_connection_id"]
            isOneToOne: false
            referencedRelation: "tenant_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string | null
          tenant_connection_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          tenant_connection_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          tenant_connection_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_connection_id_fkey"
            columns: ["tenant_connection_id"]
            isOneToOne: false
            referencedRelation: "tenant_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      automated_backup_configs: {
        Row: {
          auto_cleanup: boolean
          backup_type: string
          created_at: string
          description: string | null
          formats: string[]
          id: string
          is_active: boolean
          last_run_at: string | null
          last_run_success: boolean | null
          max_backups: number
          name: string
          next_run_at: string | null
          resource_ids: string[]
          retention_days: number
          run_count: number
          schedule_cron: string
          schedule_description: string | null
          target_customer_id: string | null
          target_group_id: string | null
          target_tenant_ids: string[] | null
          target_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_cleanup?: boolean
          backup_type?: string
          created_at?: string
          description?: string | null
          formats?: string[]
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          last_run_success?: boolean | null
          max_backups?: number
          name: string
          next_run_at?: string | null
          resource_ids?: string[]
          retention_days?: number
          run_count?: number
          schedule_cron?: string
          schedule_description?: string | null
          target_customer_id?: string | null
          target_group_id?: string | null
          target_tenant_ids?: string[] | null
          target_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_cleanup?: boolean
          backup_type?: string
          created_at?: string
          description?: string | null
          formats?: string[]
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          last_run_success?: boolean | null
          max_backups?: number
          name?: string
          next_run_at?: string | null
          resource_ids?: string[]
          retention_days?: number
          run_count?: number
          schedule_cron?: string
          schedule_description?: string | null
          target_customer_id?: string | null
          target_group_id?: string | null
          target_tenant_ids?: string[] | null
          target_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automated_backup_configs_target_customer_id_fkey"
            columns: ["target_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automated_backup_configs_target_group_id_fkey"
            columns: ["target_group_id"]
            isOneToOne: false
            referencedRelation: "tenant_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      automated_backup_runs: {
        Row: {
          completed_at: string | null
          completed_tenants: number
          config_id: string
          created_at: string
          error_message: string | null
          expires_at: string | null
          export_job_ids: string[] | null
          failed_tenants: number
          id: string
          results: Json | null
          started_at: string | null
          status: string
          total_resources: number
          total_tenants: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_tenants?: number
          config_id: string
          created_at?: string
          error_message?: string | null
          expires_at?: string | null
          export_job_ids?: string[] | null
          failed_tenants?: number
          id?: string
          results?: Json | null
          started_at?: string | null
          status?: string
          total_resources?: number
          total_tenants?: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_tenants?: number
          config_id?: string
          created_at?: string
          error_message?: string | null
          expires_at?: string | null
          export_job_ids?: string[] | null
          failed_tenants?: number
          id?: string
          results?: Json | null
          started_at?: string | null
          status?: string
          total_resources?: number
          total_tenants?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automated_backup_runs_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "automated_backup_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_job_runs: {
        Row: {
          automation_config_id: string
          azure_job_id: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          output: Json | null
          resource_types: string[]
          started_at: string | null
          status: string
          tenant_connection_id: string | null
          user_id: string
        }
        Insert: {
          automation_config_id: string
          azure_job_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          output?: Json | null
          resource_types?: string[]
          started_at?: string | null
          status?: string
          tenant_connection_id?: string | null
          user_id: string
        }
        Update: {
          automation_config_id?: string
          azure_job_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          output?: Json | null
          resource_types?: string[]
          started_at?: string | null
          status?: string
          tenant_connection_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_job_runs_automation_config_id_fkey"
            columns: ["automation_config_id"]
            isOneToOne: false
            referencedRelation: "azure_automation_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_job_runs_tenant_connection_id_fkey"
            columns: ["tenant_connection_id"]
            isOneToOne: false
            referencedRelation: "tenant_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      azure_automation_configs: {
        Row: {
          automation_account_name: string
          connection_status: string | null
          created_at: string
          id: string
          is_active: boolean
          last_tested_at: string | null
          name: string
          resource_group: string
          runbook_name: string
          subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          automation_account_name: string
          connection_status?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_tested_at?: string | null
          name: string
          resource_group: string
          runbook_name?: string
          subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          automation_account_name?: string
          connection_status?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_tested_at?: string | null
          name?: string
          resource_group?: string
          runbook_name?: string
          subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      billing_usage: {
        Row: {
          billable_amount: number | null
          created_at: string
          customer_id: string | null
          id: string
          notes: string | null
          period_end: string
          period_start: string
          resource_counts: Json
          total_devices: number
          total_resources: number
          total_users: number
          updated_at: string
          user_id: string
        }
        Insert: {
          billable_amount?: number | null
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          resource_counts?: Json
          total_devices?: number
          total_resources?: number
          total_users?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          billable_amount?: number | null
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          resource_counts?: Json
          total_devices?: number
          total_resources?: number
          total_users?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_usage_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_results: {
        Row: {
          baseline_name: string
          completed_at: string | null
          created_at: string
          export_job_id: string | null
          failed_count: number
          id: string
          passed_count: number
          results: Json | null
          status: string
          total_checks: number
          user_id: string
          warning_count: number
        }
        Insert: {
          baseline_name: string
          completed_at?: string | null
          created_at?: string
          export_job_id?: string | null
          failed_count?: number
          id?: string
          passed_count?: number
          results?: Json | null
          status?: string
          total_checks?: number
          user_id: string
          warning_count?: number
        }
        Update: {
          baseline_name?: string
          completed_at?: string | null
          created_at?: string
          export_job_id?: string | null
          failed_count?: number
          id?: string
          passed_count?: number
          results?: Json | null
          status?: string
          total_checks?: number
          user_id?: string
          warning_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "compliance_results_export_job_id_fkey"
            columns: ["export_job_id"]
            isOneToOne: false
            referencedRelation: "export_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_feedback: {
        Row: {
          common_issues: Json | null
          created_at: string
          customer_id: string | null
          feedback_by_app: Json | null
          id: string
          period_end: string
          period_start: string
          recorded_at: string
          satisfaction_score: number | null
          tenant_connection_id: string | null
          thumbs_down: number | null
          thumbs_up: number | null
          total_responses: number | null
          user_id: string
        }
        Insert: {
          common_issues?: Json | null
          created_at?: string
          customer_id?: string | null
          feedback_by_app?: Json | null
          id?: string
          period_end: string
          period_start: string
          recorded_at?: string
          satisfaction_score?: number | null
          tenant_connection_id?: string | null
          thumbs_down?: number | null
          thumbs_up?: number | null
          total_responses?: number | null
          user_id: string
        }
        Update: {
          common_issues?: Json | null
          created_at?: string
          customer_id?: string | null
          feedback_by_app?: Json | null
          id?: string
          period_end?: string
          period_start?: string
          recorded_at?: string
          satisfaction_score?: number | null
          tenant_connection_id?: string | null
          thumbs_down?: number | null
          thumbs_up?: number | null
          total_responses?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_feedback_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copilot_feedback_tenant_connection_id_fkey"
            columns: ["tenant_connection_id"]
            isOneToOne: false
            referencedRelation: "tenant_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_plugins: {
        Row: {
          approval_date: string | null
          approved_by: string | null
          created_at: string
          customer_id: string | null
          description: string | null
          display_name: string
          id: string
          is_approved: boolean | null
          metadata: Json | null
          permissions: Json | null
          plugin_id: string
          plugin_type: string
          publisher: string | null
          status: string | null
          tenant_connection_id: string | null
          updated_at: string
          usage_count: number | null
          user_id: string
        }
        Insert: {
          approval_date?: string | null
          approved_by?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_approved?: boolean | null
          metadata?: Json | null
          permissions?: Json | null
          plugin_id: string
          plugin_type: string
          publisher?: string | null
          status?: string | null
          tenant_connection_id?: string | null
          updated_at?: string
          usage_count?: number | null
          user_id: string
        }
        Update: {
          approval_date?: string | null
          approved_by?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_approved?: boolean | null
          metadata?: Json | null
          permissions?: Json | null
          plugin_id?: string
          plugin_type?: string
          publisher?: string | null
          status?: string | null
          tenant_connection_id?: string | null
          updated_at?: string
          usage_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_plugins_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copilot_plugins_tenant_connection_id_fkey"
            columns: ["tenant_connection_id"]
            isOneToOne: false
            referencedRelation: "tenant_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_readiness_assessments: {
        Row: {
          assessment_date: string
          created_at: string
          customer_id: string | null
          data_governance_details: Json | null
          data_governance_ready: boolean | null
          id: string
          licensing_details: Json | null
          licensing_ready: boolean | null
          network_details: Json | null
          network_ready: boolean | null
          overall_score: number | null
          permissions_details: Json | null
          permissions_ready: boolean | null
          recommendations: Json | null
          semantic_index_details: Json | null
          semantic_index_ready: boolean | null
          tenant_connection_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assessment_date?: string
          created_at?: string
          customer_id?: string | null
          data_governance_details?: Json | null
          data_governance_ready?: boolean | null
          id?: string
          licensing_details?: Json | null
          licensing_ready?: boolean | null
          network_details?: Json | null
          network_ready?: boolean | null
          overall_score?: number | null
          permissions_details?: Json | null
          permissions_ready?: boolean | null
          recommendations?: Json | null
          semantic_index_details?: Json | null
          semantic_index_ready?: boolean | null
          tenant_connection_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assessment_date?: string
          created_at?: string
          customer_id?: string | null
          data_governance_details?: Json | null
          data_governance_ready?: boolean | null
          id?: string
          licensing_details?: Json | null
          licensing_ready?: boolean | null
          network_details?: Json | null
          network_ready?: boolean | null
          overall_score?: number | null
          permissions_details?: Json | null
          permissions_ready?: boolean | null
          recommendations?: Json | null
          semantic_index_details?: Json | null
          semantic_index_ready?: boolean | null
          tenant_connection_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_readiness_assessments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copilot_readiness_assessments_tenant_connection_id_fkey"
            columns: ["tenant_connection_id"]
            isOneToOne: false
            referencedRelation: "tenant_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_studio_bots: {
        Row: {
          actions_count: number | null
          bot_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string | null
          display_name: string
          environment_id: string | null
          environment_name: string | null
          id: string
          is_published: boolean | null
          last_modified: string | null
          metadata: Json | null
          status: string | null
          tenant_connection_id: string | null
          topics_count: number | null
          triggers_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actions_count?: number | null
          bot_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          display_name: string
          environment_id?: string | null
          environment_name?: string | null
          id?: string
          is_published?: boolean | null
          last_modified?: string | null
          metadata?: Json | null
          status?: string | null
          tenant_connection_id?: string | null
          topics_count?: number | null
          triggers_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actions_count?: number | null
          bot_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          display_name?: string
          environment_id?: string | null
          environment_name?: string | null
          id?: string
          is_published?: boolean | null
          last_modified?: string | null
          metadata?: Json | null
          status?: string | null
          tenant_connection_id?: string | null
          topics_count?: number | null
          triggers_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_studio_bots_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copilot_studio_bots_tenant_connection_id_fkey"
            columns: ["tenant_connection_id"]
            isOneToOne: false
            referencedRelation: "tenant_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_usage_metrics: {
        Row: {
          active_users: number | null
          adoption_rate: number | null
          avg_queries_per_user: number | null
          created_at: string
          customer_id: string | null
          id: string
          period_end: string
          period_start: string
          recorded_at: string
          tenant_connection_id: string | null
          top_features: Json | null
          total_queries: number | null
          total_users: number | null
          usage_by_app: Json | null
          user_id: string
        }
        Insert: {
          active_users?: number | null
          adoption_rate?: number | null
          avg_queries_per_user?: number | null
          created_at?: string
          customer_id?: string | null
          id?: string
          period_end: string
          period_start: string
          recorded_at?: string
          tenant_connection_id?: string | null
          top_features?: Json | null
          total_queries?: number | null
          total_users?: number | null
          usage_by_app?: Json | null
          user_id: string
        }
        Update: {
          active_users?: number | null
          adoption_rate?: number | null
          avg_queries_per_user?: number | null
          created_at?: string
          customer_id?: string | null
          id?: string
          period_end?: string
          period_start?: string
          recorded_at?: string
          tenant_connection_id?: string | null
          top_features?: Json | null
          total_queries?: number | null
          total_users?: number | null
          usage_by_app?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_usage_metrics_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copilot_usage_metrics_tenant_connection_id_fkey"
            columns: ["tenant_connection_id"]
            isOneToOne: false
            referencedRelation: "tenant_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          id: string
          industry: string | null
          is_active: boolean
          name: string
          notes: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          tier: Database["public"]["Enums"]["customer_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          industry?: string | null
          is_active?: boolean
          name: string
          notes?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          tier?: Database["public"]["Enums"]["customer_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          industry?: string | null
          is_active?: boolean
          name?: string
          notes?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          tier?: Database["public"]["Enums"]["customer_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deployment_results: {
        Row: {
          applied_changes: Json | null
          completed_at: string | null
          created_at: string
          deployment_id: string
          dry_run_result: Json | null
          error_message: string | null
          id: string
          rollback_data: Json | null
          started_at: string | null
          status: Database["public"]["Enums"]["deployment_status"]
          tenant_connection_id: string
        }
        Insert: {
          applied_changes?: Json | null
          completed_at?: string | null
          created_at?: string
          deployment_id: string
          dry_run_result?: Json | null
          error_message?: string | null
          id?: string
          rollback_data?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["deployment_status"]
          tenant_connection_id: string
        }
        Update: {
          applied_changes?: Json | null
          completed_at?: string | null
          created_at?: string
          deployment_id?: string
          dry_run_result?: Json | null
          error_message?: string | null
          id?: string
          rollback_data?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["deployment_status"]
          tenant_connection_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deployment_results_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "policy_deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployment_results_tenant_connection_id_fkey"
            columns: ["tenant_connection_id"]
            isOneToOne: false
            referencedRelation: "tenant_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      drift_detections: {
        Row: {
          added_count: number
          baseline_export_id: string | null
          completed_at: string | null
          created_at: string
          drift_details: Json | null
          id: string
          modified_count: number
          removed_count: number
          status: string
          tenant_connection_id: string | null
          total_resources: number
          unchanged_count: number
          user_id: string
        }
        Insert: {
          added_count?: number
          baseline_export_id?: string | null
          completed_at?: string | null
          created_at?: string
          drift_details?: Json | null
          id?: string
          modified_count?: number
          removed_count?: number
          status?: string
          tenant_connection_id?: string | null
          total_resources?: number
          unchanged_count?: number
          user_id: string
        }
        Update: {
          added_count?: number
          baseline_export_id?: string | null
          completed_at?: string | null
          created_at?: string
          drift_details?: Json | null
          id?: string
          modified_count?: number
          removed_count?: number
          status?: string
          tenant_connection_id?: string | null
          total_resources?: number
          unchanged_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drift_detections_baseline_export_id_fkey"
            columns: ["baseline_export_id"]
            isOneToOne: false
            referencedRelation: "export_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drift_detections_tenant_connection_id_fkey"
            columns: ["tenant_connection_id"]
            isOneToOne: false
            referencedRelation: "tenant_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      export_jobs: {
        Row: {
          categories: string[]
          completed_at: string | null
          created_at: string
          error: string | null
          formats: string[]
          id: string
          metadata: Json | null
          name: string
          output_path: string | null
          progress: number
          status: string
          tenant_connection_id: string | null
          user_id: string
        }
        Insert: {
          categories?: string[]
          completed_at?: string | null
          created_at?: string
          error?: string | null
          formats?: string[]
          id?: string
          metadata?: Json | null
          name: string
          output_path?: string | null
          progress?: number
          status?: string
          tenant_connection_id?: string | null
          user_id: string
        }
        Update: {
          categories?: string[]
          completed_at?: string | null
          created_at?: string
          error?: string | null
          formats?: string[]
          id?: string
          metadata?: Json | null
          name?: string
          output_path?: string | null
          progress?: number
          status?: string
          tenant_connection_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_jobs_tenant_connection_id_fkey"
            columns: ["tenant_connection_id"]
            isOneToOne: false
            referencedRelation: "tenant_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      exported_resources: {
        Row: {
          bicep_config: string | null
          category: string
          created_at: string
          data: Json
          export_job_id: string
          id: string
          powershell_script: string | null
          resource_id: string | null
          resource_name: string | null
          resource_type: string
          terraform_config: string | null
        }
        Insert: {
          bicep_config?: string | null
          category: string
          created_at?: string
          data: Json
          export_job_id: string
          id?: string
          powershell_script?: string | null
          resource_id?: string | null
          resource_name?: string | null
          resource_type: string
          terraform_config?: string | null
        }
        Update: {
          bicep_config?: string | null
          category?: string
          created_at?: string
          data?: Json
          export_job_id?: string
          id?: string
          powershell_script?: string | null
          resource_id?: string | null
          resource_name?: string | null
          resource_type?: string
          terraform_config?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exported_resources_export_job_id_fkey"
            columns: ["export_job_id"]
            isOneToOne: false
            referencedRelation: "export_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      git_configs: {
        Row: {
          auto_commit: boolean | null
          branch: string | null
          cicd_template: string | null
          commit_message_template: string | null
          created_at: string
          id: string
          provider: string
          repo_url: string | null
          tenant_connection_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_commit?: boolean | null
          branch?: string | null
          cicd_template?: string | null
          commit_message_template?: string | null
          created_at?: string
          id?: string
          provider: string
          repo_url?: string | null
          tenant_connection_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_commit?: boolean | null
          branch?: string | null
          cicd_template?: string | null
          commit_message_template?: string | null
          created_at?: string
          id?: string
          provider?: string
          repo_url?: string | null
          tenant_connection_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "git_configs_tenant_connection_id_fkey"
            columns: ["tenant_connection_id"]
            isOneToOne: false
            referencedRelation: "tenant_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_metrics_history: {
        Row: {
          admin_users: number | null
          assigned_licenses: number | null
          compliance_score: number | null
          conditional_access_policies: number | null
          created_at: string
          critical_actions: number | null
          customer_id: string | null
          guest_users: number | null
          high_actions: number | null
          id: string
          license_cost_monthly: number | null
          license_utilization: number | null
          low_actions: number | null
          max_secure_score: number | null
          medium_actions: number | null
          mfa_enabled_users: number | null
          recorded_at: string
          risky_sign_ins: number | null
          risky_users: number | null
          secure_score: number | null
          stale_accounts: number | null
          tenant_connection_id: string | null
          total_licenses: number | null
          total_users: number | null
          unused_licenses: number | null
          user_id: string
        }
        Insert: {
          admin_users?: number | null
          assigned_licenses?: number | null
          compliance_score?: number | null
          conditional_access_policies?: number | null
          created_at?: string
          critical_actions?: number | null
          customer_id?: string | null
          guest_users?: number | null
          high_actions?: number | null
          id?: string
          license_cost_monthly?: number | null
          license_utilization?: number | null
          low_actions?: number | null
          max_secure_score?: number | null
          medium_actions?: number | null
          mfa_enabled_users?: number | null
          recorded_at?: string
          risky_sign_ins?: number | null
          risky_users?: number | null
          secure_score?: number | null
          stale_accounts?: number | null
          tenant_connection_id?: string | null
          total_licenses?: number | null
          total_users?: number | null
          unused_licenses?: number | null
          user_id: string
        }
        Update: {
          admin_users?: number | null
          assigned_licenses?: number | null
          compliance_score?: number | null
          conditional_access_policies?: number | null
          created_at?: string
          critical_actions?: number | null
          customer_id?: string | null
          guest_users?: number | null
          high_actions?: number | null
          id?: string
          license_cost_monthly?: number | null
          license_utilization?: number | null
          low_actions?: number | null
          max_secure_score?: number | null
          medium_actions?: number | null
          mfa_enabled_users?: number | null
          recorded_at?: string
          risky_sign_ins?: number | null
          risky_users?: number | null
          secure_score?: number | null
          stale_accounts?: number | null
          tenant_connection_id?: string | null
          total_licenses?: number | null
          total_users?: number | null
          unused_licenses?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_metrics_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_metrics_history_tenant_connection_id_fkey"
            columns: ["tenant_connection_id"]
            isOneToOne: false
            referencedRelation: "tenant_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          errors: Json | null
          id: string
          metadata: Json | null
          name: string
          resources_failed: number
          resources_imported: number
          resources_total: number
          source_export_job_id: string | null
          source_type: string
          status: string
          tenant_connection_id: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          errors?: Json | null
          id?: string
          metadata?: Json | null
          name: string
          resources_failed?: number
          resources_imported?: number
          resources_total?: number
          source_export_job_id?: string | null
          source_type?: string
          status?: string
          tenant_connection_id?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          errors?: Json | null
          id?: string
          metadata?: Json | null
          name?: string
          resources_failed?: number
          resources_imported?: number
          resources_total?: number
          source_export_job_id?: string | null
          source_type?: string
          status?: string
          tenant_connection_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_source_export_job_id_fkey"
            columns: ["source_export_job_id"]
            isOneToOne: false
            referencedRelation: "export_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_tenant_connection_id_fkey"
            columns: ["tenant_connection_id"]
            isOneToOne: false
            referencedRelation: "tenant_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          email: string | null
          expires_at: string
          id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at: string
          id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      notification_channels: {
        Row: {
          channel_type: Database["public"]["Enums"]["notification_channel_type"]
          config: Json
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel_type: Database["public"]["Enums"]["notification_channel_type"]
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel_type?: Database["public"]["Enums"]["notification_channel_type"]
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      permission_changes: {
        Row: {
          change_type: string
          created_at: string
          current_status: boolean
          error_message: string | null
          health_check_id: string | null
          id: string
          previous_status: boolean | null
          provider: string
          resource_id: string
          resource_name: string
          tenant_connection_id: string | null
          user_id: string
        }
        Insert: {
          change_type: string
          created_at?: string
          current_status: boolean
          error_message?: string | null
          health_check_id?: string | null
          id?: string
          previous_status?: boolean | null
          provider: string
          resource_id: string
          resource_name: string
          tenant_connection_id?: string | null
          user_id: string
        }
        Update: {
          change_type?: string
          created_at?: string
          current_status?: boolean
          error_message?: string | null
          health_check_id?: string | null
          id?: string
          previous_status?: boolean | null
          provider?: string
          resource_id?: string
          resource_name?: string
          tenant_connection_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_changes_health_check_id_fkey"
            columns: ["health_check_id"]
            isOneToOne: false
            referencedRelation: "permission_health_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_changes_tenant_connection_id_fkey"
            columns: ["tenant_connection_id"]
            isOneToOne: false
            referencedRelation: "tenant_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_health_checks: {
        Row: {
          avg_response_time_ms: number | null
          azure_failed: number
          azure_passed: number
          created_at: string
          failed_count: number
          graph_failed: number
          graph_passed: number
          id: string
          notes: string | null
          passed_count: number
          results: Json
          tenant_connection_id: string | null
          test_type: string
          total_resources: number
          user_id: string
        }
        Insert: {
          avg_response_time_ms?: number | null
          azure_failed?: number
          azure_passed?: number
          created_at?: string
          failed_count?: number
          graph_failed?: number
          graph_passed?: number
          id?: string
          notes?: string | null
          passed_count?: number
          results?: Json
          tenant_connection_id?: string | null
          test_type?: string
          total_resources?: number
          user_id: string
        }
        Update: {
          avg_response_time_ms?: number | null
          azure_failed?: number
          azure_passed?: number
          created_at?: string
          failed_count?: number
          graph_failed?: number
          graph_passed?: number
          id?: string
          notes?: string | null
          passed_count?: number
          results?: Json
          tenant_connection_id?: string | null
          test_type?: string
          total_resources?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_health_checks_tenant_connection_id_fkey"
            columns: ["tenant_connection_id"]
            isOneToOne: false
            referencedRelation: "tenant_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_deployments: {
        Row: {
          completed_at: string | null
          completed_tenants: number
          created_at: string
          description: string | null
          dry_run: boolean
          failed_tenants: number
          id: string
          name: string
          policy_template_id: string
          scheduled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["deployment_status"]
          target_customer_id: string | null
          target_group_id: string | null
          target_tenant_ids: string[]
          target_type: string
          total_tenants: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_tenants?: number
          created_at?: string
          description?: string | null
          dry_run?: boolean
          failed_tenants?: number
          id?: string
          name: string
          policy_template_id: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["deployment_status"]
          target_customer_id?: string | null
          target_group_id?: string | null
          target_tenant_ids?: string[]
          target_type?: string
          total_tenants?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_tenants?: number
          created_at?: string
          description?: string | null
          dry_run?: boolean
          failed_tenants?: number
          id?: string
          name?: string
          policy_template_id?: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["deployment_status"]
          target_customer_id?: string | null
          target_group_id?: string | null
          target_tenant_ids?: string[]
          target_type?: string
          total_tenants?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_deployments_policy_template_id_fkey"
            columns: ["policy_template_id"]
            isOneToOne: false
            referencedRelation: "policy_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_deployments_target_customer_id_fkey"
            columns: ["target_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_deployments_target_group_id_fkey"
            columns: ["target_group_id"]
            isOneToOne: false
            referencedRelation: "tenant_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_templates: {
        Row: {
          baseline_type: Database["public"]["Enums"]["baseline_type"]
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          policy_data: Json
          resource_types: string[]
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          baseline_type?: Database["public"]["Enums"]["baseline_type"]
          category: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          policy_data?: Json
          resource_types?: string[]
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          baseline_type?: Database["public"]["Enums"]["baseline_type"]
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          policy_data?: Json
          resource_types?: string[]
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      prompt_library: {
        Row: {
          avg_rating: number | null
          category: string
          created_at: string
          customer_id: string | null
          description: string | null
          id: string
          is_public: boolean | null
          name: string
          prompt_text: string
          tags: string[] | null
          target_apps: string[] | null
          updated_at: string
          usage_count: number | null
          user_id: string
        }
        Insert: {
          avg_rating?: number | null
          category?: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          prompt_text: string
          tags?: string[] | null
          target_apps?: string[] | null
          updated_at?: string
          usage_count?: number | null
          user_id: string
        }
        Update: {
          avg_rating?: number | null
          category?: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          prompt_text?: string
          tags?: string[] | null
          target_apps?: string[] | null
          updated_at?: string
          usage_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_library_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      psa_integrations: {
        Row: {
          api_url: string
          auto_create_tickets: boolean
          connection_status: string | null
          created_at: string
          default_priority: string | null
          default_ticket_type: string | null
          id: string
          is_active: boolean
          last_connection_test: string | null
          name: string
          provider: string
          ticket_on_compliance_fail: boolean
          ticket_on_drift: boolean
          updated_at: string
          user_id: string
          vault_secret_id: string | null
        }
        Insert: {
          api_url: string
          auto_create_tickets?: boolean
          connection_status?: string | null
          created_at?: string
          default_priority?: string | null
          default_ticket_type?: string | null
          id?: string
          is_active?: boolean
          last_connection_test?: string | null
          name: string
          provider: string
          ticket_on_compliance_fail?: boolean
          ticket_on_drift?: boolean
          updated_at?: string
          user_id: string
          vault_secret_id?: string | null
        }
        Update: {
          api_url?: string
          auto_create_tickets?: boolean
          connection_status?: string | null
          created_at?: string
          default_priority?: string | null
          default_ticket_type?: string | null
          id?: string
          is_active?: boolean
          last_connection_test?: string | null
          name?: string
          provider?: string
          ticket_on_compliance_fail?: boolean
          ticket_on_drift?: boolean
          updated_at?: string
          user_id?: string
          vault_secret_id?: string | null
        }
        Relationships: []
      }
      psa_tickets: {
        Row: {
          created_at: string
          customer_id: string | null
          description: string | null
          external_ticket_id: string | null
          id: string
          priority: string
          psa_integration_id: string
          source_id: string | null
          source_type: string
          status: string
          ticket_type: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          description?: string | null
          external_ticket_id?: string | null
          id?: string
          priority?: string
          psa_integration_id: string
          source_id?: string | null
          source_type: string
          status?: string
          ticket_type: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          description?: string | null
          external_ticket_id?: string | null
          id?: string
          priority?: string
          psa_integration_id?: string
          source_id?: string | null
          source_type?: string
          status?: string
          ticket_type?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "psa_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "psa_tickets_psa_integration_id_fkey"
            columns: ["psa_integration_id"]
            isOneToOne: false
            referencedRelation: "psa_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          customer_id: string | null
          data: Json
          date_range_end: string | null
          date_range_start: string | null
          file_url: string | null
          generated_at: string
          id: string
          name: string
          report_type: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          data?: Json
          date_range_end?: string | null
          date_range_start?: string | null
          file_url?: string | null
          generated_at?: string
          id?: string
          name: string
          report_type: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          data?: Json
          date_range_end?: string | null
          date_range_start?: string | null
          file_url?: string | null
          generated_at?: string
          id?: string
          name?: string
          report_type?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          resource_ids: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          resource_ids?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          resource_ids?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      risk_assessments: {
        Row: {
          category_scores: Json
          created_at: string
          customer_id: string | null
          id: string
          overall_score: number
          recommendations: Json
          risk_factors: Json
          tenant_connection_id: string
          user_id: string
        }
        Insert: {
          category_scores?: Json
          created_at?: string
          customer_id?: string | null
          id?: string
          overall_score: number
          recommendations?: Json
          risk_factors?: Json
          tenant_connection_id: string
          user_id: string
        }
        Update: {
          category_scores?: Json
          created_at?: string
          customer_id?: string | null
          id?: string
          overall_score?: number
          recommendations?: Json
          risk_factors?: Json
          tenant_connection_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_assessments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_assessments_tenant_connection_id_fkey"
            columns: ["tenant_connection_id"]
            isOneToOne: false
            referencedRelation: "tenant_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_deployment_configs: {
        Row: {
          created_at: string
          description: string | null
          dry_run: boolean
          id: string
          is_active: boolean
          last_run_at: string | null
          last_run_success: boolean | null
          name: string
          next_run_at: string | null
          notify_on_completion: boolean
          policy_template_id: string
          run_count: number
          schedule_cron: string
          schedule_description: string | null
          target_customer_id: string | null
          target_group_id: string | null
          target_tenant_ids: string[] | null
          target_type: string
          updated_at: string
          user_id: string
          webhook_config_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          dry_run?: boolean
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          last_run_success?: boolean | null
          name: string
          next_run_at?: string | null
          notify_on_completion?: boolean
          policy_template_id: string
          run_count?: number
          schedule_cron: string
          schedule_description?: string | null
          target_customer_id?: string | null
          target_group_id?: string | null
          target_tenant_ids?: string[] | null
          target_type?: string
          updated_at?: string
          user_id: string
          webhook_config_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          dry_run?: boolean
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          last_run_success?: boolean | null
          name?: string
          next_run_at?: string | null
          notify_on_completion?: boolean
          policy_template_id?: string
          run_count?: number
          schedule_cron?: string
          schedule_description?: string | null
          target_customer_id?: string | null
          target_group_id?: string | null
          target_tenant_ids?: string[] | null
          target_type?: string
          updated_at?: string
          user_id?: string
          webhook_config_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_deployment_configs_policy_template_id_fkey"
            columns: ["policy_template_id"]
            isOneToOne: false
            referencedRelation: "policy_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_deployment_configs_target_customer_id_fkey"
            columns: ["target_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_deployment_configs_target_group_id_fkey"
            columns: ["target_group_id"]
            isOneToOne: false
            referencedRelation: "tenant_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_deployment_configs_webhook_config_id_fkey"
            columns: ["webhook_config_id"]
            isOneToOne: false
            referencedRelation: "webhook_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_deployment_runs: {
        Row: {
          completed_at: string | null
          completed_tenants: number
          created_at: string
          error_message: string | null
          failed_tenants: number
          id: string
          results: Json | null
          scheduled_config_id: string
          started_at: string | null
          status: string
          total_tenants: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_tenants?: number
          created_at?: string
          error_message?: string | null
          failed_tenants?: number
          id?: string
          results?: Json | null
          scheduled_config_id: string
          started_at?: string | null
          status?: string
          total_tenants?: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_tenants?: number
          created_at?: string
          error_message?: string | null
          failed_tenants?: number
          id?: string
          results?: Json | null
          scheduled_config_id?: string
          started_at?: string | null
          status?: string
          total_tenants?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_deployment_runs_scheduled_config_id_fkey"
            columns: ["scheduled_config_id"]
            isOneToOne: false
            referencedRelation: "scheduled_deployment_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_drift_configs: {
        Row: {
          baseline_export_id: string | null
          created_at: string
          description: string | null
          drift_threshold_percent: number | null
          id: string
          is_active: boolean
          last_drift_detected: boolean | null
          last_run_at: string | null
          name: string
          next_run_at: string | null
          notify_on_drift: boolean
          resource_ids: string[]
          run_count: number
          schedule_cron: string
          schedule_description: string | null
          service_principal_config_id: string | null
          target_customer_id: string | null
          target_group_id: string | null
          target_tenant_ids: string[]
          target_type: string
          updated_at: string
          user_id: string
          webhook_config_id: string | null
        }
        Insert: {
          baseline_export_id?: string | null
          created_at?: string
          description?: string | null
          drift_threshold_percent?: number | null
          id?: string
          is_active?: boolean
          last_drift_detected?: boolean | null
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          notify_on_drift?: boolean
          resource_ids?: string[]
          run_count?: number
          schedule_cron: string
          schedule_description?: string | null
          service_principal_config_id?: string | null
          target_customer_id?: string | null
          target_group_id?: string | null
          target_tenant_ids?: string[]
          target_type?: string
          updated_at?: string
          user_id: string
          webhook_config_id?: string | null
        }
        Update: {
          baseline_export_id?: string | null
          created_at?: string
          description?: string | null
          drift_threshold_percent?: number | null
          id?: string
          is_active?: boolean
          last_drift_detected?: boolean | null
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          notify_on_drift?: boolean
          resource_ids?: string[]
          run_count?: number
          schedule_cron?: string
          schedule_description?: string | null
          service_principal_config_id?: string | null
          target_customer_id?: string | null
          target_group_id?: string | null
          target_tenant_ids?: string[]
          target_type?: string
          updated_at?: string
          user_id?: string
          webhook_config_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_drift_configs_baseline_export_id_fkey"
            columns: ["baseline_export_id"]
            isOneToOne: false
            referencedRelation: "export_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_drift_configs_service_principal_config_id_fkey"
            columns: ["service_principal_config_id"]
            isOneToOne: false
            referencedRelation: "service_principal_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_drift_configs_target_customer_id_fkey"
            columns: ["target_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_drift_configs_target_group_id_fkey"
            columns: ["target_group_id"]
            isOneToOne: false
            referencedRelation: "tenant_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_drift_configs_webhook_config_id_fkey"
            columns: ["webhook_config_id"]
            isOneToOne: false
            referencedRelation: "webhook_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_drift_runs: {
        Row: {
          completed_at: string | null
          completed_tenants: number
          created_at: string
          error_message: string | null
          failed_tenants: number
          id: string
          results: Json | null
          scheduled_config_id: string
          started_at: string | null
          status: string
          tenants_with_drift: number
          total_tenants: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_tenants?: number
          created_at?: string
          error_message?: string | null
          failed_tenants?: number
          id?: string
          results?: Json | null
          scheduled_config_id: string
          started_at?: string | null
          status?: string
          tenants_with_drift?: number
          total_tenants?: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_tenants?: number
          created_at?: string
          error_message?: string | null
          failed_tenants?: number
          id?: string
          results?: Json | null
          scheduled_config_id?: string
          started_at?: string | null
          status?: string
          tenants_with_drift?: number
          total_tenants?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_drift_runs_scheduled_config_id_fkey"
            columns: ["scheduled_config_id"]
            isOneToOne: false
            referencedRelation: "scheduled_drift_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_exports: {
        Row: {
          created_at: string
          description: string | null
          formats: string[]
          id: string
          is_active: boolean
          last_run_at: string | null
          name: string
          next_run_at: string | null
          resource_ids: string[]
          run_count: number
          schedule_cron: string
          schedule_description: string | null
          service_principal_config_id: string | null
          tenant_connection_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          formats?: string[]
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          resource_ids?: string[]
          run_count?: number
          schedule_cron: string
          schedule_description?: string | null
          service_principal_config_id?: string | null
          tenant_connection_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          formats?: string[]
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          resource_ids?: string[]
          run_count?: number
          schedule_cron?: string
          schedule_description?: string | null
          service_principal_config_id?: string | null
          tenant_connection_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_exports_service_principal_config_id_fkey"
            columns: ["service_principal_config_id"]
            isOneToOne: false
            referencedRelation: "service_principal_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_exports_tenant_connection_id_fkey"
            columns: ["tenant_connection_id"]
            isOneToOne: false
            referencedRelation: "tenant_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_governance_configs: {
        Row: {
          alert_on_risky_signins: boolean | null
          alert_on_risky_users: boolean | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          last_run_at: string | null
          last_run_success: boolean | null
          license_utilization_threshold: number | null
          mfa_coverage_threshold: number | null
          name: string
          next_run_at: string | null
          notify_on_completion: boolean | null
          notify_on_threshold_breach: boolean | null
          run_count: number
          schedule_cron: string
          schedule_description: string | null
          secure_score_threshold: number | null
          target_customer_id: string | null
          target_group_id: string | null
          target_tenant_ids: string[] | null
          target_type: string
          updated_at: string
          user_id: string
          webhook_config_id: string | null
        }
        Insert: {
          alert_on_risky_signins?: boolean | null
          alert_on_risky_users?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          last_run_success?: boolean | null
          license_utilization_threshold?: number | null
          mfa_coverage_threshold?: number | null
          name: string
          next_run_at?: string | null
          notify_on_completion?: boolean | null
          notify_on_threshold_breach?: boolean | null
          run_count?: number
          schedule_cron?: string
          schedule_description?: string | null
          secure_score_threshold?: number | null
          target_customer_id?: string | null
          target_group_id?: string | null
          target_tenant_ids?: string[] | null
          target_type?: string
          updated_at?: string
          user_id: string
          webhook_config_id?: string | null
        }
        Update: {
          alert_on_risky_signins?: boolean | null
          alert_on_risky_users?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          last_run_success?: boolean | null
          license_utilization_threshold?: number | null
          mfa_coverage_threshold?: number | null
          name?: string
          next_run_at?: string | null
          notify_on_completion?: boolean | null
          notify_on_threshold_breach?: boolean | null
          run_count?: number
          schedule_cron?: string
          schedule_description?: string | null
          secure_score_threshold?: number | null
          target_customer_id?: string | null
          target_group_id?: string | null
          target_tenant_ids?: string[] | null
          target_type?: string
          updated_at?: string
          user_id?: string
          webhook_config_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_governance_configs_target_customer_id_fkey"
            columns: ["target_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_governance_configs_target_group_id_fkey"
            columns: ["target_group_id"]
            isOneToOne: false
            referencedRelation: "tenant_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_governance_configs_webhook_config_id_fkey"
            columns: ["webhook_config_id"]
            isOneToOne: false
            referencedRelation: "webhook_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_governance_runs: {
        Row: {
          completed_at: string | null
          completed_tenants: number
          created_at: string
          error_message: string | null
          failed_tenants: number
          id: string
          results: Json | null
          scheduled_config_id: string
          started_at: string | null
          status: string
          tenants_with_alerts: number
          total_tenants: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_tenants?: number
          created_at?: string
          error_message?: string | null
          failed_tenants?: number
          id?: string
          results?: Json | null
          scheduled_config_id: string
          started_at?: string | null
          status?: string
          tenants_with_alerts?: number
          total_tenants?: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_tenants?: number
          created_at?: string
          error_message?: string | null
          failed_tenants?: number
          id?: string
          results?: Json | null
          scheduled_config_id?: string
          started_at?: string | null
          status?: string
          tenants_with_alerts?: number
          total_tenants?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_governance_runs_scheduled_config_id_fkey"
            columns: ["scheduled_config_id"]
            isOneToOne: false
            referencedRelation: "scheduled_governance_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      secure_score_history: {
        Row: {
          id: string
          max_score: number
          recorded_at: string
          score: number
          tenant_connection_id: string
          user_id: string
        }
        Insert: {
          id?: string
          max_score: number
          recorded_at?: string
          score: number
          tenant_connection_id: string
          user_id: string
        }
        Update: {
          id?: string
          max_score?: number
          recorded_at?: string
          score?: number
          tenant_connection_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "secure_score_history_tenant_connection_id_fkey"
            columns: ["tenant_connection_id"]
            isOneToOne: false
            referencedRelation: "tenant_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      service_principal_configs: {
        Row: {
          client_id: string
          connection_types: string[]
          created_at: string
          description: string | null
          id: string
          name: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          connection_types?: string[]
          created_at?: string
          description?: string | null
          id?: string
          name: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          connection_types?: string[]
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tenant_connections: {
        Row: {
          auth_method: string
          client_id: string | null
          created_at: string
          customer_id: string | null
          display_name: string | null
          environment: string | null
          health_status: string | null
          id: string
          last_health_check: string | null
          last_sync: string | null
          status: string
          tags: string[] | null
          tenant_group_id: string | null
          tenant_id: string
          tenant_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_method: string
          client_id?: string | null
          created_at?: string
          customer_id?: string | null
          display_name?: string | null
          environment?: string | null
          health_status?: string | null
          id?: string
          last_health_check?: string | null
          last_sync?: string | null
          status?: string
          tags?: string[] | null
          tenant_group_id?: string | null
          tenant_id: string
          tenant_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_method?: string
          client_id?: string | null
          created_at?: string
          customer_id?: string | null
          display_name?: string | null
          environment?: string | null
          health_status?: string | null
          id?: string
          last_health_check?: string | null
          last_sync?: string | null
          status?: string
          tags?: string[] | null
          tenant_group_id?: string | null
          tenant_id?: string
          tenant_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_connections_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_connections_tenant_group_id_fkey"
            columns: ["tenant_group_id"]
            isOneToOne: false
            referencedRelation: "tenant_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_credentials: {
        Row: {
          client_id: string
          created_at: string
          encrypted_secret: string | null
          encryption_version: number
          id: string
          tenant_connection_id: string
          updated_at: string
          user_id: string
          vault_secret_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          encrypted_secret?: string | null
          encryption_version?: number
          id?: string
          tenant_connection_id: string
          updated_at?: string
          user_id: string
          vault_secret_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          encrypted_secret?: string | null
          encryption_version?: number
          id?: string
          tenant_connection_id?: string
          updated_at?: string
          user_id?: string
          vault_secret_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_credentials_tenant_connection_id_fkey"
            columns: ["tenant_connection_id"]
            isOneToOne: true
            referencedRelation: "tenant_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_groups: {
        Row: {
          color: string | null
          created_at: string
          customer_id: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_groups_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_health_checks: {
        Row: {
          check_type: string
          created_at: string
          details: Json | null
          error_message: string | null
          health_status: string
          id: string
          response_time_ms: number | null
          tenant_connection_id: string
          user_id: string
        }
        Insert: {
          check_type?: string
          created_at?: string
          details?: Json | null
          error_message?: string | null
          health_status?: string
          id?: string
          response_time_ms?: number | null
          tenant_connection_id: string
          user_id: string
        }
        Update: {
          check_type?: string
          created_at?: string
          details?: Json | null
          error_message?: string | null
          health_status?: string
          id?: string
          response_time_ms?: number | null
          tenant_connection_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_health_checks_tenant_connection_id_fkey"
            columns: ["tenant_connection_id"]
            isOneToOne: false
            referencedRelation: "tenant_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_secure_scores: {
        Row: {
          control_scores: Json | null
          created_at: string
          current_score: number
          id: string
          improvement_actions: Json | null
          max_score: number
          score_percentage: number | null
          tenant_connection_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          control_scores?: Json | null
          created_at?: string
          current_score?: number
          id?: string
          improvement_actions?: Json | null
          max_score?: number
          score_percentage?: number | null
          tenant_connection_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          control_scores?: Json | null
          created_at?: string
          current_score?: number
          id?: string
          improvement_actions?: Json | null
          max_score?: number
          score_percentage?: number | null
          tenant_connection_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_secure_scores_tenant_connection_id_fkey"
            columns: ["tenant_connection_id"]
            isOneToOne: true
            referencedRelation: "tenant_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ai_api_keys: {
        Row: {
          created_at: string
          encrypted_key: string
          id: string
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          encrypted_key: string
          id?: string
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          encrypted_key?: string
          id?: string
          provider?: string
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
      validation_results: {
        Row: {
          completed_at: string | null
          created_at: string
          error_count: number
          export_job_id: string | null
          id: string
          passed_count: number
          status: string
          total_resources: number
          user_id: string
          validation_details: Json | null
          warning_count: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_count?: number
          export_job_id?: string | null
          id?: string
          passed_count?: number
          status?: string
          total_resources?: number
          user_id: string
          validation_details?: Json | null
          warning_count?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_count?: number
          export_job_id?: string | null
          id?: string
          passed_count?: number
          status?: string
          total_resources?: number
          user_id?: string
          validation_details?: Json | null
          warning_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "validation_results_export_job_id_fkey"
            columns: ["export_job_id"]
            isOneToOne: false
            referencedRelation: "export_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_configs: {
        Row: {
          created_at: string
          events: string[]
          failure_count: number
          id: string
          is_active: boolean
          last_triggered_at: string | null
          name: string
          secret: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          events?: string[]
          failure_count?: number
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name: string
          secret?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          events?: string[]
          failure_count?: number
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name?: string
          secret?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          max_retries: number
          next_retry_at: string | null
          original_log_id: string | null
          payload: Json
          response_body: string | null
          response_status: number | null
          retry_count: number
          success: boolean
          user_id: string
          webhook_config_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          max_retries?: number
          next_retry_at?: string | null
          original_log_id?: string | null
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          retry_count?: number
          success?: boolean
          user_id: string
          webhook_config_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          max_retries?: number
          next_retry_at?: string | null
          original_log_id?: string | null
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          retry_count?: number
          success?: boolean
          user_id?: string
          webhook_config_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_original_log_id_fkey"
            columns: ["original_log_id"]
            isOneToOne: false
            referencedRelation: "webhook_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_logs_webhook_config_id_fkey"
            columns: ["webhook_config_id"]
            isOneToOne: false
            referencedRelation: "webhook_configs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_next_run: {
        Args: {
          p_day_of_week: number
          p_frequency: Database["public"]["Enums"]["schedule_frequency"]
          p_time_of_day: string
        }
        Returns: string
      }
      check_invite_valid: {
        Args: { invite_code: string; user_email: string }
        Returns: boolean
      }
      get_ai_api_key: { Args: { p_provider: string }; Returns: string }
      get_decrypted_credential: {
        Args: { p_tenant_connection_id: string; p_user_id: string }
        Returns: {
          client_id: string
          client_secret: string
          tenant_id: string
        }[]
      }
      get_psa_credential: {
        Args: { p_integration_id: string }
        Returns: {
          api_key: string
          api_secret: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      owns_customer: { Args: { p_customer_id: string }; Returns: boolean }
      owns_deployment: { Args: { p_deployment_id: string }; Returns: boolean }
      store_ai_api_key: {
        Args: { p_api_key: string; p_provider: string }
        Returns: string
      }
      store_encrypted_credential:
        | {
            Args: {
              p_client_id: string
              p_client_secret: string
              p_tenant_connection_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_client_id: string
              p_client_secret: string
              p_tenant_connection_id: string
              p_user_id?: string
            }
            Returns: string
          }
      store_psa_credential: {
        Args: {
          p_api_key: string
          p_api_secret?: string
          p_integration_id: string
        }
        Returns: string
      }
      validate_and_use_invite: {
        Args: { invite_code: string; user_email: string; user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      baseline_type:
        | "cis"
        | "nist"
        | "hipaa"
        | "iso27001"
        | "zero_trust"
        | "microsoft_security"
        | "custom"
        | "iso27018"
        | "soc2"
        | "iso9001"
        | "irap"
      customer_tier: "starter" | "professional" | "enterprise"
      deployment_status:
        | "pending"
        | "running"
        | "completed"
        | "failed"
        | "cancelled"
        | "rolled_back"
      notification_channel_type: "slack" | "teams" | "email"
      schedule_frequency: "daily" | "weekly"
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
      app_role: ["admin", "user"],
      baseline_type: [
        "cis",
        "nist",
        "hipaa",
        "iso27001",
        "zero_trust",
        "microsoft_security",
        "custom",
        "iso27018",
        "soc2",
        "iso9001",
        "irap",
      ],
      customer_tier: ["starter", "professional", "enterprise"],
      deployment_status: [
        "pending",
        "running",
        "completed",
        "failed",
        "cancelled",
        "rolled_back",
      ],
      notification_channel_type: ["slack", "teams", "email"],
      schedule_frequency: ["daily", "weekly"],
    },
  },
} as const
