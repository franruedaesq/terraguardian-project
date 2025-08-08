provider "aws" {
  region = "eu-central-1"
}

data "aws_ami" "amazon_linux_2" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_security_group" "pushgateway_sg" {
  name        = "pushgateway-sg"
  description = "Allow traffic to Prometheus Pushgateway"

  ingress {
    from_port   = 9091
    to_port     = 9091
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

data "template_file" "user_data" {
  template = <<-EOF
    #!/bin/bash
    sudo yum update -y
    sudo yum install -y docker
    sudo service docker start
    sudo usermod -a -G docker ec2-user
    sudo docker run -d -p 9091:9091 --name pushgateway prom/pushgateway
  EOF
}

resource "aws_instance" "pushgateway_server" {
  # CORRECTED: Use the ID from the data source instead of a hardcoded value
  ami             = data.aws_ami.amazon_linux_2.id
  instance_type   = "t2.micro"
  user_data       = data.template_file.user_data.rendered
  security_groups = [aws_security_group.pushgateway_sg.name]

  tags = {
    Name = "Prometheus-Pushgateway"
  }
}

output "pushgateway_public_ip" {
  value = aws_instance.pushgateway_server.public_ip
}
