variable "ecr_image_uri" {
  description = "The full URI of the agent's Docker image in ECR."
  type        = string
}

variable "github_repo" {
  description = "The GitHub repository where issues will be created (e.g., 'owner/repo')."
  type        = string
}

variable "github_token_secret_name" {
  description = "The name of the secret in AWS Secrets Manager that holds the GitHub token."
  type        = string
  default     = "terraguardian/github_token"
}
