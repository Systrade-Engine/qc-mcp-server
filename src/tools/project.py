from api_connection import post, post_text
from models import (
    CreateProjectRequest, 
    ReadProjectRequest, 
    UpdateProjectRequest,
    DeleteProjectRequest,
    ProjectListResponse,
    RestResponse
)

def register_project_tools(mcp):
    # Create
    @mcp.tool(
        annotations={
            'title': 'Create project',
            'destructiveHint': False,
            'idempotentHint': False
        }
    )
    async def create_project(model: CreateProjectRequest) -> ProjectListResponse:
        """Create a new project in your default organization."""
        return await post('/projects/create', model)

    # Read (singular)
    @mcp.tool(annotations={'title': 'Read project', 'readOnlyHint': True})
    async def read_project(model: ReadProjectRequest) -> str:
        """List the details of a project or a set of recent projects."""
        return await post_text('/projects/read', model)
    
    # Read (all)
    @mcp.tool(annotations={'title': 'List projects', 'readOnlyHint': True})
    async def list_projects() -> str:
        """List the details of all projects."""
        return await post_text('/projects/read')

    # Update
    @mcp.tool(annotations={'title': 'Update project', 'idempotentHint': True})
    async def update_project(model: UpdateProjectRequest) -> RestResponse:
        """Update a project's name or description."""
        return await post('/projects/update', model)
        
    # Delete
    @mcp.tool(annotations={'title': 'Delete project', 'idempotentHint': True})
    async def delete_project(model: DeleteProjectRequest) -> RestResponse:
        """Delete a project."""
        return await post('/projects/delete', model)
