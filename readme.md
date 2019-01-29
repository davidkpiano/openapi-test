# OpenAPI Test Runner

The E2E tests verify against a live server (local or remote) that the endpoints are working and respond with the expected status codes, as specified in the `src/swagger.json` file (which is automatically generated).

### Running E2E tests

**Setup:**

1. Copy the `.env.sample` file to `.env` (ignored by git) and provide the two `OPENAPI_*` keys:

- `OPENAPI_HOST` - the hostname (without protocol, e.g., `"jberdevnodeapi.azurewebsites.net"`) for the live server you want to test against
- `OPENAPI_TOKEN` - the JWT token received by following the auth flow from https://login.microsoftonline.com/jetblue.onmicrosoft.com/oauth2/token

```
OPENAPI_HOST="jberdevnodeapi.azurewebsites.net"
OPENAPI_TOKEN="eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsIng....."
```

> **Note:** If all tests are failing with 401 statuses, you might need to refresh the token (i.e., get a new token) and update the `OPENAPI_TOKEN` key.

**Executing tests:**

1. Run `npm run e2e`. This will run the tests against the `OPENAPI_HOST` specified.

**Executing tests locally:**

1. In a separate terminal window, start the server (`npm start` or `npm run dev`). This will start the app at `localhost:5000`, which is what the local E2E tests expect.
2. Run `npm run e2e-local`.

> **Note:** This is the same as `npm run e2e -- --host="localhost:5000"`

### Creating E2E tests

E2E tests are created in `tsoa.json`. Look at the `"swagger": { "spec": { "paths": ... } }` value to see the existing tests. These will be recursively merged into the existing path definitions in `src/swagger.json` automatically.

All tests for a path are placed in its `{ "<method>": { "x-tests": [ ... ] } }` array. A typical test will look like this:

```json
"/reports/{name}": {
    "get": {
        "x-tests": [
            {
                "description": "Get report (success)",
                "auth": true,
                "skip": false,
                "params": {
                    "name": "customerSection.psv"
                },
                "request": {
                    "query": {
                        "date": "2018-11-04",
                        "format": "json"
                    }
                },
                "response": {
                    "status": 200
                }
            }
        ]
    }
}
```

- `description` - The description of the test, used for reporting the test results
- `auth` - Whether to add the `OPENAPI_TOKEN` JWT to the header and authorize the request (default: `false`)
- `skip` - If `true`, this test will be skipped. (default: `false`)
- `params` (optional) - Supplies dynamic parameter values (e.g., `"name": ...` would supply the value for `/{name}` in the path). Only needed for tests with URL params.
- `request` - An object that contains:
  - `query` (optional) - A mapping of query parameter keys to their values (e.g., `"format": "json"` will append `?format=json` to the URL)
- `response` - An object that contains:
  - `status` - A status code (e.g., `200`) or array of status codes (e.g., `[200, 301]`) that the expected response should match

### Command-line interface

Usage: `npm run e2e -- --verbose`, etc.

- `--host` (optional) - the hostname to test against (default: `process.env.OPENAPI_HOST`)
- `--token` (optional) - the JWT to authorize with (default: `process.env.OPENAPI_TOKEN`)
- `--verbose` (optional) - whether to display the response body content (default: `false`)
