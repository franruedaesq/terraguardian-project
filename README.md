# 🤖 TerraGuardian: Agentic AI DevOps Assistant for AWS

TerraGuardian is a proof-of-concept project demonstrating an autonomous AI agent that enhances the DevOps lifecycle for AWS environments. The agent operates in two modes: it proactively scans live AWS accounts for security and cost-optimization issues, and it automatically reviews Terraform pull requests for governance violations.

This project showcases a complete, end-to-end DevOps workflow, including CI/CD with GitHub Actions, Infrastructure as Code (IaC) with Terraform, and real-time monitoring with Prometheus and Grafana.



---
## ## Features

* **Proactive Live Scanning**: Deployed as a serverless AWS Lambda function, the agent runs on a daily schedule to scan for common misconfigurations like public S3 buckets and unattached EBS volumes.
* **Automated Reporting**: When issues are found, the agent uses an LLM (GPT-5) to summarize the findings and automatically creates a detailed issue in the GitHub repository.
* **Intelligent PR Reviews**: Integrates directly with GitHub pull requests to analyze `terraform plan` outputs, flagging potential policy violations before they are applied.
* **Full CI/CD Pipeline**: Automatically builds and pushes the agent's Docker image to a private Amazon ECR repository upon every merge to `main`.
* **Comprehensive Monitoring**: Pushes key operational metrics (e.g., violations found) to a Prometheus Pushgateway, visualized on a custom Grafana dashboard.

---
## ## Tech Stack

* **Agent & Application Logic**: TypeScript, Node.js
* **AI & LLM**: OpenAI API (`gpt-5`) with Zod for structured outputs
* **Infrastructure as Code**: Terraform
* **CI/CD**: GitHub Actions
* **Containerization**: Docker, Amazon ECR (Private)
* **Deployment**: AWS Lambda, Amazon EC2
* **Monitoring**: Prometheus, Prometheus Pushgateway, Grafana

---
## ## Getting Started

### Prerequisites
* AWS Account & configured AWS CLI
* Node.js and npm
* Terraform
* Docker Desktop
* GitHub Account

### Setup
1.  **Clone the repository**:
    ```bash
    git clone [https://github.com/your-username/terraguardian-project.git](https://github.com/your-username/terraguardian-project.git)
    cd terraguardian-project
    ```
2.  **Install dependencies** for the agent:
    ```bash
    cd agent
    npm install
    ```
3.  **Configure secrets** in AWS Secrets Manager (`terraguardian/github_token`) with your `GITHUB_TOKEN` and `OPENAI_API_KEY`.
4.  **Deploy the monitoring infrastructure** (Prometheus Pushgateway on EC2):
    ```bash
    cd ../monitoring-infra
    terraform init
    terraform apply
    ```
5.  **Deploy the agent infrastructure** (Lambda function):
    * Create an `agent-infra/terraform.tfvars` file with your ECR URI and GitHub repo name.
    * Run `terraform apply` from the `agent-infra` directory.
