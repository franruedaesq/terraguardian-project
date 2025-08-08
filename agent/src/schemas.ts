import { z } from 'zod';

export const ViolationSchema = z.object({
  resource_address: z.string().describe("The full address of the resource with a violation."),
  violation_id: z.string().describe("The ID of the rule that was violated (e.g., Compliance-001)."),
  severity: z.enum(["Critical", "High", "Medium", "Low"]).describe("The severity level of the violation."),
  finding_summary: z.string().describe("A brief, one-sentence summary of the violation."),
  remediation_suggestion: z.string().describe("A clear, actionable suggestion to fix the violation."),
});

export const AnalysisResponseSchema = z.object({
  violations: z.array(ViolationSchema).describe("An array of all governance violations found in the Terraform plan."),
});

export type Violation = z.infer<typeof ViolationSchema>;
