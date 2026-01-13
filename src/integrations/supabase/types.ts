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
          tenant_connection_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_exports_tenant_connection_id_fkey"
            columns: ["tenant_connection_id"]
            isOneToOne: false
            referencedRelation: "tenant_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_connections: {
        Row: {
          auth_method: string
          client_id: string | null
          created_at: string
          id: string
          last_sync: string | null
          status: string
          tenant_id: string
          tenant_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_method: string
          client_id?: string | null
          created_at?: string
          id?: string
          last_sync?: string | null
          status?: string
          tenant_id: string
          tenant_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_method?: string
          client_id?: string | null
          created_at?: string
          id?: string
          last_sync?: string | null
          status?: string
          tenant_id?: string
          tenant_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          payload: Json
          response_body: string | null
          response_status: number | null
          success: boolean
          user_id: string
          webhook_config_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          success?: boolean
          user_id: string
          webhook_config_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          success?: boolean
          user_id?: string
          webhook_config_id?: string | null
        }
        Relationships: [
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
