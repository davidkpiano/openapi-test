import * as mocha from "mocha";
import * as chai from "chai";
import * as path from "path";
import * as fs from "fs";
import request from "request";
import * as cookie from "cookie";
import template from "lodash.template";
import mapValues from "lodash.mapvalues";
import Ajv from "ajv";
import * as yargs from "yargs";
import dotenv from "dotenv";
import isReachable from "is-reachable";
import { IOpenApiTest, ITestTemplateParams, SwaggerSpec } from "./types";
import chaiSubset from "chai-subset";

dotenv.config();
chai.use(chaiSubset);
const { assert } = chai;

const ajv = new Ajv({ removeAdditional: true });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function applyTemplate(
  value: string,
  params: ITestTemplateParams,
  options?: {}
): string {
  return template(value, options)(params);
}

const swaggerSpec = JSON.parse(
  fs.readFileSync(path.join(__dirname, "./examples/petstore/swagger.json"), {
    encoding: "utf-8"
  })
) as SwaggerSpec;

const isLocal = !!yargs.argv.local;
const host = isLocal
  ? "localhost:5000"
  : (yargs.argv.host as string) ||
    (process.env.OPENAPI_HOST as string) ||
    swaggerSpec.host;
const token = (yargs.argv.token as string) || process.env.OPENAPI_TOKEN;
const verbose = !!yargs.argv.verbose;
const timeout = (yargs.argv.timeout as string) || 300000; // 5 minutes

if (!host) {
  throw new Error("Must specify --host (or OPENAPI_HOST in .env file)");
}

// if (!token) {
//   throw new Error("Must specify --token (or OPENAPI_TOKEN in .env file)");
// }

// tslint:disable-next-line:no-console
console.log(`Running tests for https://${host}`);

async function executeTest(
  test: IOpenApiTest,
  // @ts-ignore
  { spec, method, methodSpec, specUrl },
  testCallbackContext: mocha.ITestCallbackContext
): Promise<Record<string, any> | undefined> {
  const serverAlive = await isReachable(host);

  if (!serverAlive) {
    throw new Error(
      `The host "${host}" is not reachable. Please ensure that the server is running. ${
        isLocal
          ? 'Run "npm start" in a different process to start the server locally.'
          : ""
      }`
    );
  }

  if (test.skip) {
    testCallbackContext.skip();
    return;
  }

  let jar: request.CookieJar;
  let reqCookie: request.Cookie | undefined;
  // tslint:disable-next-line:no-unnecessary-initializer
  const response: Record<string, any> | undefined = undefined;

  // if (test.before) {
  //     response = await executeTest(
  //         test.before,
  //         {
  //             spec,
  //             method: test.before.method,
  //             methodSpec: undefined,
  //             specUrl: test.before.url
  //         },
  //         testCallbackContext
  //     );
  // }

  const testParams: ITestTemplateParams = {
    host: host || spec.host,
    version: "v1",
    token: token as string,
    auth: false,
    random: Math.floor(Math.random() * 100000),
    response
  };

  const customTestParams = mapValues(test.params, param =>
    applyTemplate(param, testParams)
  );

  Object.assign(testParams, customTestParams);

  // Ensure that all required parameters are present before executing test
  if (test.required) {
    if (test.required.some(param => !testParams[param])) {
      return testCallbackContext.skip();
    }
  }

  const url = applyTemplate(
    `${spec.schemes[0]}://${testParams.host}${spec.basePath}${specUrl}`,
    testParams,
    {
      interpolate: /\$?\{([\s\S]+?)\}/g
    }
  );

  console.log(url);

  let query = "";

  const headers = test.request
    ? mapValues(test.request.headers, header =>
        applyTemplate(header, testParams)
      )
    : {};

  if (testParams.token && test.auth) {
    headers.Authorization = `Bearer ${testParams.token}`;
  }

  const body = test.request
    ? test.request.body !== undefined
      ? test.request.body === null
        ? null
        : mapValues(test.request.body, field =>
            applyTemplate(field, testParams)
          )
      : undefined
    : undefined;

  if (test.request && test.request.cookie) {
    jar = request.jar();
    reqCookie = request.cookie(test.request.cookie);
    if (reqCookie) {
      jar.setCookie(reqCookie, url);
    }
  }

  if (test.request && test.request.query) {
    query =
      "?" +
      Object.keys(test.request.query)
        .map(key => {
          return `${encodeURIComponent(key)}=${encodeURIComponent(
            test.request!.query![key]
          )}`;
        })
        .join("&");
  }

  const testResponse = await new Promise((resolveRequest, rejectRequest) =>
    request(
      {
        method,
        url: url + query,
        headers,
        body,
        json: true,
        jar
      },
      (err, actualResponse) => {
        if (verbose) {
          // tslint:disable-next-line:no-console
          console.dir(actualResponse.body, { depth: null });
        }
        if (err) {
          throw new Error(err);
        }

        if (test.response.status) {
          const { status } = test.response;
          const statuses = ([] as number[]).concat(status);

          assert.include(
            statuses,
            actualResponse.statusCode,
            `status code mismatch for ${method.toUpperCase()}`
          );

          if (
            methodSpec &&
            methodSpec.responses[actualResponse.statusCode] &&
            methodSpec.responses[actualResponse.statusCode].schema
          ) {
            // TODO: fix spec validation
            const schemaValid = ajv.validate(spec, actualResponse.body);

            assert.ok(schemaValid, ajv.errorsText());
          }
        }

        if (test.response.headers) {
          assert.containSubset(
            actualResponse.headers,
            test.response.headers,
            "missing response headers"
          );
        }

        if (test.response.cookie) {
          const resCookie = cookie.parse(jar.getCookieString(url));
          assert.containSubset(
            resCookie,
            test.response.cookie,
            "missing cookie values"
          );
        }

        resolveRequest(actualResponse.body);
      }
    )
  );

  return testResponse;
}

describe(`Swaggger E2E tests`, () => {
  Object.keys(swaggerSpec.paths).forEach(specUrl => {
    const pathSpec = swaggerSpec.paths[specUrl];

    Object.keys(pathSpec).forEach(method => {
      const methodSpec = pathSpec[method];

      const tests: IOpenApiTest[] = methodSpec["x-tests"];

      if (!tests || !tests.length) {
        return;
      }

      describe(`${method.toUpperCase()} ${specUrl}`, () => {
        tests.forEach(test => {
          it(`(${test.response.status}) ${test.description}`, async function() {
            await executeTest(
              test,
              { spec: swaggerSpec, method, methodSpec, specUrl },
              this
            );
          }).timeout(+timeout);
        });
      });
    });
  });
});
