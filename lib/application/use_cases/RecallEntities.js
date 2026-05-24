/**
 * RecallEntities Use Case
 * 
 * Search the knowledge graph with INLINE FRESHNESS.
 * Replaces SearchNodes.
 * 
 * Key features:
 * - Returns entities with freshness field on each result
 * - Supports freshness_filter: any | fresh_only | stale_only
 * - skip_freshness option for fast queries
 * - Default limit: 15 (reduced from 77)
 */
class RecallEntities {
  constructor({ 
    entityNodeRepository, 
    embedderClient, 
    freshnessAnnotator 
  }) {
    this.entityNodeRepository = entityNodeRepository;
    this.embedderClient = embedderClient;
    this.freshnessAnnotator = freshnessAnnotator;
  }

  /**
   * Execute the use case
   * @param {Object} input
   * @param {string} input.query - Search query (natural language or "type:scope")
   * @param {string|Array} input.group_id - Project(s) to search
   * @param {string} input.type - Optional type filter
   * @param {string} input.freshness_filter - "any" | "fresh_only" | "stale_only"
   * @param {boolean} input.skip_freshness - Skip freshness annotation for speed
   * @param {number} input.limit - Max results (default 15)
   */
  async execute(input) {
    const {
      query,
      group_id,
      group_ids,
      type = null,
      freshness_filter = 'any',
      skip_freshness = false,
      limit = 15
    } = input;

    if (!query) {
      throw new Error('query is required');
    }

    // Normalize group_ids
    let resolvedGroupIds = [];
    if (group_ids && Array.isArray(group_ids)) {
      resolvedGroupIds = group_ids;
    } else if (group_id) {
      resolvedGroupIds = Array.isArray(group_id) ? group_id : [group_id];
    }

    // Check for exact lookup pattern: "type:scope" or "type:project:scope"
    const exactMatch = this._parseExactPattern(query);
    if (exactMatch && resolvedGroupIds.length === 1) {
      const entity = await this.entityNodeRepository.findByNaturalKey(
        resolvedGroupIds[0],
        exactMatch.type,
        exactMatch.scope
      );
      
      if (entity) {
        const results = skip_freshness 
          ? [entity]
          : await this.freshnessAnnotator.annotate([entity], resolvedGroupIds[0]);
        return this._formatResults(results);
      }
    }

    // Generate query embedding for hybrid search
    const queryEmbedding = await this.embedderClient.embed(query);

    // Search with hybrid (text + vector)
    const fetchLimit = Math.min(limit * 2, 50); // Fetch extra for filtering
    let results = await this.entityNodeRepository.search(
      query,
      queryEmbedding,
      resolvedGroupIds,
      { limit: fetchLimit, type }
    );

    // Fallback cross-group search if no high-confidence matches in specified group
    const hasSpecificGroup = resolvedGroupIds.length > 0;
    const hasHighConfidenceMatch = this._hasHighConfidenceMatch(results, query);
    
    if (hasSpecificGroup && !hasHighConfidenceMatch) {
      // Search across ALL groups (empty array = no filter)
      const crossGroupResults = await this.entityNodeRepository.search(
        query,
        queryEmbedding,
        [], // No group filter
        { limit: fetchLimit, type }
      );
      
      // Find matches in OTHER groups that have high confidence
      const otherGroupMatches = crossGroupResults.filter(r => 
        !resolvedGroupIds.includes(r.group_id) && 
        this._isHighConfidenceResult(r, query)
      );
      
      if (otherGroupMatches.length > 0) {
        // Mark as cross-group matches and append
        otherGroupMatches.forEach(r => {
          r.cross_group_match = true;
          r.requested_group = resolvedGroupIds[0];
        });
        
        // Combine: original results + cross-group matches (prioritize cross-group if better scores)
        results = this._mergeResults(results, otherGroupMatches);
      }
    }

    // Annotate freshness (unless skipped)
    if (!skip_freshness && results.length > 0) {
      // Use first group_id for freshness (multi-project freshness is complex)
      const primaryGroupId = resolvedGroupIds[0] || results[0]?.group_id;
      results = await this.freshnessAnnotator.annotate(results, primaryGroupId);
    }

    // Filter by freshness
    if (freshness_filter !== 'any') {
      results = this.freshnessAnnotator.filterByFreshness(results, freshness_filter);
    }

    // Apply final limit
    results = results.slice(0, limit);

    return this._formatResults(results);
  }

  /**
   * Parse exact lookup pattern
   * Formats: "type:scope" or "type:project:scope"
   */
  _parseExactPattern(query) {
    const validTypes = ['file', 'func', 'api', 'arch', 'pattern', 'task', 'debug', 'note', 'index'];
    const parts = query.split(':');
    
    if (parts.length >= 2) {
      const maybeType = parts[0].toLowerCase();
      if (validTypes.includes(maybeType)) {
        // type:scope or type:project:scope
        const scope = parts.length >= 3 ? parts.slice(2).join(':') : parts[1];
        return { type: maybeType, scope };
      }
    }
    
    return null;
  }

  /**
   * Format results for output
   * Returns structured objects (not text lines like SearchNodes)
   */
  _formatResults(results) {
    return results.map(entity => ({
      uuid: entity.uuid,
      type: entity.type,
      scope: entity.scope,
      summary: entity.summary,
      group_id: entity.group_id,
      source_file: entity.source_file,
      updated_at: entity.updated_at,
      freshness: entity.freshness || null,
      score: entity.score,
      // Cross-group match info (when found in different group than requested)
      cross_group_match: entity.cross_group_match || false,
      requested_group: entity.requested_group || null
    }));
  }

  /**
   * Check if any result is a high-confidence match for the query
   * High confidence = query term appears in name, scope, or summary
   */
  _hasHighConfidenceMatch(results, query) {
    if (results.length === 0) return false;
    return results.some(r => this._isHighConfidenceResult(r, query));
  }

  /**
   * Check if a single result is high-confidence match
   */
  _isHighConfidenceResult(result, query) {
    const queryLower = query.toLowerCase();
    const terms = queryLower.split(/\s+/).filter(t => t.length > 2);
    
    // Check if any significant query term appears in the result
    const searchableText = [
      result.name || '',
      result.scope || '',
      result.summary || ''
    ].join(' ').toLowerCase();
    
    // High confidence if ANY term with 4+ chars matches, or score is high
    const hasTermMatch = terms.some(term => 
      term.length >= 4 && searchableText.includes(term)
    );
    
    const hasHighScore = (result.score || 0) > 0.7;
    
    return hasTermMatch || hasHighScore;
  }

  /**
   * Merge original results with cross-group matches
   * Prioritizes cross-group matches if they have higher confidence
   */
  _mergeResults(originalResults, crossGroupMatches) {
    // Put high-confidence cross-group matches first, then original
    const merged = [...crossGroupMatches, ...originalResults];
    
    // Remove duplicates by uuid
    const seen = new Set();
    return merged.filter(r => {
      if (seen.has(r.uuid)) return false;
      seen.add(r.uuid);
      return true;
    });
  }
}

export default RecallEntities;
