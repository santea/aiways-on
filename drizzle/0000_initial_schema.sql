CREATE SCHEMA "sdlc";
--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "sdlc"."audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"correlation_id" varchar(100),
	"actor_id" varchar(255),
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(50),
	"resource_id" varchar(255),
	"before_state" jsonb,
	"after_state" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdlc"."secret_refs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" varchar(64) NOT NULL,
	"hint" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp,
	"image" text,
	"github_id" text,
	"github_login" text,
	"role" varchar(16) DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_github_id_unique" UNIQUE("github_id")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "sdlc"."sdlc_conda_cache_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cache_key" varchar(64) NOT NULL,
	"env_hash" varchar(64),
	"object_key" text NOT NULL,
	"size_bytes" bigint,
	"source_request_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdlc"."sdlc_feedback_polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"channel_id" varchar(255) NOT NULL,
	"channel_type" varchar(50) NOT NULL,
	"callback_url" text NOT NULL,
	"last_message_id" varchar(255),
	"last_mail_sent_at" timestamp with time zone,
	"nudge_mail_sent" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdlc"."sdlc_github_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pat_secret_ref_id" uuid NOT NULL,
	"git_user_name" varchar(255) DEFAULT 'SDLC Bot' NOT NULL,
	"git_user_email" varchar(255) DEFAULT 'sdlc-bot@example.local' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdlc"."sdlc_github_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"issue_number" integer NOT NULL,
	"repo" varchar(512) NOT NULL,
	"state" varchar(50) DEFAULT 'open' NOT NULL,
	"html_url" varchar(1024),
	"work_branch" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdlc"."sdlc_github_orgs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_url" varchar(1024) NOT NULL,
	"org_name" varchar(255) NOT NULL,
	"credential_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdlc"."sdlc_github_pull_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"pr_number" integer NOT NULL,
	"repo" varchar(512) NOT NULL,
	"state" varchar(50) DEFAULT 'open' NOT NULL,
	"head" varchar(255) NOT NULL,
	"base" varchar(255) NOT NULL,
	"html_url" varchar(1024),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdlc"."sdlc_github_repos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"repo_url" varchar(1024) NOT NULL,
	"repo_name" varchar(255) NOT NULL,
	"description" text,
	"default_branch" varchar(255) DEFAULT 'main' NOT NULL,
	"auto_pr_merge" boolean DEFAULT false NOT NULL,
	"forced_clone" boolean DEFAULT false NOT NULL,
	"runnable" boolean DEFAULT false NOT NULL,
	"is_ui" boolean DEFAULT false NOT NULL,
	"playwright_enabled" boolean DEFAULT false NOT NULL,
	"dev_server_url" varchar(1024),
	"improvement_scan_enabled" boolean DEFAULT false NOT NULL,
	"improvement_scan_interval_days" integer DEFAULT 14 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdlc"."sdlc_messaging_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"channel_id" varchar(255) NOT NULL,
	"channel_name" varchar(255) NOT NULL,
	"type" varchar(32) NOT NULL,
	"stage" varchar(50) NOT NULL,
	"platform" varchar(16) DEFAULT 'slack' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"members" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdlc"."sdlc_pod_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"pod_name" varchar(255) NOT NULL,
	"endpoint" varchar(1024),
	"session_id" varchar(255),
	"status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"git_repo" varchar(1024),
	"branch" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdlc"."sdlc_repo_env_vars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"key" varchar(256) NOT NULL,
	"value_secret_ref_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdlc"."sdlc_repo_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"relative_path" varchar(512) NOT NULL,
	"content_secret_ref_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdlc"."sdlc_repo_setup_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"pod_name" varchar(255) NOT NULL,
	"namespace" varchar(255) NOT NULL,
	"endpoint" varchar(1024),
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"requested_by" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sdlc"."sdlc_request_channel_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sdlc_request_id" uuid NOT NULL,
	"channel_id" varchar(255) NOT NULL,
	"channel_type" varchar(50) NOT NULL,
	"message_id" varchar(255) NOT NULL,
	"sender" varchar(255) NOT NULL,
	"sender_name" varchar(255),
	"sender_id" varchar(255),
	"content" text NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"snapshot_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdlc"."sdlc_request_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"screen_name" text,
	"mime_type" text DEFAULT 'image/png' NOT NULL,
	"object_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdlc"."sdlc_request_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"channel_type" varchar(50) NOT NULL,
	"content" text NOT NULL,
	"design_prompt" text,
	"design_prompt_options" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdlc"."sdlc_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_no" varchar(100) NOT NULL,
	"submitter" varchar(255) NOT NULL,
	"submitter_id" text,
	"submitter_email" varchar(255),
	"submitter_github_login" varchar(255),
	"request_site" varchar(50) NOT NULL,
	"dev_type" varchar(50) NOT NULL,
	"request_system" varchar(255) NOT NULL,
	"module" varchar(255),
	"status" varchar(50) DEFAULT '1_REGISTERED' NOT NULL,
	"dedup_key" varchar(255) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdlc"."sdlc_stage_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"from_status" varchar(50) NOT NULL,
	"to_status" varchar(50) NOT NULL,
	"idempotency_key" varchar(255) NOT NULL,
	"actor" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdlc"."sdlc_memory_access_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"token_secret_ref_id" uuid,
	"scope" varchar(16) DEFAULT 'read' NOT NULL,
	"subject_type" varchar(16) DEFAULT 'developer' NOT NULL,
	"owner_user_id" text,
	"request_id" uuid,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdlc"."sdlc_memory_rule_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content_md" text NOT NULL,
	"title" varchar(500),
	"change_summary" varchar(1000),
	"actor" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdlc"."sdlc_memory_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar(32) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"title" varchar(500) NOT NULL,
	"summary" varchar(1000),
	"content_md" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"severity" varchar(16) DEFAULT 'info' NOT NULL,
	"source_type" varchar(16) DEFAULT 'manual' NOT NULL,
	"source_ref_id" uuid,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"last_referenced_at" timestamp with time zone,
	"created_by_actor" varchar(255),
	"updated_by_actor" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdlc"."sdlc_incident_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"request_id" uuid,
	"kind" varchar(32) NOT NULL,
	"content_md" text,
	"commit_sha" varchar(64),
	"pr_number" integer,
	"claude_session_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdlc"."sdlc_incident_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_key" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"severity" varchar(16) DEFAULT 'medium' NOT NULL,
	"symptom_md" text NOT NULL,
	"payload_template" jsonb,
	"target_repo_id" uuid,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdlc"."sdlc_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_no" varchar(100) NOT NULL,
	"title" varchar(500) NOT NULL,
	"severity" varchar(16) NOT NULL,
	"source" varchar(32) DEFAULT 'manual' NOT NULL,
	"template_id" uuid,
	"status" varchar(32) DEFAULT 'DETECTED' NOT NULL,
	"symptom_md" text,
	"raw_payload" jsonb,
	"dedup_key" varchar(255) NOT NULL,
	"request_id" uuid,
	"memory_rule_id" uuid,
	"promotion_attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdlc"."sdlc_improvement_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"category" varchar(32) NOT NULL,
	"severity" varchar(16) DEFAULT 'medium' NOT NULL,
	"title" varchar(500) NOT NULL,
	"description_md" text NOT NULL,
	"file_paths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recommendation_md" text,
	"estimated_effort" varchar(16),
	"status" varchar(32) DEFAULT 'proposed' NOT NULL,
	"promoted_request_id" uuid,
	"memory_rule_id" uuid,
	"recurrence_count" integer DEFAULT 1 NOT NULL,
	"reject_reason" text,
	"reviewed_by" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdlc"."sdlc_improvement_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_no" varchar(100) NOT NULL,
	"repo_id" uuid NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"request_id" uuid,
	"base_commit_sha" varchar(64),
	"finding_count" integer DEFAULT 0 NOT NULL,
	"summary_md" text,
	"triggered_by" varchar(32) DEFAULT 'cron' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_conda_cache_versions" ADD CONSTRAINT "sdlc_conda_cache_versions_source_request_id_sdlc_requests_id_fk" FOREIGN KEY ("source_request_id") REFERENCES "sdlc"."sdlc_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_feedback_polls" ADD CONSTRAINT "sdlc_feedback_polls_request_id_sdlc_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "sdlc"."sdlc_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_github_credentials" ADD CONSTRAINT "sdlc_github_credentials_pat_secret_ref_id_secret_refs_id_fk" FOREIGN KEY ("pat_secret_ref_id") REFERENCES "sdlc"."secret_refs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_github_issues" ADD CONSTRAINT "sdlc_github_issues_request_id_sdlc_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "sdlc"."sdlc_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_github_orgs" ADD CONSTRAINT "sdlc_github_orgs_credential_id_sdlc_github_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "sdlc"."sdlc_github_credentials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_github_pull_requests" ADD CONSTRAINT "sdlc_github_pull_requests_request_id_sdlc_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "sdlc"."sdlc_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_github_repos" ADD CONSTRAINT "sdlc_github_repos_org_id_sdlc_github_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "sdlc"."sdlc_github_orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_messaging_channels" ADD CONSTRAINT "sdlc_messaging_channels_request_id_sdlc_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "sdlc"."sdlc_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_pod_sessions" ADD CONSTRAINT "sdlc_pod_sessions_request_id_sdlc_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "sdlc"."sdlc_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_repo_env_vars" ADD CONSTRAINT "sdlc_repo_env_vars_repo_id_sdlc_github_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "sdlc"."sdlc_github_repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_repo_env_vars" ADD CONSTRAINT "sdlc_repo_env_vars_value_secret_ref_id_secret_refs_id_fk" FOREIGN KEY ("value_secret_ref_id") REFERENCES "sdlc"."secret_refs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_repo_files" ADD CONSTRAINT "sdlc_repo_files_repo_id_sdlc_github_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "sdlc"."sdlc_github_repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_repo_files" ADD CONSTRAINT "sdlc_repo_files_content_secret_ref_id_secret_refs_id_fk" FOREIGN KEY ("content_secret_ref_id") REFERENCES "sdlc"."secret_refs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_repo_setup_jobs" ADD CONSTRAINT "sdlc_repo_setup_jobs_repo_id_sdlc_github_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "sdlc"."sdlc_github_repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_request_channel_messages" ADD CONSTRAINT "sdlc_request_channel_messages_sdlc_request_id_sdlc_requests_id_fk" FOREIGN KEY ("sdlc_request_id") REFERENCES "sdlc"."sdlc_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_request_images" ADD CONSTRAINT "sdlc_request_images_request_id_sdlc_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "sdlc"."sdlc_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_request_reports" ADD CONSTRAINT "sdlc_request_reports_request_id_sdlc_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "sdlc"."sdlc_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_requests" ADD CONSTRAINT "sdlc_requests_submitter_id_users_id_fk" FOREIGN KEY ("submitter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_stage_transitions" ADD CONSTRAINT "sdlc_stage_transitions_request_id_sdlc_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "sdlc"."sdlc_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_memory_access_tokens" ADD CONSTRAINT "sdlc_memory_access_tokens_token_secret_ref_id_secret_refs_id_fk" FOREIGN KEY ("token_secret_ref_id") REFERENCES "sdlc"."secret_refs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_memory_access_tokens" ADD CONSTRAINT "sdlc_memory_access_tokens_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_memory_access_tokens" ADD CONSTRAINT "sdlc_memory_access_tokens_request_id_sdlc_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "sdlc"."sdlc_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_memory_rule_revisions" ADD CONSTRAINT "sdlc_memory_rule_revisions_rule_id_sdlc_memory_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "sdlc"."sdlc_memory_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_incident_analyses" ADD CONSTRAINT "sdlc_incident_analyses_incident_id_sdlc_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "sdlc"."sdlc_incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_incident_analyses" ADD CONSTRAINT "sdlc_incident_analyses_request_id_sdlc_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "sdlc"."sdlc_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_incident_templates" ADD CONSTRAINT "sdlc_incident_templates_target_repo_id_sdlc_github_repos_id_fk" FOREIGN KEY ("target_repo_id") REFERENCES "sdlc"."sdlc_github_repos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_incidents" ADD CONSTRAINT "sdlc_incidents_template_id_sdlc_incident_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "sdlc"."sdlc_incident_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_incidents" ADD CONSTRAINT "sdlc_incidents_request_id_sdlc_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "sdlc"."sdlc_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_incidents" ADD CONSTRAINT "sdlc_incidents_memory_rule_id_sdlc_memory_rules_id_fk" FOREIGN KEY ("memory_rule_id") REFERENCES "sdlc"."sdlc_memory_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_improvement_findings" ADD CONSTRAINT "sdlc_improvement_findings_scan_id_sdlc_improvement_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "sdlc"."sdlc_improvement_scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_improvement_findings" ADD CONSTRAINT "sdlc_improvement_findings_promoted_request_id_sdlc_requests_id_fk" FOREIGN KEY ("promoted_request_id") REFERENCES "sdlc"."sdlc_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_improvement_findings" ADD CONSTRAINT "sdlc_improvement_findings_memory_rule_id_sdlc_memory_rules_id_fk" FOREIGN KEY ("memory_rule_id") REFERENCES "sdlc"."sdlc_memory_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_improvement_scans" ADD CONSTRAINT "sdlc_improvement_scans_repo_id_sdlc_github_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "sdlc"."sdlc_github_repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc"."sdlc_improvement_scans" ADD CONSTRAINT "sdlc_improvement_scans_request_id_sdlc_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "sdlc"."sdlc_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_correlation_idx" ON "sdlc"."audit_events" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "audit_events_action_idx" ON "sdlc"."audit_events" USING btree ("action","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sdlc_conda_cache_key_idx" ON "sdlc"."sdlc_conda_cache_versions" USING btree ("cache_key","env_hash");--> statement-breakpoint
