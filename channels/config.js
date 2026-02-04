/**
 * Channels Team Configuration
 * Edit this file to customize for your team
 */

const CONFIG = {
  // Team identity
  teamName: "Channels",
  siteKey: "channels-weekly-updates",
  slackChannel: "#channels-platform-team",

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

    // Channel adoption metrics
    channelSummary: `
      SELECT
        COUNT(DISTINCT shop_id) as active_channel_shops,
        COUNT(DISTINCT channel_id) as active_channels,
        DATE_TRUNC(CURRENT_DATE(), WEEK(MONDAY)) as week_start
      FROM \`shopify-dw.channels.channel_installations\`
      WHERE snapshot_date = CURRENT_DATE() - 1
        AND is_active = true
    `,

    // Agentic enrollment metrics
    agenticEnrollment: `
      SELECT
        COUNT(CASE WHEN is_enrolled THEN 1 END) as enrolled_shops,
        COUNT(*) as eligible_shops,
        ROUND(COUNT(CASE WHEN is_enrolled THEN 1 END) / COUNT(*) * 100, 1) as enrollment_pct
      FROM \`shopify-dw.channels.agentic_enrollment_status\`
      WHERE snapshot_date = CURRENT_DATE() - 1
    `
  },

  // Project IDs to fetch from Vault (via BigQuery)
  projectIds: ["47702", "47893", "46227", "48231", "48598"],

  // Static fallback data (used if BigQuery unavailable)
  projects: [
    {
      vaultId: "47702",
      name: "Channels Storefronts in Admin",
      champion: "Janet Balneaves",
      state: "Build",
      priority: "p0",
      targetEndDate: "Feb 15",
      dateHealth: "on-track",
      risk: "Medium"
    },
    {
      vaultId: "47893",
      name: "Multi-channel Apps",
      champion: "Luke Amery",
      state: "Prototype",
      priority: "p1",
      targetEndDate: null,
      dateHealth: "on-track",
      risk: "Low"
    },
    {
      vaultId: "46227",
      name: "Channel Markets",
      champion: "Janet Balneaves",
      state: "Prototype",
      priority: "p1",
      targetEndDate: null,
      dateHealth: "on-track",
      risk: "Low"
    },
    {
      vaultId: "48231",
      name: "Default Schema for Shopify Catalog",
      champion: "Tejas Mehta",
      state: "Observe",
      priority: "p1",
      targetEndDate: null,
      dateHealth: "on-track",
      risk: "Low"
    },
    {
      vaultId: "48598",
      name: "Walmart Connect App",
      champion: "Luke Amery",
      state: "Prototype",
      priority: "p2",
      targetEndDate: null,
      dateHealth: "on-track",
      risk: "Low"
    }
  ],

  // External projects that depend on Channels team
  dependentProjects: [
    {
      vaultId: null,
      name: "Shop Minis",
      team: "Shop",
      lead: "TBD",
      marketsImpact: "Depends on channel catalog APIs for product display"
    },
    {
      vaultId: null,
      name: "Marketplace Integrations",
      team: "Partnerships",
      lead: "TBD",
      marketsImpact: "Relies on channel feed infrastructure"
    }
  ],

  // Key dates to display (static, update as needed)
  keyDates: [
    { date: "Feb 15", event: "Agentic v2.1 beta launch" },
    { date: "Jun 1", event: "Alison returns from mat leave" }
  ],

  // AI prompt for generating urgent items (focus on owned projects only)
  urgentItemsPrompt: `Based on the following Channels team weekly data, identify the top 3 most urgent items that need discussion or action.

IMPORTANT: Focus ONLY on projects owned by Channels team. Do NOT include items about dependent/external projects.

Consider:
- Projects at risk or off-track
- Deadline proximity for our projects
- Blockers affecting our deliverables
- API or catalog feed issues we own

For each urgent item, provide:
1. A short title (under 60 chars)
2. Why it's urgent (1-2 sentences with specific data)
3. Recommended action (1 sentence, actionable)

Format as JSON array with objects containing: title, reason, action`
};

// Export for use in main.js
window.CONFIG = CONFIG;
