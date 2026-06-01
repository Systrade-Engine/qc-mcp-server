from api_connection import post
from models import (
    CreateBacktestRequest,
    ReadBacktestRequest,
    ReadBacktestChartRequest,
    ReadBacktestOrdersRequest,
    ReadBacktestInsightsRequest,
    ListBacktestRequest,
    UpdateBacktestRequest,
    DeleteBacktestRequest,
)

def register_backtest_tools(mcp):
    # Create
    @mcp.tool(
        annotations={
            'title': 'Create backtest',
            'destructiveHint': False
        }
    )
    async def create_backtest(
            model: CreateBacktestRequest) -> str:
        """Create a new backtest request and get the backtest Id."""
        return await post('/backtests/create', model)

    # Read statistics for a single backtest.
    @mcp.tool(annotations={'title': 'Read backtest', 'readOnlyHint': True})
    async def read_backtest(model: ReadBacktestRequest) -> str:
        """Read the results of a backtest."""
        return await post('/backtests/read', model)

    # Read a summary of all the backtests.
    @mcp.tool(annotations={'title': 'List backtests', 'readOnlyHint': True})
    async def list_backtests(
            model: ListBacktestRequest) -> str:
        """List all the backtests for the project."""
        return await post('/backtests/list', model)

    # Read the chart of a single backtest.
    @mcp.tool(
        annotations={'title': 'Read backtest chart', 'readOnlyHint': True}
    )
    async def read_backtest_chart(
            model: ReadBacktestChartRequest) -> str:
        """Read a chart from a backtest."""
        return await post('/backtests/chart/read', model)
    
    # Read the orders of a single backtest.
    @mcp.tool(
        annotations={'title': 'Read backtest orders', 'readOnlyHint': True}
    )
    async def read_backtest_orders(
            model: ReadBacktestOrdersRequest) -> str:
        """Read out the orders of a backtest."""
        return await post('/backtests/orders/read', model)
    
    # Read the insights of a single backtest.
    @mcp.tool(
        annotations={'title': 'Read backtest insights', 'readOnlyHint': True}
    )
    async def read_backtest_insights(
            model: ReadBacktestInsightsRequest) -> str:
        """Read out the insights of a backtest."""
        return await post('/backtests/read/insights', model)
    
    # Update
    @mcp.tool(
        annotations={'title': 'Update backtest', 'idempotentHint': True}
    )
    async def update_backtest(model: UpdateBacktestRequest) -> str:
        """Update the name or note of a backtest."""
        return await post('/backtests/update', model)
    
    # Delete
    @mcp.tool(
        annotations={'title': 'Delete backtest', 'idempotentHint': True}
    )
    async def delete_backtest(model: DeleteBacktestRequest) -> str:
        """Delete a backtest from a project."""
        return await post('/backtests/delete', model)
