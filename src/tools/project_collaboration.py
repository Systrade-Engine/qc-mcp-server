from api_connection import post
from code_source_id import add_code_source_id
from models import (
    CreateCollaboratorRequest, 
    ReadCollaboratorsRequest,
    UpdateCollaboratorRequest,
    DeleteCollaboratorRequest,
    LockCollaboratorRequest,
)

def register_project_collaboration_tools(mcp):
    # Create
    @mcp.tool(
        annotations={
            'title': 'Create project collaborator',
            'destructiveHint': False,
            'idempotentHint': True
        }
    )
    async def create_project_collaborator(
            model: CreateCollaboratorRequest) -> str:
        """Add a collaborator to a project."""
        return await post('/projects/collaboration/create', model)

    # Read
    @mcp.tool(
        annotations={
            'title': 'Read project collaborators',
            'readOnlyHint': True
        }
    )
    async def read_project_collaborators(
            model: ReadCollaboratorsRequest) -> str:
        """List all collaborators on a project."""
        return await post('/projects/collaboration/read', model)

    # Update
    @mcp.tool(
        annotations={
            'title': 'Update project collaborator',
            'idempotentHint': True
        }
    )
    async def update_project_collaborator(
            model: UpdateCollaboratorRequest) -> str:
        """Update collaborator information in a project."""
        return await post('/projects/collaboration/update', model)

    # Delete
    @mcp.tool(
        annotations={
            'title': 'Delete project collaborator',
            'idempotentHint': True
        }
    )
    async def delete_project_collaborator(
            model: DeleteCollaboratorRequest) -> str:
        """Remove a collaborator from a project."""
        return await post('/projects/collaboration/delete', model)

    # Lock
    @mcp.tool(
        annotations={
            'title': 'Lock project with collaborators',
            'idempotentHint': True
        }
    )
    async def lock_project_with_collaborators(
            model: LockCollaboratorRequest) -> str:
        """Lock a project so you can edit it. 

        This is necessary when the project has collaborators or when an 
        LLM is editing files on your behalf via our MCP Server."""
        return await post(
            '/projects/collaboration/lock/acquire', add_code_source_id(model)
        )

