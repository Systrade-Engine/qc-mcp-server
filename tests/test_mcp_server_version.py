import pytest

from main import mcp


class TestMCPServerVersion:

    async def _ensure_response_has_two_periods(self, tool_name):
        unstructured_response, _ = await mcp.call_tool(tool_name, {})
        assert unstructured_response[0].text.count('.') == 2

    @pytest.mark.asyncio
    async def test_read_verion(self):
        await self._ensure_response_has_two_periods('read_mcp_server_version')

    @pytest.mark.asyncio
    async def test_read_latest_verion(self):
        await self._ensure_response_has_two_periods(
            'read_latest_mcp_server_version'
        )
