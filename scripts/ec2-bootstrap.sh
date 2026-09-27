#!/usr/bin/env bash
# Run this ONCE, on a fresh EC2 instance, right after SSHing in for the
# first time. See DEPLOY.md for how to get to this point (launching the
# instance, security group, connecting). This script only installs Docker
# and clones the repo - it deliberately does NOT start the app, since that
# needs a real .env filled in first (see the "after this script" step in
# DEPLOY.md).
set -euo pipefail

REPO_URL="https://github.com/VimalSN/work-management-platform.git"
REPO_DIR="$HOME/work-management-platform"

echo "==> Updating system packages"
sudo apt-get update -y

echo "==> Installing Docker"
sudo apt-get install -y ca-certificates curl gnupg git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

echo "==> Allowing the current user to run docker without sudo"
sudo usermod -aG docker "$USER"

echo "==> Cloning the repo"
if [ ! -d "$REPO_DIR" ]; then
  git clone "$REPO_URL" "$REPO_DIR"
else
  echo "    $REPO_DIR already exists, skipping clone"
fi

cat <<'EOF'

==> Done. Log out and back in (or run `newgrp docker`) so the docker group
    membership takes effect, then:

      cd ~/work-management-platform
      cp .env.prod.example .env
      nano .env   # fill in real values - see DEPLOY.md

    ...and continue with DEPLOY.md's next step.
EOF
