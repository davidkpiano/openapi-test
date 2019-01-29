export interface IOpenApiTest {
  description: string;
  skip?: boolean;
  required?: string[];
  params?: Record<string, string>;
  auth?: boolean;
  request?: {
    query?: Record<string, string>;
    headers?: Record<string, string>;
    body?: string | Record<string, any>;
    cookie?: string;
  };
  response: {
    status: number | number[];
    headers?: Record<string, string>;
    cookie?: Record<string, string>;
  };
}

export interface ITestTemplateParams {
  host: string;
  version: string;
  token: string;
  random?: number;
  microsoftExchangeToken?: string;
  githubExchangeToken?: string;
  response?: Record<string, any>;
  [key: string]: any;
}

export interface SwaggerSpec {
  [key: string]: any;
  host: string;
}
