/**
 * Markets Team Configuration
 * Edit this file to customize for your team
 */

const CONFIG = {
  // Team identity
  teamName: "Markets",
  siteKey: "markets-weekly-updates",
  slackChannel: "#markets-migration",

  // Vault projects owned by this team
  projects: [
    {
      vaultId: "46500",
      name: "Sub-country Markets",
      champion: "Cole Atkinson",
      description: "Province/state-level market segmentation"
    },
    {
      vaultId: "48197",
      name: "Catalog Changesets",
      champion: "Courtney Goodin",
      description: "Track catalog changes for market-specific pricing"
    },
    {
      vaultId: "48334",
      name: "Translations for Themes",
      champion: "Cole Atkinson",
      description: "Theme content localization via Markets"
    },
    {
      vaultId: "48958",
      name: "Yugabyte Migration",
      champion: "Prathul Prabhakar",
      description: "Database migration to Yugabyte"
    }
  ],

  // External projects that depend on Markets team
  dependentProjects: [
    {
      vaultId: "43504",
      name: "Discounts by Market",
      team: "Pricing",
      lead: "David Wolf",
      marketsImpact: "Needs MarketInheritedCustomizations API"
    },
    {
      vaultId: null, // TBD - needs to be added to Vault
      name: "Rollouts",
      team: "Markets (Lisa)",
      lead: "Lisa Steigher",
      marketsImpact: "Depends on Translations for Themes, content responders"
    }
  ],

  // BigQuery SQL queries for migration metrics
  queries: {
    // Main migration summary - GMV and shop counts
    migrationSummary: `
      WITH current_week AS (
        SELECT
          ROUND(SUM(CASE WHEN is_migrated THEN gmv ELSE 0 END) / SUM(gmv) * 100, 2) as gmv_migrated_pct,
          COUNT(CASE WHEN NOT is_migrated THEN 1 END) as shops_remaining,
          DATE_TRUNC(CURRENT_DATE(), WEEK(MONDAY)) as week_start
        FROM \`shopify-dw.markets.migration_status\`
        WHERE snapshot_date = CURRENT_DATE() - 1
      ),
      previous_week AS (
        SELECT
          ROUND(SUM(CASE WHEN is_migrated THEN gmv ELSE 0 END) / SUM(gmv) * 100, 2) as gmv_migrated_pct,
          COUNT(CASE WHEN NOT is_migrated THEN 1 END) as shops_remaining
        FROM \`shopify-dw.markets.migration_status\`
        WHERE snapshot_date = CURRENT_DATE() - 8
      )
      SELECT
        c.gmv_migrated_pct,
        c.shops_remaining,
        ROUND(c.gmv_migrated_pct - p.gmv_migrated_pct, 2) as gmv_change_wow,
        c.shops_remaining - p.shops_remaining as shops_change_wow,
        c.week_start
      FROM current_week c, previous_week p
    `,

    // Safe apps percentage
    safeApps: `
      WITH current_week AS (
        SELECT
          ROUND(COUNT(CASE WHEN is_safe THEN 1 END) / COUNT(*) * 100, 1) as safe_pct
        FROM \`shopify-dw.markets.app_migration_status\`
        WHERE snapshot_date = CURRENT_DATE() - 1
      ),
      previous_week AS (
        SELECT
          ROUND(COUNT(CASE WHEN is_safe THEN 1 END) / COUNT(*) * 100, 1) as safe_pct
        FROM \`shopify-dw.markets.app_migration_status\`
        WHERE snapshot_date = CURRENT_DATE() - 8
      )
      SELECT
        c.safe_pct,
        ROUND(c.safe_pct - p.safe_pct, 1) as safe_change_wow
      FROM current_week c, previous_week p
    `
  },

  // Key dates to display (static, update as needed)
  keyDates: [
    { date: "Feb 6", event: "Sub-country Markets internal release" },
    { date: "Feb 20", event: "Sub-country Markets end date" },
    { date: "Mar 6", event: "Translations for Themes target end" },
    { date: "Mar 9", event: "Rollouts GA (at risk)" },
    { date: "Mar 19", event: "Yugabyte Migration target end" },
    { date: "Apr 1", event: "Markets API force migration deadline" },
    { date: "Apr 10", event: "Catalog Changesets target end" },
    { date: "Apr 23", event: "Discounts by Market limited release" },
    { date: "Jun 30", event: "Discounts by Market end date" }
  ],

  // AI prompt for generating urgent items
  urgentItemsPrompt: `Based on the following Markets team weekly data, identify the top 3 most urgent items that need discussion or action.

Consider:
- Projects at risk or off-track
- Migration blockers
- Deadline proximity
- Cross-team dependencies
- Data anomalies

For each urgent item, provide:
1. A short title (under 60 chars)
2. Why it's urgent (1-2 sentences with specific data)
3. Recommended action (1 sentence, actionable)

Format as JSON array with objects containing: title, reason, action`
};

// Export for use in main.js
window.CONFIG = CONFIG;
