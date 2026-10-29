# Self-hosted CI runner

Why: GitHub-hosted jobs stop when the account's Actions billing is blocked. The workflows
read `runs-on` from the repository variable `CI_RUNNER`; unset = GitHub-hosted, so going
back is deleting the variable.

## Machine

A fresh Ubuntu 24.04 VM (Proxmox), **not** the Coolify host and not the production
database's machine: CI starts its own PostgreSQL on :5432 and MinIO on :9000, and runs
whatever code a branch contains. 4 vCPU / 8 GB / 60 GB is plenty. One runner process only
(the database job binds fixed ports, so two jobs at once would clash).

```bash
sudo apt-get update && sudo apt-get install -y curl git jq build-essential ca-certificates
curl -fsSL https://get.docker.com | sudo sh
sudo adduser --disabled-password --gecos "" runner && sudo usermod -aG docker runner
sudo -iu runner
```

## Register

GitHub: Settings (organisation or repo) → Actions → Runners → New self-hosted runner →
Linux x64. Copy the download and `config.sh` commands it shows (the token lasts about an
hour). When `config.sh` asks, use the label `enzo-ci` and the default work folder.

```bash
./config.sh --url https://github.com/NPATELGROUP-LTD/Enzo-Interiors --token <TOKEN> --labels enzo-ci --unattended
exit
cd /home/runner/actions-runner   # or wherever it was unpacked
sudo ./svc.sh install runner && sudo ./svc.sh start
```

## Switch over

Repo → Settings → Secrets and variables → Actions → Variables → New: `CI_RUNNER` = `enzo-ci`.
Re-run the failed checks on the PR. Job names are unchanged, so required checks still match.

## Notes

- Private repository only. Never attach this runner to a public one: any pull request
  could run code on it.
- Anyone who can push a branch can run code on this VM. Keep it off the studio network
  and give it no secrets beyond CI's throwaway test keys.
- Keep it updated: `sudo apt-get upgrade`; the runner updates itself.
- If a job still will not start with "payments have failed", the block also covers
  self-hosted jobs: fix the billing card instead.
