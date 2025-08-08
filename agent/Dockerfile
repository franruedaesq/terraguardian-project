# ---- Builder Stage ----
# Use the official AWS base image as our build environment.
FROM public.ecr.aws/lambda/nodejs:20-x86_64 as builder

WORKDIR /usr/app

# Copy project configuration files
COPY package*.json ./
COPY tsconfig.json ./

# Copy the source code
COPY src/ ./src/

# Install ALL dependencies (including devDependencies like typescript)
RUN npm install

# Build the TypeScript project into the /dist folder
RUN npm run build


# ---- Final Stage ----
# Start fresh from the same base image for a clean final image.
FROM public.ecr.aws/lambda/nodejs:20-x86_64

WORKDIR /var/task

# Install Terraform manually
RUN yum install -y wget unzip && \
    wget https://releases.hashicorp.com/terraform/1.9.0/terraform_1.9.0_linux_amd64.zip && \
    unzip terraform_1.9.0_linux_amd64.zip && \
    mv terraform /usr/local/bin/ && \
    rm terraform_1.9.0_linux_amd64.zip

# Copy the package.json file from the builder
COPY --from=builder /usr/app/package*.json ./

# Install ONLY the production dependencies to keep the image small
RUN npm install --omit=dev

# Copy the compiled JavaScript code from the builder stage
COPY --from=builder /usr/app/dist/ ./

# Set the command that Lambda will run. This looks for a 'handler' export in the 'main.js' file.
CMD [ "main.handler" ]