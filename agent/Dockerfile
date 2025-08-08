
FROM public.ecr.aws/lambda/nodejs:20-x86_64 as builder

WORKDIR /usr/app

COPY package*.json ./
COPY tsconfig.json ./
COPY src/ ./src/

RUN npm install
RUN npm run build

RUN npm prune --production


FROM public.ecr.aws/lambda/nodejs:20-x86_64

WORKDIR /var/task

RUN microdnf install -y wget unzip && \
    wget https://releases.hashicorp.com/terraform/1.9.0/terraform_1.9.0_linux_amd64.zip && \
    unzip terraform_1.9.0_linux_amd64.zip && \
    mv terraform /usr/local/bin/ && \
    rm terraform_1.9.0_linux_amd64.zip && \
    microdnf clean all

COPY --from=builder /usr/app/package.json ./
    
COPY --from=builder /usr/app/node_modules ./node_modules

COPY --from=builder /usr/app/dist/ ./

CMD [ "main.handler" ]