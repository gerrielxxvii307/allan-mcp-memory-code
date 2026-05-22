#!/usr/bin/env node
/**
 * Allan Memory MCP Server
 * Model Context Protocol server for Claude Code integration
 */
const path = require('path');
const rootDir = path.resolve(__dirname, '..');

require('dotenv').config({ path: path.join(rootDir, '.env') });
require('@babel/register')({
  root: rootDir,
  only: [rootDir]
});

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

// Import locator after babel register
const Locator = require('./infrastructure/config/Locator').default;

const server = new Server(
  {
    name: 'allan-memory',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'add_memory',
        description: 'Store knowledge in the knowledge graph. Use this to remember important information about codebases, architecture decisions, debugging insights, and patterns.',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Title/name for this memory entry',
            },
            content: {
              type: 'string',
              description: 'The knowledge/information to store',
            },
            group_id: {
              type: 'string',
              description: 'Project/group identifier for namespacing (e.g., project name)',
            },
          },
          required: ['name', 'content'],
        },
      },
      {
        name: 'search_nodes',
        description: 'Search for entities/nodes in the knowledge graph. Use this to find stored knowledge about specific topics, people, technologies, or concepts.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query to find relevant entities',
            },
            group_id: {
              type: 'string',
              description: 'Optional: Filter by project/group',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results (default: 10)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_facts',
        description: 'Search for relationships/facts between entities in the knowledge graph. Use this to find how concepts are connected.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query to find relevant relationships',
            },
            group_id: {
              type: 'string',
              description: 'Optional: Filter by project/group',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results (default: 10)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_episodes',
        description: 'List recent memory episodes (stored knowledge entries) for a project.',
        inputSchema: {
          type: 'object',
          properties: {
            group_id: {
              type: 'string',
              description: 'Project/group identifier',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results (default: 10)',
            },
          },
        },
      },
      {
        name: 'delete_episode',
        description: 'Delete a specific memory episode by UUID.',
        inputSchema: {
          type: 'object',
          properties: {
            uuid: {
              type: 'string',
              description: 'UUID of the episode to delete',
            },
          },
          required: ['uuid'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'add_memory': {
        const addMemory = Locator.get('AddMemory');
        const result = await addMemory.execute({
          name: args.name,
          episode_body: args.content,
          group_id: args.group_id || 'default',
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'search_nodes': {
        const searchNodes = Locator.get('SearchNodes');
        const results = await searchNodes.execute({
          query: args.query,
          group_ids: args.group_id ? [args.group_id] : [],
          limit: args.limit || 10,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'search_facts': {
        const searchFacts = Locator.get('SearchFacts');
        const results = await searchFacts.execute({
          query: args.query,
          group_ids: args.group_id ? [args.group_id] : [],
          limit: args.limit || 10,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'get_episodes': {
        const getEpisodes = Locator.get('GetEpisodes');
        const results = await getEpisodes.execute({
          group_id: args.group_id,
          limit: args.limit || 10,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'delete_episode': {
        const deleteEpisode = Locator.get('DeleteEpisode');
        const result = await deleteEpisode.execute({
          uuid: args.uuid,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  try {
    // Initialize dependencies
    await Locator.init();
    
    // Start MCP server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error('Allan Memory MCP server started');
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main();
