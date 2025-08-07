// Import the necessary modules for path manipulation in ESM
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

// Get the current directory path for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function runTerraformPlan(): string | null {
  const infraDir = join(__dirname, '../../../infrastructure');
  if (!existsSync(infraDir)) {
    console.error(`Infrastructure directory not found at: ${infraDir}`);
    process.exit(1);
  }

  try {
    console.log('Initializing Terraform...');
    execSync('terraform init', { cwd: infraDir, stdio: 'inherit' });

    console.log('Running terraform plan...');
    execSync('terraform plan -out=tfplan.binary', { cwd: infraDir, stdio: 'inherit' });

    console.log('Converting plan to JSON...');
    const jsonPlan = execSync('terraform show -json tfplan.binary', { cwd: infraDir }).toString();

    return jsonPlan;
  } catch (error) {
    console.error('Error running Terraform:', error);
    return null;
  }
}