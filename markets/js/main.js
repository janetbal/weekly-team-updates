/**
 * Markets Weekly Team Updates - Main Controller
 * Handles data loading, generation, rendering, and quick.db integration
 */

const WeeklyUpdates = {
  // Configuration (loaded from config.js)
  config: {
    dbKey: null, // Set from CONFIG.siteKey in init()
    archiveDepth: 4,
  },

  // Current state
  currentWeek: null,
  archivedWeeks: [],
  activeWeekKey: null,
  isGenerating: false,

  /**
   * Initialize the application
   */
  async init() {
    console.log('Weekly Updates initializing...');

    // Merge config from config.js
    if (window.CONFIG) {
      this.config = { ...this.config, ...window.CONFIG };
      // Use siteKey as dbKey for quick.db storage
      this.config.dbKey = window.CONFIG.siteKey || 'weekly-updates';
    }

    // Load data from quick.db
    await this.loadData();

    // Set up event listeners
    this.setupEventListeners();

    // Render the UI
    this.render();

    // Update generate button visibility
    this.updateGenerateButton();

    // Hide loading overlay
    this.hideLoading();
  },

  /**
   * Check if today is Monday, Tuesday, or Wednesday (generation allowed)
   */
  canGenerateToday() {
    const day = new Date().getDay();
    return day === 1 || day === 2 || day === 3; // Mon=1, Tue=2, Wed=3
  },

  /**
   * Update generate button state based on day
   */
  updateGenerateButton() {
    const generateBtn = document.getElementById('generate-btn');
    const generateHint = document.getElementById('generate-hint');

    if (!generateBtn) return;

    if (this.canGenerateToday()) {
      generateBtn.disabled = false;
      if (generateHint) generateHint.classList.add('hidden');
    } else {
      generateBtn.disabled = true;
      if (generateHint) {
        generateHint.classList.remove('hidden');
      }
    }
  },

  /**
   * Main generation flow - orchestrates fetching and report creation
   */
  async generate() {
    if (!this.canGenerateToday()) {
      alert('Report generation is only available Monday through Wednesday');
      return;
    }

    if (this.isGenerating) {
      console.log('Generation already in progress');
      return;
    }

    this.isGenerating = true;
    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
      generateBtn.disabled = true;
      generateBtn.innerHTML = `
        <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Generating...
      `;
    }

    try {
      // Step 1: Fetch BigQuery metrics
      this.showLoadingMessage('Fetching migration metrics from BigQuery...');
      const metrics = await this.fetchMetrics();
      console.log('Metrics fetched:', metrics);

      // Step 2: Fetch Vault project data
      this.showLoadingMessage('Fetching project data from Vault...');
      const projects = await this.fetchVaultProjects();
      console.log('Projects fetched:', projects);

      // Step 3: Fetch dependent project data
      this.showLoadingMessage('Fetching dependent project data...');
      const dependentProjects = await this.fetchDependentProjects();
      console.log('Dependent projects fetched:', dependentProjects);

      // Step 4: Summarize project updates with AI
      this.showLoadingMessage('Summarizing project updates...');
      const summarizedProjects = await this.summarizeProjectUpdates(projects);
      console.log('Project summaries generated:', summarizedProjects);

      // Step 5: Generate AI analysis for urgent items
      this.showLoadingMessage('Generating urgent items analysis...');
      const urgentItems = await this.generateUrgentItems(metrics, summarizedProjects, dependentProjects);
      console.log('Urgent items generated:', urgentItems);

      // Step 6: Assemble the report
      const weekKey = this.getCurrentWeekKey();
      const now = new Date();
      const report = {
        weekKey: weekKey,
        weekOf: this.formatWeekDate(weekKey),
        generatedAt: now.toISOString(),
        generatedBy: await this.getCurrentUser(),
        migrationMetrics: metrics,
        urgentItems: urgentItems,
        projects: summarizedProjects,
        dependentProjects: dependentProjects,
        keyDates: this.config.keyDates || []
      };

      // Step 7: Save to quick.db
      this.showLoadingMessage('Saving report...');
      await this.saveData(report);

      // Step 8: Update UI
      this.currentWeek = report;
      this.activeWeekKey = weekKey;
      this.render();

      // Show success toast
      this.showToast('Report generated successfully!', 'success');

    } catch (error) {
      console.error('Generation failed:', error);
      this.showToast(`Generation failed: ${error.message}`, 'error');
    } finally {
      this.isGenerating = false;
      this.hideLoadingMessage();

      if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.innerHTML = `
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
          Generate This Week's Report
        `;
      }
    }
  },

  /**
   * Fetch migration metrics from BigQuery via quick.dw
   */
  async fetchMetrics() {
    if (typeof quick === 'undefined' || !quick.dw) {
      console.warn('quick.dw not available, using placeholder metrics');
      return this.getPlaceholderMetrics();
    }

    try {
      // Fetch main migration summary
      const summaryResult = await quick.dw.query(this.config.queries?.migrationSummary || '');
      const summary = summaryResult?.rows?.[0] || {};

      // Fetch safe apps data
      const appsResult = await quick.dw.query(this.config.queries?.safeApps || '');
      const apps = appsResult?.rows?.[0] || {};

      return {
        gmvMigratedPct: summary.gmv_migrated_pct ?? null,
        gmvChangeWoW: summary.gmv_change_wow ?? null,
        shopsRemaining: summary.shops_remaining ?? null,
        shopsChangeWoW: summary.shops_change_wow ?? null,
        safeAppsPct: apps.safe_pct ?? null,
        appsChangeWoW: apps.safe_change_wow ?? null
      };
    } catch (error) {
      console.error('BigQuery fetch failed:', error);
      return this.getPlaceholderMetrics();
    }
  },

  /**
   * Get placeholder metrics when BigQuery is unavailable
   */
  getPlaceholderMetrics() {
    return {
      gmvMigratedPct: null,
      gmvChangeWoW: null,
      shopsRemaining: null,
      shopsChangeWoW: null,
      safeAppsPct: null,
      appsChangeWoW: null
    };
  },

  /**
   * Fetch project data from Vault via BigQuery
   * Falls back to static config if BigQuery is unavailable
   */
  async fetchVaultProjects() {
    if (typeof quick === 'undefined' || !quick.dw) {
      console.warn('quick.dw not available, using static project data');
      return this.getPlaceholderProjects();
    }

    const projectIds = this.config.projectIds || [];
    const queryTemplate = this.config.queries?.vaultProjects;

    if (!queryTemplate || projectIds.length === 0) {
      console.log('No vaultProjects query or projectIds configured');
      return this.getPlaceholderProjects();
    }

    try {
      // Build the query with project IDs
      const projectIdsList = projectIds.map(id => `'${id}'`).join(', ');
      const query = queryTemplate.replace('{PROJECT_IDS}', projectIdsList);

      const result = await quick.dw.query(query);
      const rows = result?.rows || [];

      if (rows.length === 0) {
        console.log('No projects returned from BigQuery');
        return this.getPlaceholderProjects();
      }

      // Transform BigQuery results to our format
      const projects = rows.map(row => ({
        vaultId: row.project_id,
        name: row.name || 'Unknown Project',
        state: row.state || '--',
        champion: row.champion || '--',
        targetEndDate: row.target_end_date || '--',
        dateHealth: this.normalizeHealthStatus(row.date_health),
        thisWeek: row.recent_updates || row.project_summary || 'No updates available.',
        risk: this.calculateRisk(row),
        priority: row.priority?.toLowerCase() || 'p1'
      }));

      console.log('Fetched projects from BigQuery:', projects.length);
      return projects;

    } catch (error) {
      console.error('Failed to fetch from BigQuery:', error);
      return this.getPlaceholderProjects();
    }
  },

  /**
   * Summarize project updates using AI
   * Takes raw recent posts and creates concise summaries for each project
   */
  async summarizeProjectUpdates(projects) {
    if (typeof quick === 'undefined' || !quick.ai) {
      console.warn('quick.ai not available, using raw updates');
      return projects;
    }

    const summarizedProjects = [];

    for (const project of projects) {
      // If no substantial updates, keep as-is
      if (!project.thisWeek || project.thisWeek === 'No updates available.' || project.thisWeek.length < 50) {
        summarizedProjects.push(project);
        continue;
      }

      try {
        const prompt = `Summarize these recent project updates into 2-3 concise sentences for a weekly team status report. Focus on what was accomplished and any blockers or risks.

Project: ${project.name}
Raw updates: ${project.thisWeek}

Return ONLY the summary text, no formatting or labels.`;

        const summary = await quick.ai.ask(prompt, {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200
        });

        summarizedProjects.push({
          ...project,
          thisWeek: summary.trim() || project.thisWeek
        });
      } catch (error) {
        console.error(`Failed to summarize updates for ${project.name}:`, error);
        summarizedProjects.push(project);
      }
    }

    return summarizedProjects;
  },

  /**
   * Normalize health status from Vault format
   */
  normalizeHealthStatus(status) {
    if (!status) return 'on-track';
    const normalized = status.toLowerCase().replace(/\s+/g, '-');
    if (normalized.includes('off')) return 'off-track';
    if (normalized.includes('risk')) return 'at-risk';
    return 'on-track';
  },

  /**
   * Calculate risk level from project data
   */
  calculateRisk(row) {
    if (row.is_off_track_active_project) return 'High';
    if (row.is_past_due_date) return 'High';
    const health = (row.date_health || '').toLowerCase();
    if (health.includes('off')) return 'High';
    if (health.includes('risk')) return 'Medium';
    return 'Low';
  },

  /**
   * Fetch dependent project data from Vault
   */
  async fetchDependentProjects() {
    if (typeof quick === 'undefined' || !quick.ai) {
      console.warn('quick.ai not available, using placeholder dependent projects');
      return this.getPlaceholderDependentProjects();
    }

    const projects = [];
    const dependentConfigs = this.config.dependentProjects || [];

    for (const config of dependentConfigs) {
      if (!config.vaultId) {
        // No Vault ID, use static config
        projects.push({
          name: config.name,
          team: config.team,
          lead: config.lead,
          status: 'Status unknown',
          marketsImpact: config.marketsImpact,
          targetDate: '--'
        });
        continue;
      }

      try {
        const response = await quick.ai.ask(
          `Use the vault_get_project tool to fetch project #${config.vaultId}.

Return ONLY a JSON object with these fields (no markdown, no explanation):
{
  "name": "project name",
  "status": "brief status summary",
  "targetDate": "target date or null"
}`,
          { tools: ['vault-mcp'] }
        );

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const projectData = JSON.parse(jsonMatch[0]);
          projects.push({
            name: projectData.name || config.name,
            team: config.team,
            lead: config.lead,
            status: projectData.status || 'Status unknown',
            marketsImpact: config.marketsImpact,
            targetDate: projectData.targetDate || '--'
          });
        }
      } catch (error) {
        console.error(`Failed to fetch dependent project ${config.vaultId}:`, error);
        projects.push({
          name: config.name,
          team: config.team,
          lead: config.lead,
          status: 'Failed to fetch',
          marketsImpact: config.marketsImpact,
          targetDate: '--'
        });
      }
    }

    return projects;
  },

  /**
   * Generate AI analysis for urgent items
   */
  async generateUrgentItems(metrics, projects, dependentProjects) {
    if (typeof quick === 'undefined' || !quick.ai) {
      console.warn('quick.ai not available, cannot generate urgent items');
      return [];
    }

    try {
      const dataContext = `
Migration Metrics:
- GMV Migrated: ${metrics.gmvMigratedPct ?? 'N/A'}%
- GMV Change WoW: ${metrics.gmvChangeWoW ?? 'N/A'}%
- Shops Remaining: ${metrics.shopsRemaining ?? 'N/A'}
- Shops Change WoW: ${metrics.shopsChangeWoW ?? 'N/A'}
- Safe Apps: ${metrics.safeAppsPct ?? 'N/A'}%

Projects:
${projects.map(p => `- ${p.name}: State=${p.state}, Risk=${p.risk}, DateHealth=${p.dateHealth}, Summary: ${p.thisWeek}`).join('\n')}

Dependent Projects:
${dependentProjects.map(p => `- ${p.name} (${p.team}): ${p.status}, Markets Impact: ${p.marketsImpact}`).join('\n')}

Key Upcoming Dates:
${(this.config.keyDates || []).slice(0, 5).map(d => `- ${d.date}: ${d.event}`).join('\n')}
`;

      const prompt = this.config.urgentItemsPrompt + '\n\nDATA:\n' + dataContext;

      const response = await quick.ai.ask(prompt, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500
      });

      // Parse the response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return [];
    } catch (error) {
      console.error('Failed to generate urgent items:', error);
      return [];
    }
  },

  /**
   * Get current user for "generated by" attribution
   */
  async getCurrentUser() {
    if (typeof quick !== 'undefined' && quick.user) {
      try {
        const user = await quick.user.get();
        return user?.email || user?.name || 'Unknown';
      } catch (e) {
        console.warn('Could not get current user:', e);
      }
    }
    return 'Unknown';
  },

  /**
   * Get placeholder projects using static config data
   */
  getPlaceholderProjects() {
    return (this.config.projects || []).map(p => ({
      name: p.name,
      state: p.state || '--',
      champion: p.champion,
      targetEndDate: p.targetEndDate || '--',
      dateHealth: p.dateHealth || 'on-track',
      thisWeek: 'Generate report to see weekly updates.',
      risk: p.risk || 'Low',
      vaultId: p.vaultId
    }));
  },

  /**
   * Get placeholder dependent projects
   */
  getPlaceholderDependentProjects() {
    return (this.config.dependentProjects || []).map(p => ({
      name: p.name,
      team: p.team,
      lead: p.lead,
      status: 'Status unknown',
      marketsImpact: p.marketsImpact,
      targetDate: '--'
    }));
  },

  /**
   * Load data from quick.db or static JSON file
   */
  async loadData() {
    try {
      // Try quick.db first (only works on quick.shopify.io)
      if (typeof quick !== 'undefined' && quick.db && typeof quick.db.get === 'function') {
        // Load current week
        const currentWeekKey = this.getCurrentWeekKey();
        this.currentWeek = await quick.db.get(`${this.config.dbKey}:${currentWeekKey}`);

        // Load archived weeks
        this.archivedWeeks = [];
        for (let i = 1; i <= this.config.archiveDepth; i++) {
          const weekKey = this.getWeekKey(i);
          const weekData = await quick.db.get(`${this.config.dbKey}:${weekKey}`);
          if (weekData) {
            this.archivedWeeks.push(weekData);
          }
        }

        // If no current week data, use most recent from archive
        if (!this.currentWeek && this.archivedWeeks.length > 0) {
          this.currentWeek = this.archivedWeeks.shift();
        }

        // Set active week key
        this.activeWeekKey = this.currentWeek?.weekKey || this.getCurrentWeekKey();
      }

      // Fall back to static JSON file if quick.db not available or no data
      if (!this.currentWeek) {
        console.log('quick.db not available, trying static JSON file');
        this.currentWeek = await this.loadStaticData();
      }

      // Fall back to placeholder if still no data
      if (!this.currentWeek) {
        console.log('No data available, using placeholder');
        this.currentWeek = this.getPlaceholderData();
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      this.currentWeek = await this.loadStaticData() || this.getPlaceholderData();
    }
  },

  /**
   * Load data from static JSON file (for local development)
   */
  async loadStaticData() {
    try {
      const currentWeekKey = this.getCurrentWeekKey();
      const response = await fetch(`week-${currentWeekKey}.json`);
      if (response.ok) {
        const data = await response.json();
        this.activeWeekKey = data.weekKey || currentWeekKey;
        return data;
      }
    } catch (e) {
      console.log('No static JSON file found');
    }
    return null;
  },

  /**
   * Save data to quick.db
   */
  async saveData(weekData) {
    try {
      if (typeof quick !== 'undefined' && quick.db) {
        const weekKey = weekData.weekKey || this.getCurrentWeekKey();
        await quick.db.set(`${this.config.dbKey}:${weekKey}`, weekData);
        console.log(`Saved week data to key: ${weekKey}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to save data:', error);
      return false;
    }
  },

  /**
   * Get the current week key (YYYY-MM-DD format for Monday)
   */
  getCurrentWeekKey() {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - now.getDay() + 1);
    return monday.toISOString().split('T')[0];
  },

  /**
   * Get week key for N weeks ago
   */
  getWeekKey(weeksAgo) {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - now.getDay() + 1 - (weeksAgo * 7));
    return monday.toISOString().split('T')[0];
  },

  /**
   * Format date for display
   */
  formatWeekDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  },

  /**
   * Default placeholder data
   */
  getPlaceholderData() {
    const weekKey = this.getCurrentWeekKey();
    return {
      weekKey: weekKey,
      weekOf: this.formatWeekDate(weekKey),
      generatedAt: null,
      generatedBy: null,
      migrationMetrics: this.getPlaceholderMetrics(),
      urgentItems: [],
      projects: this.getPlaceholderProjects(),
      dependentProjects: this.getPlaceholderDependentProjects(),
      keyDates: this.config.keyDates || []
    };
  },

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Generate button
    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
      generateBtn.addEventListener('click', () => this.generate());
    }

    // Export PDF
    const exportBtn = document.getElementById('export-pdf-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportPDF());
    }
  },

  /**
   * Render the entire UI
   */
  render() {
    this.renderWeekNav();
    this.renderWeekLabel();
    this.renderGeneratedInfo();
    this.renderMigrationMetrics();
    this.renderUrgentItems();
    this.renderProjectsTable();
    this.renderDependentProjects();
    this.renderKeyDates();
  },

  /**
   * Render the left sidebar week navigation
   */
  renderWeekNav() {
    const container = document.getElementById('week-list');
    if (!container) return;

    const allWeeks = [];

    if (this.currentWeek) {
      allWeeks.push({
        weekKey: this.currentWeek.weekKey,
        weekOf: this.currentWeek.weekOf
      });
    }

    this.archivedWeeks.forEach(week => {
      if (!allWeeks.find(w => w.weekKey === week.weekKey)) {
        allWeeks.push({
          weekKey: week.weekKey,
          weekOf: week.weekOf
        });
      }
    });

    allWeeks.sort((a, b) => new Date(b.weekKey) - new Date(a.weekKey));

    if (allWeeks.length === 0) {
      container.innerHTML = '<li class="week-item">No updates yet</li>';
      return;
    }

    container.innerHTML = allWeeks.map(week => {
      const isActive = week.weekKey === this.activeWeekKey;
      return `
        <li class="week-item${isActive ? ' active' : ''}" data-week="${week.weekKey}">
          ${week.weekOf || this.formatWeekDate(week.weekKey)}
        </li>
      `;
    }).join('');

    container.querySelectorAll('.week-item[data-week]').forEach(item => {
      item.addEventListener('click', () => {
        const weekKey = item.dataset.week;
        if (weekKey !== this.activeWeekKey) {
          this.loadArchivedWeek(weekKey);
        }
      });
    });
  },

  /**
   * Render week label in header
   */
  renderWeekLabel() {
    const label = document.getElementById('current-week-label');
    const metricsDate = document.getElementById('metrics-date');
    const weekOf = this.currentWeek?.weekOf || this.formatWeekDate(this.getCurrentWeekKey());

    if (label) {
      label.textContent = `Week of ${weekOf}`;
    }
    if (metricsDate) {
      metricsDate.textContent = `Week of ${weekOf}`;
    }
  },

  /**
   * Render generated info (timestamp and user)
   */
  renderGeneratedInfo() {
    const container = document.getElementById('generated-info');
    if (!container) return;

    if (this.currentWeek?.generatedAt) {
      const date = new Date(this.currentWeek.generatedAt);
      const formatted = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
      const by = this.currentWeek.generatedBy || 'Unknown';
      container.textContent = `Generated: ${formatted} by ${by}`;
      container.classList.remove('hidden');
    } else {
      container.textContent = 'Not yet generated this week';
      container.classList.remove('hidden');
    }
  },

  /**
   * Render migration metrics card
   */
  renderMigrationMetrics() {
    const metrics = this.currentWeek?.migrationMetrics || {};

    // GMV Migrated
    const gmvPct = document.getElementById('metric-gmv-pct');
    const gmvChange = document.getElementById('metric-gmv-change');
    if (gmvPct) {
      gmvPct.textContent = metrics.gmvMigratedPct != null ? `${metrics.gmvMigratedPct}%` : '--%';
    }
    if (gmvChange) {
      if (metrics.gmvChangeWoW != null) {
        const sign = metrics.gmvChangeWoW >= 0 ? '+' : '';
        gmvChange.textContent = `${sign}${metrics.gmvChangeWoW}% WoW`;
        gmvChange.className = `metric-change ${metrics.gmvChangeWoW >= 0 ? 'positive' : 'negative'}`;
      } else {
        gmvChange.textContent = '-- WoW';
        gmvChange.className = 'metric-change';
      }
    }

    // Shops Remaining
    const shopsRemaining = document.getElementById('metric-shops-remaining');
    const shopsChange = document.getElementById('metric-shops-change');
    if (shopsRemaining) {
      shopsRemaining.textContent = metrics.shopsRemaining != null ? this.formatNumber(metrics.shopsRemaining) : '--';
    }
    if (shopsChange) {
      if (metrics.shopsChangeWoW != null) {
        const sign = metrics.shopsChangeWoW <= 0 ? '' : '+';
        shopsChange.textContent = `${sign}${this.formatNumber(metrics.shopsChangeWoW)} WoW`;
        shopsChange.className = `metric-change ${metrics.shopsChangeWoW <= 0 ? 'positive' : 'negative'}`;
      } else {
        shopsChange.textContent = '-- WoW';
        shopsChange.className = 'metric-change';
      }
    }

    // Safe Apps
    const safeApps = document.getElementById('metric-safe-apps');
    const appsChange = document.getElementById('metric-apps-change');
    if (safeApps) {
      safeApps.textContent = metrics.safeAppsPct != null ? `${metrics.safeAppsPct}%` : '--%';
    }
    if (appsChange) {
      if (metrics.appsChangeWoW != null) {
        const sign = metrics.appsChangeWoW >= 0 ? '+' : '';
        appsChange.textContent = `${sign}${metrics.appsChangeWoW}% WoW`;
        appsChange.className = `metric-change ${metrics.appsChangeWoW >= 0 ? 'positive' : 'negative'}`;
      } else {
        appsChange.textContent = '-- WoW';
        appsChange.className = 'metric-change';
      }
    }
  },

  /**
   * Render urgent items
   */
  renderUrgentItems() {
    const container = document.getElementById('urgent-items');
    if (!container) return;

    const items = this.currentWeek?.urgentItems || [];

    if (items.length === 0) {
      const canGenerate = this.canGenerateToday();
      container.innerHTML = `
        <div class="urgent-item-placeholder">
          <p class="text-slate-400">
            ${canGenerate
              ? 'No urgent items yet. Click "Generate This Week\'s Report" to create.'
              : 'No urgent items. Generation available Monday-Wednesday.'}
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map((item, i) => `
      <div class="urgent-item">
        <div class="urgent-item-header">
          <span class="urgent-item-number">${i + 1}</span>
          <span class="urgent-item-title">${item.title}</span>
        </div>
        <div class="urgent-item-body">
          <p class="urgent-item-reason">${item.reason}</p>
          <p class="urgent-item-action"><strong>Recommended:</strong> ${item.action}</p>
        </div>
      </div>
    `).join('');
  },

  /**
   * Render projects table
   */
  renderProjectsTable() {
    const tbody = document.getElementById('projects-table-body');
    if (!tbody) return;

    const projects = this.currentWeek?.projects || [];

    if (projects.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="5" class="text-center text-slate-400 py-4">No projects loaded.</td></tr>
      `;
      return;
    }

    tbody.innerHTML = projects.map(project => {
      const formattedSummary = this.formatSummaryWithBreaks(project.thisWeek);

      return `
        <tr class="project-row-main">
          <td class="font-medium">${project.name}</td>
          <td><span class="state-badge ${this.getStateClass(project.state)}">${project.state}</span></td>
          <td>${project.champion}</td>
          <td>
            <span class="date-health">
              <span class="date-health-dot ${this.getDateHealthClass(project.dateHealth)}"></span>
              <span class="date-health-text">${project.targetEndDate || '--'}</span>
            </span>
          </td>
          <td><span class="risk-badge ${this.getRiskClass(project.risk)}">${project.risk}</span></td>
        </tr>
        <tr class="project-row-summary">
          <td colspan="5" class="summary-cell">${formattedSummary}</td>
        </tr>
      `;
    }).join('');
  },

  /**
   * Format summary text with line breaks
   */
  formatSummaryWithBreaks(summary) {
    if (!summary) return '--';

    const sentences = summary.split(/(?<=\.)\s+(?=[A-Z])/);

    if (sentences.length <= 2) {
      return summary;
    }

    const chunks = [];
    for (let i = 0; i < sentences.length; i += 2) {
      chunks.push(sentences.slice(i, i + 2).join(' '));
    }

    return chunks.join('<br>');
  },

  /**
   * Get CSS class for date health
   */
  getDateHealthClass(dateHealth) {
    const healthMap = {
      'on-track': 'on-track',
      'at-risk': 'at-risk',
      'off-track': 'off-track'
    };
    return healthMap[dateHealth] || 'on-track';
  },

  /**
   * Render dependent projects table
   */
  renderDependentProjects() {
    const tbody = document.getElementById('dependent-projects-body');
    if (!tbody) return;

    const projects = this.currentWeek?.dependentProjects || [];

    if (projects.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="6" class="text-center text-slate-400 py-4">No dependent projects tracked.</td></tr>
      `;
      return;
    }

    tbody.innerHTML = projects.map(project => {
      let statusClass = 'on-track';
      const statusLower = (project.status || '').toLowerCase();
      if (statusLower.includes('blocked')) {
        statusClass = 'blocked';
      } else if (statusLower.includes('risk') || statusLower.includes('at risk')) {
        statusClass = 'at-risk';
      }

      return `
        <tr>
          <td class="font-medium">${project.name}</td>
          <td>${project.team}</td>
          <td>${project.lead}</td>
          <td class="status-cell">
            <span class="dependent-status">
              <span class="dependent-status-dot ${statusClass}"></span>
              ${project.status}
            </span>
          </td>
          <td class="impact-text">${project.marketsImpact}</td>
          <td>${project.targetDate || '--'}</td>
        </tr>
      `;
    }).join('');
  },

  /**
   * Get CSS class for project state
   */
  getStateClass(state) {
    const stateMap = {
      'Discovery': 'discovery',
      'Prototype': 'prototype',
      'Build': 'build',
      'Release': 'release',
      'Observe': 'release',  // Observe uses same styling as Release
      'Done': 'complete',
      '--': 'discovery'
    };
    return stateMap[state] || 'discovery';
  },

  /**
   * Get CSS class for risk level
   */
  getRiskClass(risk) {
    const riskMap = {
      'Low': 'low',
      'Medium': 'medium',
      'High': 'high',
      'None': 'none'
    };
    return riskMap[risk] || 'none';
  },

  /**
   * Render key dates
   */
  renderKeyDates() {
    const container = document.getElementById('key-dates');
    if (!container) return;

    const dates = this.currentWeek?.keyDates || [];

    if (dates.length === 0) {
      container.innerHTML = '<p class="text-slate-400">No upcoming dates.</p>';
      return;
    }

    container.innerHTML = dates.map(item => `
      <div class="key-date-item">
        <span class="key-date-date">${item.date}</span>
        <span class="key-date-event">${item.event}</span>
      </div>
    `).join('');
  },

  /**
   * Load archived week data
   */
  async loadArchivedWeek(weekKey) {
    try {
      if (this.currentWeek?.weekKey === weekKey) {
        this.activeWeekKey = weekKey;
        this.render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const archivedWeek = this.archivedWeeks.find(w => w.weekKey === weekKey);
      if (archivedWeek) {
        this.currentWeek = archivedWeek;
        this.activeWeekKey = weekKey;
        this.render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      if (typeof quick !== 'undefined' && quick.db) {
        const weekData = await quick.db.get(`${this.config.dbKey}:${weekKey}`);
        if (weekData) {
          this.currentWeek = weekData;
          this.activeWeekKey = weekKey;
          this.render();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    } catch (error) {
      console.error('Failed to load archived week:', error);
    }
  },

  /**
   * Export to PDF
   */
  exportPDF() {
    window.print();
  },

  /**
   * Refresh data
   */
  async refresh() {
    this.showLoading();
    await this.loadData();
    this.render();
    this.hideLoading();
  },

  /**
   * Show loading overlay
   */
  showLoading() {
    const overlay = document.getElementById('loading-overlay');
    const mainContent = document.getElementById('main-content');
    if (overlay) overlay.classList.remove('hidden');
    if (mainContent) mainContent.classList.add('hidden');
  },

  /**
   * Hide loading overlay
   */
  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    const mainContent = document.getElementById('main-content');
    if (overlay) overlay.classList.add('hidden');
    if (mainContent) mainContent.classList.remove('hidden');
  },

  /**
   * Show loading message during generation
   */
  showLoadingMessage(message) {
    const loadingText = document.getElementById('loading-text');
    const overlay = document.getElementById('loading-overlay');
    if (loadingText) loadingText.textContent = message;
    if (overlay) overlay.classList.remove('hidden');

    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.classList.add('hidden');
  },

  /**
   * Hide loading message
   */
  hideLoadingMessage() {
    const overlay = document.getElementById('loading-overlay');
    const mainContent = document.getElementById('main-content');
    if (overlay) overlay.classList.add('hidden');
    if (mainContent) mainContent.classList.remove('hidden');
  },

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    // Remove existing toast
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      toast.classList.add('toast-fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  /**
   * Format number with commas
   */
  formatNumber(num) {
    if (num == null) return '--';
    return num.toLocaleString();
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  WeeklyUpdates.init();
});

// Export for external use
window.WeeklyUpdates = WeeklyUpdates;
