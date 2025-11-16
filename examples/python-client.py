"""
Example Python client for the record-mcp Cloudflare Worker
This shows how to integrate the MCP server with Python AI applications
"""

import requests
from typing import Dict, List, Any, Optional


class RecordMcpClient:
    """Client for interacting with the record-mcp HTTP API"""

    def __init__(self, base_url: str, api_key: str):
        """
        Initialize the client

        Args:
            base_url: The base URL of your Cloudflare Worker
            api_key: Your API key for authentication
        """
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        })

    def _request(self, endpoint: str, method: str = 'GET', body: Optional[Dict] = None) -> Dict:
        """Make an authenticated request to the MCP server"""
        url = f"{self.base_url}{endpoint}"

        if method == 'GET':
            response = self.session.get(url)
        elif method == 'POST':
            response = self.session.post(url, json=body)
        else:
            raise ValueError(f"Unsupported method: {method}")

        response.raise_for_status()
        return response.json()

    def call_tool(self, tool_name: str, args: Optional[Dict[str, Any]] = None) -> Dict:
        """
        Call an MCP tool

        Args:
            tool_name: Name of the tool to call
            args: Arguments for the tool

        Returns:
            Response from the server
        """
        return self._request('/mcp', 'POST', {
            'tool': tool_name,
            'arguments': args or {}
        })

    def list_tools(self) -> Dict:
        """List all available tools"""
        return self._request('/tools', 'GET')

    def health(self) -> Dict:
        """Health check"""
        return self._request('/health', 'GET')

    # Convenience methods for specific tools

    def list_review_types(self) -> Dict:
        """List all review types with their schemas and record counts"""
        return self.call_tool('list_review_types')

    def get_review_type(self, type_name: str) -> Dict:
        """Get detailed information about a specific review type"""
        return self.call_tool('get_review_type', {'typeName': type_name})

    def add_review_type(self, name: str, fields: List[Dict[str, str]]) -> Dict:
        """
        Create a new review type with a custom schema

        Args:
            name: Name of the review type (e.g., "coffee", "whisky")
            fields: List of field definitions, e.g.,
                    [{'name': 'flavor', 'type': 'string'},
                     {'name': 'rating', 'type': 'number'}]
        """
        return self.call_tool('add_review_type', {
            'name': name,
            'fields': fields
        })

    def add_field_to_type(self, type_name: str, field_name: str, field_type: str) -> Dict:
        """
        Add a new field to an existing review type schema

        Args:
            type_name: Name of the review type
            field_name: Name of the new field
            field_type: Type of the field ('string', 'number', 'boolean', 'date')
        """
        return self.call_tool('add_field_to_type', {
            'typeName': type_name,
            'fieldName': field_name,
            'fieldType': field_type
        })

    def add_review_record(self, type_name: str, data: Dict[str, Any]) -> Dict:
        """
        Add a new review record to a type

        Args:
            type_name: Name of the review type
            data: Review data matching the type's schema
        """
        return self.call_tool('add_review_record', {
            'typeName': type_name,
            'data': data
        })


# Example usage with AI agents
def example_basic_usage():
    """Basic usage example"""
    client = RecordMcpClient(
        base_url='https://your-worker.workers.dev',
        api_key='your-api-key-here'
    )

    # Health check
    health = client.health()
    print('Health:', health)

    # Create a review type for coffee
    result = client.add_review_type('coffee', [
        {'name': 'flavor', 'type': 'string'},
        {'name': 'aroma', 'type': 'string'},
        {'name': 'rating', 'type': 'number'},
        {'name': 'date_tasted', 'type': 'date'},
    ])
    print('Created type:', result)

    # Add a review
    review = client.add_review_record('coffee', {
        'flavor': 'nutty with chocolate notes',
        'aroma': 'strong and earthy',
        'rating': 8.5,
        'date_tasted': '2025-11-16T10:00:00Z'
    })
    print('Added review:', review)

    # Get all types
    types = client.list_review_types()
    print('All types:', types)


def example_with_langchain():
    """Example of using with LangChain AI agents"""
    from langchain.tools import Tool
    from langchain.agents import initialize_agent, AgentType
    from langchain.chat_models import ChatAnthropic

    client = RecordMcpClient(
        base_url='https://your-worker.workers.dev',
        api_key='your-api-key-here'
    )

    # Define LangChain tools
    tools = [
        Tool(
            name="list_review_types",
            func=lambda _: str(client.list_review_types()),
            description="List all review types with their schemas and record counts"
        ),
        Tool(
            name="add_review_type",
            func=lambda x: str(client.add_review_type(**eval(x))),
            description="Create a new review type. Input should be a dict with 'name' and 'fields'"
        ),
        Tool(
            name="add_review_record",
            func=lambda x: str(client.add_review_record(**eval(x))),
            description="Add a new review record. Input should be a dict with 'type_name' and 'data'"
        ),
    ]

    # Initialize agent
    llm = ChatAnthropic(model="claude-3-5-sonnet-20241022")
    agent = initialize_agent(
        tools,
        llm,
        agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
        verbose=True
    )

    # Use the agent
    response = agent.run("Create a new review type for wine with fields for color, taste, and vintage year")
    print(response)


def example_with_openai():
    """Example of using with OpenAI function calling"""
    import openai
    import json

    client = RecordMcpClient(
        base_url='https://your-worker.workers.dev',
        api_key='your-api-key-here'
    )

    # Define function schemas for OpenAI
    functions = [
        {
            "name": "add_review_type",
            "description": "Create a new review type with custom fields",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Name of the review type"},
                    "fields": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "type": {"type": "string", "enum": ["string", "number", "boolean", "date"]}
                            }
                        }
                    }
                },
                "required": ["name", "fields"]
            }
        },
        {
            "name": "add_review_record",
            "description": "Add a new review record",
            "parameters": {
                "type": "object",
                "properties": {
                    "type_name": {"type": "string"},
                    "data": {"type": "object"}
                },
                "required": ["type_name", "data"]
            }
        }
    ]

    # Chat with function calling
    messages = [
        {"role": "user", "content": "Create a whisky review type and add a review for Laphroaig 10"}
    ]

    response = openai.ChatCompletion.create(
        model="gpt-4",
        messages=messages,
        functions=functions,
        function_call="auto"
    )

    # Handle function call
    if response.choices[0].message.get("function_call"):
        function_name = response.choices[0].message["function_call"]["name"]
        function_args = json.loads(response.choices[0].message["function_call"]["arguments"])

        if function_name == "add_review_type":
            result = client.add_review_type(**function_args)
        elif function_name == "add_review_record":
            result = client.add_review_record(**function_args)

        print(f"Function result: {result}")


if __name__ == '__main__':
    # Run basic example
    example_basic_usage()
