#!/usr/bin/env python3
"""Generate OpenAPI specification for the API."""

import json
from pathlib import Path

from app.main import app


def generate_openapi_spec():
    """Generate and save OpenAPI specification."""
    # Get OpenAPI schema
    openapi_schema = app.openapi()
    
    # Ensure docs directory exists
    docs_dir = Path(__file__).parent.parent / "docs"
    docs_dir.mkdir(exist_ok=True)
    
    # Save OpenAPI spec as JSON
    spec_file = docs_dir / "openapi.json"
    with open(spec_file, "w") as f:
        json.dump(openapi_schema, f, indent=2)
    
    print(f"OpenAPI specification saved to {spec_file}")
    
    # Generate a simplified markdown version
    md_file = docs_dir / "API_REFERENCE.md"
    with open(md_file, "w") as f:
        f.write("# CrossAudit AI API Reference\n\n")
        f.write(f"**Version:** {openapi_schema['info']['version']}\n")
        f.write(f"**Description:** {openapi_schema['info']['description']}\n\n")
        
        f.write("## Available Endpoints\n\n")
        
        for path, methods in openapi_schema["paths"].items():
            f.write(f"### {path}\n\n")
            
            for method, details in methods.items():
                method_upper = method.upper()
                summary = details.get("summary", "No summary")
                f.write(f"- **{method_upper}**: {summary}\n")
                
                if "tags" in details:
                    tags = ", ".join(details["tags"])
                    f.write(f"  - Tags: {tags}\n")
                
                if "description" in details:
                    f.write(f"  - Description: {details['description']}\n")
            
            f.write("\n")
        
        f.write("## Authentication\n\n")
        f.write("The API uses JWT Bearer token authentication. Include the token in the Authorization header:\n\n")
        f.write("```\nAuthorization: Bearer <your-token>\n```\n\n")
        
        f.write("## Response Format\n\n")
        f.write("All API responses follow this format:\n\n")
        f.write("```json\n")
        f.write("{\n")
        f.write('  "success": true,\n')
        f.write('  "data": <response_data>,\n')
        f.write('  "message": "Optional message"\n')
        f.write("}\n")
        f.write("```\n\n")
    
    print(f"API documentation saved to {md_file}")


if __name__ == "__main__":
    generate_openapi_spec()