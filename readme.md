# OpenAPI Test Runner

This library runs Swagger/OpenAPI tests against a live endpoint. It verifies that the request can be made, and that the response is in the right format.

## Quick Start

1. Install `openapi-test` to your devDependencies:

```bash
npm install openapi-test -D
```

2. Author tests per method in your Swagger/OpenAPI JSON file under the `"x-tests"` extension:

```json
{
  [...]
  "paths": {
    "/api/films": {
      "get": {
        "operationId": "/api/films/get",
        "description": "Get all films.",
        "responses": {
          "200": {
            "description": "An array of films.",
            "schema": {
              "type": "array",
              "items": {
                "$ref": "#/definitions/film"
              }
            }
          }
        },
        "x-tests": [
          {
            "description": "Get all films (success)",
            "response": {
              "status": 200
            }
          }
        ]
      }
    },
    [...]
  }
}
```

3. Run `openapi-test`:

```json
{
  "scripts": {
    "test": "openapi-test --file ./path/to/swagger.json"
  }
}
```

### Command Line Interface Options

- `--file` - the path to your Swagger/OpenAPI JSON file
- `--host` (optional) - the hostname to test against (default: the `"host"` specified in the Swagger JSON file)
- `--token` (optional) - the JWT to authorize with
- `--verbose` (optional) - whether to display the response body content (default: `false`)

### Test Format

- `description` - The description of the test, used for reporting the test results
- `auth` - Whether to add the `OPENAPI_TOKEN` JWT to the header and authorize the request (default: `false`)
- `skip` - If `true`, this test will be skipped. (default: `false`)
- `params` (optional) - Supplies dynamic parameter values (e.g., `"name": ...` would supply the value for `/{name}` in the path). Only needed for tests with URL params.
- `request` - An object that contains:
  - `query` (optional) - A mapping of query parameter keys to their values (e.g., `"format": "json"` will append `?format=json` to the URL)
- `response` - An object that contains:
  - `status` - A status code (e.g., `200`) or array of status codes (e.g., `[200, 301]`) that the expected response should match
