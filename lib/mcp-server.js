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
        description: `Store knowledge in the knowledge graph. USE LIBERALLY - default is to WRITE.

MUST USE after EVERY action:
- After running bash/shell commands → save command + output + what it revealed
- After grep/find/search → save pattern + matches + files touched
- After ls/tree/explore → save dir path + structure summary
- After reading a file → save path + purpose + key exports/functions
- After reading a function → save name + params + return + what it does
- After edit/create file → save path + what changed + why
- After debug session → save symptom + root cause + fix
- After creating a plan → save the plan verbatim or summarized
- After completing a task → save what + how + gotchas
- After discovering API/route → save method + path + req/resp shape
- After learning pattern/convention → save name + when to apply
- After architecture insight → save components + data flow
- When user says "remember"/"ingat" → save exactly as stated

COMPRESSION RULES:
- Max 5 lines per entry. Split if longer.
- Subject + verb + object. "Auth uses JWT in middleware/auth.go"
- Drop filler. No "I discovered". Just facts.
- Include identifiers: file paths, function names, routes.

SAVE CADENCE: explore → save → explore → save → plan → save → execute → save → done → save
If unsure whether to save → SAVE.`,
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Brief title (e.g., "auth-service functions", "user-model schema", "project-name structure")',
            },
            content: {
              type: 'string',
              description: 'The knowledge to store. Max 5 lines, compressed, factual. Include file paths, function names, identifiers.',
            },
            group_id: {
              type: 'string',
              description: 'REQUIRED: Project name in kebab-case (e.g., "my-project", "vyber-html"). Used for namespacing.',
            },
          },
          required: ['name', 'content', 'group_id'],
        },
      },
      {
        name: 'search_nodes',
        description: `Search for entities/nodes in the knowledge graph. MUST USE FIRST before answering ANY question about:
- Architecture ("how does X work?")
- Code structure ("where is X?")
- Project state ("what's the status of X?")
- Past decisions ("why did we do X?")
- Debugging ("what caused X before?")

WORKFLOW:
1. User asks about project → search_nodes FIRST
2. Empty result? → Explore codebase → add_memory immediately
3. Found results? → Use them to answer

Search before you answer. If empty, explore then save.`,
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query - use project name, file names, function names, concepts',
            },
            group_id: {
              type: 'string',
              description: 'Project name (kebab-case) to filter results',
            },
            limit: {
              type: 'number',
              description: 'Max results (default: 10)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_facts',
        description: `Search for relationships/facts between entities. Use to find how things connect:
- "What uses the auth service?"
- "What depends on the database module?"
- "What calls this function?"

Use after search_nodes if you need relationship context.`,
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Query for relationships between entities',
            },
            group_id: {
              type: 'string',
              description: 'Project name (kebab-case) to filter',
            },
            limit: {
              type: 'number',
              description: 'Max results (default: 10)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_episodes',
        description: 'List recent memory episodes for a project. Use to see what was previously stored.',
        inputSchema: {
          type: 'object',
          properties: {
            group_id: {
              type: 'string',
              description: 'Project name (kebab-case)',
            },
            limit: {
              type: 'number',
              description: 'Max results (default: 10)',
            },
          },
        },
      },
      {
        name: 'delete_episode',
        description: 'Delete a memory episode by UUID. Use to remove outdated or incorrect entries.',
        inputSchema: {
          type: 'object',
          properties: {
            uuid: {
              type: 'string',
              description: 'UUID of episode to delete',
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
