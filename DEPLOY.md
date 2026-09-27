# Deploying to AWS

A one-time deploy of the whole stack (Postgres, Redis, backend, frontend) to
a single AWS EC2 instance via Docker Compose. This mirrors local dev almost
exactly - same `docker-compose` model, same containers - just all four
services on one box instead of two run via Docker and two via `npm run dev`.

This is deliberately the simplest architecture that's still genuinely "on
AWS": one EC2 instance, no VPC/RDS/ElastiCache/load-balancer setup. That's a
reasonable next step later (see "Future work" at the bottom), not required
for a first deploy.

Everything here that touches the AWS console, or enters real
secrets/payment details, has to be done by you - account creation and
billing aren't things I can do on your behalf. Everything else (Dockerfiles,
compose file, the bootstrap script) is already written and committed.

## 1. Launch the EC2 instance

In the AWS Console → EC2 → **Launch instance**:

- **Name**: whatever you like (e.g. `meridian`)
- **AMI**: Ubuntu Server 24.04 LTS
- **Instance type**: `t2.micro` or `t3.micro` (both are in the AWS Free
  Tier's 750 hours/month for the first 12 months on a new account)
- **Key pair**: create a new one, download the `.pem` file, keep it
  somewhere safe - you'll need it to SSH in and for the GitHub Actions
  deploy secret later
- **Network settings → Edit → Security group**: allow these inbound rules:
  - SSH (22) - source: "My IP" (not 0.0.0.0/0 - no reason to expose SSH to
    the whole internet)
  - HTTP (80) - source: Anywhere (this is the frontend)
  - Custom TCP (4000) - source: Anywhere (this is the backend API)
- **Storage**: the default 8GB is enough

Launch it, wait for it to be "Running," and note its **public IPv4 address**
- you'll need it several times below.

## 2. Connect and bootstrap

```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

Once connected, paste the contents of
[scripts/ec2-bootstrap.sh](scripts/ec2-bootstrap.sh) into the terminal (or
`curl` it directly):

```bash
curl -fsSL https://raw.githubusercontent.com/VimalSN/work-management-platform/main/scripts/ec2-bootstrap.sh | bash
```

This installs Docker and clones the repo to `~/work-management-platform`.
Log out and back in afterward (`exit`, then SSH in again) so your user's new
`docker` group membership takes effect.

## 3. Configure environment variables

```bash
cd ~/work-management-platform
cp .env.prod.example .env
```

Edit `.env` (`nano .env`) and fill in:

- `POSTGRES_PASSWORD` - any strong password (Postgres isn't exposed outside
  the Docker network, but don't leave it as `replace_me`)
- `JWT_ACCESS_SECRET` - generate one:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  (or just use `openssl rand -hex 32` if Node isn't on your PATH yet)
- `FRONTEND_URL` and `VITE_API_URL` - replace `YOUR_EC2_PUBLIC_IP` with the
  instance's actual public IP from step 1

## 4. Start everything

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

First run builds both images, which takes a few minutes. Once it's done:

```bash
docker compose -f docker-compose.prod.yml exec backend npm run migrate
```

This applies every migration under `backend/prisma/migrations/` to the
fresh database - the same command `npm run migrate` runs locally, just
inside the container.

## 5. Verify

Visit `http://YOUR_EC2_PUBLIC_IP` in a browser - you should see the login
screen. Register the first account (this becomes your organization's Admin,
same as local dev). Check `http://YOUR_EC2_PUBLIC_IP:4000/health` too - it
should report `database: "ok"` and `redis: "ok"`.

## 6. (Optional) Wire up one-click redeploys

`.github/workflows/deploy.yml` already exists and is ready to use - it just
needs three repo secrets (GitHub repo → Settings → Secrets and variables →
Actions → **New repository secret**):

- `EC2_HOST` - the instance's public IP
- `EC2_USER` - `ubuntu`
- `EC2_SSH_KEY` - the full contents of the `.pem` file from step 1

Once those exist, Actions → "Deploy to EC2" → **Run workflow** will SSH in,
pull the latest `main`, rebuild, and re-run migrations - the same four
commands from steps 4-5, just triggered from GitHub instead of typed by hand.

## Future work (not part of this deploy)

- Move Postgres to RDS and Redis to ElastiCache instead of running them as
  containers on the same box - separates the database's lifecycle from the
  app's, and is what you'd actually want once more than one person depends
  on this staying up.
- Put the EC2 instance behind an Application Load Balancer with an SSL
  certificate (ACM) instead of talking to it over plain HTTP on a raw IP.
- Move from a single instance to ECS/Fargate if this ever needs to run more
  than one instance of the backend.
