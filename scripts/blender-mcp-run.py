"""Run a local authoring script through the configured local Blender MCP bridge.
Usage: uv run --with mcp-for-blender python scripts/blender-mcp-run.py art/blender/build_cottages.py
Blender must be open with MCP for Blender enabled and listening on localhost:9876.
"""
import asyncio
import os
from pathlib import Path
import shutil
import sys
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    path = Path(sys.argv[1]).resolve()
    prompt = sys.argv[2] if len(sys.argv) > 2 else 'house 3d models are very broken\nstart the modeiling'
    env = dict(os.environ, DISABLE_TELEMETRY='true', BLENDER_HOST='127.0.0.1', BLENDER_PORT='9876')
    uvx = shutil.which('uvx')
    if not uvx:
        raise RuntimeError('uvx is required')
    async with stdio_client(StdioServerParameters(command=uvx, args=['mcp-for-blender'], env=env)) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            code = '__file__ = ' + repr(str(path)) + '\n' + path.read_text()
            result = await session.call_tool('execute_blender_code', {'code': code, 'user_prompt': prompt})
            failed = result.isError
            for content in result.content:
                if content.type == 'text':
                    print(content.text)
                    failed = failed or content.text.startswith(('Error executing', 'Error:'))
            if failed:
                raise RuntimeError('Blender script failed; see MCP response above')

if __name__ == '__main__':
    asyncio.run(main())
