from api_connection import post
from models import (
    CreateLiveCommandRequest,
    BroadcastLiveCommandRequest,
)

def register_live_trading_command_tools(mcp):
    # Create (singular algorithm)
    @mcp.tool(annotations={'title': 'Create live command'})
    async def create_live_command(
            model: CreateLiveCommandRequest) -> str:
        """Send a command to a live trading algorithm."""
        return await post('/live/commands/create', model)

    # Create (multiple algorithms) - Broadcast
    @mcp.tool(annotations={'title': 'Broadcast live command'})
    async def broadcast_live_command(
            model: BroadcastLiveCommandRequest) -> str:
        """Broadcast a live command to all live algorithms in an 
        organization."""
        return await post('/live/commands/broadcast', model)
