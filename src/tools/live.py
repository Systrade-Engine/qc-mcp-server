from pydantic_core import to_jsonable_python
import json
import os
import webbrowser

from api_connection import (
    post,
    httpx,
    get_headers,
    BASE_URL,
    response_text_or_raise,
)
from models import (
    AuthorizeExternalConnectionRequest,
    CreateLiveAlgorithmRequest,
    ReadLiveAlgorithmRequest,
    ListLiveAlgorithmsRequest,
    ReadLivePortfolioRequest,
    ReadLiveChartRequest,
    ReadLiveOrdersRequest,
    ReadLiveInsightsRequest,
    ReadLiveLogsRequest,
    LiquidateLiveAlgorithmRequest,
    StopLiveAlgorithmRequest,
)

def should_open_auth_browser() -> bool:
    return os.getenv('QC_MCP_OPEN_AUTH_BROWSER', '').lower() in {
        '1',
        'true',
        'yes',
    }

async def handle_loading_response(response_text: str, _text: str) -> str:
    return response_text

def authorization_url_response(redirect_url: str, browser_opened=False) -> str:
    return json.dumps({
        'success': True,
        'authorizationUrl': redirect_url,
        'browserOpened': browser_opened,
        'message': (
            'Open authorizationUrl in your browser, complete the flow, '
            'then call read_connection_authorization with the same brokerage.'
        ),
    })

def register_live_trading_tools(mcp):
    # Authenticate
    @mcp.tool(
        annotations={
            'title': 'Authorize external connection', 
            'readOnlyHint': False,
            'destructiveHint': False,
            'idempotentHint': True
        }
    )
    async def authorize_connection(
            model: AuthorizeExternalConnectionRequest
            ) -> str:
        """Authorize an external connection with a live brokerage or 
        data provider.

        This tool returns the authorization URL for you to open in your
        browser. Set QC_MCP_OPEN_AUTH_BROWSER=true to also try opening
        the browser from the MCP server process.
        """
        # This endpoint is unique because post we need to extract and 
        # return the redirect URL.
        async with httpx.AsyncClient(follow_redirects=False) as client:
            response = await client.post(
                f'{BASE_URL}/live/auth0/authorize', 
                headers=get_headers(), 
                json=to_jsonable_python(model, exclude_none=True),
                timeout=300.0 # 5 minutes
            )
            response_text = response_text_or_raise(response)
            # Extract the redirect URL from the 'Location' header
            redirect_url = response.headers.get("Location")

            if not redirect_url:
                return response_text

            if not should_open_auth_browser():
                return authorization_url_response(redirect_url)

            # Local-only compatibility path.
            try:
                browser_opened = webbrowser.open(redirect_url)
            except Exception:
                return authorization_url_response(redirect_url)

            if not browser_opened:
                return authorization_url_response(redirect_url)

        # Read the authentication.
        return await post('/live/auth0/read', model, 800.0)

    @mcp.tool(
        annotations={
            'title': 'Read external connection authorization',
            'readOnlyHint': False,
            'destructiveHint': False,
            'idempotentHint': True
        }
    )
    async def read_connection_authorization(
            model: AuthorizeExternalConnectionRequest
            ) -> str:
        """Read the result of an external connection authorization flow."""
        return await post('/live/auth0/read', model, 800.0)

    # Create
    @mcp.tool(
        annotations={
            'title': 'Create live algorithm', 'destructiveHint': False
        }
    )
    async def create_live_algorithm(
            model: CreateLiveAlgorithmRequest) -> str:
        """Create a live algorithm."""
        return await post('/live/create', model)

    # Read (singular)
    @mcp.tool(annotations={'title': 'Read live algorithm', 'readOnly': True})
    async def read_live_algorithm(
            model: ReadLiveAlgorithmRequest) -> str:
        """Read details of a live algorithm."""
        return await post('/live/read', model)

    # Read (all).
    @mcp.tool(annotations={'title': 'List live algorithms', 'readOnly': True})
    async def list_live_algorithms(
            model: ListLiveAlgorithmsRequest) -> str:
        """List all your past and current live trading deployments."""
        return await post('/live/list', model)

    # Read a chart.
    @mcp.tool(annotations={'title': 'Read live chart', 'readOnly': True})
    async def read_live_chart(
            model: ReadLiveChartRequest) -> str:
        """Read a chart from a live algorithm."""
        return await handle_loading_response(
            await post('/live/chart/read', model), 'Chart is loading.'
        )

    # Read the logs.
    @mcp.tool(annotations={'title': 'Read live logs', 'readOnly': True})
    async def read_live_logs(
            model: ReadLiveLogsRequest) -> str:
        """Get the logs of a live algorithm.

        The snapshot updates about every 5 minutes."""
        return await post('/live/logs/read', model)

    # Read the portfolio state.
    @mcp.tool(annotations={'title': 'Read live portfolio', 'readOnly': True})
    async def read_live_portfolio(
            model: ReadLivePortfolioRequest) -> str:
        """Read out the portfolio state of a live algorithm.

        The snapshot updates about every 10 minutes."""
        return await post('/live/portfolio/read', model)

    # Read the orders.
    @mcp.tool(annotations={'title': 'Read live orders', 'readOnly': True})
    async def read_live_orders(
            model: ReadLiveOrdersRequest) -> str:
        """Read out the orders of a live algorithm.

        The snapshot updates about every 10 minutes."""
        return await handle_loading_response(
            await post('/live/orders/read', model), 'Orders are loading.'
        )

    # Read the insights.
    @mcp.tool(annotations={'title': 'Read live insights', 'readOnly': True})
    async def read_live_insights(
            model: ReadLiveInsightsRequest) -> str:
        """Read out the insights of a live algorithm.

        The snapshot updates about every 10 minutes."""
        return await post('/live/insights/read', model)

    # Update (stop)
    @mcp.tool(
        annotations={'title': 'Stop live algorithm', 'idempotentHint': True}
    )
    async def stop_live_algorithm(
            model: StopLiveAlgorithmRequest) -> str:
        """Stop a live algorithm."""
        return await post('/live/update/stop', model)

    # Update (liquidate)
    @mcp.tool(
        annotations={
            'title': 'Liquidate live algorithm', 'idempotentHint': True
        }
    )
    async def liquidate_live_algorithm(
            model: LiquidateLiveAlgorithmRequest) -> str:
        """Liquidate and stop a live algorithm."""
        return await post('/live/update/liquidate', model)
