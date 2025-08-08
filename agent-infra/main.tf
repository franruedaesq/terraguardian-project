data "aws_caller_identity" "current" {}
data "aws_secretsmanager_secret_version" "github_token" {
  secret_id = var.github_token_secret_name
}

locals {
  secrets = jsondecode(data.aws_secretsmanager_secret_version.github_token.secret_string)
}

resource "aws_iam_role" "lambda_exec_role" {
  name = "TerraGuardian-LambdaExecRole"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" } }]
  })
}
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}
resource "aws_iam_role_policy" "lambda_permissions" {
  name = "TerraGuardian-LambdaPermissions"
  role = aws_iam_role.lambda_exec_role.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      { Action = ["ec2:DescribeVolumes", "ec2:DescribeInstances", "s3:ListAllMyBuckets", "s3:GetBucketAcl"], Effect = "Allow", Resource = "*" },
      { Action = "secretsmanager:GetSecretValue", Effect = "Allow", Resource = data.aws_secretsmanager_secret_version.github_token.arn }
    ]
  })
}

resource "aws_lambda_function" "scanner_agent" {
  function_name = "TerraGuardian-ScannerAgent"
  role          = aws_iam_role.lambda_exec_role.arn
  package_type  = "Image"
  image_uri     = "${var.ecr_image_uri}:latest"
  timeout       = 300
  architectures = ["x86_64"]

  environment {
    variables = {
      AGENT_MODE        = "live-scan"
      GITHUB_REPOSITORY = var.github_repo
      GITHUB_TOKEN      = local.secrets.GITHUB_TOKEN
      OPENAI_API_KEY    = local.secrets.OPENAI_API_KEY
    }
  }
}

resource "aws_cloudwatch_event_rule" "daily_scan_trigger" {
  name                = "TerraGuardian-DailyScanTrigger"
  description         = "Triggers the TerraGuardian scanner once a day."
  schedule_expression = "cron(0 10 * * ? *)"
}
resource "aws_cloudwatch_event_target" "invoke_lambda" {
  rule = aws_cloudwatch_event_rule.daily_scan_trigger.name
  arn  = aws_lambda_function.scanner_agent.arn
}
resource "aws_lambda_permission" "allow_cloudwatch" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.scanner_agent.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily_scan_trigger.arn
}
