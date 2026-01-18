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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string | null
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
          user_agent?: string | null
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
      psa_integrations: {
        Row: {
          api_url: string
          auto_create_tickets: boolean
          created_at: string
          default_priority: string | null
          default_ticket_type: string | null
          id: string
          is_active: boolean
          name: string
          provider: string
          ticket_on_compliance_fail: boolean
          ticket_on_drift: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          api_url: string
          auto_create_tickets?: boolean
          created_at?: string
          default_priority?: string | null
          default_ticket_type?: string | null
          id?: string
          is_active?: boolean
          name: string
          provider: string
          ticket_on_compliance_fail?: boolean
          ticket_on_drift?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          api_url?: string
          auto_create_tickets?: boolean
          created_at?: string
          default_priority?: string | null
          default_ticket_type?: string | null
          id?: string
          is_active?: boolean
          name?: string
          provider?: string
          ticket_on_compliance_fail?: boolean
          ticket_on_drift?: boolean
          updated_at?: string
          user_id?: string
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
          encrypted_secret: string
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
          encrypted_secret: string
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
          encrypted_secret?: string
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
      get_decrypted_credential: {
        Args: { p_tenant_connection_id: string; p_user_id: string }
        Returns: {
          client_id: string
          client_secret: string
          tenant_id: string
        }[]
      }
      owns_customer: { Args: { p_customer_id: string }; Returns: boolean }
      owns_deployment: { Args: { p_deployment_id: string }; Returns: boolean }
      store_encrypted_credential: {
        Args: {
          p_client_id: string
          p_client_secret: string
          p_tenant_connection_id: string
        }
        Returns: string
      }
    }
    Enums: {
      baseline_type:
        | "cis"
        | "nist"
        | "hipaa"
        | "iso27001"
        | "zero_trust"
        | "microsoft_security"
        | "custom"
      customer_tier: "starter" | "professional" | "enterprise"
      deployment_status:
        | "pending"
        | "running"
        | "completed"
        | "failed"
        | "cancelled"
        | "rolled_back"
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
      baseline_type: [
        "cis",
        "nist",
        "hipaa",
        "iso27001",
        "zero_trust",
        "microsoft_security",
        "custom",
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
    },
  },
} as const