CREATE INDEX "sdlc_feedback_polls_request_idx" ON "sdlc"."sdlc_feedback_polls" USING btree ("request_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "sdlc_github_issues_repo_number_idx" ON "sdlc"."sdlc_github_issues" USING btree ("repo","issue_number");--> statement-breakpoint
CREATE INDEX "sdlc_github_issues_request_id_idx" ON "sdlc"."sdlc_github_issues" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sdlc_github_orgs_url_idx" ON "sdlc"."sdlc_github_orgs" USING btree ("org_url");--> statement-breakpoint
CREATE UNIQUE INDEX "sdlc_github_pull_requests_repo_number_idx" ON "sdlc"."sdlc_github_pull_requests" USING btree ("repo","pr_number");--> statement-breakpoint
CREATE INDEX "sdlc_github_pull_requests_request_id_idx" ON "sdlc"."sdlc_github_pull_requests" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sdlc_github_repos_org_repo_idx" ON "sdlc"."sdlc_github_repos" USING btree ("org_id","repo_url");--> statement-breakpoint
CREATE UNIQUE INDEX "sdlc_messaging_channels_channel_id_idx" ON "sdlc"."sdlc_messaging_channels" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "sdlc_messaging_channels_req_type_idx" ON "sdlc"."sdlc_messaging_channels" USING btree ("request_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "sdlc_pod_sessions_request_id_idx" ON "sdlc"."sdlc_pod_sessions" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sdlc_repo_env_vars_repo_key_idx" ON "sdlc"."sdlc_repo_env_vars" USING btree ("repo_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "sdlc_repo_files_repo_path_idx" ON "sdlc"."sdlc_repo_files" USING btree ("repo_id","relative_path");--> statement-breakpoint
CREATE UNIQUE INDEX "sdlc_repo_setup_jobs_repo_id_idx" ON "sdlc"."sdlc_repo_setup_jobs" USING btree ("repo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sdlc_req_channel_msg_unique_idx" ON "sdlc"."sdlc_request_channel_messages" USING btree ("sdlc_request_id","channel_id","message_id");--> statement-breakpoint
CREATE INDEX "sdlc_req_channel_msg_cursor_idx" ON "sdlc"."sdlc_request_channel_messages" USING btree ("sdlc_request_id","channel_type","sent_at");--> statement-breakpoint
CREATE INDEX "sdlc_request_images_request_id_idx" ON "sdlc"."sdlc_request_images" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sdlc_request_reports_request_channel_idx" ON "sdlc"."sdlc_request_reports" USING btree ("request_id","channel_type");--> statement-breakpoint
CREATE UNIQUE INDEX "sdlc_requests_request_no_idx" ON "sdlc"."sdlc_requests" USING btree ("request_no");--> statement-breakpoint
CREATE UNIQUE INDEX "sdlc_requests_dedup_key_idx" ON "sdlc"."sdlc_requests" USING btree ("dedup_key");--> statement-breakpoint
CREATE UNIQUE INDEX "sdlc_stage_transitions_idem_idx" ON "sdlc"."sdlc_stage_transitions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "sdlc_memory_access_tokens_hash_idx" ON "sdlc"."sdlc_memory_access_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sdlc_memory_access_tokens_owner_idx" ON "sdlc"."sdlc_memory_access_tokens" USING btree ("owner_user_id","revoked_at");--> statement-breakpoint
CREATE INDEX "sdlc_memory_access_tokens_request_idx" ON "sdlc"."sdlc_memory_access_tokens" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sdlc_memory_rule_revisions_version_idx" ON "sdlc"."sdlc_memory_rule_revisions" USING btree ("rule_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "sdlc_memory_rules_slug_idx" ON "sdlc"."sdlc_memory_rules" USING btree ("category","slug");--> statement-breakpoint
CREATE INDEX "sdlc_memory_rules_category_idx" ON "sdlc"."sdlc_memory_rules" USING btree ("category","status");--> statement-breakpoint
CREATE INDEX "sdlc_memory_rules_status_idx" ON "sdlc"."sdlc_memory_rules" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sdlc_memory_rules_source_idx" ON "sdlc"."sdlc_memory_rules" USING btree ("source_type","source_ref_id");--> statement-breakpoint
CREATE INDEX "sdlc_incident_analyses_incident_idx" ON "sdlc"."sdlc_incident_analyses" USING btree ("incident_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sdlc_incident_templates_key_idx" ON "sdlc"."sdlc_incident_templates" USING btree ("template_key");--> statement-breakpoint
CREATE UNIQUE INDEX "sdlc_incidents_incident_no_idx" ON "sdlc"."sdlc_incidents" USING btree ("incident_no");--> statement-breakpoint
CREATE UNIQUE INDEX "sdlc_incidents_dedup_key_idx" ON "sdlc"."sdlc_incidents" USING btree ("dedup_key");--> statement-breakpoint
CREATE INDEX "sdlc_incidents_status_idx" ON "sdlc"."sdlc_incidents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sdlc_incidents_request_idx" ON "sdlc"."sdlc_incidents" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "sdlc_improvement_findings_scan_idx" ON "sdlc"."sdlc_improvement_findings" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX "sdlc_improvement_findings_fingerprint_idx" ON "sdlc"."sdlc_improvement_findings" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "sdlc_improvement_findings_status_idx" ON "sdlc"."sdlc_improvement_findings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sdlc_improvement_findings_category_severity_idx" ON "sdlc"."sdlc_improvement_findings" USING btree ("category","severity");--> statement-breakpoint
CREATE UNIQUE INDEX "sdlc_improvement_findings_scan_fingerprint_idx" ON "sdlc"."sdlc_improvement_findings" USING btree ("scan_id","fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "sdlc_improvement_scans_scan_no_idx" ON "sdlc"."sdlc_improvement_scans" USING btree ("scan_no");--> statement-breakpoint
CREATE INDEX "sdlc_improvement_scans_repo_idx" ON "sdlc"."sdlc_improvement_scans" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "sdlc_improvement_scans_status_idx" ON "sdlc"."sdlc_improvement_scans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sdlc_improvement_scans_repo_completed_idx" ON "sdlc"."sdlc_improvement_scans" USING btree ("repo_id","completed_at");