/**
 * Channels Team Configuration
 * Edit this file to customize for your team
 */

const CONFIG = {
  // Team identity
  teamName: "Channels",
  siteKey: "channels-weekly-updates",
  slackChannel: "#channels-platform-team",

  // Vault team IDs to fetch projects from dynamically
  // Channels team (15256) + child teams: Agentic (15257), Channel Markets (16610), Multi-channel Apps (16943)
  vaultTeamIds: ["15256", "15257", "16610", "16943"],

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

  // BigQuery SQL queries for Channels metrics (customize as needed)
  queries: {
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

  // Key dates to display (static, update as needed)
  keyDates: [
    { date: "Feb 15", event: "Agentic v2.1 beta launch" },
    { date: "Jun 1", event: "Alison returns from mat leave" }
  ],

  // AI prompt for generating urgent items
  urgentItemsPrompt: `Based on the following Channels team weekly data, identify the top 3 most urgent items that need discussion or action.

Consider:
- Projects at risk or off-track
- Partner integration blockers
- Deadline proximity
- Cross-team dependencies (especially with Markets, Shop)
- API or catalog feed issues

For each urgent item, provide:
1. A short title (under 60 chars)
2. Why it's urgent (1-2 sentences with specific data)
3. Recommended action (1 sentence, actionable)

Format as JSON array with objects containing: title, reason, action`
};

// Export for use in main.js
window.CONFIG = CONFIG;
