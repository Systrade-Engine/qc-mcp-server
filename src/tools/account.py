from api_connection import post

def register_account_tools(mcp):
    # Read
    @mcp.tool(
        annotations={
            'title': 'Read account',
            'readOnlyHint': True,
            'openWorldHint': True
        }
    )
    async def read_account() -> str:
        """Read the organization account status."""
        return await post('/account/read')
