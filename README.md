# Weekly Team Updates

Web-based weekly report generator for Shopify teams using Quick. Generate and view team status updates via a self-serve web UI - no local Claude Code required.

## Features

- **Self-serve generation**: Anyone on the team can generate weekly reports via the web UI
- **Live data**: Pulls migration metrics from BigQuery and project data from Vault
- **AI summaries**: Generates Top 3 Urgent Items using quick.ai
- **Archived weeks**: View previous weeks' reports in the sidebar
- **Export to PDF**: Print-friendly styling for sharing

## Architecture

Each team gets a self-contained folder that deploys to its own Quick subdomain:

```
weekly-team-updates/
├── markets/                 → markets-weekly-updates.quick.shopify.io
│   ├── index.html
│   ├── config.js           # Team-specific project IDs, queries
│   ├── js/main.js
│   └── css/styles.css
├── channels/                → channels-weekly-updates.quick.shopify.io
│   └── (same structure)
└── .github/workflows/
    └── deploy.yaml          # Auto-deploy on push
```

## Quick Start

### For Markets Team

Visit: https://markets-weekly-updates.quick.shopify.io

On Monday or Tuesday, click "Generate This Week's Report" to:
1. Fetch migration metrics from BigQuery
2. Pull project data from Vault
3. Generate AI-powered urgent items analysis
4. Save and display the report

### Creating a New Team Instance

1. **Copy an existing team folder:**
   ```bash
   cp -r markets/ your-team/
   ```

2. **Update config.js with your team's data:**
   - `teamName`: Your team's name
   - `siteKey`: Your Quick subdomain (e.g., `your-team-weekly-updates`)
   - `slackChannel`: Your team's Slack channel
   - `projects`: Array of Vault project IDs your team owns
   - `dependentProjects`: External projects that depend on your team
   - `queries`: BigQuery SQL for your team's metrics

3. **Add deploy step to `.github/workflows/deploy.yaml`:**
   ```yaml
   - name: Deploy your-team
     run: |
       curl -X POST "${{ secrets.QUICK_DEPLOY_URL }}" \
         -H "Content-Type: application/json" \
         -d '{"site": "your-team-weekly-updates", "path": "your-team"}'
   ```

4. **Push to main** - GitHub Actions will auto-deploy

## Data Sources

### BigQuery (via quick.dw)
- Migration metrics: GMV migrated %, shops remaining, safe apps %
- Week-over-week changes

### Vault (via quick.ai + MCP)
- Project status, state, champion, target dates
- Recent blockers and updates
- Dependent project information

## Generation Rules

- **When**: Monday and Tuesday only (button hidden other days)
- **Who**: Anyone with Quick access can generate
- **What**: Regenerating overwrites the current week's report
- **Storage**: Reports saved to quick.db with week key (YYYY-MM-DD)

## Local Development

1. Clone the repo
2. Run a local server in the team folder:
   ```bash
   cd markets
   python -m http.server 8080
   ```
3. Note: quick.* APIs require Quick environment to function

## Troubleshooting

**"Generation only available Monday-Tuesday"**
- The generate button is intentionally restricted to Mon/Tue to ensure reports reflect the start of week

**BigQuery data showing "--"**
- Check the queries in config.js match your team's data sources
- Verify quick.dw is accessible

**Vault projects not loading**
- Verify project IDs in config.js are correct
- Check quick.ai + vault-mcp connectivity

## Contributing

1. Fork this repo
2. Create your team's folder
3. Submit a PR to add your team to the deploy workflow

## Questions?

- Markets team: #markets-migration
- Quick platform: #quick-platform
