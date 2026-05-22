/**
 * SearchNodes Use Case
 * Search entity nodes using hybrid (text + vector) search
 */
class SearchNodes {
  constructor({ entityNodeRepository, embedderClient }) {
    this.entityNodeRepository = entityNodeRepository;
    this.embedderClient = embedderClient;
  }
  
  /**
   * Execute the use case
   * @param {Object} input - Search input
   * @returns {Array} - Search results
   */
  async execute(input) {
    const {
      query,
      group_ids = [],
      limit = 20
    } = input;
    
    if (!query) {
      throw new Error('query is required');
    }
    
    // Generate embedding for query
    const queryEmbedding = await this.embedderClient.embed(query);
    
    // Search with hybrid approach
    const results = await this.entityNodeRepository.search(
      query,
      queryEmbedding,
      group_ids,
      { limit }
    );
    
    // Format results (token-efficient plain text)
    return results.map(entity => {
      const type = entity.labels?.[0] || 'ENTITY';
      const group = entity.group_id ? ` @${entity.group_id}` : '';
      return `${entity.name} [${type}] ${entity.summary}${group}`;
    }).join('\n');
  }
}

export default SearchNodes;
