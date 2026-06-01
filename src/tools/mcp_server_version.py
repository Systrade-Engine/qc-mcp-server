from __init__ import __version__

from api_connection import httpx, response_text_or_raise

DOCKER_HUB_TAGS_URL = (
    "https://hub.docker.com/v2/namespaces/quantconnect/"
    "repositories/mcp-server/tags"
)

def register_mcp_server_version_tools(mcp):
    # Read current version
    @mcp.tool(
        annotations={
            'title': 'Read QC MCP Server version', 'readOnlyHint': True
        }
    )
    async def read_mcp_server_version() -> str:
        """Returns the version of the QC MCP Server that's running."""
        return __version__

    # Read latest version
    @mcp.tool(
        annotations={
            'title': 'Read latest QC MCP Server version', 'readOnlyHint': True
        }
    )
    async def read_latest_mcp_server_version() -> str:
        """Returns the latest version of the QC MCP Server released."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                DOCKER_HUB_TAGS_URL,
                params={"page_size": 2},
                timeout=30,
            )
            response_text = response_text_or_raise(response)

        try:
            # Get the name of the second result. The first one is 'latest'.
            return response.json()['results'][1]['name']
        except (ValueError, KeyError, IndexError, TypeError):
            return response_text
