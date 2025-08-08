import { EC2Client, DescribeVolumesCommand, DescribeInstancesCommand } from "@aws-sdk/client-ec2";
import { S3Client, ListBucketsCommand, GetBucketAclCommand } from "@aws-sdk/client-s3";
import { pino } from "pino";

const logger = pino();
const ec2Client = new EC2Client({ region: "eu-central-1" });
const s3Client = new S3Client({ region: "eu-central-1" });

// Hallazgo 1: Encontrar volúmenes de EBS que no están siendo utilizados
async function findUnattachedEBSVolumes(): Promise<string[]> {
  logger.info("Scanning for unattached EBS volumes...");
  const command = new DescribeVolumesCommand({
    Filters: [{ Name: "status", Values: ["available"] }],
  });
  const response = await ec2Client.send(command);
  const findings = response.Volumes?.map(v => `Unattached EBS Volume found: ${v.VolumeId} (Size: ${v.Size}GB)`) || [];
  logger.info(`Found ${findings.length} unattached volumes.`);
  return findings;
}

// Hallazgo 2: Encontrar buckets de S3 que son públicamente legibles
async function findPublicS3Buckets(): Promise<string[]> {
  logger.info("Scanning for public S3 buckets...");
  const findings: string[] = [];
  const { Buckets } = await s3Client.send(new ListBucketsCommand({}));

  if (!Buckets) return [];

  for (const bucket of Buckets) {
    try {
      const aclResponse = await s3Client.send(new GetBucketAclCommand({ Bucket: bucket.Name }));
      const isPublic = aclResponse.Grants?.some(
        grant => grant.Grantee?.URI === 'http://acs.amazonaws.com/groups/global/AllUsers'
      );
      if (isPublic) {
        findings.push(`Public S3 Bucket found: ${bucket.Name}`);
      }
    } catch (error) {
      // Ignorar errores de buckets que no permiten leer ACLs (lo cual es bueno)
    }
  }
  logger.info(`Found ${findings.length} public buckets.`);
  return findings;
}

/**
 * La función principal del escáner que ejecuta todas las comprobaciones.
 */
export async function runLiveScanner(): Promise<string[]> {
  logger.info("--- Starting Live AWS Environment Scan ---");
  const allFindings = await Promise.all([
    findUnattachedEBSVolumes(),
    findPublicS3Buckets(),
  ]);
  logger.info("--- Live Scan Finished ---");
  return allFindings.flat();
}