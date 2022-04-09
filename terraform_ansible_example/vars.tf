variable "token" {
  description = "Your APIv4 Access Token"
}

variable "region" {
  description = "The data center where your NodeBalancer and Nodes will reside. E.g., 'us-east'."
  default     = "us-central"
}

variable "root_pub_key" {
  description = "The local file location of the SSH key that will be transferred to each Linode."
}

variable "root_priv_key" {
  description = "The local file location of the SSH key that will be transferred to each Linode."
}

resource "random_string" "password" {
  length  = 32
  special = true
  upper   = true
  lower   = true
  number  = true
}

