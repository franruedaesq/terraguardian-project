import { Octokit } from "@octokit/rest";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { readFileSync } from "fs";
import { pino } from "pino";
import { GOVERNANCE_RULES } from "./governance.js";
import { runTerraformPlan } from "./terraform.js";
import { runLiveScanner } from "./scanner.js";
import { AnalysisResponseSchema, type Violation } from "./schemas.js";
import { violationsFound, pushMetrics } from "./metrics.js";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const logger = pino();
// const openai = new OpenAI();

async function getSecrets() {
  const secretsArn = process.env.SECRETS_ARN;
  if (!secretsArn) {
    throw new Error("SECRETS_ARN environment variable not set.");
  }
  const client = new SecretsManagerClient({ region: "eu-central-1" });
  const command = new GetSecretValueCommand({ SecretId: secretsArn });
  const response = await client.send(command);
  if (!response.SecretString) {
    throw new Error("SecretString not found in AWS Secrets Manager response.");
  }
  return JSON.parse(response.SecretString);
}

async function runPRReview() {
  logger.info("Starting TerraGuardian PR Review...");
  const secrets = await getSecrets();
  const githubToken = secrets.GITHUB_TOKEN;
  const openaiApiKey = secrets.OPENAI_API_KEY;
  //   const githubToken = process.env.GITHUB_TOKEN;
  const githubEventPath = process.env.GITHUB_EVENT_PATH;
  if (!githubToken || !process.env.OPENAI_API_KEY || !githubEventPath) {
    logger.error("Missing required environment variables for PR Review.");
    process.exit(1);
  }
  const eventPayload = JSON.parse(readFileSync(githubEventPath, "utf8"));
  const prNumber = eventPayload.pull_request?.number;
  const repoOwner = eventPayload.repository?.owner.login;
  const repoName = eventPayload.repository?.name;
  if (!prNumber || !repoOwner || !repoName) {
    logger.error("Could not determine PR details from GitHub event.");
    process.exit(1);
  }
  const tfPlanJson = runTerraformPlan();
  if (!tfPlanJson) {
    logger.error("Failed to generate Terraform plan.");
    process.exit(1);
  }
  logger.info("Sending plan to OpenAI for structured analysis using gpt-5...");
  const openai = new OpenAI({ apiKey: openaiApiKey });
  const response = await openai.responses.parse({
    model: "gpt-5",
    input: [
      {
        role: "system",
        content: `You are an expert AWS infrastructure security analyst named TerraGuardian. Analyze the user-provided Terraform plan against the given governance rules and extract all violations into the required structured format.`,
      },
      {
        role: "user",
        content: `Here are the rules:\n${GOVERNANCE_RULES}\n\nHere is the Terraform plan JSON:\n${tfPlanJson}`,
      },
    ],
    text: {
      format: zodTextFormat(AnalysisResponseSchema, "terraform_analysis"),
    },
  });
  let commentBody = "### 🛡️ TerraGuardian Analysis Complete 🛡️\n\n";
  if (response.status === "completed" && response.output_parsed) {
    const findings: Violation[] = response.output_parsed.violations;
    if (findings && findings.length > 0) {
      commentBody += "**Found issues that require your attention:**\n\n";
      findings.forEach((finding) => {
        violationsFound.inc({ mode: "pr-review", severity: finding.severity });
        commentBody += `**[${finding.severity}]** - **${finding.violation_id}** on \`${finding.resource_address}\`\n`;
        commentBody += `* **Finding:** ${finding.finding_summary}\n`;
        commentBody += `* **Suggestion:** ${finding.remediation_suggestion}\n\n`;
      });
    } else {
      commentBody += "**✅ No governance violations found. Well done!**";
    }
  } else {
    logger.error({
      msg: "AI analysis did not complete successfully",
      status: response.status,
      details: response.incomplete_details,
    });
    commentBody += `**⚠️ Analysis Incomplete:** The AI analysis could not be completed. Status: \`${response.status}\`. Please check the workflow logs.`;
  }
  const octokit = new Octokit({ auth: githubToken });
  await octokit.issues.createComment({
    owner: repoOwner,
    repo: repoName,
    issue_number: prNumber,
    body: commentBody,
  });

  await pushMetrics("pr-review");
  logger.info("Successfully pushed PR review metrics.");
}

async function runScanAndReport() {
  const secrets = await getSecrets();
  const githubToken = secrets.GITHUB_TOKEN;
  const openaiApiKey = secrets.OPENAI_API_KEY;

  logger.info("Starting Live Scan and Report...");
  //   const githubToken = process.env.GITHUB_TOKEN;
  const repoPath = process.env.GITHUB_REPOSITORY;
  if (!githubToken || !repoPath) {
    logger.error(
      "Missing GITHUB_TOKEN or GITHUB_REPOSITORY environment variables for Live Scan."
    );
    process.exit(1);
  }
  const openai = new OpenAI({ apiKey: openaiApiKey });

  const findings = await runLiveScanner();
  if (findings.length > 0) {
    violationsFound.inc(
      { mode: "live-scan", severity: "medium" },
      findings.length
    );
    const findingsText = findings.join("\n");
    const ReportSummarySchema = z.object({
      summary: z
        .string()
        .describe(
          "A brief, clear, and prioritized report summarizing the findings for a GitHub issue."
        ),
    });
    logger.info("Sending findings to OpenAI for summarization using gpt-5...");
    const response = await openai.responses.parse({
      model: "gpt-5",
      input: [
        {
          role: "system",
          content:
            "You are a cloud security analyst. Summarize the following findings into a brief, clear, and prioritized report.",
        },
        {
          role: "user",
          content: `Please summarize these issues:\n${findingsText}`,
        },
      ],
      text: {
        format: zodTextFormat(ReportSummarySchema, "security_report_summary"),
      },
    });
    if (response.status === "completed" && response.output_parsed) {
      const summary = response.output_parsed.summary;
      const issueBody = `### 🚨 TerraGuardian Weekly Security Report 🚨\n\nOur automated scan has detected the following potential issues in the AWS environment. Please review and remediate as necessary.\n\n--- \n\n${summary}`;
      const [repoOwner, repoName] = repoPath.split("/");
      const octokit = new Octokit({ auth: githubToken });
      await octokit.issues.create({
        owner: repoOwner,
        repo: repoName,
        title: `TerraGuardian Security Report - ${
          new Date().toISOString().split("T")[0]
        }`,
        body: issueBody,
        labels: ["security", "autogenerated"],
      });
      logger.info(`Successfully created security report issue in ${repoPath}`);
    } else {
      logger.error({
        msg: "AI summarization did not complete successfully",
        status: response.status,
      });
    }
  } else {
    logger.info("No findings from live scan. Environment is clean!");
  }

  await pushMetrics("live-scan");
  logger.info("Successfully pushed live scan metrics.");
}

export const handler = async (event: any) => {
  const mode = process.env.AGENT_MODE || "live-scan";
  logger.info(`Handler invoked. Running in '${mode}' mode.`);
  try {
    if (mode === "live-scan") {
      await runScanAndReport();
    } else {
      await runPRReview();
    }
    return { statusCode: 200, body: "Agent finished successfully." };
  } catch (error) {
    logger.error(error);
    return { statusCode: 500, body: "Agent encountered an error." };
  }
};
