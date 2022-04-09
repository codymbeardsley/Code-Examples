terraform {
  required_providers {
    linode = {
      source  = "linode/linode"
      version = "1.16.0"
    }
  }
}
provider "linode" {
  token = var.token
}

// Create ssh key
resource "linode_sshkey" "ssh_key" {
  label   = "ssh_key"
  ssh_key = chomp(file(var.root_pub_key))
}

// Generate random unique pet name
resource "random_pet" "redacted-replica" {
  length = 1
}

// Create Linode Instances 
resource "linode_instance" "redacted-db-relica" {
  label           = "redacted-db-replica-${random_pet.redacted-replica.id}"
  region          = var.region
  type            = "g6-standard-2"
  private_ip      = true

  disk {
    label = "boot"
    image  = "linode/ubuntu20.04"
    size=81920
    authorized_keys = [linode_sshkey.ssh_key.ssh_key]
    root_pass       = random_string.password.result
  }

  config {
    label = "replica_boot_config"
    kernel = "linode/latest-64bit"
    devices {
      sda {
        disk_label = "boot"
      }
      sdb {
        volume_id = linode_volume.redacted-db-volume.id
      }
    }
    root_device = "/dev/sda"
  }

  boot_config_label = "replica_boot_config"

  connection {
    type     = "ssh"
    user     = "root"
    password = random_string.password.result
    host     = self.ip_address
    agent    = true
  }

  provisioner "remote-exec" {
    inline = ["sudo apt update", "sudo apt install python3 -y", "echo Done!"]

    connection {
      host        = self.ip_address
      type        = "ssh"
      user        = "root"
      private_key = file(var.root_priv_key)
    }
  }

  provisioner "local-exec" {
    command = "ANSIBLE_HOST_KEY_CHECKING=False ansible-playbook -u root -i '${self.ip_address},' --private-key ${var.root_priv_key} -e 'pub_key=${var.root_pub_key}' --extra-vars 'private_ip=${self.private_ip_address} volume_fs_path=${ linode_volume.redacted-db-volume.filesystem_path }' ansible/setup.yml"
  }
}

resource "linode_volume" "redacted-db-volume" {
    label = "redacted-db-volume-${random_pet.redacted-replica.id}"
    region = var.region
    size=2500
}

output "root_password" {
  value = random_string.password.result
}
