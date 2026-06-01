from api_connection import (
    post,
    httpx,
    get_headers,
    BASE_URL,
    response_text_or_raise,
)
from models import (
    ObjectStoreBinaryFile,
    GetObjectStorePropertiesRequest,
    GetObjectStoreJobIdRequest,
    GetObjectStoreURLRequest,
    ListObjectStoreRequest,
    DeleteObjectStoreRequest,
)

def register_object_store_tools(mcp):
    # Create
    @mcp.tool(
        annotations={
            'title': 'Upload Object Store file', 'idempotentHint': True
        }
    )
    async def upload_object(
            model: ObjectStoreBinaryFile) -> str:
        """Upload files to the Object Store."""
        # This endpoint is unique because post request requires `data` 
        # and `files` arguments.
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f'{BASE_URL}/object/set', 
                headers=get_headers(), 
                data={
                    'organizationId': model.organizationId,
                    'key': model.key
                }, 
                files={'objectData': model.objectData},
                timeout=30.0
            )
            return response_text_or_raise(response)

    # Read file metadata
    @mcp.tool(
        annotations={
            'title': 'Read Object Store file properties', 'readOnlyHint': True
        }
    )
    async def read_object_properties(
            model: GetObjectStorePropertiesRequest
        ) -> str:
        """Get Object Store properties of a specific organization and 
        key. 

        It doesn't work if the key is a directory in the Object Store.
        """
        return await post('/object/properties', model)

    # Read file job Id
    @mcp.tool(
        annotations={
            'title': 'Read Object Store file job Id', 'destructiveHint': False
        }
    )
    async def read_object_store_file_job_id(
            model: GetObjectStoreJobIdRequest) -> str:
        """Create a job to download files from the Object Store and 
        then read the job Id.
        """
        return await post('/object/get', model)

    # Read file download URL
    @mcp.tool(
        annotations={
            'title': 'Read Object Store file download URL',
            'readOnlyHint': True
        }
    )
    async def read_object_store_file_download_url(
            model: GetObjectStoreURLRequest) -> str:
        """Get the URL for downloading files from the Object Store."""
        return await post('/object/get', model)

    # Read all files
    @mcp.tool(
        annotations={'title': 'List Object Store files', 'readOnlyHint': True}
    )
    async def list_object_store_files(
            model: ListObjectStoreRequest) -> str:
        """List the Object Store files under a specific directory in 
        an organization.
        """
        return await post('/object/list', model)

    # Delete
    @mcp.tool(
        annotations={
            'title': 'Delete Object Store file',
            'idempotentHint': True
        }
    )
    async def delete_object(
            model: DeleteObjectStoreRequest) -> str:
        """Delete the Object Store file of a specific organization and 
        key.
        """
        return await post('/object/delete', model)
