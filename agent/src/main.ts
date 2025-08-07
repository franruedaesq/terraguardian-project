import { Octokit } from '@octokit/rest';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { readFileSync } from 'fs';
import pino from 'pino';

import { GOVERNANCE_RULES } from './governance';
import { runTerraformPlan } from './terraform';
import { AnalysisResponseSchema, ViolationSchema } from './schemas';

const logger = pino({ transport: { target: 'pino-pretty' } });

async function main() {
  logger.info('Starting TerraGuardian PR Review...');

  const githubToken = process.env.GITHUB_TOKEN;
  const githubEventPath = process.env.GITHUB_EVENT_PATH;

  // OpenAI key is now read automatically by the client from env vars
  if (!githubToken || !process.env.OPENAI_API_KEY || !githubEventPath) {
    logger.error('Missing required environment variables.');
    process.exit(1);
  }

  const eventPayload = JSON.parse(readFileSync(githubEventPath, 'utf8'));
  const prNumber = eventPayload.pull_request?.number;
  const repoOwner = eventPayload.repository?.owner.login;
  const repoName = eventPayload.repository?.name;

  if (!prNumber || !repoOwner || !repoName) {
    logger.error('Could not determine PR details from GitHub event.');
    process.exit(1);
  }

  // 1. Run Terraform Plan
  const tfPlanJson = runTerraformPlan();
  if (!tfPlanJson) {
    logger.error('Failed to generate Terraform plan.');
    process.exit(1);
  }

  // 2. Analyze with OpenAI using the new Responses API
  const openai = new OpenAI();
  logger.info('Sending plan to OpenAI for structured analysis using gpt-4o-2024-08-06...');

  const response = await openai.responses.parse({
    model: "gpt-4o-2024-08-06",
    input: [
      {
        role: "system",
        content: `You are an expert AWS infrastructure security and cost analyst named TerraGuardian. Analyze the user-provided Terraform plan against the given governance rules and extract all violations into the required structured format.`,
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

  // 3. Post Comment to GitHub PR
  let commentBody = '### 🛡️ TerraGuardian Analysis Complete 🛡️\n\n';

  if (response.status === 'completed' && response.output_parsed) {
    const findings = response.output_parsed.violations;

    if (findings && findings.length > 0) {
      commentBody += '**Found issues that require your attention:**\n\n';
      findings.forEach((finding) => { // 'finding' is now fully typed!
        commentBody += `**[${finding.severity}]** - **${finding.violation_id}** on \`${finding.resource_address}\`\n`;
        commentBody += `* **Finding:** ${finding.finding_summary}\n`;
        commentBody += `* **Suggestion:** ${finding.remediation_suggestion}\n\n`;
      });
    } else {
      commentBody += '**✅ No governance violations found. Well done!**';
    }
  } else {
    // Handle cases where the model refuses or the response is incomplete
    logger.error({ msg: 'AI analysis did not complete successfully', status: response.status, details: response.incomplete_details });
    commentBody += `**⚠️ Analysis Incomplete:** The AI analysis could not be completed. Status: \`${response.status}\`. Please check the workflow logs.`;
  }

  const octokit = new Octokit({ auth: githubToken });
  await octokit.issues.createComment({
    owner: repoOwner,
    repo: repoName,
    issue_number: prNumber,
    body: commentBody,
  });

  logger.info('Successfully posted comment to PR.');
}

main();