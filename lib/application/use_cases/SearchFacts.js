/**
 * SearchFacts Use Case
 * Search facts/relationships using hybrid (text + vector) search
 */
class SearchFacts {
  constructor({ entityEdgeRepository, embedderClient }) {
    this.entityEdgeRepository = entityEdgeRepository;
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
      limit = 77
    } = input;
    
    if (!query) {
      throw new Error('query is required');
    }
    
    // Generate embedding for query
    const queryEmbedding = await this.embedderClient.embed(query);
    
    // Search with hybrid approach
    const results = await this.entityEdgeRepository.search(
      query,
      queryEmbedding,
      group_ids,
      { limit }
    );
    
    // Format results (token-efficient plain text)
    return results.map(edge => {
      const group = edge.group_id ? ` @${edge.group_id}` : '';
      return `${edge.source_name} → ${edge.target_name}: ${edge.fact}${group}`;
    }).join('\n');
  }
}

export default SearchFacts;
