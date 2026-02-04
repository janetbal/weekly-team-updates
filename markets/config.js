/**
 * Markets Team Configuration
 * Edit this file to customize for your team
 */

const CONFIG = {
  // Team identity
  teamName: "Markets",
  siteKey: "markets-weekly-updates",
  slackChannel: "#markets-migration",

  // BigQuery query for Vault project data (replaces Cloud Function approach)
  // Uses shopify-dw.people.vault_project_current table
  queries: {
    // Vault project data query with recent status updates
    vaultProjects: `
      WITH recent_posts AS (
        SELECT
          CAST(postable_id AS STRING) AS project_id,
          STRING_AGG(
            COALESCE(tldr, LEFT(body, 300)),
            ' | '
            ORDER BY created_at DESC
            LIMIT 3
          ) AS recent_updates,
          MAX(created_at) AS last_update_at
        FROM \`shopify-dw.base.base__vault_posts\`
        WHERE postable_type = 'GSD::Project'
          AND CAST(postable_id AS STRING) IN ({PROJECT_IDS})
          AND created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 14 DAY)
        GROUP BY postable_id
      )
      SELECT
        p.project_id,
        p.title AS name,
        p.current_state AS state,
        p.champion_name AS champion,
        p.tldr AS project_summary,
        COALESCE(rp.recent_updates, p.tldr) AS recent_updates,
        FORMAT_DATE('%b %d', p.project_latest_estimated_end_on) AS target_end_date,
        p.latest_project_text_update_status AS date_health,
        p.priority,
        p.is_past_due_date,
        p.is_off_track_active_project,
        p.updated_at,
        rp.last_update_at
      FROM \`shopify-dw.people.vault_project_current\` p
      LEFT JOIN recent_posts rp ON CAST(p.project_id AS STRING) = rp.project_id
      WHERE p.project_id IN ({PROJECT_IDS})
      ORDER BY CASE p.priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END
    `,

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

  // Project IDs to fetch from Vault (via BigQuery)
  projectIds: ["46500", "48197", "48334", "48958", "47919"],

  // Static fallback data (used if BigQuery unavailable)
  projects: [
    {
      vaultId: "46500",
      name: "Sub-country Markets",
      champion: "Cole Atkinson",
      state: "Build",
      priority: "p0",
      targetEndDate: "Feb 20",
      dateHealth: "on-track",
      risk: "Medium"
    },
    {
      vaultId: "48197",
      name: "Catalog Changesets",
      champion: "Courtney Goodin",
      state: "Build",
      priority: "p1",
      targetEndDate: "Apr 10",
      dateHealth: "on-track",
      risk: "Low"
    },
    {
      vaultId: "48334",
      name: "Translations for Themes",
      champion: "Cole Atkinson",
      state: "Build",
      priority: "p1",
      targetEndDate: "Mar 6",
      dateHealth: "on-track",
      risk: "Low"
    },
    {
      vaultId: "48958",
      name: "Yugabyte Migration",
      champion: "Prathul Prabhakar",
      state: "Build",
      priority: "p1",
      targetEndDate: "Mar 19",
      dateHealth: "on-track",
      risk: "Low"
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

  // AI prompt for generating urgent items (focus on owned projects only)
  urgentItemsPrompt: `Based on the following Markets team weekly data, identify the top 3 most urgent items that need discussion or action.

IMPORTANT: Focus ONLY on projects owned by Markets team. Do NOT include items about dependent/external projects.

Consider:
- Projects at risk or off-track
- Migration blockers affecting our deliverables
- Deadline proximity for our projects
- Data anomalies in migration metrics

For each urgent item, provide:
1. A short title (under 60 chars)
2. Why it's urgent (1-2 sentences with specific data)
3. Recommended action (1 sentence, actionable)

Format as JSON array with objects containing: title, reason, action`
};

// Export for use in main.js
window.CONFIG = CONFIG;
