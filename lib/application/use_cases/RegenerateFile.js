import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import ignore from 'ignore';
import logger from '../../infrastructure/logger';

/**
 * RegenerateFile Use Case
 * Reads a file, extracts entities via LLM, and syncs with knowledge graph
 * (creates new, updates existing, deletes removed entities)
 */
class RegenerateFile {
  constructor({ llmClient, embedderClient, entityNodeRepository }) {
    this.llmClient = llmClient;
    this.embedderClient = embedderClient;
    this.entityNodeRepository = entityNodeRepository;
  }
  
  /**
   * Execute the use case
   * @param {Object} input - Input parameters
   * @returns {Object} - Result summary
   */
  async execute(input) {
    const {
      file_path,
      project_root,
      group_id
    } = input;
    
    if (!file_path) throw new Error('file_path is required');
    if (!project_root) throw new Error('project_root is required');
    if (!group_id) throw new Error('group_id is required');
    
    const absolutePath = path.isAbsolute(file_path) 
      ? file_path 
      : path.join(project_root, file_path);
    
    const relativePath = path.isAbsolute(file_path)
      ? path.relative(project_root, file_path)
      : file_path;
    
    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }
    
    // Check ignore patterns
    if (this._isIgnored(relativePath, project_root)) {
      return {
        file_path: relativePath,
        status: 'ignored',
        message: 'File matches .gitignore or .dockerignore pattern'
      };
    }
    
    // Read file content
    const fileContent = fs.readFileSync(absolutePath, 'utf-8');
    const stats = fs.statSync(absolutePath);
    const lineCount = fileContent.split('\n').length;
    
    logger.info({ file_path: relativePath, lines: lineCount }, 'Extracting entities from file');
    
    // Extract entities via LLM
    const extracted = await this.llmClient.extractFileEntities(fileContent, relativePath);
    
    if (!extracted || !extracted.file) {
      return {
        file_path: relativePath,
        status: 'no_entities',
        message: 'No entities extracted from file'
      };
    }
    
    // Build entity names for this file
    const fileEntityName = `file:${group_id}:${relativePath}`;
    const newEntities = new Map();
    
    // File entity
    newEntities.set(fileEntityName, {
      name: fileEntityName,
      type: 'FILE',
      summary: `purpose: ${extracted.file.purpose} | exports: ${(extracted.file.exports || []).join(', ')} | deps: ${(extracted.file.dependencies || []).join(', ')} | lines: ${lineCount}`
    });
    
    // Function entities
    for (const func of (extracted.functions || [])) {
      const funcEntityName = `func:${group_id}:${relativePath}:${func.line_start}-${func.line_end}@${func.name}`;
      newEntities.set(funcEntityName, {
        name: funcEntityName,
        type: 'FUNCTION',
        summary: `func: ${func.signature} | does: ${func.description}`
      });
    }
    
    // Find existing entities for this file
    const existingEntities = await this._findExistingEntities(relativePath, group_id);
    
    // Sync: create, update, delete
    const result = await this._syncEntities(existingEntities, newEntities, group_id);
    
    logger.info({
      file_path: relativePath,
      created: result.created.length,
      updated: result.updated.length,
      deleted: result.deleted.length
    }, 'File regeneration complete');
    
    return {
      file_path: relativePath,
      status: 'success',
      created: result.created,
      updated: result.updated,
      deleted: result.deleted,
      summary: `Created: ${result.created.length}, Updated: ${result.updated.length}, Deleted: ${result.deleted.length}`
    };
  }
  
  /**
   * Check if file matches ignore patterns
   */
  _isIgnored(relativePath, projectRoot) {
    const ig = ignore();
    
    // Load .gitignore
    const gitignorePath = path.join(projectRoot, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      ig.add(fs.readFileSync(gitignorePath, 'utf-8'));
    }
    
    // Load .dockerignore
    const dockerignorePath = path.join(projectRoot, '.dockerignore');
    if (fs.existsSync(dockerignorePath)) {
      ig.add(fs.readFileSync(dockerignorePath, 'utf-8'));
    }
    
    // Always ignore common patterns
    ig.add([
      'node_modules',
      '.git',
      'dist',
      'build',
      '*.min.js',
      '*.map',
      'package-lock.json',
      'yarn.lock'
    ]);
    
    return ig.ignores(relativePath);
  }
  
  /**
   * Find existing entities for a file
   */
  async _findExistingEntities(filePath, groupId) {
    // Search for entities with this file path in their name
    const filePattern = `:${groupId}:${filePath}`;
    const results = await this.entityNodeRepository.searchByNamePattern(filePattern, groupId);
    
    const entities = new Map();
    for (const entity of results) {
      entities.set(entity.name, entity);
    }
    return entities;
  }
  
  /**
   * Sync entities: create new, update existing, delete removed
   */
  async _syncEntities(existing, newEntities, groupId) {
    const created = [];
    const updated = [];
    const deleted = [];
    
    // Process new entities
    for (const [name, entity] of newEntities) {
      const existingEntity = existing.get(name);
      
      if (existingEntity) {
        // Update if summary changed
        if (existingEntity.summary !== entity.summary) {
          await this.entityNodeRepository.updateSummary(existingEntity.uuid, entity.summary);
          updated.push(name);
        }
        existing.delete(name); // Mark as processed
      } else {
        // Create new entity
        const embedding = await this.embedderClient.embed(entity.name + ' ' + entity.summary);
        
        const newEntity = {
          uuid: uuidv4(),
          name: entity.name,
          labels: [entity.type],
          summary: entity.summary,
          group_id: groupId,
          created_at: new Date().toISOString(),
          name_embedding: embedding
        };
        
        await this.entityNodeRepository.create(newEntity);
        created.push(name);
      }
    }
    
    // Delete entities that no longer exist in the file
    for (const [name, entity] of existing) {
      await this.entityNodeRepository.delete(entity.uuid);
      deleted.push(name);
    }
    
    return { created, updated, deleted };
  }
}

export default RegenerateFile;
