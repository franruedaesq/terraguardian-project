# Use the official AWS base image for Node.js 20 on x86_64 architecture.
# This image includes Node.js, npm, and the required Lambda Runtime Interface Client.
FROM public.ecr.aws/lambda/nodejs:20-x86_64

# Manually install Terraform
RUN yum install -y wget unzip && \
    wget https://releases.hashicorp.com/terraform/1.9.0/terraform_1.9.0_linux_amd64.zip && \
    unzip terraform_1.9.0_linux_amd64.zip && \
    mv terraform /usr/local/bin/ && \
    rm terraform_1.9.0_linux_amd64.zip

# Copy the agent's code and install dependencies
WORKDIR /var/task
COPY package*.json ./
RUN npm install
COPY dist/ ./

# Set the command to run your handler function.
# The format is <filename>.<handler_function_name>.
# Our compiled entrypoint is main.js, and we'll export a function called 'handler'.
CMD [ "main.handler" ]