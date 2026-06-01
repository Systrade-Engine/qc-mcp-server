from api_connection import post
from code_source_id import add_code_source_id
from models import (
    CreateProjectFileRequest,
    ReadFilesRequest,
    UpdateFileNameRequest,
    UpdateFileContentsRequest,
    PatchFileRequest,
    DeleteFileRequest,
)


def register_file_tools(mcp):
    # Create
    @mcp.tool(
        annotations={
            'title': 'Create file',
            'destructiveHint': False,
            'idempotentHint': True
        }
    )
    async def create_file(
            model: CreateProjectFileRequest) -> str:
        """Add a file to a given project."""
        return await post('/files/create', add_code_source_id(model))

    # Read
    @mcp.tool(annotations={'title': 'Read file', 'readOnlyHint': True})
    async def read_file(model: ReadFilesRequest) -> str:
        """Read a file from a project, or all files in the project if 
        no file name is provided.
        """
        return await post('/files/read', add_code_source_id(model))
    
    # Update name
    @mcp.tool(
        annotations={'title': 'Update file name', 'idempotentHint': True}
    )
    async def update_file_name(model: UpdateFileNameRequest) -> str:
        """Update the name of a file."""
        return await post('/files/update', add_code_source_id(model))

    # Update contents
    @mcp.tool(
        annotations={'title': 'Update file contents', 'idempotentHint': True}
    )
    async def update_file_contents(
            model: UpdateFileContentsRequest) -> str:
        """Update the contents of a file."""
        return await post('/files/update', add_code_source_id(model))

    # Update lines (patch)
    @mcp.tool(
        annotations={'title': 'Patch file', 'idempotentHint': True}
    )
    async def patch_file(model: PatchFileRequest) -> str:
        """Apply a patch (unified diff) to a file in a project."""
        return await post('/files/patch', add_code_source_id(model))
        
    # Delete
    @mcp.tool(annotations={'title': 'Delete file', 'idempotentHint': True})
    async def delete_file(model: DeleteFileRequest) -> str:
        """Delete a file in a project."""
        return await post('/files/delete', add_code_source_id(model))
