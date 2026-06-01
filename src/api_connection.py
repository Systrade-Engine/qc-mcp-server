from __init__ import __version__

import httpx
from base64 import b64encode
from hashlib import sha256
from time import time
import os
from pydantic_core import to_jsonable_python

BASE_URL = 'https://www.quantconnect.com/api/v2'

MAX_RESPONSE_TEXT_CHARS = 0

try:
    MAX_RESPONSE_TEXT_CHARS = int(os.getenv('MCP_RESPONSE_TEXT_LIMIT_CHARS', '0'))
except ValueError:
    MAX_RESPONSE_TEXT_CHARS = 0

def get_credentials():
    return (
        os.getenv('QUANTCONNECT_USER_ID'),
        os.getenv('QUANTCONNECT_API_TOKEN'),
    )

def validate_credentials():
    user_id, api_token = get_credentials()
    missing = [
        name for name, value in {
            'QUANTCONNECT_USER_ID': user_id,
            'QUANTCONNECT_API_TOKEN': api_token,
        }.items()
        if not value
    ]

    if missing:
        raise RuntimeError(
            f"Missing required environment variable(s): {', '.join(missing)}"
        )

def limit_response_text(text: str) -> str:
    if MAX_RESPONSE_TEXT_CHARS <= 0 or len(text) <= MAX_RESPONSE_TEXT_CHARS:
        return text

    omitted = len(text) - MAX_RESPONSE_TEXT_CHARS
    return (
        text[:MAX_RESPONSE_TEXT_CHARS]
        + f"\n\n[truncated {omitted} character(s); "
        + "set MCP_RESPONSE_TEXT_LIMIT_CHARS=0 to disable truncation]"
    )

def get_headers():
    user_id, api_token = get_credentials()
    validate_credentials()

    # Get timestamp
    timestamp = f'{int(time())}'
    time_stamped_token = f'{api_token}:{timestamp}'.encode('utf-8')
    # Get hased API token
    hashed_token = sha256(time_stamped_token).hexdigest()
    authentication = f'{user_id}:{hashed_token}'.encode('utf-8')
    authentication = b64encode(authentication).decode('ascii')
    # Create headers dictionary.
    return {
        'Authorization': f'Basic {authentication}',
        'Timestamp': timestamp,
        'User-Agent': f'QuantConnect MCP Server v{__version__}'
    }

def response_text_or_raise(response: httpx.Response) -> str:
    """Return the response body, preserving it for HTTP status errors."""
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError:
        if response.text:
            return limit_response_text(response.text)
        raise

    return limit_response_text(response.text)

async def post(endpoint: str, model: object = None, timeout: float = 30.0):
    """Make an HTTP POST request and return the raw response body as text.
    
    Args:
        endpoint: The API endpoint path (ex: '/projects/create')
        model: Optional Pydantics model for the request.
        timeout: Optional timeout for the request (in seconds).
        
    Returns:
        Response text if successful. Otherwise, throws an exception,
        which is handled by the Server class.
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f'{BASE_URL}{endpoint}', 
            headers=get_headers(), 
            json=to_jsonable_python(model, exclude_none=True) if model else {}, 
            timeout=timeout
        )
        return response_text_or_raise(response)


async def post_text(endpoint: str, model: object = None, timeout: float = 30.0):
    """Make an HTTP POST request and return the raw response body as text."""
    return await post(endpoint, model, timeout)
