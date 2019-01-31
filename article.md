# Data-driven Swagger Integration Testing

When developing APIs, it often seems simpler to write numerous unit tests with various mocks and stubs to ensure that the functionality behind the API endpoints is logically sound. However, even with thousands of unit tests and complete code coverage, nothing can guarantee that your endpoints will _actually work_ in production like integration and end-to-end tests can.

The problem is that integration tests seem more difficult to author: you have to set up live environments, seed databases with live data, and ensure that no production databases are affected by the tests. Furthermore, you have to set up each test manually and do all of the following:

- Prepare the request with the necessary headers (including `Content-Type` and `Authorization`, if needed)
- Prepare the request's body and/or query parameters
- Assert that the server is reachable
- Assert that the request reaches the server
- When the response arrives, assert that the status code matches what is expected (e.g., `200`)
- Assert that the response body has the correct `Content-Type` (if applicable)
- Assert that the response body's schema is as expected (if applicable)

That's a lot of steps for each integration test! However, by adopting a data-driven approach with [OpenAPI (Swagger)](https://swagger.io/docs/specification/about/) and its [extensions](https://swagger.io/docs/specification/openapi-extensions/), we can create declarative tests directly in the OpenAPI specification files (e.g., `swagger.json`) without having to create each integration test by hand.

## What is Swagger/OpenAPI?

According to the [Swagger.io site](https://swagger.io/docs/specification/about/):

> OpenAPI Specification (formerly Swagger Specification) is an API description format for REST APIs.

In short, it is a well-specified human-readable JSON or YAML file that describes your API's public endpoints (e.g., `/users`), methods on those endpoints (e.g., `GET /users`), and possible responses. It specifies the format of the requests and responses, but not _how_ a certain type of request becomes a certain type of response -- those are implementation details of your API.

Using OpenAPI is strongly encouraged with any RESTful API because it prevents the important design details of your API from being hidden in the code. The OpenAPI spec that is created for your API becomes a declarative, living document that can be consumed by other tools to automatically generate documentation or server stubs. In this case, we'll be using it with [custom extensions](https://swagger.io/docs/specification/openapi-extensions/) to author tests.

## Data-Driven Tests

Instead of manually coding each test, we can describe them within the Swagger JSON file using an `"x-tests"` custom extension. For example, if we had a Swagger JSON file for the [Star Wars API](https://swapi.co), a test for `GET /api/films` can be added:

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

This specifies a test that `GET /api/films` will respond with a `200 OK` status, and that the response matches the `"schema"` specified in the method description. More tests can be added to `"x-tests"` (e.g., for testing error/failure responses, different request types, etc.), and more properties can be added to each test to be read by a test runner.

## The OpenAPI Test Runner

To automate the process of authoring and executing E2E tests from Swagger files, the [`openapi-test`](https://github.com/davidkpiano/openapi-test) library has been created, which will run the tests specified in `"x-tests"` in Mocha. This can be installed via NPM:

```bash
npm install openapi-test -D
```

Each test in `"x-tests"` can have the following properties:

- `description` - The description of the test, used for reporting the test results
- `auth` - Whether to add the `--token` JWT to the header and authorize the request (default: `false`)
- `skip` - If `true`, this test will be skipped. (default: `false`)
- `params` (optional) - Supplies dynamic parameter values (e.g., `"name": ...` would supply the value for `/{name}` in the path). Only needed for tests with URL params.
- `request` - An object that contains:
  - `query` (optional) - A mapping of query parameter keys to their values (e.g., `"format": "json"` will append `?format=json` to the URL)
- `response` - An object that contains:
  - `status` - A status code (e.g., `200`) or array of status codes (e.g., `[200, 301]`) that the expected response should match

You can see [examples in the `openapi-test` GitHub repo](https://github.com/davidkpiano/openapi-test/tree/master/examples/) to see how these are authored.

## Executing the Tests

The `openapi-test` package adds an `openapi-test` binary, which can be run as a command:

```bash
openapi-test --file=./swagger.json
```

There are a few options that the `openapi-test` command can take:

- `--file` - the path to your Swagger/OpenAPI JSON file
- `--host` (optional) - the hostname to test against (default: `process.env.OPENAPI_HOST`)
- `--token` (optional) - the JWT to authorize with (default: `process.env.OPENAPI_TOKEN`)
- `--verbose` (optional) - whether to display the response body content (default: `false`)

It is recommended that these tests are run as part of your testing plan, locally and/or in your continuous integration (CI/CD) environment:

```json
{
  "scripts": {
    "test-swagger": "openapi-test --file=./swagger.json"
  }
}
```

See the [README](https://github.com/davidkpiano/openapi-test) for more details.

## API Testing Best Practices

Writing integration and E2E tests are both the most effective and riskiest tests to execute, because they test your API in the most accurate, realistic way possible. This can become a concern if the API has side-effects such as writing to databases or making requests to 3rd-party services. Here are some tips that we've found make for effective API tests:

**Use an isolated test environment.**

By dedicating a separate environment (i.e., separate resources, such as databases, etc.) to testing, you can:

- Seed and wipe a test database from scratch on each deployment
- Provide deterministic seed data to the database
- Ensure that no live (production) resources are interfered with
- Have a realistic, fully controlled environment that users never see

In testing, it is important to remain deterministic and to not affect any production environments, and coming up with a plan for isolating your test resources is a great way to do that.

**Use a local test environment.**

Alternatively, you can create an isolated local environment for testing, including all the resources (database, etc.) that you need to execute the tests deterministically. Using [Docker, especialy with Azure](https://azure.microsoft.com/en-us/services/kubernetes-service/docker/) is a secure, maintainable way to create realistic test environments both locally and in the cloud.

Though local tests can't fully simulate potential issues like network latency, they provide a good smoke test for ensuring that any API changes you make in development do not have any adverse effects or breaking changes on the existing API. These tests are also a good indicator of which parts of your OpenAPI specification need to be updated, and whether bumping your API version is warranted.

**Test many possible cases.**

When writing integration tests, don't just test the happy paths. Each endpoint (e.g., `/users`) can be operated on by one or more methods (e.g., `GET /users` or `POST /users`), and each one of those operations can result in different responses, such as `200 OK` or `404 Not Found`. It is important that all possible response statuses are covered in your tests:

```json
{
  [...]
  "x-tests": [
    {
      "description": "success",
      "params": {
        "id": 1
      },
      "response": {
        "status": 200
      }
    },
    {
      "description": "unknown film",
      "params": {
        "id": 100
      },
      "response": {
        "status": 404
      }
    }
  ]
  [...]
}
```

Here are some possible cases that each test should have:

- `200` response (happy path)
- `404` response (expected not found path)
- `400` response (request errors):
  - Missing/improperly formatted query parameters
  - Wrong body format
  - Missing/improperly formatted headers
- `403` response (authorization errors)
  - Missing/improperly formatted auth tokens
  - Explicitly forbidden (but valid) auth tokens
  - Protected resources
- `500` response (server errors)

## Conclusion

Writing integration and E2E tests can catch potential API bugs early in the development process. Using a data-driven approach, such as with [openapi-test](https://github.com/davidkpiano/openapi-test), these tests can be authored directly in Swagger/OpenAPI specification files and automated. When tests are declarative and human-readable, maintenance becomes more effortless, and the integrity of the tests will remain strong as the API evolves over time.

Happy testing!
